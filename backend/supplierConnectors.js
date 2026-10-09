/**
 * Supplier connectors are independent of the product catalog. Adding a supplier
 * does not grant authority to purchase or transmit customer data.
 *
 * Credentials belong exclusively in Railway environment variables; never in
 * supplier records, product metadata or browser requests.
 */
export const SUPPLIER_INTEGRATIONS = Object.freeze({
  manual: { label: "Gestión manual", automatedOrders: false },
  csv: { label: "Archivos CSV", automatedOrders: false },
  api: { label: "API propia (requiere adaptador)", automatedOrders: false },
  webhook: { label: "Conector webhook", automatedOrders: true },
  cj: { label: "CJdropshipping API", automatedOrders: false },
});

export function normalizeSupplierIntegrationType(value = "") {
  const type = String(value || "").trim().toLowerCase();
  return Object.hasOwn(SUPPLIER_INTEGRATIONS, type) ? type : "manual";
}

export function supplierIntegrationType(supplier = {}) {
  const explicit = String(supplier?.integrationType || "").trim().toLowerCase();
  if (Object.hasOwn(SUPPLIER_INTEGRATIONS, explicit)) return explicit;
  // Legacy CJ records without integrationType retain their existing adapter.
  const host = String(supplier?.sourceHost || "").trim().toLowerCase();
  return host === "cjdropshipping.com" || host.endsWith(".cjdropshipping.com")
    ? "cj" : "manual";
}

export function normalizeSupplierConnectorKey(value = "") {
  const key = String(value || "").trim().toUpperCase();
  return /^[A-Z][A-Z0-9_]{1,39}$/.test(key) ? key : "";
}

function safeHttpsEndpoint(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return "";
    if (!url.hostname || url.hostname === "localhost" || url.hostname.endsWith(".local") ||
        url.hostname.endsWith(".internal") || /^(?:\d{1,3}\.){3}\d{1,3}$/.test(url.hostname) ||
        url.hostname.includes(":")) return "";
    return url.href;
  } catch { return ""; }
}

export function resolveSupplierWebhookConnector(supplier = {}, env = process.env) {
  if (supplierIntegrationType(supplier) !== "webhook") return {
    configured: false, reason: "Este proveedor no utiliza un conector webhook."
  };
  const hasKey = Boolean(String(supplier.connectorKey || "").trim());
  const key = normalizeSupplierConnectorKey(supplier.connectorKey);
  if (hasKey && !key) return { configured: false, reason: "Identificador de conector inválido." };
  const prefix = key ? "SUPPLIER_CONNECTOR_" + key : "SUPPLIER_AUTOPILOT_WEBHOOK";
  const url = safeHttpsEndpoint(env[prefix + "_URL"]);
  const token = String(env[prefix + "_TOKEN"] || "").trim();
  if (!url || !token) return {
    configured: false, key, legacy: !key,
    reason: key ? "Configura " + prefix + "_URL y " + prefix + "_TOKEN en Railway." :
      "Configura una clave de conector propia. La configuración global solo se mantiene para integraciones antiguas."
  };
  return { configured: true, key, url, token, legacy: !key };
}

export function connectorVerificationFingerprint(connector, createHash) {
  if (!connector?.configured) return "";
  return createHash("sha256").update([connector.key || "legacy", connector.url, connector.token].join("\n")).digest("hex");
}

export function supplierConnectorReadiness(supplier = {}, env = process.env, createHash) {
  const type = supplierIntegrationType(supplier);
  if (type === "cj") return {
    type, state: String(env.CJ_API_KEY || "").trim() ? "configured" : "not_configured",
    automaticOrders: false, reason: "Pedidos CJ requieren las aprobaciones de creación y pago independientes."
  };
  if (type === "manual") return { type, state: "manual", automaticOrders: false, reason: "Tramitación manual." };
  if (type === "csv") return { type, state: "file_exchange", automaticOrders: false, reason: "Importación/exportación por archivos; sin sincronización automática." };
  if (type === "api") return { type, state: "adapter_required", automaticOrders: false, reason: "Necesita implementar el adaptador autorizado específico de ese proveedor." };
  const connector = resolveSupplierWebhookConnector(supplier, env);
  if (!connector.configured) return { type, state: "not_configured", automaticOrders: false, reason: connector.reason };
  const verified = connector.legacy || (
    typeof createHash === "function" &&
    Boolean(supplier.connectorVerifiedAt) &&
    String(supplier.connectorVerifiedFingerprint || "") === connectorVerificationFingerprint(connector, createHash)
  );
  return {
    type, state: verified ? "ready" : "test_required",
    automaticOrders: verified,
    reason: verified ? connector.legacy ?
      "Conector global heredado; revisa que esté asignado al proveedor correcto." :
      "Conector verificado. Requiere aprobación y controles de pedido antes de comprar." :
      "Configura el conector y ejecuta una prueba sin pedidos desde Administración.",
  };
}
