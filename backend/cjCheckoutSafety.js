// CJ-only checkout verification. All supplier requests are read-only. Never creates orders.
import { verifyCjVariantPrice, quoteCjVariantShipping } from "./cjCatalogImporter.js";
import { extractCjProductId } from "./cjProductIds.js";
import { estimateCjProfitability, getUsdToEurRate } from "./cjProfitability.js";
import { resolveCjPurchasedVariant, assertCjSupplierIdentity } from "./cjVariantIdentity.js";

function invalid(message) {
  const error = new Error(message);
  error.statusCode = 409;
  throw error;
}
function isCjProduct(product) {
  const meta = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};
  let host = String(meta.sourceHost || "").toLowerCase().replace(/^www\./, "");
  if (!host && meta.sourceProductUrl) {
    try { host = new URL(meta.sourceProductUrl).hostname.toLowerCase().replace(/^www\./, ""); } catch {}
  }
  return host === "cjdropshipping.com" && String(meta.fulfillmentType || "").toLowerCase() === "dropship";
}
function countryCode(value) {
  const v=String(value || "").trim().toLowerCase();
  if (v==="es"||v==="españa"||v==="spain") return "ES";
  return v.toUpperCase();
}
export function canProceedWithVerifiedCjCosts({ profitability, promotionAuthorized = false, discount = 0 } = {}) {
  return Boolean(profitability?.available) &&
    (Boolean(profitability?.feasible) || (promotionAuthorized === true && Number(discount) > 0));
}

export async function evaluateCjCheckout({ lines, catalog, shippingAddress, discount = 0, promotionAuthorized = false, suppliers = [], deps = {} } = {}) {
  const byId = new Map((Array.isArray(catalog) ? catalog : []).map((p) => [String(p?.id || ""),p]));
  const items = Array.isArray(lines) ? lines : [];
  const cjItems = items.filter((item) => isCjProduct(byId.get(String(item?.id || ""))));
  if (!cjItems.length) return { cjOnly: false };
  if (cjItems.length !== items.length) invalid("Los productos de CJ y el reparto local de Herencia requieren pedidos separados por ahora.");
  if (cjItems.length !== 1 || Number(cjItems[0]?.quantity || 0) !== 1) {
    invalid("CJdropshipping requiere una unidad por pedido en esta fase de pruebas. Divide la compra para calcular el transporte correcto.");
  }
  if (countryCode(shippingAddress?.country) !== "ES") invalid("Este artículo de CJ solo tiene envío configurado a España.");
  if (!/^\d{5}$/.test(String(shippingAddress?.postalCode || "").trim())) invalid("Introduce un código postal español válido de 5 dígitos para el envío CJ.");
  const item = cjItems[0];
  const product = byId.get(String(item.id));
  const meta = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};
  const supplier = suppliers.find((entry)=>String(entry.id)===String(meta.supplierId || ""));
  if (!supplier || supplier.active === false || supplier.integrationType !== "cj") invalid("La conexión del proveedor CJ no está disponible.");
  // Resolve from the server-side persisted variants, never the cart's VID/SKU.
  const identity = resolveCjPurchasedVariant(product, item.selectedVariant);
  const vid = identity.vid;
  const logisticName = String(meta.cjPreferredLogisticName || "").trim();
  if (!logisticName) invalid("Este artículo CJ todavía necesita un transportista válido.");
  // Parallel read-only lookups. No personal name, phone or street address goes to CJ.
  const pid = extractCjProductId(meta.sourceProductUrl);
  if (!pid) invalid("Falta el producto de origen CJ para verificar su variante.");
  // Diagnostic messages are deliberately generic: never leak supplier API payloads or credentials.
  const checks = await Promise.allSettled([
    (deps.verifyVariant || verifyCjVariantPrice)({ pid, vid }),
    (deps.quoteShipping || quoteCjVariantShipping)({vid, quantity:1, origin:"CN", destination:"ES",zip:String(shippingAddress.postalCode)}),
    (deps.getRate || getUsdToEurRate)(),
  ]);
  const failure = checks.findIndex((check) => check.status === "rejected");
  if (failure !== -1) {
    const reasons = [
      "CJ no pudo verificar la variante y su precio actual.",
      "CJ no pudo cotizar el transporte para el código postal indicado.",
      "No se pudo verificar el cambio de dólares a euros.",
    ];
    const reason = checks[failure].reason;
    if (reason?.code === "CJ_RATE_LIMITED" || reason?.code === "CJ_QUOTA_EXHAUSTED" ||
        Number(reason?.upstreamCode) === 1600200 || Number(reason?.upstreamHttpStatus) === 429) {
      console.warn("[cj.checkout] CJ API throttled", {
        step: ["variant", "shipping", "fx"][failure],
        code: String(reason?.code || "CJ_RATE_LIMITED").slice(0, 35),
      });
      const error = new Error(reason?.code === "CJ_QUOTA_EXHAUSTED"
        ? "CJdropshipping ha agotado temporalmente su cuota de API. El código postal es correcto, pero el proveedor no permite cotizar el transporte ahora. No se realizará ningún cobro."
        : "CJdropshipping está limitando temporalmente las solicitudes de transporte (API 429). No es un problema con tu código postal. Inténtalo más tarde; no se realizará ningún cobro.");
      error.code = reason?.code || "CJ_RATE_LIMITED";
      error.statusCode = 503;
      throw error;
    }
    // No API key, customer address, request payload or CJ response bodies in logs.
    console.warn("[cj.checkout] supplier validation failed", {
      step: ["variant", "shipping", "fx"][failure],
      code: String(reason?.code || "UPSTREAM_UNAVAILABLE").replace(/[^A-Z0-9_]/gi, "").slice(0, 60),
      upstreamHttpStatus: Number(reason?.upstreamHttpStatus) || undefined,
      upstreamCode: Number(reason?.upstreamCode) || undefined,
    });
    invalid(reasons[failure] + " No se realizará ningún cobro.");
  }
  const [selectedVariant, freight, fx] = checks.map((check) => check.value);
  if (!Array.isArray(freight?.methods)) invalid("CJ no devolvió tarifas de transporte válidas. No se realizará ningún cobro.");
  if (!Number.isFinite(Number(fx?.rate)) || Number(fx.rate) <= 0) invalid("El cambio USD/EUR devuelto no es válido. No se realizará ningún cobro.");
  if (!selectedVariant || selectedVariant.priceUsd == null) invalid("CJ no confirmó el coste de la variante seleccionada.");
  assertCjSupplierIdentity(identity, selectedVariant);
  if (freight.vid !== vid || freight.destination !== "ES" || String(freight.zip || "") !== String(shippingAddress.postalCode)) invalid("La cotización CJ no coincide con la variante o el destino.");
  const selectedFreight = freight.methods.find((entry)=>entry.name===logisticName);
  if (!selectedFreight || selectedFreight.totalPostageUsd==null) invalid("El transportista CJ guardado no tiene un coste de envío completo para este código postal.");
  const effectiveUnitPrice = Number(item.price || 0) - Math.max(0, Number(discount || 0));
  const profitability = estimateCjProfitability({
    salePriceEur: effectiveUnitPrice, productUsd:selectedVariant.priceUsd,
    postageUsd:selectedFreight.totalPostageUsd,usdEurRate:fx.rate,
    vatRate:Number(product.iva ?? product.taxRate ?? 21),
    minMarginPercent:Math.max(0,Number(supplier.minMarginPercent ?? 30)),
  });
  // Verified admin coupons are explicit store-funded promotions. Product and
  // freight prices MUST still be verified; only the minimum-margin requirement
  // can be waived, and never from client-controlled discount metadata alone.
  const storeFundedPromotion = promotionAuthorized === true && Number(discount) > 0;
  if (!canProceedWithVerifiedCjCosts({ profitability, promotionAuthorized, discount })) {
    invalid("No se puede cobrar este artículo CJ con el precio actual: el coste con transporte e impuestos supera el margen mínimo. Revisa su precio en Administración.");
  }
  return {
    cjOnly:true, profitability, storeFundedPromotion,
    verifiedQuote: {
      ...profitability,
      available: true, vid:identity.vid, sku:identity.sku,
      selectedVariant:identity.name, destination:"ES", postalCode:String(shippingAddress.postalCode).trim(),
      methodName: logisticName, checkedAt:new Date().toISOString(),
    },
    shippingQuote: {
      ok:true, price:0, currency:"EUR", distanceKm:0, distanceText:"Envío directo CJ",
      durationText:String(selectedFreight.time || ""),
      destination:"España", origin:"Proveedor CJdropshipping",
      deliveryProvider:"cj", logisticName, quotedAt:new Date().toISOString(),
      warning:storeFundedPromotion
        ? "Cupón autorizado: Herencia asume la diferencia de coste del proveedor y el envío."
        : "El transporte del proveedor está incluido en el precio de venta. Se revisará antes del cumplimiento.",
    },
  };
}
