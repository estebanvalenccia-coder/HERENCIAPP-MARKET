// CJ official freightCalculateTip fallback for cases where simple freightCalculate
// provides no methods. Uses REAL variant dimensions, SKU and product logistics
// properties. Missing attributes fail closed; never guess weight or a price.
const money = value => value === null || value === undefined || value === "" || typeof value === "boolean"
  ? null : Number.isFinite(Number(value)) && Number(value)>=0 ? Number(value) : null;
export function buildCjAccurateFreightPayload({product,variant,vid,origin="CN",destination="ES",zip="",quantity=1}={}) {
  const pid=String(product?.pid||product?.id||"").trim();
  const expected=String(vid||"").trim();
  const weight=money(variant?.variantWeight);
  const volume=money(variant?.variantVolume);
  const price=money(variant?.variantSellPrice);
  const sku=String(variant?.variantSku||"").trim();
  const props=product?.productProEnSet;
  if(!pid||!expected||String(variant?.vid||"")!==expected ||
     String(variant?.pid||"").toLowerCase()!==pid.toLowerCase() ||
     !sku||!(weight>0)||!(volume>0)||price===null||
     !Array.isArray(props)||!props.length||
     !props.every(item=>typeof item==="string" && /^[A-Z][A-Z_]{1,60}$/.test(item))||
     !/^[A-Z]{2}$/.test(origin)||!/^[A-Z]{2}$/.test(destination)||
     !Number.isSafeInteger(quantity)||quantity<1||quantity>20)
    return null;
  const cubicCm=volume/1000; // CJ gives variantVolume in mm³, tip expects cm³.
  return {reqDTOS:[{
    trialCalculationType:String(product?.productType)==="5"?"1":"0",
    srcAreaCode:origin,destAreaCode:destination,...(zip?{zip}:{}),
    weight:Math.ceil(weight*quantity),volume:Math.ceil(cubicCm*quantity),
    totalGoodsAmount:Number((price*quantity).toFixed(2)),
    productProp:props,wrapWeight:0,
    skuList:[sku],
    freightTrialSkuList:[{vid:expected,sku,skuQuantity:quantity,
      skuWeight:weight,skuVolume:cubicCm}],
  }]};
}
export function interpretCjAccurateFreightRates(data) {
  if(!Array.isArray(data))return [];
  const methods=[];
  for(const item of data.slice(0,60)) {
    const name=String(item?.option?.enName||"").trim().slice(0,120);
    const base=money(item?.wrapPostage) ?? money(item?.discountFee);
    const total=money(item?.totalPostageFee);
    const error=String(item?.errorEn||item?.error||"").trim();
    if(!name||base===null||error)continue;
    // Only CJ's explicitly reported full USD postage can authorize checkout.
    // A nominal postage without complete customs/tax figures is preview-only.
    methods.push({
      name,time:String(item?.arrivalTime||item?.option?.arrivalTime||"").slice(0,80),
      shippingUsd:base,totalPostageUsd:total,
      taxesUsd:money(item?.taxesFee),clearanceUsd:money(item?.clearanceOperationFee),
    });
  }
  return methods.sort((a,b)=>(a.totalPostageUsd??a.shippingUsd)-(b.totalPostageUsd??b.shippingUsd));
}
