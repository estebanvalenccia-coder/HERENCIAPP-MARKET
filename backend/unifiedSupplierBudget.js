/** Shared merchant settings for the supplier engine. This is a configuration draft:
 * spending requires each connector's independent financial mandate AND a
 * transactional shared ledger before any automatic payment may be enabled.
 */
export const UNIVERSAL_SUPPLIER_BUDGET_KEY="unifiedSupplierBudget:v1";
export const DEFAULT_SUPPLIER_BUDGET={
  dailyMaxEur:100,perOrderMaxEur:null,minMarginPercent:null,
  providers:{aliexpress:false,cj:false,printful:false},
  paymentsEnabled:false,autoPurchaseEnabled:false,sharedLedgerActive:false,
};
const fail=message=>{const error=new Error(message);error.statusCode=422;throw error;};
export function parseUniversalSupplierBudget(raw){
  if(!raw)return {...DEFAULT_SUPPLIER_BUDGET,providers:{...DEFAULT_SUPPLIER_BUDGET.providers}};
  try{
    const v=JSON.parse(raw);
    if(!v || typeof v!=="object")throw Error("invalid");
    const validated=validateUniversalSupplierBudget(v);
    return {...validated,paymentsEnabled:false,autoPurchaseEnabled:false,sharedLedgerActive:false};
  }catch{return {...DEFAULT_SUPPLIER_BUDGET,providers:{...DEFAULT_SUPPLIER_BUDGET.providers}};}
}
export function validateUniversalSupplierBudget(input){
  if(!input||typeof input!=="object"||Array.isArray(input))fail("Configuración inválida.");
  if(input.paymentsEnabled===true||input.autoPurchaseEnabled===true||input.sharedLedgerActive===true)
    fail("Este formulario establece límites globales, pero no autoriza pagos ni activa compras.");
  const daily=Number(input.dailyMaxEur);
  const order=Number(input.perOrderMaxEur);
  const margin=Number(input.minMarginPercent);
  if(!Number.isFinite(daily)||daily<=0||daily>10000||Math.round(daily*100)!==daily*100)
    fail("Introduce un límite diario válido entre 0,01 y 10.000 €.");
  if(input.perOrderMaxEur===null||input.perOrderMaxEur===""||
     !Number.isFinite(order)||order<=0||order>daily||Math.round(order*100)!==order*100)
    fail("Indica el límite por pedido; debe ser positivo y no superar el presupuesto diario.");
  if(input.minMarginPercent===null||input.minMarginPercent===""||
     !Number.isFinite(margin)||margin<10||margin>70)
    fail("El margen neto mínimo debe estar entre 10 % y 70 %.");
  const p=input.providers;
  if(!p||typeof p!=="object"||Array.isArray(p)||["aliexpress","cj","printful"].some(k=>typeof p[k]!=="boolean"))
    fail("Selecciona explícitamente qué proveedores se incluyen.");
  return {
    dailyMaxEur:daily,perOrderMaxEur:order,minMarginPercent:margin,
    providers:{aliexpress:p.aliexpress,cj:p.cj,printful:p.printful},
    paymentsEnabled:false,autoPurchaseEnabled:false,sharedLedgerActive:false,
  };
}
