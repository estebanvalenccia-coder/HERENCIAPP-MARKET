// CJdropshipping read-only catalog adapter. Never creates or pays orders.
import { extractCjProductId, isCjProductId } from "./cjProductIds.js";
import { splitSupplierOptions } from "../src/app/lib/productVariantOptions.js";
const BASE = "https://developers.cjdropshipping.com/api2.0/v1";
let cachedToken = "";
let cachedUntil = 0;
// Share a single authentication request across concurrent CJ operations.
let tokenInFlight = null;
// CJ frequency limits apply to the same CJ account, not just one checkout.
// Keep API requests sequential in this Node process (including token acquisition).
// API point quotas are additional; a local throttle cannot increase an exhausted quota.
const CJ_CALL_GAP_MS = 1250;
const CJ_QUOTE_TTL_MS = 45_000;
let nextCallAt = 0;
let pauseUntil = 0;
let pauseReason = "CJ_RATE_LIMITED";
let callQueue = Promise.resolve();
const recentResults = new Map();
const inFlight = new Map();

export function classifyCjApiLimit(httpStatus, apiCode) {
  const code = Number(apiCode);
  if (code === 1600201 || code === 429) return "CJ_QUOTA_EXHAUSTED";
  if (code === 1600200 || Number(httpStatus) === 429) return "CJ_RATE_LIMITED";
  return null;
}
function cjUnavailable(code, httpStatus, upstreamCode) {
  const error = new Error(code === "CJ_QUOTA_EXHAUSTED"
    ? "La cuota de consultas a CJ está agotada temporalmente."
    : "CJ está limitando temporalmente las consultas.");
  error.statusCode = 503;
  error.code = code;
  error.upstreamHttpStatus = Number(httpStatus) || undefined;
  error.upstreamCode = Number(upstreamCode) || undefined;
  return error;
}
function scheduleCjRequest(fn) {
  const run = callQueue.then(async () => {
    if (pauseUntil > Date.now()) {
      throw cjUnavailable(pauseReason, 429, pauseReason === "CJ_QUOTA_EXHAUSTED" ? 1600201 : 1600200);
    }
    const wait = Math.max(0, nextCallAt - Date.now());
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    // Reserve the next slot BEFORE starting the HTTP call.
    nextCallAt = Date.now() + CJ_CALL_GAP_MS;
    try {
      return await fn();
    } catch (error) {
      if (error?.code === "CJ_RATE_LIMITED" || error?.code === "CJ_QUOTA_EXHAUSTED") {
        // Do not loop over rate-limit failures; fail closed with a short circuit breaker.
        pauseReason = error.code;
        pauseUntil = Date.now() + (error.code === "CJ_QUOTA_EXHAUSTED" ? 60_000 : 30_000);
      }
      throw error;
    }
  });
  callQueue = run.then(() => undefined, () => undefined);
  return run;
}
async function cjFetch(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const cacheable = path.startsWith("/product/variant/") || path === "/logistic/freightCalculate";
  const key = cacheable ? method + " " + path + " " + String(options.body || "") : "";
  const previous = key && recentResults.get(key);
  if (previous && previous.expiresAt > Date.now()) return previous.data;
  if (key && inFlight.has(key)) return inFlight.get(key);

  const pending = scheduleCjRequest(async () => {
    const response = await fetch(BASE + path, { ...options, signal: AbortSignal.timeout(18000) });
    const payload = await response.json().catch(() => null);
    const upstreamCode = Number(payload?.code);
    const limit = classifyCjApiLimit(response.status, upstreamCode);
    if (limit) throw cjUnavailable(limit, response.status, upstreamCode);
    if (!response.ok || !payload || payload.result === false || payload.success === false ||
        (payload.code && upstreamCode !== 200)) {
      const error = new Error("CJ: " + String(payload?.message || ("HTTP " + response.status)).slice(0, 220));
      error.statusCode = 502;
      error.upstreamHttpStatus = response.status;
      error.upstreamCode = Number.isFinite(upstreamCode) ? upstreamCode : undefined;
      throw error;
    }
    if (key) {
      if (recentResults.size >= 120) recentResults.delete(recentResults.keys().next().value);
      recentResults.set(key, { data: payload.data, expiresAt: Date.now() + CJ_QUOTE_TTL_MS });
    }
    return payload.data;
  });
  if (!key) return pending;
  inFlight.set(key, pending);
  try { return await pending; }
  finally { inFlight.delete(key); }
}
async function token() {
  if (cachedToken && Date.now() < cachedUntil) return cachedToken;
  const key = String(process.env.CJ_API_KEY || "").trim();
  if (!key) { const e = new Error("Falta CJ_API_KEY en Railway"); e.statusCode = 503; throw e; }
  // The auth path is intentionally not part of the general freight cache.
  // Without a single-flight guard two simultaneous quotes can both obtain
  // their own CJ token, wasting one of the provider's rate-limited requests.
  if (tokenInFlight) return tokenInFlight;
  tokenInFlight = (async () => {
    const data = await cjFetch("/authentication/getAccessToken", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: key })
    });
    if (!data?.accessToken) throw new Error("CJ no devolvió un accessToken");
    cachedToken = data.accessToken;
    cachedUntil = Date.now() + 12 * 60 * 60 * 1000;
    return cachedToken;
  })();
  try { return await tokenInFlight; }
  finally { tokenInFlight = null; }
}
export async function previewCjProductUrl(input) {
  const url = new URL(input);
  if (!["cjdropshipping.com", "www.cjdropshipping.com"].includes(url.hostname.toLowerCase()) || url.protocol !== "https:") {
    const e = new Error("La URL no pertenece a CJdropshipping"); e.statusCode = 400; throw e;
  }
  const pid = extractCjProductId(url);
  if (!pid) { const e = new Error("No se encontró el identificador del producto CJ en esta URL"); e.statusCode = 422; throw e; }
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
  // Read-only convenience step: automatically load the real SKU/VID choices
  // for a draft, but never let a variant API failure block ordinary imports.
  let variantsWarning = "";
  try {
    const response = await queryCjProductVariants(pid);
    if (response.truncated) {
      variantsWarning = "CJ tiene más de 200 variantes: revisa las opciones desde Administración.";
    } else if (Array.isArray(response.variants) && response.variants.length) {
      const mapped = response.variants.map(variant => {
        const optionValues=splitSupplierOptions(variant.option || variant.name || variant.sku || variant.vid);
        return {
          name: optionValues.join(" · "),
          sku: String(variant.sku || ""),
          stock:0,
          supplierVariantId:String(variant.vid),
          supplierSku:String(variant.sku || ""),
          optionValues,
          image: String(variant.image || ""),
        };
      });
      const labels=new Set(mapped.map(v=>v.name.toLowerCase()));
      if (mapped.every(v=>v.supplierVariantId && v.supplierSku) && labels.size===mapped.length) {
        product.variants=mapped;
      } else {
        variantsWarning="CJ devolvió opciones repetidas o incompletas; consulta las variantes desde Administración.";
      }
    }
  } catch (error) {
    variantsWarning="No se pudieron consultar todas las opciones CJ. Puedes volver a intentarlo desde Administración.";
  }
  return { ok: true, sourceUrl: url.toString(), sourceHost: url.hostname, count: 1, products: [product], source: "cj_api",
    ...(variantsWarning ? {variantsWarning} : {}) };
}

/**
 * Read-only variant lookup, authenticated with the same CJ API key as catalog import.
 * Prices returned by CJ are in USD and exclude shipping; never convert them into
 * a supplier cost in EUR without an exchange-rate/shipping calculation.
 */
export async function queryCjProductVariants(pidInput) {
  const pid = String(pidInput || "").trim();
  if (!isCjProductId(pid)) {
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

/**
 * Read-only shipping quotation for one CJ VID. Queries destination-country rates;
 * final freight/taxes can differ once the customer's full postal address is known.
 */
export async function quoteCjVariantShipping({ vid, quantity = 1, origin = "CN", destination = "ES", zip = "" } = {}) {
  const safeVid = String(vid || "").trim();
  if (!/^[a-z0-9-]{8,100}$/i.test(safeVid)) {
    const error = new Error("Selecciona una variante CJ válida"); error.statusCode = 422; throw error;
  }
  const from = String(origin || "").trim().toUpperCase();
  const to = String(destination || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(from) || !/^[A-Z]{2}$/.test(to)) {
    const error = new Error("Origen o destino inválido"); error.statusCode = 422; throw error;
  }
  const qty = Math.max(1, Math.min(20, Math.floor(Number(quantity || 1))));
  const postal = String(zip || "").trim();
  if (postal && !/^[a-z0-9 -]{2,15}$/i.test(postal)) {
    const error = new Error("Código postal no válido"); error.statusCode = 422; throw error;
  }
  const accessToken = await token();
  const data = await cjFetch("/logistic/freightCalculate", {
    method: "POST",
    headers: { "content-type": "application/json", "CJ-Access-Token": accessToken },
    body: JSON.stringify({
      startCountryCode: from,
      endCountryCode: to,
      ...(postal ? {zip:postal}:{}),
      products: [{ quantity: qty, vid: safeVid }],
    }),
  });
  if (!Array.isArray(data)) {
    const error = new Error("CJ no devolvió opciones de transporte para el producto");
    error.statusCode = 502; throw error;
  }
  const price = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
  };
  const methods = data.slice(0, 60).map((entry) => ({
    name: String(entry?.logisticName || "").slice(0, 120),
    time: String(entry?.logisticAging || "").slice(0, 80),
    shippingUsd: price(entry?.logisticPrice),
    taxesUsd: price(entry?.taxesFee),
    clearanceUsd: price(entry?.clearanceOperationFee),
    totalPostageUsd: price(entry?.totalPostageFee),
  })).filter(entry => entry.name && entry.shippingUsd !== null);
  return {
    origin: from, destination: to, zip: postal, vid:safeVid, quantity:qty,
    methods: methods.sort((a,b) => (a.totalPostageUsd ?? a.shippingUsd) - (b.totalPostageUsd ?? b.shippingUsd)),
    currency: "USD", rateType: "country_estimate", source: "cj_api",
    warning: "Estimación preliminar, no una cotización final. Revisa coste total, impuestos y destino exacto antes de pagar."
  };
}


/**
 * Verify a CJ supplier variant by the listed product variants first, then the
 * official per-VID endpoint. The fallback must agree on BOTH VID and product
 * PID; never allow a variant from another product to be charged.
 */
export async function queryCjVariantByVid(vidInput) {
  const vid = String(vidInput || "").trim();
  if (!/^[a-z0-9-]{8,100}$/i.test(vid)) {
    const error = new Error("Identificador de variante CJ inválido");
    error.statusCode = 422;
    throw error;
  }
  const accessToken = await token();
  const data = await cjFetch("/product/variant/queryByVid?vid=" + encodeURIComponent(vid), {
    headers: { "CJ-Access-Token": accessToken },
  });
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    const error = new Error("CJ no devolvió la variante solicitada");
    error.statusCode = 502;
    throw error;
  }
  const rawPrice = data.variantSellPrice;
  const parsedPrice = rawPrice === undefined || rawPrice === null || rawPrice === "" ? null : Number(rawPrice);
  return {
    vid: String(data.vid || "").trim(),
    pid: String(data.pid || "").trim(),
    sku: String(data.variantSku || "").trim().slice(0, 100),
    priceUsd: parsedPrice !== null && Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : null,
    name: String(data.variantNameEn || data.variantName || "").slice(0, 220),
  };
}

export async function verifyCjVariantPrice(
  { pid: rawPid, vid: rawVid } = {},
  { listVariants = queryCjProductVariants, lookupVariant = queryCjVariantByVid } = {},
) {
  const pid = String(rawPid || "").trim();
  const vid = String(rawVid || "").trim();
  if (!isCjProductId(pid) || !/^[a-z0-9-]{8,100}$/i.test(vid)) {
    const error = new Error("Producto o variante CJ inválidos");
    error.statusCode = 422;
    throw error;
  }
  let originalError;
  try {
    const response = await listVariants(pid);
    const matching = (Array.isArray(response?.variants) ? response.variants : []).find((entry) => String(entry?.vid || "") === vid);
    if (matching && matching.priceUsd !== null && matching.priceUsd !== undefined &&
        Number.isFinite(Number(matching.priceUsd)) && Number(matching.priceUsd) >= 0) {
      return { ...matching, pid, priceUsd: Number(matching.priceUsd) };
    }
  } catch (error) {
    originalError = error;
  }
  try {
    const fallback = await lookupVariant(vid);
    if (String(fallback?.vid || "") !== vid || String(fallback?.pid || "").toLowerCase() !== pid.toLowerCase() ||
        fallback?.priceUsd == null || !Number.isFinite(Number(fallback.priceUsd)) || Number(fallback.priceUsd) < 0) {
      const error = new Error("CJ no confirmó el vínculo PID/VID y precio actual");
      error.code = "CJ_VARIANT_IDENTITY_MISMATCH";
      throw error;
    }
    return { ...fallback, pid, priceUsd: Number(fallback.priceUsd) };
  } catch (error) {
    const failure = new Error("No se pudo verificar la variante CJ con ninguno de los dos métodos.");
    failure.statusCode = 502;
    failure.code = error?.code || originalError?.code || "CJ_VARIANT_VERIFICATION_UNAVAILABLE";
    failure.upstreamHttpStatus = error?.upstreamHttpStatus ?? originalError?.upstreamHttpStatus;
    failure.upstreamCode = error?.upstreamCode ?? originalError?.upstreamCode;
    throw failure;
  }
}
