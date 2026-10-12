/**
 * CJ variant EUR price previews: supplier-authenticated per-VID product price
 * plus a real CJ postal freight quote, current FX, VAT, payment costs and
 * minimum margin. Writes only missing variant prices for an explicitly
 * requested product. NEVER buys, publishes, sets stock, or enables checkout.
 */
import {extractCjProductId} from "./cjProductIds.js";
import {estimateCjProfitability} from "./cjProfitability.js";

const validMoney = value => value!==null && value!==undefined && value!=="" &&
  Number.isFinite(Number(value)) && Number(value)>=0;
const validId = value => /^[a-z0-9-]{8,100}$/i.test(String(value||""));
const validSku = value => /^[a-z0-9._-]{8,100}$/i.test(String(value||""));

export function prepareCjVariantPriceRequest(product, provider) {
  const metadata=product?.metadata||{};
  const request=metadata.cjVariantAutoPricingRequest;
  if(!request || typeof request!=="object" ||
    !["draft","active"].includes(String(product?.status)) ||
    metadata.sourceHost!=="cjdropshipping.com" ||
    metadata.fulfillmentType!=="dropship" ||
    !String(metadata.supplierId||"").trim() ||
    !/^0[0-9]{4}$/.test(String(request.zip||"")) ||
    !validId(request.pid) ||
    extractCjProductId(String(metadata.sourceProductUrl||""))!==String(request.pid) ||
    !Array.isArray(product?.variants) || product.variants.length<1 ||
    product.variants.length>12 ||
    provider?.source!=="cj_api" || String(provider.pid)!==String(request.pid) ||
    provider.truncated!==false || !Array.isArray(provider.variants))
    return {ok:false,reason:"UNVERIFIED_PRODUCT_OR_REQUEST"};
  const official=new Map();
  for(const row of provider.variants){
    const vid=String(row?.vid||"");
    if(!validId(vid) || !validSku(row?.sku) || !validMoney(row?.priceUsd) ||
       Number(row.priceUsd)<=0 || official.has(vid))
      return {ok:false,reason:"UNVERIFIED_CJ_VARIANTS"};
    official.set(vid,row);
  }
  const pending=[];
  for(const variant of product.variants){
    const vid=String(variant?.supplierVariantId||"");
    const sku=String(variant?.supplierSku||variant?.sku||"");
    const row=official.get(vid);
    if(!row || row.sku!==sku || !validSku(sku))
      return {ok:false,reason:"VARIANT_IDENTITY_MISMATCH"};
    if(variant.price!=null && Number(variant.price)>0)continue;
    if(variant.price!=null) return {ok:false,reason:"INVALID_EXISTING_PRICE"};
    pending.push({vid,sku,priceUsd:Number(row.priceUsd),name:String(variant.name||"")});
  }
  return {ok:true,productId:String(product.id),pid:String(request.pid),
    zip:String(request.zip),pending};
}

export function quoteCjVariantRetailPrice({variant,freight,fx,zip,vatRate=21,minMarginPercent=30,additionalImportCostEur=3}={}){
  if(!variant || !validMoney(variant.priceUsd) || Number(variant.priceUsd)<=0 ||
     !validId(variant.vid) || !validSku(variant.sku) ||
     freight?.source!=="cj_api" || freight.origin!=="CN" ||
     freight.destination!=="ES" || freight.zip!==zip ||
     freight.vid!==variant.vid || freight.quantity!==1 ||
     !Array.isArray(freight.methods) || !fx ||
     !validMoney(fx.rate) || Number(fx.rate)<=0 ||
     !/^\d{4}-\d{2}-\d{2}$/.test(String(fx.date||"")))
    return {ok:false,reason:"NO_VERIFIED_POSTAL_QUOTE"};
  const rates=freight.methods.filter(method=>
    String(method.name||"").trim() &&
    validMoney(method.totalPostageUsd) &&
    Number(method.totalPostageUsd)>=Number(method.shippingUsd||0));
  if(!rates.length)return {ok:false,reason:"NO_COMPLETE_CJ_FREIGHT"};
  const best=rates.reduce((a,b)=>
    Number(a.totalPostageUsd)<=Number(b.totalPostageUsd)?a:b);
  const cost=estimateCjProfitability({
    salePriceEur:0,productUsd:variant.priceUsd,
    postageUsd:Number(best.totalPostageUsd),
    usdEurRate:Number(fx.rate),vatRate,minMarginPercent,additionalImportCostEur,
  });
  const minimum=Number(cost.recommendedMinimumPriceEur);
  if(!cost.available || !Number.isFinite(minimum) || minimum<=0 ||
     minimum>10000)return {ok:false,reason:"UNPRICED_OR_UNPROFITABLE"};
  // Round UP to a retail price ending in .99. Never round down below
  // the profitability threshold, and do not claim that it is a final quote.
  const retailPriceEur=Math.ceil(minimum+0.01)-0.01;
  const confirmed=estimateCjProfitability({
    salePriceEur:retailPriceEur,productUsd:variant.priceUsd,
    postageUsd:Number(best.totalPostageUsd),
    usdEurRate:Number(fx.rate),vatRate,minMarginPercent,additionalImportCostEur,
  });
  if(!confirmed.available || !confirmed.feasible)
    return {ok:false,reason:"MIN_MARGIN_NOT_MET"};
  return {ok:true,productId:null,vid:variant.vid,sku:variant.sku,
    priceEur:retailPriceEur,supplierPriceUsd:variant.priceUsd,
    postageUsd:Number(best.totalPostageUsd),
    logisticName:best.name,fxRate:Number(fx.rate),fxDate:String(fx.date),
    zip,checkedAt:new Date().toISOString(),
    estimatedMarginPercent:confirmed.estimatedMarginPercent,
    minMarginPercent,vatRate,additionalImportCostEur};
}

export function createCjVariantAutoPricing({listProducts,queryVariants,quoteFreight,getFx,savePrice,completeRequest,logger=console}={}){
  if([listProducts,queryVariants,quoteFreight,getFx,savePrice,completeRequest]
      .some(fn=>typeof fn!=="function"))
    throw Error("CJ variant price dependencies missing");
  let busy=false;
  async function sweep(){
    if(busy)return {status:"busy",products:0,priced:0,blocked:0};
    busy=true;
    let products=0,priced=0,blocked=0;
    try{
      const all=await listProducts();
      const requests=(Array.isArray(all)?all:[]).filter(p=>
        p?.metadata?.cjVariantAutoPricingRequest &&
        ["active","draft"].includes(p?.status)).slice(0,1);
      for(const product of requests){
        products++;
        try{
          const pid=String(product.metadata.cjVariantAutoPricingRequest.pid||"");
          if(!validId(pid)){blocked++;continue;}
          const provider=await queryVariants(pid);
          const plan=prepareCjVariantPriceRequest(product,provider);
          if(!plan.ok){blocked++;logger.warn?.("[cj.variant-pricing] invalid request",{id:product.id,reason:plan.reason});continue;}
          if(!plan.pending.length){
            await completeRequest(plan.productId,plan.pid,plan.zip);continue;
          }
          const fx=await getFx();
          for(const variant of plan.pending){
            try{
              const freight=await quoteFreight({vid:variant.vid,quantity:1,origin:"CN",
                destination:"ES",zip:plan.zip});
              // Until customs costs are reviewed, include a conservative
              // €3 provisional import allowance. It is NOT a customs quote.
              const importCost=product.metadata?.cjImportCostsReviewed===true &&
                validMoney(product.metadata?.cjAdditionalImportCostEur)
                ? Number(product.metadata.cjAdditionalImportCostEur) : 3;
              const preview=quoteCjVariantRetailPrice({variant,freight,fx,zip:plan.zip,
                additionalImportCostEur:importCost});
              if(!preview.ok){blocked++;logger.warn?.("[cj.variant-pricing] no quote",{id:product.id,vid:variant.vid,reason:preview.reason});continue;}
              const saved=await savePrice({...preview,productId:plan.productId,pid:plan.pid});
              if(saved===true)priced++;else blocked++;
            }catch(error){
              blocked++;logger.warn?.("[cj.variant-pricing] supplier quote unavailable",{
                id:product.id,vid:variant.vid,code:String(error?.code||"UPSTREAM").slice(0,35)});
              if(["CJ_RATE_LIMITED","CJ_QUOTA_EXHAUSTED"].includes(String(error?.code||"")))break;
            }
          }
          await completeRequest(plan.productId,plan.pid,plan.zip);
        }catch(error){
          blocked++;logger.warn?.("[cj.variant-pricing] unavailable",{
            id:product.id,code:String(error?.code||"UPSTREAM").slice(0,35)});
        }
      }
      return {status:"complete",products,priced,blocked};
    }finally{busy=false;}
  }
  return {sweep};
}
