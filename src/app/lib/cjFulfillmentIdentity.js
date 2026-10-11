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

// Fail closed before exposing an obviously unsellable CJ product to checkout.
// This is a catalogue readiness HINT; final supplier quotes and stock are
// checked independently by the backend for the exact destination.
export function assessCjPublicProductStatus(product) {
  if (!isCjSupplierItem(product))
    return {cj:false,availableToAdd:true,blockers:[],warnings:[]};
  const meta=product?.metadata && typeof product.metadata==="object" ? product.metadata : {};
  const variants=Array.isArray(product?.variants) ? product.variants : [];
  const blockers=[],warnings=[];
  if (!String(meta.supplierId||"").trim()) blockers.push("Falta vincular el proveedor CJ.");
  if (!String(meta.cjPreferredLogisticName||"").trim())
    blockers.push("Todavía no hay un método de transporte CJ validado para España.");
  if (!variants.length && (!String(meta.supplierVariantId||meta.cjVid||"").trim() ||
    !String(meta.supplierSku||meta.cjSku||"").trim()))
    blockers.push("Faltan identificadores VID y SKU reales de la variante CJ.");
  if (!variants.length) warnings.push("Solo hay una referencia CJ vinculada; las combinaciones de color y tamaño no están importadas al catálogo público.");
  if (String(meta.fulfillmentMode||"")==="autopilot")
    warnings.push("El modo Autopilot no implica que la compra desatendida esté habilitada.");
  return {cj:true,availableToAdd:blockers.length===0,blockers,warnings};
}

// Checkout is currently certified for exactly ONE CJ line/quantity and no
// local goods in the same basket. Used by cart, checkout and unit tests;
// the backend independently revalidates the authoritative catalog and payment.
export function validateCjCartComposition(items) {
  const rows = Array.isArray(items) ? items : [];
  const cj = rows.filter(isCjSupplierItem);
  if (!cj.length) return {valid:true,code:"NO_CJ",message:"",cjCount:0};
  if (cj.length !== rows.length) return {
    valid:false,code:"MIXED",cjCount:cj.length,
    message:"Los productos CJ se compran en un pedido separado de los artículos locales o servicios.",
  };
  if (rows.length !== 1) return {
    valid:false,code:"MULTIPLE_CJ",cjCount:cj.length,
    message:"Por ahora solo se admite una variante CJ por pedido. Finaliza cada producto por separado.",
  };
  if (!Number.isSafeInteger(Number(cj[0].quantity)) || Number(cj[0].quantity)!==1) return {
    valid:false,code:"QUANTITY",cjCount:1,
    message:"CJ solo permite una unidad en esta fase. Ajusta la cantidad a uno antes de continuar.",
  };
  return {valid:true,code:"OK",message:"",cjCount:1};
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
