/**
 * AliExpress Dropship IOP integration.
 * Does not purchase, pay, publish, or alter storefront inventory.
 * OAuth tokens are kept encrypted in private Neon storage.
 */
import crypto from "node:crypto";
import { makeAliExpressUnpublishedDraft } from "./aliexpressDraftImporter.js";

export const ALIEXPRESS_OAUTH_KEY = "aliexpressoauth:v1";
export const ALIEXPRESS_TRACK_KEY = "aliexpresscatalogtracked:v1";
export const ALIEXPRESS_SNAPSHOT_PREFIX = "aliexpresscatalogsnapshot:v1:";
export const ALIEXPRESS_CALLBACK = "https://herenciamarket.es/api/integrations/aliexpress/callback";
const BASE = "https://api-sg.aliexpress.com";
const COOKIE = "herencia_ae_oauth_state";
const STATE_TTL = 10 * 60 * 1000;
const MAX_PRODUCTS = 40;
const MAX_RESPONSE_BYTES = 1_500_000;
const SYNC_BATCH = 4;

function config() {
  return {
    appKey: String(process.env.ALIEXPRESS_APP_KEY || "").trim(),
    appSecret: String(process.env.ALIEXPRESS_APP_SECRET || "").trim(),
    encryptionKey: String(process.env.ALIEXPRESS_TOKEN_ENCRYPTION_KEY || process.env.ADMIN_SESSION_SECRET || "").trim(),
  };
}
function isConfigured() {
  const c = config();
  return Boolean(c.appKey && c.appSecret && c.encryptionKey.length >= 24);
}
function encryptionKey() {
  const c = config();
  if (c.encryptionKey.length < 24) throw new Error("AliExpress: secure encryption key not configured");
  return crypto.scryptSync(c.encryptionKey, "herencia-aliexpress-tokens-v1", 32);
}
export function encryptAliExpressTokens(data) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  const payload = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return JSON.stringify({ v: 1, nonce: nonce.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), payload: payload.toString("base64url") });
}
export function decryptAliExpressTokens(raw) {
  if (!raw) return null;
  const obj = JSON.parse(raw);
  if (obj.v !== 1) throw new Error("Unsupported AliExpress token version");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(obj.nonce, "base64url"));
  decipher.setAuthTag(Buffer.from(obj.tag, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(obj.payload, "base64url")), decipher.final()]).toString("utf8"));
}
export function signAliExpress(pathOrMethod, parameters, secret, isTop = false) {
  const concatenated = Object.keys(parameters).sort().map((key) => key + String(parameters[key])).join("");
  const message = (isTop ? "" : pathOrMethod) + concatenated;
  return crypto.createHmac("sha256", secret).update(message, "utf8").digest("hex").toUpperCase();
}
function signedParameters(action, parameters = {}, isTop = false) {
  const c = config();
  if (!c.appKey || !c.appSecret) throw new Error("AliExpress API credentials missing");
  const fields = {
    app_key: c.appKey,
    timestamp: String(Date.now()),
    sign_method: "sha256",
    ...(isTop ? { method: action, format: "json", v: "2.0" } : {}),
    ...parameters,
  };
  fields.sign = signAliExpress(action, fields, c.appSecret, isTop);
  return new URLSearchParams(fields);
}
async function fetchSigned(action, fields = {}, isTop = false) {
  const path = isTop ? "/sync" : "/rest" + action;
  const response = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8", "Accept": "application/json" },
    body: signedParameters(action, fields, isTop).toString(),
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("AliExpress HTTP " + response.status);
  const raw = await response.text();
  if (raw.length > MAX_RESPONSE_BYTES) throw new Error("AliExpress response too large");
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error("AliExpress response is not JSON"); }
  if (data?.error_response || data?.type === "ISV" || data?.success === false) {
    throw new Error("AliExpress API rejected request: " + String(data?.error_response?.code || data?.code || data?.gopErrorCode || "unknown").slice(0, 35));
  }
  if (data?.gopErrorCode && String(data.gopErrorCode) !== "0") throw new Error("AliExpress token request rejected");
  if (typeof data?.gopResponseBody === "string") {
    try { data = JSON.parse(data.gopResponseBody); } catch { throw new Error("Invalid AliExpress response body"); }
  }
  if (data?.code != null && String(data.code) !== "0" && !isTop) throw new Error("AliExpress token response rejected");
  return data;
}
function expiresAt(value, seconds, now = Date.now()) {
  const absolute = Number(value);
  if (Number.isFinite(absolute) && absolute > now / 1000) return absolute > 1e12 ? absolute : absolute * 1000;
  const duration = Number(seconds);
  return Number.isFinite(duration) && duration > 0 ? now + duration * 1000 : now;
}
export function normalizeAliExpressTokenResponse(data, prior = null, now = Date.now()) {
  if (!data || typeof data.access_token !== "string" || !data.access_token.trim()) throw new Error("AliExpress did not return an access token");
  const refresh = typeof data.refresh_token === "string" && data.refresh_token.trim() ? data.refresh_token : prior?.refreshToken;
  if (!refresh) throw new Error("AliExpress did not return a refresh token");
  return {
    accessToken: data.access_token,
    refreshToken: refresh,
    accessExpiresAt: expiresAt(data.expire_time, data.expires_in, now),
    refreshExpiresAt: (data.refresh_token_valid_time != null || data.refresh_expires_in != null) ? expiresAt(data.refresh_token_valid_time, data.refresh_expires_in, now) : (prior?.refreshExpiresAt || now),
    userId: String(data.user_id || prior?.userId || ""),
    accountPlatform: String(data.account_platform || prior?.accountPlatform || ""),
    connectedAt: prior?.connectedAt || new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
}
function cookieValues(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map((s) => s.trim().split("=")).filter((a) => a.length === 2).map(([k, v]) => [k, v]));
}
function stateSignature(data) {
  const c = config();
  if (!c.encryptionKey) throw new Error("Missing session signing key");
  return crypto.createHmac("sha256", c.encryptionKey).update("ae-oauth-state:" + data).digest("base64url");
}
function makeState() {
  const payload = crypto.randomBytes(24).toString("base64url") + "." + Date.now();
  return payload + "." + stateSignature(payload);
}
export function verifyAliExpressState(state, fromCookie, now = Date.now()) {
  if (typeof state !== "string" || state.length > 256 || !fromCookie || state !== fromCookie) return false;
  const pieces = state.split(".");
  if (pieces.length !== 3 || !/^\d{13}$/.test(pieces[1])) return false;
  const age = now - Number(pieces[1]);
  if (age < 0 || age > STATE_TTL) return false;
  const expected = stateSignature(pieces[0] + "." + pieces[1]);
  const provided = Buffer.from(pieces[2]);
  const expectedBuffer = Buffer.from(expected);
  return provided.length === expectedBuffer.length && crypto.timingSafeEqual(provided, expectedBuffer);
}
function clearCookie(res) {
  res.setHeader("Set-Cookie", COOKIE + "=; Domain=herenciamarket.es; Path=/api/integrations/aliexpress; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
}
function sameOrigin(req) {
  const origin = String(req.headers.origin || "").trim();
  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  return fetchSite !== "cross-site" && (origin ? origin === "https://herenciamarket.es" || origin === "https://www.herenciamarket.es" : fetchSite === "same-origin");
}
function redirect(res, marker) {
  res.writeHead(302, { Location: "/admin?aliexpress=" + encodeURIComponent(marker), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  res.end();
}
function respond(res, code, data) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(data));
}
function idList(ids) {
  if (!Array.isArray(ids) || ids.length > MAX_PRODUCTS) throw new Error("Select at most 40 product IDs");
  const normalized = ids.map((id) => String(id).trim());
  if (normalized.some((id) => !/^\d{8,22}$/.test(id))) throw new Error("Invalid AliExpress product ID");
  return [...new Set(normalized)];
}
function extractProduct(data, expectedId) {
  const result = data?.aliexpress_ds_product_get_response?.result || data?.aliexpress_ds_product_get_response?.resp_result?.result;
  if (!result || typeof result !== "object") throw new Error("AliExpress did not return product details");
  const base = result.ae_item_base_info_dto || {};
  const rawVariants = result.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o || result.ae_item_sku_info_dtos || [];
  const variants = (Array.isArray(rawVariants) ? rawVariants : [rawVariants]).filter(Boolean).map((v) => {
    const properties = v.ae_sku_property_dtos?.ae_sku_property_d_t_o || v.ae_sku_property_dtos || [];
    return {
      variantId: String(v.id || ""),
      sku: String(v.sku_code || ""),
      price: Number(v.offer_sale_price ?? v.sku_price) || null,
      currency: String(v.currency_code || base.currency_code || ""),
      stockKnown: v.sku_available_stock !== null && v.sku_available_stock !== undefined && Number.isFinite(Number(v.sku_available_stock)),
      stock: v.sku_available_stock !== null && v.sku_available_stock !== undefined && Number.isFinite(Number(v.sku_available_stock)) ? Number(v.sku_available_stock) : null,
      available: v.sku_stock === true || v.sku_stock === "true",
      properties: (Array.isArray(properties) ? properties : [properties]).filter(Boolean).map((p) => ({ name: String(p.sku_property_name || ""), value: String(p.sku_property_value || p.property_value_definition_name || ""), image: String(p.sku_image || "") })),
    };
  });
  const images = String(result.ae_multimedia_info_dto?.image_urls || "").split(";").filter((s) => /^https?:\/\//.test(s)).slice(0, 8);
  return {
    provider: "aliexpress",
    productId: String(base.product_id || expectedId),
    name: String(base.subject || ""),
    categoryId: String(base.category_id || ""),
    status: String(base.product_status_type || ""),
    currency: String(base.currency_code || ""),
    images,
    variants,
    checkedAt: new Date().toISOString(),
    publishable: false,
    note: "Costes de envio, impuestos, margenes y disponibilidad por destino deben verificarse antes de publicar.",
  };
}
export function createAliExpressConnector({ read, write, requireAdmin, saveDraft = null }) {
  if (typeof read !== "function" || typeof write !== "function" || typeof requireAdmin !== "function") throw new Error("Missing AliExpress dependencies");
  let refreshInFlight = null;
  async function getTokens() { return decryptAliExpressTokens(await read(ALIEXPRESS_OAUTH_KEY)); }
  async function saveTokens(token) { await write(ALIEXPRESS_OAUTH_KEY, encryptAliExpressTokens(token)); }
  async function refreshTokens(force = false) {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      const prior = await getTokens();
      if (!prior) throw new Error("AliExpress account not authorized");
      if (!force && Date.now() < prior.accessExpiresAt - 30 * 60_000) return prior;
      if (Date.now() >= prior.refreshExpiresAt - 60_000) throw new Error("AliExpress refresh token expired: reauthorize");
      const response = await fetchSigned("/auth/token/refresh", { refresh_token: prior.refreshToken });
      const updated = normalizeAliExpressTokenResponse(response, prior);
      await saveTokens(updated);
      return updated;
    })();
    try { return await refreshInFlight; } finally { refreshInFlight = null; }
  }
  async function withSession(method, args) {
    const current = await refreshTokens();
    const data = await fetchSigned(method, { session: current.accessToken, ...args }, true);
    if (data?.error_response) throw new Error("AliExpress query failed");
    return data;
  }
  async function getProduct(id) {
    const raw = await withSession("aliexpress.ds.product.get", { product_id: id, ship_to_country: "ES", target_currency: "EUR", target_language: "ES" });
    return extractProduct(raw, id);
  }
  async function readTracked() {
    try { return idList(JSON.parse(await read(ALIEXPRESS_TRACK_KEY) || "[]")); } catch { return []; }
  }
  async function readStatus() {
    let tokens = null, tokenError = "";
    try { tokens = await getTokens(); } catch { tokenError = "Stored tokens cannot be decrypted. Reauthorization required."; }
    return {
      provider: "aliexpress", appOnline: null, appKeyConfigured: Boolean(config().appKey),
      appSecretConfigured: Boolean(config().appSecret),
      encryptionReady: config().encryptionKey.length >= 24,
      authorized: Boolean(tokens && tokens.refreshExpiresAt > Date.now()), tokenError,
      accessExpiresAt: tokens ? new Date(tokens.accessExpiresAt).toISOString() : null,
      refreshExpiresAt: tokens ? new Date(tokens.refreshExpiresAt).toISOString() : null,
      accountPlatform: tokens?.accountPlatform || null,
      trackedCount: (await readTracked()).length,
      catalogSyncEnabled: process.env.ALIEXPRESS_CATALOG_SYNC_ENABLED === "true",
      automaticPurchasesEnabled: false,
      message: tokens && tokens.refreshExpiresAt > Date.now() ? "Cuenta conectada. Catalogo de solo lectura; compras y pagos bloqueados." : "Autoriza tu cuenta de AliExpress para conectar el catalogo.",
    };
  }
  async function handle(req, res, path) {
    const callback = path === "/api/integrations/aliexpress/callback";
    const base = "/api/admin/integrations/aliexpress";
    if (!callback && !path.startsWith(base + "/")) return false;
    if (req.method !== "GET" && req.method !== "POST") { respond(res, 405, { error: "Method not allowed" }); return true; }
    // Callback is authenticated by a short-lived, signed, browser-bound state cookie.
    // Admin login is required to START OAuth; it might be host-only on www
    // while the registered callback is on the apex domain.
    if (!callback && !await requireAdmin(req)) {
      respond(res, 401, { error: "Admin session required" });
      return true;
    }
    if (req.method === "POST" && !sameOrigin(req)) { respond(res, 403, { error: "Untrusted request origin" }); return true; }
    try {
      if (path === base + "/status" && req.method === "GET") { respond(res, 200, await readStatus()); return true; }
      if (path === base + "/authorize" && req.method === "GET") {
        if (!isConfigured()) { respond(res, 503, { error: "AliExpress credentials or encryption key missing" }); return true; }
        const state = makeState();
        res.setHeader("Set-Cookie", COOKIE + "=" + state + "; Domain=herenciamarket.es; Path=/api/integrations/aliexpress; HttpOnly; Secure; SameSite=Lax; Max-Age=600");
        const url = new URL(BASE + "/oauth/authorize");
        url.searchParams.set("response_type", "code");
        url.searchParams.set("force_auth", "true");
        url.searchParams.set("redirect_uri", ALIEXPRESS_CALLBACK);
        url.searchParams.set("client_id", config().appKey);
        url.searchParams.set("state", state);
        res.writeHead(302, { Location: url.href, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
        res.end();
        return true;
      }
      if (callback && req.method === "GET") {
        const query = new URL(req.url, "http://localhost").searchParams;
        const expectedState = cookieValues(req)[COOKIE];
        clearCookie(res);
        if (!verifyAliExpressState(query.get("state"), expectedState)) { redirect(res, "invalid_state"); return true; }
        if (query.has("error")) { redirect(res, "access_denied"); return true; }
        const code = query.get("code") || "";
        if (!code || code.length > 2048) { redirect(res, "missing_code"); return true; }
        if (!isConfigured()) { redirect(res, "missing_config"); return true; }
        const tokenResponse = await fetchSigned("/auth/token/create", { code });
        const tokens = normalizeAliExpressTokenResponse(tokenResponse);
        await saveTokens(tokens);
        redirect(res, "connected");
        return true;
      }
      if (path === base + "/refresh" && req.method === "POST") {
        await refreshTokens(true);
        respond(res, 200, await readStatus());
        return true;
      }
      if (path === base + "/product" && req.method === "GET") {
        const id = new URL(req.url, "http://localhost").searchParams.get("product_id") || "";
        if (!/^\d{8,22}$/.test(id)) { respond(res, 400, { error: "Invalid product ID" }); return true; }
        respond(res, 200, await getProduct(id));
        return true;
      }
      if (path === base + "/draft" && req.method === "POST") {
        if (typeof saveDraft !== "function") { respond(res, 503, { error: "Catalog draft storage unavailable" }); return true; }
        let raw = "";
        for await (const chunk of req) { raw += chunk; if (raw.length > 1500) break; }
        if (raw.length > 1500) { respond(res, 413, { error: "Payload too large" }); return true; }
        let body; try { body = JSON.parse(raw); } catch { respond(res, 400, { error: "Invalid JSON" }); return true; }
        const productId = String(body.productId || "");
        if (!/^\\d{8,22}$/.test(productId)) { respond(res, 400, { error: "Invalid product ID" }); return true; }
        const product = await getProduct(productId);
        const draft = makeAliExpressUnpublishedDraft(product);
        const saved = await saveDraft(draft, { id: draft.id, createOnly: true });
        if (!saved) { respond(res, 409, { error: "Draft already exists; existing product was not changed" }); return true; }
        respond(res, 201, { id: draft.id, status: "draft", active: false, provider: "aliexpress", variants: draft.variants.length, publicationEnabled: false });
        return true;
      }
      if (path === base + "/tracked" && req.method === "GET") {
        const ids = await readTracked();
        const snapshots = await Promise.all(ids.map(async (id) => {
          try { return JSON.parse(await read(ALIEXPRESS_SNAPSHOT_PREFIX + id) || "null"); } catch { return null; }
        }));
        respond(res, 200, { ids, snapshots: snapshots.filter(Boolean), note: "Snapshots are never published automatically or used to authorize payments." });
        return true;
      }
      if (path === base + "/tracked" && req.method === "POST") {
        let raw = "";
        for await (const chunk of req) { raw += chunk; if (raw.length > 4000) break; }
        if (raw.length > 4000) { respond(res, 413, { error: "Payload too large" }); return true; }
        const parsed = JSON.parse(raw);
        const ids = idList(parsed.productIds);
        await write(ALIEXPRESS_TRACK_KEY, JSON.stringify(ids));
        respond(res, 200, { trackedCount: ids.length, ids, publicProductsChanged: false });
        return true;
      }
      respond(res, 404, { error: "AliExpress endpoint unavailable" });
      return true;
    } catch (error) {
      // Avoid logging OAuth codes, credentials, tokens or full provider payloads.
      const message = String(error?.message || "AliExpress error");
      if (callback) { clearCookie(res); redirect(res, "token_failed"); }
      else respond(res, 502, { error: "AliExpress request failed", reason: /not authorized|expired|encryption key|credentials/i.test(message) ? message : "Consult the provider API permissions and authorization." });
      return true;
    }
  }
  async function sweep() {
    if (!isConfigured()) return { status: "not_configured" };
    const tokens = await getTokens();
    if (!tokens) return { status: "not_authorized" };
    await refreshTokens();
    if (process.env.ALIEXPRESS_CATALOG_SYNC_ENABLED !== "true") return { status: "token_checked" };
    const tracked = await readTracked();
    if (!tracked.length) return { status: "no_tracked_products" };
    const cursorRaw = await read("aliexpresscatalogcursor:v1");
    const cursor = Math.max(0, Number.parseInt(String(cursorRaw || "0"), 10) || 0) % tracked.length;
    const ids = Array.from({ length: Math.min(SYNC_BATCH, tracked.length) }, (_, i) => tracked[(cursor + i) % tracked.length]);
    let checked = 0;
    for (const id of ids) {
      try {
        const product = await getProduct(id);
        await write(ALIEXPRESS_SNAPSHOT_PREFIX + id, JSON.stringify(product));
        checked++;
      } catch { break; }
    }
    if (checked > 0) await write("aliexpresscatalogcursor:v1", String((cursor + checked) % tracked.length));
    return { status: "catalog_checked", checked };
  }
  function startAutomation() {
    const timer = setInterval(() => void sweep().catch(() => { /* logged only as generic status; no sensitive data */ }), 20 * 60_000);
    timer.unref?.();
    return timer;
  }
  return { handle, sweep, startAutomation, readStatus };
}
