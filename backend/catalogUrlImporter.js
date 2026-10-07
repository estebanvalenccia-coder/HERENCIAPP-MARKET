import dns from "node:dns/promises";
import net from "node:net";
import { uploadR2MediaBuffer } from "./r2Media.js";

const MAX_HTML_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const USER_AGENT = "HerenciaMarketCatalogImporter/1.0 (+https://www.herenciamarket.es)";

function decodeEntities(value = "") {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function stripTags(value = "") {
  return decodeEntities(
    String(value)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();
}

function safeAbsoluteUrl(value, baseUrl) {
  try {
    const url = new URL(decodeEntities(String(value || "").trim()), baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function attrValue(attributes = "", name) {
  const pattern = new RegExp(name + "\\s*=\\s*([\"'])(.*?)\\1", "i");
  const match = String(attributes).match(pattern);
  return match ? decodeEntities(match[2]) : "";
}

function metaContent(html, property) {
  const patterns = [
    new RegExp('<meta[^>]+(?:property|name)=["\\\']' + property + '["\\\'][^>]+content=["\\\']([^"\\\']+)["\\\'][^>]*>', "i"),
    new RegExp('<meta[^>]+content=["\\\']([^"\\\']+)["\\\'][^>]+(?:property|name)=["\\\']' + property + '["\\\'][^>]*>', "i"),
  ];
  for (const pattern of patterns) {
    const match = String(html).match(pattern);
    if (match) return decodeEntities(match[1]).trim();
  }
  return "";
}

function h1Text(html) {
  const match = String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return match ? stripTags(match[1]) : "";
}

function normalizeImageList(value, baseUrl) {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const urls = [];
  for (const item of raw) {
    const candidate = typeof item === "string" ? item : item?.url || item?.contentUrl || "";
    const absolute = safeAbsoluteUrl(candidate, baseUrl);
    if (absolute && !urls.includes(absolute)) urls.push(absolute);
  }
  return urls;
}

function walkJsonLd(value, output = []) {
  if (!value) return output;
  if (Array.isArray(value)) {
    value.forEach((item) => walkJsonLd(item, output));
    return output;
  }
  if (typeof value !== "object") return output;
  const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
  if (types.some((item) => String(item || "").toLowerCase() === "product")) output.push(value);
  if (value["@graph"]) walkJsonLd(value["@graph"], output);
  if (value.itemListElement) walkJsonLd(value.itemListElement, output);
  if (value.item) walkJsonLd(value.item, output);
  return output;
}

function jsonLdProducts(html) {
  const products = [];
  const regex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(String(html)))) {
    try {
      walkJsonLd(JSON.parse(match[1].trim()), products);
    } catch {}
  }
  return products;
}

function usefulProductName(value = "") {
  const clean = stripTags(value);
  if (clean.length < 2 || clean.length > 180) return "";
  const normalized = clean.toLowerCase();
  if (["leer más", "ver más", "ver producto", "comprar", "más información"].includes(normalized)) return "";
  return clean;
}

function likelyProductUrl(url, baseUrl) {
  try {
    const target = new URL(url);
    const base = new URL(baseUrl);
    if (target.hostname !== base.hostname) return false;
    const path = target.pathname.toLowerCase();
    if (path === base.pathname.toLowerCase()) return false;
    return path.includes("/productosbatlle/") || path.includes("/producto/") || path.includes("/product/") || path.includes("/products/");
  } catch {
    return false;
  }
}

export function extractCatalogCandidates(html, baseUrl) {
  const byUrl = new Map();

  for (const product of jsonLdProducts(html)) {
    const url = safeAbsoluteUrl(product.url || product["@id"] || "", baseUrl);
    const name = usefulProductName(product.name || "");
    if (!url || !name) continue;
    byUrl.set(url, {
      id: url,
      name,
      productUrl: url,
      description: stripTags(product.description || ""),
      images: normalizeImageList(product.image, url),
      category: stripTags(product.category || ""),
    });
  }

  const anchorRegex = /<a\b([^>]*\bhref\s*=\s*(["'])(.*?)\2[^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRegex.exec(String(html)))) {
    const attributes = match[1] || "";
    const href = safeAbsoluteUrl(match[3], baseUrl);
    if (!href || !likelyProductUrl(href, baseUrl)) continue;

    const inner = match[4] || "";
    const title = usefulProductName(attrValue(attributes, "title"));
    const imageTag = inner.match(/<img\b([^>]*)>/i);
    const imageAlt = imageTag ? usefulProductName(attrValue(imageTag[1], "alt")) : "";
    const innerText = usefulProductName(inner);
    const name = title || imageAlt || innerText;
    const existing = byUrl.get(href);
    if (!existing && !name) continue;

    const imageSrc = imageTag
      ? safeAbsoluteUrl(
          attrValue(imageTag[1], "data-large_image") ||
          attrValue(imageTag[1], "data-src") ||
          attrValue(imageTag[1], "src"),
          href
        )
      : "";

    const next = existing || { id: href, name, productUrl: href, description: "", images: [], category: "" };
    if (!next.name && name) next.name = name;
    if (imageSrc && !next.images.includes(imageSrc)) next.images.push(imageSrc);
    byUrl.set(href, next);
  }

  return [...byUrl.values()].filter((item) => item.name && item.productUrl);
}

function productDetailsFromHtml(html, productUrl, fallback = {}) {
  const ldProduct = jsonLdProducts(html)[0] || {};
  const name =
    usefulProductName(ldProduct.name || "") ||
    usefulProductName(h1Text(html)) ||
    usefulProductName(metaContent(html, "og:title")) ||
    usefulProductName(fallback.name || "");

  const description =
    stripTags(ldProduct.description || "") ||
    stripTags(metaContent(html, "description")) ||
    stripTags(metaContent(html, "og:description")) ||
    stripTags(fallback.description || "");

  const images = [
    ...normalizeImageList(ldProduct.image, productUrl),
    ...normalizeImageList(metaContent(html, "og:image"), productUrl),
    ...(Array.isArray(fallback.images) ? fallback.images : []),
  ];

  const galleryRegex = /<img\b([^>]*(?:woocommerce-product-gallery|product-image|wp-post-image|attachment-woocommerce)[^>]*)>/gi;
  let imageMatch;
  while ((imageMatch = galleryRegex.exec(String(html)))) {
    const attrs = imageMatch[1];
    const src = attrValue(attrs, "data-large_image") || attrValue(attrs, "data-src") || attrValue(attrs, "src");
    const absolute = safeAbsoluteUrl(src, productUrl);
    if (absolute) images.push(absolute);
  }

  const uniqueImages = [...new Set(images.filter(Boolean))].slice(0, 8);
  return {
    ...fallback,
    id: productUrl,
    name,
    productUrl,
    description,
    images: uniqueImages,
    image: uniqueImages[0] || "",
    category: stripTags(ldProduct.category || "") || stripTags(fallback.category || ""),
  };
}

function isPrivateIpv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

function isPrivateIp(address) {
  const kind = net.isIP(address);
  if (kind === 4) return isPrivateIpv4(address);
  if (kind === 6) {
    const normalized = address.toLowerCase();
    return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") ||
      normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
      normalized.startsWith("fea") || normalized.startsWith("feb");
  }
  return true;
}

export async function assertSafeExternalUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw Object.assign(new Error("URL no válida"), { statusCode: 400 });
  }

  if (!["http:", "https:"].includes(url.protocol)) throw Object.assign(new Error("Solo se permiten URLs http o https"), { statusCode: 400 });
  if (url.username || url.password) throw Object.assign(new Error("La URL no puede contener credenciales"), { statusCode: 400 });

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw Object.assign(new Error("Ese host no está permitido"), { statusCode: 400 });
  }

  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw Object.assign(new Error("No se permiten redes privadas"), { statusCode: 400 });
  } else {
    let addresses;
    try {
      addresses = await dns.lookup(host, { all: true, verbatim: true });
    } catch {
      throw Object.assign(new Error("No se pudo resolver el dominio del proveedor"), { statusCode: 400 });
    }
    if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
      throw Object.assign(new Error("El dominio resuelve a una red no permitida"), { statusCode: 400 });
    }
  }

  return url;
}

async function safeFetch(urlValue, { maxBytes, accept, timeoutMs = 12000 } = {}) {
  let current = await assertSafeExternalUrl(urlValue);

  for (let redirect = 0; redirect <= 4; redirect += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT, accept: accept || "*/*" },
      });
    } catch (error) {
      if (error?.name === "AbortError") throw Object.assign(new Error("El proveedor tardó demasiado en responder"), { statusCode: 504 });
      throw Object.assign(new Error("No se pudo conectar con el proveedor"), { statusCode: 502 });
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw Object.assign(new Error("Redirección del proveedor no válida"), { statusCode: 502 });
      current = await assertSafeExternalUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw Object.assign(new Error("El proveedor respondió con HTTP " + response.status), { statusCode: 502 });

    const declared = Number(response.headers.get("content-length") || 0);
    if (declared && maxBytes && declared > maxBytes) throw Object.assign(new Error("La respuesta del proveedor es demasiado grande"), { statusCode: 413 });

    const array = new Uint8Array(await response.arrayBuffer());
    if (maxBytes && array.byteLength > maxBytes) throw Object.assign(new Error("La respuesta del proveedor supera el límite permitido"), { statusCode: 413 });

    return { url: current.toString(), headers: response.headers, buffer: Buffer.from(array) };
  }

  throw Object.assign(new Error("Demasiadas redirecciones"), { statusCode: 502 });
}

async function fetchHtml(url) {
  const result = await safeFetch(url, { maxBytes: MAX_HTML_BYTES, accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" });
  const contentType = String(result.headers.get("content-type") || "").toLowerCase();
  if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    throw Object.assign(new Error("La URL no parece ser una página HTML"), { statusCode: 415 });
  }
  return { ...result, html: result.buffer.toString("utf8") };
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  });
  await Promise.all(runners);
  return results;
}

export function guessCatalogTaxonomy(urlValue = "", label = "") {
  const text = (String(urlValue) + " " + String(label)).toLowerCase();
  if (/semilla|seed/.test(text)) {
    const area = /hort[ií]cola|hortaliza|tomate|pimiento|zanahoria|pepino|mel[oó]n|sand[ií]a/.test(text)
      ? "Hortícolas"
      : /arom[aá]tica/.test(text)
        ? "Aromáticas"
        : /flor/.test(text)
          ? "Flores"
          : "Semillas";
    return { category: "semillas", collection: "semillas", type: "seed", department: "Semillas", area, family: area };
  }
  if (/sustrato|tierra|humus|esti[eé]rcol|fibra de coco/.test(text)) {
    return { category: "sustratos", collection: "sustratos", type: "substrate", department: "Tierra y sustratos", area: "Sustratos", family: "Sustratos" };
  }
  if (/jard[ií]n|jardiner[ií]a|maceta|herramienta|riego/.test(text)) {
    return { category: "jardineria", collection: "jardineria", type: "garden", department: "Jardinería", area: "Jardinería", family: "Jardinería" };
  }
  return { category: "jardineria", collection: "jardineria", type: "product", department: "Catálogo", area: "Importados", family: "Proveedor" };
}

export async function analyzeCatalogUrl(urlValue, { maxProducts = 60 } = {}) {
  const page = await fetchHtml(urlValue);
  const baseUrl = page.url;
  let candidates = extractCatalogCandidates(page.html, baseUrl).slice(0, Math.max(1, Math.min(100, Number(maxProducts) || 60)));

  if (!candidates.length) {
    const single = productDetailsFromHtml(page.html, baseUrl, {});
    if (single.name && single.images.length) candidates = [single];
  }

  const enriched = await mapWithConcurrency(candidates, 4, async (candidate) => {
    try {
      const detail = await fetchHtml(candidate.productUrl);
      return productDetailsFromHtml(detail.html, detail.url, candidate);
    } catch {
      return { ...candidate, image: candidate.images?.[0] || "", images: candidate.images || [] };
    }
  });

  const source = new URL(baseUrl);
  const limit = Math.max(1, Math.min(100, Number(maxProducts) || 60));
  return {
    ok: true,
    sourceUrl: baseUrl,
    sourceHost: source.hostname,
    count: enriched.length,
    truncated: enriched.length >= limit,
    products: enriched.map((item) => {
      const taxonomy = guessCatalogTaxonomy(item.productUrl || baseUrl, item.category || item.name);
      return {
        id: item.id || item.productUrl,
        name: item.name,
        description: item.description || "",
        productUrl: item.productUrl,
        sourceCatalogUrl: baseUrl,
        sourceHost: source.hostname,
        image: item.image || item.images?.[0] || "",
        images: (item.images || []).slice(0, 8),
        supplierCategory: item.category || "",
        ...taxonomy,
      };
    }),
  };
}

export async function mirrorRemoteProductImages(product, { maxImages = 8 } = {}) {
  const source = Array.isArray(product?.images) && product.images.length ? product.images : product?.image ? [product.image] : [];
  const unique = [...new Set(source.map((value) => String(value || "").trim()).filter(Boolean))].slice(0, Math.max(1, Math.min(8, maxImages)));
  const media = [];

  for (let index = 0; index < unique.length; index += 1) {
    try {
      const fetched = await safeFetch(unique[index], {
        maxBytes: MAX_IMAGE_BYTES,
        accept: "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.8,*/*;q=0.2",
      });
      const mimeType = String(fetched.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(mimeType)) continue;
      const uploaded = await uploadR2MediaBuffer({
        buffer: fetched.buffer,
        mimeType,
        filename: String(product?.name || "producto") + "-" + (index + 1),
      });
      media.push({ ...uploaded, sourceUrl: unique[index] });
    } catch {}
  }

  if (unique.length && !media.length) {
    throw Object.assign(new Error("No se pudo copiar ninguna imagen del proveedor a Cloudflare R2"), { statusCode: 502 });
  }
  return media;
}
