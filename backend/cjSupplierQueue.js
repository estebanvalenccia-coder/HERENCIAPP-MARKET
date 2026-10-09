// Reconcile supplier preparation records without reordering, paying, or resubmitting
// supplier purchases. This module does not perform side effects.
const protectedStatuses = new Set([
  "ordered", "shipped", "delivered", "cancelled", "canceled", "closed",
  "refunded", "returned", "disputed", "manual_purchase_required",
  "payment_required",
  "cj_creating", "cj_creation_unknown", "cj_paying", "cj_payment_unknown",
  "supplier_dispatching", "supplier_dispatch_unknown",
]);

export function hasVerifiedCjQuote(record) {
  const items = Array.isArray(record?.items) ? record.items : [];
  return items.length > 0 && Number(record?.estimatedCost || 0) > 0 &&
    items.every((item) =>
      item?.cjPricingEstimate?.available === true &&
      Number(item?.supplierCost || 0) > 0
    );
}

export function preserveSupplierFulfillment(existing, proposed, { force = false } = {}) {
  if (!existing) return false;
  // A submitted, settled or already manually approved supplier action must
  // never be overwritten by catalog re-pricing or repeated sync requests.
  if (String(existing?.externalOrderId || "").trim() ||
      existing?.approvedAt ||
      protectedStatuses.has(String(existing?.status || "").toLowerCase())) return true;
  if (force) return false;
  // Even a cached admin view may send force=false. Refresh only when the
  // authoritative catalog now has a verified quote and the queue did not.
  return !(hasVerifiedCjQuote(proposed) && !hasVerifiedCjQuote(existing));
}

export function mergePreparedSupplierFulfillments(operations, proposals, { force = false } = {}) {
  const current = operations && typeof operations === "object" ? operations : {};
  const records = Array.isArray(current.supplierFulfillments)
    ? [...current.supplierFulfillments] : [];
  for (const proposed of Array.isArray(proposals) ? proposals : []) {
    const key = String(proposed?.dedupeKey || "");
    if (!key) continue;
    const at = records.findIndex((entry) => String(entry?.dedupeKey || "") === key);
    if (at === -1) {
      records.unshift(proposed);
    } else if (!preserveSupplierFulfillment(records[at], proposed, { force })) {
      // Preserve the original queue row identity and creation date.
      records[at] = {
        ...proposed,
        id: records[at]?.id || proposed.id,
        createdAt: records[at]?.createdAt || proposed.createdAt,
      };
    }
  }
  return { ...current, supplierFulfillments: records.slice(0, 2000) };
}
