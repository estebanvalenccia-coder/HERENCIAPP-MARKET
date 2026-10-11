/**
 * CJ automated procurement policy. Configurable as a DRAFT only.
 *
 * Never silently enables payments, reserves real funds or authorises a supplier
 * order. Separates user-supplied guardrails from verified Stripe/provider facts.
 * Financial amounts use integer cents for daily budget arithmetic.
 */
import { verifiedCjQuoteMatches } from "./cjVariantIdentity.js";

const err=(message,statusCode=422)=>{const e=new Error(message);e.statusCode=statusCode;throw e;};
const moneyCents=(value,label,{allowZero=false}={})=>{
  if(value==null||value===""||typeof value==="boolean"||typeof value==="object"||
     !/^(?:0|[1-9][0-9]{0,5})(?:\.[0-9]{1,2})?$/.test(String(value).trim()))
    err("Valor monetario incorrecto: "+label);
  const cents=Math.round(Number(value)*100);
  if(!Number.isSafeInteger(cents)||(allowZero?cents<0:cents<=0))err("Importe incorrecto: "+label);
  return cents;
};
const percent=(value)=>{
  if(value==null||value===""||typeof value==="boolean"||typeof value==="object"||
    !/^(?:[0-9]|[1-6][0-9]|70)(?:\.[0-9]{1,2})?$/.test(String(value).trim()))
    err("El margen mínimo debe estar entre 0 % y 70 %.");
  const v=Number(value);
  if(v<10||v>70)err("El margen mínimo debe estar entre 10 % y 70 %.");
  return v;
};
const norm=value=>String(value??"").trim();
export const CJ_POLICY_KEY="cjAutopilotGuardrails:v1";
export const CJ_BUDGET_LEDGER_PREFIX="cjAutopilotBudget:";
export function emptyCjAutopilotPolicy(){
  return {configured:false,mode:"simulation",country:"ES",quantity:1,
    perOrderMaxEur:null,dailyMaxEur:null,minMarginPercent:null,
    allowedSupplierIds:[],lastSavedAt:null,livePurchasesAllowed:false,
    livePaymentsAllowed:false,requiresMerchantAuthorization:true};
}
export function readCjAutopilotPolicy(raw){
  if(!raw)return emptyCjAutopilotPolicy();
  try{
    const data=typeof raw==="string"?JSON.parse(raw):raw;
    if(!data||typeof data!=="object"||Array.isArray(data))return emptyCjAutopilotPolicy();
    // Saved policy is revalidated, never blindly restored from JSON.
    const p=validateCjPolicyDraft(data);
    return {...p,configured:true,mode:"simulation",
      lastSavedAt:typeof data.lastSavedAt==="string"?data.lastSavedAt:null};
  }catch{return emptyCjAutopilotPolicy();}
}
export function validateCjPolicyDraft(input){
  if(!input||typeof input!=="object"||Array.isArray(input))
    err("La configuración CJ debe ser un objeto.");
  if(input.enabled===true || input.mode==="live" || input.autoPurchaseEnabled===true ||
     input.autoPaymentEnabled===true || input.livePurchasesAllowed===true ||
     input.livePaymentsAllowed===true)
    err("Este formulario solo permite guardar límites en modo simulación. No habilita pagos.");
  if(input.country!=="ES" && input.country!==undefined)
    err("La automatización CJ solo está preparada para España.");
  if(input.quantity!==1 && input.quantity!==undefined)
    err("La automatización CJ solo admite una unidad por pedido.");
  const one=moneyCents(input.perOrderMaxEur,"Límite por pedido");
  const day=moneyCents(input.dailyMaxEur,"Límite diario");
  if(one>day)err("El presupuesto diario debe cubrir al menos un pedido completo.");
  if(one>100000 || day>1000000)err("El límite excede el máximo de seguridad del modo simulación.");
  const min=percent(input.minMarginPercent);
  const ids=input.allowedSupplierIds;
  if(!Array.isArray(ids)||ids.length<1||ids.length>8||
     !ids.every(v=>typeof v==="string"&&/^[A-Za-z0-9_-]{1,100}$/.test(v))||
     new Set(ids).size!==ids.length)
    err("Selecciona proveedores CJ registrados, sin repetir identificadores.");
  return {
    configured:true,mode:"simulation",country:"ES",quantity:1,
    perOrderMaxEur:one/100,dailyMaxEur:day/100,minMarginPercent:min,
    allowedSupplierIds:[...ids],lastSavedAt:null,
    livePurchasesAllowed:false,livePaymentsAllowed:false,
    requiresMerchantAuthorization:true,
  };
}
export function saveCjAutopilotPolicyDraft(payload,allowedSupplierIds=[],now=new Date().toISOString()){
  const policy=validateCjPolicyDraft(payload);
  const known=new Set(allowedSupplierIds.map(String));
  if(policy.allowedSupplierIds.some(id=>!known.has(id)))
    err("El proveedor seleccionado no es CJ activo y registrado.");
  return JSON.stringify({...policy,lastSavedAt:now});
}
export function cjBudgetDay(date=new Date().toISOString()){
  const parsed=new Date(date);
  if(!Number.isFinite(parsed.getTime()))err("Fecha no válida para el presupuesto.");
  return parsed.toISOString().slice(0,10);
}
export function readCjBudgetLedger(raw,date){
  const day=cjBudgetDay(date);
  if(!raw)return {date:day,reservations:[]};
  let data;
  try{data=JSON.parse(raw);}catch{err("El registro financiero de CJ no se pudo interpretar.");}
  if(!data||data.date!==day || !Array.isArray(data.reservations) ||data.reservations.length>5000)
    err("El registro financiero CJ no coincide con el día solicitado.");
  if(!data.reservations.every(x=>x&&typeof x==="object" &&
      /^[A-Za-z0-9_-]{1,120}$/.test(String(x.fulfillmentId||"")) &&
      Number.isSafeInteger(x.amountCents) && x.amountCents>0 &&
      ["reserved","committed","uncertain"].includes(x.status)))
    err("El registro de reservas de CJ está dañado; no se puede gastar saldo.");
  return {date:day,reservations:data.reservations};
}
/** Reservation generator, transaction caller must use mutateNeonStorageValue. */
export function reserveCjDailyBudget(raw,{policy,fulfillmentId,amountEur,
  date=new Date().toISOString()}={}){
  if(!policy?.configured||policy.mode!=="simulation"||policy.livePurchasesAllowed!==false)
    err("Faltan límites válidos. No se ha autorizado comprar.");
  const day=cjBudgetDay(date),ledger=readCjBudgetLedger(raw,date);
  const amount=moneyCents(amountEur,"Coste del pedido");
  const maxOne=moneyCents(policy.perOrderMaxEur,"Límite por pedido");
  const maxDaily=moneyCents(policy.dailyMaxEur,"Límite diario");
  const id=norm(fulfillmentId);
  if(!/^[A-Za-z0-9_-]{1,120}$/.test(id))err("Identificador de pedido proveedor no válido.");
  if(amount>maxOne)err("El pedido supera el presupuesto individual.");
  if(ledger.reservations.some(x=>x.fulfillmentId===id))
    err("Ese pedido ya tiene una reserva. Concílialo antes de volver a intentarlo.",409);
  const spent=ledger.reservations.reduce((sum,x)=>sum+x.amountCents,0);
  if(spent+amount>maxDaily)err("El gasto acumulado supera el límite diario CJ.");
  const reservations=[...ledger.reservations,{fulfillmentId:id,amountCents:amount,status:"reserved",at:date}];
  return {ledger:JSON.stringify({date:day,reservations}),
    amountCents:amount,dailyUsedCents:spent+amount,dailyRemainingCents:maxDaily-spent-amount,
    canSpendRealMoney:false};
}
export function assessCjAutopilotDryRun({
  policy,record,supplier,order,stripeIntent,quote,stock,usdEurRate,
  nowMs=Date.now()
}={}){
  const blockers=[],push=s=>{if(!blockers.includes(s))blockers.push(s);};
  if(!policy?.configured||policy.mode!=="simulation"||
    !Number.isFinite(policy.perOrderMaxEur)||!Number.isFinite(policy.dailyMaxEur)||
    !Number.isFinite(policy.minMarginPercent))
    push("Faltan presupuestos y margen aprobados para la simulación.");
  if(!record?.id||!supplier||record.supplierId!==supplier.id ||
     !policy?.allowedSupplierIds?.includes(supplier.id)||supplier.active===false||
     supplier.cjSandbox!==false)
    push("El pedido no pertenece a un CJ real autorizado.");
  if(!order||String(order.id)!==String(record?.orderId)||
     !["paid","confirmed","preparing","processing","ready"].includes(String(order.status)))
    push("El pedido del cliente no consta confirmado en Herencia.");
  if(["cj_creating","cj_creation_unknown","cj_paying","cj_payment_unknown"].includes(String(record?.status)) ||
     record?.externalOrderId || record?.cjShipmentOrderId)
    push("Existe o puede existir una operación real en CJ: no se autoriza repetirla.");
  if(!["approval_required","autopilot_ready"].includes(String(record?.status)))
    push("El pedido no está pendiente de autorización de compra.");
  const items=Array.isArray(record?.items)?record.items:[];
  const item=items[0]||{},address=record?.shippingAddress||{};
  const postcode=norm(address.postalCode);
  if(items.length!==1||Number(item.quantity)!==1||
      !/^[0-9]{5}$/.test(postcode)||!["ES","es","España","spain"].includes(address.country)||
      /^(?:35|38|51|52)/.test(postcode))
    push("Solo una unidad con entrega española sujeta a IVA peninsular o balear.");
  const stripeId=norm(order?.stripe_payment_intent_id||order?.stripePaymentIntentId);
  const expectedCents=Math.round(Number(order?.total)*100);
  if(!stripeId||stripeIntent?.id!==stripeId || stripeIntent?.livemode!==true ||
    stripeIntent?.status!=="succeeded" ||stripeIntent?.currency?.toLowerCase()!=="eur" ||
    !Number.isSafeInteger(expectedCents)||expectedCents<=0||
    Number(stripeIntent?.amount_received)<expectedCents)
    push("Stripe no acredita un cargo real, en EUR y vinculado al pedido.");
  const source=order?.metadata||{};
  if(Number(source.discount||0)>0 || source.freeCouponOrder===true)
    push("Los cupones financiados por Herencia requieren revisión manual.");
  if(!verifiedCjQuoteMatches({
    quote,identity:{vid:norm(item.supplierVariantId),sku:norm(item.supplierSku),
      name:norm(item.selectedVariant)},destination:"ES",postalCode:postcode,
    methodName:norm(item.cjPreferredLogisticName),salePriceEur:Number(item.salePrice),
    nowMs
  }))
    push("La cotización de variante, SKU, código postal o transporte es inválida o caducó.");
  if(!stock || stock.verified!==true||stock.vid!==norm(item.supplierVariantId)||
     stock.origin!=="CN"||stock.available!==true||!(stock.quantity>=1))
    push("CJ no confirma existencias para el VID exacto en almacén CN.");
  const estimatedCost=Number(quote?.costEur);
  if(!Number.isFinite(estimatedCost)||estimatedCost<=0 ||
     (Number.isFinite(policy?.perOrderMaxEur)&&estimatedCost>policy.perOrderMaxEur)||
     (Number.isFinite(supplier?.maxAutoOrderTotal)&&supplier.maxAutoOrderTotal>0 &&
      estimatedCost>supplier.maxAutoOrderTotal))
    push("El coste estimado supera el límite por pedido o no es verificable.");
  const margin=Number(quote?.estimatedMarginPercent);
  if(!Number.isFinite(margin)||margin<Number(policy?.minMarginPercent)||quote?.feasible!==true)
    push("El margen neto de la cotización no alcanza el mínimo requerido.");
  if(!Number.isFinite(Number(usdEurRate))||Number(usdEurRate)<=0||
    Number(usdEurRate)>=3)
    push("El tipo de cambio no está verificado recientemente.");
  // Even a 0-blocker preflight is not a permission to spend money.
  return {
    eligibleForSupervisedTest:blockers.length===0,
    blockers,scope:"preflight_only",readOnly:true,
    automaticPurchasesEnabled:false,automaticSupplierPaymentEnabled:false,
    supplierOrderCreated:false,moneySpent:false,
    policyConfigured:Boolean(policy?.configured),
  };
}
