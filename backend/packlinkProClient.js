/**
 * Packlink PRO read-only API adapter.
 * Endpoint paths and query fields follow the Packlink ecommerce_module_core
 * ShippingServiceSearch, ShippingServiceDetails, DropOff and Proxy DTOs.
 * No shipment or label purchases are performed by this module.
 */
const API_ROOT = "https://api.packlink.com/v1/";
const zip = (value) => {
  const text = String(value || "").trim();
  if (!/^\d{5}$/.test(text)) throw new Error("Código postal español inválido");
  return text;
};
const decimal = (value, title, min, max) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(title + " fuera de rango");
  return n;
};
export function validParcel(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Faltan las medidas del paquete");
  return {
    weight: decimal(raw.weight ?? raw.weightKg, "Peso", 0.01, 40),
    width: Math.ceil(decimal(raw.width ?? raw.widthCm, "Anchura", 1, 120)),
    length: Math.ceil(decimal(raw.length ?? raw.lengthCm, "Longitud", 1, 120)),
    height: Math.ceil(decimal(raw.height ?? raw.heightCm, "Altura", 1, 120)),
  };
}
const cleanText = (text, max = 140) => String(text ?? "").slice(0, max);
export function cleanServices(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.services || payload?.results || [];
  if (!Array.isArray(rows)) throw new Error("Formato de tarifas de Packlink desconocido");
  return rows.map((s) => {
    const cost = Number(s.price?.total_price ?? s.total_price ?? s.totalPrice);
    const currency = String(s.currency || "EUR").toUpperCase();
    if (!Number.isFinite(cost) || cost < 0 || currency !== "EUR" || !s.id) return null;
    return {
      id: cleanText(s.id, 64), carrier: cleanText(s.carrier_name ?? s.carrierName),
      name: cleanText(s.name ?? s.service_name ?? s.serviceName),
      price: Math.round(cost * 100) / 100, currency,
      destinationPickup: s.delivery_to_parcelshop === true,
      originDropoff: s.dropoff === true,
      transitTime: cleanText(s.transit_time || ""),
    };
  }).filter(Boolean).sort((a,b) => a.price - b.price).slice(0,50);
}
export function cleanDropoffs(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.dropoffs || payload?.results || [];
  if (!Array.isArray(rows)) throw new Error("Formato de puntos de Packlink desconocido");
  return rows.filter(x => x && x.id).slice(0,30).map(x => ({
    id: cleanText(x.id, 100),
    name: cleanText(x.commerce_name || x.name),
    address: cleanText(x.address, 220),
    city: cleanText(x.city, 100),
    zip: cleanText(x.zip, 15),
    lat: Number.isFinite(Number(x.lat)) ? Number(x.lat) : null,
    lon: Number.isFinite(Number(x.long)) ? Number(x.long) : null,
  }));
}
export function createPacklinkClient({apiKey, fetchImpl = fetch} = {}) {
  const secret = String(apiKey || "").trim();
  if (!secret) throw new Error("PACKLINK_API_KEY no configurada en Railway");
  async function call(path, params) {
    const url = new URL(path, API_ROOT);
    if (params) for (const [key,value] of Object.entries(params)) url.searchParams.set(key, String(value));
    let response;
    try {
      response = await fetchImpl(url.toString(), {
        method: "GET", redirect: "error", signal: AbortSignal.timeout(12000),
        headers: { Authorization: secret, Accept: "application/json" },
      });
    } catch {
      throw new Error("No se pudo contactar con Packlink PRO");
    }
    if (response.status === 401 || response.status === 403) throw new Error("Packlink ha rechazado la clave API o su permiso");
    if (!response.ok) throw new Error("Packlink no pudo atender la consulta (HTTP " + response.status + ")");
    let body;
    try { body = await response.json(); } catch { throw new Error("Packlink ha devuelto datos no válidos"); }
    return body;
  }
  return {
    async verify() {
      const account = await call("clients");
      return {connected:true,accountPresent:Boolean(account)};
    },
    async rates({fromZip,toZip,parcel,source = "PRO"}) {
      const p = validParcel(parcel);
      const result = await call("services",{
        "from[country]":"ES","from[zip]":zip(fromZip),
        "to[country]":"ES","to[zip]":zip(toZip),
        source: String(source || "PRO").slice(0,32),
        "packages[0][height]":p.height,
        "packages[0][width]":p.width,
        "packages[0][length]":p.length,
        "packages[0][weight]":p.weight,
      });
      return cleanServices(result);
    },
    async dropoffs({serviceId, postalCode}) {
      const id = String(serviceId || "");
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new Error("Servicio de transporte inválido");
      const body = await call("dropoffs/" + encodeURIComponent(id) + "/ES/" + zip(postalCode));
      return cleanDropoffs(body);
    },
  };
}
