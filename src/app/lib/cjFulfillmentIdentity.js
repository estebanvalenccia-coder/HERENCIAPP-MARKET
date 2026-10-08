// Read-only shipping classification. The server still validates products, prices and carrier rates.
export function isCjSupplierItem(item) {
  const meta = item?.metadata && typeof item.metadata === "object" ? item.metadata : item || {};
  const sourceHost = String(meta.sourceHost || "").replace(/^www\./, "").toLowerCase();
  let fromUrl = "";
  try {
    fromUrl = new URL(String(meta.sourceProductUrl || "")).hostname.toLowerCase().replace(/^www\./, "");
  } catch {}
  return String(meta.fulfillmentType || "").toLowerCase() === "dropship" &&
    (sourceHost === "cjdropshipping.com" || fromUrl === "cjdropshipping.com");
}

// Cart snapshots can be older than the current product metadata. Use the public
// authoritative catalog to display the right delivery type, never to set prices.
export function enrichCartWithCatalog(cart, catalog) {
  const products = new Map((Array.isArray(catalog) ? catalog : [])
    .map(product => [String(product?.id ?? ""), product]));
  return (Array.isArray(cart) ? cart : []).map(item => {
    const product = products.get(String(item?.id ?? ""));
    return product ? { ...item, metadata: product.metadata ?? {} } : item;
  });
}
