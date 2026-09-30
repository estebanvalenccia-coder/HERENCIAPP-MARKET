import express from "express";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const originalListen = express.application.listen;
const RESET_KEY = "customerPasswordResetTokens";
const ACCOUNTS_KEY = "customerAccounts";
const PAID_STATUSES = ["paid", "confirmed", "preparing", "ready", "delivered", "completed"];

function normalizeEmail(value) { return String(value || "").trim().toLowerCase(); }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value)); }
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  return { salt, hash: crypto.scryptSync(String(password || ""), salt, 64).toString("hex") };
}
function hashToken(token) { return crypto.createHash("sha256").update(String(token)).digest("hex"); }
function publicSiteUrl() { return String(process.env.PUBLIC_SITE_URL || "https://www.herenciamarket.es").replace(/\/$/, ""); }

function client() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}
async function readStorage(db, key, fallback = []) {
  const { data, error } = await db.from("app_storage").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  if (!data?.value) return fallback;
  try { return JSON.parse(data.value); } catch { return fallback; }
}
async function writeStorage(db, key, value) {
  const { error } = await db.from("app_storage").upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() });
  if (error) throw error;
}
async function sendResetEmail(to, resetUrl) {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY no configurada");
  const from = process.env.EMAIL_FROM || "Herencia Market <onboarding@resend.dev>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to, subject: "Recupera tu contraseña de Herencia Market",
      html: `<!doctype html><html lang="es"><body style="margin:0;background:#f7f4ee;font-family:Arial,sans-serif;color:#213128"><table role="presentation" width="100%"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" style="max-width:620px;background:#fff;border-radius:24px;overflow:hidden"><tr><td style="background:#426047;color:#fff;padding:28px;text-align:center"><h1 style="margin:0">Herencia Market</h1></td></tr><tr><td style="padding:28px"><h2>Recupera tu contraseña</h2><p style="line-height:1.6">Hemos recibido una solicitud para cambiar la contraseña de tu cuenta.</p><p style="margin:28px 0;text-align:center"><a href="${resetUrl}" style="display:inline-block;background:#426047;color:#fff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:700">Crear nueva contraseña</a></p><p style="font-size:13px;color:#718078">Este enlace caduca en 30 minutos y solo puede utilizarse una vez. Si no pediste este cambio, ignora este correo.</p></td></tr></table></td></tr></table></body></html>`
    })
  });
  if (!response.ok) throw new Error(`Resend respondió ${response.status}`);
}

function installRoutes(app) {
  app.post("/api/herencia-ia/customer-status", async (req, res) => {
    const db = client();
    if (!db) return res.status(503).json({ error: "Base de datos no configurada" });
    try {
      const email = normalizeEmail(req.body?.email);
      if (!validEmail(email)) return res.status(400).json({ error: "Email no válido" });
      const accounts = await readStorage(db, ACCOUNTS_KEY, []);
      const registered = accounts.some((item) => normalizeEmail(item.email) === email);
      const { data, error } = await db.from("orders").select("total,status").eq("customer_email", email).in("status", PAID_STATUSES);
      if (error) throw error;
      const totalPaid = Number((data || []).reduce((sum, order) => sum + Number(order.total || 0), 0).toFixed(2));
      res.json({ registered, totalPaid, isVip: totalPaid >= 50 });
    } catch (error) { res.status(500).json({ error: error.message || "No se pudo comprobar el cliente" }); }
  });

  app.post("/api/customer/password/forgot", async (req, res) => {
    const db = client();
    if (!db) return res.status(503).json({ error: "Base de datos no configurada" });
    const generic = { ok: true, message: "Si existe una cuenta con ese correo, recibirás un enlace para recuperar la contraseña." };
    try {
      const email = normalizeEmail(req.body?.email);
      if (!validEmail(email)) return res.status(400).json({ error: "Escribe un correo válido" });
      const accounts = await readStorage(db, ACCOUNTS_KEY, []);
      const account = accounts.find((item) => normalizeEmail(item.email) === email);
      if (!account) return res.json(generic);
      const token = crypto.randomBytes(32).toString("hex");
      const now = Date.now();
      const rows = (await readStorage(db, RESET_KEY, [])).filter((item) => Number(item.expiresAt || 0) > now && item.usedAt == null && item.email !== email);
      rows.push({ id: crypto.randomUUID(), email, tokenHash: hashToken(token), createdAt: now, expiresAt: now + 30 * 60 * 1000, usedAt: null });
      await writeStorage(db, RESET_KEY, rows.slice(-500));
      await sendResetEmail(email, `${publicSiteUrl()}/recuperar-contrasena?token=${encodeURIComponent(token)}`);
      res.json(generic);
    } catch (error) {
      console.error("Password reset request:", error?.message || error);
      res.status(500).json({ error: "No se pudo enviar el correo de recuperación. Inténtalo de nuevo." });
    }
  });

  app.post("/api/customer/password/reset", async (req, res) => {
    const db = client();
    if (!db) return res.status(503).json({ error: "Base de datos no configurada" });
    try {
      const token = String(req.body?.token || "");
      const password = String(req.body?.password || "");
      if (!token || password.length < 8) return res.status(400).json({ error: "El enlace no es válido o la contraseña tiene menos de 8 caracteres" });
      const now = Date.now();
      const rows = await readStorage(db, RESET_KEY, []);
      const tokenHash = hashToken(token);
      const reset = rows.find((item) => item.tokenHash === tokenHash && item.usedAt == null && Number(item.expiresAt || 0) > now);
      if (!reset) return res.status(400).json({ error: "Este enlace ha caducado o ya fue utilizado" });
      const accounts = await readStorage(db, ACCOUNTS_KEY, []);
      const index = accounts.findIndex((item) => normalizeEmail(item.email) === normalizeEmail(reset.email));
      if (index < 0) return res.status(400).json({ error: "La cuenta ya no existe" });
      const { salt, hash } = hashPassword(password);
      accounts[index] = { ...accounts[index], passwordSalt: salt, passwordHash: hash, updatedAt: new Date().toISOString() };
      reset.usedAt = now;
      await writeStorage(db, ACCOUNTS_KEY, accounts);
      await writeStorage(db, RESET_KEY, rows);
      res.json({ ok: true });
    } catch (error) { res.status(500).json({ error: error.message || "No se pudo cambiar la contraseña" }); }
  });
}

express.application.listen = function patchedListen(...args) {
  if (!this.locals.__customerAccessRoutesInstalled) {
    this.locals.__customerAccessRoutesInstalled = true;
    installRoutes(this);
  }
  return originalListen.apply(this, args);
};
