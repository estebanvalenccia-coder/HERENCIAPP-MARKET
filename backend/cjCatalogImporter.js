// CJdropshipping read-only catalog adapter. Never creates or pays orders.
const BASE = "https://developers.cjdropshipping.com/api2.0/v1";
let cachedToken = "";
let cachedUntil = 0;
async function cjFetch(path, options = {}) {
  const response = await fetch(BASE + path, { ...options, signal: AbortSignal.timeout(18000) });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.result === false || payload.success === false || (payload.code && Number(payload.code) !== 200)) {
    const error = new Error("CJ: " + String(payload?.message || ("HTTP " + response.status)).slice(0,220));
    error.statusCode = 502;
    throw error;
  }
  return payload.data;
}
async function token() {
  if (cachedToken && Date.now() < cachedUntil) return cachedToken;
  const key = String(process.env.CJ_API_KEY || "").trim();
  if (!key) { const e = new Error("Falta CJ_API_KEY en Railway"); e.statusCode = 503; throw e; }
  const data = await cjFetch("/authentication/getAccessToken", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey: key })
  });
  if (!data?.accessToken) throw new Error("CJ no devolvió un accessToken");
  cachedToken = data.accessToken;
  cachedUntil = Date.now() + 12 * 60 * 60 * 1000;
  return cachedToken;
}
export async function previewCjProductUrl(input) {
  const url = new URL(input);
  if (!["cjdropshipping.com", "www.cjdropshipping.com"].includes(url.hostname.toLowerCase()) || url.protocol !== "https:") {
    const e = new Error("La URL no pertenece a CJdropshipping"); e.statusCode = 400; throw e;
  }
  const match = url.pathname.match(/-p-([0-9a-f]{8}-[0-9a-f-]{27,})\.html$/i);
  if (!match) { const e = new Error("No se encontró el identificador del producto CJ en esta URL"); e.statusCode = 422; throw e; }
  const pid = match[1];
  const accessToken = await token();
  const data = await cjFetch("/product/query?pid=" + encodeURIComponent(pid), {
    headers: { "CJ-Access-Token": accessToken }
  });
  if (!data || typeof data !== "object") throw new Error("CJ devolvió una ficha vacía");
  const name = String(data.productNameEn || data.productName || "").trim();
  const images = [...new Set([data.bigImage, ...(Array.isArray(data.productImageSet) ? data.productImageSet : [])].filter(v => typeof v === "string" && /^https:\/\//.test(v)))].slice(0, 8);
  if (!name || !images.length) { const e = new Error("CJ no devolvió nombre o imágenes para este producto"); e.statusCode = 422; throw e; }
  const product = {
    id: pid, name, description: String(data.description || data.productDescription || ""),
    productUrl: url.toString(), sourceCatalogUrl: url.toString(), sourceHost: url.hostname,
    image: images[0], images, supplierCategory: String(data.categoryName || ""),
    supplierPrice: 0, supplierCurrency: "USD", supplierProductId: pid,
    type: "product", department: "Catálogo", area: "Importados", family: "Proveedor"
  };
  return { ok: true, sourceUrl: url.toString(), sourceHost: url.hostname, count: 1, products: [product], source: "cj_api" };
}
