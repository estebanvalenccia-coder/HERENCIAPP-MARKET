/**
 * Sendcloud read-only integration probe for Tropical Plants.
 * No labels, payments, parcels, orders, or shipment modifications.
 * v2 methods is informational; v3 service points are never final price quotes.
 *
 * https://support.sendcloud.com/hc/es/articles/360024967012
 * https://sendcloud.dev/docs/service-points/find-service-points-with-the-api
 */
const ROOT = "https://panel.sendcloud.sc/";
const safeText = (value, size = 150) => String(value ?? "").slice(0, size);

function validateZip(value) {
  const zip = String(value || "").trim();
  if (!/^\d{5}$/.test(zip)) throw new Error("Introduce un código postal español de cinco dígitos");
  return zip;
}
export function normalizeShippingMethods(payload) {
  const list = Array.isArray(payload) ? payload : payload?.shipping_methods;
  if (!Array.isArray(list)) throw new Error("La respuesta de servicios de Sendcloud ha cambiado");
  return list.filter(method => method && Number.isSafeInteger(Number(method.id)) && Number(method.id)>0)
    .slice(0, 80).map(method => ({
      id: Number(method.id),
      name: safeText(method.name || method.service_name),
      carrier: safeText(method.carrier || method.carrier_name),
      minWeight: Number.isFinite(Number(method.min_weight)) ? Number(method.min_weight) : null,
      maxWeight: Number.isFinite(Number(method.max_weight)) ? Number(method.max_weight) : null,
    }));
}
export function normalizeServicePoints(payload) {
  const list = payload?.data?.results;
  if (!Array.isArray(list)) throw new Error("La respuesta de puntos Sendcloud ha cambiado");
  return list.filter(point => point && Number.isSafeInteger(Number(point.id)) && Number(point.id) > 0)
    .slice(0, 25).map(point => ({
      id: Number(point.id),
      name: safeText(point.name),
      carrier: safeText(point.carrier?.name || point.operating_carrier?.name),
      carrierCode: safeText(point.carrier?.code, 45),
      street: safeText(point.address?.street, 120),
      houseNumber: safeText(point.address?.house_number, 30),
      postalCode: safeText(point.address?.postal_code, 16),
      city: safeText(point.address?.city, 90),
      latitude: Number.isFinite(Number(point.position?.latitude)) ? Number(point.position.latitude) : null,
      longitude: Number.isFinite(Number(point.position?.longitude)) ? Number(point.position.longitude) : null,
    }));
}
export function createSendcloudClient({publicKey, secretKey, fetchImpl = fetch} = {}) {
  const pub = String(publicKey || "").trim();
  const sec = String(secretKey || "").trim();
  if (!pub || !sec) throw new Error("Faltan SENDCLOUD_PUBLIC_KEY y SENDCLOUD_SECRET_KEY en Railway");
  const authorization = "Basic " + Buffer.from(pub + ":" + sec).toString("base64");
  async function get(path, params = {}) {
    const url = new URL(path, ROOT);
    if (url.hostname !== "panel.sendcloud.sc" || !url.pathname.startsWith("/api/")) {
      throw new Error("Endpoint Sendcloud no permitido");
    }
    for (const [key,value] of Object.entries(params)) url.searchParams.set(key, String(value));
    let response;
    try {
      response = await fetchImpl(url.toString(), {
        method:"GET", redirect:"error", signal:AbortSignal.timeout(12000),
        headers:{ Authorization:authorization, Accept:"application/json" },
      });
    } catch {
      throw new Error("No se pudo contactar con Sendcloud");
    }
    if ([401,403].includes(response.status)) throw new Error("Sendcloud rechazó las claves API o sus permisos");
    if (!response.ok) throw new Error("Sendcloud no completó la consulta (HTTP " + response.status + ")");
    try { return await response.json(); }
    catch { throw new Error("Sendcloud devolvió datos inválidos"); }
  }
  return {
    async verify() {
      const data = await get("/api/v2/shipping_methods");
      const methods = normalizeShippingMethods(data);
      return {connected:true,methodsCount:methods.length};
    },
    async methods() {
      return normalizeShippingMethods(await get("/api/v2/shipping_methods"));
    },
    async points({postalCode}) {
      const zip = validateZip(postalCode);
      const data = await get("/api/v3/service-points", {
        country_code:"ES", address:zip+", España",
        use_integration_carriers:"true", limit:"15",
      });
      return normalizeServicePoints(data);
    }
  };
}
