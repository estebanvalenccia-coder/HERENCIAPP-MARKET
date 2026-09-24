import express from "express";
import cors from "cors";
import Stripe from "stripe";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import {
  calculatePosTotals,
  nextPosDocumentNumber,
  normalizePaymentMethod,
  paymentStatusForMethod,
  validateAndApplyStock,
} from "./posEngine.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === "production";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let createLocalSupabase = null;

try {
  const localModule = await import("./localSupabase.js");
  createLocalSupabase = localModule.default;
} catch (error) {
  console.warn(
    "localSupabase.js no disponible en este entorno. Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para producción.",
    error?.message || error
  );
}

let supabase = null;

if (supabaseUrl && supabaseServiceRoleKey) {
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
} else {
  if (createLocalSupabase) {
    supabase = createLocalSupabase({ path: new URL("./local_db.json", import.meta.url).pathname });
    console.warn("Supabase no configurado: usando almacenamiento local en backend/local_db.json para desarrollo");
  } else {
    console.warn("Supabase no configurado y localSupabase.js ausente. El backend responderá 503 en rutas que requieren base de datos.");
  }
}

const defaultAllowedOrigins = [
  "https://www.herenciamarket.es",
  "https://herenciamarket.es",
  "https://herenciapp-market.vercel.app",
];

const allowedOrigins = (
  process.env.CORS_ORIGIN || defaultAllowedOrigins.join(",")
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedVercelPreview(origin) {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === "herenciapp-market.vercel.app" ||
      (hostname.startsWith("herenciapp-market-") &&
        hostname.endsWith(".vercel.app")) ||
      hostname.endsWith("-daniels-projects-b54d9ed6.vercel.app")
    );
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin) {
  return (
    !origin ||
    allowedOrigins.includes(origin) ||
    isAllowedVercelPreview(origin)
  );
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true,
  })
);

app.options(
  "*",
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true,
  })
);

const adminUsername = process.env.ADMIN_USERNAME || "Daniel";
const adminPassword = process.env.ADMIN_PASSWORD || "13101098";
const sessionSecret =
  process.env.ADMIN_SESSION_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "change-me-in-production";
const usingDefaultAdminCredentials =
  !process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD;

if (usingDefaultAdminCredentials) {
  console.warn(
    "Admin auth usando credenciales por defecto. Configura ADMIN_USERNAME y ADMIN_PASSWORD para endurecer producción."
  );
}

const publicKeys = new Set([
  "chatboxSettings",
  "herenciaSettings",
  "customTheme",
  "menuIcons",
  "stripeSettings",
  "shippingSettings",
  "adminProducts",
  "heroBanner",
  "ctaBanner",
  "siteContent",
]);

const privateVisitorKeys = new Set(["cart", "user"]);

const protectedKeys = new Set([
  "chatboxSettings",
  "herenciaSettings",
  "customTheme",
  "menuIcons",
  "stripeSettings",
  "supabaseSettings",
  "shippingSettings",
  "aiSettings",
  "tpvLayoutSettings",
  "posCustomers",
  "posFiscalSettings",
  "posCashSession",
  "adminProducts",
  "adminFlowerCosts",
  "adminLatestFlowerQuote",
  "heroBanner",
  "ctaBanner",
  "siteContent",
  "__backendStorage_test__",
]);

const adminOnlyStorageKeys = [
  "supabaseSettings",
  "aiSettings",
  "heroBanner",
  "ctaBanner",
  "adminFlowerCosts",
  "adminLatestFlowerQuote",
  "tpvLayoutSettings",
  "posCustomers",
  "posFiscalSettings",
  "posCashSession",
];

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .filter(Boolean)
      .map((part) => {
        const [name, ...rest] = part.trim().split("=");
        return [decodeURIComponent(name), decodeURIComponent(rest.join("="))];
      })
  );
}

function sign(value) {
  return crypto.createHmac("sha256", sessionSecret).update(value).digest("hex");
}

function createAdminToken() {
  const payload = Buffer.from(
    JSON.stringify({ role: "admin", iat: Date.now() })
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

function isValidAdminToken(token) {
  if (!token || !token.includes(".")) return false;

  const [payload, signature] = token.split(".");

  if (signature !== sign(payload)) return false;

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );

    const maxAgeMs = 1000 * 60 * 60 * 12;

    return decoded.role === "admin" && Date.now() - decoded.iat < maxAgeMs;
  } catch {
    return false;
  }
}

function isAdmin(req) {
  return isValidAdminToken(parseCookies(req).admin_session);
}

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) {
    return res.status(401).json({ error: "Acceso de administrador requerido" });
  }

  next();
}

function cookieOptions(maxAgeSeconds) {
  return `HttpOnly; Path=/; Max-Age=${maxAgeSeconds}; SameSite=${
    isProduction ? "None" : "Lax"
  }${isProduction ? "; Secure" : ""}`;
}

function getVisitorId(req, res) {
  const cookies = parseCookies(req);
  let visitorId = cookies.visitor_id;

  if (!visitorId || !/^[a-f0-9-]{36}$/i.test(visitorId)) {
    visitorId = crypto.randomUUID();

    res.setHeader(
      "Set-Cookie",
      `visitor_id=${encodeURIComponent(visitorId)}; ${cookieOptions(
        60 * 60 * 24 * 365
      )}`
    );
  }

  return visitorId;
}

function storageKeyFor(req, res, key) {
  if (privateVisitorKeys.has(key)) {
    return `visitor:${getVisitorId(req, res)}:${key}`;
  }

  return key;
}

function requireSupabase(res) {
  if (!supabase) {
    res
      .status(503)
      .json({ error: "Supabase no está configurado en el backend" });
    return false;
  }

  return true;
}

function sanitizeValueForClient(key, value, admin = false) {
  if (!value) return value;

  if (key === "aiSettings") {
    try {
      const parsed = JSON.parse(value || "{}");

      return JSON.stringify({
        ...parsed,
        apiKey: admin ? (parsed.apiKey ? "••••••••" : "") : "",
      });
    } catch {
      return value;
    }
  }

  if (key === "supabaseSettings") {
    try {
      const parsed = JSON.parse(value || "{}");

      return JSON.stringify({
        ...parsed,
        serviceRoleKey: "",
      });
    } catch {
      return value;
    }
  }

  return value;
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeOrder(order) {
  const metadata = order.metadata || {};

  return {
    id: order.id,
    customerName: order.customer_name || order.customerName || order.name || "Cliente",
    customerEmail: order.customer_email || order.customerEmail || order.email || "",
    items: Array.isArray(order.items) ? order.items : [],
    subtotal: Number(order.subtotal || 0),
    shipping: Number(order.shipping || 0),
    total: Number(order.total || 0),
    paymentMethod: order.payment_method || order.paymentMethod || "manual",
    deliveryMethod: order.delivery_method || order.deliveryMethod || "envio",
    status: order.status || "pending",
    date: order.created_at || order.date || new Date().toISOString(),
    metadata,
  };
}

function renderOrderEmail(order, recipientType = "customer") {
  const normalized = normalizeOrder(order);
  const isAdminEmail = recipientType === "admin";
  const itemsHtml = normalized.items.length
    ? normalized.items
        .map((item) => {
          const name = escapeHtml(item.name || item.title || item.productName || "Producto");
          const quantity = Number(item.quantity || item.qty || 1);
          const price = Number(item.price || item.unitPrice || 0);
          const image = item.image || item.imageUrl || item.photo || "";

          return `
            <tr>
              <td style="padding:14px 0;border-bottom:1px solid #f1e7df;">
                <div style="display:flex;gap:12px;align-items:center;">
                  ${
                    image
                      ? `<img src="${escapeHtml(image)}" alt="${name}" width="56" height="56" style="border-radius:14px;object-fit:cover;border:1px solid #f1e7df;" />`
                      : `<div style="width:56px;height:56px;border-radius:14px;background:#fff1f5;border:1px solid #f1e7df;text-align:center;line-height:56px;font-size:24px;">🌿</div>`
                  }
                  <div>
                    <div style="font-weight:700;color:#2b1712;font-size:15px;">${name}</div>
                    <div style="color:#8b6b61;font-size:13px;margin-top:3px;">Cantidad: ${quantity}</div>
                  </div>
                </div>
              </td>
              <td align="right" style="padding:14px 0;border-bottom:1px solid #f1e7df;font-weight:700;color:#2b1712;white-space:nowrap;">
                ${formatCurrency(price * quantity)}
              </td>
            </tr>`;
        })
        .join("")
    : `<tr><td colspan="2" style="padding:16px 0;color:#8b6b61;">Pedido recibido sin detalle de productos.</td></tr>`;

  const deliveryLabel =
    normalized.deliveryMethod === "recogida" ? "Recogida en tienda" : "Envío a domicilio";

  const paymentLabel =
    normalized.paymentMethod === "bizum"
      ? "Bizum"
      : normalized.paymentMethod === "tarjeta"
      ? "Tarjeta"
      : normalized.paymentMethod === "manual"
      ? "Pago manual"
      : normalized.paymentMethod;

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Confirmación de compra Herencia Market</title>
  </head>
  <body style="margin:0;background:#fff7f2;font-family:Arial,Helvetica,sans-serif;color:#2b1712;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      ${isAdminEmail ? "Nuevo pedido recibido" : "Gracias por tu compra"} en Herencia Market.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff7f2;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 16px 50px rgba(96,46,24,.12);">
            <tr>
              <td style="background:linear-gradient(135deg,#ff6f91,#ff9671,#ffc75f);padding:34px 28px;text-align:center;color:#fff;">
                <div style="font-size:42px;line-height:1;margin-bottom:10px;">🌸</div>
                <h1 style="margin:0;font-size:28px;line-height:1.15;">${
                  isAdminEmail ? "Nuevo pedido en Herencia Market" : "¡Gracias por tu compra!"
                }</h1>
                <p style="margin:10px 0 0;font-size:15px;opacity:.95;">Pedido #${escapeHtml(
                  normalized.id
                )}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px;">
                <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#4d3128;">
                  ${
                    isAdminEmail
                      ? `Se ha recibido una compra de <strong>${escapeHtml(normalized.customerName)}</strong>. Aquí tienes el detalle completo.`
                      : `Hola <strong>${escapeHtml(normalized.customerName)}</strong>, hemos recibido tu compra correctamente. Te dejamos el resumen de tu pedido.`
                  }
                </p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fffaf7;border:1px solid #f1e7df;border-radius:20px;padding:18px;margin-bottom:22px;">
                  <tr>
                    <td style="padding:6px 0;color:#8b6b61;font-size:13px;">Cliente</td>
                    <td align="right" style="padding:6px 0;font-weight:700;">${escapeHtml(normalized.customerName)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#8b6b61;font-size:13px;">Email</td>
                    <td align="right" style="padding:6px 0;font-weight:700;">${escapeHtml(normalized.customerEmail || "No indicado")}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#8b6b61;font-size:13px;">Entrega</td>
                    <td align="right" style="padding:6px 0;font-weight:700;">${escapeHtml(deliveryLabel)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#8b6b61;font-size:13px;">Método de pago</td>
                    <td align="right" style="padding:6px 0;font-weight:700;">${escapeHtml(paymentLabel)}</td>
                  </tr>
                </table>

                <h2 style="font-size:18px;margin:0 0 8px;color:#2b1712;">Detalle de la compra</h2>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:22px;">
                  ${itemsHtml}
                </table>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#2b1712;color:#fff;border-radius:20px;padding:18px;">
                  <tr>
                    <td style="padding:5px 0;color:#f8d8cc;">Subtotal</td>
                    <td align="right" style="padding:5px 0;font-weight:700;">${formatCurrency(normalized.subtotal)}</td>
                  </tr>
                  <tr>
                    <td style="padding:5px 0;color:#f8d8cc;">Envío</td>
                    <td align="right" style="padding:5px 0;font-weight:700;">${formatCurrency(normalized.shipping)}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0 0;font-size:19px;font-weight:800;">Total</td>
                    <td align="right" style="padding:12px 0 0;font-size:22px;font-weight:900;color:#ffc75f;">${formatCurrency(normalized.total)}</td>
                  </tr>
                </table>

                <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#8b6b61;text-align:center;">
                  ${
                    isAdminEmail
                      ? "Revisa el panel de administración para gestionar este pedido."
                      : "Prepararemos tu pedido con mucho cariño. Si tienes cualquier duda, responde a este correo."
                  }
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function statusLabel(status) {
  const labels = {
    pending: "Pendiente",
    payment_pending: "Pago pendiente",
    pending_bizum_review: "Revisión de Bizum",
    pending_manual_review: "Revisión manual",
    pending_transfer_review: "Revisión de transferencia",
    pending_store_confirmation: "Confirmación en tienda",
    paid: "Pagado",
    confirmed: "Confirmado",
    preparing: "Preparando pedido",
    processing: "Pedido en camino",
    ready: "Listo para recoger",
    delivered: "Entregado",
    completed: "Completado",
    cancelled: "Cancelado",
  };

  return labels[status] || "Actualización de pedido";
}

function statusMessageForOrder(order) {
  const normalized = normalizeOrder(order);
  const isPickup = ["recogida", "recoger", "mostrador"].includes(
    String(normalized.deliveryMethod || "").toLowerCase()
  );

  if (normalized.status === "ready") {
    return isPickup
      ? "Tu pedido ya está listo para recoger en tienda. Puedes pasar a buscarlo cuando quieras dentro de nuestro horario."
      : "Tu pedido ya está listo y preparado para su salida.";
  }

  if (normalized.status === "processing") {
    return "Tu pedido ha salido y está en camino.";
  }

  if (normalized.status === "delivered") {
    return "Tu pedido ha sido entregado correctamente.";
  }

  if (normalized.status === "confirmed") {
    return "Hemos confirmado tu pedido y ya está en gestión.";
  }

  if (normalized.status === "preparing") {
    return "Estamos preparando tu pedido con mucho cuidado.";
  }

  return `Tu pedido ahora está en estado: ${statusLabel(normalized.status)}.`;
}

function renderOrderStatusEmail(order) {
  const normalized = normalizeOrder(order);
  const itemsHtml = normalized.items.length
    ? normalized.items
        .map((item) => {
          const name = escapeHtml(item.name || item.title || item.productName || "Producto");
          const quantity = Number(item.quantity || item.qty || 1);
          return `<li style="margin-bottom:6px;">${name} x${quantity}</li>`;
        })
        .join("")
    : "<li>Sin detalle de productos.</li>";

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Actualización de pedido Herencia Market</title>
  </head>
  <body style="margin:0;background:#fff7f2;font-family:Arial,Helvetica,sans-serif;color:#2b1712;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff7f2;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 16px 50px rgba(96,46,24,.12);">
            <tr>
              <td style="background:linear-gradient(135deg,#2d5f3f,#7fa88f);padding:34px 28px;text-align:center;color:#fff;">
                <div style="font-size:42px;line-height:1;margin-bottom:10px;">🌿</div>
                <h1 style="margin:0;font-size:28px;line-height:1.15;">${escapeHtml(statusLabel(normalized.status))}</h1>
                <p style="margin:10px 0 0;font-size:15px;opacity:.95;">Pedido #${escapeHtml(normalized.id)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px;">
                <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#4d3128;">
                  Hola <strong>${escapeHtml(normalized.customerName)}</strong>, ${escapeHtml(statusMessageForOrder(normalized))}
                </p>

                <div style="background:#fffaf7;border:1px solid #f1e7df;border-radius:20px;padding:18px;margin-bottom:22px;">
                  <p style="margin:0 0 10px;font-size:13px;color:#8b6b61;">Resumen del pedido</p>
                  <ul style="margin:0;padding-left:18px;color:#2b1712;">${itemsHtml}</ul>
                </div>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#2b1712;color:#fff;border-radius:20px;padding:18px;">
                  <tr>
                    <td style="padding:5px 0;color:#f8d8cc;">Estado actual</td>
                    <td align="right" style="padding:5px 0;font-weight:700;">${escapeHtml(statusLabel(normalized.status))}</td>
                  </tr>
                  <tr>
                    <td style="padding:5px 0;color:#f8d8cc;">Total</td>
                    <td align="right" style="padding:5px 0;font-weight:700;">${formatCurrency(normalized.total)}</td>
                  </tr>
                </table>

                <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#8b6b61;text-align:center;">
                  Si tienes dudas, responde a este correo y te ayudaremos.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendResendEmail({ to, subject, html, replyTo }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("Email no enviado: falta RESEND_API_KEY");
    return { skipped: true, reason: "missing_RESEND_API_KEY" };
  }

  if (!isValidEmail(to)) {
    console.warn(`Email no enviado: destinatario inválido (${to})`);
    return { skipped: true, reason: "invalid_recipient" };
  }

  const from = process.env.EMAIL_FROM || "Herencia Market <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      reply_to: replyTo && isValidEmail(replyTo) ? replyTo : undefined,
    }),
  });

  const resultText = await response.text();

  if (!response.ok) {
    throw new Error(`Resend error ${response.status}: ${resultText}`);
  }

  try {
    return JSON.parse(resultText);
  } catch {
    return { ok: true };
  }
}

async function sendOrderConfirmationEmails(order, reason = "order_created") {
  const normalized = normalizeOrder(order);
  const adminEmail =
    process.env.ADMIN_ORDER_EMAIL ||
    process.env.ADMIN_EMAIL ||
    process.env.STORE_EMAIL ||
    "herenciafloristeria@gmail.com";
  const metadata = normalized.metadata || {};

  if (metadata.confirmationEmailSentAt) {
    return { skipped: true, reason: "already_sent" };
  }

  const results = {};

  if (isValidEmail(normalized.customerEmail)) {
    results.customer = await sendResendEmail({
      to: normalized.customerEmail,
      subject: `Confirmación de compra Herencia Market #${normalized.id}`,
      html: renderOrderEmail(normalized, "customer"),
      replyTo: adminEmail,
    });
  } else {
    results.customer = { skipped: true, reason: "missing_customer_email" };
  }

  if (isValidEmail(adminEmail)) {
    results.admin = await sendResendEmail({
      to: adminEmail,
      subject: `Nuevo pedido Herencia Market #${normalized.id}`,
      html: renderOrderEmail(normalized, "admin"),
      replyTo: normalized.customerEmail,
    });
  } else {
    results.admin = { skipped: true, reason: "missing_ADMIN_ORDER_EMAIL" };
  }

  if (supabase) {
    await supabase
      .from("orders")
      .update({
        metadata: {
          ...metadata,
          confirmationEmailSentAt: new Date().toISOString(),
          confirmationEmailReason: reason,
          confirmationEmailResults: results,
        },
      })
      .eq("id", normalized.id);
  }

  return results;
}

async function sendOrderStatusUpdateEmail(order, reason = "order_status_updated") {
  const normalized = normalizeOrder(order);
  const adminEmail =
    process.env.ADMIN_ORDER_EMAIL ||
    process.env.ADMIN_EMAIL ||
    process.env.STORE_EMAIL ||
    "herenciafloristeria@gmail.com";

  if (!isValidEmail(normalized.customerEmail)) {
    return { skipped: true, reason: "missing_customer_email" };
  }

  const metadata = normalized.metadata || {};
  const alreadySentForStatus = metadata?.statusEmailHistory?.[normalized.status];
  if (alreadySentForStatus) {
    return { skipped: true, reason: "status_email_already_sent" };
  }

  const result = await sendResendEmail({
    to: normalized.customerEmail,
    subject: `Actualización de tu pedido Herencia Market #${normalized.id}`,
    html: renderOrderStatusEmail(normalized),
    replyTo: adminEmail,
  });

  if (supabase) {
    await supabase
      .from("orders")
      .update({
        metadata: {
          ...metadata,
          lastStatusEmailSentAt: new Date().toISOString(),
          lastStatusEmailReason: reason,
          statusEmailHistory: {
            ...(metadata.statusEmailHistory || {}),
            [normalized.status]: new Date().toISOString(),
          },
        },
      })
      .eq("id", normalized.id);
  }

  return result;
}

async function readStorageValue(key) {
  const { data, error } = await supabase
    .from("app_storage")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) throw error;

  return data?.value || null;
}

async function upsertStorageValue(key, value) {
  const { error } = await supabase.from("app_storage").upsert({
    key,
    value,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(503).send("Stripe webhook no configurado");
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      return res.status(400).send(`Webhook inválido: ${error.message}`);
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const orderId = paymentIntent.metadata?.orderId;

      if (orderId && supabase) {
        const { data: updatedOrder, error } = await supabase
          .from("orders")
          .update({
            status: "paid",
            stripe_payment_intent_id: paymentIntent.id,
          })
          .eq("id", orderId)
          .select("*")
          .single();

        if (error) {
          console.error("Error actualizando pedido pagado:", error.message);
        } else {
          broadcastAdminOrderEvent(updatedOrder, "order_paid");
          void emitNeuralBusinessEvent("order.paid", normalizeOrder(updatedOrder));

          try {
            await sendOrderConfirmationEmails(updatedOrder, "stripe_payment_succeeded");
          } catch (emailError) {
            console.error("Error enviando emails de confirmación:", emailError.message);
          }
        }
      }
    }

    res.json({ received: true });
  }
);

app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "Herencia backend" });
});

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};

  if (username !== adminUsername || password !== adminPassword) {
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  }

  res.setHeader(
    "Set-Cookie",
    `admin_session=${encodeURIComponent(createAdminToken())}; ${cookieOptions(
      60 * 60 * 12
    )}`
  );

  res.json({ ok: true });
});

app.post("/api/admin/logout", (_req, res) => {
  res.setHeader("Set-Cookie", `admin_session=; ${cookieOptions(0)}`);
  res.json({ ok: true });
});

app.get("/api/admin/session", (req, res) => {
  res.json({ authenticated: isAdmin(req) });
});

const adminOrderEventClients = new Set();
const recentAdminOrderEventKeys = new Map();

function serializeAdminOrderEvent(order, kind = "order_created") {
  const normalized = normalizeOrder(order);
  const metadata = normalized.metadata || {};
  const shippingAddress = metadata.shippingAddress || {};

  return {
    eventId: crypto.randomUUID(),
    kind,
    id: normalized.id,
    customerName: normalized.customerName,
    customerEmail: normalized.customerEmail,
    customerPhone: metadata.phone || metadata.customerPhone || "",
    address: shippingAddress,
    items: normalized.items,
    subtotal: normalized.subtotal,
    shipping: normalized.shipping,
    total: normalized.total,
    paymentMethod: normalized.paymentMethod,
    deliveryMethod: normalized.deliveryMethod,
    status: normalized.status,
    date: normalized.date,
  };
}

function broadcastAdminOrderEvent(order, kind = "order_created") {
  const payload = serializeAdminOrderEvent(order, kind);
  const now = Date.now();
  const dedupeKey = `${payload.id}:${kind}:${payload.status}`;

  for (const [key, timestamp] of recentAdminOrderEventKeys.entries()) {
    if (now - timestamp > 10 * 60 * 1000) {
      recentAdminOrderEventKeys.delete(key);
    }
  }

  if (recentAdminOrderEventKeys.has(dedupeKey)) return false;
  recentAdminOrderEventKeys.set(dedupeKey, now);

  const message = `event: order\ndata: ${JSON.stringify(payload)}\n\n`;

  for (const client of [...adminOrderEventClients]) {
    try {
      client.res.write(message);
    } catch {
      clearInterval(client.heartbeat);
      adminOrderEventClients.delete(client);
    }
  }

  return true;
}


async function emitNeuralBusinessEvent(type, payload = {}) {
  const baseUrl = String(process.env.NEURAL_SERVICE_URL || "").replace(/\/$/, "");
  const adminToken = process.env.NEURAL_ADMIN_TOKEN;
  if (!baseUrl || !adminToken) return { skipped: true, reason: "neural_not_configured" };
  try {
    const response = await fetch(`${baseUrl}/v1/neural/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Neural-Admin-Token": adminToken,
      },
      body: JSON.stringify({ type, payload, meta: { source: "herencia_backend" } }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Neural event HTTP ${response.status}`);
    return { ok: true };
  } catch (error) {
    console.warn("No se pudo emitir evento a Neural:", type, error?.message || error);
    return { ok: false, error: error?.message || String(error) };
  }
}

app.get("/api/admin/order-events", requireAdmin, (req, res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  res.write("retry: 3000\n");
  res.write(`event: ready\ndata: ${JSON.stringify({ ok: true, connectedAt: new Date().toISOString() })}\n\n`);

  const client = {
    res,
    heartbeat: setInterval(() => {
      try {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      } catch {
        // El cierre de la conexión se limpia abajo.
      }
    }, 20000),
  };

  adminOrderEventClients.add(client);

  req.on("close", () => {
    clearInterval(client.heartbeat);
    adminOrderEventClients.delete(client);
  });
});

app.get("/api/storage", async (req, res) => {
  if (!requireSupabase(res)) return;

  const keys = [...publicKeys];
  const visitorId = getVisitorId(req, res);

  const scopedVisitorKeys = [...privateVisitorKeys].map(
    (key) => `visitor:${visitorId}:${key}`
  );

  if (isAdmin(req)) keys.push(...adminOnlyStorageKeys);

  const { data, error } = await supabase
    .from("app_storage")
    .select("key,value")
    .in("key", [...keys, ...scopedVisitorKeys]);

  if (error) return res.status(500).json({ error: error.message });

  const response = {};

  for (const row of data || []) {
    let key = row.key;

    if (key.startsWith(`visitor:${visitorId}:`)) {
      key = key.split(":").pop();
    }

    response[key] = sanitizeValueForClient(key, row.value, isAdmin(req));
  }

  res.json({ data: response });
});

app.get("/api/storage/:key", async (req, res) => {
  if (!requireSupabase(res)) return;

  const key = req.params.key;

  if (protectedKeys.has(key) && !publicKeys.has(key) && !isAdmin(req)) {
    return res.status(401).json({ error: "Acceso de administrador requerido" });
  }

  try {
    const value = await readStorageValue(storageKeyFor(req, res, key));

    res.json({
      value: sanitizeValueForClient(key, value, isAdmin(req)),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/storage/:key", async (req, res) => {
  if (!requireSupabase(res)) return;

  const key = req.params.key;

  if (protectedKeys.has(key) && !isAdmin(req)) {
    return res.status(401).json({ error: "Acceso de administrador requerido" });
  }

  if (!protectedKeys.has(key) && !privateVisitorKeys.has(key)) {
    return res.status(403).json({ error: "Clave no permitida" });
  }

  try {
    let { value } = req.body;

    if (key === "aiSettings") {
      const current = await readStorageValue(key);
      const currentJson = current ? JSON.parse(current) : {};
      const incomingJson = value ? JSON.parse(value) : {};

      if (!incomingJson.apiKey || incomingJson.apiKey === "••••••••") {
        incomingJson.apiKey = currentJson.apiKey || "";
      }

      value = JSON.stringify(incomingJson);
    }

    await upsertStorageValue(storageKeyFor(req, res, key), value);

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/storage/:key", async (req, res) => {
  if (!requireSupabase(res)) return;

  const key = req.params.key;

  if (protectedKeys.has(key) && !isAdmin(req)) {
    return res.status(401).json({ error: "Acceso de administrador requerido" });
  }

  if (!protectedKeys.has(key) && !privateVisitorKeys.has(key)) {
    return res.status(403).json({ error: "Clave no permitida" });
  }

  const { error } = await supabase
    .from("app_storage")
    .delete()
    .eq("key", storageKeyFor(req, res, key));

  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true });
});

app.get("/api/settings/public", async (_req, res) => {
  if (!requireSupabase(res)) return;

  const keys = [
    "chatboxSettings",
    "herenciaSettings",
    "customTheme",
    "menuIcons",
    "stripeSettings",
    "shippingSettings",
    "heroBanner",
    "ctaBanner",
    "siteContent",
  ];

  const { data, error } = await supabase
    .from("app_storage")
    .select("key,value")
    .in("key", keys);

  if (error) return res.status(500).json({ error: error.message });

  const settings = Object.fromEntries(
    (data || []).map((row) => {
      try {
        return [
          row.key,
          JSON.parse(sanitizeValueForClient(row.key, row.value)),
        ];
      } catch {
        return [row.key, row.value];
      }
    })
  );

  res.json({ settings });
});

app.get("/api/orders", requireAdmin, async (_req, res) => {
  if (!requireSupabase(res)) return;

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const orders = (data || []).map((order) => ({
    id: order.id,
    customerName: order.customer_name || "Cliente",
    customerEmail: order.customer_email || "",
    items: order.items || [],
    subtotal: Number(order.subtotal || 0),
    shipping: Number(order.shipping || 0),
    total: Number(order.total || 0),
    paymentMethod: order.payment_method,
    deliveryMethod: order.delivery_method,
    status: order.status,
    date: order.created_at,
    metadata: order.metadata || {},
  }));

  res.json({ orders });
});

app.post("/api/orders", async (req, res) => {
  if (!requireSupabase(res)) return;

  const order = req.body;
  const id = order.id || crypto.randomUUID();

  const { data, error } = await supabase
    .from("orders")
    .insert({
      id,
      customer_email: order.customerEmail || order.email || null,
      customer_name: order.customerName || order.name || null,
      payment_method: order.paymentMethod || "manual",
      delivery_method: order.deliveryMethod || "envio",
      status: order.status || "pending",
      subtotal: order.subtotal || 0,
      shipping: order.shipping || 0,
      total: order.total || 0,
      items: order.items || [],
      metadata: order.metadata || {},
    })
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  broadcastAdminOrderEvent(data, "order_created");
  void emitNeuralBusinessEvent("order.created", normalizeOrder(data));

  try {
    await sendOrderConfirmationEmails(data, "order_created");
  } catch (emailError) {
    console.error("Error enviando emails de confirmación:", emailError.message);
  }

  res.json({ order: data });
});

app.patch("/api/orders/:id/status", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;

  const { status } = req.body;

  const { data: previousOrder, error: previousOrderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();

  if (previousOrderError) {
    return res.status(500).json({ error: previousOrderError.message });
  }

  if (!previousOrder) {
    return res.status(404).json({ error: "Pedido no encontrado" });
  }

  let nextMetadata = previousOrder.metadata || {};
  const isTpvOrder = String(nextMetadata.source || "").startsWith("TPV_ADMIN");

  if (
    status === "cancelled" &&
    previousOrder.status !== "cancelled" &&
    isTpvOrder &&
    nextMetadata.inventoryCommittedAt &&
    !nextMetadata.inventoryRestockedAt
  ) {
    try {
      const currentProducts = parseStoredJson(await readStorageValue("adminProducts"), []);
      const quantities = new Map();

      for (const item of previousOrder.items || []) {
        const id = String(item?.id ?? "");
        const qty = Math.max(0, Math.floor(Number(item?.quantity ?? item?.qty ?? 0)));
        if (id && qty > 0) quantities.set(id, (quantities.get(id) || 0) + qty);
      }

      const restockedProducts = currentProducts.map((product) => {
        const id = String(product?.id ?? "");
        const qty = quantities.get(id) || 0;
        if (!qty) return product;
        return {
          ...product,
          stock: Math.max(0, Math.floor(Number(product.stock || 0))) + qty,
        };
      });

      await upsertStorageValue("adminProducts", JSON.stringify(restockedProducts));
      nextMetadata = {
        ...nextMetadata,
        inventoryRestockedAt: new Date().toISOString(),
        inventoryRestockReason: "order_cancelled",
      };
    } catch (stockError) {
      return res.status(500).json({
        error: `No se pudo devolver el stock al cancelar: ${stockError.message}`,
      });
    }
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ status, metadata: nextMetadata })
    .eq("id", req.params.id)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const shouldNotifyCustomer = ["confirmed", "preparing", "processing", "ready", "delivered"].includes(status);
  let statusEmailResult = null;

  if (status === "paid" && isTpvOrder && previousOrder.status !== "paid") {
    try {
      statusEmailResult = await sendOrderConfirmationEmails(data, "pos_payment_verified");
    } catch (emailError) {
      console.error("Error enviando confirmación de pago TPV:", emailError.message);
      statusEmailResult = { error: emailError.message };
    }
  } else if (shouldNotifyCustomer) {
    try {
      statusEmailResult = await sendOrderStatusUpdateEmail(data, "admin_status_change");
    } catch (emailError) {
      console.error("Error enviando email de estado:", emailError.message);
      statusEmailResult = { error: emailError.message };
    }
  }

  void emitNeuralBusinessEvent("order.status_changed", { ...normalizeOrder(data), previousStatus: previousOrder.status, nextStatus: status });
  res.json({ order: data, statusEmailResult });
});


function parseStoredJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function normalizePosCustomer(customer = {}) {
  return {
    id: String(customer.id || crypto.randomUUID()),
    name: String(customer.name || "").trim(),
    nif: String(customer.nif || "").trim(),
    email: String(customer.email || "").trim(),
    address: String(customer.address || "").trim(),
    phone: String(customer.phone || "").trim(),
  };
}

async function loadPosBootstrap() {
  const [productsRaw, customersRaw, fiscalRaw, stripeRaw, cashSessionRaw] = await Promise.all([
    readStorageValue("adminProducts"),
    readStorageValue("posCustomers"),
    readStorageValue("posFiscalSettings"),
    readStorageValue("stripeSettings"),
    readStorageValue("posCashSession"),
  ]);

  const stripeSettings = parseStoredJson(stripeRaw, {});
  const publishableKey =
    String(
      stripeSettings?.publishableKey ||
      process.env.STRIPE_PUBLISHABLE_KEY ||
      process.env.VITE_STRIPE_PUBLISHABLE_KEY ||
      ""
    ).trim();

  return {
    products: parseStoredJson(productsRaw, []),
    customers: parseStoredJson(customersRaw, []),
    fiscalSettings: parseStoredJson(fiscalRaw, {}),
    stripeSettings: {
      enabled: stripeSettings?.enabled !== false && Boolean(publishableKey),
      publishableKey,
      secretConfigured: Boolean(stripe),
    },
    cashSession: parseStoredJson(cashSessionRaw, null),
  };
}

async function reservePosDocumentNumber(documentType) {
  const year = new Date().getFullYear();
  const normalizedType = documentType === "invoice" ? "invoice" : "ticket";
  const counterKey = `posDocumentCounter:${year}:${normalizedType}`;
  const rawCounter = await readStorageValue(counterKey);
  const currentCounter = Math.max(0, Number(rawCounter || 0) || 0);
  const nextCounter = currentCounter + 1;
  await upsertStorageValue(counterKey, String(nextCounter));
  return nextPosDocumentNumber(normalizedType, year, nextCounter);
}

function validatePosInvoiceData(documentType, customer, fiscalSettings) {
  if (documentType !== "invoice") return;

  const missingIssuer = [
    fiscalSettings?.businessName,
    fiscalSettings?.nif,
    fiscalSettings?.address,
  ].some((value) => !String(value || "").trim());

  if (missingIssuer) {
    throw new Error("Configura nombre fiscal, NIF/CIF y dirección del emisor antes de emitir facturas");
  }

  const missingCustomer = [customer?.name, customer?.nif, customer?.address].some(
    (value) => !String(value || "").trim()
  );

  if (missingCustomer) {
    throw new Error("Para factura completa indica nombre, NIF/CIF y dirección del cliente");
  }
}

function posOrderResponse(order) {
  return {
    id: order.id,
    customerName: order.customer_name || "Cliente",
    customerEmail: order.customer_email || "",
    items: order.items || [],
    subtotal: Number(order.subtotal || 0),
    shipping: Number(order.shipping || 0),
    total: Number(order.total || 0),
    paymentMethod: order.payment_method,
    deliveryMethod: order.delivery_method,
    status: order.status,
    date: order.created_at,
    metadata: order.metadata || {},
  };
}

function normalizeMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

async function readPosCashSession() {
  return parseStoredJson(await readStorageValue("posCashSession"), null);
}

async function writePosCashSession(session) {
  await upsertStorageValue("posCashSession", JSON.stringify(session));
  return session;
}

async function registerCashSaleInSession(amount, orderId) {
  const session = await readPosCashSession();
  if (!session || session.status !== "open") {
    throw new Error("La caja está cerrada. Ábrela antes de cobrar en efectivo.");
  }

  const saleAmount = normalizeMoney(amount);
  const next = {
    ...session,
    cashSales: normalizeMoney(Number(session.cashSales || 0) + saleAmount),
    expectedCash: normalizeMoney(Number(session.expectedCash || 0) + saleAmount),
    movements: [
      ...(Array.isArray(session.movements) ? session.movements : []),
      {
        id: crypto.randomUUID(),
        type: "sale",
        amount: saleAmount,
        orderId,
        note: "Venta en efectivo",
        at: new Date().toISOString(),
      },
    ],
    updatedAt: new Date().toISOString(),
  };

  await writePosCashSession(next);
  return next;
}

app.get("/api/pos/bootstrap", requireAdmin, async (_req, res) => {
  if (!requireSupabase(res)) return;

  try {
    const data = await loadPosBootstrap();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/pos/cash-session", requireAdmin, async (_req, res) => {
  if (!requireSupabase(res)) return;
  try {
    res.json({ session: await readPosCashSession() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/cash-session/open", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const current = await readPosCashSession();
    if (current?.status === "open") {
      return res.status(409).json({ error: "Ya hay una caja abierta" });
    }

    const openingAmount = normalizeMoney(req.body?.openingAmount);
    if (openingAmount < 0) {
      return res.status(400).json({ error: "El fondo inicial no puede ser negativo" });
    }

    const now = new Date().toISOString();
    const session = {
      id: crypto.randomUUID(),
      status: "open",
      openedAt: now,
      closedAt: null,
      openingAmount,
      cashSales: 0,
      cashIn: 0,
      cashOut: 0,
      expectedCash: openingAmount,
      movements: [
        {
          id: crypto.randomUUID(),
          type: "open",
          amount: openingAmount,
          note: "Apertura de caja",
          at: now,
        },
      ],
      updatedAt: now,
    };

    await writePosCashSession(session);
    res.json({ session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/cash-session/movement", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const session = await readPosCashSession();
    if (!session || session.status !== "open") {
      return res.status(409).json({ error: "La caja está cerrada" });
    }

    const type = req.body?.type === "out" ? "out" : "in";
    const amount = normalizeMoney(req.body?.amount);
    const note = String(req.body?.note || "").trim();

    if (amount <= 0) {
      return res.status(400).json({ error: "El importe debe ser mayor que 0" });
    }

    const next = {
      ...session,
      cashIn: normalizeMoney(Number(session.cashIn || 0) + (type === "in" ? amount : 0)),
      cashOut: normalizeMoney(Number(session.cashOut || 0) + (type === "out" ? amount : 0)),
      expectedCash: normalizeMoney(
        Number(session.expectedCash || 0) + (type === "in" ? amount : -amount)
      ),
      movements: [
        ...(Array.isArray(session.movements) ? session.movements : []),
        {
          id: crypto.randomUUID(),
          type,
          amount,
          note: note || (type === "in" ? "Entrada de efectivo" : "Salida de efectivo"),
          at: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    if (next.expectedCash < 0) {
      return res.status(400).json({ error: "La salida supera el efectivo esperado en caja" });
    }

    await writePosCashSession(next);
    res.json({ session: next });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/cash-session/close", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const session = await readPosCashSession();
    if (!session || session.status !== "open") {
      return res.status(409).json({ error: "No hay una caja abierta" });
    }

    const countedCash = normalizeMoney(req.body?.countedCash);
    if (countedCash < 0) {
      return res.status(400).json({ error: "El efectivo contado no puede ser negativo" });
    }

    const now = new Date().toISOString();
    const difference = normalizeMoney(countedCash - Number(session.expectedCash || 0));
    const closed = {
      ...session,
      status: "closed",
      closedAt: now,
      countedCash,
      difference,
      movements: [
        ...(Array.isArray(session.movements) ? session.movements : []),
        {
          id: crypto.randomUUID(),
          type: "close",
          amount: countedCash,
          note: "Cierre de caja",
          at: now,
        },
      ],
      updatedAt: now,
    };

    await writePosCashSession(closed);
    res.json({ session: closed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/pos/self-test", requireAdmin, async (_req, res) => {
  if (!requireSupabase(res)) return;

  const tests = [];
  let storageOk = false;
  let stripeOk = false;

  try {
    const fakeProducts = [
      { id: "test-ramo", name: "Ramo prueba", price: 20, iva: 21, stock: 5, active: true },
      { id: "test-rosa", name: "Rosa prueba", price: 3, iva: 10, stock: 10, active: true },
    ];

    const prepared = validateAndApplyStock(fakeProducts, [
      { id: "test-ramo", quantity: 2 },
      { id: "test-rosa", quantity: 3 },
    ]);
    const cashTotals = calculatePosTotals(prepared.items, 60);

    tests.push({
      name: "motor_stock",
      ok: prepared.updatedProducts[0].stock === 3 && prepared.updatedProducts[1].stock === 7,
      detail: "Venta ficticia descuenta 2 ramos y 3 rosas sin tocar inventario real",
    });
    tests.push({
      name: "calculo_venta",
      ok: cashTotals.total === 49 && cashTotals.change === 11,
      detail: `Total ficticio ${cashTotals.total.toFixed(2)} €, cambio ${cashTotals.change.toFixed(2)} €`,
    });
    tests.push({
      name: "metodos_pago",
      ok:
        paymentStatusForMethod("Efectivo") === "paid" &&
        paymentStatusForMethod("Tarjeta") === "payment_pending" &&
        paymentStatusForMethod("Bizum") === "pending_bizum_review" &&
        paymentStatusForMethod("Transferencia") === "pending_transfer_review",
      detail: "Efectivo, tarjeta, Bizum y transferencia mapean a estados operativos correctos",
    });
    tests.push({
      name: "numeracion",
      ok: nextPosDocumentNumber("invoice", 2026, 1) === "FAC-2026-000001",
      detail: "Numeración de tickets y facturas disponible",
    });

    const testKey = `__pos_self_test__:${crypto.randomUUID()}`;
    await upsertStorageValue(testKey, JSON.stringify({ ok: true, at: new Date().toISOString() }));
    const stored = await readStorageValue(testKey);
    const { error: deleteError } = await supabase.from("app_storage").delete().eq("key", testKey);
    if (deleteError) throw deleteError;
    storageOk = Boolean(parseStoredJson(stored, {})?.ok);
    tests.push({
      name: "supabase_rw",
      ok: storageOk,
      detail: "Lectura, escritura y limpieza temporal en Supabase",
    });

    if (stripe) {
      try {
        await stripe.balance.retrieve();
        stripeOk = true;
      } catch (stripeError) {
        tests.push({
          name: "stripe",
          ok: false,
          detail: stripeError.message || "Stripe no respondió",
        });
      }
    }

    if (!tests.some((test) => test.name === "stripe")) {
      tests.push({
        name: "stripe",
        ok: stripeOk,
        detail: stripeOk
          ? "Credencial Stripe válida; no se realizó ningún cargo"
          : "Stripe no está configurado; tarjeta real no estará disponible",
      });
    }

    const bootstrap = await loadPosBootstrap();
    const stockConfigured = (bootstrap.products || []).some(
      (product) => Number(product?.stock || 0) > 0
    );
    const fiscalReady = Boolean(
      bootstrap.fiscalSettings?.businessName &&
      bootstrap.fiscalSettings?.nif &&
      bootstrap.fiscalSettings?.address
    );
    const publicStripeReady = Boolean(
      bootstrap.stripeSettings?.enabled &&
      String(bootstrap.stripeSettings?.publishableKey || "").startsWith("pk_")
    );
    const cardReady = Boolean(stripeOk && publicStripeReady);

    tests.push({
      name: "stripe_publica",
      ok: publicStripeReady,
      detail: publicStripeReady
        ? "Clave pública de Stripe habilitada y con formato válido"
        : "Falta habilitar Stripe o configurar una clave pública pk_ válida",
    });

    tests.push({
      name: "stock_configurado",
      ok: stockConfigured,
      detail: stockConfigured
        ? "Hay productos con stock real configurado"
        : "Todos los productos tienen stock 0 o sin configurar",
    });
    tests.push({
      name: "datos_fiscales",
      ok: fiscalReady,
      detail: fiscalReady
        ? "Datos fiscales mínimos configurados para factura"
        : "Faltan nombre fiscal, NIF/CIF o dirección del emisor",
    });

    res.json({
      ok: tests.filter((test) => !["stripe", "stock_configurado", "datos_fiscales"].includes(test.name)).every((test) => test.ok),
      cardReady,
      stockReady: stockConfigured,
      fiscalReady,
      tests,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || "Falló la autoprueba TPV",
      tests,
      cardReady: stripeOk,
      storageReady: storageOk,
    });
  }
});

app.post("/api/pos/customers", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;

  try {
    const customer = normalizePosCustomer(req.body || {});
    if (!customer.name) {
      return res.status(400).json({ error: "El cliente necesita un nombre" });
    }
    if (customer.email && !isValidEmail(customer.email)) {
      return res.status(400).json({ error: "Email de cliente inválido" });
    }

    const current = parseStoredJson(await readStorageValue("posCustomers"), []);
    const next = Array.isArray(current)
      ? [...current.filter((item) => String(item?.id) !== customer.id), customer]
      : [customer];

    await upsertStorageValue("posCustomers", JSON.stringify(next));
    res.json({ customer, customers: next });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/pos/fiscal-settings", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;

  try {
    const settings = {
      businessName: String(req.body?.businessName || "").trim(),
      nif: String(req.body?.nif || "").trim(),
      address: String(req.body?.address || "").trim(),
      email: String(req.body?.email || "").trim(),
      phone: String(req.body?.phone || "").trim(),
    };

    if (settings.email && !isValidEmail(settings.email)) {
      return res.status(400).json({ error: "Email fiscal inválido" });
    }

    await upsertStorageValue("posFiscalSettings", JSON.stringify(settings));
    res.json({ settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/card-intent", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  if (!stripe) {
    return res.status(503).json({ error: "Stripe no está configurado en el backend" });
  }

  try {
    const { products, fiscalSettings } = await loadPosBootstrap();
    const customer = normalizePosCustomer(req.body?.customer || {});
    const documentType = req.body?.documentType === "invoice" ? "invoice" : "ticket";
    validatePosInvoiceData(documentType, customer, fiscalSettings);

    const prepared = validateAndApplyStock(products, req.body?.items || []);
    const totals = calculatePosTotals(prepared.items);
    const totalCents = Math.round(totals.total * 100);

    if (!Number.isFinite(totalCents) || totalCents < 50) {
      return res.status(400).json({ error: "Importe inválido para tarjeta" });
    }

    const orderId = crypto.randomUUID();
    const metadata = {
      source: "TPV_ADMIN_CARD",
      documentType,
      notes: String(req.body?.notes || ""),
      customerNif: customer.nif,
      customerAddress: customer.address,
      customerPhone: customer.phone,
      fiscalSnapshot: fiscalSettings,
      inventoryCommittedAt: null,
    };

    const { error: orderError } = await supabase.from("orders").insert({
      id: orderId,
      customer_email: customer.email || null,
      customer_name: customer.name || "Cliente mostrador",
      payment_method: "card",
      delivery_method: "mostrador",
      status: "payment_pending",
      subtotal: totals.subtotal,
      shipping: 0,
      total: totals.total,
      items: prepared.items,
      metadata,
    });

    if (orderError) throw orderError;

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalCents,
        currency: "eur",
        receipt_email: customer.email || undefined,
        metadata: {
          orderId,
          source: "TPV_ADMIN_CARD",
        },
        payment_method_types: ["card"],
      });

      await supabase
        .from("orders")
        .update({ stripe_payment_intent_id: paymentIntent.id })
        .eq("id", orderId);

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        orderId,
        totals,
      });
    } catch (error) {
      await supabase
        .from("orders")
        .update({
          status: "payment_error",
          metadata: { ...metadata, stripeError: error.message },
        })
        .eq("id", orderId);
      throw error;
    }
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "No se pudo iniciar el pago con tarjeta" });
  }
});

app.post("/api/pos/complete-sale", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;

  let originalProducts = null;
  let stockWasWritten = false;
  let createdOrderId = null;
  let originalCashSession = null;
  let cashSessionWasWritten = false;

  try {
    const bootstrap = await loadPosBootstrap();
    originalProducts = bootstrap.products;
    const fiscalSettings = bootstrap.fiscalSettings || {};
    const customer = normalizePosCustomer(req.body?.customer || {});
    const documentType = req.body?.documentType === "invoice" ? "invoice" : "ticket";
    const paymentMethod = normalizePaymentMethod(req.body?.paymentMethod);
    const existingOrderId = String(req.body?.existingOrderId || "").trim();

    validatePosInvoiceData(documentType, customer, fiscalSettings);

    let existingOrder = null;
    if (existingOrderId) {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", existingOrderId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Pedido de tarjeta no encontrado" });

      if (data?.metadata?.inventoryCommittedAt) {
        return res.json({
          ok: true,
          order: posOrderResponse(data),
          inventory: bootstrap.products,
          documentNumber: data.metadata?.invoiceNumber || "",
          totals: {
            subtotal: Number(data.subtotal || 0),
            tax: Number(data.metadata?.tax || 0),
            total: Number(data.total || 0),
            received: Number(data.metadata?.received || 0),
            change: Number(data.metadata?.change || 0),
          },
          idempotent: true,
        });
      }

      if (paymentMethod !== "card" || data.status !== "paid") {
        return res.status(409).json({ error: "El pago con tarjeta todavía no está confirmado" });
      }

      existingOrder = data;
    }

    const prepared = validateAndApplyStock(
      bootstrap.products,
      existingOrder ? existingOrder.items : req.body?.items || []
    );
    const received = Number(req.body?.received || 0);
    const totals = calculatePosTotals(prepared.items, received);

    if (paymentMethod === "cash" && totals.total > 0 && received < totals.total) {
      return res.status(400).json({ error: "El efectivo recibido es inferior al total" });
    }

    if (paymentMethod === "cash") {
      const cashSession = await readPosCashSession();
      if (!cashSession || cashSession.status !== "open") {
        return res.status(409).json({ error: "La caja está cerrada. Ábrela antes de cobrar en efectivo." });
      }
      originalCashSession = cashSession;
    }

    const status = existingOrder ? "paid" : paymentStatusForMethod(paymentMethod);
    const documentNumber = await reservePosDocumentNumber(documentType);
    const now = new Date().toISOString();
    const metadata = {
      ...(existingOrder?.metadata || {}),
      source: existingOrder ? "TPV_ADMIN_CARD" : "TPV_ADMIN",
      documentType,
      invoiceNumber: documentNumber,
      notes: String(req.body?.notes || existingOrder?.metadata?.notes || ""),
      customerNif: customer.nif,
      customerAddress: customer.address,
      customerPhone: customer.phone,
      fiscalSnapshot: fiscalSettings,
      tax: totals.tax,
      received: paymentMethod === "cash" ? totals.received : totals.total,
      change: paymentMethod === "cash" ? totals.change : 0,
      inventoryCommittedAt: now,
    };

    await upsertStorageValue("adminProducts", JSON.stringify(prepared.updatedProducts));
    stockWasWritten = true;

    let savedOrder;
    if (existingOrder) {
      const { data, error } = await supabase
        .from("orders")
        .update({
          customer_email: customer.email || null,
          customer_name: customer.name || "Cliente mostrador",
          payment_method: "card",
          delivery_method: "mostrador",
          status: "paid",
          subtotal: totals.subtotal,
          shipping: 0,
          total: totals.total,
          items: prepared.items,
          metadata,
        })
        .eq("id", existingOrder.id)
        .select("*")
        .single();
      if (error) throw error;
      savedOrder = data;
    } else {
      const id = crypto.randomUUID();
      const { data, error } = await supabase
        .from("orders")
        .insert({
          id,
          customer_email: customer.email || null,
          customer_name: customer.name || "Cliente mostrador",
          payment_method: paymentMethod,
          delivery_method: "mostrador",
          status,
          subtotal: totals.subtotal,
          shipping: 0,
          total: totals.total,
          items: prepared.items,
          metadata,
        })
        .select("*")
        .single();
      if (error) throw error;
      createdOrderId = id;
      savedOrder = data;
    }

    let cashSession = null;
    if (paymentMethod === "cash") {
      cashSession = await registerCashSaleInSession(totals.total, savedOrder.id);
      cashSessionWasWritten = true;
    }

    if (!existingOrder) {
      broadcastAdminOrderEvent(savedOrder, status === "paid" ? "order_paid" : "order_created");
      void emitNeuralBusinessEvent(status === "paid" ? "sale.completed" : "order.created", normalizeOrder(savedOrder));

      if (status === "paid") {
        try {
          await sendOrderConfirmationEmails(savedOrder, "pos_sale_created");
        } catch (emailError) {
          console.error("Error enviando emails de venta TPV:", emailError.message);
        }
      }
    }

    res.json({
      ok: true,
      order: posOrderResponse(savedOrder),
      inventory: prepared.updatedProducts,
      documentNumber,
      totals,
      cashSession,
    });
  } catch (error) {
    if (cashSessionWasWritten && originalCashSession) {
      try {
        await writePosCashSession(originalCashSession);
      } catch (rollbackError) {
        console.error("No se pudo revertir la caja tras fallo TPV:", rollbackError.message);
      }
    }

    if (createdOrderId) {
      try {
        const { error: deleteOrderError } = await supabase
          .from("orders")
          .delete()
          .eq("id", createdOrderId);
        if (deleteOrderError) throw deleteOrderError;
      } catch (rollbackError) {
        console.error("No se pudo revertir el pedido tras fallo TPV:", rollbackError.message);
      }
    }

    if (stockWasWritten && originalProducts) {
      try {
        await upsertStorageValue("adminProducts", JSON.stringify(originalProducts));
      } catch (rollbackError) {
        console.error("No se pudo revertir stock tras fallo TPV:", rollbackError.message);
      }
    }
    res.status(500).json({ error: error.message || "No se pudo completar la venta TPV" });
  }
});

function pickBouquetImage({ description = "", color = "", style = "" }) {
  const images = [
    "https://images.unsplash.com/photo-1561181286-d3fee7d55364?q=80&w=1200&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?q=80&w=1200&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1559563362-c667ba5f5480?q=80&w=1200&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1591886960571-74d43a9d4166?q=80&w=1200&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1562690868-60bbe7293e94?q=80&w=1200&auto=format&fit=crop",
  ];
  const seed = `${description}-${color}-${style}`
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return images[seed % images.length];
}

function cleanAiJson(content) {
  return String(content || "{}")
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
}

function groqModel(model) {
  const configured = String(model || "").trim();
  if (configured && !configured.includes("llama-3.1-70b")) return configured;
  return process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
}

async function getAiSettings() {
  const { data } = await supabase
    .from("app_storage")
    .select("value")
    .eq("key", "aiSettings")
    .maybeSingle();

  try {
    return JSON.parse(data?.value || "{}");
  } catch {
    return {};
  }
}

app.post("/api/ai/bouquet", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;

  const { description = "", budget = 0, style = "Elegante", color = "Mix", size = "M" } = req.body || {};

  if (!String(description).trim()) {
    return res.status(400).json({ error: "Falta la descripcion del ramo" });
  }

  const settings = await getAiSettings();

  if (!settings.enabled || !settings.apiKey) {
    return res.status(400).json({ error: "IA no configurada en el admin" });
  }

  const provider = settings.provider === "openai" ? "openai" : "groq";
  const endpoint =
    provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
  const model =
    provider === "groq" ? groqModel(settings.model) : settings.model || "gpt-4o-mini";

  const systemPrompt = `Eres director creativo de una floristeria premium. Responde solo JSON valido con esta estructura exacta:
{
  "name": "nombre comercial del ramo",
  "shortDescription": "frase corta para tarjeta de producto",
  "description": "descripcion comercial en espanol",
  "recommendedFlowers": ["flor"],
  "sellingTip": "consejo breve de venta"
}`;

  try {
    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Crea un ramo para Herencia Market. Idea: ${description}. Presupuesto: ${budget} euros. Estilo: ${style}. Color principal: ${color}. Tamano: ${size}.`,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const detail = await aiResponse.text();
      return res.status(502).json({ error: `Error del proveedor de IA: ${detail}` });
    }

    const json = await aiResponse.json();
    const content = json.choices?.[0]?.message?.content || "{}";
    const proposal = JSON.parse(cleanAiJson(content));

    res.json({
      proposal,
      image: pickBouquetImage({ description, color, style }),
      imageGeneratedByAi: false,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Error generando ramo con IA" });
  }
});

app.post("/api/ai/plant-description", async (req, res) => {
  if (!requireSupabase(res)) return;

  const { plantName, baseDescription = "" } = req.body;

  const { data } = await supabase
    .from("app_storage")
    .select("value")
    .eq("key", "aiSettings")
    .maybeSingle();

  let settings = {};

  try {
    settings = JSON.parse(data?.value || "{}");
  } catch {}

  if (!settings.enabled || !settings.apiKey) {
    return res.status(400).json({ error: "IA no configurada en backend" });
  }

  const provider = settings.provider === "openai" ? "openai" : "groq";

  const endpoint =
    provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

  const model =
    provider === "groq"
      ? groqModel(settings.model)
      : "gpt-4o-mini";

  const systemPrompt = `Eres un experto en botánica y cuidado de plantas. Genera información detallada en español sobre plantas SOLO en formato JSON válido con esta estructura exacta:
{
  "description": "descripción completa de la planta",
  "care": {
    "water": "instrucciones de riego",
    "light": "requisitos de luz",
    "temperature": "temperatura ideal",
    "fertilizer": "guía de fertilización"
  },
  "benefits": ["beneficio", "beneficio", "beneficio", "beneficio"],
  "tips": "consejos adicionales del experto"
}
Responde ÚNICAMENTE con el JSON, sin texto adicional.`;

  const aiResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Genera información completa sobre la planta "${plantName}". ${
            baseDescription ? `Información adicional: ${baseDescription}` : ""
          }`,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!aiResponse.ok) {
    const detail = await aiResponse.text();

    return res.status(502).json({
      error: `Error del proveedor de IA: ${detail}`,
    });
  }

  const json = await aiResponse.json();
  const content = json.choices?.[0]?.message?.content || "{}";

  const cleanContent = content
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  res.json({ result: JSON.parse(cleanContent) });
});

app.post("/api/stripe/create-payment-intent", async (req, res) => {
  if (!requireSupabase(res)) return;

  if (!stripe) {
    return res
      .status(503)
      .json({ error: "Stripe no está configurado en el backend" });
  }

  const {
    amount,
    currency = "eur",
    items = [],
    customerEmail,
    customerName,
    deliveryMethod = "envio",
    shipping = 0,
    subtotal = 0,
    paymentMethod = "tarjeta",
    metadata = {},
  } = req.body;

  const selectedPaymentMethod = paymentMethod === "bizum" ? "bizum" : "tarjeta";
  const totalCents = Math.round(Number(amount) * 100);

  if (!Number.isFinite(totalCents) || totalCents < 50) {
    return res.status(400).json({ error: "Importe inválido para Stripe" });
  }

  if (customerEmail && !isValidEmail(customerEmail)) {
    return res.status(400).json({ error: "Email inválido" });
  }

  const orderId = crypto.randomUUID();

  const { error: orderError } = await supabase.from("orders").insert({
    id: orderId,
    customer_email: customerEmail || null,
    customer_name: customerName || null,
    payment_method: selectedPaymentMethod,
    delivery_method: deliveryMethod,
    status: "payment_pending",
    subtotal,
    shipping,
    total: Number(amount),
    items,
    metadata: {
      ...metadata,
      source: "frontend_checkout",
      requestedPaymentMethod: selectedPaymentMethod,
    },
  });

  if (orderError) {
    return res.status(500).json({ error: orderError.message });
  }

  try {
    const paymentIntentParams = {
      amount: totalCents,
      currency,
      receipt_email: customerEmail || undefined,
      metadata: {
        orderId,
        requestedPaymentMethod: selectedPaymentMethod,
      },
    };

    paymentIntentParams.payment_method_types =
      selectedPaymentMethod === "bizum" ? ["bizum"] : ["card"];

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    await supabase
      .from("orders")
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq("id", orderId);

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      orderId,
    });
  } catch (error) {
    await supabase
      .from("orders")
      .update({
        status: "payment_error",
        metadata: {
          ...metadata,
          source: "frontend_checkout",
          requestedPaymentMethod: selectedPaymentMethod,
          stripeError: error.message,
        },
      })
      .eq("id", orderId);

    res.status(error.statusCode || 500).json({
      error: error.message || "Error al crear el pago en Stripe",
      code: error.code || "stripe_error",
    });
  }
});

app.post("/api/stripe/confirm-order", async (req, res) => {
  if (!requireSupabase(res)) return;

  if (!stripe) {
    return res
      .status(503)
      .json({ error: "Stripe no estÃ¡ configurado en el backend" });
  }

  const { orderId, paymentIntentId } = req.body || {};

  if (!orderId || !paymentIntentId) {
    return res
      .status(400)
      .json({ error: "Falta orderId o paymentIntentId" });
  }

  let paymentIntent;

  try {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (error) {
    return res.status(error.statusCode || 502).json({
      error: error.message || "No se pudo verificar el pago en Stripe",
      code: error.code || "stripe_retrieve_error",
    });
  }

  const stripeOrderId = paymentIntent.metadata?.orderId;

  if (stripeOrderId && stripeOrderId !== orderId) {
    return res.status(409).json({
      error: "El pago de Stripe no corresponde con este pedido",
    });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    return res.status(500).json({ error: orderError.message });
  }

  if (!order) {
    return res.status(404).json({ error: "Pedido no encontrado" });
  }

  if (
    order.stripe_payment_intent_id &&
    order.stripe_payment_intent_id !== paymentIntent.id
  ) {
    return res.status(409).json({
      error: "El pedido ya estÃ¡ asociado a otro pago de Stripe",
    });
  }

  const now = new Date().toISOString();
  const isPaid = paymentIntent.status === "succeeded";
  const isProcessing = paymentIntent.status === "processing";
  const nextStatus = isPaid
    ? "paid"
    : isProcessing
    ? "payment_pending"
    : "payment_error";

  const nextMetadata = {
    ...(order.metadata || {}),
    stripeStatus: paymentIntent.status,
    stripeConfirmedAt: now,
  };

  if (!isPaid && !isProcessing) {
    nextMetadata.stripeConfirmationError = `Stripe devolviÃ³ estado: ${paymentIntent.status}`;
  }

  const { data: updatedOrder, error: updateError } = await supabase
    .from("orders")
    .update({
      status: nextStatus,
      stripe_payment_intent_id: paymentIntent.id,
      metadata: nextMetadata,
      updated_at: now,
    })
    .eq("id", orderId)
    .select("*")
    .single();

  if (updateError) {
    return res.status(500).json({ error: updateError.message });
  }

  if (!isPaid && !isProcessing) {
    return res.status(409).json({
      error: `Stripe devolviÃ³ estado: ${paymentIntent.status}`,
      paymentIntentStatus: paymentIntent.status,
      order: updatedOrder,
    });
  }

  let emailResults = null;

  if (isPaid) {
    broadcastAdminOrderEvent(updatedOrder, "order_paid");
          void emitNeuralBusinessEvent("order.paid", normalizeOrder(updatedOrder));

    try {
      emailResults = await sendOrderConfirmationEmails(
        updatedOrder,
        "stripe_confirm_order"
      );
    } catch (emailError) {
      console.error(
        "Error enviando emails de confirmaciÃ³n:",
        emailError.message
      );
      emailResults = { error: emailError.message };
    }
  }

  res.json({
    ok: true,
    order: updatedOrder,
    emailResults,
    paymentIntentStatus: paymentIntent.status,
  });
});


// Read-only bridge for HERENCIA Neural. Neural is an independent service; this bridge only exposes
// verified business state and never gives it unrestricted database access.
function requireNeuralBridge(req, res, next) {
  const expected = process.env.HERENCIA_NEURAL_TOKEN;
  const received = req.get("X-Herencia-Neural-Token");
  if (!expected) return res.status(503).json({ error: "HERENCIA_NEURAL_TOKEN no configurado" });
  if (!received) return res.status(401).json({ error: "Token Neural requerido" });
  const a = Buffer.from(String(received));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(403).json({ error: "Token Neural inválido" });
  next();
}


function requireNeuralActionId(req, res) {
  const actionId = String(req.get("X-Neural-Action-Id") || req.body?.actionId || "").trim();
  if (!actionId) {
    res.status(400).json({ error: "X-Neural-Action-Id requerido para acciones de escritura" });
    return null;
  }
  return actionId;
}

async function readNeuralProducts() {
  return parseStoredJson(await readStorageValue("adminProducts"), []);
}

async function writeNeuralProducts(products) {
  await upsertStorageValue("adminProducts", JSON.stringify(products));
  return products;
}

function normalizeNeuralProduct(input = {}) {
  const name = String(input.name || input.title || "").trim();
  if (!name) throw new Error("El producto necesita nombre");
  const price = Number(input.price || 0);
  const stock = Math.max(0, Math.floor(Number(input.stock || 0)));
  if (!Number.isFinite(price) || price < 0) throw new Error("Precio inválido");
  return {
    ...input,
    id: String(input.id || crypto.randomUUID()),
    name,
    price,
    stock,
    category: String(input.category || "Sin categoría").trim(),
    sku: String(input.sku || "").trim(),
    updatedAt: new Date().toISOString(),
  };
}

app.patch("/api/neural-bridge/products/:id/stock", requireNeuralBridge, async (req, res) => {
  const actionId = requireNeuralActionId(req, res);
  if (!actionId) return;
  try {
    const products = await readNeuralProducts();
    const index = products.findIndex(p => String(p.id) === String(req.params.id));
    if (index < 0) return res.status(404).json({ error: "Producto no encontrado" });
    const current = Math.max(0, Math.floor(Number(products[index].stock || 0)));
    const nextStock = req.body?.stock != null
      ? Math.max(0, Math.floor(Number(req.body.stock)))
      : Math.max(0, current + Math.floor(Number(req.body?.delta || 0)));
    if (!Number.isFinite(nextStock)) return res.status(400).json({ error: "Stock inválido" });
    products[index] = { ...products[index], stock: nextStock, updatedAt: new Date().toISOString() };
    await writeNeuralProducts(products);
    void emitNeuralBusinessEvent("inventory.changed", { actionId, product: products[index], previousStock: current, nextStock });
    res.json({ ok: true, actionId, product: products[index] });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo modificar stock" });
  }
});

app.patch("/api/neural-bridge/products/:id/price", requireNeuralBridge, async (req, res) => {
  const actionId = requireNeuralActionId(req, res);
  if (!actionId) return;
  try {
    const price = Number(req.body?.price);
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: "Precio inválido" });
    const products = await readNeuralProducts();
    const index = products.findIndex(p => String(p.id) === String(req.params.id));
    if (index < 0) return res.status(404).json({ error: "Producto no encontrado" });
    const previousPrice = Number(products[index].price || 0);
    products[index] = { ...products[index], price, updatedAt: new Date().toISOString() };
    await writeNeuralProducts(products);
    void emitNeuralBusinessEvent("product.price_changed", { actionId, product: products[index], previousPrice, price });
    res.json({ ok: true, actionId, product: products[index] });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo modificar precio" });
  }
});

app.post("/api/neural-bridge/products", requireNeuralBridge, async (req, res) => {
  const actionId = requireNeuralActionId(req, res);
  if (!actionId) return;
  try {
    const products = await readNeuralProducts();
    const product = normalizeNeuralProduct(req.body?.product || req.body || {});
    if (products.some(p => String(p.id) === product.id || (product.sku && String(p.sku || "").toLowerCase() === product.sku.toLowerCase()))) {
      return res.status(409).json({ error: "Ya existe un producto con ese ID o SKU" });
    }
    products.push(product);
    await writeNeuralProducts(products);
    void emitNeuralBusinessEvent("product.created", { actionId, product });
    res.status(201).json({ ok: true, actionId, product });
  } catch (error) {
    res.status(400).json({ error: error.message || "No se pudo crear el producto" });
  }
});

function safeClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function setDeepValue(root, path, value) {
  const parts = String(path || "").split(".").filter(Boolean);
  const allowedRoots = new Set(["brand","navigation","headerActions","hero","features","categories","categoriesHeading","categoriesDescription","cta","footer","floatingWhatsapp","contactPage","customSections"]);
  if (!parts.length || !allowedRoots.has(parts[0])) throw new Error("Ruta de contenido no permitida");
  let cursor = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i];
    if (cursor[key] == null || typeof cursor[key] !== "object") cursor[key] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cursor = cursor[key];
  }
  const last = /^\d+$/.test(parts.at(-1)) ? Number(parts.at(-1)) : parts.at(-1);
  cursor[last] = value;
}

function normalizeCustomSection(section = {}) {
  return {
    id: String(section.id || crypto.randomUUID()),
    title: String(section.title || "Nueva sección").trim(),
    subtitle: String(section.subtitle || "").trim(),
    columns: Math.max(1, Math.min(4, Number(section.columns || 3))),
    items: Array.isArray(section.items) ? section.items.map(item => ({
      id: String(item?.id || crypto.randomUUID()),
      title: String(item?.title || "").trim(),
      description: String(item?.description || "").trim(),
      imageUrl: String(item?.imageUrl || "").trim(),
      href: String(item?.href || "/").trim() || "/",
      buttonLabel: String(item?.buttonLabel || "Ver más").trim() || "Ver más",
    })) : [],
  };
}

function applyNeuralWebOperations(siteInput, operations = []) {
  const site = safeClone(siteInput || {});
  site.customSections = Array.isArray(site.customSections) ? site.customSections : [];
  for (const op of operations) {
    switch (op?.type) {
      case "updateText":
      case "setImage":
      case "updateButtonAction":
        setDeepValue(site, op.path || op.target, op.value);
        break;
      case "createSection":
        site.customSections.push(normalizeCustomSection(op.section || op.value || {}));
        break;
      case "moveSection": {
        const from = site.customSections.findIndex(s => s.id === op.sectionId);
        if (from < 0) throw new Error("Sección no encontrada");
        const [section] = site.customSections.splice(from, 1);
        const to = Math.max(0, Math.min(site.customSections.length, Number(op.toIndex || 0)));
        site.customSections.splice(to, 0, section);
        break;
      }
      case "removeElement":
        if (op.sectionId) site.customSections = site.customSections.filter(s => s.id !== op.sectionId);
        else throw new Error("removeElement requiere sectionId en esta versión");
        break;
      case "setGrid": {
        const section = site.customSections.find(s => s.id === op.sectionId);
        if (!section) throw new Error("Sección no encontrada");
        section.columns = Math.max(1, Math.min(4, Number(op.columns || op.value || 3)));
        break;
      }
      case "createButton": {
        const section = site.customSections.find(s => s.id === op.sectionId);
        const item = section?.items?.find(i => i.id === op.itemId);
        if (!item) throw new Error("Elemento no encontrado para createButton");
        item.buttonLabel = String(op.label || "Ver más");
        item.href = String(op.href || "/");
        break;
      }
      default:
        throw new Error(`Operación web no soportada: ${op?.type}`);
    }
  }
  return site;
}

async function readNeuralWebDrafts() {
  return parseStoredJson(await readStorageValue("neuralWebDrafts"), []);
}
async function readNeuralWebVersions() {
  return parseStoredJson(await readStorageValue("neuralWebVersions"), []);
}

app.get("/api/neural-bridge/web/drafts", requireNeuralBridge, async (_req, res) => {
  res.json({ drafts: await readNeuralWebDrafts() });
});

app.post("/api/neural-bridge/web/drafts", requireNeuralBridge, async (req, res) => {
  const actionId = requireNeuralActionId(req, res);
  if (!actionId) return;
  try {
    const current = parseStoredJson(await readStorageValue("siteContent"), {});
    const operations = Array.isArray(req.body?.operations) ? req.body.operations : [];
    const preview = applyNeuralWebOperations(current, operations);
    const drafts = await readNeuralWebDrafts();
    const draft = {
      id: crypto.randomUUID(),
      actionId,
      title: String(req.body?.title || "Neural web draft"),
      operations,
      preview,
      status: "DRAFT",
      createdAt: new Date().toISOString(),
    };
    await upsertStorageValue("neuralWebDrafts", JSON.stringify([draft, ...drafts].slice(0, 100)));
    res.status(201).json({ draft });
  } catch (error) {
    res.status(400).json({ error: error.message || "No se pudo crear el borrador" });
  }
});

app.get("/api/neural-bridge/web/versions", requireNeuralBridge, async (_req, res) => {
  const versions = await readNeuralWebVersions();
  res.json({ versions: versions.map(({ snapshot, ...meta }) => meta) });
});

app.post("/api/neural-bridge/web/drafts/:id/publish", requireNeuralBridge, async (req, res) => {
  const actionId = requireNeuralActionId(req, res);
  if (!actionId) return;
  try {
    const drafts = await readNeuralWebDrafts();
    const draft = drafts.find(d => d.id === req.params.id);
    if (!draft) return res.status(404).json({ error: "Borrador no encontrado" });
    const current = parseStoredJson(await readStorageValue("siteContent"), {});
    const versions = await readNeuralWebVersions();
    const version = {
      id: crypto.randomUUID(),
      actionId,
      sourceDraftId: draft.id,
      createdAt: new Date().toISOString(),
      reason: String(req.body?.reason || draft.title || "Neural publish"),
      snapshot: current,
    };
    await upsertStorageValue("neuralWebVersions", JSON.stringify([version, ...versions].slice(0, 100)));
    await upsertStorageValue("siteContent", JSON.stringify(draft.preview));
    if (draft.preview?.hero?.imageUrl) await upsertStorageValue("heroBanner", JSON.stringify({ imageUrl: draft.preview.hero.imageUrl }));
    if (draft.preview?.cta?.imageUrl) await upsertStorageValue("ctaBanner", JSON.stringify({ imageUrl: draft.preview.cta.imageUrl }));
    draft.status = "PUBLISHED";
    draft.publishedAt = new Date().toISOString();
    await upsertStorageValue("neuralWebDrafts", JSON.stringify(drafts));
    void emitNeuralBusinessEvent("web.published", { actionId, draftId: draft.id, versionId: version.id });
    res.json({ ok: true, draftId: draft.id, versionId: version.id, publishedAt: draft.publishedAt });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo publicar" });
  }
});

app.post("/api/neural-bridge/web/versions/:id/rollback", requireNeuralBridge, async (req, res) => {
  const actionId = requireNeuralActionId(req, res);
  if (!actionId) return;
  try {
    const versions = await readNeuralWebVersions();
    const target = versions.find(v => v.id === req.params.id);
    if (!target) return res.status(404).json({ error: "Versión no encontrada" });
    const current = parseStoredJson(await readStorageValue("siteContent"), {});
    const safetyVersion = {
      id: crypto.randomUUID(),
      actionId,
      createdAt: new Date().toISOString(),
      reason: `Snapshot previo a rollback hacia ${target.id}`,
      snapshot: current,
    };
    await upsertStorageValue("neuralWebVersions", JSON.stringify([safetyVersion, ...versions].slice(0, 100)));
    await upsertStorageValue("siteContent", JSON.stringify(target.snapshot || {}));
    if (target.snapshot?.hero?.imageUrl) await upsertStorageValue("heroBanner", JSON.stringify({ imageUrl: target.snapshot.hero.imageUrl }));
    if (target.snapshot?.cta?.imageUrl) await upsertStorageValue("ctaBanner", JSON.stringify({ imageUrl: target.snapshot.cta.imageUrl }));
    void emitNeuralBusinessEvent("web.rollback", { actionId, restoredVersionId: target.id, safetyVersionId: safetyVersion.id });
    res.json({ ok: true, restoredVersionId: target.id, safetyVersionId: safetyVersion.id });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo restaurar la versión" });
  }
});

app.get("/api/neural-bridge/orders", requireNeuralBridge, async (_req, res) => {
  if (!requireSupabase(res)) return;
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ orders: data || [], observedAt: new Date().toISOString() });
});

app.get("/api/neural-bridge/products", requireNeuralBridge, async (_req, res) => {
  if (!requireSupabase(res)) return;
  const { data, error } = await supabase.from("app_storage").select("value").eq("key", "adminProducts").maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  let products = [];
  try { products = JSON.parse(data?.value || "[]"); } catch { products = []; }
  res.json({ products, observedAt: new Date().toISOString() });
});

app.get("/api/neural-bridge/snapshot", requireNeuralBridge, async (_req, res) => {
  if (!requireSupabase(res)) return;
  const [{ data: orders, error: orderError }, { data: productRow, error: productError }] = await Promise.all([
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("app_storage").select("value").eq("key", "adminProducts").maybeSingle(),
  ]);
  if (orderError || productError) return res.status(500).json({ error: orderError?.message || productError?.message });
  let products = [];
  try { products = JSON.parse(productRow?.value || "[]"); } catch { products = []; }
  const inventory = products.map((p) => ({ id: p.id, name: p.name || p.title, stock: Number(p.stock || 0), price: Number(p.price || 0), category: p.category || null }));
  const customers = [...new Map((orders || []).filter(o => o.customer_email).map(o => [o.customer_email, { email: o.customer_email, name: o.customer_name || "", lastOrderAt: o.created_at }])).values()];
  const sales = (orders || []).filter(o => ["paid","completed","delivered"].includes(o.status));
  res.json({ products, inventory, orders: orders || [], customers, sales, updatedAt: new Date().toISOString() });
});



app.get("/api/neural-bridge/full-snapshot", requireNeuralBridge, async (_req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const [{ data: orders, error: orderError }, productsRaw, cashRaw, siteRaw, heroRaw, ctaRaw] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(1000),
      readStorageValue("adminProducts"),
      readStorageValue("posCashSession"),
      readStorageValue("siteContent"),
      readStorageValue("heroBanner"),
      readStorageValue("ctaBanner"),
    ]);
    if (orderError) throw orderError;
    const products = parseStoredJson(productsRaw, []);
    const cash = parseStoredJson(cashRaw, null);
    const web = {
      siteContent: parseStoredJson(siteRaw, {}),
      heroBanner: parseStoredJson(heroRaw, {}),
      ctaBanner: parseStoredJson(ctaRaw, {}),
    };
    const inventory = products.map((p) => ({
      id: p.id,
      name: p.name || p.title,
      stock: Number(p.stock || 0),
      price: Number(p.price || 0),
      category: p.category || null,
      sku: p.sku || null,
    }));
    const customers = [...new Map((orders || []).filter(o => o.customer_email).map(o => [
      o.customer_email,
      { email: o.customer_email, name: o.customer_name || "", lastOrderAt: o.created_at }
    ])).values()];
    const sales = (orders || []).filter(o => ["paid","confirmed","preparing","ready","delivered","completed"].includes(o.status));
    const revenue = sales.reduce((sum,o)=>sum+Number(o.total||0),0);
    const finance = {
      revenue,
      transactions: sales.length,
      averageTicket: sales.length ? revenue / sales.length : 0,
      derivedFrom: "verified_orders",
    };
    res.json({
      products,
      inventory,
      orders: orders || [],
      customers,
      sales,
      cash,
      finance,
      suppliers: [],
      conversations: [],
      web,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo construir el Digital Twin" });
  }
});

// Admin proxy to the independent HERENCIA Neural service.
// Browser clients never receive NEURAL_ADMIN_TOKEN or the internal Neural service URL.
app.use("/api/neural", requireAdmin, async (req, res) => {
  const baseUrl = String(process.env.NEURAL_SERVICE_URL || "").replace(/\/$/, "");
  const adminToken = process.env.NEURAL_ADMIN_TOKEN;
  if (!baseUrl || !adminToken) {
    return res.status(503).json({ error: "HERENCIA Neural no está configurada en este backend" });
  }
  const target = `${baseUrl}/v1/neural${req.url || ""}`;
  const method = req.method.toUpperCase();
  try {
    const upstream = await fetch(target, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Neural-Admin-Token": adminToken,
      },
      body: ["GET", "HEAD"].includes(method) ? undefined : JSON.stringify(req.body || {}),
      signal: AbortSignal.timeout(15000),
    });
    const text = await upstream.text();
    const contentType = upstream.headers.get("content-type") || "application/json; charset=utf-8";
    res.status(upstream.status).type(contentType);
    return res.send(text);
  } catch (error) {
    console.error("Neural proxy error:", error?.message || error);
    return res.status(502).json({ error: "No se pudo comunicar con HERENCIA Neural" });
  }
});

app.listen(port, () => {
  console.log(`Backend Herencia escuchando en puerto ${port}`);
});
