import ws from "ws";
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
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } })
  : null;

const allowedOrigins = (process.env.CORS_ORIGIN || "https://www.herenciamarket.es,https://herenciamarket.es")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const adminUsername = process.env.ADMIN_USERNAME || "Daniel";
const adminPassword = process.env.ADMIN_PASSWORD || "13101098";
const sessionSecret = process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "change-me-in-production";
const publicKeys = new Set(["chatboxSettings", "herenciaSettings", "customTheme", "menuIcons", "stripeSettings", "shippingSettings", "adminProducts"]);
const privateVisitorKeys = new Set(["cart", "user"]);
const protectedKeys = new Set(["chatboxSettings", "herenciaSettings", "customTheme", "menuIcons", "stripeSettings", "supabaseSettings", "shippingSettings", "aiSettings", "adminProducts", "heroBanner", "ctaBanner"]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true,
}));

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).send("Stripe webhook no configurado");

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return res.status(400).send(`Webhook inválido: ${error.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    const orderId = paymentIntent.metadata?.orderId;
    if (orderId && supabase) {
      await supabase.from("orders").update({ status: "paid", stripe_payment_intent_id: paymentIntent.id }).eq("id", orderId);
    }
  }

  res.json({ received: true });
});

app.use(express.json({ limit: "10mb" }));

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map((part) => {
    const [name, ...rest] = part.trim().split("=");
    return [decodeURIComponent(name), decodeURIComponent(rest.join("="))];
  }));
}

function sign(value) {
  return crypto.createHmac("sha256", sessionSecret).update(value).digest("hex");
}

function createAdminToken() {
  const payload = Buffer.from(JSON.stringify({ role: "admin", iat: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function isValidAdminToken(token) {
  if (!token || !token.includes(".")) return false;
  const [payload, signature] = token.split(".");
  if (signature !== sign(payload)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
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
  if (!isAdmin(req)) return res.status(401).json({ error: "Acceso de administrador requerido" });
  next();
}

function cookieOptions(maxAgeSeconds) {
  return `HttpOnly; Path=/; Max-Age=${maxAgeSeconds}; SameSite=${isProduction ? "None" : "Lax"}${isProduction ? "; Secure" : ""}`;
}

function getVisitorId(req, res) {
  const cookies = parseCookies(req);
  let visitorId = cookies.visitor_id;
  if (!visitorId || !/^[a-f0-9-]{36}$/i.test(visitorId)) {
    visitorId = crypto.randomUUID();
    res.setHeader("Set-Cookie", `visitor_id=${encodeURIComponent(visitorId)}; ${cookieOptions(60 * 60 * 24 * 365)}`);
  }
  return visitorId;
}

function storageKeyFor(req, res, key) {
  if (privateVisitorKeys.has(key)) return `visitor:${getVisitorId(req, res)}:${key}`;
  return key;
}

function requireSupabase(res) {
  if (!supabase) {
    res.status(503).json({ error: "Supabase no está configurado en el backend" });
    return false;
  }
  return true;
}

function sanitizeValueForClient(key, value, admin = false) {
  if (!value) return value;
  if (key === "aiSettings") {
    try {
      const parsed = JSON.parse(value || "{}");
      return JSON.stringify({ ...parsed, apiKey: admin ? parsed.apiKey ? "••••••••" : "" : "" });
    } catch {
      return value;
    }
  }
  if (key === "supabaseSettings") {
    try {
      const parsed = JSON.parse(value || "{}");
      return JSON.stringify({ ...parsed, serviceRoleKey: "" });
    } catch {
      return value;
    }
  }
  return value;
}

async function readStorageValue(key) {
  const { data, error } = await supabase.from("app_storage").select("value").eq("key", key).maybeSingle();
  if (error) throw error;
  return data?.value || null;
}

async function upsertStorageValue(key, value) {
  const { error } = await supabase.from("app_storage").upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "Herencia backend" }));

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username !== adminUsername || password !== adminPassword) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  res.setHeader("Set-Cookie", `admin_session=${encodeURIComponent(createAdminToken())}; ${cookieOptions(60 * 60 * 12)}`);
  res.json({ ok: true });
});

app.post("/api/admin/logout", (_req, res) => {
  res.setHeader("Set-Cookie", `admin_session=; ${cookieOptions(0)}`);
  res.json({ ok: true });
});

app.get("/api/admin/session", (req, res) => res.json({ authenticated: isAdmin(req) }));

app.get("/api/storage", async (req, res) => {
  if (!requireSupabase(res)) return;
  const keys = [...publicKeys];
  const visitorId = getVisitorId(req, res);
  const scopedVisitorKeys = [...privateVisitorKeys].map((key) => `visitor:${visitorId}:${key}`);
  if (isAdmin(req)) keys.push("supabaseSettings", "aiSettings", "heroBanner", "ctaBanner");

  const { data, error } = await supabase.from("app_storage").select("key,value").in("key", [...keys, ...scopedVisitorKeys]);
  if (error) return res.status(500).json({ error: error.message });

  const response = {};
  for (const row of data || []) {
    let key = row.key;
    if (key.startsWith(`visitor:${visitorId}:`)) key = key.split(":").pop();
    response[key] = sanitizeValueForClient(key, row.value, isAdmin(req));
  }
  res.json({ data: response });
});

app.get("/api/storage/:key", async (req, res) => {
  if (!requireSupabase(res)) return;
  const key = req.params.key;
  if (protectedKeys.has(key) && !publicKeys.has(key) && !isAdmin(req)) return res.status(401).json({ error: "Acceso de administrador requerido" });
  try {
    const value = await readStorageValue(storageKeyFor(req, res, key));
    res.json({ value: sanitizeValueForClient(key, value, isAdmin(req)) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/storage/:key", async (req, res) => {
  if (!requireSupabase(res)) return;
  const key = req.params.key;
  if (protectedKeys.has(key) && !isAdmin(req)) return res.status(401).json({ error: "Acceso de administrador requerido" });
  if (!protectedKeys.has(key) && !privateVisitorKeys.has(key)) return res.status(403).json({ error: "Clave no permitida" });

  try {
    let { value } = req.body;
    if (key === "aiSettings") {
      const current = await readStorageValue(key);
      const currentJson = current ? JSON.parse(current) : {};
      const incomingJson = value ? JSON.parse(value) : {};
      if (!incomingJson.apiKey || incomingJson.apiKey === "••••••••") incomingJson.apiKey = currentJson.apiKey || "";
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
  if (protectedKeys.has(key) && !isAdmin(req)) return res.status(401).json({ error: "Acceso de administrador requerido" });
  if (!protectedKeys.has(key) && !privateVisitorKeys.has(key)) return res.status(403).json({ error: "Clave no permitida" });
  const { error } = await supabase.from("app_storage").delete().eq("key", storageKeyFor(req, res, key));
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

app.get("/api/settings/public", async (_req, res) => {
  if (!requireSupabase(res)) return;
  const keys = ["chatboxSettings", "herenciaSettings", "customTheme", "menuIcons", "stripeSettings", "shippingSettings"];
  const { data, error } = await supabase.from("app_storage").select("key,value").in("key", keys);
  if (error) return res.status(500).json({ error: error.message });
  const settings = Object.fromEntries((data || []).map((row) => {
    try { return [row.key, JSON.parse(sanitizeValueForClient(row.key, row.value))]; } catch { return [row.key, row.value]; }
  }));
  res.json({ settings });
});

app.get("/api/orders", requireAdmin, async (_req, res) => {
  if (!requireSupabase(res)) return;
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const orders = (data || []).map((order) => ({
    id: order.id,
    customerName: order.customer_name || "Cliente",
    customerEmail: order.customer_email || "",
    items: order.items || [],
    total: Number(order.total || 0),
    paymentMethod: order.payment_method,
    status: order.status,
    date: order.created_at,
  }));
  res.json({ orders });
});

app.post("/api/orders", async (req, res) => {
  if (!requireSupabase(res)) return;
  const order = req.body;
  const id = order.id || crypto.randomUUID();
  const { data, error } = await supabase.from("orders").insert({
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
  }).select("*").single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ order: data });
});

app.patch("/api/orders/:id/status", requireAdmin, async (req, res) => {
  if (!requireSupabase(res)) return;
  const { status } = req.body;
  const { data, error } = await supabase.from("orders").update({ status }).eq("id", req.params.id).select("*").single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ order: data });
});

app.post("/api/ai/plant-description", async (req, res) => {
  if (!requireSupabase(res)) return;
  const { plantName, baseDescription = "" } = req.body;
  const { data } = await supabase.from("app_storage").select("value").eq("key", "aiSettings").maybeSingle();
  let settings = {};
  try { settings = JSON.parse(data?.value || "{}"); } catch {}

  if (!settings.enabled || !settings.apiKey) return res.status(400).json({ error: "IA no configurada en backend" });

  const provider = settings.provider === "openai" ? "openai" : "groq";
  const endpoint = provider === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
  const model = provider === "groq" ? "llama-3.1-70b-versatile" : "gpt-4o-mini";
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
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${settings.apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Genera información completa sobre la planta "${plantName}". ${baseDescription ? `Información adicional: ${baseDescription}` : ""}` },
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
  const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  res.json({ result: JSON.parse(cleanContent) });
});

app.post("/api/stripe/create-payment-intent", async (req, res) => {
  if (!requireSupabase(res)) return;
  if (!stripe) return res.status(503).json({ error: "Stripe no está configurado en el backend" });

  const { amount, currency = "eur", items = [], customerEmail, customerName, deliveryMethod = "envio", shipping = 0, subtotal = 0 } = req.body;
  const totalCents = Math.round(Number(amount) * 100);
  if (!Number.isFinite(totalCents) || totalCents < 50) return res.status(400).json({ error: "Importe inválido para Stripe" });

  const orderId = crypto.randomUUID();
  const { error: orderError } = await supabase.from("orders").insert({
    id: orderId,
    customer_email: customerEmail || null,
    customer_name: customerName || null,
    payment_method: "stripe",
    delivery_method: deliveryMethod,
    status: "payment_pending",
    subtotal,
    shipping,
    total: Number(amount),
    items,
    metadata: { source: "frontend_checkout" },
  });
  if (orderError) return res.status(500).json({ error: orderError.message });

  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalCents,
    currency,
    receipt_email: customerEmail || undefined,
    metadata: { orderId },
    automatic_payment_methods: { enabled: true },
  });

  await supabase.from("orders").update({ stripe_payment_intent_id: paymentIntent.id }).eq("id", orderId);
  res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id, orderId });
});

app.listen(port, () => console.log(`Backend Herencia escuchando en puerto ${port}`));
