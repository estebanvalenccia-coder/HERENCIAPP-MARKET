const xml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const text = (value) => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const absoluteImage = (value, origin) => { try { const u = new URL(String(value || ""), origin); return u.protocol === "https:" ? u.href : ""; } catch { return ""; } };
const firstImage = (p, origin) => {
  const images = Array.isArray(p.images) ? p.images : [];
  return [p.image, p.imageUrl, p.image_url, ...images.map(i => typeof i === "string" ? i : i?.url || i?.imageUrl), p.metadata?.image]
    .map(x => absoluteImage(x, origin)).find(Boolean) || "";
};
const validPrice = v => Number.isFinite(Number(v)) && Number(v) > 0;
export function buildGoogleShoppingFeed(products, origin = "https://herenciamarket.es") {
  const items = (Array.isArray(products) ? products : []).filter(p => {
    const status = String(p?.status || "active").toLowerCase();
    const stock = Number(p?.stock ?? p?.stockQuantity ?? p?.inventory ?? 0);
    return p && !p.deletedAt && status === "active" && p.active !== false
      && !["servicios", "dulce", "moda"].includes(String(p.collection || "").toLowerCase())
      && validPrice(p.onSale && validPrice(p.salePrice) ? p.salePrice : p.price)
      && Boolean(firstImage(p, origin)) && Boolean(p.id) && Boolean(text(p.name || p.title))
      && !(p.trackInventory === true && stock <= 0);
  }).map(p => {
    const price = Number(p.price);
    const sale = p.onSale && validPrice(p.salePrice) && Number(p.salePrice) < price ? Number(p.salePrice) : null;
    const amount = sale ?? price;
    const availableStock = Number(p.stock ?? p.stockQuantity ?? p.inventory ?? 0);
    const availability = (p.trackInventory === true && availableStock <= 0) || p.inStock === false ? "out_of_stock" : "in_stock";
    const id = String(p.id);
    const link = new URL("/producto/" + encodeURIComponent(id), origin).href;
    const description = text(p.description || p.shortDescription || p.name || p.title).slice(0, 4800);
    const title = text(p.name || p.title).slice(0, 150);
    const tags = [
      ["g:id", id], ["g:title", title], ["g:description", description], ["g:link", link],
      ["g:image_link", firstImage(p, origin)], ["g:availability", availability],
      ["g:price", price.toFixed(2) + " EUR"], ["g:condition", "new"],
      ["g:identifier_exists", p.gtin || p.mpn ? "yes" : "no"],
    ];
    if (sale) tags.push(["g:sale_price", amount.toFixed(2) + " EUR"]);
    if (p.brand) tags.push(["g:brand", text(p.brand)]);
    if (p.gtin) tags.push(["g:gtin", text(p.gtin)]);
    if (p.mpn) tags.push(["g:mpn", text(p.mpn)]);
    if (p.category) tags.push(["g:product_type", text(p.category)]);
    return "    <item>\n" + tags.map(([key, value]) => "      <" + key + ">" + xml(value) + "</" + key + ">").join("\n") + "\n    </item>";
  });
  return '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n    <title>Herencia Market</title>\n    <link>' + xml(origin) + '</link>\n    <description>Catálogo público de productos de Herencia Market</description>\n' + items.join("\n") + '\n  </channel>\n</rss>\n';
}
