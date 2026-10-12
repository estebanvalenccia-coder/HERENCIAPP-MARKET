/** Shared storefront protection against silent Printful/default variant purchases. */
export function isPrintfulProduct(product) {
  return product?.metadata?.provider === "printful" ||
    Boolean(product?.metadata?.printfulSyncProductId);
}
export function needsExplicitVariantSelection(product) {
  return isPrintfulProduct(product) ||
    (Array.isArray(product?.variants) && product.variants.length > 1);
}
export function validPrintfulCartSelection(item) {
  if (!isPrintfulProduct(item)) return true;
  if (item?.printfulVariantChosen !== true || !String(item?.selectedVariant || "").trim()) return false;
  const variants=Array.isArray(item?.variants)?item.variants:[];
  const variant=variants.find(v => String(v?.name || "")===String(item.selectedVariant));
  return Boolean(variant && String(variant.printfulSyncVariantId || "") &&
    String(variant.printfulCatalogVariantId || "") &&
    String(variant.printfulSyncVariantId)===String(item.printfulSyncVariantId || "") &&
    String(variant.printfulCatalogVariantId)===String(item.printfulCatalogVariantId || "") &&
    variant.printfulAvailability === "active");
}
export function firstUnselectedPrintfulItem(items) {
  return (Array.isArray(items)?items:[]).find(item=>!validPrintfulCartSelection(item)) || null;
}
