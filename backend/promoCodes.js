const CODE_PATTERN = /^[A-Z0-9_-]{3,40}$/;

export function normalizeCouponCode(value) {
  return String(value || "").trim().toUpperCase();
}

export function isServiceProduct(item = {}) {
  return item.serviceBooking === true ||
    item.type === "service" ||
    item.collection === "servicios" ||
    (Array.isArray(item.collections) && item.collections.includes("servicios")) ||
    String(item.category || "").toLowerCase() === "servicios";
}

export function madridDate(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(now);
}

export function validateCouponRule(input = {}, now = new Date()) {
  const code = normalizeCouponCode(input.code);
  if (!CODE_PATTERN.test(code)) throw new Error("Código promocional no válido");
  const type = input.type === "fixed" ? "fixed" : "percent";
  const value = Number(input.value);
  if (!Number.isFinite(value) || value <= 0 || (type === "percent" && value > 100)) {
    throw new Error("Descuento promocional no válido");
  }
  if (input.active === false) throw new Error("Este código está desactivado");
  const expiry = String(input.expiresAt || "").slice(0, 10);
  if (expiry && (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || expiry < madridDate(now))) {
    throw new Error("El código promocional ha caducado");
  }
  const maxUses = Number(input.maxUses || 0);
  if (maxUses && (!Number.isInteger(maxUses) || maxUses < 1)) throw new Error("Límite de usos no válido");
  const scope = ["products", "services"].includes(input.scope) ? input.scope : "all";
  return { code, type, value, maxUses, scope, expiresAt: expiry || null };
}

export function calculateCouponDiscount({ code, rules, items, now = new Date() }) {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return { code: "", discount: 0, eligibleSubtotal: 0, rule: null };
  const found = (Array.isArray(rules) ? rules : []).find(
    (row) => normalizeCouponCode(row?.code) === normalized
  );
  if (!found) throw new Error("El código promocional no existe");
  const rule = validateCouponRule(found, now);
  const eligibleSubtotal = Math.round((Array.isArray(items) ? items : [])
    .filter((item) => rule.scope === "all" || (isServiceProduct(item) ? "services" : "products") === rule.scope)
    .reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0) * 100) / 100;
  if (eligibleSubtotal <= 0) throw new Error("Este código no se aplica a los artículos del carrito");
  const raw = rule.type === "fixed" ? rule.value : eligibleSubtotal * rule.value / 100;
  const discount = Math.min(eligibleSubtotal, Math.max(0, Math.round(raw * 100) / 100));
  return { code: normalized, discount, eligibleSubtotal, rule };
}

const HOLD_MS = 24 * 60 * 60 * 1000;

export function claimCouponUse(data, rule, orderId, now = new Date()) {
  const key = normalizeCouponCode(rule.code);
  const id = String(orderId || "");
  if (!id) throw new Error("Identificador de pedido requerido");
  const state = data && typeof data === "object" && !Array.isArray(data) ? { ...data } : {};
  const rows = Array.isArray(state[key]) ? [...state[key]] : [];
  if (rows.some((row) => row.orderId === id)) return state;
  const used = rows.filter((row) => row.status === "redeemed" ||
    (row.status === "held" && new Date(row.at).getTime() + HOLD_MS > now.getTime()));
  if (rule.maxUses > 0 && used.length >= rule.maxUses) {
    throw new Error("Este código promocional ha alcanzado su límite de usos");
  }
  state[key] = [...used, { orderId: id, status: "held", at: now.toISOString() }];
  return state;
}

export function settleCouponUse(data, code, orderId, action, now = new Date()) {
  const key = normalizeCouponCode(code);
  const state = data && typeof data === "object" && !Array.isArray(data) ? { ...data } : {};
  const rows = Array.isArray(state[key]) ? state[key] : [];
  if (action === "release") {
    state[key] = rows.filter((row) => row.orderId !== String(orderId) || row.status === "redeemed");
  } else if (action === "redeem") {
    state[key] = rows.map((row) => row.orderId === String(orderId)
      ? { ...row, status: "redeemed", at: now.toISOString() } : row);
  } else {
    throw new Error("Acción de cupón no válida");
  }
  return state;
}
