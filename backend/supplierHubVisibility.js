// Admin-only supplier catalog preferences and reversible retirement.
// Never delete supplier identity, provider payment settings, products or order history.
import { SUPPLIER_PRESETS } from "./supplierMarketplace.js";
const presetIds = new Set(SUPPLIER_PRESETS.map(p => p.id));
const error=(message,statusCode=422)=>{const e=new Error(message);e.statusCode=statusCode;throw e;};
const normalize=(value)=>String(value||"").trim().toLowerCase();
export function updateSupplierHubVisibility(operations={},input={},now=new Date().toISOString()) {
  const scope=normalize(input.scope), action=normalize(input.action);
  const id=String(input.id||"").trim();
  const before=operations && typeof operations==="object"&&!Array.isArray(operations)?operations:{};
  if(!["preset","registered"].includes(scope))error("Tipo de proveedor no válido.");
  if(!id || id.length>100)error("Identificador de proveedor no válido.");
  if(scope==="preset"){
    if(!presetIds.has(id))error("La plantilla no existe.",404);
    if(!["hide","show","remove","restore"].includes(action))error("Acción no permitida para la plantilla.");
    const preferences={...(before.supplierPresetPreferences||{})};
    if(action==="show"||action==="restore")delete preferences[id];
    else preferences[id]=action==="remove"?"removed":"hidden";
    return {operations:{...before,supplierPresetPreferences:preferences},scope,id,action,archived:false};
  }
  if(!["hide","show","archive","restore"].includes(action))error("Acción no permitida para el proveedor registrado.");
  const suppliers=Array.isArray(before.suppliers)?before.suppliers:[];
  const target=suppliers.find(s=>String(s?.id)===id);
  if(!target)error("No existe el proveedor registrado.",404);
  const after=suppliers.map(s=>{
    if(String(s?.id)!==id)return s;
    if(action==="hide")return {...s,hiddenInSupplierHub:true,updatedAt:now};
    if(action==="show")return {...s,hiddenInSupplierHub:false,updatedAt:now};
    if(action==="archive")return {...s,hiddenInSupplierHub:true,active:false,
      fulfillmentMode:"manual",archivedAt:now,updatedAt:now};
    return {...s,hiddenInSupplierHub:false,active:false,archivedAt:null,
      fulfillmentMode:"manual",updatedAt:now};
  });
  return {operations:{...before,suppliers:after},scope,id,action,archived:action==="archive"};
}
