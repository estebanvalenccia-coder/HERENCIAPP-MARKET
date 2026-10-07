import dns from "node:dns/promises";
import net from "node:net";

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

export function extractProductGalleryImages(html, productUrl) {
  const urls = [];
  const source = String(html || "");

  // WooCommerce keeps actual product media inside .woocommerce-product-gallery__image.
  // Related products often use attachment-woocommerce_thumbnail; those must never enter
  // the product gallery.
  const galleryItemRegex = /<div\b[^>]*class=["'][^"']*woocommerce-product-gallery__image[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
  let itemMatch;

  while ((itemMatch = galleryItemRegex.exec(source))) {
    const block = itemMatch[1] || "";
    const imageMatch = block.match(/<img\b([^>]*)>/i);
    const linkMatch = block.match(/<a\b[^>]*href=(["'])(.*?)\1/i);

    const attrs = imageMatch?.[1] || "";
    const candidate =
      attrValue(attrs, "data-large_image") ||
      attrValue(attrs, "data-src") ||
      (linkMatch ? linkMatch[2] : "") ||
      attrValue(attrs, "src");

    const absolute = safeAbsoluteUrl(candidate, productUrl);
    if (absolute && !urls.includes(absolute)) urls.push(absolute);
  }

  return urls;
}

function normalizedOfferPrice(value) {
  if (value == null || value === "") return 0;
  const raw = String(value).trim().replace(/\s+/g, "");
  if (!raw) return 0;
  const normalized = raw.includes(",") && !raw.includes(".")
    ? raw.replace(",", ".")
    : raw.replace(/,/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0;
}

function productOfferData(product = {}, fallback = {}) {
  const offersRaw = product?.offers;
  const offers = Array.isArray(offersRaw) ? offersRaw.find(Boolean) || {} : (offersRaw || {});
  const priceSpecification = Array.isArray(offers?.priceSpecification)
    ? offers.priceSpecification.find(Boolean) || {}
    : (offers?.priceSpecification || {});

  const supplierPrice =
    normalizedOfferPrice(offers?.price) ||
    normalizedOfferPrice(offers?.lowPrice) ||
    normalizedOfferPrice(priceSpecification?.price) ||
    normalizedOfferPrice(fallback?.supplierPrice);

  const supplierCurrency = String(
    offers?.priceCurrency ||
    priceSpecification?.priceCurrency ||
    fallback?.supplierCurrency ||
    ""
  ).trim().toUpperCase().slice(0, 8);

  return { supplierPrice, supplierCurrency };
}

export function productDetailsFromHtml(html, productUrl, fallback = {}) {
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

  const { supplierPrice, supplierCurrency } = productOfferData(ldProduct, fallback);

  const images = [
    ...normalizeImageList(ldProduct.image, productUrl),
    ...normalizeImageList(metaContent(html, "og:image"), productUrl),
    ...(Array.isArray(fallback.images) ? fallback.images : []),
  ];

  images.push(...extractProductGalleryImages(html, productUrl));

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
    supplierPrice,
    supplierCurrency,
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
      normalized.startsWith("fea") || normalized.startsWith("feb") ||
      normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.") || normalized.startsWith("::ffff:169.254.");
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
    const isHuerto = /hort[ií]cola|hortaliza|tomate|pimiento|zanahoria|pepino|mel[oó]n|sand[ií]a|lechuga|cebolla|calabac[ií]n|berenjena|r[aá]bano|remolacha|jud[ií]a|guisante|ma[ií]z/.test(text);
    const isAromatic = /arom[aá]tica|albahaca|perejil|cilantro|menta|romero|tomillo|or[eé]gano/.test(text);
    const isFlower = /flor|petunia|zinnia|cal[eé]ndula|girasol|capuchina|pensamiento/.test(text);

    const category = isHuerto
      ? "semillas-huerto"
      : isAromatic
        ? "semillas-aromaticas"
        : isFlower
          ? "semillas-flores"
          : "semillas-otros";

    const area = isHuerto ? "Hortícolas" : isAromatic ? "Aromáticas" : isFlower ? "Flores" : "Otras semillas";
    return { category, collection: "semillas", type: "seed", department: "Semillas", area, family: area };
  }

  if (/sustrato|tierra|humus|esti[eé]rcol|fibra de coco|coco|perlita|vermiculita|arlita|abono/.test(text)) {
    const category = /universal/.test(text)
      ? "tierra-universal"
      : /humus|esti[eé]rcol|abono|fertiliz/.test(text)
        ? "abonos"
        : /coco|perlita|vermiculita|arlita|drenaje/.test(text)
          ? "drenaje"
          : "sustratos-especiales";
    return { category, collection: "sustratos", type: "substrate", department: "Tierra y sustratos", area: "Sustratos", family: "Sustratos" };
  }

  if (/jard[ií]n|jardiner[ií]a|maceta|herramienta|riego|regadera|tijera|pala/.test(text)) {
    const category = /herramienta|tijera|pala/.test(text)
      ? "herramientas"
      : /riego|regadera/.test(text)
        ? "riego"
        : /fertiliz/.test(text)
          ? "fertilizantes"
          : "accesorios-jardin";
    return { category, collection: "jardineria", type: "garden", department: "Jardinería", area: "Jardinería", family: "Jardinería" };
  }

  return { category: "accesorios-jardin", collection: "jardineria", type: "product", department: "Catálogo", area: "Importados", family: "Proveedor" };
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
        supplierPrice: Number(item.supplierPrice || 0),
        supplierCurrency: String(item.supplierCurrency || ""),
        ...taxonomy,
      };
    }),
  };
}

export async function analyzeProductUrl(urlValue) {
  const page = await fetchHtml(urlValue);
  const details = productDetailsFromHtml(page.html, page.url, {});
  if (!details?.name) {
    throw Object.assign(new Error("No se pudo reconocer la ficha del producto"), { statusCode: 422 });
  }
  const source = new URL(page.url);
  const taxonomy = guessCatalogTaxonomy(page.url, details.category || details.name);
  return {
    id: page.url,
    name: details.name,
    description: details.description || "",
    productUrl: page.url,
    sourceCatalogUrl: page.url,
    sourceHost: source.hostname,
    image: details.image || details.images?.[0] || "",
    images: (details.images || []).slice(0, 8),
    supplierCategory: details.category || "",
    supplierPrice: Number(details.supplierPrice || 0),
    supplierCurrency: String(details.supplierCurrency || ""),
    ...taxonomy,
  };
}

export async function mirrorRemoteProductImages(product, { maxImages = 8 } = {}) {
  const { uploadR2MediaBuffer } = await import("./r2Media.js");
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
