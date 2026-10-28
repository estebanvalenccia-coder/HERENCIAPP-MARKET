/**
 * Read-only diagnostics for supplier purchase preparation.
 * This module never grants authorization, sends personal data or places orders.
 * The purchase runners must independently validate all live evidence.
 */
const text = value => String(value ?? "").trim();

export function diagnoseAliExpressQueueRow(row = {}, order = null, product = null, flags = {}) {
  const issues = [];
  const items = Array.isArray(row.items) ? row.items : [];
  if (!flags.unpaidOrderCreationEnabled) issues.push("Creación de pedidos AliExpress desactivada en servidor.");
  if (!flags.automaticUnpaidCreationEnabled) issues.push("Ejecución periódica de AliExpress desactivada.");
  if (!flags.orderApiVerified) issues.push("Permiso de API para crear pedidos no validado.");
  if (!flags.addressTransferApproved) issues.push("Transferencia de dirección al proveedor sin aprobación.");
  if (row.mode !== "autopilot") issues.push("Proveedor sin modo Autopilot.");
  if (!items.length || items.length !== 1 || Number(items[0]?.quantity) !== 1)
    issues.push("Solo se admite un artículo y una unidad por pedido AliExpress.");
  if (items.length !== 1 || !text(items[0].supplierSku) || !text(items[0].supplierVariantId))
    issues.push("Falta vincular el SKU y la variante exacta de AliExpress.");
  if (!Number.isFinite(Number(row.estimatedCost)) || Number(row.estimatedCost) <= 0)
    issues.push("Falta verificar el coste del proveedor y el envío.");
  if (!order || Number(order.total) <= 0 || !text(order.stripe_payment_intent_id))
    issues.push("No consta un cobro Stripe positivo; pedidos gratuitos requieren financiación por otro flujo autorizado.");
  if (!product || product.status !== "active") issues.push("El producto del proveedor no está activo.");
  const metadata = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};
  if (metadata.sourceProvider !== "aliexpress") issues.push("El producto no conserva la identidad de origen AliExpress.");
  if (metadata.orderAutomationEnabled !== true) issues.push("Automatización no aprobada para este producto.");
  if (metadata.costAndShippingVerified !== true) issues.push("Coste y envío del producto sin verificar.");
  if (metadata.complianceVerified !== true || metadata.approvedForPublication !== true)
    issues.push("Revisión legal o publicación pendiente.");
  if (text(row.externalOrderId)) issues.push("Ya existe una referencia externa: no repetir la creación.");
  if (["creating", "unknown", "cj_creation_unknown"].includes(text(row.status)))
    issues.push("Resultado externo ambiguo: requiere conciliación.");
  return {
    fulfillmentId: text(row.id),
    orderId: text(row.orderId),
    status: text(row.status) || "desconocido",
    issues,
    // A clean local diagnostic is NOT a verified payment or permission to buy.
    localChecksPassed: issues.length === 0,
    nextAction: issues[0] || "Solicitar comprobación LIVE de Stripe, variante, transporte, margen y proveedor.",
    createsOrder: false,
    chargesSupplier: false,
  };
}

export function summarizeAliExpressAutomation(operations = {}, ordersById = {}, productsById = {}, flags = {}) {
  const suppliers = Array.isArray(operations.suppliers) ? operations.suppliers : [];
  const supplierIds = new Set(suppliers.filter(s =>
    (text(s.sourceHost).replace(/^www\./, "") === "aliexpress.com" ||
      text(s.name).toLowerCase() === "aliexpress") && s.active !== false
  ).map(s => text(s.id)));
  const rows = (Array.isArray(operations.supplierFulfillments) ? operations.supplierFulfillments : [])
    .filter(row => supplierIds.has(text(row.supplierId)) && !row.queueRemoved)
    .slice(0, 20);
  return rows.map(row => diagnoseAliExpressQueueRow(
    row, ordersById[text(row.orderId)] || null,
    productsById[text(row.items?.[0]?.productId)] || null, flags
  ));
}
