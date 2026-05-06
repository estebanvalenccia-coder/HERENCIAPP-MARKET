import express from "express";
import { createClient } from "@supabase/supabase-js";
import { notifyOrder } from "./emailNotifications.js";

const originalJson = express.response.json;

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

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

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) {
    console.error("No se pudo cargar el pedido Stripe pagado para emails:", error);
    return;
  }

  await notifyOrder({ ...data, status: "paid" });
}

express.response.json = function patchedJson(body) {
  const req = this.req;

  if (req?.method === "POST" && req?.path === "/api/orders" && body?.order) {
    notifyOrder(body.order).catch((error) => {
      console.error("No se pudieron enviar los emails del pedido:", error);
    });
  }

  if (req?.method === "POST" && req?.path === "/api/stripe/webhook" && body?.received) {
    notifyPaidStripeOrder(req).catch((error) => {
      console.error("No se pudieron enviar los emails del pedido Stripe pagado:", error);
    });
  }

  return originalJson.call(this, body);
};
