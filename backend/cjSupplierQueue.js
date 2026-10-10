import { verifiedCjQuoteMatches } from "./cjVariantIdentity.js";
// Reconcile supplier preparation records without reordering, paying, or resubmitting
// supplier purchases. This module does not perform side effects.
const protectedStatuses = new Set([
  "ordered", "shipped", "delivered", "cancelled", "canceled", "closed",
  "refunded", "returned", "disputed", "manual_purchase_required",
  "payment_required",
  "cj_creating", "cj_creation_unknown", "cj_paying", "cj_payment_unknown",
  "supplier_dispatching", "supplier_dispatch_unknown",
]);

export function hasVerifiedCjQuote(record, { nowMs = Date.now() } = {}) {
  const items = Array.isArray(record?.items) ? record.items : [];
  const postalCode=String(record?.shippingAddress?.postalCode || "").trim();
  return items.length === 1 && Number(record?.estimatedCost || 0) > 0 &&
    items.every((item) => {
      const quote=item.cjPricingEstimate;
      return Number(item?.quantity) === 1 && Number(item?.supplierCost || 0) > 0 &&
        verifiedCjQuoteMatches({
          quote,
          identity:{vid:String(item?.supplierVariantId || ""),sku:String(item?.supplierSku || ""),
            name:String(item?.selectedVariant || "")},
          destination:"ES",postalCode,
          methodName:String(item?.cjPreferredLogisticName || ""),
          salePriceEur:Number(item?.salePrice || 0),
          nowMs,
        }) &&
        Math.abs(Number(quote.costEur) - Number(item.supplierCost)) < 0.02;
    });
}

export function preserveSupplierFulfillment(existing, proposed, { force = false, nowMs = Date.now() } = {}) {
  if (!existing) return false;
  // A submitted, settled or already manually approved supplier action must
  // never be overwritten by catalog re-pricing or repeated sync requests.
  if (String(existing?.externalOrderId || "").trim() ||
      existing?.approvedAt ||
      protectedStatuses.has(String(existing?.status || "").toLowerCase())) return true;
  if (force) return false;
  const currentVerified = hasVerifiedCjQuote(existing, { nowMs });
  const incomingVerified = hasVerifiedCjQuote(proposed, { nowMs });
  if (!currentVerified) return false;
  if (!incomingVerified) return true;
  // A valid newly quoted variant/address/method must replace a different
  // unapproved quote, but exact replays should preserve the existing row.
  const current = existing.items?.[0]?.cjPricingEstimate;
  const next = proposed.items?.[0]?.cjPricingEstimate;
  const exact = current?.vid === next?.vid &&
    current?.sku === next?.sku &&
    current?.selectedVariant === next?.selectedVariant &&
    current?.postalCode === next?.postalCode &&
    current?.methodName === next?.methodName &&
    Math.abs(Number(current?.costEur) - Number(next?.costEur)) < 0.02 &&
    Math.abs(Number(current?.salePriceEur) - Number(next?.salePriceEur)) < 0.02;
  return exact;
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
