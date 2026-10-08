import { hasNeon, readNeonStorageValue, mutateNeonStorageValue } from "./neonDb.js";

const REDEMPTIONS_KEY = "promotionCodeRedemptions";
const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
export const promotionIsService = (item) =>
  item?.serviceBooking === true ||
  String(item?.type || "").toLowerCase() === "service" ||
  String(item?.collection || "").toLowerCase() === "servicios" ||
  (Array.isArray(item?.collections) && item.collections.some((collection) => String(collection).toLowerCase() === "servicios"));

export function evaluatePromotion(rules, code, items, { now = new Date(), redemptions = [] } = {}) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!normalizedCode || !/^[A-Z0-9_-]{3,40}$/.test(normalizedCode)) throw Object.assign(new Error("Código promocional inválido"), { statusCode: 409 });
  const rule = (Array.isArray(rules) ? rules : []).find((entry) => String(entry?.code || "").trim().toUpperCase() === normalizedCode);
  if (!rule || rule.active === false) throw Object.assign(new Error("El cupón no está activo"), { statusCode: 409 });
  if (rule.expiresAt) {
    const end = new Date(String(rule.expiresAt).slice(0, 10) + "T23:59:59.999");
    if (!Number.isFinite(end.valueOf()) || end < now) throw Object.assign(new Error("El cupón ha caducado"), { statusCode: 409 });
  }
  const scope = ["products", "services"].includes(rule.scope) ? rule.scope : "all";
  const eligible = (Array.isArray(items) ? items : []).filter((item) => {
    const service = promotionIsService(item);
    return scope === "all" || (scope === "services" ? service : !service);
  });
  const eligibleSubtotal = money(eligible.reduce((sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || 0), 0));
  if (!Number.isFinite(eligibleSubtotal) || eligibleSubtotal <= 0) throw Object.assign(new Error("El cupón no se aplica a los artículos seleccionados"), { statusCode: 409 });
  const percent = rule.type !== "fixed";
  const value = Number(rule.value);
  if (!Number.isFinite(value) || value <= 0 || (percent && value > 100)) throw Object.assign(new Error("El descuento no es válido"), { statusCode: 409 });
  const maxUses = rule.maxUses == null ? null : Math.floor(Number(rule.maxUses));
  if (maxUses != null && (!Number.isFinite(maxUses) || maxUses < 1)) throw Object.assign(new Error("Límite de usos inválido"), { statusCode: 409 });
  const alreadyUsed = redemptions.filter((entry) => entry.code === normalizedCode && ["reserved", "used"].includes(entry.status)).length;
  if (maxUses != null && alreadyUsed >= maxUses) throw Object.assign(new Error("Este código ha alcanzado su límite de usos"), { statusCode: 409 });
  return { code: normalizedCode, scope, maxUses, eligibleSubtotal, discount: money(Math.min(eligibleSubtotal, percent ? eligibleSubtotal * value / 100 : value)) };
}

export async function promotionRedemptions() {
  if (!hasNeon()) throw Object.assign(new Error("La validación segura de cupones requiere la base de datos principal"), { statusCode: 503 });
  try {
    const data = JSON.parse((await readNeonStorageValue(REDEMPTIONS_KEY)) || "[]");
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

export async function reservePromotion({ code, orderId, maxUses }) {
  if (!code) return;
  if (!hasNeon()) throw Object.assign(new Error("La validación segura de cupones no está disponible"), { statusCode: 503 });
  await mutateNeonStorageValue(REDEMPTIONS_KEY, (before) => {
    const entries = JSON.parse(before || "[]");
    if (entries.some((entry) => entry.orderId === orderId && entry.code === code)) return JSON.stringify(entries);
    const used = entries.filter((entry) => entry.code === code && ["reserved", "used"].includes(entry.status)).length;
    if (maxUses != null && used >= maxUses) throw Object.assign(new Error("Este código ha alcanzado su límite de usos"), { statusCode: 409 });
    entries.push({ code, orderId, status: "reserved", createdAt: new Date().toISOString() });
    return JSON.stringify(entries);
  });
}

export async function finalizePromotion(orderId) {
  if (!hasNeon()) return;
  await mutateNeonStorageValue(REDEMPTIONS_KEY, (before) =>
    JSON.stringify(JSON.parse(before || "[]").map((entry) => entry.orderId === orderId ? { ...entry, status: "used", usedAt: new Date().toISOString() } : entry)));
}

export async function releasePromotion(orderId) {
  if (!hasNeon()) return;
  await mutateNeonStorageValue(REDEMPTIONS_KEY, (before) =>
    JSON.stringify(JSON.parse(before || "[]").map((entry) => entry.orderId === orderId && entry.status === "reserved" ? { ...entry, status: "released" } : entry)));
}
