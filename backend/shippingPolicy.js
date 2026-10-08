// Shipping settings v2. V1 remains in effect until advancedEnabled is saved.
export const shippingDefaults = {
  advancedEnabled: false,
  enabled: true,
  mode: "distance",
  basePrice: 3.9,
  blockKm: 3,
  blockPrice: 1,
  minimum: 0,
  maximum: 100,
  free: { enabled: false, scope: "none", threshold: 0, categories: [], products: [] },
  categories: {},
  products: {},
  simulation: false
};
const amount = (n) => Math.round(n * 100) / 100;
const nonnegative = (v, name) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error("Valor inválido: " + name);
  return n;
};
export function parseShippingSettings(value) {
  let raw = {};
  try { raw = typeof value === "string" ? JSON.parse(value || "{}") : value || {}; } catch {}
  const free = raw.free && typeof raw.free === "object" ? raw.free : {};
  return { ...shippingDefaults, ...raw, free: { ...shippingDefaults.free, ...free },
    categories: raw.categories && typeof raw.categories === "object" ? raw.categories : {},
    products: raw.products && typeof raw.products === "object" ? raw.products : {} };
}
export function shippingQuoteForCart({ settings, lines = [], distanceKm, legacyPrice = 0 }) {
  const policy = parseShippingSettings(settings);
  if (!policy.advancedEnabled) return amount(nonnegative(legacyPrice, "legacyPrice"));
  if (!Array.isArray(lines)) throw new Error("Carrito inválido");
  const productLines = lines.filter(item => item.type !== "service" && !item.serviceBooking);
  if (!productLines.length) return 0;
  if (!policy.enabled) return 0;
  const free = policy.free;
  const selected = productLines.filter(item => {
    const id = String(item.id || "");
    const category = String(item.category || item.collection || "").toLowerCase();
    const rule = policy.products[id] || policy.categories[category] || {};
    if (rule.shippingEnabled === false) return false;
    if (rule.freeShipping === true) return false;
    if (!free.enabled) return true;
    const included = free.scope === "all" ||
      (free.scope === "categories" && free.categories.includes(category)) ||
      (free.scope === "products" && free.products.map(String).includes(id));
    const subtotal = productLines.reduce((s, row) => s + nonnegative(row.price, "price") * nonnegative(row.quantity || 1, "quantity"), 0);
    return !(included && subtotal >= nonnegative(free.threshold, "threshold"));
  });
  if (!selected.length) return 0;
  const km = nonnegative(distanceKm, "distanceKm");
  let cost = policy.mode === "fixed" ? nonnegative(policy.basePrice, "basePrice") :
    nonnegative(policy.basePrice, "basePrice") + Math.ceil(km / Math.max(0.001, nonnegative(policy.blockKm, "blockKm"))) * nonnegative(policy.blockPrice, "blockPrice");
  cost = Math.max(nonnegative(policy.minimum, "minimum"), cost);
  cost = Math.min(nonnegative(policy.maximum, "maximum"), cost);
  return amount(cost);
}
