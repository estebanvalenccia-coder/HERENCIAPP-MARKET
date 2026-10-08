// CJ-only checkout verification. All supplier requests are read-only. Never creates orders.
import { verifyCjVariantPrice, quoteCjVariantShipping } from "./cjCatalogImporter.js";
import { estimateCjProfitability, getUsdToEurRate } from "./cjProfitability.js";

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
export async function evaluateCjCheckout({ lines, catalog, shippingAddress, discount = 0, promotionAuthorized = false, suppliers = [] } = {}) {
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
  const vid = String(meta.supplierVariantId || meta.cjVid || "").trim();
  const logisticName = String(meta.cjPreferredLogisticName || "").trim();
  if (!vid || !logisticName) invalid("Este artículo CJ todavía necesita una variante y transportista válidos.");
  if (String(item.selectedVariant || "").trim()) {
    const chosen=String(item.selectedVariant).toLowerCase().trim();
    const sku=String(meta.supplierSku || "").toLowerCase().trim();
    const suffix=sku.includes("-")?sku.split("-").slice(1).join("-"):"";
    if (!suffix || !(suffix.includes(chosen)||chosen.includes(suffix))) invalid("La variante seleccionada no está asociada a un SKU CJ válido.");
  }
  // Parallel read-only lookups. No personal name, phone or street address goes to CJ.
  const pid = (()=>{try{return new URL(meta.sourceProductUrl).pathname.match(/-p-([0-9a-f]{8}-[0-9a-f-]{27,})\.html$/i)?.[1]||"";}catch{return "";}})();
  if (!pid) invalid("Falta el producto de origen CJ para verificar su variante.");
  // Diagnostic messages are deliberately generic: never leak supplier API payloads or credentials.
  const checks = await Promise.allSettled([
    verifyCjVariantPrice({ pid, vid }),
    quoteCjVariantShipping({vid, quantity:1, origin:"CN", destination:"ES",zip:String(shippingAddress.postalCode)}),
    getUsdToEurRate(),
  ]);
  const failure = checks.findIndex((check) => check.status === "rejected");
  if (failure !== -1) {
    const reasons = [
      "CJ no pudo verificar la variante y su precio actual.",
      "CJ no pudo cotizar el transporte para el código postal indicado.",
      "No se pudo verificar el cambio de dólares a euros.",
    ];
    const reason = checks[failure].reason;
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
  if (!profitability.available || (!profitability.feasible && !storeFundedPromotion)) {
    invalid("No se puede cobrar este artículo CJ con el precio actual: el coste con transporte e impuestos supera el margen mínimo. Revisa su precio en Administración.");
  }
  return {
    cjOnly:true, profitability, storeFundedPromotion,
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
