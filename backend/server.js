import express from "express";
import cors from "cors";
import Stripe from "stripe";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === "production";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false },
      })
    : null;

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

const publicKeys = new Set([
  "chatboxSettings",
  "herenciaSettings",
  "customTheme",
  "menuIcons",
  "stripeSettings",
  "shippingSettings",
  "adminProducts",
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
  "adminProducts",
  "adminFlowerCosts",
  "adminLatestFlowerQuote",
  "heroBanner",
  "ctaBanner",
  "__backendStorage_test__",
]);

const adminOnlyStorageKeys = [
  "supabaseSettings",
  "aiSettings",
  "heroBanner",
  "ctaBanner",
  "adminFlowerCosts",
  "adminLatestFlowerQuote",
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
  const adminEmail = process.env.ADMIN_ORDER_EMAIL || process.env.ADMIN_EMAIL;
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

  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", req.params.id)
    .select("*")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  res.json({ order: data });
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
  const model = settings.model || (provider === "groq" ? "llama-3.1-70b-versatile" : "gpt-4o-mini");

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
    provider === "groq" ? "llama-3.1-70b-versatile" : "gpt-4o-mini";

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

app.listen(port, () => {
  console.log(`Backend Herencia escuchando en puerto ${port}`);
});
