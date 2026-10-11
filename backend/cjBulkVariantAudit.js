// Read-only reconciliation of CJ's live product options with the public catalog.
// Provider USD prices and observed stock are NOT public stock or sale prices.
export function summarizeCjVariantAudit({
  product={},providerVariants=[],stockByVid=new Map(),offset=0,limit=4,truncated=false,
}={}) {
  if (!Number.isSafeInteger(offset)||offset<0||offset>200 || !Number.isSafeInteger(limit)||limit<1||limit>4)
    throw new Error("Auditoría CJ fuera de rango.");
  const options=Array.isArray(providerVariants)?providerVariants:[];
  const publicOptions=Array.isArray(product.variants)?product.variants:[];
  const seen=new Set();
  const rows=options.slice(offset,offset+limit).map(item=>{
    const vid=String(item?.vid||"").trim();
    const sku=String(item?.sku||"").trim();
    const matching=publicOptions.filter(v=>
      String(v?.supplierVariantId||"").trim()===vid &&
      String(v?.supplierSku||"").trim()===sku);
    const duplicate=matching.length!==1 || seen.has(vid);
    seen.add(vid);
    const publicMapped=matching.length===1 && !duplicate && !!vid && !!sku;
    const observed=stockByVid instanceof Map ? stockByVid.get(vid) : null;
    const stock=observed?.verified===true && observed?.vid===vid &&
      observed?.origin==="CN" && Number.isSafeInteger(observed?.quantity) &&
      observed.quantity>=0
      ? {verified:true,quantity:observed.quantity,available:observed.quantity>0}
      : {verified:false,quantity:null,available:false};
    const issues=[];
    if(!vid||!sku)issues.push("Proveedor no confirmó VID/SKU completos.");
    if(!publicMapped)issues.push("Variante no vinculada de forma única al catálogo público.");
    if(!stock.verified)issues.push("Stock CN desconocido; no asumir disponibilidad.");
    else if(!stock.available)issues.push("Sin unidades verificadas en CN.");
    const publicPriceEur=publicMapped && matching[0].price!=null &&
      Number.isFinite(Number(matching[0].price))&&Number(matching[0].price)>0
      ? Number(matching[0].price) : null;
    if(publicMapped && publicPriceEur===null)issues.push("Precio de venta EUR sin verificar.");
    return {
      vid,sku,option:String(item?.option||item?.name||"").slice(0,150),
      supplierPriceUsd:item?.priceUsd!=null&&Number.isFinite(Number(item.priceUsd))&&Number(item.priceUsd)>=0
        ? Number(item.priceUsd):null,
      publicMapped,publicPriceEur,stock,issues,
    };
  });
  return {
    provider:"cj",readOnly:true,origin:"CN",batchMax:4,totalVariants:options.length,
    inspected:rows.length,offset,nextOffset:offset+limit<options.length?offset+limit:null,
    truncated:Boolean(truncated),publicVariantCount:publicOptions.length,variants:rows,
    warning:"Datos de solo lectura. No actualizan precios o stock públicos ni habilitan compras. Se requiere cotizar transporte y confirmar IVA, margen y dirección del cliente.",
  };
}
