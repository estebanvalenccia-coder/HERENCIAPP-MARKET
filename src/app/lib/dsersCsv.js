/**
 * DSers CSV Upload > Product format. Keep headers byte-for-byte compatible
 * with the official import_products.xlsx sheet supplied by a merchant.
 * CSV is documented as a supported interchange for self-built storefronts.
 * Never guess an AliExpress variant SKU or source URL.
 */
export const DSERS_PRODUCT_HEADERS = Object.freeze([
  "product_id",
  "SKU（your product SKU）",
  "Supplier_url（Optional）",
  "SKU（Supplier SKU）（Optional）",
]);

function text(value) {
  return value == null ? "" : String(value).trim();
}

function isAliExpressHost(hostname) {
  const host = text(hostname).toLowerCase().replace(/\.$/, "");
  return host === "aliexpress.com" || host.endsWith(".aliexpress.com");
}

export function isAliExpressProduct(product) {
  const metadata = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};
  if (isAliExpressHost(metadata.sourceHost)) return true;
  try {
    return isAliExpressHost(new URL(text(metadata.sourceProductUrl)).hostname);
  } catch {
    return false;
  }
}

function officialAliExpressUrl(raw) {
  try {
    const url = new URL(text(raw));
    if (url.protocol !== "https:" || !isAliExpressHost(url.hostname) || url.username || url.password) return "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function safeIdentifier(raw, length) {
  const value = text(raw);
  if (!value || value.length > length || !/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value)) return "";
  // Reject spreadsheet formula prefixes, whitespace and control characters.
  return value;
}

function csvCell(value) {
  const cell = text(value);
  // Headers and merchant identifiers are strict; URLs still need quoting.
  if (/[",\r\n]/.test(cell)) return '"' + cell.replace(/"/g, '""') + '"';
  return cell;
}

export function dsersRowsForProducts(products = []) {
  const rows = [];
  const skipped = [];
  const seen = new Set();
  const candidates = Array.isArray(products) ? products.filter(isAliExpressProduct) : [];

  for (const product of candidates) {
    const meta = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};
    const productId = safeIdentifier(product?.id, 128);
    const name = text(product?.name) || "Producto";
    if (product?.deletedAt || text(product?.status).toLowerCase() === "archived") {
      skipped.push({ id: text(product?.id), name, reason: "Está en la papelera" });
      continue;
    }
    if (!productId) {
      skipped.push({ id: text(product?.id), name, reason: "ID de producto ausente o no válido" });
      continue;
    }

    const supplierUrl = officialAliExpressUrl(meta.sourceProductUrl);
    const rawVariants = Array.isArray(product?.variants) ? product.variants : [];
    const variants = rawVariants.filter(variant => variant && typeof variant === "object");
    const saleSkus = variants.length
      ? variants.map(variant => ({
          sku: variant.sku,
          // A supplier's SKU is optional. Do not use a parent SKU for all variants.
          supplierSku: variant.supplierSku || variant.metadata?.supplierSku || "",
        }))
      : [{ sku: product?.sku, supplierSku: meta.supplierSku || "" }];

    for (const variant of saleSkus) {
      const sku = safeIdentifier(variant.sku, 128);
      if (!sku) {
        skipped.push({ id: productId, name, reason: "Falta SKU propio válido" });
        continue;
      }
      const key = sku.toLowerCase();
      if (seen.has(key)) {
        skipped.push({ id: productId, name, reason: "SKU propio duplicado: " + sku });
        continue;
      }
      seen.add(key);
      rows.push([
        productId,
        sku,
        supplierUrl,
        safeIdentifier(variant.supplierSku, 128),
      ]);
    }
  }

  return { rows, skipped, candidates: candidates.length };
}

export function createDsersProductCsv(products = []) {
  const { rows, skipped, candidates } = dsersRowsForProducts(products);
  // BOM allows Excel and DSers to interpret full-width parentheses correctly.
  const csv = "\uFEFF" + [DSERS_PRODUCT_HEADERS, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
  return { csv, rows, skipped, candidates, exported: rows.length };
}
