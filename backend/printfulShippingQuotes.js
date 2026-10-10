/**
 * Printful v2 read-only shipping quotations for an administrator.
 * https://developers.printful.com/docs/v2-preview/#tag/Shipping-Rates-v2
 *
 * This module NEVER imports an order-creation endpoint, creates an order,
 * changes a product, charges a customer or sends a buyer's full address.
 * PRINTFUL_API_TOKEN belongs exclusively in the Railway environment.
 */
import { EU_COUNTRIES } from "./supplierMarketplace.js";

const PRINTFUL_SHIPPING_RATES_URL = "https://api.printful.com/v2/shipping-rates";

function fail(message, statusCode = 422) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

export function printfulConnectionStatus(env = process.env) {
  const token = String(env?.PRINTFUL_API_TOKEN || "").trim();
  const storeId = String(env?.PRINTFUL_STORE_ID || "").trim();
  return {
    configured: Boolean(token) && (!storeId || /^[0-9]{1,20}$/.test(storeId)),
    storeIdConfigured: Boolean(storeId) && /^[0-9]{1,20}$/.test(storeId),
    capabilities: ["shipping_quote_read_only"],
    automaticOrders: false,
    reason: !token ? "Configura PRINTFUL_API_TOKEN en Railway, nunca en el navegador." :
      storeId && !/^[0-9]{1,20}$/.test(storeId) ? "PRINTFUL_STORE_ID debe ser un identificador numérico." :
      "Token disponible en servidor; acceso real pendiente de confirmar mediante una consulta.",
  };
}

export function validatePrintfulShippingInput(input = {}) {
  const rawId = String(input.catalogVariantId ?? "").trim();
  const country = String(input.destination || "").trim().toUpperCase();
  const postalCode = String(input.postalCode || "").trim().toUpperCase();
  // Prevent arbitrary JSON payloads, bulk orders and non-EU destinations.
  if (!/^[1-9][0-9]{0,10}$/.test(rawId) || !Number.isSafeInteger(Number(rawId))) {
    fail("Selecciona el identificador numérico original de una variante Printful.");
  }
  if (!EU_COUNTRIES.includes(country)) fail("El destino debe ser uno de los 27 países de la UE.");
  if (!postalCode || !/^[A-Z0-9][A-Z0-9 -]{0,14}[A-Z0-9]$/.test(postalCode)) {
    fail("Introduce un código postal válido para cotizar el transporte.");
  }
  if (country === "ES" && !/^[0-9]{5}$/.test(postalCode)) {
    fail("El código postal español debe tener cinco dígitos.");
  }
  const quantity = input.quantity === undefined ? 1 : Number(input.quantity);
  if (quantity !== 1) fail("La consulta Printful está limitada a una unidad.");
  return Object.freeze({
    catalogVariantId: Number(rawId),
    destination: country,
    postalCode,
    quantity: 1,
    currency: "EUR",
  });
}

function validEuroRate(rate) {
  const n = typeof rate === "number" ? rate : Number(String(rate ?? "").trim());
  return rate !== "" && rate !== undefined && rate !== null &&
    Number.isFinite(n) && n >= 0 && n < 100000 ? n : null;
}

export function normalizePrintfulShippingResponse(input, providerData, checkedAt = new Date().toISOString()) {
  const request = validatePrintfulShippingInput(input);
  const rows = providerData?.data;
  if (!Array.isArray(rows)) fail("Printful no devolvió métodos de envío verificables.", 502);
  const methods = rows.slice(0, 30).map((row) => {
    const rateEur = validEuroRate(row?.rate);
    if (!row || typeof row !== "object" || String(row.currency || "").toUpperCase() !== "EUR" ||
        rateEur === null || !String(row.shipping || "").trim()) return null;
    const days = Number(row.min_delivery_days);
    const maxDays = Number(row.max_delivery_days);
    return {
      code: String(row.shipping).slice(0, 80),
      name: String(row.shipping_method_name || row.shipping).slice(0, 160),
      rateEur: Math.round(rateEur * 100) / 100,
      currency: "EUR",
      minDeliveryDays: Number.isInteger(days) && days >= 0 && days <= 180 ? days : null,
      maxDeliveryDays: Number.isInteger(maxDays) && maxDays >= 0 && maxDays <= 180 ? maxDays : null,
      customsFeesPossible: Array.isArray(row.shipments) &&
        row.shipments.some(item => item?.customs_fees_possible === true),
    };
  }).filter(Boolean);
  if (!methods.length) fail("Printful no ofrece ninguna tarifa EUR comprobable para esta variante y destino.", 409);
  methods.sort((a, b) => a.rateEur - b.rateEur);
  return {
    ok: true,
    provider: "printful",
    source: "printful_api_v2_shipping_rates",
    checkedAt,
    destination: request.destination,
    postalCode: request.postalCode,
    catalogVariantId: request.catalogVariantId,
    quantity: 1,
    methods: methods.slice(0, 12),
    hasMoreMethods: methods.length > 12,
    supplierProductPriceVerified: false,
    supplierStockVerified: false,
    checkoutEnabled: false,
    automaticOrdersEnabled: false,
    message: "Tarifas reales de envío consultadas en Printful. No incluyen el coste verificado del artículo, impuestos adicionales ni autorización para cobrar o comprar.",
  };
}

/**
 * POST to Printful's documented quotation endpoint is read-only in business
 * effect; it does NOT submit an order. No arbitrary endpoint or bearer token
 * can come from the client or supplier metadata.
 */
export async function quotePrintfulShipping(input, { env = process.env, fetchImpl = fetch, now = () => new Date() } = {}) {
  const data = validatePrintfulShippingInput(input);
  const status = printfulConnectionStatus(env);
  if (!status.configured) fail(status.reason, 503);
  const token = String(env.PRINTFUL_API_TOKEN).trim();
  const storeId = String(env.PRINTFUL_STORE_ID || "").trim();
  const headers = {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(storeId ? { "X-PF-Store-Id": storeId } : {}),
  };
  let response;
  try {
    response = await fetchImpl(PRINTFUL_SHIPPING_RATES_URL, {
      method: "POST",
      redirect: "error",
      headers,
      body: JSON.stringify({
        recipient: { country_code: data.destination, zip: data.postalCode },
        order_items: [{
          source: "catalog",
          quantity: 1,
          catalog_variant_id: data.catalogVariantId,
        }],
        currency: "EUR",
      }),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    fail("No se pudo consultar Printful. No se ha creado ningún pedido.", 502);
  }
  if (response.status === 401 || response.status === 403) {
    fail("Printful rechazó el token o sus permisos; revisa las credenciales en Railway.", 503);
  }
  if (response.status === 429) fail("Printful ha limitado las consultas. Reintenta más tarde.", 429);
  if (!response.ok) {
    // Never echo an upstream HTTP body; it may include supplied inputs.
    fail("Printful no pudo cotizar esta variante. Comprueba si requiere personalización y si existe en tu tienda.", 502);
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    fail("Printful devolvió una cotización que no se puede leer.", 502);
  }
  return normalizePrintfulShippingResponse(data, payload, now().toISOString());
}
