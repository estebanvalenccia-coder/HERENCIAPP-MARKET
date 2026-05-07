import express from "express";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { notifyOrder } from "./emailNotifications.js";
import { setupAIBouquetRoutes } from "./aiBouquetRoutes.js";

const originalJson = express.response.json;
const originalListen = express.application.listen;
let aiBouquetRoutesMounted = false;

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

const sessionSecret =
  process.env.ADMIN_SESSION_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "change-me-in-production";

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

function requireAdminForAI(req, res, next) {
  if (!isValidAdminToken(parseCookies(req).admin_session)) {
    return res.status(401).json({ error: "Acceso de administrador requerido" });
  }
  next();
}

express.application.listen = function patchedListen(...args) {
  if (!aiBouquetRoutesMounted) {
    setupAIBouquetRoutes(this, requireAdminForAI);
    aiBouquetRoutesMounted = true;
    console.log("Rutas IA de ramos conectadas");
  }

  return originalListen.apply(this, args);
};

function mapAdminOrder(order) {
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
    stripePaymentIntentId: order.stripe_payment_intent_id || null,
  };
}

async function enrichOrdersResponse(body) {
  if (!supabase || !body?.orders) return body;

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("No se pudieron enriquecer pedidos admin:", error);
    return body;
  }

  return { orders: (data || []).map(mapAdminOrder) };
}

async function saveStripeOrderDetails(req, body) {
  if (!supabase || !body?.orderId) return;

  const metadata = req.body?.metadata || {};
  const paymentMethod = req.body?.paymentMethod || "stripe";
  const deliveryMethod = req.body?.deliveryMethod || "envio";

  await supabase
    .from("orders")
    .update({ metadata, payment_method: paymentMethod, delivery_method: deliveryMethod, status: "payment_pending" })
    .eq("id", body.orderId);
}

async function notifyPaidStripeOrder(req) {
  if (!supabase) return;

  let event;
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body || {});
    event = JSON.parse(rawBody);
  } catch (error) {
    console.error("No se pudo leer evento Stripe para emails:", error);
    return;
  }

  if (event?.type !== "payment_intent.succeeded") return;

  const orderId = event.data?.object?.metadata?.orderId;
  if (!orderId) return;

  const { data, error } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();

  if (error || !data) {
    console.error("No se pudo cargar el pedido Stripe pagado para emails:", error);
    return;
  }

  await notifyOrder({ ...data, status: "paid" });
}

express.response.json = function patchedJson(body) {
  const req = this.req;

  if (req?.method === "GET" && req?.path === "/api/orders" && body?.orders) {
    enrichOrdersResponse(body)
      .then((enhancedBody) => originalJson.call(this, enhancedBody))
      .catch((error) => {
        console.error("No se pudo devolver pedidos enriquecidos:", error);
        originalJson.call(this, body);
      });
    return this;
  }

  if (req?.method === "POST" && req?.path === "/api/orders" && body?.order) {
    notifyOrder(body.order).catch((error) => {
      console.error("No se pudieron enviar los emails del pedido:", error);
    });
  }

  if (req?.method === "POST" && req?.path === "/api/stripe/create-payment-intent" && body?.orderId) {
    saveStripeOrderDetails(req, body).catch((error) => {
      console.error("No se pudieron guardar los datos del pedido Stripe:", error);
    });
  }

  if (req?.method === "POST" && req?.path === "/api/stripe/webhook" && body?.received) {
    notifyPaidStripeOrder(req).catch((error) => {
      console.error("No se pudieron enviar los emails del pedido Stripe pagado:", error);
    });
  }

  return originalJson.call(this, body);
};
