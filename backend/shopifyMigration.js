/**
 * HERENCIA → SHOPIFY: pure preparation helpers. No network calls or writes.
 * Does not replace the current checkout or set authoritative sale prices.
 */
export const SHOPIFY_CSV_HEADERS = [
  "URL handle", "Title", "Description", "Vendor", "Type", "Tags",
  "Published on online store", "Status", "Option1 name", "Option1 value",
  "SKU", "Price", "Compare-at price", "Charge tax", "Inventory tracker",
  "Inventory quantity", "Continue selling when out of stock",
  "Fulfillment service", "Requires shipping", "Product image URL",
  "Image position", "Image alt text", "SEO title", "SEO description",
];

const value = (v) => String(v ?? "").trim();
const money = (v) => {
  const amount = Number(v);
  return Number.isFinite(amount) && amount >= 0 ? amount.toFixed(2) : "0.00";
};
export const csvCell = (v) => {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
};
export function renderShopifyCsv(rows) {
  return [SHOPIFY_CSV_HEADERS.join(","), ...rows.map((row) =>
    SHOPIFY_CSV_HEADERS.map((key) => csvCell(row[key])).join(",")
  )].join("\n") + "\n";
}
function grouped(rows, field) {
  const result = new Map();
  for (const row of rows || []) {
    const id = value(row?.[field]);
    if (!result.has(id)) result.set(id, []);
    result.get(id).push(row);
  }
  return result;
}
const safeImage = (image) => {
  const url = value(image?.url);
  return /^https:\/\/[a-z0-9.-]+\//i.test(url) ? url : "";
};

/**
 * Draft-only catalog: every product is unpublished; inventory starts at zero.
 * No actual Shopify import occurs in this function.
 */
export function buildShopifyDraftCatalog({products=[], variants=[], images=[], relations=[]}) {
  const variantsByProduct = grouped(variants, "product_id");
  const imagesByProduct = grouped(images, "product_id");
  const collectionsByProduct = grouped(relations, "product_id");
  const seenHandles = new Set();
  const rows = [], issues = [];
  let productCount = 0, variantCount = 0;

  for (const product of products) {
    const id = value(product?.id), handle = value(product?.slug);
    const name = value(product?.name);
    if (!id || !name || !/^[a-z0-9][a-z0-9-]*$/.test(handle) || seenHandles.has(handle)) {
      throw new Error("Producto " + id + ": ID, nombre o handle inválido/duplicado");
    }
    seenHandles.add(handle); productCount++;
    const productVariants = variantsByProduct.get(id) || [];
    const productImages = (imagesByProduct.get(id) || []).filter((img) => {
      if (safeImage(img)) return true;
      issues.push({productId:id, issue:"image_url_not_public_https"});
      return false;
    });
    const collections = [...new Set((collectionsByProduct.get(id) || [])
      .map((r) => value(r.collection_id)).filter(Boolean))];
    const tags = [...new Set(["herencia-market", ...collections,
      ...(product.type === "garden" ? ["jardineria"] : []),
      ...(product.type === "fashion" ? ["moda"] : []),
    ])].join(", ");
    const service = product.type === "service";
    const selections = productVariants.length ? productVariants : [
      {name:"Default Title", sku:product.sku, price:product.price, compare_at_price:product.compare_at_price}
    ];
    const seenNames = new Set();
    if (!productImages.length) issues.push({productId:id, issue:"missing_images"});
    if (value(product.status) !== "active")
      issues.push({productId:id, issue:"source_status_" + (value(product.status) || "unknown")});
    if (product.track_inventory && Number(product.stock) <= 0)
      issues.push({productId:id, issue:"source_inventory_nonpositive"});

    selections.forEach((variant, index) => {
      const option = productVariants.length ? value(variant.name) : "Default Title";
      if (!option || seenNames.has(option))
        throw new Error("Producto " + id + ": variante vacía o duplicada");
      seenNames.add(option);
      const price = variant.price ?? product.price;
      if (!(Number(price) > 0))
        issues.push({productId:id, issue:"price_zero_or_invalid", variant:option});
      const compare = Number(variant.compare_at_price ?? product.compare_at_price);
      const image = index === 0 ? productImages[0] : null;
      rows.push({
        "URL handle":handle, "Title":index === 0 ? name : "",
        "Description":index === 0 ? value(product.description) : "",
        "Vendor":index === 0 ? "Herencia Market" : "",
        "Type":index === 0 ? value(product.type) : "",
        "Tags":index === 0 ? tags : "",
        "Published on online store":"false", "Status":"draft",
        "Option1 name":productVariants.length ? "Modelo" : "Default Title",
        "Option1 value":option,
        "SKU":value(variant.sku ?? product.sku), "Price":money(price),
        "Compare-at price":compare > Number(price) ? money(compare) : "",
        "Charge tax":"true",
        "Inventory tracker":product.track_inventory === false || service ? "" : "shopify",
        "Inventory quantity":"0", "Continue selling when out of stock":"deny",
        "Fulfillment service":"manual", "Requires shipping":service ? "false" : "true",
        "Product image URL":safeImage(image), "Image position":image ? "1" : "",
        "Image alt text":image ? value(image.alt_text) : "",
        "SEO title":index === 0 ? value(product.seo_title) : "",
        "SEO description":index === 0 ? value(product.seo_description) : "",
      });
      variantCount++;
    });
    for (let i=1; i<productImages.length; i++) rows.push({
      "URL handle":handle, "Product image URL":safeImage(productImages[i]),
      "Image position":String(i+1), "Image alt text":value(productImages[i].alt_text),
    });
  }
  return {rows, report:{
    target:"1f0pav-td.myshopify.com", productCount, variantCount,
    imageRowCount:rows.length - variantCount, issueCount:issues.length, issues,
    safeguard:"draft/unpublished; zero sellable inventory",
  }};
}
const gidPattern = /^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/;
/**
 * variantMap lives on the server, keyed by Herencia product ID:
 * { "legacy-id": { default: "gid://shopify/ProductVariant/...", variants: { "M": "gid://..." } } }
 * Never trust browser-provided Shopify IDs or client-calculated prices.
 */
export function mapHerenciaCartToShopifyLines(items, variantMap) {
  if (!Array.isArray(items) || !items.length) throw new Error("Carrito vacío");
  if (!variantMap || typeof variantMap !== "object") throw new Error("Falta mapa de variantes");
  return items.map((item) => {
    const id = value(item?.id);
    const match = Object.hasOwn(variantMap,id) ? variantMap[id] : null;
    const selected = value(item?.selectedVariant);
    const variantId = selected ? match?.variants?.[selected] : match?.default;
    if (!gidPattern.test(value(variantId)))
      throw new Error("Producto " + id + ": falta vincular variante Shopify");
    const service = item.serviceBooking === true || item.type === "service" || item.collection === "servicios";
    const quantity = Number(service ? (item.serviceHours ?? item.quantity) : item.quantity);
    if (!Number.isSafeInteger(quantity) || quantity<1 || quantity>250)
      throw new Error("Producto " + id + ": cantidad/horas no válidas");
    const attributes = [{key:"herencia_product_id", value:id}];
    const dedication = value(item?.personalization?.dedication);
    if (dedication) {
      if (dedication.length > 200) throw new Error("Producto " + id + ": dedicatoria demasiado larga");
      attributes.push({key:"Dedicatoria",value:dedication});
    }
    if (item.salesSource === "HERENCIA_SALES")
      attributes.push({key:"Origen", value:"HERENCIA_SALES"});
    if (service) attributes.push({key:"Unidad de servicio", value:"hora"});
    return {merchandiseId:value(variantId), quantity, attributes};
  });
}
