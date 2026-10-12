/**
 * Bind a specifically requested CJ draft variant using ONLY the official CJ
 * product/variant API. Never guess a VID, publish an item, manufacture stock,
 * estimate EUR costs from USD, or place a supplier order.
 */
import {extractCjProductId} from "./cjProductIds.js";

export function chooseCjDraftVariant(product, response) {
  const meta=product?.metadata||{};
  const request=meta.cjAutoLinkRequest;
  const pid=extractCjProductId(String(meta.sourceProductUrl||""));
  if(product?.status!=="draft" || meta.sourceHost!=="cjdropshipping.com" ||
     meta.fulfillmentType!=="dropship" || !String(meta.supplierId||"") ||
     String(meta.supplierVariantId||meta.cjVid||"").trim() ||
     String(meta.supplierSku||meta.cjSku||"").trim() ||
     !request || typeof request!=="object" || !pid ||
     String(meta.supplierProductId||"")!==pid ||
     String(request.pid||"")!==pid ||
     !Number.isSafeInteger(request.quantity) || request.quantity<1 ||
     !/^[a-z]{3,15}$/.test(String(request.color||""))) {
    return {ok:false,reason:"NOT_ELIGIBLE"};
  }
  if(response?.source!=="cj_api" || String(response.pid||"")!==pid ||
     response.truncated!==false || !Array.isArray(response.variants) ||
     response.variants.length<1) return {ok:false,reason:"UNVERIFIED_CJ_VARIANTS"};
  const candidates=response.variants.filter(row=>{
    const option=String(row?.option||"").trim().toLowerCase();
    // A vendor option must explicitly include BOTH quantity and color; do not
    // match a descriptive product title or a shared SPU with 21 options.
    const quantities=option.match(/\d+/g)||[];
    const colorTokens=option.match(/[a-z]+/g)||[];
    return quantities.includes(String(request.quantity)) &&
      colorTokens.includes(String(request.color));
  });
  if(candidates.length!==1) return {ok:false,reason:"AMBIGUOUS_OR_MISSING_OPTION"};
  const v=candidates[0],vid=String(v.vid||"").trim(),sku=String(v.sku||"").trim();
  if(!/^[a-z0-9-]{8,100}$/i.test(vid) ||
     !/^[a-z0-9._-]{8,100}$/i.test(sku) ||
     v.priceUsd==null || !Number.isFinite(Number(v.priceUsd)) ||
     Number(v.priceUsd)<=0) return {ok:false,reason:"INVALID_CJ_IDENTITY_OR_PRICE"};
  return {ok:true,productId:String(product.id),pid,vid,sku,
    option:String(v.option),supplierPriceUsd:Number(v.priceUsd),
    quantity:request.quantity,color:String(request.color)};
}

export function createCjDraftAutoLink({listProducts,queryVariants,saveBinding,logger=console}={}){
  if([listProducts,queryVariants,saveBinding].some(fn=>typeof fn!=="function"))
    throw Error("CJ draft autolink dependencies missing");
  let running=false;
  async function sweep(){
    if(running)return {status:"running",processed:0,linked:0};
    running=true;let processed=0,linked=0,blocked=0;
    try{
      const products=await listProducts();
      const drafts=(Array.isArray(products)?products:[]).filter(p=>
        p?.status==="draft" && p?.metadata?.cjAutoLinkRequest &&
        p?.metadata?.sourceHost==="cjdropshipping.com").slice(0,2);
      for(const product of drafts){
        const pid=extractCjProductId(String(product.metadata.sourceProductUrl||""));
        processed++;
        if(!pid || pid!==String(product.metadata.supplierProductId||"") ||
           pid!==String(product.metadata.cjAutoLinkRequest?.pid||"")){
          blocked++;continue;
        }
        try{
          const response=await queryVariants(pid);
          const picked=chooseCjDraftVariant(product,response);
          if(!picked.ok){
            blocked++;logger.warn?.("[cj.draft-autolink] no unique verified option",{
              productId:String(product.id),reason:picked.reason});
            continue;
          }
          const saved=await saveBinding(picked);
          if(saved===true)linked++;else blocked++;
        }catch(error){
          blocked++;
          logger.warn?.("[cj.draft-autolink] supplier unavailable",{
            productId:String(product.id),code:String(error?.code||"UPSTREAM").slice(0,35)});
        }
      }
      return {status:"complete",processed,linked,blocked};
    }finally{running=false;}
  }
  return {sweep};
}
