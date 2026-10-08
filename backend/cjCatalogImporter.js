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

/**
 * Read-only variant lookup, authenticated with the same CJ API key as catalog import.
 * Prices returned by CJ are in USD and exclude shipping; never convert them into
 * a supplier cost in EUR without an exchange-rate/shipping calculation.
 */
export async function queryCjProductVariants(pidInput) {
  const pid = String(pidInput || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pid)) {
    const error = new Error("Identificador de producto CJ no válido");
    error.statusCode = 422;
    throw error;
  }
  const accessToken = await token();
  const data = await cjFetch("/product/variant/query?pid=" + encodeURIComponent(pid), {
    headers: { "CJ-Access-Token": accessToken }
  });
  if (!Array.isArray(data)) {
    const error = new Error("CJ no devolvió la lista de variantes del producto");
    error.statusCode = 502;
    throw error;
  }
  const variants = data.filter((entry) => entry && String(entry.vid || "").trim()).slice(0, 200).map((entry) => {
    const rawUsd = entry.variantSellPrice;
    const parsedPrice = rawUsd === null || rawUsd === undefined || rawUsd === "" ? null : Number(rawUsd);
    return {
      vid: String(entry.vid).trim().slice(0, 100),
      sku: String(entry.variantSku || "").trim().slice(0, 100),
      name: String(entry.variantNameEn || entry.variantName || entry.variantKey || "").trim().slice(0, 220),
      option: String(entry.variantKey || "").trim().slice(0, 150),
      priceUsd: parsedPrice != null && Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : null,
      image: /^https:\/\//i.test(String(entry.variantImage || "")) ? String(entry.variantImage).slice(0, 2000) : "",
    };
  });
  return { pid, variants, total: data.length, truncated: data.length > variants.length, currency: "USD", source: "cj_api" };
}
