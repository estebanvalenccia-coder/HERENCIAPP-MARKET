import express from "express";
import cors from "cors";
import Stripe from "stripe";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { calculateShippingQuote } from "./fixMapsShipping.js";
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
const adminAuthConfigured = Boolean(
  adminUsername &&
  adminPassword &&
  sessionSecret
);

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
  "businessSuiteSettings",
  "marketingContent",
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
  "adminSuppliers",
  "adminFlowerCosts",
  "adminLatestFlowerQuote",
  "heroBanner",
  "ctaBanner",
  "siteContent",
  "siteContentDraft",
  "siteContentHistory",
  "herencia_finance_sales",
  "herencia_finance_expenses",
  "herencia_finance_closures",
  "financeGoals",
  "businessSuiteSettings",
  "marketingContent",
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
  "adminSuppliers",
  "siteContentDraft",
  "siteContentHistory",
  "herencia_finance_sales",
  "herencia_finance_expenses",
  "herencia_finance_closures",
  "businessSuiteSettings",
  "automationRules",
  "adminAutomationNotifications",
  "customerAccounts",
  "customerReferrals",
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
  const fiscal = normalized.metadata?.fiscalSnapshot || {};
  const taxAmount = Math.max(0, Number(normalized.metadata?.tax || 0));
  const documentNumber = normalized.metadata?.invoiceNumber || normalized.id;
  const customerNif = String(normalized.metadata?.customerNif || "");
  const customerAddress = String(normalized.metadata?.customerAddress || "");
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
                <p style="margin:10px 0 0;font-size:15px;opacity:.95;">Documento #${escapeHtml(
                  documentNumber
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
                  ${customerNif ? `<tr><td style="padding:6px 0;color:#8b6b61;font-size:13px;">NIF/CIF cliente</td><td align="right" style="padding:6px 0;font-weight:700;">${escapeHtml(customerNif)}</td></tr>` : ""}
                  ${customerAddress ? `<tr><td style="padding:6px 0;color:#8b6b61;font-size:13px;">Dirección fiscal</td><td align="right" style="padding:6px 0;font-weight:700;">${escapeHtml(customerAddress)}</td></tr>` : ""}
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
                    <td style="padding:5px 0;color:#f8d8cc;">${taxAmount > 0 ? "Base imponible" : "Subtotal"}</td>
                    <td align="right" style="padding:5px 0;font-weight:700;">${formatCurrency(normalized.subtotal)}</td>
                  </tr>
                  ${taxAmount > 0 ? `<tr><td style="padding:5px 0;color:#f8d8cc;">IVA</td><td align="right" style="padding:5px 0;font-weight:700;">${formatCurrency(taxAmount)}</td></tr>` : ""}
                  <tr>
                    <td style="padding:5px 0;color:#f8d8cc;">Envío</td>
                    <td align="right" style="padding:5px 0;font-weight:700;">${formatCurrency(normalized.shipping)}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0 0;font-size:19px;font-weight:800;">Total</td>
                    <td align="right" style="padding:12px 0 0;font-size:22px;font-weight:900;color:#ffc75f;">${formatCurrency(normalized.total)}</td>
                  </tr>
                </table>

                ${fiscal.businessName || fiscal.nif || fiscal.address ? `
                  <div style="margin-top:22px;background:#fffaf7;border:1px solid #f1e7df;border-radius:18px;padding:16px;color:#4d3128;font-size:13px;line-height:1.6;">
                    <strong style="display:block;color:#2b1712;margin-bottom:4px;">Datos fiscales del emisor</strong>
                    ${fiscal.businessName ? `${escapeHtml(fiscal.businessName)}<br/>` : ""}
                    ${fiscal.nif ? `NIF/CIF: ${escapeHtml(fiscal.nif)}<br/>` : ""}
                    ${fiscal.address ? `${escapeHtml(fiscal.address)}<br/>` : ""}
                    ${fiscal.email ? `${escapeHtml(fiscal.email)}` : ""}
                  </div>` : ""}
                <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#8b6b61;text-align:center;">
                  ${
                    isAdminEmail
                      ? "Revisa el panel de administración para gestionar este pedido."
                      : "Gracias por tu compra. Conserva este correo como justificante de la operación. Si tienes cualquier duda, responde a este correo."
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
          let inventoryOrder = updatedOrder;
          try {
            const inventoryResult = await commitOnlineOrderInventory(updatedOrder);
            inventoryOrder = inventoryResult.order || updatedOrder;
          } catch (inventoryError) {
            console.error("Webhook pagado con incidencia de inventario:", inventoryError?.message || inventoryError);
            await addAutomationNotification({
              type: "inventory_payment_conflict",
              title: "Pago con incidencia de stock",
              message: `Pedido #${String(updatedOrder.id).slice(0,8)} pagado, pero el inventario no pudo confirmarse: ${inventoryError?.message || inventoryError}`,
              entityType: "order",
              entityId: String(updatedOrder.id),
              dedupeKey: `inventory-payment:${updatedOrder.id}`,
            }).catch(() => null);
          }

          broadcastAdminOrderEvent(inventoryOrder, "order_paid");
          void emitNeuralBusinessEvent("order.paid", normalizeOrder(inventoryOrder));

          try {
            await sendOrderConfirmationEmails(inventoryOrder, "stripe_payment_succeeded");
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

const ADMIN_AUDIT_LOG_KEY = "adminAuditLog";

app.use((req, res, next) => {
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  const shouldAudit = mutating && req.path.startsWith("/api/") && ![
    "/api/admin/login",
    "/api/admin/logout",
    "/api/stripe/webhook",
  ].includes(req.path);

  if (!shouldAudit || !isAdmin(req)) return next();

  const startedAt = Date.now();
  res.on("finish", () => {
    void (async () => {
      try {
        const rows = parseStoredJson(await readStorageValue(ADMIN_AUDIT_LOG_KEY), []);
        const ua = String(req.headers["user-agent"] || "").slice(0, 240);
        const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
        const ip = forwarded || req.socket?.remoteAddress || "";
        const maskedIp = ip.includes(".")
          ? ip.split(".").map((part, index) => index >= 2 ? "x" : part).join(".")
          : ip ? "masked" : "";
        rows.unshift({
          id: crypto.randomUUID(),
          method: req.method,
          path: req.path,
          status: res.statusCode,
          ok: res.statusCode < 400,
          durationMs: Date.now() - startedAt,
          userAgent: ua,
          ip: maskedIp,
          at: new Date().toISOString(),
        });
        await upsertStorageValue(ADMIN_AUDIT_LOG_KEY, JSON.stringify(rows.slice(0, 3000)));
      } catch (error) {
        console.warn("No se pudo registrar auditoría:", error?.message || error);
      }
    })();
  });
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "Herencia backend" });
});

app.post("/api/admin/login", (req, res) => {
  if (!adminAuthConfigured) {
    return res.status(503).json({
      error: "Acceso admin no configurado en el servidor",
    });
  }

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
const SITE_MEDIA_BUCKET = process.env.SITE_MEDIA_BUCKET || "site-media";

async function ensureSiteMediaBucket() {
  if (!supabase?.storage) {
    throw new Error("Supabase Storage no está disponible en este entorno");
  }

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  const existingBucket = (buckets || []).find((bucket) => bucket.name === SITE_MEDIA_BUCKET);
  if (!existingBucket) {
    const { error: createError } = await supabase.storage.createBucket(SITE_MEDIA_BUCKET, {
      public: true,
      fileSizeLimit: 6 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    });
    if (createError && !/already exists/i.test(createError.message || "")) {
      throw createError;
    }
  } else if (existingBucket.public === false) {
    const { error: updateError } = await supabase.storage.updateBucket(SITE_MEDIA_BUCKET, {
      public: true,
      fileSizeLimit: 6 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    });
    if (updateError) throw updateError;
  }
}

function parseImageDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/i);
  if (!match) throw new Error("Formato de imagen no válido");

  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) throw new Error("La imagen está vacía");
  if (buffer.length > 6 * 1024 * 1024) throw new Error("La imagen supera 6 MB después de procesarla");

  const extension =
    mimeType === "image/png" ? "png" :
    mimeType === "image/webp" ? "webp" :
    mimeType === "image/gif" ? "gif" : "jpg";

  return { mimeType, buffer, extension };
}

function sanitizeMediaName(value) {
  return String(value || "imagen")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "imagen";
}

app.get("/api/admin/media", requireAdmin, async (_req, res) => {
  if (!requireSupabase(res)) return;
  try {
    await ensureSiteMediaBucket();
    const { data, error } = await supabase.storage
      .from(SITE_MEDIA_BUCKET)
      .list("builder", { limit: 100, sortBy: { column: "created_at", order: "desc" } });

    if (error) throw error;

    const media = (data || [])
      .filter((item) => item?.name)
      .map((item) => {
        const path = `builder/${item.name}`;
        const { data: publicData } = supabase.storage.from(SITE_MEDIA_BUCKET).getPublicUrl(path);
        return {
          name: item.name,
          path,
          url: publicData?.publicUrl || "",
          createdAt: item.created_at || null,
          size: item.metadata?.size || null,
        };
      });

    res.json({ media });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo cargar la biblioteca multimedia" });
  }
});

app.post("/api/admin/media", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    await ensureSiteMediaBucket();
    const { dataUrl, filename } = req.body || {};
    const { mimeType, buffer, extension } = parseImageDataUrl(dataUrl);
    const base = sanitizeMediaName(filename).replace(/\.[^.]+$/, "");
    const objectName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${base}.${extension}`;
    const path = `builder/${objectName}`;

    const { error } = await supabase.storage
      .from(SITE_MEDIA_BUCKET)
      .upload(path, buffer, {
        contentType: mimeType,
        cacheControl: "31536000",
        upsert: false,
      });

    if (error) throw error;

    const { data: publicData } = supabase.storage.from(SITE_MEDIA_BUCKET).getPublicUrl(path);
    res.json({
      media: {
        name: objectName,
        path,
        url: publicData?.publicUrl || "",
        size: buffer.length,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo subir la imagen" });
  }
});

app.delete("/api/admin/media", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    await ensureSiteMediaBucket();
    const path = String(req.body?.path || "");
    if (!/^builder\/[a-zA-Z0-9._-]+$/.test(path)) {
      return res.status(400).json({ error: "Ruta multimedia no válida" });
    }

    const { error } = await supabase.storage.from(SITE_MEDIA_BUCKET).remove([path]);
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo eliminar la imagen" });
  }
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


const CUSTOMER_ACCOUNTS_KEY = "customerAccounts";
const CUSTOMER_REFERRALS_KEY = "customerReferrals";
const CUSTOMER_REMINDERS_KEY = "customerReminders";

function normalizeCustomerEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function customerReferralCode(email) {
  return crypto.createHmac("sha256", sessionSecret).update(`ref:${normalizeCustomerEmail(email)}`).digest("hex").slice(0, 10).toUpperCase();
}

function hashCustomerPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const normalized = String(password || "");
  const hash = crypto.scryptSync(normalized, salt, 64).toString("hex");
  return { salt, hash };
}

function safeCustomer(account) {
  if (!account) return null;
  const { passwordHash, passwordSalt, ...safe } = account;
  return safe;
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

function getCustomerSession(req) {
  const token = parseCookies(req).customer_session;
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (signature !== sign(payload)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const maxAgeMs = 1000 * 60 * 60 * 24 * 30;
    if (decoded.role !== "customer" || Date.now() - decoded.iat >= maxAgeMs) return null;
    return decoded;
  } catch {
    return null;
  }
}

function requireCustomer(req, res, next) {
  const session = getCustomerSession(req);
  if (!session) return res.status(401).json({ error: "Inicia sesión para continuar" });
  req.customerSession = session;
  next();
}

async function loadCustomerAccounts() {
  return parseStoredJson(await readStorageValue(CUSTOMER_ACCOUNTS_KEY), []);
}

async function saveCustomerAccounts(accounts) {
  await upsertStorageValue(CUSTOMER_ACCOUNTS_KEY, JSON.stringify(accounts));
}

app.post("/api/customer/register", async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const email = normalizeCustomerEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const name = cleanText(req.body?.name, 120);
    const phone = cleanText(req.body?.phone, 60);
    const address = cleanText(req.body?.address, 300);

    if (!isValidEmail(email) || password.length < 8 || !name) {
      return res.status(400).json({ error: "Nombre, email válido y contraseña de al menos 8 caracteres son obligatorios" });
    }

    const accounts = await loadCustomerAccounts();
    if (accounts.some((item) => normalizeCustomerEmail(item.email) === email)) {
      return res.status(409).json({ error: "Ya existe una cuenta con este correo" });
    }

    const { salt, hash } = hashCustomerPassword(password);
    const account = {
      id: crypto.randomUUID(),
      email,
      name,
      phone,
      address,
      referralCode: customerReferralCode(email),
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    accounts.push(account);
    await saveCustomerAccounts(accounts);
    res.setHeader("Set-Cookie", `customer_session=${encodeURIComponent(createCustomerToken(account))}; ${cookieOptions(60 * 60 * 24 * 30)}`);
    res.json({ authenticated: true, user: safeCustomer(account) });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo crear la cuenta" });
  }
});

app.post("/api/customer/login", async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const email = normalizeCustomerEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const accounts = await loadCustomerAccounts();
    const account = accounts.find((item) => normalizeCustomerEmail(item.email) === email);
    if (!account?.passwordSalt || !account?.passwordHash) {
      return res.status(401).json({ error: "Email o contraseña incorrectos" });
    }
    const candidate = hashCustomerPassword(password, account.passwordSalt).hash;
    const a = Buffer.from(candidate, "hex");
    const b = Buffer.from(account.passwordHash, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: "Email o contraseña incorrectos" });
    }
    res.setHeader("Set-Cookie", `customer_session=${encodeURIComponent(createCustomerToken(account))}; ${cookieOptions(60 * 60 * 24 * 30)}`);
    res.json({ authenticated: true, user: safeCustomer(account) });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo iniciar sesión" });
  }
});

app.get("/api/customer/session", async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const session = getCustomerSession(req);
    if (!session) return res.json({ authenticated: false, user: null });
    const accounts = await loadCustomerAccounts();
    const account = accounts.find((item) => item.id === session.customerId && normalizeCustomerEmail(item.email) === normalizeCustomerEmail(session.email));
    if (!account) return res.json({ authenticated: false, user: null });
    res.json({ authenticated: true, user: safeCustomer(account) });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo comprobar la sesión" });
  }
});

app.post("/api/customer/logout", (_req, res) => {
  res.setHeader("Set-Cookie", `customer_session=; ${cookieOptions(0)}`);
  res.json({ ok: true });
});



app.patch("/api/customer/profile", requireCustomer, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const accounts = await loadCustomerAccounts();
    const index = accounts.findIndex((item) => item.id === req.customerSession.customerId);
    if (index < 0) return res.status(404).json({ error: "Cuenta no encontrada" });

    const current = accounts[index];
    const name = cleanText(req.body?.name ?? current.name, 120);
    const phone = cleanText(req.body?.phone ?? current.phone, 60);
    const address = cleanText(req.body?.address ?? current.address, 300);
    const addresses = Array.isArray(req.body?.addresses)
      ? req.body.addresses.slice(0, 10).map((item) => ({
          id: String(item?.id || crypto.randomUUID()),
          label: cleanText(item?.label, 80) || "Dirección",
          address: cleanText(item?.address, 220),
          city: cleanText(item?.city, 100),
          postalCode: cleanText(item?.postalCode, 20),
          province: cleanText(item?.province, 100),
          isDefault: Boolean(item?.isDefault),
        })).filter((item) => item.address)
      : (Array.isArray(current.addresses) ? current.addresses : []);

    if (!name) return res.status(400).json({ error: "El nombre no puede estar vacío" });
    if (addresses.filter((item) => item.isDefault).length > 1) {
      let foundDefault = false;
      for (const item of addresses) {
        if (item.isDefault && !foundDefault) foundDefault = true;
        else if (item.isDefault) item.isDefault = false;
      }
    }

    accounts[index] = {
      ...current,
      name,
      phone,
      address,
      addresses,
      updatedAt: new Date().toISOString(),
    };
    await saveCustomerAccounts(accounts);
    res.json({ user: safeCustomer(accounts[index]) });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo actualizar el perfil" });
  }
});

app.get("/api/customer/wishlist", requireCustomer, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const accounts = await loadCustomerAccounts();
    const account = accounts.find((item) => item.id === req.customerSession.customerId);
    if (!account) return res.status(404).json({ error: "Cuenta no encontrada" });
    res.json({ wishlist: Array.isArray(account.wishlist) ? account.wishlist.map(String) : [] });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudieron cargar favoritos" });
  }
});

app.put("/api/customer/wishlist", requireCustomer, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const ids = Array.isArray(req.body?.wishlist)
      ? [...new Set(req.body.wishlist.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, 500)
      : [];
    const accounts = await loadCustomerAccounts();
    const index = accounts.findIndex((item) => item.id === req.customerSession.customerId);
    if (index < 0) return res.status(404).json({ error: "Cuenta no encontrada" });
    accounts[index] = { ...accounts[index], wishlist: ids, updatedAt: new Date().toISOString() };
    await saveCustomerAccounts(accounts);
    res.json({ wishlist: ids });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudieron guardar favoritos" });
  }
});

app.post("/api/customer/referral/claim", requireCustomer, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const code = cleanText(req.body?.code, 40).toUpperCase();
    if (!code) return res.status(400).json({ error: "Código de referido obligatorio" });

    const accounts = await loadCustomerAccounts();
    const me = accounts.find((item) => item.id === req.customerSession.customerId);
    const referrer = accounts.find((item) => String(item.referralCode || "").toUpperCase() === code);
    if (!me || !referrer) return res.status(404).json({ error: "Código de referido no válido" });
    if (me.id === referrer.id) return res.status(400).json({ error: "No puedes usar tu propio código" });

    const referrals = parseStoredJson(await readStorageValue(CUSTOMER_REFERRALS_KEY), []);
    const existing = referrals.find((item) => item.referredCustomerId === me.id);
    if (existing) return res.json({ ok: true, referral: existing, duplicate: true });

    const referral = {
      id: crypto.randomUUID(),
      referrerCustomerId: referrer.id,
      referrerEmail: referrer.email,
      referredCustomerId: me.id,
      referredEmail: me.email,
      code,
      createdAt: new Date().toISOString(),
    };
    referrals.unshift(referral);
    await upsertStorageValue(CUSTOMER_REFERRALS_KEY, JSON.stringify(referrals.slice(0, 10000)));
    res.json({ ok: true, referral });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo registrar el referido" });
  }
});


app.post("/api/customer/reminders", requireCustomer, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const title = cleanText(req.body?.title, 120);
    const date = String(req.body?.date || "").trim();
    const leadDays = Math.max(0, Math.min(60, Number(req.body?.leadDays ?? 7)));
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Nombre y fecha válida son obligatorios" });
    }
    const rows = parseStoredJson(await readStorageValue(CUSTOMER_REMINDERS_KEY), []);
    const reminder = {
      id: crypto.randomUUID(),
      customerId: req.customerSession.customerId,
      email: normalizeCustomerEmail(req.customerSession.email),
      title,
      date,
      monthDay: date.slice(5),
      leadDays,
      active: true,
      createdAt: new Date().toISOString(),
      lastNotifiedYear: null,
    };
    rows.unshift(reminder);
    await upsertStorageValue(CUSTOMER_REMINDERS_KEY, JSON.stringify(rows.slice(0, 10000)));
    res.json({ reminder });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo guardar el recordatorio" });
  }
});

app.delete("/api/customer/reminders/:id", requireCustomer, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const rows = parseStoredJson(await readStorageValue(CUSTOMER_REMINDERS_KEY), []);
    const exists = rows.some((item) => item.id === req.params.id && item.customerId === req.customerSession.customerId);
    if (!exists) return res.status(404).json({ error: "Recordatorio no encontrado" });
    const next = rows.filter((item) => !(item.id === req.params.id && item.customerId === req.customerSession.customerId));
    await upsertStorageValue(CUSTOMER_REMINDERS_KEY, JSON.stringify(next));
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo eliminar el recordatorio" });
  }
});

async function processCustomerReminders() {
  if (!supabase || !process.env.RESEND_API_KEY) return { skipped: true };
  const rows = parseStoredJson(await readStorageValue(CUSTOMER_REMINDERS_KEY), []);
  if (!rows.length) return { sent: 0 };

  const now = new Date();
  let changed = false;
  let sent = 0;

  for (const reminder of rows) {
    if (reminder?.active === false || !isValidEmail(reminder?.email) || !/^\d{2}-\d{2}$/.test(String(reminder?.monthDay || ""))) continue;
    const [month, day] = String(reminder.monthDay).split("-").map(Number);
    let target = new Date(now.getFullYear(), month - 1, day, 12, 0, 0);
    if (target.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
      target = new Date(now.getFullYear() + 1, month - 1, day, 12, 0, 0);
    }
    const daysAway = Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const targetYear = target.getFullYear();
    if (daysAway !== Number(reminder.leadDays ?? 7) || reminder.lastNotifiedYear === targetYear) continue;

    try {
      await sendResendEmail({
        to: reminder.email,
        subject: `Herencia te recuerda: ${reminder.title}`,
        html: `<!doctype html><html lang="es"><body style="margin:0;background:#f7f4ee;font-family:Arial,sans-serif;color:#213128"><table role="presentation" width="100%"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" style="max-width:620px;background:#fff;border-radius:24px;overflow:hidden"><tr><td style="background:#426047;color:#fff;padding:28px;text-align:center"><div style="font-size:38px">🌿</div><h1 style="margin:10px 0 0">Un detalle para recordar</h1></td></tr><tr><td style="padding:28px"><h2 style="margin:0 0 12px">${escapeHtml(reminder.title)}</h2><p style="line-height:1.6;color:#607066">Faltan ${daysAway} días para esta fecha que guardaste en Herencia. Si quieres preparar un regalo, una planta o unas flores, aún estás a tiempo.</p><p style="font-size:13px;color:#8a978f">Fecha: ${String(day).padStart(2,"0")}/${String(month).padStart(2,"0")}/${targetYear}</p></td></tr></table></td></tr></table></body></html>`,
      });
      reminder.lastNotifiedYear = targetYear;
      reminder.lastNotifiedAt = new Date().toISOString();
      changed = true;
      sent += 1;
    } catch (error) {
      reminder.lastError = error?.message || String(error);
      reminder.lastAttemptAt = new Date().toISOString();
      changed = true;
    }
  }

  if (changed) await upsertStorageValue(CUSTOMER_REMINDERS_KEY, JSON.stringify(rows));
  return { sent };
}


app.get("/api/customer/privacy/export", requireCustomer, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const accounts = await loadCustomerAccounts();
    const account = accounts.find((item) => item.id === req.customerSession.customerId);
    if (!account) return res.status(404).json({ error: "Cuenta no encontrada" });
    const email = normalizeCustomerEmail(account.email);

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_email", email)
      .order("created_at", { ascending: false });
    if (ordersError) throw ordersError;

    const reminders = parseStoredJson(await readStorageValue(CUSTOMER_REMINDERS_KEY), [])
      .filter((item) => item.customerId === account.id);
    const referrals = parseStoredJson(await readStorageValue(CUSTOMER_REFERRALS_KEY), [])
      .filter((item) => item.referrerCustomerId === account.id || item.referredCustomerId === account.id);
    const reviews = (await readExperienceList(EXPERIENCE_REVIEWS_KEY))
      .filter((item) => normalizeCustomerEmail(item.email) === email);
    const waitlist = (await readExperienceList(EXPERIENCE_WAITLIST_KEY))
      .filter((item) => normalizeCustomerEmail(item.email) === email);

    res.json({
      exportedAt: new Date().toISOString(),
      account: safeCustomer(account),
      orders: (orders || []).map(normalizeOrder),
      reminders,
      referrals,
      reviews,
      waitlist,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudieron exportar tus datos" });
  }
});

app.delete("/api/customer/privacy/account", requireCustomer, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const accounts = await loadCustomerAccounts();
    const account = accounts.find((item) => item.id === req.customerSession.customerId);
    if (!account) return res.status(404).json({ error: "Cuenta no encontrada" });

    const email = normalizeCustomerEmail(account.email);
    const customerId = account.id;
    const deletedAt = new Date().toISOString();

    await saveCustomerAccounts(accounts.filter((item) => item.id !== customerId));

    const reminders = parseStoredJson(await readStorageValue(CUSTOMER_REMINDERS_KEY), [])
      .filter((item) => item.customerId !== customerId);
    await upsertStorageValue(CUSTOMER_REMINDERS_KEY, JSON.stringify(reminders));

    const referrals = parseStoredJson(await readStorageValue(CUSTOMER_REFERRALS_KEY), [])
      .filter((item) => item.referrerCustomerId !== customerId && item.referredCustomerId !== customerId);
    await upsertStorageValue(CUSTOMER_REFERRALS_KEY, JSON.stringify(referrals));

    const reviews = await readExperienceList(EXPERIENCE_REVIEWS_KEY);
    const anonymizedReviews = reviews.map((item) =>
      normalizeCustomerEmail(item.email) === email
        ? { ...item, name: "Cliente", email: "", anonymizedAt: deletedAt }
        : item
    );
    await writeExperienceList(EXPERIENCE_REVIEWS_KEY, anonymizedReviews);

    const waitlist = await readExperienceList(EXPERIENCE_WAITLIST_KEY);
    const cleanedWaitlist = waitlist.filter((item) => normalizeCustomerEmail(item.email) !== email);
    await writeExperienceList(EXPERIENCE_WAITLIST_KEY, cleanedWaitlist);

    const { data: orderRows, error: ordersError } = await supabase
      .from("orders")
      .select("id,metadata")
      .eq("customer_email", email);
    if (ordersError) throw ordersError;

    for (const order of orderRows || []) {
      const metadata = order.metadata || {};
      const hasFiscalIdentity = Boolean(
        metadata.customerNif ||
        metadata.customerAddress ||
        metadata.fiscalSnapshot?.customerNif ||
        metadata.fiscalSnapshot?.customerAddress ||
        metadata.invoiceNumber
      );
      const nextMetadata = {
        ...metadata,
        phone: "",
        customerPhone: "",
        shippingAddress: null,
        privacyAccountDeletedAt: deletedAt,
        privacyTransactionalRetention: hasFiscalIdentity ? "fiscal_record_retained" : "order_record_retained",
      };
      const patch = {
        metadata: nextMetadata,
        ...(hasFiscalIdentity
          ? {}
          : { customer_email: null, customer_name: "Cliente eliminado" }),
      };
      const { error: updateError } = await supabase
        .from("orders")
        .update(patch)
        .eq("id", order.id);
      if (updateError) throw updateError;
    }

    res.setHeader("Set-Cookie", `customer_session=; ${cookieOptions(0)}`);
    res.json({
      ok: true,
      deletedAt,
      retained: "Los registros de venta/facturación que deban conservarse no se eliminan, pero se retiran datos de entrega y cuenta cuando no son necesarios.",
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo eliminar la cuenta" });
  }
});

app.get("/api/customer/account", requireCustomer, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const accounts = await loadCustomerAccounts();
    const account = accounts.find((item) => item.id === req.customerSession.customerId);
    if (!account) return res.status(404).json({ error: "Cuenta no encontrada" });

    const email = normalizeCustomerEmail(account.email);
    const { data: rows, error } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_email", email)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const paidStatuses = new Set(["paid", "confirmed", "preparing", "ready", "delivered", "completed"]);
    const allOrders = (rows || []).map(normalizeOrder);
    const paidOrders = allOrders.filter((order) => paidStatuses.has(order.status));
    const totalSpent = paidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);

    const suite = parseStoredJson(await readStorageValue("businessSuiteSettings"), {});
    const pointsPerEuro = Math.max(0, Number(suite.pointsPerEuro ?? 1));
    const basePoints = Math.floor(totalSpent * pointsPerEuro);

    const referrals = parseStoredJson(await readStorageValue(CUSTOMER_REFERRALS_KEY), []);
    const mine = referrals.filter((item) => item.referrerCustomerId === account.id);
    const referredEmails = [...new Set(mine.map((item) => normalizeCustomerEmail(item.referredEmail)).filter(Boolean))];
    let qualifiedReferrals = 0;
    if (referredEmails.length) {
      const { data: referredOrders, error: referredError } = await supabase
        .from("orders")
        .select("customer_email,status")
        .in("customer_email", referredEmails)
        .in("status", [...paidStatuses]);
      if (referredError) throw referredError;
      qualifiedReferrals = new Set((referredOrders || []).map((item) => normalizeCustomerEmail(item.customer_email))).size;
    }

    const remindersAll = parseStoredJson(await readStorageValue(CUSTOMER_REMINDERS_KEY), []);
    const reminders = remindersAll.filter((item) => item.customerId === account.id && item.active !== false);

    const referralReward = Math.max(0, Number(suite.referralReward ?? 5));
    const referralCredit = Number((qualifiedReferrals * referralReward).toFixed(2));
    const level = totalSpent >= 300 ? "Jardín" : totalSpent >= 100 ? "Brote" : "Semilla";
    const nextLevelAt = level === "Semilla" ? 100 : level === "Brote" ? 300 : null;

    res.json({
      user: safeCustomer(account),
      orders: allOrders,
      reminders,
      loyalty: {
        points: basePoints,
        pointsPerEuro,
        totalSpent: Number(totalSpent.toFixed(2)),
        level,
        nextLevelAt,
        referralCredit,
        referrals: mine.length,
        qualifiedReferrals,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo cargar la cuenta" });
  }
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
    "businessSuiteSettings",
    "marketingContent",
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


const EXPERIENCE_WAITLIST_KEY = "experienceWaitlist";
const EXPERIENCE_REVIEWS_KEY = "experienceReviews";
const EXPERIENCE_QUESTIONS_KEY = "experienceQuestions";

function cleanText(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

async function readExperienceList(key) {
  return parseStoredJson(await readStorageValue(key), []);
}

async function writeExperienceList(key, value) {
  await upsertStorageValue(key, JSON.stringify(value));
}

async function notifyWaitlistForRestockedProducts(previousProducts = [], nextProducts = []) {
  const previousById = new Map((Array.isArray(previousProducts) ? previousProducts : []).map((product) => [String(product?.id || ""), product]));
  const restocked = (Array.isArray(nextProducts) ? nextProducts : []).filter((product) => {
    const before = Math.max(0, Number(previousById.get(String(product?.id || ""))?.stock || 0));
    const after = Math.max(0, Number(product?.stock || 0));
    return before <= 0 && after > 0;
  });

  if (!restocked.length) return { sent: 0 };

  const rows = await readExperienceList(EXPERIENCE_WAITLIST_KEY);
  let sent = 0;
  for (const product of restocked) {
    const productId = String(product?.id || "");
    const waiting = rows.filter((entry) => entry.productId === productId && entry.status !== "notified" && isValidEmail(entry.email));
    for (const entry of waiting) {
      try {
        const productUrl = `${String(process.env.PUBLIC_SITE_URL || "https://www.herenciamarket.es").replace(/\/$/, "")}/producto/${encodeURIComponent(productId)}`;
        await sendResendEmail({
          to: entry.email,
          subject: `${product.name || "Tu producto"} vuelve a estar disponible en Herencia`,
          html: `<!doctype html><html lang="es"><body style="margin:0;background:#f7f4ee;font-family:Arial,sans-serif;color:#213128"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" style="max-width:620px;background:#fff;border-radius:24px;overflow:hidden"><tr><td style="background:#426047;color:#fff;padding:28px;text-align:center"><div style="font-size:38px">🌿</div><h1 style="margin:10px 0 0;font-size:25px">¡Ha vuelto!</h1></td></tr><tr><td style="padding:28px"><h2 style="margin:0 0 12px">${escapeHtml(product.name || entry.productName || "Producto")}</h2><p style="line-height:1.6;color:#607066">Te avisamos porque pediste saber cuándo volviera a estar disponible. Ya tiene stock de nuevo.</p><p style="margin:26px 0;text-align:center"><a href="${escapeHtml(productUrl)}" style="display:inline-block;background:#426047;color:#fff;text-decoration:none;padding:13px 22px;border-radius:12px;font-weight:700">Ver producto</a></p><p style="font-size:12px;color:#8a978f">Recibes este correo porque te apuntaste a la lista de espera de Herencia.</p></td></tr></table></td></tr></table></body></html>`,
        });
        entry.status = "notified";
        entry.notifiedAt = new Date().toISOString();
        sent += 1;
      } catch (error) {
        entry.lastNotificationError = error?.message || String(error);
        entry.lastNotificationAttemptAt = new Date().toISOString();
      }
    }
  }

  await writeExperienceList(EXPERIENCE_WAITLIST_KEY, rows);
  return { sent };
}

app.post("/api/experience/waitlist", async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const productId = cleanText(req.body?.productId, 120);
    const productName = cleanText(req.body?.productName, 180);
    const email = cleanText(req.body?.email, 220).toLowerCase();
    if (!productId || !isValidEmail(email)) {
      return res.status(400).json({ error: "Producto y email válido son obligatorios" });
    }
    const rows = await readExperienceList(EXPERIENCE_WAITLIST_KEY);
    const existing = rows.find((row) => row.productId === productId && row.email === email && row.status !== "notified");
    if (existing) return res.json({ ok: true, entry: existing, duplicate: true });
    const entry = {
      id: crypto.randomUUID(),
      productId,
      productName,
      email,
      status: "waiting",
      createdAt: new Date().toISOString(),
    };
    rows.unshift(entry);
    await writeExperienceList(EXPERIENCE_WAITLIST_KEY, rows.slice(0, 5000));
    res.json({ ok: true, entry });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo guardar la lista de espera" });
  }
});

app.get("/api/admin/experience/waitlist", requireAdmin, async (_req, res) => {
  if (!requireSupabase(res)) return;
  try {
    res.json({ entries: await readExperienceList(EXPERIENCE_WAITLIST_KEY) });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo cargar la lista de espera" });
  }
});

app.patch("/api/admin/experience/waitlist/:id", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const rows = await readExperienceList(EXPERIENCE_WAITLIST_KEY);
    const index = rows.findIndex((row) => row.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: "Entrada no encontrada" });
    rows[index] = {
      ...rows[index],
      status: ["waiting", "contacted", "notified"].includes(req.body?.status) ? req.body.status : rows[index].status,
      updatedAt: new Date().toISOString(),
    };
    await writeExperienceList(EXPERIENCE_WAITLIST_KEY, rows);
    res.json({ entry: rows[index] });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo actualizar la entrada" });
  }
});

app.get("/api/experience/reviews/:productId", async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const productId = cleanText(req.params.productId, 120);
    const rows = await readExperienceList(EXPERIENCE_REVIEWS_KEY);
    const reviews = rows
      .filter((row) => row.productId === productId && row.status === "approved")
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    res.json({ reviews });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudieron cargar las reseñas" });
  }
});

app.post("/api/experience/reviews", async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const productId = cleanText(req.body?.productId, 120);
    const productName = cleanText(req.body?.productName, 180);
    const name = cleanText(req.body?.name, 120);
    const email = cleanText(req.body?.email, 220).toLowerCase();
    const comment = cleanText(req.body?.comment, 1500);
    const rating = Math.max(1, Math.min(5, Math.round(Number(req.body?.rating || 0))));
    if (!productId || !name || !isValidEmail(email) || !comment || !rating) {
      return res.status(400).json({ error: "Completa nombre, email, valoración y comentario" });
    }

    const { data: purchasedRows, error: purchasedError } = await supabase
      .from("orders")
      .select("id,items,status,customer_email")
      .eq("customer_email", email)
      .in("status", ["paid", "confirmed", "preparing", "ready", "delivered", "completed"]);

    if (purchasedError) throw purchasedError;

    const verifiedPurchase = (purchasedRows || []).some((order) =>
      (Array.isArray(order.items) ? order.items : []).some((item) => String(item?.id) === productId)
    );

    const rows = await readExperienceList(EXPERIENCE_REVIEWS_KEY);
    const duplicate = rows.find((row) => row.productId === productId && row.email === email && row.comment === comment);
    if (duplicate) return res.json({ ok: true, review: duplicate, duplicate: true });

    const review = {
      id: crypto.randomUUID(),
      productId,
      productName,
      name,
      email,
      rating,
      comment,
      verifiedPurchase,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    rows.unshift(review);
    await writeExperienceList(EXPERIENCE_REVIEWS_KEY, rows.slice(0, 5000));
    res.json({ ok: true, review });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo guardar la reseña" });
  }
});


app.get("/api/experience/questions/:productId", async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const productId = cleanText(req.params.productId, 120);
    const rows = await readExperienceList(EXPERIENCE_QUESTIONS_KEY);
    const questions = rows
      .filter((row) => row.productId === productId && row.status === "answered" && row.answer)
      .sort((a, b) => String(b.answeredAt || b.createdAt).localeCompare(String(a.answeredAt || a.createdAt)));
    res.json({ questions });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudieron cargar las preguntas" });
  }
});

app.post("/api/experience/questions", async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const productId = cleanText(req.body?.productId, 120);
    const productName = cleanText(req.body?.productName, 180);
    const name = cleanText(req.body?.name, 120);
    const email = cleanText(req.body?.email, 220).toLowerCase();
    const question = cleanText(req.body?.question, 1000);
    if (!productId || !name || !isValidEmail(email) || !question) {
      return res.status(400).json({ error: "Completa nombre, email y pregunta" });
    }
    const rows = await readExperienceList(EXPERIENCE_QUESTIONS_KEY);
    const item = {
      id: crypto.randomUUID(),
      productId,
      productName,
      name,
      email,
      question,
      answer: "",
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    rows.unshift(item);
    await writeExperienceList(EXPERIENCE_QUESTIONS_KEY, rows.slice(0, 5000));
    res.json({ ok: true, question: item });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo enviar la pregunta" });
  }
});

app.get("/api/admin/experience/questions", requireAdmin, async (_req, res) => {
  if (!requireSupabase(res)) return;
  try {
    res.json({ questions: await readExperienceList(EXPERIENCE_QUESTIONS_KEY) });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudieron cargar las preguntas" });
  }
});

app.patch("/api/admin/experience/questions/:id", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const rows = await readExperienceList(EXPERIENCE_QUESTIONS_KEY);
    const index = rows.findIndex((row) => row.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: "Pregunta no encontrada" });
    const answer = cleanText(req.body?.answer, 2000);
    const status = answer ? "answered" : "pending";
    rows[index] = {
      ...rows[index],
      answer,
      status,
      answeredAt: answer ? new Date().toISOString() : null,
    };
    await writeExperienceList(EXPERIENCE_QUESTIONS_KEY, rows);
    res.json({ question: rows[index] });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo responder la pregunta" });
  }
});

app.get("/api/admin/experience/reviews", requireAdmin, async (_req, res) => {
  if (!requireSupabase(res)) return;
  try {
    res.json({ reviews: await readExperienceList(EXPERIENCE_REVIEWS_KEY) });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudieron cargar las reseñas" });
  }
});

app.patch("/api/admin/experience/reviews/:id", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const rows = await readExperienceList(EXPERIENCE_REVIEWS_KEY);
    const index = rows.findIndex((row) => row.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: "Reseña no encontrada" });
    const status = ["pending", "approved", "rejected"].includes(req.body?.status) ? req.body.status : rows[index].status;
    rows[index] = { ...rows[index], status, moderatedAt: new Date().toISOString() };
    await writeExperienceList(EXPERIENCE_REVIEWS_KEY, rows);
    res.json({ review: rows[index] });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo moderar la reseña" });
  }
});


const AUTOMATION_RULES_KEY = "automationRules";
const AUTOMATION_NOTIFICATIONS_KEY = "adminAutomationNotifications";

const defaultAutomationRules = {
  lowStock: { enabled: true, threshold: 3 },
  outOfStock: { enabled: true },
  delayedOrder: { enabled: true, minutes: 90 },
};

async function loadAutomationRules() {
  return { ...defaultAutomationRules, ...(parseStoredJson(await readStorageValue(AUTOMATION_RULES_KEY), {}) || {}) };
}

async function loadAutomationNotifications() {
  return parseStoredJson(await readStorageValue(AUTOMATION_NOTIFICATIONS_KEY), []);
}

async function addAutomationNotification(payload) {
  const rows = await loadAutomationNotifications();
  const dedupeKey = String(payload.dedupeKey || "");
  const existing = dedupeKey && rows.find((row) => row.dedupeKey === dedupeKey && !row.resolved);
  if (existing) return existing;
  const item = {
    id: crypto.randomUUID(),
    type: String(payload.type || "info"),
    title: String(payload.title || "Aviso"),
    message: String(payload.message || ""),
    entityType: String(payload.entityType || ""),
    entityId: String(payload.entityId || ""),
    dedupeKey,
    read: false,
    resolved: false,
    createdAt: new Date().toISOString(),
  };
  const next = [item, ...rows].slice(0, 1000);
  await upsertStorageValue(AUTOMATION_NOTIFICATIONS_KEY, JSON.stringify(next));
  return item;
}

async function evaluateInventoryAutomations(products = []) {
  const rules = await loadAutomationRules();
  const threshold = Math.max(0, Number(rules.lowStock?.threshold ?? 3));
  for (const product of Array.isArray(products) ? products : []) {
    if (product?.active === false) continue;
    const stock = Math.max(0, Number(product?.stock || 0));
    const id = String(product?.id || "");
    const name = String(product?.name || "Producto");
    if (rules.outOfStock?.enabled && stock <= 0) {
      await addAutomationNotification({
        type: "out_of_stock",
        title: "Producto agotado",
        message: `${name} se ha quedado sin stock.`,
        entityType: "product",
        entityId: id,
        dedupeKey: `out:${id}`,
      });
    } else if (rules.lowStock?.enabled && stock <= threshold) {
      await addAutomationNotification({
        type: "low_stock",
        title: "Stock bajo",
        message: `${name} tiene ${stock} unidades. Umbral: ${threshold}.`,
        entityType: "product",
        entityId: id,
        dedupeKey: `low:${id}:${stock}`,
      });
    }
  }
}

async function evaluateDelayedOrders() {
  const rules = await loadAutomationRules();
  if (!rules.delayedOrder?.enabled || !supabase) return;
  const minutes = Math.max(15, Number(rules.delayedOrder?.minutes ?? 90));
  const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("orders")
    .select("id,customer_name,status,created_at")
    .lt("created_at", cutoff)
    .in("status", ["pending","payment_pending","pending_bizum_review","pending_manual_review","pending_transfer_review","pending_store_confirmation","paid","confirmed"]);
  if (error) throw error;
  for (const order of data || []) {
    await addAutomationNotification({
      type: "delayed_order",
      title: "Pedido requiere atención",
      message: `Pedido #${String(order.id).slice(0,8)} de ${order.customer_name || "Cliente"} lleva más de ${minutes} min sin avanzar.`,
      entityType: "order",
      entityId: String(order.id),
      dedupeKey: `delay:${order.id}:${order.status}`,
    });
  }
}


app.get("/api/admin/audit-log", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const limit = Math.max(1, Math.min(500, Number(req.query?.limit || 200)));
    const rows = parseStoredJson(await readStorageValue(ADMIN_AUDIT_LOG_KEY), []);
    res.json({ events: rows.slice(0, limit) });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo cargar la auditoría" });
  }
});

app.delete("/api/admin/audit-log", requireAdmin, async (_req, res) => {
  if (!requireSupabase(res)) return;
  try {
    await upsertStorageValue(ADMIN_AUDIT_LOG_KEY, JSON.stringify([]));
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo limpiar la auditoría" });
  }
});

app.get("/api/admin/automations", requireAdmin, async (_req, res) => {
  if (!requireSupabase(res)) return;
  try {
    await evaluateDelayedOrders();
    const [rules, notifications] = await Promise.all([loadAutomationRules(), loadAutomationNotifications()]);
    res.json({ rules, notifications });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudieron cargar automatizaciones" });
  }
});

app.put("/api/admin/automations/rules", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const current = await loadAutomationRules();
    const next = {
      lowStock: {
        enabled: req.body?.lowStock?.enabled ?? current.lowStock.enabled,
        threshold: Math.max(0, Number(req.body?.lowStock?.threshold ?? current.lowStock.threshold)),
      },
      outOfStock: { enabled: req.body?.outOfStock?.enabled ?? current.outOfStock.enabled },
      delayedOrder: {
        enabled: req.body?.delayedOrder?.enabled ?? current.delayedOrder.enabled,
        minutes: Math.max(15, Number(req.body?.delayedOrder?.minutes ?? current.delayedOrder.minutes)),
      },
    };
    await upsertStorageValue(AUTOMATION_RULES_KEY, JSON.stringify(next));
    const products = parseStoredJson(await readStorageValue("adminProducts"), []);
    await evaluateInventoryAutomations(products);
    res.json({ rules: next });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudieron guardar las reglas" });
  }
});

app.patch("/api/admin/automations/notifications/:id", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const rows = await loadAutomationNotifications();
    const index = rows.findIndex((row) => row.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: "Aviso no encontrado" });
    rows[index] = {
      ...rows[index],
      read: req.body?.read ?? rows[index].read,
      resolved: req.body?.resolved ?? rows[index].resolved,
      updatedAt: new Date().toISOString(),
    };
    await upsertStorageValue(AUTOMATION_NOTIFICATIONS_KEY, JSON.stringify(rows));
    res.json({ notification: rows[index] });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo actualizar el aviso" });
  }
});


const BACKUP_STORAGE_KEYS = [
  "adminProducts",
  "posCustomers",
  "posFiscalSettings",
  "posOperations",
  "shippingSettings",
  "siteContent",
  "siteContentDraft",
  "siteContentHistory",
  "customTheme",
  "menuIcons",
  "heroBanner",
  "ctaBanner",
  "businessSuiteSettings",
  "automationRules",
];

app.get("/api/admin/backup", requireAdmin, async (_req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const storage = {};
    for (const key of BACKUP_STORAGE_KEYS) {
      storage[key] = await readStorageValue(key);
    }
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw error;
    res.json({
      version: 1,
      createdAt: new Date().toISOString(),
      storage,
      orders: orders || [],
      restoreScope: "configuration_catalog_operations_only",
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo crear la copia" });
  }
});

app.post("/api/admin/backup/restore", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const backup = req.body?.backup;
    if (!backup || typeof backup !== "object" || !backup.storage || typeof backup.storage !== "object") {
      return res.status(400).json({ error: "Archivo de copia no válido" });
    }

    const snapshot = {};
    for (const key of BACKUP_STORAGE_KEYS) snapshot[key] = await readStorageValue(key);
    await upsertStorageValue(
      `backup:auto:${Date.now()}`,
      JSON.stringify({ createdAt: new Date().toISOString(), storage: snapshot })
    );

    const restored = [];
    for (const key of BACKUP_STORAGE_KEYS) {
      if (!(key in backup.storage)) continue;
      const value = backup.storage[key];
      if (value == null) continue;
      await upsertStorageValue(key, typeof value === "string" ? value : JSON.stringify(value));
      restored.push(key);
    }

    res.json({ ok: true, restored, note: "Los pedidos históricos no se sobrescriben durante una restauración." });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo restaurar la copia" });
  }
});


app.get("/api/admin/abandoned-carts", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const minMinutes = Math.max(5, Number(req.query?.minMinutes || 30));
    const { data, error } = await supabase
      .from("app_storage")
      .select("key,value,updated_at")
      .like("key", "visitor:%");
    if (error) throw error;

    const visitors = new Map();
    for (const row of data || []) {
      const match = String(row.key || "").match(/^visitor:([^:]+):(cart|user)$/);
      if (!match) continue;
      const [, visitorId, kind] = match;
      const current = visitors.get(visitorId) || { visitorId, cart: [], user: null, updatedAt: row.updated_at || null };
      try {
        const parsed = JSON.parse(row.value || (kind === "cart" ? "[]" : "null"));
        if (kind === "cart") current.cart = Array.isArray(parsed) ? parsed : [];
        if (kind === "user") current.user = parsed;
      } catch {}
      if (!current.updatedAt || new Date(row.updated_at || 0) > new Date(current.updatedAt || 0)) current.updatedAt = row.updated_at;
      visitors.set(visitorId, current);
    }

    const now = Date.now();
    const carts = [...visitors.values()]
      .map((entry) => {
        const updatedAt = entry.updatedAt || new Date(0).toISOString();
        const ageMinutes = Math.max(0, Math.floor((now - new Date(updatedAt).getTime()) / 60000));
        const total = (entry.cart || []).reduce((sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || 1), 0);
        const itemCount = (entry.cart || []).reduce((sum, item) => sum + Number(item?.quantity || 1), 0);
        return {
          visitorId: entry.visitorId,
          updatedAt,
          ageMinutes,
          total: Number(total.toFixed(2)),
          itemCount,
          items: entry.cart,
          customer: entry.user ? {
            name: String(entry.user?.name || ""),
            email: String(entry.user?.email || ""),
            phone: String(entry.user?.phone || ""),
          } : null,
        };
      })
      .filter((entry) => entry.itemCount > 0 && entry.ageMinutes >= minMinutes)
      .sort((a, b) => b.total - a.total);

    res.json({ carts, minMinutes });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudieron cargar los carritos abandonados" });
  }
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
  void evaluateDelayedOrders().catch((error) => console.warn("Automations order check:", error?.message || error));
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
  const isOnlineOrder = String(nextMetadata.source || "") === "frontend_checkout";

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

  if (
    status === "cancelled" &&
    previousOrder.status !== "cancelled" &&
    isOnlineOrder &&
    nextMetadata.inventoryCommittedAt &&
    !nextMetadata.inventoryRestockedAt
  ) {
    try {
      await restockOnlineOrderInventory(previousOrder);
      nextMetadata = {
        ...nextMetadata,
        inventoryRestockedAt: new Date().toISOString(),
        inventoryRestockReason: "online_order_cancelled",
      };
    } catch (stockError) {
      return res.status(500).json({
        error: `No se pudo devolver el stock online al cancelar: ${stockError.message}`,
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

function sanitizePosOperations(operations = {}) {
  return {
    ...operations,
    staff: (Array.isArray(operations.staff) ? operations.staff : []).map(({ pinHash, pinSalt, ...item }) => item),
  };
}

function normalizeRegisterId(value) {
  const normalized = String(value || "caja-01").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  return normalized || "caja-01";
}

function posCashSessionKey(registerId = "caja-01") {
  const id = normalizeRegisterId(registerId);
  return id === "caja-01" ? "posCashSession" : `posCashSession:${id}`;
}

async function readPosCashSession(registerId = "caja-01") {
  return parseStoredJson(await readStorageValue(posCashSessionKey(registerId)), null);
}

async function writePosCashSession(session, registerId = session?.registerId || "caja-01") {
  const id = normalizeRegisterId(registerId);
  const next = { ...(session || {}), registerId: id };
  await upsertStorageValue(posCashSessionKey(id), JSON.stringify(next));
  return next;
}

async function registerCashSaleInSession(amount, orderId, registerId = "caja-01") {
  const id = normalizeRegisterId(registerId);
  const session = await readPosCashSession(id);
  if (!session || session.status !== "open") {
    throw new Error("La caja está cerrada. Ábrela antes de cobrar en efectivo.");
  }

  const saleAmount = normalizeMoney(amount);
  const next = {
    ...session,
    registerId: id,
    cashSales: normalizeMoney(Number(session.cashSales || 0) + saleAmount),
    expectedCash: normalizeMoney(Number(session.expectedCash || 0) + saleAmount),
    movements: [
      ...(Array.isArray(session.movements) ? session.movements : []),
      {
        id: crypto.randomUUID(),
        type: "sale",
        amount: saleAmount,
        orderId,
        registerId: id,
        note: "Venta en efectivo",
        at: new Date().toISOString(),
      },
    ],
    updatedAt: new Date().toISOString(),
  };

  await writePosCashSession(next, id);
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

app.get("/api/pos/cash-session", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const registerId = normalizeRegisterId(req.query?.registerId);
    res.json({ session: await readPosCashSession(registerId) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/cash-session/open", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const registerId = normalizeRegisterId(req.body?.registerId);
    const current = await readPosCashSession(registerId);
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
      registerId,
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
    void emitNeuralBusinessEvent("cash.opened", { session });
    res.json({ session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/cash-session/movement", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const registerId = normalizeRegisterId(req.body?.registerId);
    const session = await readPosCashSession(registerId);
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
    void emitNeuralBusinessEvent("cash.movement", { sessionId: next.id, movement: next.movements?.at(-1), expectedCash: next.expectedCash });
    res.json({ session: next });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/cash-session/close", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const registerId = normalizeRegisterId(req.body?.registerId);
    const session = await readPosCashSession(registerId);
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
    void emitNeuralBusinessEvent("cash.closed", { session: closed, difference });
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


app.post("/api/admin/inventory/locations", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { inventoryLocations: [{ id: "tienda", name: "Tienda", active: true }], inventoryLocationStock: {}, inventoryTransfers: [] };
    const current = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const name = cleanText(req.body?.name, 120);
    if (!name) return res.status(400).json({ error: "La ubicación necesita un nombre" });
    const id = String(req.body?.id || name).trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || crypto.randomUUID();
    if ((current.inventoryLocations || []).some((item) => item.id === id)) return res.status(409).json({ error: "Ya existe esa ubicación" });
    const location = { id, name, active: true, createdAt: new Date().toISOString() };
    current.inventoryLocations = [...(current.inventoryLocations || []), location];
    await upsertStorageValue("posOperations", JSON.stringify(current));
    res.json({ location, operations: sanitizePosOperations(current) });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo crear la ubicación" });
  }
});

app.post("/api/admin/inventory/location-stock", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { inventoryLocations: [{ id: "tienda", name: "Tienda", active: true }], inventoryLocationStock: {}, inventoryTransfers: [] };
    const current = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const productId = String(req.body?.productId || "").trim();
    const locationId = String(req.body?.locationId || "").trim();
    const stock = Math.max(0, Math.floor(Number(req.body?.stock || 0)));
    if (!productId || !locationId) return res.status(400).json({ error: "Producto y ubicación obligatorios" });
    if (!(current.inventoryLocations || []).some((item) => item.id === locationId && item.active !== false)) return res.status(404).json({ error: "Ubicación no encontrada" });
    current.inventoryLocationStock = {
      ...(current.inventoryLocationStock || {}),
      [productId]: {
        ...((current.inventoryLocationStock || {})[productId] || {}),
        [locationId]: stock,
      },
    };
    await upsertStorageValue("posOperations", JSON.stringify(current));
    res.json({ stock, operations: sanitizePosOperations(current) });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo actualizar el stock por ubicación" });
  }
});

app.post("/api/admin/inventory/transfers", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { inventoryLocations: [{ id: "tienda", name: "Tienda", active: true }], inventoryLocationStock: {}, inventoryTransfers: [] };
    const current = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const productId = String(req.body?.productId || "").trim();
    const from = String(req.body?.from || "").trim();
    const to = String(req.body?.to || "").trim();
    const quantity = Math.max(1, Math.floor(Number(req.body?.quantity || 0)));
    if (!productId || !from || !to || from === to) return res.status(400).json({ error: "Transferencia inválida" });
    const locations = current.inventoryLocations || [];
    if (!locations.some((item) => item.id === from) || !locations.some((item) => item.id === to)) return res.status(404).json({ error: "Ubicación no encontrada" });
    const productStock = { ...((current.inventoryLocationStock || {})[productId] || {}) };
    const available = Math.max(0, Math.floor(Number(productStock[from] || 0)));
    if (available < quantity) return res.status(409).json({ error: `Stock insuficiente en origen. Disponible: ${available}` });
    productStock[from] = available - quantity;
    productStock[to] = Math.max(0, Math.floor(Number(productStock[to] || 0))) + quantity;
    current.inventoryLocationStock = { ...(current.inventoryLocationStock || {}), [productId]: productStock };
    const transfer = { id: crypto.randomUUID(), productId, from, to, quantity, createdAt: new Date().toISOString() };
    current.inventoryTransfers = [transfer, ...(current.inventoryTransfers || [])].slice(0, 2000);
    await upsertStorageValue("posOperations", JSON.stringify(current));
    res.json({ transfer, operations: sanitizePosOperations(current) });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo transferir stock" });
  }
});


app.post("/api/admin/inventory/lots", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { inventoryLots: [] };
    const current = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const productId = String(req.body?.productId || "").trim();
    const lotCode = cleanText(req.body?.lotCode, 80);
    const quantity = Math.max(0, Math.floor(Number(req.body?.quantity || 0)));
    const expiresAt = String(req.body?.expiresAt || "").trim() || null;
    const receivedAt = String(req.body?.receivedAt || new Date().toISOString().slice(0,10));
    const locationId = String(req.body?.locationId || "tienda").trim();
    if (!productId || !lotCode || quantity <= 0) return res.status(400).json({ error: "Producto, lote y cantidad son obligatorios" });
    if ((current.inventoryLots || []).some((item) => item.productId === productId && item.lotCode === lotCode)) {
      return res.status(409).json({ error: "Ese lote ya existe para el producto" });
    }
    const lot = {
      id: crypto.randomUUID(),
      productId,
      lotCode,
      quantity,
      remaining: quantity,
      locationId,
      receivedAt,
      expiresAt,
      createdAt: new Date().toISOString(),
    };
    current.inventoryLots = [lot, ...(current.inventoryLots || [])].slice(0, 5000);
    await upsertStorageValue("posOperations", JSON.stringify(current));
    res.json({ lot, operations: sanitizePosOperations(current) });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo registrar el lote" });
  }
});

app.patch("/api/admin/inventory/lots/:id", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { inventoryLots: [] };
    const current = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const index = (current.inventoryLots || []).findIndex((item) => item.id === req.params.id);
    if (index < 0) return res.status(404).json({ error: "Lote no encontrado" });
    const previous = current.inventoryLots[index];
    const remaining = req.body?.remaining == null ? previous.remaining : Math.max(0, Math.floor(Number(req.body.remaining || 0)));
    const expiresAt = req.body?.expiresAt == null ? previous.expiresAt : (String(req.body.expiresAt || "").trim() || null);
    const locationId = req.body?.locationId == null ? previous.locationId : String(req.body.locationId || "").trim();
    current.inventoryLots[index] = { ...previous, remaining, expiresAt, locationId, updatedAt: new Date().toISOString() };
    await upsertStorageValue("posOperations", JSON.stringify(current));
    res.json({ lot: current.inventoryLots[index], operations: sanitizePosOperations(current) });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo actualizar el lote" });
  }
});

app.get("/api/pos/operations", requireAdmin, async (_req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], staffShifts: [], loyalty: {}, quotes: [], inventoryAdjustments: [], registers: [{ id: "caja-01", name: "Caja 01", active: true }] };
    const saved = parseStoredJson(await readStorageValue("posOperations"), defaults);
    const operations = { ...defaults, ...(saved || {}) };
    if (!Array.isArray(operations.registers) || !operations.registers.length) {
      operations.registers = defaults.registers;
    }
    res.json({ operations: sanitizePosOperations(operations) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/registers", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], staffShifts: [], loyalty: {}, quotes: [], inventoryAdjustments: [], registers: [{ id: "caja-01", name: "Caja 01", active: true }] };
    const operations = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "La caja necesita un nombre" });
    const requestedId = normalizeRegisterId(req.body?.id || name);
    if ((operations.registers || []).some((item) => String(item?.id) === requestedId)) {
      return res.status(409).json({ error: "Ya existe una caja con ese identificador" });
    }
    const register = { id: requestedId, name, active: true, createdAt: new Date().toISOString() };
    operations.registers = [...(operations.registers || []), register];
    await upsertStorageValue("posOperations", JSON.stringify(operations));
    res.json({ register, operations: sanitizePosOperations(operations) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/pos/operations", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], loyalty: {} };
    const current = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const next = { ...current, ...(req.body || {}) };
    await upsertStorageValue("posOperations", JSON.stringify(next));
    res.json({ operations: sanitizePosOperations(next) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/held-sales", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], staffShifts: [], loyalty: {}, quotes: [], inventoryAdjustments: [], registers: [{ id: "caja-01", name: "Caja 01", active: true }], heldSales: [] };
    const operations = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: "No hay artículos para aparcar" });

    const heldSale = {
      id: String(req.body?.id || crypto.randomUUID()),
      createdAt: req.body?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customer: normalizePosCustomer(req.body?.customer || {}),
      items,
      paymentMethod: String(req.body?.paymentMethod || "Efectivo"),
      documentType: req.body?.documentType === "invoice" ? "invoice" : "ticket",
      notes: String(req.body?.notes || ""),
      globalDiscount: Math.max(0, Math.min(100, Number(req.body?.globalDiscount || 0))),
      mixed: req.body?.mixed && typeof req.body.mixed === "object" ? req.body.mixed : null,
      registerId: normalizeRegisterId(req.body?.registerId),
      staff: {
        id: String(req.body?.staff?.id || "owner"),
        name: String(req.body?.staff?.name || "Propietario / administrador"),
        role: String(req.body?.staff?.role || "admin"),
      },
    };

    operations.heldSales = [
      heldSale,
      ...(Array.isArray(operations.heldSales) ? operations.heldSales : []).filter((item) => String(item?.id) !== heldSale.id),
    ].slice(0, 100);
    await upsertStorageValue("posOperations", JSON.stringify(operations));
    res.json({ heldSale, operations: sanitizePosOperations(operations) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/pos/held-sales/:id", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], staffShifts: [], loyalty: {}, quotes: [], inventoryAdjustments: [], registers: [{ id: "caja-01", name: "Caja 01", active: true }], heldSales: [] };
    const operations = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const id = String(req.params?.id || "").trim();
    const exists = (operations.heldSales || []).some((item) => String(item?.id) === id);
    if (!exists) return res.status(404).json({ error: "Venta aparcada no encontrada" });
    operations.heldSales = (operations.heldSales || []).filter((item) => String(item?.id) !== id);
    await upsertStorageValue("posOperations", JSON.stringify(operations));
    res.json({ ok: true, operations: sanitizePosOperations(operations) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/florist-orders", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], loyalty: {} };
    const current = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const total = normalizeMoney(req.body?.total);
    const deposit = normalizeMoney(req.body?.deposit);
    if (total <= 0) return res.status(400).json({ error: "El encargo necesita un total válido" });
    if (deposit < 0 || deposit > total) return res.status(400).json({ error: "Anticipo inválido" });
    const order = {
      id: crypto.randomUUID(),
      customerName: String(req.body?.customerName || "Cliente mostrador").trim(),
      customerPhone: String(req.body?.customerPhone || "").trim(),
      concept: String(req.body?.concept || "Encargo floral").trim(),
      dedication: String(req.body?.dedication || "").trim(),
      deliveryAddress: String(req.body?.deliveryAddress || "").trim(),
      dueAt: req.body?.dueAt || null,
      assignedTo: String(req.body?.assignedTo || "").trim(),
      total,
      deposit,
      pending: normalizeMoney(total - deposit),
      status: String(req.body?.status || "pendiente"),
      createdAt: new Date().toISOString(),
    };
    current.floristOrders = [order, ...(Array.isArray(current.floristOrders) ? current.floristOrders : [])];
    await upsertStorageValue("posOperations", JSON.stringify(current));
    res.json({ order, operations: sanitizePosOperations(current) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/gift-cards", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], loyalty: {} };
    const current = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const amount = normalizeMoney(req.body?.amount);
    if (amount <= 0) return res.status(400).json({ error: "El saldo debe ser mayor que 0" });
    const code = String(req.body?.code || `HER-${crypto.randomUUID().slice(0, 8).toUpperCase()}`).trim().toUpperCase();
    if ((current.giftCards || []).some((card) => card.code === code)) return res.status(409).json({ error: "Ese código ya existe" });
    const card = { id: crypto.randomUUID(), code, initialBalance: amount, balance: amount, active: true, createdAt: new Date().toISOString() };
    current.giftCards = [card, ...(Array.isArray(current.giftCards) ? current.giftCards : [])];
    await upsertStorageValue("posOperations", JSON.stringify(current));
    res.json({ card, operations: sanitizePosOperations(current) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/pos/florist-orders/:id", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], loyalty: {} };
    const current = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const id = String(req.params?.id || "").trim();
    const index = (current.floristOrders || []).findIndex((item) => String(item?.id) === id);
    if (index < 0) return res.status(404).json({ error: "Encargo no encontrado" });
    const previous = current.floristOrders[index];
    const total = req.body?.total == null ? Number(previous.total || 0) : normalizeMoney(req.body.total);
    const deposit = req.body?.deposit == null ? Number(previous.deposit || 0) : normalizeMoney(req.body.deposit);
    if (total <= 0 || deposit < 0 || deposit > total) return res.status(400).json({ error: "Importes del encargo inválidos" });
    const updated = {
      ...previous,
      ...(req.body || {}),
      id,
      total,
      deposit,
      pending: normalizeMoney(total - deposit),
      updatedAt: new Date().toISOString(),
    };
    current.floristOrders = current.floristOrders.map((item, itemIndex) => itemIndex === index ? updated : item);
    await upsertStorageValue("posOperations", JSON.stringify(current));
    res.json({ order: updated, operations: sanitizePosOperations(current) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/gift-cards/redeem", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], loyalty: {} };
    const current = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const code = String(req.body?.code || "").trim().toUpperCase();
    const amount = normalizeMoney(req.body?.amount);
    if (!code || amount <= 0) return res.status(400).json({ error: "Código e importe válidos son obligatorios" });
    const index = (current.giftCards || []).findIndex((card) => String(card?.code || "").toUpperCase() === code);
    if (index < 0) return res.status(404).json({ error: "Tarjeta regalo no encontrada" });
    const card = current.giftCards[index];
    if (card.active === false) return res.status(409).json({ error: "La tarjeta regalo está desactivada" });
    if (Number(card.balance || 0) < amount) return res.status(409).json({ error: "Saldo insuficiente" });
    const nextCard = {
      ...card,
      balance: normalizeMoney(Number(card.balance || 0) - amount),
      updatedAt: new Date().toISOString(),
      active: normalizeMoney(Number(card.balance || 0) - amount) > 0,
    };
    current.giftCards = current.giftCards.map((item, itemIndex) => itemIndex === index ? nextCard : item);
    await upsertStorageValue("posOperations", JSON.stringify(current));
    res.json({ card: nextCard, operations: sanitizePosOperations(current) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/suppliers", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], loyalty: {} };
    const current = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const supplier = {
      id: String(req.body?.id || crypto.randomUUID()),
      name: String(req.body?.name || "").trim(),
      nif: String(req.body?.nif || "").trim(),
      email: String(req.body?.email || "").trim(),
      phone: String(req.body?.phone || "").trim(),
      notes: String(req.body?.notes || "").trim(),
      active: req.body?.active !== false,
      updatedAt: new Date().toISOString(),
    };
    if (!supplier.name) return res.status(400).json({ error: "El proveedor necesita un nombre" });
    if (supplier.email && !isValidEmail(supplier.email)) return res.status(400).json({ error: "Email de proveedor inválido" });
    current.suppliers = [supplier, ...(current.suppliers || []).filter((item) => String(item?.id) !== supplier.id)];
    await upsertStorageValue("posOperations", JSON.stringify(current));
    res.json({ supplier, operations: sanitizePosOperations(current) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/purchases", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], loyalty: {} };
    const current = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const bootstrap = await loadPosBootstrap();
    const requested = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!requested.length) return res.status(400).json({ error: "Añade productos a la compra" });

    const quantities = new Map();
    const purchaseLines = [];
    for (const raw of requested) {
      const id = String(raw?.id || "").trim();
      const qty = Math.max(0, Math.floor(Number(raw?.quantity ?? raw?.qty ?? 0)));
      const unitCost = normalizeMoney(raw?.unitCost);
      const product = bootstrap.products.find((item) => String(item?.id) === id);
      if (!product || qty <= 0) return res.status(400).json({ error: `Producto o cantidad inválida: ${id || "sin id"}` });
      quantities.set(id, (quantities.get(id) || 0) + qty);
      purchaseLines.push({
        id,
        name: String(product.name || "Producto"),
        sku: String(product.sku || ""),
        quantity: qty,
        unitCost,
        totalCost: normalizeMoney(qty * unitCost),
      });
    }

    const updatedProducts = bootstrap.products.map((product) => {
      const qty = quantities.get(String(product?.id || "")) || 0;
      return qty ? { ...product, stock: Math.max(0, Number(product.stock || 0)) + qty } : product;
    });
    await upsertStorageValue("adminProducts", JSON.stringify(updatedProducts));
    void notifyWaitlistForRestockedProducts(bootstrap.products, updatedProducts).catch((error) => console.warn("Waitlist restock notify:", error?.message || error));
    void evaluateInventoryAutomations(updatedProducts).catch((error) => console.warn("Automations purchase stock check:", error?.message || error));

    const purchase = {
      id: crypto.randomUUID(),
      supplierId: String(req.body?.supplierId || "").trim(),
      reference: String(req.body?.reference || "").trim(),
      items: purchaseLines,
      total: normalizeMoney(purchaseLines.reduce((sum, line) => sum + Number(line.totalCost || 0), 0)),
      staff: {
        id: String(req.body?.staff?.id || "owner"),
        name: String(req.body?.staff?.name || "Propietario / administrador"),
        role: String(req.body?.staff?.role || "admin"),
      },
      createdAt: new Date().toISOString(),
    };
    current.purchases = [purchase, ...(Array.isArray(current.purchases) ? current.purchases : [])];
    await upsertStorageValue("posOperations", JSON.stringify(current));
    res.json({ purchase, inventory: updatedProducts, operations: sanitizePosOperations(current) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/staff", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], loyalty: {} };
    const current = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const name = String(req.body?.name || "").trim();
    const role = ["admin", "manager", "seller"].includes(String(req.body?.role || "")) ? String(req.body.role) : "seller";
    const pin = String(req.body?.pin || "").trim();
    if (!name) return res.status(400).json({ error: "El empleado necesita un nombre" });
    if (!/^\d{4,8}$/.test(pin)) return res.status(400).json({ error: "El PIN debe tener entre 4 y 8 dígitos" });
    const salt = crypto.randomBytes(16).toString("hex");
    const pinHash = crypto.scryptSync(pin, salt, 32).toString("hex");
    const permissionsByRole = {
      admin: ["sell", "discount", "refund", "cash", "inventory", "settings"],
      manager: ["sell", "discount", "refund", "cash", "inventory"],
      seller: ["sell"],
    };
    const staff = {
      id: crypto.randomUUID(),
      name,
      role,
      permissions: permissionsByRole[role],
      pinSalt: salt,
      pinHash,
      active: true,
      createdAt: new Date().toISOString(),
    };
    current.staff = [staff, ...(Array.isArray(current.staff) ? current.staff : [])];
    await upsertStorageValue("posOperations", JSON.stringify(current));
    const { pinHash: _hash, pinSalt: _salt, ...safeStaff } = staff;
    res.json({ staff: safeStaff, operations: { ...current, staff: current.staff.map(({ pinHash, pinSalt, ...item }) => item) } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/staff/unlock", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], loyalty: {} };
    const current = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const pin = String(req.body?.pin || "").trim();
    const match = (current.staff || []).find((staff) => {
      if (staff?.active === false || !staff?.pinSalt || !staff?.pinHash) return false;
      const candidate = crypto.scryptSync(pin, staff.pinSalt, 32).toString("hex");
      const left = Buffer.from(candidate, "hex");
      const right = Buffer.from(staff.pinHash, "hex");
      return left.length === right.length && crypto.timingSafeEqual(left, right);
    });
    if (!match) return res.status(401).json({ error: "PIN incorrecto" });
    const { pinHash, pinSalt, ...safeStaff } = match;
    res.json({ staff: safeStaff });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/staff-shifts/start", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], staffShifts: [], loyalty: {}, quotes: [], inventoryAdjustments: [] };
    const operations = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const staffId = String(req.body?.staffId || "").trim();
    const staff = (operations.staff || []).find((item) => String(item?.id) === staffId && item?.active !== false);
    if (!staff) return res.status(404).json({ error: "Empleado no encontrado" });
    const openShift = (operations.staffShifts || []).find((item) => String(item?.staffId) === staffId && !item?.endedAt);
    if (openShift) return res.status(409).json({ error: "Este empleado ya tiene un turno abierto" });
    const shift = {
      id: crypto.randomUUID(),
      staffId,
      staffName: String(staff.name || "Empleado"),
      role: String(staff.role || "seller"),
      startedAt: new Date().toISOString(),
      endedAt: null,
      durationMinutes: null,
    };
    operations.staffShifts = [shift, ...(Array.isArray(operations.staffShifts) ? operations.staffShifts : [])].slice(0, 1000);
    await upsertStorageValue("posOperations", JSON.stringify(operations));
    res.json({ shift, operations: sanitizePosOperations(operations) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/staff-shifts/end", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], staffShifts: [], loyalty: {}, quotes: [], inventoryAdjustments: [] };
    const operations = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const staffId = String(req.body?.staffId || "").trim();
    const index = (operations.staffShifts || []).findIndex((item) => String(item?.staffId) === staffId && !item?.endedAt);
    if (index < 0) return res.status(404).json({ error: "No hay un turno abierto para este empleado" });
    const previous = operations.staffShifts[index];
    const endedAt = new Date();
    const durationMinutes = Math.max(0, Math.round((endedAt.getTime() - new Date(previous.startedAt).getTime()) / 60000));
    const shift = { ...previous, endedAt: endedAt.toISOString(), durationMinutes };
    operations.staffShifts = operations.staffShifts.map((item, itemIndex) => itemIndex === index ? shift : item);
    await upsertStorageValue("posOperations", JSON.stringify(operations));
    res.json({ shift, operations: sanitizePosOperations(operations) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/loyalty/adjust", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], loyalty: {} };
    const current = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const customerId = String(req.body?.customerId || "").trim();
    const delta = Math.trunc(Number(req.body?.delta || 0));
    if (!customerId || !Number.isFinite(delta) || delta === 0) return res.status(400).json({ error: "Cliente y puntos son obligatorios" });
    const previous = Number(current.loyalty?.[customerId]?.points || 0);
    const entry = {
      points: Math.max(0, previous + delta),
      updatedAt: new Date().toISOString(),
    };
    current.loyalty = { ...(current.loyalty || {}), [customerId]: entry };
    await upsertStorageValue("posOperations", JSON.stringify(current));
    res.json({ loyalty: entry, operations: sanitizePosOperations(current) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/quotes", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], loyalty: {}, quotes: [] };
    const current = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const bootstrap = await loadPosBootstrap();
    const customer = normalizePosCustomer(req.body?.customer || {});
    const prepared = validateAndApplyStock(bootstrap.products, req.body?.items || []);
    const totals = calculatePosTotals(prepared.items);
    const now = new Date();
    const expiresAt = req.body?.expiresAt || new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();
    const quote = {
      id: crypto.randomUUID(),
      quoteNumber: `PRE-${now.getFullYear()}-${String(Date.now()).slice(-8)}`,
      customer,
      items: prepared.items,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      notes: String(req.body?.notes || "").trim(),
      status: "draft",
      createdAt: now.toISOString(),
      expiresAt,
    };
    current.quotes = [quote, ...(Array.isArray(current.quotes) ? current.quotes : [])].slice(0, 100);
    await upsertStorageValue("posOperations", JSON.stringify(current));
    res.json({ quote, operations: sanitizePosOperations(current) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/pos/quotes/:id", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], loyalty: {}, quotes: [] };
    const current = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const id = String(req.params?.id || "").trim();
    const index = (current.quotes || []).findIndex((item) => String(item?.id) === id);
    if (index < 0) return res.status(404).json({ error: "Presupuesto no encontrado" });
    const updated = { ...current.quotes[index], ...(req.body || {}), id, updatedAt: new Date().toISOString() };
    current.quotes = current.quotes.map((item, itemIndex) => itemIndex === index ? updated : item);
    await upsertStorageValue("posOperations", JSON.stringify(current));
    res.json({ quote: updated, operations: sanitizePosOperations(current) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/inventory-adjustments", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const bootstrap = await loadPosBootstrap();
    const productId = String(req.body?.productId || "").trim();
    const type = ["count", "waste", "breakage", "manual"].includes(String(req.body?.type || ""))
      ? String(req.body.type)
      : "manual";
    const reason = String(req.body?.reason || "").trim();
    const product = bootstrap.products.find((item) => String(item?.id) === productId);
    if (!product) return res.status(404).json({ error: "Producto no encontrado" });

    const before = Math.max(0, Math.floor(Number(product.stock || 0)));
    let after = before;
    if (req.body?.countedStock != null) {
      const counted = Math.floor(Number(req.body.countedStock));
      if (!Number.isFinite(counted) || counted < 0) return res.status(400).json({ error: "Stock contado inválido" });
      after = counted;
    } else {
      const delta = Math.trunc(Number(req.body?.delta || 0));
      if (!Number.isFinite(delta) || delta === 0) return res.status(400).json({ error: "Ajuste de stock inválido" });
      after = Math.max(0, before + delta);
    }

    const updatedProducts = bootstrap.products.map((item) =>
      String(item?.id) === productId ? { ...item, stock: after } : item
    );
    await upsertStorageValue("adminProducts", JSON.stringify(updatedProducts));
    void notifyWaitlistForRestockedProducts(bootstrap.products, updatedProducts).catch((error) => console.warn("Waitlist restock notify:", error?.message || error));
    void evaluateInventoryAutomations(updatedProducts).catch((error) => console.warn("Automations stock check:", error?.message || error));

    const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], loyalty: {}, quotes: [], inventoryAdjustments: [] };
    const operations = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const adjustment = {
      id: crypto.randomUUID(),
      productId,
      productName: String(product.name || "Producto"),
      sku: String(product.sku || ""),
      type,
      reason,
      before,
      after,
      delta: after - before,
      staff: {
        id: String(req.body?.staff?.id || "owner"),
        name: String(req.body?.staff?.name || "Propietario / administrador"),
        role: String(req.body?.staff?.role || "admin"),
      },
      createdAt: new Date().toISOString(),
    };
    operations.inventoryAdjustments = [adjustment, ...(Array.isArray(operations.inventoryAdjustments) ? operations.inventoryAdjustments : [])].slice(0, 500);
    await upsertStorageValue("posOperations", JSON.stringify(operations));

    res.json({ adjustment, inventory: updatedProducts, operations: sanitizePosOperations(operations) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/pos/reports/summary", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const now = new Date();
    const fromRaw = String(req.query?.from || "").trim();
    const toRaw = String(req.query?.to || "").trim();
    const from = fromRaw ? new Date(fromRaw) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = toRaw ? new Date(toRaw) : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return res.status(400).json({ error: "Rango de fechas inválido" });

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("delivery_method", "mostrador")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;

    const orders = (data || []).filter((order) => {
      const at = new Date(order.created_at || 0).getTime();
      return at >= from.getTime() && at < to.getTime();
    });

    const completed = orders.filter((order) => order.status !== "refunded" && order.status !== "payment_error" && order.status !== "payment_pending");
    const refunded = orders.filter((order) => order.status === "refunded");
    const revenue = normalizeMoney(completed.reduce((sum, order) => sum + Number(order.total || 0), 0));
    const refundedTotal = normalizeMoney(refunded.reduce((sum, order) => sum + Number(order.total || 0), 0));
    const tax = normalizeMoney(completed.reduce((sum, order) => sum + Number(order.metadata?.tax || 0), 0));
    const byPayment = {};
    const products = new Map();

    for (const order of completed) {
      const method = normalizePaymentMethod(order.payment_method);
      byPayment[method] = normalizeMoney(Number(byPayment[method] || 0) + Number(order.total || 0));
      for (const item of Array.isArray(order.items) ? order.items : []) {
        const key = String(item?.id || item?.name || "sin-id");
        const qty = Math.max(0, Math.floor(Number(item?.quantity ?? item?.qty ?? 0)));
        const lineTotal = normalizeMoney(Number(item?.price || 0) * qty * (1 - Math.max(0, Math.min(100, Number(item?.discountPercent || 0))) / 100));
        const current = products.get(key) || { id: key, name: String(item?.name || "Artículo"), units: 0, revenue: 0 };
        current.units += qty;
        current.revenue = normalizeMoney(current.revenue + lineTotal);
        products.set(key, current);
      }
    }

    const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], loyalty: {}, quotes: [], inventoryAdjustments: [] };
    const operations = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
    const report = {
      from: from.toISOString(),
      to: to.toISOString(),
      transactions: completed.length,
      refunds: refunded.length,
      revenue,
      refundedTotal,
      netRevenue: normalizeMoney(revenue - refundedTotal),
      tax,
      averageTicket: completed.length ? normalizeMoney(revenue / completed.length) : 0,
      byPayment,
      topProducts: Array.from(products.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      pendingFloristOrders: (operations.floristOrders || []).filter((item) => !["entregado", "cancelado"].includes(String(item?.status || ""))).length,
      inventoryAdjustments: (operations.inventoryAdjustments || []).filter((item) => {
        const at = new Date(item?.createdAt || 0).getTime();
        return at >= from.getTime() && at < to.getTime();
      }).length,
    };

    res.json({ report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/pos/sales", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query?.limit || 50)));
    const query = String(req.query?.q || "").trim().toLowerCase();
    const fetchLimit = query ? 500 : limit;
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .in("delivery_method", ["mostrador"])
      .order("created_at", { ascending: false })
      .limit(fetchLimit);
    if (error) throw error;

    const filtered = query
      ? (data || []).filter((order) => {
          const haystack = [
            order.id,
            order.customer_name,
            order.customer_email,
            order.metadata?.invoiceNumber,
            order.payment_method,
          ].map((value) => String(value || "").toLowerCase()).join(" ");
          return haystack.includes(query);
        }).slice(0, limit)
      : (data || []);

    res.json({ sales: filtered.map(posOrderResponse) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/refund", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;

  try {
    const orderId = String(req.body?.orderId || "").trim();
    const reason = String(req.body?.reason || "Devolución TPV").trim();
    const refundStaff = {
      id: String(req.body?.staff?.id || "owner").trim(),
      name: String(req.body?.staff?.name || "Propietario / administrador").trim(),
      role: String(req.body?.staff?.role || "admin").trim(),
    };
    if (!orderId) return res.status(400).json({ error: "Falta el identificador de la venta" });

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return res.status(404).json({ error: "Venta no encontrada" });
    if (order?.metadata?.refundedAt || order.status === "refunded") {
      return res.status(409).json({ error: "Esta venta ya está devuelta" });
    }
    if (Array.isArray(order?.metadata?.refunds) && order.metadata.refunds.length > 0) {
      return res.status(409).json({ error: "Esta venta ya tiene devoluciones parciales. Devuelve únicamente las unidades restantes." });
    }
    if (order.delivery_method !== "mostrador") {
      return res.status(400).json({ error: "La devolución TPV solo admite ventas de mostrador" });
    }

    const orderPaymentMethod = normalizePaymentMethod(order.payment_method);
    const paymentBreakdown = Array.isArray(order.metadata?.paymentBreakdown) ? order.metadata.paymentBreakdown : [];
    const cashRefundAmount = orderPaymentMethod === "cash"
      ? normalizeMoney(order.total)
      : orderPaymentMethod === "mixed"
      ? normalizeMoney(paymentBreakdown.filter((entry) => normalizePaymentMethod(entry?.method) === "cash").reduce((sum, entry) => sum + Number(entry?.amount || 0), 0))
      : 0;
    const cardRefundAmount = orderPaymentMethod === "card"
      ? normalizeMoney(order.total)
      : orderPaymentMethod === "mixed"
      ? normalizeMoney(paymentBreakdown.filter((entry) => normalizePaymentMethod(entry?.method) === "card").reduce((sum, entry) => sum + Number(entry?.amount || 0), 0))
      : 0;
    const giftRefunds = paymentBreakdown.filter((entry) => normalizePaymentMethod(entry?.method) === "gift_card");

    let stripeRefundId = "";
    if (cardRefundAmount > 0) {
      if (!stripe) return res.status(503).json({ error: "Stripe no está configurado para devolver la parte de tarjeta" });
      const paymentIntentId = orderPaymentMethod === "card"
        ? String(order.stripe_payment_intent_id || "")
        : String(order.metadata?.mixedCardPaymentIntentId || "");
      if (!paymentIntentId) {
        return res.status(409).json({ error: "No se encontró el pago de Stripe asociado a esta venta" });
      }
      const stripeRefund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: Math.round(cardRefundAmount * 100),
        metadata: { orderId, source: "TPV_REFUND" },
      });
      stripeRefundId = stripeRefund.id;
    }

    const bootstrap = await loadPosBootstrap();
    const items = Array.isArray(order.items) ? order.items : [];
    const quantities = new Map();
    for (const item of items) {
      if (item?.manual === true) continue;
      const id = String(item?.id || "").trim();
      const qty = Math.max(0, Math.floor(Number(item?.quantity ?? item?.qty ?? 0)));
      if (id && qty > 0) quantities.set(id, (quantities.get(id) || 0) + qty);
    }

    const restoredProducts = bootstrap.products.map((product) => {
      const qty = quantities.get(String(product?.id || "")) || 0;
      return qty ? { ...product, stock: Math.max(0, Number(product.stock || 0)) + qty } : product;
    });

    await upsertStorageValue("adminProducts", JSON.stringify(restoredProducts));

    const refundNumber = `REF-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}`;
    const refundedAt = new Date().toISOString();
    const metadata = {
      ...(order.metadata || {}),
      refundedAt,
      refundReason: reason,
      refundNumber,
      stripeRefundId: stripeRefundId || undefined,
      refundedBy: refundStaff,
    };

    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({ status: "refunded", metadata })
      .eq("id", orderId)
      .select("*")
      .single();
    if (updateError) throw updateError;

    const loyaltyCustomerId = String(order.metadata?.customerId || "").trim();
    const loyaltyPointsEarned = Math.max(0, Math.floor(Number(order.metadata?.loyaltyPointsEarned || 0)));
    if ((loyaltyCustomerId && loyaltyPointsEarned > 0) || giftRefunds.length) {
      const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], loyalty: {}, quotes: [] };
      let posOperations = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };

      if (giftRefunds.length) {
        const refundsByCode = new Map();
        for (const entry of giftRefunds) {
          const code = String(entry?.code || "").trim().toUpperCase();
          const amount = normalizeMoney(entry?.amount);
          if (code && amount > 0) refundsByCode.set(code, normalizeMoney((refundsByCode.get(code) || 0) + amount));
        }
        posOperations = {
          ...posOperations,
          giftCards: (posOperations.giftCards || []).map((card) => {
            const code = String(card?.code || "").toUpperCase();
            const amount = refundsByCode.get(code) || 0;
            if (!amount) return card;
            return {
              ...card,
              balance: normalizeMoney(Number(card.balance || 0) + amount),
              active: true,
              updatedAt: refundedAt,
            };
          }),
        };
      }

      if (loyaltyCustomerId && loyaltyPointsEarned > 0) {
        const previousPoints = Number(posOperations.loyalty?.[loyaltyCustomerId]?.points || 0);
        posOperations = {
          ...posOperations,
          loyalty: {
            ...(posOperations.loyalty || {}),
            [loyaltyCustomerId]: {
              points: Math.max(0, previousPoints - loyaltyPointsEarned),
              updatedAt: refundedAt,
              lastRefundOrderId: orderId,
            },
          },
        };
      }

      await upsertStorageValue("posOperations", JSON.stringify(posOperations));
    }

    if (cashRefundAmount > 0) {
      const registerId = normalizeRegisterId(order.metadata?.registerId);
      const session = await readPosCashSession(registerId);
      if (session?.status === "open") {
        const amount = cashRefundAmount;
        const next = {
          ...session,
          cashSales: normalizeMoney(Math.max(0, Number(session.cashSales || 0) - amount)),
          cashOut: normalizeMoney(Number(session.cashOut || 0) + amount),
          expectedCash: normalizeMoney(Number(session.expectedCash || 0) - amount),
          movements: [
            ...(Array.isArray(session.movements) ? session.movements : []),
            {
              id: crypto.randomUUID(),
              type: "refund",
              amount,
              note: `${refundNumber}: ${reason}`,
              orderId,
              createdAt: refundedAt,
            },
          ],
        };
        await writePosCashSession(next, registerId);
      }
    }

    broadcastAdminOrderEvent(updated, "order_refunded");
    res.json({
      ok: true,
      order: posOrderResponse(updated),
      inventory: restoredProducts,
      refundNumber,
      stripeRefundId: stripeRefundId || null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pos/refund-partial", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;

  try {
    const orderId = String(req.body?.orderId || "").trim();
    const requestedItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const reason = String(req.body?.reason || "Devolución parcial TPV").trim();
    const refundStaff = {
      id: String(req.body?.staff?.id || "owner").trim(),
      name: String(req.body?.staff?.name || "Propietario / administrador").trim(),
      role: String(req.body?.staff?.role || "admin").trim(),
    };

    if (!orderId) return res.status(400).json({ error: "Falta el identificador de la venta" });
    if (!requestedItems.length) return res.status(400).json({ error: "Selecciona al menos un artículo para devolver" });

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return res.status(404).json({ error: "Venta no encontrada" });
    if (order.delivery_method !== "mostrador") return res.status(400).json({ error: "La devolución parcial solo admite ventas de mostrador" });
    if (order?.metadata?.refundedAt || order.status === "refunded") return res.status(409).json({ error: "Esta venta ya está devuelta por completo" });

    const originalItems = Array.isArray(order.items) ? order.items : [];
    const previousRefunds = Array.isArray(order.metadata?.refunds) ? order.metadata.refunds : [];
    const alreadyRefundedById = new Map();

    for (const refund of previousRefunds) {
      for (const item of Array.isArray(refund?.items) ? refund.items : []) {
        const id = String(item?.id || "").trim();
        const qty = Math.max(0, Math.floor(Number(item?.quantity ?? item?.qty ?? 0)));
        if (id && qty) alreadyRefundedById.set(id, (alreadyRefundedById.get(id) || 0) + qty);
      }
    }

    const refundItems = [];
    let refundTotal = 0;
    let refundSubtotal = 0;
    const stockRestoreById = new Map();

    for (const requested of requestedItems) {
      const id = String(requested?.id || "").trim();
      const qty = Math.max(0, Math.floor(Number(requested?.quantity ?? requested?.qty ?? 0)));
      if (!id || qty <= 0) return res.status(400).json({ error: "Artículo o cantidad de devolución inválida" });

      const original = originalItems.find((item) => String(item?.id || "") === id);
      if (!original) return res.status(400).json({ error: `El artículo ${id} no pertenece a la venta` });

      const soldQty = Math.max(0, Math.floor(Number(original?.quantity ?? original?.qty ?? 0)));
      const alreadyRefunded = Number(alreadyRefundedById.get(id) || 0);
      const remainingQty = Math.max(0, soldQty - alreadyRefunded);
      if (qty > remainingQty) {
        return res.status(409).json({ error: `Solo quedan ${remainingQty} uds. por devolver de ${original.name || id}` });
      }

      const price = Math.max(0, Number(original.price || 0));
      const iva = Math.max(0, Number(original.iva || 0));
      const discountPercent = Math.max(0, Math.min(100, Number(original.discountPercent || 0)));
      const lineTotal = normalizeMoney(price * qty * (1 - discountPercent / 100));
      const lineSubtotal = normalizeMoney(lineTotal / (1 + iva / 100));

      refundTotal = normalizeMoney(refundTotal + lineTotal);
      refundSubtotal = normalizeMoney(refundSubtotal + lineSubtotal);
      refundItems.push({
        id,
        name: String(original.name || "Artículo"),
        sku: String(original.sku || ""),
        price,
        iva,
        discountPercent,
        quantity: qty,
        qty,
        manual: original.manual === true,
        refundTotal: lineTotal,
      });

      if (original.manual !== true) {
        stockRestoreById.set(id, (stockRestoreById.get(id) || 0) + qty);
      }
    }

    if (refundTotal <= 0) return res.status(400).json({ error: "El importe de la devolución debe ser mayor que 0" });

    const originalTotal = normalizeMoney(order.total);
    const previouslyRefundedTotal = normalizeMoney(previousRefunds.reduce((sum, refund) => sum + Number(refund?.total || 0), 0));
    const remainingRefundable = normalizeMoney(Math.max(0, originalTotal - previouslyRefundedTotal));
    if (refundTotal > remainingRefundable + 0.01) {
      return res.status(409).json({ error: "La devolución supera el importe pendiente de la venta" });
    }

    const orderPaymentMethod = normalizePaymentMethod(order.payment_method);
    const originalBreakdown = orderPaymentMethod === "mixed"
      ? (Array.isArray(order.metadata?.paymentBreakdown) ? order.metadata.paymentBreakdown : [])
      : [{ method: orderPaymentMethod, amount: originalTotal }];

    const refundedByMethod = new Map();
    for (const refund of previousRefunds) {
      for (const payment of Array.isArray(refund?.paymentBreakdown) ? refund.paymentBreakdown : []) {
        const method = normalizePaymentMethod(payment?.method);
        const amount = normalizeMoney(payment?.amount);
        const code = String(payment?.code || "").trim().toUpperCase();
        const key = `${method}|${code}`;
        refundedByMethod.set(key, normalizeMoney((refundedByMethod.get(key) || 0) + amount));
      }
    }

    const remainingPayments = originalBreakdown.map((entry) => {
      const method = normalizePaymentMethod(entry?.method);
      const code = String(entry?.code || "").trim().toUpperCase();
      const key = `${method}|${code}`;
      return {
        method,
        code,
        amount: normalizeMoney(entry?.amount),
        remaining: normalizeMoney(Math.max(0, Number(entry?.amount || 0) - Number(refundedByMethod.get(key) || 0))),
      };
    }).filter((entry) => entry.remaining > 0);

    const remainingPaymentTotal = normalizeMoney(remainingPayments.reduce((sum, entry) => sum + entry.remaining, 0));
    if (remainingPaymentTotal + 0.01 < refundTotal) {
      return res.status(409).json({ error: "No queda suficiente importe en los métodos de pago originales para devolver" });
    }

    let centsLeft = Math.round(refundTotal * 100);
    let remainingWeightCents = Math.max(1, Math.round(remainingPaymentTotal * 100));
    const refundPaymentBreakdown = [];

    remainingPayments.forEach((entry, index) => {
      if (centsLeft <= 0) return;
      const capacityCents = Math.round(entry.remaining * 100);
      let allocationCents;
      if (index === remainingPayments.length - 1) {
        allocationCents = Math.min(centsLeft, capacityCents);
      } else {
        allocationCents = Math.min(
          capacityCents,
          Math.max(0, Math.round(centsLeft * (capacityCents / remainingWeightCents)))
        );
      }
      if (allocationCents > 0) {
        refundPaymentBreakdown.push({
          method: entry.method,
          amount: allocationCents / 100,
          ...(entry.code ? { code: entry.code } : {}),
        });
        centsLeft -= allocationCents;
      }
      remainingWeightCents -= capacityCents;
    });

    if (centsLeft > 0) {
      for (const entry of remainingPayments) {
        if (centsLeft <= 0) break;
        const allocated = refundPaymentBreakdown
          .filter((payment) => payment.method === entry.method && String(payment.code || "") === entry.code)
          .reduce((sum, payment) => sum + Math.round(Number(payment.amount || 0) * 100), 0);
        const spare = Math.max(0, Math.round(entry.remaining * 100) - allocated);
        const add = Math.min(spare, centsLeft);
        if (!add) continue;
        const existing = refundPaymentBreakdown.find((payment) => payment.method === entry.method && String(payment.code || "") === entry.code);
        if (existing) existing.amount = normalizeMoney(Number(existing.amount || 0) + add / 100);
        else refundPaymentBreakdown.push({ method: entry.method, amount: add / 100, ...(entry.code ? { code: entry.code } : {}) });
        centsLeft -= add;
      }
    }

    if (centsLeft !== 0) return res.status(500).json({ error: "No se pudo distribuir el importe de la devolución entre los pagos originales" });

    const cashRefundAmount = normalizeMoney(refundPaymentBreakdown.filter((entry) => entry.method === "cash").reduce((sum, entry) => sum + Number(entry.amount || 0), 0));
    const cardRefundAmount = normalizeMoney(refundPaymentBreakdown.filter((entry) => entry.method === "card").reduce((sum, entry) => sum + Number(entry.amount || 0), 0));
    const giftRefunds = refundPaymentBreakdown.filter((entry) => entry.method === "gift_card");
    const manualRefunds = refundPaymentBreakdown.filter((entry) => entry.method === "bizum" || entry.method === "transfer");

    const registerId = normalizeRegisterId(order.metadata?.registerId);
    let cashSession = null;
    if (cashRefundAmount > 0) {
      cashSession = await readPosCashSession(registerId);
      if (!cashSession || cashSession.status !== "open") {
        return res.status(409).json({ error: "Abre la caja original antes de hacer una devolución parcial en efectivo" });
      }
      if (Number(cashSession.expectedCash || 0) + 0.001 < cashRefundAmount) {
        return res.status(409).json({ error: "No hay suficiente efectivo esperado en la caja para esta devolución" });
      }
    }

    const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], staffShifts: [], loyalty: {}, quotes: [], inventoryAdjustments: [], registers: [{ id: "caja-01", name: "Caja 01", active: true }], heldSales: [] };
    const operations = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };

    if (giftRefunds.length) {
      const giftByCode = new Map();
      for (const entry of giftRefunds) {
        const code = String(entry.code || "").trim().toUpperCase();
        if (!code) return res.status(409).json({ error: "La venta no conserva el código de una tarjeta regalo utilizada" });
        giftByCode.set(code, normalizeMoney((giftByCode.get(code) || 0) + Number(entry.amount || 0)));
      }
      for (const [code] of giftByCode.entries()) {
        if (!(operations.giftCards || []).some((card) => String(card?.code || "").toUpperCase() === code)) {
          return res.status(409).json({ error: `Tarjeta regalo no encontrada: ${code}` });
        }
      }
    }

    const refundSequence = previousRefunds.length + 1;
    const refundNumber = `REF-${new Date().getFullYear()}-${String(Date.now()).slice(-8)}-${refundSequence}`;
    const refundedAt = new Date().toISOString();
    let stripeRefundId = "";

    if (cardRefundAmount > 0) {
      if (!stripe) return res.status(503).json({ error: "Stripe no está configurado para devolver la parte de tarjeta" });
      const paymentIntentId = orderPaymentMethod === "card"
        ? String(order.stripe_payment_intent_id || "")
        : String(order.metadata?.mixedCardPaymentIntentId || "");
      if (!paymentIntentId) return res.status(409).json({ error: "No se encontró el pago de Stripe asociado a esta venta" });
      const stripeRefund = await stripe.refunds.create(
        {
          payment_intent: paymentIntentId,
          amount: Math.round(cardRefundAmount * 100),
          metadata: { orderId, refundNumber, source: "TPV_PARTIAL_REFUND" },
        },
        { idempotencyKey: `pos-partial-refund-${orderId}-${refundSequence}` }
      );
      stripeRefundId = stripeRefund.id;
    }

    const bootstrap = await loadPosBootstrap();
    const restoredProducts = bootstrap.products.map((product) => {
      const qty = Number(stockRestoreById.get(String(product?.id || "")) || 0);
      return qty ? { ...product, stock: Math.max(0, Number(product.stock || 0)) + qty } : product;
    });
    await upsertStorageValue("adminProducts", JSON.stringify(restoredProducts));

    if (giftRefunds.length) {
      const giftByCode = new Map();
      for (const entry of giftRefunds) {
        const code = String(entry.code || "").trim().toUpperCase();
        giftByCode.set(code, normalizeMoney((giftByCode.get(code) || 0) + Number(entry.amount || 0)));
      }
      operations.giftCards = (operations.giftCards || []).map((card) => {
        const code = String(card?.code || "").toUpperCase();
        const amount = Number(giftByCode.get(code) || 0);
        if (!amount) return card;
        return {
          ...card,
          balance: normalizeMoney(Number(card.balance || 0) + amount),
          active: true,
          updatedAt: refundedAt,
        };
      });
    }

    const originalPoints = Math.max(0, Math.floor(Number(order.metadata?.loyaltyPointsEarned || 0)));
    const previousPointsReversed = Math.max(0, Math.floor(Number(order.metadata?.loyaltyPointsReversed || 0)));
    const totalRefundedAfter = normalizeMoney(previouslyRefundedTotal + refundTotal);
    const fullRefund = totalRefundedAfter >= originalTotal - 0.01;
    const pointsRemaining = Math.max(0, originalPoints - previousPointsReversed);
    const pointsToReverse = fullRefund ? pointsRemaining : Math.min(pointsRemaining, Math.floor(refundTotal));
    const customerId = String(order.metadata?.customerId || "").trim();

    if (customerId && pointsToReverse > 0) {
      const previousPoints = Number(operations.loyalty?.[customerId]?.points || 0);
      operations.loyalty = {
        ...(operations.loyalty || {}),
        [customerId]: {
          points: Math.max(0, previousPoints - pointsToReverse),
          updatedAt: refundedAt,
          lastRefundOrderId: orderId,
        },
      };
    }

    await upsertStorageValue("posOperations", JSON.stringify(operations));

    if (cashRefundAmount > 0 && cashSession) {
      const nextCashSession = {
        ...cashSession,
        cashSales: normalizeMoney(Math.max(0, Number(cashSession.cashSales || 0) - cashRefundAmount)),
        cashOut: normalizeMoney(Number(cashSession.cashOut || 0) + cashRefundAmount),
        expectedCash: normalizeMoney(Number(cashSession.expectedCash || 0) - cashRefundAmount),
        movements: [
          ...(Array.isArray(cashSession.movements) ? cashSession.movements : []),
          {
            id: crypto.randomUUID(),
            type: "partial_refund",
            amount: cashRefundAmount,
            note: `${refundNumber}: ${reason}`,
            orderId,
            registerId,
            createdAt: refundedAt,
          },
        ],
        updatedAt: refundedAt,
      };
      await writePosCashSession(nextCashSession, registerId);
      cashSession = nextCashSession;
    }

    const refundRecord = {
      id: crypto.randomUUID(),
      refundNumber,
      createdAt: refundedAt,
      reason,
      items: refundItems,
      subtotal: refundSubtotal,
      tax: normalizeMoney(refundTotal - refundSubtotal),
      total: refundTotal,
      paymentBreakdown: refundPaymentBreakdown,
      stripeRefundId: stripeRefundId || null,
      manualRefunds,
      staff: refundStaff,
    };

    const metadata = {
      ...(order.metadata || {}),
      refunds: [...previousRefunds, refundRecord],
      refundedTotal: totalRefundedAfter,
      loyaltyPointsReversed: previousPointsReversed + pointsToReverse,
      ...(fullRefund ? { refundedAt, refundNumber } : {}),
      ...(manualRefunds.length ? { manualRefundPending: true } : {}),
    };

    const nextStatus = fullRefund ? "refunded" : manualRefunds.length ? "partially_refunded_pending_manual" : "partially_refunded";
    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({ status: nextStatus, metadata })
      .eq("id", orderId)
      .select("*")
      .single();
    if (updateError) throw updateError;

    broadcastAdminOrderEvent(updated, fullRefund ? "order_refunded" : "order_partially_refunded");
    res.json({
      ok: true,
      order: posOrderResponse(updated),
      inventory: restoredProducts,
      refund: refundRecord,
      cashSession,
      manualRefunds,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "No se pudo completar la devolución parcial" });
  }
});

app.post("/api/pos/mixed-card-intent", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  if (!stripe) return res.status(503).json({ error: "Stripe no está configurado en el backend" });

  try {
    const { products, fiscalSettings } = await loadPosBootstrap();
    const customer = normalizePosCustomer(req.body?.customer || {});
    const documentType = req.body?.documentType === "invoice" ? "invoice" : "ticket";
    validatePosInvoiceData(documentType, customer, fiscalSettings);

    const prepared = validateAndApplyStock(products, req.body?.items || []);
    const totals = calculatePosTotals(prepared.items);
    const cardAmount = normalizeMoney(req.body?.cardAmount);

    if (cardAmount <= 0 || cardAmount > totals.total) {
      return res.status(400).json({ error: "Importe de tarjeta inválido para el pago mixto" });
    }

    const amountCents = Math.round(cardAmount * 100);
    if (amountCents < 50) {
      return res.status(400).json({ error: "La parte de tarjeta debe ser de al menos 0,50 €" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "eur",
      receipt_email: customer.email || undefined,
      metadata: {
        source: "TPV_ADMIN_MIXED",
        customerId: customer.id,
      },
      payment_method_types: ["card"],
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      cardAmount,
      totals,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "No se pudo iniciar la parte de tarjeta" });
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
    const loyaltyPointsEarned = customer.id && customer.id !== "walk-in" ? Math.max(0, Math.floor(totals.total)) : 0;
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
      customerId: customer.id,
      loyaltyPointsEarned,
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
  let originalPosOperations = null;
  let posOperationsWasWritten = false;
  let activeRegisterId = "caja-01";

  try {
    const bootstrap = await loadPosBootstrap();
    originalProducts = bootstrap.products;
    const fiscalSettings = bootstrap.fiscalSettings || {};
    const customer = normalizePosCustomer(req.body?.customer || {});
    const documentType = req.body?.documentType === "invoice" ? "invoice" : "ticket";
    const paymentMethod = normalizePaymentMethod(req.body?.paymentMethod);
    const existingOrderId = String(req.body?.existingOrderId || "").trim();
    activeRegisterId = normalizeRegisterId(req.body?.registerId);
    const registerId = activeRegisterId;
    const staff = {
      id: String(req.body?.staff?.id || "owner").trim(),
      name: String(req.body?.staff?.name || "Propietario / administrador").trim(),
      role: String(req.body?.staff?.role || "admin").trim(),
    };

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
    const loyaltyPointsEarned = customer.id && customer.id !== "walk-in" ? Math.max(0, Math.floor(totals.total)) : 0;

    let mixedPayments = [];
    let mixedCashAmount = 0;
    let pendingPosOperations = null;

    if (paymentMethod === "mixed") {
      const rawPayments = Array.isArray(req.body?.payments) ? req.body.payments : [];
      mixedPayments = rawPayments
        .map((entry) => ({
          method: normalizePaymentMethod(entry?.method),
          amount: normalizeMoney(entry?.amount),
          code: String(entry?.code || "").trim().toUpperCase(),
        }))
        .filter((entry) => entry.amount > 0);

      if (!mixedPayments.length) {
        return res.status(400).json({ error: "Añade al menos un método al pago mixto" });
      }

      const validMixedMethods = new Set(["cash", "card", "bizum", "transfer", "gift_card"]);
      if (mixedPayments.some((entry) => !validMixedMethods.has(entry.method))) {
        return res.status(400).json({ error: "El pago mixto contiene un método no admitido" });
      }

      const mixedTotal = normalizeMoney(mixedPayments.reduce((sum, entry) => sum + entry.amount, 0));
      if (Math.abs(mixedTotal - totals.total) > 0.01) {
        return res.status(400).json({ error: `El pago mixto suma ${mixedTotal.toFixed(2)} € y la venta es de ${totals.total.toFixed(2)} €` });
      }

      mixedCashAmount = normalizeMoney(
        mixedPayments.filter((entry) => entry.method === "cash").reduce((sum, entry) => sum + entry.amount, 0)
      );
      const mixedCardAmount = normalizeMoney(
        mixedPayments.filter((entry) => entry.method === "card").reduce((sum, entry) => sum + entry.amount, 0)
      );

      if (mixedCardAmount > 0) {
        if (!stripe) return res.status(503).json({ error: "Stripe no está configurado" });
        const paymentIntentId = String(req.body?.paymentIntentId || "").trim();
        if (!paymentIntentId) return res.status(400).json({ error: "Falta confirmar la parte de tarjeta" });
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (intent.status !== "succeeded") {
          return res.status(409).json({ error: "La parte de tarjeta todavía no está pagada" });
        }
        const paidCardAmount = normalizeMoney(Number(intent.amount_received || intent.amount || 0) / 100);
        if (Math.abs(paidCardAmount - mixedCardAmount) > 0.01) {
          return res.status(409).json({ error: "El importe confirmado por Stripe no coincide con la parte de tarjeta" });
        }
      }

      if (mixedCashAmount > 0) {
        const cashSession = await readPosCashSession(registerId);
        if (!cashSession || cashSession.status !== "open") {
          return res.status(409).json({ error: "La caja está cerrada. Ábrela para usar efectivo en un pago mixto." });
        }
        originalCashSession = cashSession;
      }

      const giftEntries = mixedPayments.filter((entry) => entry.method === "gift_card");
      if (giftEntries.length) {
        const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], loyalty: {}, quotes: [] };
        const storedOperations = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
        originalPosOperations = storedOperations;
        const requestedByCode = new Map();
        for (const entry of giftEntries) {
          if (!entry.code) return res.status(400).json({ error: "Falta el código de una tarjeta regalo" });
          requestedByCode.set(entry.code, normalizeMoney((requestedByCode.get(entry.code) || 0) + entry.amount));
        }
        const nextCards = (storedOperations.giftCards || []).map((card) => {
          const code = String(card?.code || "").toUpperCase();
          const requestedAmount = requestedByCode.get(code) || 0;
          if (!requestedAmount) return card;
          if (card.active === false) throw new Error(`La tarjeta regalo ${code} está desactivada`);
          if (Number(card.balance || 0) + 0.001 < requestedAmount) throw new Error(`Saldo insuficiente en ${code}`);
          requestedByCode.delete(code);
          const balance = normalizeMoney(Number(card.balance || 0) - requestedAmount);
          return { ...card, balance, active: balance > 0, updatedAt: new Date().toISOString() };
        });
        if (requestedByCode.size) {
          throw new Error(`Tarjeta regalo no encontrada: ${Array.from(requestedByCode.keys())[0]}`);
        }
        pendingPosOperations = { ...storedOperations, giftCards: nextCards };
      }
    }

    if (paymentMethod === "cash" && totals.total > 0 && received < totals.total) {
      return res.status(400).json({ error: "El efectivo recibido es inferior al total" });
    }

    if (paymentMethod === "cash") {
      const cashSession = await readPosCashSession(registerId);
      if (!cashSession || cashSession.status !== "open") {
        return res.status(409).json({ error: "La caja está cerrada. Ábrela antes de cobrar en efectivo." });
      }
      originalCashSession = cashSession;
    }

    const mixedNeedsReview =
      paymentMethod === "mixed" &&
      mixedPayments.some((entry) => entry.method === "bizum" || entry.method === "transfer");
    const status = existingOrder
      ? "paid"
      : paymentMethod === "mixed"
      ? (mixedNeedsReview ? "pending_manual_review" : "paid")
      : paymentStatusForMethod(paymentMethod);
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
      customerId: customer.id,
      loyaltyPointsEarned,
      mixedCardPaymentIntentId: paymentMethod === "mixed" ? String(req.body?.paymentIntentId || "") : undefined,
      staff,
      registerId,
      fiscalSnapshot: fiscalSettings,
      tax: totals.tax,
      paymentBreakdown: paymentMethod === "mixed" ? mixedPayments : undefined,
      received: paymentMethod === "cash" ? totals.received : paymentMethod === "mixed" ? mixedCashAmount : totals.total,
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
      cashSession = await registerCashSaleInSession(totals.total, savedOrder.id, registerId);
      cashSessionWasWritten = true;
    } else if (paymentMethod === "mixed" && mixedCashAmount > 0) {
      cashSession = await registerCashSaleInSession(mixedCashAmount, savedOrder.id, registerId);
      cashSessionWasWritten = true;
    }

    if (loyaltyPointsEarned > 0 || pendingPosOperations) {
      const defaults = { giftCards: [], floristOrders: [], suppliers: [], purchases: [], staff: [], loyalty: {}, quotes: [] };
      let posOperations = pendingPosOperations;
      if (!posOperations) {
        const storedOperations = { ...defaults, ...(parseStoredJson(await readStorageValue("posOperations"), defaults) || {}) };
        if (!originalPosOperations) originalPosOperations = storedOperations;
        posOperations = storedOperations;
      }
      if (loyaltyPointsEarned > 0) {
        const previousPoints = Number(posOperations.loyalty?.[customer.id]?.points || 0);
        posOperations = {
          ...posOperations,
          loyalty: {
            ...(posOperations.loyalty || {}),
            [customer.id]: {
              points: previousPoints + loyaltyPointsEarned,
              updatedAt: now,
              lastOrderId: savedOrder.id,
            },
          },
        };
      }
      await upsertStorageValue("posOperations", JSON.stringify(posOperations));
      posOperationsWasWritten = true;
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
        await writePosCashSession(originalCashSession, activeRegisterId);
      } catch (rollbackError) {
        console.error("No se pudo revertir la caja tras fallo TPV:", rollbackError.message);
      }
    }

    if (posOperationsWasWritten && originalPosOperations) {
      try {
        await upsertStorageValue("posOperations", JSON.stringify(originalPosOperations));
      } catch (rollbackError) {
        console.error("No se pudieron revertir operaciones TPV tras fallo:", rollbackError.message);
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
  if (!stripe) return res.status(503).json({ error: "Stripe no está configurado en el backend" });

  try {
    const {
      currency = "eur",
      items = [],
      customerEmail,
      customerName,
      deliveryMethod = "envio",
      paymentMethod = "tarjeta",
      metadata = {},
    } = req.body || {};

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: "El carrito está vacío" });
    }
    if (customerEmail && !isValidEmail(customerEmail)) {
      return res.status(400).json({ error: "Email inválido" });
    }

    const selectedPaymentMethod = paymentMethod === "bizum" ? "bizum" : "tarjeta";
    const catalog = parseStoredJson(await readStorageValue("adminProducts"), []);
    const byId = new Map((Array.isArray(catalog) ? catalog : []).map((product) => [String(product?.id ?? ""), product]));
    const authoritativeItems = [];
    const requestedByProduct = new Map();

    for (const raw of items) {
      const id = String(raw?.id ?? "").trim();
      const quantity = Math.max(0, Math.floor(Number(raw?.quantity ?? raw?.qty ?? 0)));
      if (!id || quantity <= 0) return res.status(400).json({ error: "Artículo o cantidad inválida" });

      const product = byId.get(id);
      if (!product || product.active === false || product.deletedAt) {
        return res.status(409).json({ error: `Producto no disponible: ${raw?.name || id}` });
      }

      const selectedVariantName = String(raw?.selectedVariant || "").trim();
      const variants = Array.isArray(product.variants) ? product.variants : [];
      const variant = selectedVariantName
        ? variants.find((item) => String(item?.name || item) === selectedVariantName)
        : null;

      if (selectedVariantName && !variant) {
        return res.status(409).json({ error: `Variante no disponible para ${product.name}` });
      }

      const stock = Math.max(0, Math.floor(Number(variant?.stock ?? product.stock ?? 0)));
      const stockKey = `${id}::${selectedVariantName || "base"}`;
      const requested = Number(requestedByProduct.get(stockKey) || 0) + quantity;
      requestedByProduct.set(stockKey, requested);
      if (requested > stock) {
        return res.status(409).json({ error: `Stock insuficiente para ${product.name}${selectedVariantName ? ` (${selectedVariantName})` : ""}. Disponible: ${stock}` });
      }

      const basePrice = product.onSale === true && Number(product.salePrice || 0) > 0
        ? Number(product.salePrice)
        : Number(product.price || 0);
      const price = Number(variant?.price ?? basePrice);
      if (!Number.isFinite(price) || price <= 0) {
        return res.status(409).json({ error: `Precio inválido para ${product.name}` });
      }

      authoritativeItems.push({
        id,
        name: String(product.name || "Producto"),
        sku: String(product.sku || ""),
        category: String(product.category || ""),
        price: Number(price.toFixed(2)),
        iva: Math.max(0, Number(product.iva || 21)),
        quantity,
        selectedVariant: selectedVariantName || undefined,
        personalization: raw?.personalization && typeof raw.personalization === "object"
          ? { dedication: String(raw.personalization.dedication || "").slice(0, 280) }
          : undefined,
        image: product.image || undefined,
      });
    }

    const authoritativeSubtotal = Number(authoritativeItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2));
    const suite = parseStoredJson(await readStorageValue("businessSuiteSettings"), {});
    const isPickup = ["recoger", "recogida"].includes(String(deliveryMethod || "").toLowerCase());

    let authoritativeShipping = 0;
    let shippingQuote = null;
    if (!isPickup) {
      const shippingAddress = metadata?.shippingAddress || {};
      shippingQuote = await calculateShippingQuote(shippingAddress);
      const maxDeliveryKm = Math.max(0, Number(suite.maxDeliveryKm || 0));
      if (maxDeliveryKm > 0 && Number(shippingQuote.distanceKm || 0) > maxDeliveryKm) {
        return res.status(400).json({
          error: `La dirección está fuera del radio de reparto de ${maxDeliveryKm} km`,
          distanceKm: shippingQuote.distanceKm,
        });
      }
      authoritativeShipping = Number(shippingQuote.price || 0);
      const freeShippingFrom = Math.max(0, Number(suite.freeShippingFrom || 0));
      if (freeShippingFrom > 0 && authoritativeSubtotal >= freeShippingFrom) {
        authoritativeShipping = 0;
      }
    }

    const authoritativeTotal = Number((authoritativeSubtotal + authoritativeShipping).toFixed(2));
    const totalCents = Math.round(authoritativeTotal * 100);
    if (!Number.isFinite(totalCents) || totalCents < 50) {
      return res.status(400).json({ error: "Importe inválido para Stripe" });
    }

    const orderId = crypto.randomUUID();
    const secureMetadata = {
      ...metadata,
      source: "frontend_checkout",
      requestedPaymentMethod: selectedPaymentMethod,
      pricingValidatedAt: new Date().toISOString(),
      pricingSource: "backend_catalog_and_maps",
      shippingDistance: shippingQuote
        ? {
            distanceKm: shippingQuote.distanceKm,
            distanceText: shippingQuote.distanceText,
            durationText: shippingQuote.durationText,
            destination: shippingQuote.destination,
          }
        : null,
    };

    const { error: orderError } = await supabase.from("orders").insert({
      id: orderId,
      customer_email: customerEmail || null,
      customer_name: customerName || null,
      payment_method: selectedPaymentMethod,
      delivery_method: deliveryMethod,
      status: "payment_pending",
      subtotal: authoritativeSubtotal,
      shipping: authoritativeShipping,
      total: authoritativeTotal,
      items: authoritativeItems,
      metadata: secureMetadata,
    });
    if (orderError) return res.status(500).json({ error: orderError.message });

    try {
      const paymentIntentParams = {
        amount: totalCents,
        currency,
        receipt_email: customerEmail || undefined,
        metadata: { orderId, requestedPaymentMethod: selectedPaymentMethod },
        payment_method_types: selectedPaymentMethod === "bizum" ? ["bizum"] : ["card"],
      };
      const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);
      await supabase.from("orders").update({ stripe_payment_intent_id: paymentIntent.id }).eq("id", orderId);
      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        orderId,
        totals: {
          subtotal: authoritativeSubtotal,
          shipping: authoritativeShipping,
          total: authoritativeTotal,
        },
        shippingQuote,
      });
    } catch (error) {
      await supabase.from("orders").update({
        status: "payment_error",
        metadata: { ...secureMetadata, stripeError: error.message },
      }).eq("id", orderId);
      res.status(error.statusCode || 500).json({
        error: error.message || "Error al crear el pago en Stripe",
        code: error.code || "stripe_error",
      });
    }
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "No se pudo validar el pago" });
  }
});


async function commitOnlineOrderInventory(order) {
  if (!order || String(order?.metadata?.source || "") !== "frontend_checkout") {
    return { skipped: true, reason: "not_frontend_checkout", order };
  }

  const { data: freshOrder, error: freshError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", order.id)
    .maybeSingle();
  if (freshError) throw freshError;
  if (!freshOrder) throw new Error("Pedido no encontrado al confirmar inventario");
  if (freshOrder?.metadata?.inventoryCommittedAt) {
    return { skipped: true, reason: "already_committed", order: freshOrder };
  }

  const products = parseStoredJson(await readStorageValue("adminProducts"), []);
  const byId = new Map((Array.isArray(products) ? products : []).map((product) => [String(product?.id ?? ""), product]));
  const requirements = new Map();

  for (const item of Array.isArray(freshOrder.items) ? freshOrder.items : []) {
    const id = String(item?.id ?? "").trim();
    const variantName = String(item?.selectedVariant || "").trim();
    const qty = Math.max(0, Math.floor(Number(item?.quantity ?? item?.qty ?? 0)));
    if (!id || qty <= 0) continue;
    const key = `${id}::${variantName || "base"}`;
    requirements.set(key, {
      id,
      variantName,
      qty: Number(requirements.get(key)?.qty || 0) + qty,
    });
  }

  for (const requirement of requirements.values()) {
    const product = byId.get(requirement.id);
    if (!product) throw new Error(`Producto no encontrado al confirmar stock: ${requirement.id}`);
    if (requirement.variantName) {
      const variant = (Array.isArray(product.variants) ? product.variants : []).find(
        (entry) => String(entry?.name || entry) === requirement.variantName
      );
      if (!variant) throw new Error(`Variante no encontrada: ${product.name} · ${requirement.variantName}`);
      const available = Math.max(0, Math.floor(Number(variant.stock ?? 0)));
      if (available < requirement.qty) {
        throw new Error(`Stock insuficiente tras el pago para ${product.name} (${requirement.variantName}). Disponible: ${available}`);
      }
    } else {
      const available = Math.max(0, Math.floor(Number(product.stock ?? 0)));
      if (available < requirement.qty) {
        throw new Error(`Stock insuficiente tras el pago para ${product.name}. Disponible: ${available}`);
      }
    }
  }

  const updatedProducts = products.map((product) => {
    const id = String(product?.id ?? "");
    const baseRequirement = requirements.get(`${id}::base`);
    let next = product;

    if (baseRequirement) {
      next = {
        ...next,
        stock: Math.max(0, Math.floor(Number(next.stock || 0)) - baseRequirement.qty),
      };
    }

    if (Array.isArray(next.variants) && next.variants.length) {
      next = {
        ...next,
        variants: next.variants.map((variant) => {
          const name = String(variant?.name || variant);
          const requirement = requirements.get(`${id}::${name}`);
          if (!requirement || typeof variant !== "object") return variant;
          return {
            ...variant,
            stock: Math.max(0, Math.floor(Number(variant.stock || 0)) - requirement.qty),
          };
        }),
      };
    }

    return next;
  });

  const committedAt = new Date().toISOString();
  const nextMetadata = {
    ...(freshOrder.metadata || {}),
    inventoryCommittedAt: committedAt,
    inventoryCommitSource: "online_payment",
  };

  // Mark the order first to make repeated Stripe confirmations idempotent in normal retry flows.
  const { data: markedOrder, error: markError } = await supabase
    .from("orders")
    .update({ metadata: nextMetadata, updated_at: committedAt })
    .eq("id", freshOrder.id)
    .select("*")
    .single();
  if (markError) throw markError;

  try {
    await upsertStorageValue("adminProducts", JSON.stringify(updatedProducts));
    void evaluateInventoryAutomations(updatedProducts).catch((error) =>
      console.warn("Automations post-sale stock check:", error?.message || error)
    );
  } catch (error) {
    await supabase
      .from("orders")
      .update({
        metadata: {
          ...(freshOrder.metadata || {}),
          inventoryCommitError: error?.message || String(error),
          inventoryCommitFailedAt: new Date().toISOString(),
        },
      })
      .eq("id", freshOrder.id);
    throw error;
  }

  return { committed: true, products: updatedProducts, order: markedOrder };
}

async function restockOnlineOrderInventory(order) {
  if (
    !order ||
    String(order?.metadata?.source || "") !== "frontend_checkout" ||
    !order?.metadata?.inventoryCommittedAt ||
    order?.metadata?.inventoryRestockedAt
  ) {
    return { skipped: true };
  }

  const products = parseStoredJson(await readStorageValue("adminProducts"), []);
  const quantities = new Map();

  for (const item of Array.isArray(order.items) ? order.items : []) {
    const id = String(item?.id ?? "").trim();
    const variantName = String(item?.selectedVariant || "").trim();
    const qty = Math.max(0, Math.floor(Number(item?.quantity ?? item?.qty ?? 0)));
    if (!id || qty <= 0) continue;
    const key = `${id}::${variantName || "base"}`;
    quantities.set(key, Number(quantities.get(key) || 0) + qty);
  }

  const restoredProducts = products.map((product) => {
    const id = String(product?.id ?? "");
    const baseQty = Number(quantities.get(`${id}::base`) || 0);
    let next = baseQty
      ? { ...product, stock: Math.max(0, Math.floor(Number(product.stock || 0))) + baseQty }
      : product;

    if (Array.isArray(next.variants) && next.variants.length) {
      next = {
        ...next,
        variants: next.variants.map((variant) => {
          const name = String(variant?.name || variant);
          const qty = Number(quantities.get(`${id}::${name}`) || 0);
          if (!qty || typeof variant !== "object") return variant;
          return { ...variant, stock: Math.max(0, Math.floor(Number(variant.stock || 0))) + qty };
        }),
      };
    }
    return next;
  });

  await upsertStorageValue("adminProducts", JSON.stringify(restoredProducts));
  return { restored: true, products: restoredProducts };
}

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
    let inventoryOrder = updatedOrder;
    try {
      const inventoryResult = await commitOnlineOrderInventory(updatedOrder);
      inventoryOrder = inventoryResult.order || updatedOrder;
    } catch (inventoryError) {
      console.error("Pago confirmado pero falló el compromiso de inventario:", inventoryError?.message || inventoryError);
      await addAutomationNotification({
        type: "inventory_payment_conflict",
        title: "Pago con incidencia de stock",
        message: `Pedido #${String(updatedOrder.id).slice(0,8)} pagado, pero el inventario no pudo confirmarse: ${inventoryError?.message || inventoryError}`,
        entityType: "order",
        entityId: String(updatedOrder.id),
        dedupeKey: `inventory-payment:${updatedOrder.id}`,
      }).catch(() => null);
    }

    broadcastAdminOrderEvent(inventoryOrder, "order_paid");
    void emitNeuralBusinessEvent("order.paid", normalizeOrder(inventoryOrder));

    try {
      emailResults = await sendOrderConfirmationEmails(
        inventoryOrder,
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


function requireNeuralBridge(req, res, next) {
  const expected = process.env.HERENCIA_NEURAL_TOKEN;
  const received = req.get("X-Herencia-Neural-Token");
  if (!expected) return res.status(503).json({ error: "HERENCIA_NEURAL_TOKEN no configurado" });
  if (!received) return res.status(401).json({ error: "Token Neural requerido" });
  const a = Buffer.from(String(received));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ error: "Token Neural inválido" });
  }
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

function neuralClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function neuralDefaultDesign(overrides = {}) {
  return {
    backgroundColor: "#ffffff",
    textColor: "#1f2937",
    accentColor: "#2f6848",
    paddingY: 64,
    maxWidth: 1280,
    columns: 3,
    gap: 24,
    radius: 16,
    overlay: 42,
    alignment: "left",
    imagePosition: "center",
    headingScale: 100,
    fontFamily: "inherit",
    hiddenMobile: false,
    ...overrides,
  };
}

function ensureNeuralBuilder(site) {
  site.builder = site.builder && typeof site.builder === "object" ? site.builder : {};
  if (!Array.isArray(site.builder.blocks) || !site.builder.blocks.length) {
    site.builder.blocks = [
      {
        id: "hero-main",
        type: "hero",
        name: "Portada",
        visible: true,
        data: {
          eyebrow: site.hero?.eyebrow || "",
          description: site.hero?.description || "",
          primaryButton: site.hero?.primaryButton || { label: "Ver catálogo", href: "/productos" },
          secondaryButton: site.hero?.secondaryButton || { label: "Servicios", href: "/servicios" },
          imageUrl: site.hero?.imageUrl || "",
          showLogo: true,
          heading: "",
        },
        design: neuralDefaultDesign({ backgroundColor: "#294c35", textColor: "#ffffff", paddingY: 96, overlay: 52, radius: 0, headingScale: 125 }),
      },
      {
        id: "features-main",
        type: "features",
        name: "Ventajas",
        visible: true,
        data: { items: Array.isArray(site.features) ? site.features : [] },
        design: neuralDefaultDesign({ backgroundColor: "#f7f8f5", paddingY: 48, columns: 4 }),
      },
      {
        id: "categories-main",
        type: "categories",
        name: "Categorías",
        visible: true,
        data: { heading: site.categoriesHeading || "", description: site.categoriesDescription || "", items: Array.isArray(site.categories) ? site.categories : [] },
        design: neuralDefaultDesign({ columns: 4 }),
      },
      {
        id: "cta-main",
        type: "cta",
        name: "Banner promocional",
        visible: true,
        data: { title: site.cta?.title || "", subtitle: site.cta?.subtitle || "", button: site.cta?.button || {}, imageUrl: site.cta?.imageUrl || "" },
        design: neuralDefaultDesign({ backgroundColor: "#294c35", textColor: "#ffffff" }),
      },
    ];
  }
  return site;
}

function syncNeuralBuilderToLegacy(site) {
  const blocks = site?.builder?.blocks || [];
  const hero = blocks.find((block) => block.type === "hero");
  const features = blocks.find((block) => block.type === "features");
  const categories = blocks.find((block) => block.type === "categories");
  const cta = blocks.find((block) => block.type === "cta");
  if (hero) {
    site.hero = {
      ...(site.hero || {}),
      eyebrow: String(hero.data?.eyebrow || ""),
      description: String(hero.data?.description || ""),
      primaryButton: { ...(site.hero?.primaryButton || {}), ...(hero.data?.primaryButton || {}) },
      secondaryButton: { ...(site.hero?.secondaryButton || {}), ...(hero.data?.secondaryButton || {}) },
      imageUrl: String(hero.data?.imageUrl || ""),
    };
  }
  if (features && Array.isArray(features.data?.items)) site.features = features.data.items;
  if (categories) {
    site.categoriesHeading = String(categories.data?.heading || "");
    site.categoriesDescription = String(categories.data?.description || "");
    if (Array.isArray(categories.data?.items)) site.categories = categories.data.items;
  }
  if (cta) {
    site.cta = {
      ...(site.cta || {}),
      title: String(cta.data?.title || ""),
      subtitle: String(cta.data?.subtitle || ""),
      button: { ...(site.cta?.button || {}), ...(cta.data?.button || {}) },
      imageUrl: String(cta.data?.imageUrl || ""),
    };
  }
  return site;
}

function neuralSetDeepValue(root, path, value) {
  const parts = String(path || "").split(".").filter(Boolean);
  const allowedRoots = new Set(["brand","navigation","headerActions","hero","features","categories","categoriesHeading","categoriesDescription","cta","footer","floatingWhatsapp","contactPage","builder"]);
  if (!parts.length || !allowedRoots.has(parts[0])) throw new Error("Ruta de contenido no permitida");
  let cursor = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i];
    if (cursor[key] == null || typeof cursor[key] !== "object") cursor[key] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    cursor = cursor[key];
  }
  const rawLast = parts.at(-1);
  const last = /^\d+$/.test(rawLast) ? Number(rawLast) : rawLast;
  cursor[last] = value;
}

function createNeuralBuilderBlock(section = {}) {
  const requestedType = String(section.type || "textImage");
  const type = ["hero","features","categories","cta","textImage","gallery","testimonials"].includes(requestedType) ? requestedType : "textImage";
  const id = String(section.id || `${type}-${crypto.randomUUID()}`);
  const title = String(section.title || section.heading || "Nueva sección").trim();
  const subtitle = String(section.subtitle || section.text || "").trim();
  if (type === "gallery") return { id, type, name: title || "Galería", visible: true, data: { heading: title, description: subtitle, images: Array.isArray(section.images) ? section.images : [] }, design: neuralDefaultDesign({ columns: Math.max(1, Math.min(4, Number(section.columns || 3))) }) };
  if (type === "testimonials") return { id, type, name: title || "Testimonios", visible: true, data: { heading: title, description: subtitle, items: Array.isArray(section.items) ? section.items : [] }, design: neuralDefaultDesign({ backgroundColor: "#f6f4ee", columns: Math.max(1, Math.min(4, Number(section.columns || 3))) }) };
  if (type === "features") return { id, type, name: title || "Ventajas", visible: true, data: { items: Array.isArray(section.items) ? section.items : [] }, design: neuralDefaultDesign({ columns: Math.max(1, Math.min(4, Number(section.columns || 4))) }) };
  if (type === "categories") return { id, type, name: title || "Categorías", visible: true, data: { heading: title, description: subtitle, items: Array.isArray(section.items) ? section.items : [] }, design: neuralDefaultDesign({ columns: Math.max(1, Math.min(4, Number(section.columns || 4))) }) };
  if (type === "cta") return { id, type, name: title || "Banner", visible: true, data: { title, subtitle, button: section.button || { label: "Ver más", href: "/" }, imageUrl: String(section.imageUrl || "") }, design: neuralDefaultDesign({ backgroundColor: "#294c35", textColor: "#ffffff" }) };
  if (type === "hero") return { id, type, name: title || "Portada", visible: true, data: { heading: title, eyebrow: String(section.eyebrow || ""), description: subtitle, primaryButton: section.primaryButton || { label: "Ver más", href: "/" }, secondaryButton: section.secondaryButton || { label: "Servicios", href: "/servicios" }, imageUrl: String(section.imageUrl || ""), showLogo: section.showLogo !== false }, design: neuralDefaultDesign({ backgroundColor: "#294c35", textColor: "#ffffff", paddingY: 96, overlay: 52, radius: 0, headingScale: 125 }) };
  return { id, type: "textImage", name: title || "Texto + imagen", visible: true, data: { eyebrow: String(section.eyebrow || "HERENCIA"), heading: title, text: subtitle, button: section.button || { label: String(section.buttonLabel || "Saber más"), href: String(section.href || "/servicios") }, imageUrl: String(section.imageUrl || ""), imageSide: String(section.imageSide || "right") }, design: neuralDefaultDesign({ columns: Math.max(1, Math.min(4, Number(section.columns || 2))) }) };
}

function applyNeuralWebOperations(siteInput, operations = []) {
  const site = ensureNeuralBuilder(neuralClone(siteInput || {}));
  for (const op of operations) {
    const blocks = site.builder.blocks;
    switch (op?.type) {
      case "updateText":
      case "setImage":
      case "updateButtonAction":
        neuralSetDeepValue(site, op.path || op.target, op.value);
        break;
      case "createSection":
        blocks.push(createNeuralBuilderBlock(op.section || op.value || {}));
        break;
      case "moveSection": {
        const from = blocks.findIndex((block) => block.id === (op.sectionId || op.blockId));
        if (from < 0) throw new Error("Sección no encontrada");
        const [block] = blocks.splice(from, 1);
        const to = Math.max(0, Math.min(blocks.length, Number(op.toIndex || 0)));
        blocks.splice(to, 0, block);
        break;
      }
      case "removeElement": {
        const blockId = op.sectionId || op.blockId;
        const before = blocks.length;
        site.builder.blocks = blocks.filter((block) => block.id !== blockId);
        if (site.builder.blocks.length === before) throw new Error("Sección no encontrada");
        break;
      }
      case "setGrid": {
        const block = blocks.find((item) => item.id === (op.sectionId || op.blockId));
        if (!block) throw new Error("Sección no encontrada");
        block.design = { ...neuralDefaultDesign(), ...(block.design || {}), columns: Math.max(1, Math.min(6, Number(op.columns || op.value || 3))) };
        break;
      }
      case "setTypography": {
        const block = blocks.find((item) => item.id === (op.sectionId || op.blockId));
        if (!block) throw new Error("Sección no encontrada");
        block.design = { ...neuralDefaultDesign(), ...(block.design || {}), fontFamily: String(op.fontFamily || op.value || "inherit"), headingScale: Math.max(60, Math.min(180, Number(op.headingScale || block.design?.headingScale || 100))) };
        break;
      }
      case "setSpacing": {
        const block = blocks.find((item) => item.id === (op.sectionId || op.blockId));
        if (!block) throw new Error("Sección no encontrada");
        block.design = { ...neuralDefaultDesign(), ...(block.design || {}), paddingY: Math.max(0, Math.min(200, Number(op.paddingY ?? block.design?.paddingY ?? 64))), gap: Math.max(0, Math.min(100, Number(op.gap ?? block.design?.gap ?? 24))) };
        break;
      }
      case "createButton": {
        const block = blocks.find((item) => item.id === (op.sectionId || op.blockId));
        if (!block) throw new Error("Sección no encontrada");
        block.data = { ...(block.data || {}), button: { label: String(op.label || "Ver más"), href: String(op.href || "/") } };
        break;
      }
      case "uploadAsset": {
        const dataUrl = String(op.dataUrl || op.value || "");
        if (!/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=\r\n]+$/i.test(dataUrl)) {
          throw new Error("uploadAsset solo acepta imágenes PNG, JPEG o WebP en data URL");
        }
        const comma = dataUrl.indexOf(",");
        const base64 = comma >= 0 ? dataUrl.slice(comma + 1).replace(/\s/g, "") : "";
        const approxBytes = Math.floor((base64.length * 3) / 4);
        if (approxBytes <= 0 || approxBytes > 2 * 1024 * 1024) {
          throw new Error("La imagen debe pesar como máximo 2 MB después de comprimir");
        }
        const blockId = op.sectionId || op.blockId;
        if (blockId) {
          const block = blocks.find((item) => item.id === blockId);
          if (!block) throw new Error("Sección no encontrada para uploadAsset");
          const field = String(op.field || "imageUrl");
          const allowedFields = new Set(["imageUrl"]);
          if (!allowedFields.has(field)) throw new Error("Campo de imagen no permitido");
          block.data = { ...(block.data || {}), [field]: dataUrl };
        } else if (op.path || op.target) {
          neuralSetDeepValue(site, op.path || op.target, dataUrl);
        } else {
          throw new Error("uploadAsset requiere sectionId o path");
        }
        break;
      }
      default:
        throw new Error(`Operación web no soportada: ${op?.type}`);
    }
  }
  return syncNeuralBuilderToLegacy(site);
}

async function readNeuralWebDrafts() {
  return parseStoredJson(await readStorageValue("neuralWebDrafts"), []);
}

async function readSiteHistory() {
  return parseStoredJson(await readStorageValue("siteContentHistory"), []);
}


const neuralCustomerEventRate = new Map();

function redactCustomerChatText(value) {
  return String(value || "")
    .slice(0, 2000)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(?:\+?34)?[\s.-]?(?:\d[\s.-]?){9,}/g, "[phone]")
    .replace(/\b\d{8}[A-Z]\b/gi, "[id]");
}

function allowCustomerNeuralEvent(req) {
  const key = String(req.ip || req.socket?.remoteAddress || "unknown");
  const now = Date.now();
  const windowMs = 60_000;
  const max = 30;
  const entry = neuralCustomerEventRate.get(key) || { startedAt: now, count: 0 };
  if (now - entry.startedAt > windowMs) {
    entry.startedAt = now;
    entry.count = 0;
  }
  entry.count += 1;
  neuralCustomerEventRate.set(key, entry);
  return entry.count <= max;
}

app.post("/api/neural/customer-chat-event", async (req, res) => {
  if (!allowCustomerNeuralEvent(req)) {
    return res.status(429).json({ error: "Demasiados eventos de chat" });
  }
  const allowedTypes = new Set([
    "conversation.message",
    "conversation.unanswered",
    "conversation.intent",
    "web.demand_signal",
  ]);
  const type = String(req.body?.type || "");
  if (!allowedTypes.has(type)) {
    return res.status(400).json({ error: "Tipo de evento de chat no permitido" });
  }
  const text = redactCustomerChatText(req.body?.text);
  if (!text && type !== "conversation.intent") {
    return res.status(400).json({ error: "Evento sin contenido" });
  }
  const payload = {
    conversationId: String(req.body?.conversationId || "").slice(0, 120) || crypto.randomUUID(),
    text,
    intent: String(req.body?.intent || "").slice(0, 120),
    topic: String(req.body?.topic || "").slice(0, 120),
    suggestion: redactCustomerChatText(req.body?.suggestion || ""),
    page: String(req.body?.page || "").slice(0, 300),
    trust: "customer_unverified",
    receivedAt: new Date().toISOString(),
  };
  const emitted = await emitNeuralBusinessEvent(type, payload);
  res.status(emitted?.ok ? 202 : 503).json({
    accepted: Boolean(emitted?.ok),
    provisional: true,
    reason: emitted?.reason || emitted?.error || null,
  });
});

app.get("/api/neural-bridge/orders", requireNeuralBridge, async (_req, res) => {
  if (!requireSupabase(res)) return;
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(1000);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ orders: data || [], observedAt: new Date().toISOString() });
});

app.get("/api/neural-bridge/products", requireNeuralBridge, async (_req, res) => {
  try {
    res.json({ products: await readNeuralProducts(), observedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/neural-bridge/full-snapshot", requireNeuralBridge, async (_req, res) => {
  if (!requireSupabase(res)) return;
  try {
    const [{ data: orders, error: orderError }, productsRaw, cashRaw, siteRaw, draftRaw, posCustomersRaw, expensesRaw, manualSalesRaw, closuresRaw, suppliersRaw] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(1000),
      readStorageValue("adminProducts"),
      readStorageValue("posCashSession"),
      readStorageValue("siteContent"),
      readStorageValue("siteContentDraft"),
      readStorageValue("posCustomers"),
      readStorageValue("herencia_finance_expenses"),
      readStorageValue("herencia_finance_sales"),
      readStorageValue("herencia_finance_closures"),
      readStorageValue("adminSuppliers"),
    ]);
    if (orderError) throw orderError;
    const products = parseStoredJson(productsRaw, []);
    const inventory = products.map((p) => ({ id: p.id, name: p.name || p.title, stock: Number(p.stock || 0), price: Number(p.price || 0), category: p.category || null, sku: p.sku || null }));
    const orderCustomers = (orders || []).filter(o => o.customer_email).map(o => ({ email: o.customer_email, name: o.customer_name || "", lastOrderAt: o.created_at }));
    const posCustomers = parseStoredJson(posCustomersRaw, []);
    const customerMap = new Map();
    for (const customer of [...orderCustomers, ...posCustomers]) {
      const key = String(customer.email || customer.id || customer.phone || "").toLowerCase();
      if (key) customerMap.set(key, { ...(customerMap.get(key) || {}), ...customer });
    }
    const customers = [...customerMap.values()];
    const sales = (orders || []).filter(o => ["paid","confirmed","preparing","ready","delivered","completed"].includes(o.status));
    const revenue = sales.reduce((sum,o)=>sum+Number(o.total||0),0);
    res.json({
      products,
      inventory,
      orders: orders || [],
      customers,
      sales,
      cash: parseStoredJson(cashRaw, null),
      finance: {
        revenue,
        transactions: sales.length,
        averageTicket: sales.length ? revenue / sales.length : 0,
        expenses: parseStoredJson(expensesRaw, []),
        recordedExpenses: parseStoredJson(expensesRaw, []),
        expensesTotal: parseStoredJson(expensesRaw, []).reduce((sum, x) => sum + Number(x.amount || 0), 0),
        manualSales: parseStoredJson(manualSalesRaw, []),
        closures: parseStoredJson(closuresRaw, []),
        netAfterRecordedExpenses: revenue - parseStoredJson(expensesRaw, []).reduce((sum, x) => sum + Number(x.amount || 0), 0),
        derivedFrom: "verified_orders_plus_recorded_finance",
      },
      suppliers: parseStoredJson(suppliersRaw, []),
      web: { published: parseStoredJson(siteRaw, {}), draft: parseStoredJson(draftRaw, {}) },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo construir el Digital Twin" });
  }
});

app.patch("/api/neural-bridge/products/:id/stock", requireNeuralBridge, async (req, res) => {
  const actionId = requireNeuralActionId(req, res);
  if (!actionId) return;
  try {
    const products = await readNeuralProducts();
    const index = products.findIndex(p => String(p.id) === String(req.params.id));
    if (index < 0) return res.status(404).json({ error: "Producto no encontrado" });
    const current = Math.max(0, Math.floor(Number(products[index].stock || 0)));
    const nextStock = req.body?.stock != null ? Math.max(0, Math.floor(Number(req.body.stock))) : Math.max(0, current + Math.floor(Number(req.body?.delta || 0)));
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


app.patch("/api/neural-bridge/products/:id", requireNeuralBridge, async (req, res) => {
  const actionId = requireNeuralActionId(req, res);
  if (!actionId) return;
  try {
    const products = await readNeuralProducts();
    const index = products.findIndex(p => String(p.id) === String(req.params.id));
    if (index < 0) return res.status(404).json({ error: "Producto no encontrado" });
    const patch = req.body?.patch || {};
    const previous = products[index];
    const updated = normalizeNeuralProduct({ ...previous, ...patch, id: previous.id });
    products[index] = updated;
    await writeNeuralProducts(products);
    void emitNeuralBusinessEvent("product.updated", { actionId, product: updated, previous });
    res.json({ ok: true, actionId, product: updated });
  } catch (error) {
    res.status(400).json({ error: error.message || "No se pudo actualizar el producto" });
  }
});

app.delete("/api/neural-bridge/products/:id", requireNeuralBridge, async (req, res) => {
  const actionId = requireNeuralActionId(req, res);
  if (!actionId) return;
  try {
    const products = await readNeuralProducts();
    const index = products.findIndex(p => String(p.id) === String(req.params.id));
    if (index < 0) return res.status(404).json({ error: "Producto no encontrado" });
    const [deleted] = products.splice(index, 1);
    await writeNeuralProducts(products);
    void emitNeuralBusinessEvent("product.deleted", { actionId, product: deleted });
    res.json({ ok: true, actionId, product: deleted });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo eliminar el producto" });
  }
});

app.post("/api/neural-bridge/crm/customers", requireNeuralBridge, async (req, res) => {
  const actionId = requireNeuralActionId(req, res);
  if (!actionId) return;
  try {
    const incoming = normalizePosCustomer(req.body?.customer || {});
    if (!incoming.name) return res.status(400).json({ error: "El cliente necesita nombre" });
    const customers = parseStoredJson(await readStorageValue("posCustomers"), []);
    const match = customers.findIndex((item) =>
      String(item.id || "") === incoming.id ||
      (incoming.email && String(item.email || "").toLowerCase() === incoming.email.toLowerCase()) ||
      (incoming.phone && String(item.phone || "") === incoming.phone)
    );
    const customer = match >= 0 ? { ...customers[match], ...incoming, id: customers[match].id || incoming.id } : incoming;
    if (match >= 0) customers[match] = customer;
    else customers.unshift(customer);
    await upsertStorageValue("posCustomers", JSON.stringify(customers.slice(0, 5000)));
    void emitNeuralBusinessEvent("customer.updated", { actionId, customer, created: match < 0 });
    res.status(match < 0 ? 201 : 200).json({ ok: true, actionId, customer });
  } catch (error) {
    res.status(400).json({ error: error.message || "No se pudo guardar el cliente" });
  }
});


app.post("/api/neural-bridge/suppliers", requireNeuralBridge, async (req, res) => {
  const actionId = requireNeuralActionId(req, res);
  if (!actionId) return;
  try {
    const incoming = req.body?.supplier || req.body || {};
    const name = String(incoming.name || "").trim();
    if (!name) return res.status(400).json({ error: "El proveedor necesita nombre" });
    const suppliers = parseStoredJson(await readStorageValue("adminSuppliers"), []);
    const normalized = {
      id: String(incoming.id || crypto.randomUUID()),
      name,
      email: String(incoming.email || "").trim(),
      phone: String(incoming.phone || "").trim(),
      address: String(incoming.address || "").trim(),
      website: String(incoming.website || "").trim(),
      notes: String(incoming.notes || "").slice(0, 2000),
      categories: Array.isArray(incoming.categories) ? incoming.categories.map(String).slice(0, 50) : [],
      active: incoming.active !== false,
      updatedAt: new Date().toISOString(),
    };
    if (normalized.email && !isValidEmail(normalized.email)) {
      return res.status(400).json({ error: "Email de proveedor inválido" });
    }
    const match = suppliers.findIndex(s =>
      String(s.id || "") === normalized.id ||
      (normalized.email && String(s.email || "").toLowerCase() === normalized.email.toLowerCase()) ||
      String(s.name || "").toLowerCase() === normalized.name.toLowerCase()
    );
    const supplier = match >= 0 ? { ...suppliers[match], ...normalized, id: suppliers[match].id || normalized.id } : normalized;
    if (match >= 0) suppliers[match] = supplier;
    else suppliers.unshift(supplier);
    await upsertStorageValue("adminSuppliers", JSON.stringify(suppliers.slice(0, 5000)));
    void emitNeuralBusinessEvent("supplier.updated", { actionId, supplier, created: match < 0 });
    res.status(match < 0 ? 201 : 200).json({ ok: true, actionId, supplier });
  } catch (error) {
    res.status(400).json({ error: error.message || "No se pudo guardar el proveedor" });
  }
});

app.post("/api/neural-bridge/orders/:id/invoice", requireNeuralBridge, async (req, res) => {
  const actionId = requireNeuralActionId(req, res);
  if (!actionId) return;
  if (!requireSupabase(res)) return;
  try {
    const { data: order, error } = await supabase.from("orders").select("*").eq("id", req.params.id).maybeSingle();
    if (error) throw error;
    if (!order) return res.status(404).json({ error: "Pedido no encontrado" });
    if (!["paid","confirmed","preparing","processing","ready","delivered","completed"].includes(order.status)) {
      return res.status(409).json({ error: "Solo se puede emitir factura para un pedido cobrado o confirmado" });
    }
    const bootstrap = await loadPosBootstrap();
    const metadata = order.metadata || {};
    const customer = normalizePosCustomer({
      id: req.body?.customer?.id || order.customer_email || crypto.randomUUID(),
      name: req.body?.customer?.name || order.customer_name || "",
      email: req.body?.customer?.email || order.customer_email || "",
      nif: req.body?.customer?.nif || metadata.customerNif || "",
      address: req.body?.customer?.address || metadata.customerAddress || "",
      phone: req.body?.customer?.phone || metadata.customerPhone || "",
    });
    validatePosInvoiceData("invoice", customer, bootstrap.fiscalSettings || {});
    if (metadata.documentType === "invoice" && metadata.invoiceNumber) {
      return res.json({ ok: true, actionId, idempotent: true, invoiceNumber: metadata.invoiceNumber, order: posOrderResponse(order) });
    }
    const invoiceNumber = await reservePosDocumentNumber("invoice");
    const now = new Date().toISOString();
    const nextMetadata = {
      ...metadata,
      documentType: "invoice",
      invoiceNumber,
      invoiceIssuedAt: now,
      invoiceNeuralActionId: actionId,
      customerNif: customer.nif,
      customerAddress: customer.address,
      customerPhone: customer.phone,
      fiscalSnapshot: bootstrap.fiscalSettings || {},
    };
    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({ customer_email: customer.email || null, customer_name: customer.name, metadata: nextMetadata, updated_at: now })
      .eq("id", order.id)
      .select("*")
      .single();
    if (updateError) throw updateError;
    void emitNeuralBusinessEvent("invoice.issued", { actionId, orderId: order.id, invoiceNumber, total: Number(updated.total || 0) });
    res.status(201).json({
      ok: true,
      actionId,
      invoiceNumber,
      invoice: {
        number: invoiceNumber,
        issuedAt: now,
        issuer: bootstrap.fiscalSettings || {},
        customer,
        items: updated.items || [],
        subtotal: Number(updated.subtotal || 0),
        total: Number(updated.total || 0),
        tax: Number(nextMetadata.tax || 0),
      },
      order: posOrderResponse(updated),
    });
  } catch (error) {
    res.status(400).json({ error: error.message || "No se pudo emitir la factura" });
  }
});

app.post("/api/neural-bridge/finance/expenses", requireNeuralBridge, async (req, res) => {
  const actionId = requireNeuralActionId(req, res);
  if (!actionId) return;
  try {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Importe de gasto inválido" });
    const expenses = parseStoredJson(await readStorageValue("herencia_finance_expenses"), []);
    const now = new Date().toISOString();
    const expense = {
      id: crypto.randomUUID(),
      expense_date: String(req.body?.expense_date || req.body?.date || now.slice(0, 10)),
      category: String(req.body?.category || "Otros").slice(0, 120),
      provider: String(req.body?.provider || "Proveedor").slice(0, 160),
      concept: String(req.body?.concept || req.body?.note || "Gasto Neural").slice(0, 300),
      amount: Math.round(amount * 100) / 100,
      payment_method: String(req.body?.payment_method || req.body?.paymentMethod || "Transferencia").slice(0, 80),
      status: String(req.body?.status || "Pagado").slice(0, 80),
      notes: String(req.body?.notes || "").slice(0, 1000),
      created_at: now,
      source: "HERENCIA_NEURAL",
      neuralActionId: actionId,
    };
    await upsertStorageValue("herencia_finance_expenses", JSON.stringify([expense, ...expenses].slice(0, 10000)));
    void emitNeuralBusinessEvent("finance.expense_recorded", { actionId, expense });
    res.status(201).json({ ok: true, actionId, expense });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo registrar el gasto" });
  }
});

app.post("/api/neural-bridge/communications/email", requireNeuralBridge, async (req, res) => {
  const actionId = requireNeuralActionId(req, res);
  if (!actionId) return;
  const to = String(req.body?.to || "").trim();
  if (!isValidEmail(to)) return res.status(400).json({ error: "Destinatario inválido" });
  const subject = String(req.body?.subject || "Mensaje de Herencia").slice(0, 180);
  const body = String(req.body?.text || req.body?.message || "").slice(0, 10000);
  if (!body) return res.status(400).json({ error: "El email necesita contenido" });
  try {
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#233127">${escapeHtml(body).replace(/\n/g, "<br>")}</div>`;
    const result = await sendResendEmail({ to, subject, html, replyTo: req.body?.replyTo });
    if (result?.skipped) return res.status(503).json({ error: "Email no configurado", detail: result.reason });
    void emitNeuralBusinessEvent("communication.email_sent", { actionId, to, subject });
    res.json({ ok: true, actionId, providerResult: result });
  } catch (error) {
    res.status(502).json({ error: error.message || "No se pudo enviar el email" });
  }
});

app.post("/api/neural-bridge/communications/whatsapp", requireNeuralBridge, async (req, res) => {
  const actionId = requireNeuralActionId(req, res);
  if (!actionId) return;
  const apiUrl = String(process.env.WHATSAPP_API_URL || "").trim();
  const apiToken = String(process.env.WHATSAPP_API_TOKEN || "").trim();
  if (!apiUrl || !apiToken) return res.status(503).json({ error: "Proveedor de WhatsApp no configurado" });
  const to = String(req.body?.to || "").replace(/[^+\d]/g, "");
  const message = String(req.body?.message || req.body?.text || "").trim().slice(0, 4000);
  if (!to || !message) return res.status(400).json({ error: "Faltan destinatario o mensaje" });
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to, message, metadata: { source: "HERENCIA_NEURAL", actionId } }),
      signal: AbortSignal.timeout(15000),
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`WhatsApp provider ${response.status}: ${raw}`);
    let providerResult = raw;
    try { providerResult = raw ? JSON.parse(raw) : { ok: true }; } catch {}
    void emitNeuralBusinessEvent("communication.whatsapp_sent", { actionId, to });
    res.json({ ok: true, actionId, providerResult });
  } catch (error) {
    res.status(502).json({ error: error.message || "No se pudo enviar WhatsApp" });
  }
});

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
    const draft = { id: crypto.randomUUID(), actionId, title: String(req.body?.title || "Neural web draft"), operations, preview, status: "DRAFT", createdAt: new Date().toISOString() };
    await upsertStorageValue("neuralWebDrafts", JSON.stringify([draft, ...drafts].slice(0, 100)));
    res.status(201).json({ draft });
  } catch (error) {
    res.status(400).json({ error: error.message || "No se pudo crear el borrador" });
  }
});

app.post("/api/neural-bridge/web/drafts/:id/operations", requireNeuralBridge, async (req, res) => {
  const actionId = requireNeuralActionId(req, res);
  if (!actionId) return;
  try {
    const operations = Array.isArray(req.body?.operations) ? req.body.operations : [];
    if (!operations.length) return res.status(400).json({ error: "No hay operaciones para aplicar" });
    const drafts = await readNeuralWebDrafts();
    const draft = drafts.find((item) => item.id === req.params.id);
    if (!draft) return res.status(404).json({ error: "Borrador no encontrado" });
    if (draft.status === "PUBLISHED") return res.status(409).json({ error: "Un borrador publicado no se edita; crea una nueva versión" });
    const base = draft.preview && typeof draft.preview === "object"
      ? draft.preview
      : parseStoredJson(await readStorageValue("siteContent"), {});
    draft.preview = applyNeuralWebOperations(base, operations);
    draft.operations = [...(Array.isArray(draft.operations) ? draft.operations : []), ...operations].slice(-500);
    draft.updatedAt = new Date().toISOString();
    draft.lastActionId = actionId;
    await upsertStorageValue("neuralWebDrafts", JSON.stringify(drafts.slice(0, 100)));
    void emitNeuralBusinessEvent("web.draft_updated", { actionId, draftId: draft.id, operationCount: operations.length });
    res.json({ ok: true, actionId, draft });
  } catch (error) {
    res.status(400).json({ error: error.message || "No se pudo actualizar el borrador" });
  }
});

app.get("/api/neural-bridge/web/versions", requireNeuralBridge, async (_req, res) => {
  const history = await readSiteHistory();
  res.json({ versions: history.map(({ content, ...meta }) => meta) });
});

app.post("/api/neural-bridge/web/drafts/:id/publish", requireNeuralBridge, async (req, res) => {
  const actionId = requireNeuralActionId(req, res);
  if (!actionId) return;
  try {
    const drafts = await readNeuralWebDrafts();
    const draft = drafts.find(d => d.id === req.params.id);
    if (!draft) return res.status(404).json({ error: "Borrador no encontrado" });
    const currentRaw = await readStorageValue("siteContent");
    const current = parseStoredJson(currentRaw, {});
    let history = await readSiteHistory();
    history = [{ id: `version-${crypto.randomUUID()}`, at: new Date().toISOString(), label: `Antes de Neural · ${new Date().toLocaleString("es-ES")}`, content: JSON.stringify(current) }, ...history].slice(0, 12);
    while (history.length > 1 && JSON.stringify(history).length > 5_000_000) history = history.slice(0, -1);
    const published = syncNeuralBuilderToLegacy(neuralClone(draft.preview));
    await Promise.all([
      upsertStorageValue("siteContent", JSON.stringify(published)),
      upsertStorageValue("siteContentDraft", JSON.stringify(published)),
      upsertStorageValue("siteContentHistory", JSON.stringify(history)),
    ]);
    if (published?.hero?.imageUrl) await upsertStorageValue("heroBanner", JSON.stringify({ imageUrl: published.hero.imageUrl }));
    if (published?.cta?.imageUrl) await upsertStorageValue("ctaBanner", JSON.stringify({ imageUrl: published.cta.imageUrl }));
    draft.status = "PUBLISHED";
    draft.publishedAt = new Date().toISOString();
    await upsertStorageValue("neuralWebDrafts", JSON.stringify(drafts));
    void emitNeuralBusinessEvent("web.published", { actionId, draftId: draft.id, versionId: history[0]?.id });
    res.json({ ok: true, draftId: draft.id, versionId: history[0]?.id, publishedAt: draft.publishedAt });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo publicar" });
  }
});

app.post("/api/neural-bridge/web/versions/:id/rollback", requireNeuralBridge, async (req, res) => {
  const actionId = requireNeuralActionId(req, res);
  if (!actionId) return;
  try {
    let history = await readSiteHistory();
    const target = history.find(v => v.id === req.params.id);
    if (!target?.content) return res.status(404).json({ error: "Versión no encontrada" });
    const current = parseStoredJson(await readStorageValue("siteContent"), {});
    const restored = parseStoredJson(target.content, null);
    if (!restored) return res.status(409).json({ error: "La versión no contiene un snapshot válido" });
    const safety = { id: `version-${crypto.randomUUID()}`, at: new Date().toISOString(), label: `Antes de rollback Neural · ${new Date().toLocaleString("es-ES")}`, content: JSON.stringify(current) };
    history = [safety, ...history].slice(0, 12);
    await Promise.all([
      upsertStorageValue("siteContent", JSON.stringify(restored)),
      upsertStorageValue("siteContentDraft", JSON.stringify(restored)),
      upsertStorageValue("siteContentHistory", JSON.stringify(history)),
    ]);
    if (restored?.hero?.imageUrl) await upsertStorageValue("heroBanner", JSON.stringify({ imageUrl: restored.hero.imageUrl }));
    if (restored?.cta?.imageUrl) await upsertStorageValue("ctaBanner", JSON.stringify({ imageUrl: restored.cta.imageUrl }));
    void emitNeuralBusinessEvent("web.rollback", { actionId, restoredVersionId: target.id, safetyVersionId: safety.id });
    res.json({ ok: true, restoredVersionId: target.id, safetyVersionId: safety.id });
  } catch (error) {
    res.status(500).json({ error: error.message || "No se pudo restaurar la versión" });
  }
});

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
      headers: { "Content-Type": "application/json", "X-Neural-Admin-Token": adminToken },
      body: ["GET", "HEAD"].includes(method) ? undefined : JSON.stringify(req.body || {}),
      signal: AbortSignal.timeout(Number(process.env.NEURAL_PROXY_TIMEOUT_MS || 45000)),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    return res.send(text);
  } catch (error) {
    console.error("Neural proxy error:", error?.message || error);
    return res.status(502).json({ error: "No se pudo comunicar con HERENCIA Neural" });
  }
});

app.listen(port, () => {
  console.log(`Backend Herencia escuchando en puerto ${port}`);
  const runBackgroundChecks = async () => {
    try { await evaluateDelayedOrders(); } catch (error) { console.warn("Background delayed orders:", error?.message || error); }
    try { await processCustomerReminders(); } catch (error) { console.warn("Background reminders:", error?.message || error); }
  };
  setTimeout(() => void runBackgroundChecks(), 15000);
  setInterval(() => void runBackgroundChecks(), 15 * 60 * 1000);
});
