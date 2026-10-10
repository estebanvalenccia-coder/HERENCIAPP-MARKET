/**
 * Supplier-neutral, offline catalog intelligence.
 * This module never contacts suppliers or authorises an order, price, tax,
 * stock publication, Stripe charge or automatic fulfillment.
 */
import { EU_COUNTRIES } from "./supplierMarketplace.js";

const normalized = value => String(value ?? "").trim();
const money = value => value !== null && value !== undefined && value !== "" &&
  Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
const fail = message => { const error = new Error(message); error.statusCode=422; throw error; };

export function verifiedGtin(value) {
  const digits=normalized(value).replace(/[\s-]/g,"");
  if(!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(digits)) return "";
  const withoutCheck=digits.slice(0,-1);
  let total=0;
  for(let i=withoutCheck.length-1,p=0;i>=0;i--,p++) total += Number(withoutCheck[i])*(p%2===0?3:1);
  return (10-total%10)%10===Number(digits.at(-1)) ? digits : "";
}
const key = v => normalized(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

/**
 * Only globally verifiable GTIN or an explicit manufacturer+MPN pair may
 * suggest a cross-supplier duplicate. Similar titles, names or supplier SKUs
 * NEVER imply identical products or compatible plugs/sizes.
 */
export function suggestSupplierMatches(catalog = [], {maxPairs=120} = {}) {
  if(!Array.isArray(catalog)||catalog.length>1500)fail("Catálogo demasiado grande para comparar.");
  const candidates=[];
  const all=catalog.map(product=>{
    const m=product?.metadata && typeof product.metadata==="object"?product.metadata:{};
    const gtin=verifiedGtin(m.gtin||m.ean||m.barcode||product?.barcode);
    const maker=key(m.manufacturer||m.brand||product?.manufacturer||product?.brand);
    const mpn=key(m.mpn||m.manufacturerPartNumber||product?.mpn);
    return {id:normalized(product?.id),supplierId:normalized(m.supplierId||product?.supplierId),
      gtin,maker,mpn,
      variants:Array.isArray(product?.variants)?product.variants:[]};
  });
  for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
    if(candidates.length>=maxPairs)break;
    const a=all[i],b=all[j];
    if(!a.id || !b.id || a.id===b.id || !a.supplierId||!b.supplierId ||
      a.supplierId===b.supplierId) continue;
    const reason=a.gtin&&a.gtin===b.gtin?"gtin":
      a.maker && a.mpn && a.maker===b.maker && a.mpn===b.mpn?"manufacturer_mpn":null;
    if(!reason)continue;
    // A product identity candidate is never a verified interchangeable option.
    candidates.push({leftProductId:a.id,rightProductId:b.id,reason,
      confirmed:false,reviewRequired:true,
      variantsMustBeCompared:true,automaticSupplierSwitching:false});
  }
  return {candidates,total:candidates.length,automaticMatches:0};
}

export function checkSupplierFileAlerts(previousOffers=[],incomingOffers=[],{
  priceIncreasePercent=10,expectedSupplierId="",productId=""
}={}) {
  if(!Array.isArray(previousOffers)||!Array.isArray(incomingOffers)) fail("Listas de variantes no válidas.");
  if(previousOffers.length>120||incomingOffers.length>120)fail("Demasiadas variantes para analizar.");
  const identity = offer=>{
    const vid=normalized(offer?.supplierVariantId),sku=normalized(offer?.supplierSku);
    // Missing provider identity is not safe for an automatic match.
    return vid&&sku ? vid+"\u0000"+sku : "";
  };
  const prev=new Map(previousOffers.filter(x=>identity(x)).map(o=>[identity(o),o]));
  const now=new Map(incomingOffers.filter(x=>identity(x)).map(o=>[identity(o),o]));
  const result=[];
  for(const [id,before] of prev){
    const current=now.get(id);
    const variant=normalized(before.variantName)||normalized(before.supplierSku);
    if(!current){result.push({type:"removed_variant",severity:"warning",variant,productId,expectedSupplierId});continue;}
    const oldCost=money(before.cost),newCost=money(current.cost);
    const currency=normalized(before.currency).toUpperCase();
    if(currency!==normalized(current.currency).toUpperCase()){
      result.push({type:"currency_changed",severity:"warning",variant,productId,expectedSupplierId});
    } else if(oldCost!==null && newCost!==null && oldCost>0 &&
      (newCost-oldCost)/oldCost*100>=priceIncreasePercent){
      result.push({type:"cost_increase",severity:"warning",variant,productId,
        expectedSupplierId,oldCost,newCost,currency});
    }
    const oldStock=money(before.stock),newStock=money(current.stock);
    if(oldStock!==null && newStock!==null && oldStock>0 && newStock===0){
      result.push({type:"supplier_reports_out_of_stock",severity:"warning",variant,
        productId,expectedSupplierId,stockUnverified:true});
    }
  }
  for(const [id,current] of now)if(!prev.has(id)){
    result.push({type:"new_variant",severity:"info",variant:normalized(current.variantName),
      productId,expectedSupplierId});
  }
  return {alerts:result,automaticStockChanges:0,automaticPriceChanges:0,
    stockVerifiedByApi:false};
}

export function offlinePricingSuggestion({
  supplierVariantId, currency="EUR", productCost, shippingCost, otherCosts=0,
  fxEurPerUnit, fxCheckedAt, shippingCheckedAt, shippingCurrency="EUR",
  destination,postalCode,vatPercent,minimumMarginPercent=25,
  fixedFeeEur=0,percentFee=0, quantity=1, nowMs=Date.now()
}={}) {
  if(!normalized(supplierVariantId)||quantity!==1||!EU_COUNTRIES.includes(normalized(destination).toUpperCase()) ||
    !normalized(postalCode)) fail("Faltan variante exacta, destino europeo o código postal.");
  const costs=[productCost,shippingCost,otherCosts,fixedFeeEur,vatPercent,minimumMarginPercent,percentFee].map(money);
  if(costs.some(x=>x===null)||costs[4]>40||costs[5]>=95||costs[6]>=95)
    fail("Costes, impuestos o márgenes incompletos.");
  const [product,shipping,extra,fee,vat,minMargin,pct]=costs;
  const cur=normalized(currency).toUpperCase(), shipCur=normalized(shippingCurrency).toUpperCase();
  if(!/^[A-Z]{3}$/.test(cur)||shipCur!=="EUR")fail("El envío requiere un coste comprobado expresado en EUR.");
  const rate=cur==="EUR"?1:money(fxEurPerUnit);
  if(rate===null||rate===0||rate>100)fail("Se requiere un cambio de divisas positivo y verificado.");
  const shippingTs=Date.parse(normalized(shippingCheckedAt));
  const fxTs=cur==="EUR"?nowMs:Date.parse(normalized(fxCheckedAt));
  if(!Number.isFinite(shippingTs)||!Number.isFinite(fxTs)||shippingTs>nowMs||
    fxTs>nowMs||nowMs-shippingTs>15*60*1000||nowMs-fxTs>60*60*1000)
    fail("Cotización de transporte o divisas caducada.");
  // Conservative fee percentage of total sales incl. VAT. Margin is calculated
  // on net of VAT revenue, not on the gross retail amount.
  const netCost=product*rate+shipping+extra+fee;
  const netFraction=(1-minMargin/100)/(1+vat/100)-pct/100;
  if(netFraction<=0)fail("El margen solicitado no es compatible con las comisiones.");
  const suggestedRetail=round(Math.ceil((netCost/netFraction)*100)/100);
  const netSale=suggestedRetail/(1+vat/100);
  const fees=suggestedRetail*pct/100;
  const profit=netSale-netCost-fees;
  const actualMargin=netSale>0?profit/netSale*100:0;
  return {
    supplierVariantId:normalized(supplierVariantId),destination:normalized(destination).toUpperCase(),
    postalCode:normalized(postalCode),quantity:1,
    landedCostEur:round(product*rate+shipping+extra),sellingFeesEur:round(fee+fees),
    suggestedRetailEur:suggestedRetail,expectedProfitEur:round(profit),
    expectedMarginPercent:round(actualMargin),
    sourceVerified:false,vatRateProvidedByMerchant:true,shippingQuoteRequiresRecheck:true,
    publicationAllowed:false,automaticPurchasesEnabled:false,
    message:"Simulación de margen: el coste proveedor, impuestos y disponibilidad deben validarse antes de vender."
  };
}

/** Independent capabilities for future connectors. Never advertise access. */
export const UNIVERSAL_CONNECTOR_CONTRACT = Object.freeze({
  required:["catalog_variants","variant_stock","variant_cost","shipping_quote","order_draft",
    "order_status","tracking","return_request"],
  safeguards:["independent_authorization","read_only_preview","idempotency","manual_payment_approval",
    "destination_validation","audit_trail","no_secret_exposure"],
  shippingQuoteNeeds:["supplier_variant_id","destination","postal_code","quantity","currency",
    "method","checked_at"],
  defaultOrderMode:"disabled",
  paymentAutomatic:false
});
