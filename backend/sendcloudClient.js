/**
 * Sendcloud read-only integration probe for Tropical Plants.
 * No labels, payments, parcels, orders, or shipment modifications.
 * Use only Sendcloud v3 for accounts created in 2026. This is a read-only
 * diagnostic: POST shipping-options computes a quote but buys no labels.
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
function euroCandidate(raw) {
  // Only return unambiguous, explicit EUR total amounts. Unknown quote
  // structures remain unpriced rather than showing an invented price.
  const variants = [
    ...(Array.isArray(raw?.quotes) ? raw.quotes.map(x=>x?.price?.total) : []),
    raw?.quote?.total_price, raw?.quote?.price,
    raw?.quotes?.total_price, raw?.quotes?.total,
    raw?.price?.total_price, raw?.total_price,
  ];
  for (const candidate of variants) {
    if (!candidate || typeof candidate !== "object") continue;
    const amount = candidate.value ?? candidate.amount;
    const currency = String(candidate.currency ?? candidate.currency_code ?? "").toUpperCase();
    const money = Number(amount);
    if (currency === "EUR" && amount !== null && amount !== "" &&
        Number.isFinite(money) && money >= 0) return Math.round(money*100)/100;
  }
  return null;
}
export function normalizeShippingOptions(payload) {
  if (!Array.isArray(payload?.data)) throw new Error("Formato de opciones de Sendcloud desconocido");
  return payload.data.slice(0, 80).filter(x=>x && typeof x === "object")
    .map(option=>({
      code:safeText(option.code || option.shipping_option_code || "",100),
      carrier:safeText(option.carrier?.name || option.carrier_name || "",120),
      name:safeText(option.product?.name || option.name || "",120),
      price:euroCandidate(option),
      currency:euroCandidate(option)===null?null:"EUR",
    })).filter(x=>x.code.length>0);
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
  async function call(path, {params = {}, body} = {}) {
    const url = new URL(path, ROOT);
    if (url.hostname !== "panel.sendcloud.sc" || !url.pathname.startsWith("/api/")) {
      throw new Error("Endpoint Sendcloud no permitido");
    }
    for (const [key,value] of Object.entries(params)) url.searchParams.set(key, String(value));
    let response;
    try {
      response = await fetchImpl(url.toString(), {
        method:body === undefined ? "GET" : "POST",
        body:body === undefined ? undefined : JSON.stringify(body),
        redirect:"error", signal:AbortSignal.timeout(12000),
        headers:{ Authorization:authorization, Accept:"application/json",
          ...(body === undefined ? {} : {"Content-Type":"application/json"}) },
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
      const result = await call("/api/v3/organization");
      if (!result?.data?.id) throw new Error("Sendcloud no devolvió una organización válida");
      return {connected:true, organizationVerified:true};
    },
    async quotes({fromZip,toZip,parcel}) {
      const from=validateZip(fromZip), to=validateZip(toZip);
      if (!parcel || typeof parcel !== "object") throw new Error("Indica dimensiones y peso reales");
      const dims=["length","width","height"].map(key=>{
        const num=Number(parcel[key] ?? parcel[key+"Cm"]);
        if (!Number.isFinite(num)||num<1||num>120) throw new Error("Medida de paquete inválida: "+key);
        return String(Math.ceil(num));
      });
      const weight=Number(parcel.weight ?? parcel.weightKg);
      if (!Number.isFinite(weight)||weight<0.01||weight>40) throw new Error("Peso del paquete inválido");
      const result=await call("/api/v3/shipping-options",{body:{
        from_country_code:"ES",to_country_code:"ES",
        from_postal_code:from,to_postal_code:to,
        parcels:[{dimensions:{length:dims[0],width:dims[1],height:dims[2],unit:"cm"},
          weight:{value:String(weight),unit:"kg"}}],
        calculate_quotes:true,
      }});
      return normalizeShippingOptions(result);
    },
    async points({postalCode}) {
      const zip = validateZip(postalCode);
      const data = await call("/api/v3/service-points", {params:{
        country_code:"ES", address:zip+", España",
        use_integration_carriers:"true", limit:"15",
      }});
      return normalizeServicePoints(data);
    }
  };
}
