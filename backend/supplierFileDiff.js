/**
 * Read-only reconciliation for supplier catalog preview.
 *
 * Existing merchant products are NEVER updated by this module; it only lists
 * differences for manual review and allows the importer to skip those rows.
 */
const str=(value)=>String(value??"").trim();
function money(value) {
  return value===null||value===undefined||value===""?null:Number(value);
}
function variantSignature(list) {
  const entries=(Array.isArray(list)?list:[]).map(item=>[
    str(item.name),str(item.supplierSku),str(item.supplierVariantId),
  ].join("\u0001")).sort();
  return entries.join("\u0002");
}
function previousOffers(metadata={}) {
  return Array.isArray(metadata?.supplierVariantPrices)?metadata.supplierVariantPrices:[];
}
export function compareSupplierFileProducts(products=[],existingProducts=[]) {
  const byId=new Map(existingProducts.map(p=>[str(p.id),p]));
  const byUrl=new Map();
  for(const p of existingProducts) {
    const m=p?.metadata&&typeof p.metadata==="object"?p.metadata:{};
    for(const url of [m.sourceProductUrl,m.supplierFileOriginalUrl]){
      const s=str(url);
      if(s&&!byUrl.has(s))byUrl.set(s,p);
    }
  }
  return (Array.isArray(products)?products:[]).map(product=>{
    const matchById=byId.get(str(product.id));
    const matchByUrl=product.sourceProductUrl?byUrl.get(str(product.sourceProductUrl)):null;
    const existing=matchById||matchByUrl;
    if(!existing) return {
      id:product.id,status:"new",changedFields:[],existingProductId:null,
      merchantChangesProtected:true,automaticUpdateEnabled:false,
    };
    const m=existing.metadata&&typeof existing.metadata==="object"?existing.metadata:{};
    if((matchByUrl && str(matchByUrl.id)!==str(product.id)) ||
       (matchById && matchByUrl && str(matchById.id)!==str(matchByUrl.id))) {
      return {
        id:product.id,status:"conflict",changedFields:["supplier_identity"],
        existingProductId:str(existing.id),
        merchantChangesProtected:true,automaticUpdateEnabled:false,
      };
    }
    const differences=[];
    if(str(existing.name)!==str(product.name))differences.push("name");
    if(str(existing.description)!==str(product.description))differences.push("description");
    if(str(m.supplierCurrency)!==str(product.currency))differences.push("supplier_currency");
    const sourceCost=money(m.supplierOriginalPrice);
    const offeredCost=money(product.minSupplierCost);
    if(sourceCost!==offeredCost)differences.push("supplier_cost");
    if(variantSignature(existing.variants)!==variantSignature(product.variants))differences.push("variants");
    if(str(m.sourceImageUrl)!==str(product.sourceImageUrl))differences.push("source_image");
    const oldUrl=str(m.supplierFileOriginalUrl);
    if(oldUrl!==str(product.sourceProductUrl))differences.push("source_url");
    // Preserves merchant edits (name, description, photo, price, SKU) unchanged.
    // The supplier's claimed costs are unverified, even when they differ.
    return {
      id:product.id,
      status:differences.length?"changes_detected":"unchanged",
      changedFields:differences,
      existingProductId:str(existing.id),
      merchantChangesProtected:true,automaticUpdateEnabled:false,
    };
  });
}
