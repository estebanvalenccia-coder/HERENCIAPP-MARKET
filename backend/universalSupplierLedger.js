/**
 * Unified supplier budget. Any *actual* supplier payment implementation must
 * reserve before its first remote attempt and settle afterwards.
 * This module never triggers a purchase itself.
 */
export const UNIVERSAL_LEDGER_PREFIX="unifiedSupplierLedger:v1:";
const fail=(message,statusCode=409)=>{const e=new Error(message);e.statusCode=statusCode;throw e;};
const cents=(n)=>{
 if(typeof n!=="number"||!Number.isFinite(n)||n<=0||Math.abs(n*100-Math.round(n*100))>0.00001)fail("Importe EUR inválido",422);
 return Math.round(n*100);
};
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const ORDER=/^[A-Za-z0-9_-]{6,120}$/;
export const universalDay=(now=new Date())=>new Date(now).toISOString().slice(0,10);
export const universalLedgerKey=day=>{
 if(!DAY.test(day)||Number.isNaN(Date.parse(day+"T00:00:00Z")))fail("Día no válido",422);
 return UNIVERSAL_LEDGER_PREFIX+day;
};
export function readUniversalLedger(raw,day){
 let v;
 try{v=raw?JSON.parse(raw):{day,entries:[]};}catch{fail("El registro de gasto no se puede leer");}
 if(!v||v.day!==day||!Array.isArray(v.entries)||v.entries.length>5000)fail("Registro de gasto inválido");
 if(!v.entries.every(e=>ORDER.test(String(e.orderId))&&
  ["cj","printful","aliexpress"].includes(e.provider)&&
  Number.isSafeInteger(e.amountCents)&&e.amountCents>0&&
  ["reserved","committed","uncertain","released"].includes(e.status)))
  fail("Registro de gasto corrupto");
 if(new Set(v.entries.map(e=>e.orderId)).size!==v.entries.length)fail("Reserva duplicada en registro");
 return v;
}
export function reserveUniversalBudget(raw,{day,orderId,provider,amountEur,policy,paidOrderVerified=false,providerQuoteVerified=false,marginVerified=false}){
 if(!paidOrderVerified||!providerQuoteVerified||!marginVerified)fail("Pedido Stripe, coste y margen no verificados");
 if(!ORDER.test(String(orderId)))fail("ID de pedido inválido",422);
 if(!["cj","printful","aliexpress"].includes(provider)||policy?.providers?.[provider]!==true)
   fail("Proveedor no autorizado");
 const amount=cents(amountEur),daily=cents(policy?.dailyMaxEur),perOrder=cents(policy?.perOrderMaxEur);
 if(amount>perOrder)fail("Se supera el límite por pedido");
 const ledger=readUniversalLedger(raw,day);
 if(ledger.entries.some(x=>x.orderId===orderId))fail("El pedido ya tiene una reserva; conciliar antes de repetir");
 const used=ledger.entries.reduce((n,x)=>n+(x.status==="released"?0:x.amountCents),0);
 if(used+amount>daily)fail("Se supera el presupuesto diario universal");
 return JSON.stringify({day,entries:[...ledger.entries,{orderId,provider,amountCents:amount,status:"reserved"}]});
}
export function settleUniversalBudget(raw,{day,orderId,status,remoteAttempted=false,providerEvidence=false}){
 if(!["committed","uncertain","released"].includes(status))fail("Estado no admitido",422);
 const ledger=readUniversalLedger(raw,day);
 const target=ledger.entries.find(x=>x.orderId===orderId);
 if(!target)fail("No existe reserva");
 if(target.status===status)return JSON.stringify(ledger);
 if(target.status!=="reserved")fail("Operación anterior requiere conciliación");
 if(status==="released"&&remoteAttempted)fail("No se puede liberar una compra ya intentada");
 if(status==="committed"&&!providerEvidence)fail("Falta evidencia del proveedor");
 target.status=status;
 return JSON.stringify(ledger);
}
export async function reserveUniversalBudgetAtomic(mutate,request){
 if(typeof mutate!=="function")fail("Persistencia no disponible",503);
 const key=universalLedgerKey(request.day);
 return mutate(key,current=>reserveUniversalBudget(current,request));
}
export async function settleUniversalBudgetAtomic(mutate,request){
 if(typeof mutate!=="function")fail("Persistencia no disponible",503);
 const key=universalLedgerKey(request.day);
 return mutate(key,current=>settleUniversalBudget(current,request));
}
