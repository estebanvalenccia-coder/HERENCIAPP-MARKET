import crypto from "node:crypto";

/**
 * Translates verified AliExpress catalog responses into PRIVATE unpublished drafts.
 * AliExpress price/stock are not sufficient for Spanish tax, shipping or checkout.
 */
export function makeAliExpressUnpublishedDraft(product) {
  const id = String(product?.productId || "");
  const title = String(product?.name || "").trim().slice(0, 240);
  if (!/^\d{8,22}$/.test(id) || !title || !Array.isArray(product?.variants) || !product.variants.length) {
    throw new Error("Producto AliExpress sin ID, nombre o variantes verificables");
  }
  const variants = product.variants.slice(0, 200).map((v) => {
    const variantId = String(v?.variantId || "").trim();
    const sku = String(v?.sku || "").trim();
    if (!variantId && !sku) throw new Error("Falta identificador real de variante AliExpress");
    const options = (Array.isArray(v.properties) ? v.properties : []).slice(0, 4)
      .map((p) => String(p.value || "").trim()).filter(Boolean);
    return {
      name: options.join(" / ") || sku || variantId,
      sku: sku || variantId,
      supplierVariantId: variantId || sku,
      supplierSku: sku || variantId,
      optionValues: options,
      price: null,
      stock: 0, // Never expose stale/unverified supplier stock in checkout.
    };
  });
  const hash = crypto.createHash("sha256").update(id).digest("hex").slice(0, 24);
  const images = (Array.isArray(product.images) ? product.images : []).filter((image) =>
    typeof image === "string" && /^https:\/\//i.test(image) && !/localhost|127\.0\.0\.1/i.test(image)).slice(0, 8);
  return {
    id: "aliexpress_" + hash,
    status: "draft",
    active: false,
    name: title,
    description: "",
    category: "sin-clasificar",
    type: "supplier",
    price: 0,
    cost: null,
    stock: 0,
    trackInventory: true,
    images,
    variants,
    metadata: {
      sourceProvider: "aliexpress",
      sourceProductId: id,
      supplierProductId: id,
      importedByApi: true,
      importReviewRequired: true,
      sourceProductStatus: String(product.status || ""),
      costAndShippingVerified: false,
      complianceVerified: false,
      approvedForPublication: false,
      orderAutomationEnabled: false,
      verifiedAt: String(product.checkedAt || ""),
    },
  };
}
