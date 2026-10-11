/**
 * Explicit merchant authorization for unattended CJ spending.
 * Separate from the simulated budget draft and from Railway env flags.
 * Nothing in this module buys from CJ or charges a customer.
 */
export const CJ_LIVE_MANDATE_KEY="cjAutopilotLiveMandate:v1";
export const CJ_LIVE_MANDATE_CONFIRMATION="AUTORIZO COMPRAS AUTOMATICAS CJ";
const fail=(message)=>{const error=new Error(message);error.statusCode=422;throw error;};
const cents=x=>{
 if(!Number.isFinite(Number(x))||Number(x)<=0)return null;
 return Math.round(Number(x)*100);
};
export function validateCjLiveMandate(raw,{policy,suppliers=[],nowMs=Date.now()}={}){
 let obj;
 try{obj=typeof raw==="string"?JSON.parse(raw):raw;}catch{return null;}
 if(!obj||typeof obj!=="object"||obj.enabled!==true||
   obj.confirmation!==CJ_LIVE_MANDATE_CONFIRMATION)return null;
 if(!policy?.configured||policy.mode!=="simulation")return null;
 if(!Number.isFinite(nowMs))return null;
 const created=Date.parse(String(obj.createdAt||""));
 const expires=Date.parse(String(obj.expiresAt||""));
 if(!Number.isFinite(created)||!Number.isFinite(expires)||created>nowMs||
   expires<=nowMs||expires-created>31*86400_000)return null;
 if(!Array.isArray(obj.allowedSupplierIds)||!obj.allowedSupplierIds.length ||
    obj.allowedSupplierIds.length>8 || new Set(obj.allowedSupplierIds).size!==obj.allowedSupplierIds.length)return null;
 const liveIds=new Set(suppliers.filter(s=>
   s.integrationType==="cj"&&s.active!==false&&s.cjSandbox===false).map(s=>String(s.id)));
 if(obj.allowedSupplierIds.some(id=>!liveIds.has(String(id))||
   !policy.allowedSupplierIds.includes(String(id))))return null;
 if(cents(obj.perOrderMaxEur)!==cents(policy.perOrderMaxEur)||
   cents(obj.dailyMaxEur)!==cents(policy.dailyMaxEur)||
   Number(obj.minMarginPercent)!==Number(policy.minMarginPercent))return null;
 if(cents(obj.perOrderMaxEur)>cents(obj.dailyMaxEur))return null;
 if(obj.country!=="ES"||obj.quantity!==1||obj.allowCoupons!==false)return null;
 return {...obj,valid:true};
}
export function buildCjLiveMandate(input,{
 policy,suppliers=[],supervisedProof=false,env={},now=new Date().toISOString(),
}={}){
 if(!policy?.configured)fail("Configura primero los presupuestos y el margen CJ.");
 if(input?.confirmation!==CJ_LIVE_MANDATE_CONFIRMATION ||
   input?.acknowledgeRealSupplierDebits!==true)
   fail("Debes confirmar expresamente los cargos reales del proveedor.");
 if(!supervisedProof)fail("Antes de las compras desatendidas se exige un pedido CJ real y supervisado.");
 if(env.CJ_LIVE_AUTOPILOT_ENABLED!=="true"||
    env.CJ_LIVE_ORDER_CREATION_ENABLED!=="true"||
    env.CJ_LIVE_PAYMENT_ENABLED!=="true")
   fail("Railway aún no ha habilitado las tres protecciones de compras reales.");
 if(!Array.isArray(input.allowedSupplierIds)||!input.allowedSupplierIds.length)
   fail("Debes indicar qué proveedor CJ puede gastar saldo.");
 if(cents(input.perOrderMaxEur)!==cents(policy.perOrderMaxEur) ||
   cents(input.dailyMaxEur)!==cents(policy.dailyMaxEur)||
   Number(input.minMarginPercent)!==Number(policy.minMarginPercent))
   fail("Los importes aprobados no coinciden con los límites CJ vigentes.");
 const nowMs=Date.parse(now);
 if(!Number.isFinite(nowMs))fail("Fecha no válida.");
 const mandate={
   enabled:true,confirmation:CJ_LIVE_MANDATE_CONFIRMATION,
   acknowledgeRealSupplierDebits:true,
   allowedSupplierIds:input.allowedSupplierIds.map(String),
   perOrderMaxEur:Number(policy.perOrderMaxEur),
   dailyMaxEur:Number(policy.dailyMaxEur),
   minMarginPercent:Number(policy.minMarginPercent),
   country:"ES",quantity:1,allowCoupons:false,
   createdAt:new Date(nowMs).toISOString(),
   expiresAt:new Date(nowMs+30*86400_000).toISOString(),
 };
 if(!validateCjLiveMandate(mandate,{policy,suppliers,nowMs}))
   fail("Proveedor o límites no compatibles con un mandato CJ real.");
 return JSON.stringify(mandate);
}
export function cjLiveMandatePermits({mandate,record,supplier,amountEur}={}){
 return Boolean(mandate?.valid===true && record?.id &&
   ["approval_required","autopilot_ready","payment_required"].includes(String(record.status)) &&
   supplier?.active!==false && supplier?.cjSandbox===false &&
   supplier?.integrationType==="cj" && String(record.supplierId)===String(supplier.id) &&
   mandate.allowedSupplierIds.includes(String(supplier.id)) &&
   Number.isFinite(Number(amountEur)) && Number(amountEur)>0 &&
   Number(amountEur)<=mandate.perOrderMaxEur &&
   (record.provider==="cj" || !record.provider));
}
