/**
 * Resolve the *actual* customer-selected CJ option against the authoritative
 * Neon catalog. Never synthesize a supplier combination or trust cart VID/SKU.
 * Pure utility: no network access and no ability to purchase.
 */
export function resolveCjPurchasedVariant(product, selectedName = "") {
  const metadata = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const selection = String(selectedName || "").trim();
  const fail = (message) => {
    const error = new Error(message);
    error.statusCode = 409;
    throw error;
  };

  if (variants.length) {
    if (!selection && variants.length > 1) fail("Selecciona una combinación CJ antes del pago.");
    const match = variants.find((v) => String(v?.name || v).trim() === selection) ||
      (!selection && variants.length === 1 ? variants[0] : null);
    if (!match) fail("La combinación seleccionada no existe en el catálogo CJ.");
    const vid = String(match.supplierVariantId || "").trim();
    const sku = String(match.supplierSku || "").trim();
    if (!vid || !sku) fail("La combinación CJ no tiene VID y SKU auténticos.");
    const duplicated = variants.some((v, index) => index !== variants.indexOf(match) &&
      (String(v?.supplierVariantId || "").trim() === vid ||
       (String(v?.name || v).trim() === String(match.name || match).trim())));
    if (duplicated) fail("El catálogo CJ tiene variantes duplicadas. Revisa el producto.");
    return { vid, sku, name: String(match.name || match).trim(), origin: "variant" };
  }

  // Legacy single-option catalog, without a variants array.
  if (selection) fail("No existe una variante CJ autorizada con ese nombre.");
  const vid = String(metadata.supplierVariantId || metadata.cjVid || "").trim();
  const sku = String(metadata.supplierSku || metadata.cjSku || "").trim();
  if (!vid || !sku) fail("Falta el VID o SKU del producto CJ sin variantes.");
  return { vid, sku, name: "", origin: "legacy" };
}

export function assertCjSupplierIdentity(identity, verification) {
  if (!identity?.vid || !identity?.sku ||
      String(verification?.vid || "").trim() !== identity.vid ||
      String(verification?.sku || "").trim() !== identity.sku) {
    const error = new Error("El proveedor no confirmó el VID y SKU exactos. No se realizará ningún cobro.");
    error.statusCode = 409;
    throw error;
  }
  return true;
}

/** A quote belongs to one exact selection, shipping address and method. */
export function verifiedCjQuoteMatches({ quote, identity, destination = "ES", postalCode = "", methodName = "", salePriceEur, nowMs = Date.now(), maxAgeMs = 15 * 60_000 } = {}) {
  const timestamp = Date.parse(String(quote?.checkedAt || ""));
  return Boolean(quote?.available === true && identity?.vid && identity?.sku &&
    String(quote.vid || "") === identity.vid &&
    String(quote.sku || "") === identity.sku &&
    String(quote.selectedVariant || "") === identity.name &&
    String(quote.destination || "") === destination &&
    String(quote.postalCode || "") === String(postalCode || "").trim() &&
    String(quote.methodName || "") === methodName &&
    Number.isFinite(timestamp) && nowMs >= timestamp && nowMs - timestamp < maxAgeMs &&
    Number.isFinite(Number(quote.costEur)) && Number(quote.costEur) > 0 &&
    Number.isFinite(Number(quote.supplierTotalUsd)) && Number(quote.supplierTotalUsd) > 0 &&
    Number.isFinite(Number(salePriceEur)) &&
    Math.abs(Number(quote.salePriceEur) - Number(salePriceEur)) < 0.02);
}
