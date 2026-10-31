/**
 * Local collection is independent of carrier APIs and never creates a parcel label.
 * Only merchant-fulfilled physical products can be collected in Horta.
 * Everything is re-checked server-side when a payment/order is priced.
 */
export const DEFAULT_LOCAL_PICKUP = Object.freeze({
  enabled: false,
  label: "Recogida en Horta, Barcelona",
  instructions: "Te contactaremos para acordar el punto exacto y el horario de recogida.",
});

export function localPickupSettings(shippingSettings = {}) {
  const saved = shippingSettings?.localPickup || {};
  return {
    enabled: saved.enabled === true,
    label: String(saved.label || DEFAULT_LOCAL_PICKUP.label).slice(0, 120),
    instructions: String(saved.instructions || DEFAULT_LOCAL_PICKUP.instructions).slice(0, 400),
  };
}

const supplierFulfilled = (product = {}) => {
  const fields = [
    product?.supplier, product?.supplierType, product?.supplierSource,
    product?.provider, product?.fulfillmentProvider,
    product?.metadata?.provider, product?.metadata?.supplier,
    product?.metadata?.supplierType, product?.metadata?.fulfillmentProvider,
  ].filter(Boolean).map(value => String(value).toLowerCase());
  return fields.some(value => /cj|aliexpress|printful|dropship|external|supplier/.test(value));
};

export function verifyLocalPickup({ shippingSettings, shippingChoice, lines = [], catalog = [] }) {
  const method = String(shippingChoice?.method || "delivery");
  if (method !== "local_pickup") {
    if (method !== "delivery") throw new Error("Método de entrega desconocido");
    return null;
  }
  const settings = localPickupSettings(shippingSettings);
  if (!settings.enabled) throw new Error("La recogida en Horta no está habilitada");
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("No hay productos para recoger");

  const byId = new Map((catalog || []).map(product => [String(product.id), product]));
  for (const line of lines) {
    const product = byId.get(String(line.id));
    if (!product || product.active === false || product.deletedAt) {
      throw new Error("Producto no disponible para recogida");
    }
    if (
      line.serviceBooking === true || line.type === "service" ||
      product.serviceBooking === true || product.type === "service" ||
      String(product.category || "").toLowerCase() === "servicios" ||
      supplierFulfilled(product)
    ) {
      throw new Error("La recogida en Horta solo está disponible para productos propios");
    }
  }
  return {
    method: "local_pickup", label: settings.label,
    instructions: settings.instructions, price: 0,
  };
}
