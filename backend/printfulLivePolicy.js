/**
 * Printful automatic production safeguards. No default financial mandate.
 * Values are PRIVATE environment settings on the Railway backend.
 */
const amount = value => {
  if(value===undefined||value===null||String(value).trim()==="") return NaN;
  const number=Number(value);
  return Number.isFinite(number)?number:NaN;
};
export function printfulLivePolicy(env=process.env) {
  const requested=String(env.PRINTFUL_AUTO_CONFIRM_ENABLED||"").toLowerCase()==="true";
  const maxOrderCostEur=amount(env.PRINTFUL_MAX_ORDER_COST_EUR);
  const maxDailySpendEur=amount(env.PRINTFUL_MAX_DAILY_SPEND_EUR);
  const minMarginPct=amount(env.PRINTFUL_MIN_NET_MARGIN_PCT);
  const limitsValid=maxOrderCostEur>0&&maxOrderCostEur<=1000&&
    maxDailySpendEur>=maxOrderCostEur&&maxDailySpendEur<=10000&&
    minMarginPct>=20&&minMarginPct<=80;
  return {
    enabled:requested&&limitsValid,
    requested,
    configured:limitsValid,
    maxOrderCostEur:Number.isFinite(maxOrderCostEur)?maxOrderCostEur:null,
    maxDailySpendEur:Number.isFinite(maxDailySpendEur)?maxDailySpendEur:null,
    minMarginPct:Number.isFinite(minMarginPct)?minMarginPct:null,
    reason:!requested?"automatic_supplier_payments_disabled":
      !limitsValid?"explicit_euro_cost_daily_budget_and_margin_required":"ready",
  };
}
/** Local eligibility only; a Stripe pi_ reference is not proof of settlement. */
export function printfulAutoConfirmOrderCandidate(order) {
  if(order?.status!=="paid"||!String(order?.stripe_payment_intent_id||"").startsWith("pi_"))
    return {eligible:false,reason:"stripe_paid_order_required"};
  if(!(amount(order?.total)>0))
    return {eligible:false,reason:"positive_paid_total_and_supplier_cost_required"};
  return {eligible:true,reason:null};
}
export function assessPrintfulAutoConfirm({order,estimate,policy,now=Date.now()}) {
  const deny=reason=>({allowed:false,reason});
  if(!policy?.enabled)return deny(policy?.reason||"payment_mandate_not_configured");
  const local=printfulAutoConfirmOrderCandidate(order);
  if(!local.eligible)return deny(local.reason);
  const currency=String(estimate?.currency||"").toUpperCase();
  if(currency!=="EUR")return deny("quote_currency_must_be_eur");
  const cost=amount(estimate?.total);
  const gross=amount(order?.total);
  if(!(gross>0)||!(cost>0))return deny("positive_paid_total_and_supplier_cost_required");
  if(cost>policy.maxOrderCostEur)return deny("supplier_order_limit_exceeded");
  if(!(Date.parse(estimate?.checkedAt)>0)||
     Math.abs(now-Date.parse(estimate.checkedAt))>10*60*1000)
    return deny("quote_expired");
  // Conservative Spanish 21% VAT and payment fees; gross cart amounts are
  // not the merchant's net takings. Any uncertainty blocks the charge.
  const netSales=gross/1.21-Math.max(0.30,gross*0.025);
  const profit=netSales-cost;
  if(netSales<=0||profit<0||profit/netSales*100<policy.minMarginPct)
    return deny("insufficient_margin_after_vat_and_fees");
  return {allowed:true,reason:"approved",costEur:Math.round(cost*100)/100,
    estimatedNetSalesEur:Math.round(netSales*100)/100,
    estimatedProfitEur:Math.round(profit*100)/100};
}
export function printfulDailyBudgetKey(now=Date.now()) {
  return "printfulLiveBudget:v1:"+new Date(now).toISOString().slice(0,10);
}
export function normalizePrintfulTracking(provider) {
  const validShipments=(Array.isArray(provider?.shipments)?provider.shipments:[])
    .filter(s=>s&&typeof s==="object")
    .slice(0,15).map(s=>({
      trackingNumber:String(s.trackingNumber||"").slice(0,150),
      trackingUrl:/^https:\/\//i.test(String(s.trackingUrl||""))?String(s.trackingUrl).slice(0,1000):"",
      status:String(s.status||"").slice(0,80),
    }));
  return {
    externalOrderId:String(provider?.id||""),
    providerStatus:String(provider?.status||"unknown").slice(0,60),
    shipments:validShipments,
    hasTracking:validShipments.some(s=>s.trackingNumber&&s.trackingUrl),
  };
}
