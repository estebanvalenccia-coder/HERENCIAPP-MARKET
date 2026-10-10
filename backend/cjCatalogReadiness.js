// Supplier read-only health report. This never mutates retail prices, inventory,
// availability, order queues, payment state or CJ supplier orders.
const finite = value => value !== "" && value !== undefined && value !== null &&
  Number.isFinite(Number(value)) && Number(value) >= 0;
const round = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
export function assessCjCatalogReadiness({ product = {}, metadata = {}, variant = {}, stock = null, fx = null, origin = "CN" } = {}) {
  const problems = [];
  const vid = String(variant?.vid || "").trim();
  const sku = String(variant?.sku || "").trim();
  const savedVid = String(metadata.supplierVariantId || metadata.cjVid || "").trim();
  const savedSku = String(metadata.supplierSku || metadata.cjSku || "").trim();
  const salePriceEur = product.onSale && product.salePrice != null ? Number(product.salePrice) : Number(product.price);
  const supplierPriceUsd = finite(variant.priceUsd) ? Number(variant.priceUsd) : null;
  const rate = fx && Number(fx.rate) > 0 ? Number(fx.rate) : null;
  const verifiedStock = stock?.verified === true && stock?.vid === vid && stock?.origin === origin;
  const quantity = verifiedStock && Number.isSafeInteger(stock?.quantity) && stock.quantity >= 0 ? stock.quantity : null;
  const mapped = Array.isArray(product.variants) && product.variants.some(row =>
    String(row?.supplierVariantId || row?.cjVid || "") === vid &&
    String(row?.supplierSku || row?.cjSku || "") === sku);
  if (!vid || !sku) problems.push("CJ no confirmó VID y SKU completos para esta variante.");
  if (savedVid !== vid || savedSku !== sku) problems.push("La variante consultada no coincide con el VID/SKU guardado; revisa «Conectar».");
  if (Array.isArray(product.variants) && product.variants.length && !mapped)
    problems.push("La variante de CJ no coincide con las variantes configuradas en la ficha pública.");
  if (supplierPriceUsd === null) problems.push("CJ no devolvió un precio de proveedor verificable.");
  if (!Number.isFinite(salePriceEur) || salePriceEur <= 0) problems.push("El precio de venta al público no es válido.");
  if (!verifiedStock || quantity === null) problems.push("Stock del almacén sin verificar: no publiques existencias supuestas.");
  else if (quantity === 0) problems.push("La variante está sin existencias en el almacén consultado.");
  if (!rate) problems.push("No se pudo verificar el cambio USD/EUR.");
  const baseCostEur = supplierPriceUsd !== null && rate ? round(supplierPriceUsd * rate) : null;
  return {
    provider: "cj", source: "cj_api", checkedAt: new Date().toISOString(),
    origin, vid, sku, savedVidMatches: savedVid === vid, savedSkuMatches: savedSku === sku,
    publicVariantMapped: mapped, salePriceEur: Number.isFinite(salePriceEur) ? salePriceEur : null,
    supplierPriceUsd, supplierBaseEur: baseCostEur, // EXCLUDES shipping, fees and VAT
    supplierBaseCostIncludesShipping: false,
    stock: { verified: verifiedStock && quantity !== null, quantity, available: quantity !== null && quantity > 0 },
    productDataValid: problems.length === 0, issues: problems,
    shippingVerified: false, checkoutEnabled: false, automaticOrdersEnabled: false, automaticStockWrite: false,
    message: problems.length
      ? "Hay bloqueos o datos pendientes. La consulta no modifica la tienda ni activa pedidos."
      : "Datos básicos verificados. Falta validar transporte y margen para la dirección real de cada cliente antes de vender.",
  };
}
