// Explicit two-step manual authorization for CJ supplier orders.
// Pure safeguards shared by the admin preview and the mutation routes.
// No network requests or supplier purchases are made from this module.

export const CJ_MANUAL_IN_FLIGHT = Object.freeze([
  "cj_creating", "cj_creation_unknown", "cj_paying", "cj_payment_unknown",
]);

export function cjManualError(message, statusCode = 409) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function cjConfirmation(action, orderId) {
  const prefix = action === "pay" ? "PAGAR CJ" : "CREAR CJ";
  return prefix + " " + String(orderId || "").slice(0, 8);
}

export function classifyCjOrderFunding(order = {}) {
  const total = Number(order.total ?? order.totalAmount ?? NaN);
  const md = order.metadata && typeof order.metadata === "object" ? order.metadata : {};
  const discount = Number(md.discount || 0);
  const freeCoupon = total === 0 && md.freeCouponOrder === true &&
    String(order.payment_method || order.paymentMethod || "").toLowerCase() === "coupon" &&
    Number.isFinite(discount) && discount > 0 && Boolean(String(md.coupon || "").trim());
  if (!["paid", "confirmed", "preparing", "processing", "ready"].includes(String(order.status || ""))) {
    throw cjManualError("El pedido de Herencia aún no está confirmado.");
  }
  if (!Number.isFinite(total) || total < 0) {
    throw cjManualError("Total del cliente no verificable.");
  }
  if (total === 0 && !freeCoupon) {
    throw cjManualError("La compra gratuita no tiene una promoción validada por Herencia.");
  }
  return {
    total,
    discount: Math.max(0, discount),
    storeFunded: freeCoupon || discount > 0,
    freeCoupon,
    funding: freeCoupon ? "merchant_coupon" : "customer_stripe",
  };
}

export function cjManualOrderNumber(record = {}) {
  return ("HM-" + String(record.orderId || "") + "-" + String(record.id || "").slice(0, 8)).slice(0, 50);
}

export function validateManualCjCreate({ record, supplier, order, nowMs = Date.now() }) {
  if (!record?.id || !record?.orderId || !supplier ||
      String(supplier.id || "") !== String(record.supplierId || "")) {
    throw cjManualError("Pedido o proveedor CJ no vinculado correctamente.");
  }
  if (record.provider !== "cj" && supplier.integrationType !== "cj") {
    throw cjManualError("Esta preparación no pertenece a CJdropshipping.");
  }
  if (supplier.active === false || supplier.cjSandbox !== false) {
    throw cjManualError("El proveedor debe estar activo y en modo REAL para crear un pedido externo.");
  }
  if (CJ_MANUAL_IN_FLIGHT.includes(String(record.status || ""))) {
    throw cjManualError("Este pedido tiene una operación CJ pendiente de conciliación. No puede duplicarse.");
  }
  if (String(record.externalOrderId || "").trim() || String(record.cjShipmentOrderId || "").trim()) {
    throw cjManualError("Este pedido ya tiene un identificador CJ. Consulta su estado antes de repetir.");
  }
  if (["ordered", "shipped", "delivered", "closed", "cancelled", "canceled", "refunded", "returned"]
    .includes(String(record.status || "").toLowerCase())) {
    throw cjManualError("Un pedido ya realizado o cerrado no puede volver a comprarse.");
  }
  const funding = classifyCjOrderFunding(order);
  if (String(order.id || "") !== String(record.orderId || "")) {
    throw cjManualError("La compra del cliente no corresponde a este pedido de proveedor.");
  }
  const address = record.shippingAddress || {};
  const country = String(address.country || "").toLowerCase();
  if (!["es", "españa", "spain"].includes(country) ||
    !/^\d{5}$/.test(String(address.postalCode || "").trim()) ||
    !String(address.name || "").trim() || !String(address.address || "").trim() ||
    !String(address.city || "").trim() || !String(address.phone || "").trim()) {
    throw cjManualError("Faltan datos de entrega completos y un código postal español válido.");
  }
  const items = Array.isArray(record.items) ? record.items : [];
  // CJ quotes are for one variant, quantity 1. Never reuse a single-variant
  // shipping quote for an order with multiple items or quantities.
  if (items.length !== 1 || Number(items[0]?.quantity) !== 1) {
    throw cjManualError("CJ requiere una única unidad por pedido con cotización individual.");
  }
  const item = items[0];
  if (!String(item.supplierVariantId || "").trim()) {
    throw cjManualError("Falta el identificador real de variante CJ (VID).");
  }
  const quote = item.cjPricingEstimate;
  const checkedAt = Date.parse(String(quote?.checkedAt || ""));
  const quoteAge = nowMs - checkedAt;
  if (quote?.available !== true || !(Number(item.supplierCost || 0) > 0) ||
    !(Number(record.estimatedCost || 0) > 0) ||
    !Number.isFinite(checkedAt) || quoteAge < 0 || quoteAge >= 24 * 3600 * 1000 ||
    String(quote.vid || "") !== String(item.supplierVariantId || "") ||
    String(quote.methodName || "") !== String(item.cjPreferredLogisticName || "") ||
    String(quote.destination || "") !== "ES" ||
    String(item.cjPreferredLogisticCountry || "") !== "ES" ||
    Math.abs(Number(quote.salePriceEur || 0) - Number(item.salePrice || 0)) >= 0.02 ||
    Math.abs(Number(quote.costEur || 0) - Number(item.supplierCost || 0)) >= 0.02) {
    throw cjManualError("Cotización CJ incompleta, desactualizada o incompatible con el pedido. Consulta el transporte y resincroniza.");
  }
  if (quote.feasible !== true && !funding.storeFunded) {
    throw cjManualError("El pedido no tiene margen suficiente y no consta una promoción financiada por Herencia.");
  }
  const approvedMaxUsd = Number(supplier.cjMaxPaymentUsd);
  const expectedSupplierUsd = Number(quote.supplierTotalUsd);
  if (!(approvedMaxUsd > 0) || !(expectedSupplierUsd > 0) ||
      !Number.isFinite(approvedMaxUsd) || !Number.isFinite(expectedSupplierUsd) ||
      expectedSupplierUsd > approvedMaxUsd) {
    throw cjManualError("La cotización en USD es desconocida o supera el límite de compra configurado para CJ.");
  }
  const budgetEur = Number(supplier.maxAutoOrderTotal || 0);
  if (!(budgetEur > 0) || Number(record.estimatedCost || 0) > budgetEur) {
    throw cjManualError("Coste CJ desconocido o superior al presupuesto máximo configurado en EUR.");
  }
  const selected = String(item.selectedVariant || "").trim().toLowerCase();
  if (selected) {
    const sku = String(item.supplierSku || "").trim().toLowerCase();
    const suffix = sku.includes("-") ? sku.split("-").slice(1).join("-") : "";
    if (!suffix || !(suffix.includes(selected) || selected.includes(suffix))) {
      throw cjManualError("La variante elegida no coincide con el SKU vinculado al producto.");
    }
  }
  return {
    funding,
    estimatedCostEur: Number(record.estimatedCost),
    estimatedPaymentUsd: Math.round(expectedSupplierUsd * 100) / 100,
    maxAllowedUsd: Math.round(approvedMaxUsd * 100) / 100,
    maxAllowedEur: Math.round(budgetEur * 100) / 100,
    logisticName: String(item.cjPreferredLogisticName),
    orderNumber: cjManualOrderNumber(record),
  };
}

export function validateManualCjPayment({ record, supplier, approvedUsd }) {
  if (!record?.id || record.provider !== "cj" || supplier?.active === false ||
    supplier?.cjSandbox !== false) {
    throw cjManualError("Pedido CJ real no disponible.");
  }
  const existingOrder = String(record.externalOrderId || "").trim();
  const shipmentOrder = String(record.cjShipmentOrderId || "").trim();
  if (!existingOrder && !shipmentOrder) {
    throw cjManualError("Primero crea el pedido en CJ sin pagarlo.");
  }
  if (String(record.status || "") !== "payment_required") {
    throw cjManualError("El pedido no está pendiente de pago o requiere conciliación.");
  }
  const amountUsd = Number(record.providerActualPayment);
  const approved = Number(approvedUsd);
  const limit = Number(supplier.cjMaxPaymentUsd);
  if (!(amountUsd > 0 && approved > 0 && limit > 0) ||
    !Number.isFinite(amountUsd) || !Number.isFinite(approved) || !Number.isFinite(limit) ||
    amountUsd > approved || amountUsd > limit || approved > limit) {
    throw cjManualError("El importe real de CJ supera tu autorización o el límite del proveedor.");
  }
  const source = record.cjManualAuthorization || {};
  if (!source.approvedByAdminAt || !source.funding) {
    throw cjManualError("Falta la aprobación de la creación y del origen del presupuesto.");
  }
  return { amountUsd, approvedUsd: approved, maxAllowedUsd: limit };
}

export function applyCjManualStage(current = {}, id, fromStatuses, patch = {}) {
  const values = Array.isArray(current.supplierFulfillments) ? current.supplierFulfillments : [];
  const at = values.findIndex((item) => String(item?.id) === String(id));
  if (at < 0) throw cjManualError("Pedido de proveedor no encontrado.", 404);
  const old = values[at];
  if (!fromStatuses.includes(String(old.status || ""))) {
    throw cjManualError("El pedido cambió de estado. Recarga Administración antes de continuar.");
  }
  if (old.externalOrderId && !["payment_required", "cj_paying", "cj_payment_unknown"].includes(String(old.status || ""))) {
    throw cjManualError("Este pedido ya tiene una referencia CJ y no puede recrearse.");
  }
  const row = { ...old, ...patch, updatedAt: new Date().toISOString() };
  const next = [...values];
  next[at] = row;
  return { operations: { ...current, supplierFulfillments: next }, record: row };
}
