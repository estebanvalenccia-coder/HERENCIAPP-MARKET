import express from "express";
import { notifyOrder } from "./emailNotifications.js";

const originalJson = express.response.json;

express.response.json = function patchedJson(body) {
  const req = this.req;

  if (req?.method === "POST" && req?.path === "/api/orders" && body?.order) {
    notifyOrder(body.order).catch((error) => {
      console.error("No se pudieron enviar los emails del pedido:", error);
    });
  }

  return originalJson.call(this, body);
};
