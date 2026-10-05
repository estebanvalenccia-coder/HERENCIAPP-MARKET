import express from "express";
import crypto from "crypto";
import { hasNeon, readNeonStorageValue, upsertNeonStorageValue } from "./neonDb.js";

const originalListen = express.application.listen;
const ACCOUNTS_KEY = "customerAccounts";
const STATE_COOKIE = "google_oauth_state";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function publicSiteUrl() {
  return String(process.env.PUBLIC_SITE_URL || "https://www.herenciamarket.es").replace(/\/$/, "");
}

function redirectUri() {
  return `${publicSiteUrl()}/api/customer/oauth/google/callback`;
}

function cookieOptions(maxAgeSeconds) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `HttpOnly; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function sessionSecret() {
  return String(process.env.ADMIN_SESSION_SECRET || process.env.JWT_SECRET || "");
}

function sign(value) {
  const secret = sessionSecret();
  if (!secret) throw new Error("ADMIN_SESSION_SECRET no configurado");
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function createCustomerToken(account) {
  const payload = Buffer.from(JSON.stringify({
    role: "customer",
    customerId: account.id,
    email: account.email,
    iat: Date.now(),
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").filter(Boolean).map((part) => {
    const [name, ...rest] = part.trim().split("=");
    return [name, decodeURIComponent(rest.join("=") || "")];
  }));
}

function safeError(message) {
  return encodeURIComponent(String(message || "No se pudo iniciar sesión con Google").slice(0, 180));
}

function redirectError(res, message) {
  return res.redirect(302, `${publicSiteUrl()}/login?social_error=${safeError(message)}`);
}

async function readAccounts() {
  if (!hasNeon()) throw new Error("Neon no está configurado");
  const raw = await readNeonStorageValue(ACCOUNTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAccounts(accounts) {
  await upsertNeonStorageValue(ACCOUNTS_KEY, JSON.stringify(accounts));
}

async function exchangeCode(code) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: String(process.env.GOOGLE_CLIENT_ID || ""),
      client_secret: String(process.env.GOOGLE_CLIENT_SECRET || ""),
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || "Google rechazó el inicio de sesión");
  }
  return data.access_token;
}

async function fetchGoogleProfile(accessToken) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("No se pudo obtener el perfil de Google");
  if (!data.email || data.email_verified !== true) throw new Error("Google no ha verificado el correo de esta cuenta");
  return data;
}

function installRoutes(app) {
  app.get("/api/customer/oauth/google", (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return redirectError(res, "El acceso con Google todavía no está configurado");
    }
    const state = crypto.randomBytes(32).toString("base64url");
    res.setHeader("Set-Cookie", `${STATE_COOKIE}=${encodeURIComponent(state)}; ${cookieOptions(10 * 60)}`);
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    url.searchParams.set("include_granted_scopes", "true");
    return res.redirect(302, url.toString());
  });

  app.get("/api/customer/oauth/google/callback", async (req, res) => {
    try {
      const cookies = parseCookies(req);
      const returnedState = String(req.query?.state || "");
      const expectedState = String(cookies[STATE_COOKIE] || "");
      if (!returnedState || !expectedState || returnedState !== expectedState) {
        throw new Error("La sesión de Google ha caducado. Inténtalo otra vez.");
      }
      if (req.query?.error) {
        throw new Error(req.query.error === "access_denied" ? "Has cancelado el acceso con Google" : "Google no pudo completar el acceso");
      }
      const code = String(req.query?.code || "");
      if (!code) throw new Error("Google no devolvió un código de acceso");

      const accessToken = await exchangeCode(code);
      const profile = await fetchGoogleProfile(accessToken);
      const email = normalizeEmail(profile.email);
      const accounts = await readAccounts();
      const index = accounts.findIndex((item) => normalizeEmail(item?.email) === email);
      const now = new Date().toISOString();

      let account;
      if (index >= 0) {
        const current = accounts[index];
        const providers = Array.from(new Set([...(Array.isArray(current.authProviders) ? current.authProviders : []), "google"]));
        account = {
          ...current,
          name: current.name || profile.name || email.split("@")[0],
          email,
          avatarUrl: current.avatarUrl || profile.picture || "",
          googleSub: String(profile.sub || current.googleSub || ""),
          authProviders: providers,
          emailVerified: true,
          updatedAt: now,
        };
        accounts[index] = account;
      } else {
        account = {
          id: crypto.randomUUID(),
          name: profile.name || email.split("@")[0],
          email,
          phone: "",
          address: "",
          avatarUrl: profile.picture || "",
          googleSub: String(profile.sub || ""),
          authProviders: ["google"],
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        };
        accounts.unshift(account);
      }

      await writeAccounts(accounts);
      res.setHeader("Set-Cookie", [
        `customer_session=${encodeURIComponent(createCustomerToken(account))}; ${cookieOptions(60 * 60 * 24 * 30)}`,
        `${STATE_COOKIE}=; ${cookieOptions(0)}`,
      ]);
      return res.redirect(302, `${publicSiteUrl()}/perfil`);
    } catch (error) {
      console.error("[google-oauth]", error?.message || error);
      res.setHeader("Set-Cookie", `${STATE_COOKIE}=; ${cookieOptions(0)}`);
      return redirectError(res, error?.message || "No se pudo iniciar sesión con Google");
    }
  });
}

express.application.listen = function patchedListen(...args) {
  if (!this.locals.__googleOAuthRoutesInstalled) {
    this.locals.__googleOAuthRoutesInstalled = true;
    installRoutes(this);
  }
  return originalListen.apply(this, args);
};
