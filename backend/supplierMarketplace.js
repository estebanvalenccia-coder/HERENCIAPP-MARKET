/**
 * Provider-neutral offer comparison for the 27 EU states. Pure/read-only.
 * An offer is a verified, time-bound supplier quote, NOT a storefront price
 * scraped from an arbitrary product URL. This never places supplier orders.
 */
export const EU_COUNTRIES = Object.freeze([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE",
  "IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE",
]);
export const SUPPLIER_PRESETS = Object.freeze([
  { id:"cj", name:"CJdropshipping", host:"cjdropshipping.com", type:"cj", api:"existing_read_only" },
  { id:"eprolo", name:"EPROLO", host:"eprolo.com", type:"api", api:"authorization_required" },
  { id:"printful", name:"Printful", host:"printful.com", type:"api", api:"authorization_required" },
  { id:"printify", name:"Printify", host:"printify.com", type:"api", api:"authorization_required" },
  { id:"aliexpress", name:"AliExpress", host:"aliexpress.com", type:"api", api:"authorization_required" },
  { id:"alibaba", name:"Alibaba", host:"alibaba.com", type:"api", api:"authorization_required" },
  { id:"bigbuy", name:"BigBuy", host:"bigbuy.eu", type:"api", api:"authorization_required" },
  { id:"escriv", name:"Escriv Ecom", host:"almacen-escriv-ecom.com", type:"manual", api:"unverified" },
  { id:"temu", name:"Temu", host:"temu.com", type:"manual", api:"dropshipping_unverified" },
]);

const finiteNonnegative = (n) => n !== "" && n !== null && n !== undefined &&
  Number.isFinite(Number(n)) && Number(n) >= 0;
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * @param {object} request canonicalProductId, exactVariantKey, destination,
 *   postalCode, quantity, salePriceEur, vatRate, minimumMarginPercent.
 * @param {Array} offers supplier-sourced, already validated offer snapshots.
 * @param {object} options explicit currency rates, nowMs and maximum age.
 */
export function compareSupplierOffers(request = {}, offers = [], options = {}) {
  const country = String(request.destination || "").toUpperCase();
  const postal = String(request.postalCode || "").trim().toUpperCase();
  const qty = Number(request.quantity);
  if (!EU_COUNTRIES.includes(country) || !postal || !Number.isInteger(qty) || qty !== 1 ||
      !String(request.canonicalProductId || "").trim() ||
      !String(request.exactVariantKey || "").trim() ||
      !finiteNonnegative(request.salePriceEur) || Number(request.salePriceEur) <= 0) {
    throw new Error("Indica producto, variante exacta, un país UE, destino, cantidad 1 y precio de venta válido.");
  }
  const now = Number(options.nowMs ?? Date.now());
  const ttl = Math.max(1, Math.min(15 * 60_000, Number(options.maxAgeMs ?? 10 * 60_000)));
  const rates = options.eurPerCurrency && typeof options.eurPerCurrency === "object" ? options.eurPerCurrency : {};
  const vat = Number(request.vatRate ?? 21);
  const margin = Number(request.minimumMarginPercent ?? 25);
  if (!(vat >= 0 && vat <= 40 && margin >= 0 && margin <= 95)) throw new Error("Configuración de IVA o margen inválida.");
  const salesNet = Number(request.salePriceEur) / (1 + vat / 100);
  const compared = (Array.isArray(offers) ? offers : []).map((offer) => {
    const reasons = [];
    const currency = String(offer?.currency || "").toUpperCase();
    const rate = currency === "EUR" ? 1 : Number(rates[currency]);
    const timestamp = Date.parse(String(offer?.checkedAt || ""));
    const exactProduct = String(offer?.canonicalProductId || "") === String(request.canonicalProductId);
    const exactVariant = String(offer?.exactVariantKey || "") === String(request.exactVariantKey);
    if (!exactProduct || !exactVariant) reasons.push("Producto o variante diferente");
    if (offer?.authorizedCatalog !== true) reasons.push("Catálogo no autorizado o no verificado");
    if (offer?.supplierActive !== true || offer?.stockAvailable !== true) reasons.push("Sin proveedor o stock confirmado");
    if (offer?.destination !== country || String(offer?.postalCode || "").trim().toUpperCase() !== postal)
      reasons.push("Transporte no cotizado para esta dirección");
    if (!Number.isFinite(timestamp) || timestamp > now || now - timestamp >= ttl)
      reasons.push("Cotización caducada");
    if (!finiteNonnegative(offer?.productCost) || !finiteNonnegative(offer?.shippingCost) ||
        !finiteNonnegative(offer?.otherCosts)) reasons.push("Costes incompletos");
    if (!Number.isFinite(rate) || rate <= 0 || rate >= 100) reasons.push("Tipo de cambio no verificado");
    const landedCostEur = reasons.length ? null :
      round((Number(offer.productCost) + Number(offer.shippingCost) + Number(offer.otherCosts)) * rate);
    const profitEur = landedCostEur == null ? null : round(salesNet - landedCostEur);
    const marginPercent = profitEur == null ? null : (profitEur / salesNet) * 100;
    if (marginPercent != null && marginPercent < margin) reasons.push("Margen insuficiente");
    const mode = offer?.authorizedOrderApi === true ? "api_ready" : "manual_approval";
    const eligible = reasons.length === 0;
    return {
      supplierId:String(offer?.supplierId || ""),
      supplierName:String(offer?.supplierName || ""),
      supplierVariantId:String(offer?.supplierVariantId || ""),
      currency, mode, eligible, reasons,
      landedCostEur, profitEur, marginPercent:marginPercent == null ? null : round(marginPercent),
      deliveryDays:finiteNonnegative(offer?.deliveryDays) ? Number(offer.deliveryDays) : null,
    };
  });
  const ranked = compared.filter(x=>x.eligible).sort((a,b)=>
    a.landedCostEur-b.landedCostEur ||
    (a.deliveryDays ?? Infinity)-(b.deliveryDays ?? Infinity));
  return { country, postalCode:postal, quantity:qty,
    best:ranked[0] || null, ranked, excluded:compared.filter(x=>!x.eligible),
    // An offer comparison is never an authorization to pay or place orders.
    automaticPurchasesEnabled:false,
  };
}
