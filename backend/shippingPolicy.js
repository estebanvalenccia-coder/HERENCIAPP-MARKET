// Shared pure shipping policy engine; payment totals are always recalculated by the backend.
export const shippingDefaults = {
  advancedEnabled: false, enabled: true, mode: "distance",
  basePrice: 3.9, blockKm: 3, blockPrice: 1,
  minimum: 0, maximum: 100,
  tiers: [],
  free: { enabled: false, scope: "none", threshold: 0, categories: [], products: [] },
  categories: {}, products: {}, simulation: false
};
const euro = n => Math.round((n + Number.EPSILON) * 100) / 100;
const numeric = (value, label) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error("Valor de envío inválido: " + label);
  return n;
};
const key = value => String(value ?? "").trim().toLowerCase();
export function parseShippingSettings(value) {
  let raw = {};
  try { raw = typeof value === "string" ? JSON.parse(value || "{}") : value || {}; } catch {}
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) raw = {};
  const free = raw.free && typeof raw.free === "object" ? raw.free : {};
  const objects = field => raw[field] && typeof raw[field] === "object" && !Array.isArray(raw[field]) ? raw[field] : {};
  return { ...shippingDefaults, ...raw,
    free: { ...shippingDefaults.free, ...free },
    categories: objects("categories"), products: objects("products"),
    tiers: Array.isArray(raw.tiers) ? raw.tiers : [] };
}
export function validateShippingSettings(input) {
  const s = parseShippingSettings(input);
  if (!["fixed", "distance", "tiers"].includes(s.mode)) throw new Error("Tipo de tarifa inválido");
  for (const field of ["basePrice","blockPrice","minimum","maximum"]) numeric(s[field], field);
  if (s.maximum < s.minimum) throw new Error("El máximo es inferior al mínimo");
  if (numeric(s.blockKm,"blockKm") <= 0) throw new Error("El tramo de kilómetros debe ser positivo");
  if (!["none","all","categories","products"].includes(s.free.scope)) throw new Error("Selección de envío gratuito inválida");
  numeric(s.free.threshold, "umbral de gratuidad");
  if (!Array.isArray(s.free.categories) || !Array.isArray(s.free.products)) throw new Error("Selección de categorías o productos inválida");
  if (s.tiers.length > 40) throw new Error("Demasiados tramos");
  let previous = 0;
  for (const row of s.tiers) {
    const maximumKm = numeric(row.maxKm, "límite de tramo");
    numeric(row.price,"precio de tramo");
    if (maximumKm <= previous) throw new Error("Los tramos de distancia deben estar ordenados y sin solapamientos");
    previous = maximumKm;
  }
  return s;
}
const subtotalOf = item => numeric(item.price, "precio") * numeric(item.quantity ?? 1, "cantidad");
export function shippingQuoteForCart({ settings, lines = [], distanceKm, legacyPrice = 0 }) {
  const s = parseShippingSettings(settings);
  if (!s.advancedEnabled) return euro(numeric(legacyPrice,"tarifa existente"));
  validateShippingSettings(s);
  if (!Array.isArray(lines)) throw new Error("Carrito inválido");
  const physical = lines.filter(item => item.type !== "service" && item.serviceBooking !== true);
  if (!physical.length || !s.enabled) return 0; // Disabled = no shipping fees, not no delivery.
  const eligible = physical.filter(item => {
    const productId = key(item.id);
    const category = key(item.category || item.collection);
    const rule = s.products[productId] || s.categories[category] || {};
    if (rule.shippingEnabled === false) return false;
    if (rule.freeShipping === true) return false;
    if (rule.freeShipping === false) return true;
    const free = s.free;
    if (!free.enabled) return true;
    const selected = free.scope === "all" ||
      (free.scope === "categories" && free.categories.map(key).includes(category)) ||
      (free.scope === "products" && free.products.map(key).includes(productId));
    if (!selected) return true;
    const scopedSubtotal = physical.filter(line => {
      if (free.scope === "all") return true;
      if (free.scope === "categories") return free.categories.map(key).includes(key(line.category || line.collection));
      return free.products.map(key).includes(key(line.id));
    }).reduce((sum,line)=>sum+subtotalOf(line),0);
    return scopedSubtotal < numeric(free.threshold,"compra mínima");
  });
  if (!eligible.length) return 0;
  let price = numeric(s.basePrice,"tarifa base");
  if (s.mode !== "fixed") {
    const km = numeric(distanceKm,"distancia");
    if (s.mode === "tiers") {
      const tier = s.tiers.find(row => km <= Number(row.maxKm));
      if (!tier) throw new Error("La dirección está fuera de los tramos configurados");
      price = numeric(tier.price,"tarifa por zona");
    } else {
      price += Math.ceil(km / s.blockKm) * numeric(s.blockPrice,"precio por tramo");
    }
  }
  price = Math.min(numeric(s.maximum,"máximo"),Math.max(numeric(s.minimum,"mínimo"),price));
  // Mixed carts retain a proportional fee for products not eligible for free shipping.
  const allValue = physical.reduce((sum,line)=>sum+subtotalOf(line),0);
  const chargeable = eligible.reduce((sum,line)=>sum+subtotalOf(line),0);
  return euro(price * (allValue > 0 ? chargeable / allValue : eligible.length / physical.length));
}
