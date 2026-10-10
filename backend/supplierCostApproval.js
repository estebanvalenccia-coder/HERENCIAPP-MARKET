/**
 * Admin-supervised supplier cost updates. No storefront, stock, supplier order
 * or payment updates. File values remain UNVERIFIED even after approval.
 */
const key = offer => [String(offer?.supplierVariantId||"").trim(),
  String(offer?.supplierSku||"").trim(),String(offer?.variantName||"").trim()].join("\u0001");
const fail = message => {const e=new Error(message);e.statusCode=409;throw e;};
export function prepareSupplierCostApproval(product, current, expectedUpdatedAt) {
  if(!product?.id || !current || current.id!==product.id) fail("El producto no coincide con el catálogo actual.");
  const meta=current.metadata&&typeof current.metadata==="object"?current.metadata:{};
  if(meta.importedFromFile!==true || String(meta.supplierId||"")!==String(product.supplierId||"") ||
    current.status!=="draft")fail("Solo se pueden revisar costes de borradores importados del mismo proveedor.");
  const actualVersion=String(current.updatedAt||"");
  if(!actualVersion || !expectedUpdatedAt ||
     new Date(actualVersion).toISOString()!==new Date(expectedUpdatedAt).toISOString())
    fail("La ficha cambió durante la revisión: vuelve a obtener la vista previa.");
  const before=Array.isArray(current.variants)?current.variants:[];
  const after=Array.isArray(product.variants)?product.variants:[];
  const signature=v=>[
    String(v?.name||"").trim(),String(v?.supplierSku||"").trim(),
    String(v?.supplierVariantId||"").trim()
  ].join("\u0001");
  if(before.length!==after.length ||
    before.map(signature).sort().join("\u0002")!==after.map(signature).sort().join("\u0002"))
    fail("Las variantes o sus SKU/VID han cambiado. Revisa manualmente las combinaciones antes de actualizar costes.");
  const offers=Array.isArray(product.originalOffers)?product.originalOffers:[];
  if(!offers.length || offers.length>60)fail("No hay variantes de proveedor para revisar.");
  if(before.length>1 && offers.some(o=>!o?.supplierSku||!o?.supplierVariantId))
    fail("Falta un SKU/VID verificable para comparar cada variante.");
  const all=new Set();
  for(const o of offers){
    const id=key(o);
    if(all.has(id))fail("Combinaciones duplicadas en el catálogo recibido.");
    all.add(id);
    if(o.cost!==null&&(!Number.isFinite(o.cost)||o.cost<0))fail("Coste del proveedor inválido.");
    if(String(o.currency||"").toUpperCase()!==String(product.currency||"").toUpperCase())
      fail("Una variante tiene una moneda diferente.");
  }
  return {
    productId:String(product.id),supplierId:String(product.supplierId),
    expectedUpdatedAt:new Date(expectedUpdatedAt).toISOString(),
    offers:offers.map(o=>({
      supplierVariantId:String(o.supplierVariantId||""),
      supplierSku:String(o.supplierSku||""),variantName:String(o.variantName||""),
      cost:o.cost===null?null:Number(o.cost),currency:String(o.currency||"").toUpperCase(),
      ...(o.stock===null||o.stock===undefined?{}:{stock:Number(o.stock)})
    })),
    minimumCost:product.minSupplierCost===null?null:Number(product.minSupplierCost),
    currency:String(product.currency||"").toUpperCase(),
    preserveMerchantFields:true,publicPriceChanged:false,publicStockChanged:false,
    sourceCostStillUnverified:true,requiresManualApproval:true,
  };
}
