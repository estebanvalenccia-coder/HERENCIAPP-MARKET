import express from "express";
import { createClient } from "@supabase/supabase-js";
import { notifyOrder } from "./emailNotifications.js";

const originalJson = express.response.json;

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

async function notifyStripeOrder(req, body) {
  if (!supabase || !body?.orderId) return;

  const metadata = req.body?.metadata || {};

  if (Object.keys(metadata).length) {
    await supabase.from("orders").update({ metadata }).eq("id", body.orderId);
  }

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", body.orderId)
    .maybeSingle();

  if (error || !data) {
    console.error("No se pudo cargar el pedido Stripe para emails:", error);
    return;
  }

  await notifyOrder({
    ...data,
    metadata: Object.keys(metadata).length ? metadata : data.metadata,
  });
}

express.response.json = function patchedJson(body) {
  const req = this.req;

  if (req?.method === "POST" && req?.path === "/api/orders" && body?.order) {
    notifyOrder(body.order).catch((error) => {
      console.error("No se pudieron enviar los emails del pedido:", error);
    });
  }

  if (req?.method === "POST" && req?.path === "/api/stripe/create-payment-intent" && body?.orderId) {
    notifyStripeOrder(req, body).catch((error) => {
      console.error("No se pudieron enviar los emails del pedido Stripe:", error);
    });
  }

  return originalJson.call(this, body);
};
