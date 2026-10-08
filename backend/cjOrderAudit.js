// Read-only CJ account order reconciliation. Never sends shipping/customer PII to
// the browser and never creates, confirms, or pays a supplier order.
export const CJ_AUDIT_ORDER_STATUSES = Object.freeze([
  "CREATED", "IN_CART", "UNPAID", "UNSHIPPED", "SHIPPED",
  "DELIVERED", "CANCELLED",
]);

export function summarizeCjAccountOrders(statusPages, localFulfillments) {
  const local = Array.isArray(localFulfillments) ? localFulfillments : [];
  const pages = Array.isArray(statusPages) ? statusPages : [];
  const statusSummary = [];
  const remoteOrders = new Map();
  let incomplete = false;

  for (const page of pages) {
    const rows = Array.isArray(page?.list) ? page.list : [];
    const total = Number(page?.total);
    if (!Number.isFinite(total) || total > rows.length) incomplete = true;
    statusSummary.push({
      status: String(page?.status || "").slice(0, 32),
      total: Number.isFinite(total) ? total : null,
      scanned: rows.length,
    });
    for (const row of rows) {
      const orderNumber = String(row?.orderNum || row?.orderNumber || "").trim();
      const cjId = String(row?.orderId || row?.cjOrderId || "").trim();
      if (!cjId && !orderNumber) continue;
      // Only show orders originating from the Herencia integration or already
      // associated with a local supplier fulfillment; no unrelated CJ account PII.
      const matching = local.find((item) =>
        (cjId && String(item?.externalOrderId || "") === cjId) ||
        (item?.orderId && orderNumber.startsWith("HM-" + String(item.orderId) + "-"))
      );
      if (!matching && !orderNumber.startsWith("HM-")) continue;
      const key = cjId || orderNumber;
      if (remoteOrders.has(key)) continue;
      remoteOrders.set(key, {
        cjOrderId: cjId,
        orderNumber: orderNumber.slice(0, 90),
        status: String(row?.orderStatus || page?.status || "").slice(0, 40),
        amountUsd: Number.isFinite(Number(row?.orderAmount)) && row?.orderAmount != null
          ? Number(row.orderAmount) : null,
        localOrderId: matching ? String(matching.orderId || "") : null,
        localFulfillmentId: matching ? String(matching.id || "") : null,
        trackingAvailable: Boolean(row?.trackNumber),
      });
    }
  }

  const cjOrders = [...remoteOrders.values()];
  const queue = local.slice(0, 500).map((item) => {
    const detected = cjOrders.find((r) =>
      r.localFulfillmentId === String(item?.id || "") ||
      (item?.externalOrderId && r.cjOrderId === String(item.externalOrderId))
    );
    return {
      orderId: String(item?.orderId || ""),
      fulfillmentId: String(item?.id || ""),
      status: String(item?.status || ""),
      estimatedCostEur: Number(item?.estimatedCost || 0),
      externalOrderId: String(item?.externalOrderId || ""),
      cjDetectedInPages: Boolean(detected),
      cjOrderStatus: detected?.status || null,
    };
  });

  return {
    statusSummary,
    cjOrders,
    localQueue: queue,
    incomplete,
    // No match is not definitive when older CJ pages have not been scanned.
    warning: incomplete
      ? "Solo se consultó la primera página por estado; un pedido más antiguo puede no aparecer."
      : "Resultados de la consulta actual; revisa el identificador CJ antes de considerar un pedido ausente.",
  };
}
