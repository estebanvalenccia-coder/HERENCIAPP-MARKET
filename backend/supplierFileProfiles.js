import { normalizeSupplierColumnMap } from "./supplierFileSchema.js";

const MAX_PROFILES=120;
const PROFILE_TYPES=new Set(["csv","json","xml"]);
function fail(message) {
  const error=new Error(message);error.statusCode=422;throw error;
}
export function supplierFileProfileKey(supplierId,format){
  const id=String(supplierId||"").trim();
  const type=String(format||"").trim().toLowerCase();
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(id))fail("Proveedor incorrecto.");
  if(!PROFILE_TYPES.has(type))fail("Formato no admitido para el perfil de proveedor.");
  return id+":"+type;
}
export function readSupplierFileProfile(raw,supplierId,format) {
  const key=supplierFileProfileKey(supplierId,format);
  let records={};
  try {
    const saved=typeof raw==="string"?JSON.parse(raw||"{}"):raw||{};
    if(saved && typeof saved==="object" && !Array.isArray(saved))records=saved;
  } catch {return {columnMap:{},updatedAt:null,exists:false};}
  const entry=records[key];
  if(!entry||typeof entry!=="object"||Array.isArray(entry))
    return {columnMap:{},updatedAt:null,exists:false};
  try {
    const map=entry.columnMap||{};
    // Use the saved source names as the allowed column set, then revalidate
    // against the *actual* uploaded file before any import.
    const normalized=normalizeSupplierColumnMap(map,Object.values(map));
    return {columnMap:{...normalized},updatedAt:String(entry.updatedAt||""),exists:true};
  } catch {
    return {columnMap:{},updatedAt:null,exists:false};
  }
}
export function saveSupplierFileProfile(raw,{supplierId,format,columnMap,columns,now=new Date().toISOString()}={}){
  const key=supplierFileProfileKey(supplierId,format);
  if(!Array.isArray(columns) || columns.length>60)fail("Primero inspecciona un catálogo válido.");
  const verified=normalizeSupplierColumnMap(columnMap,columns);
  let records={};
  try {
    const parsed=typeof raw==="string"?JSON.parse(raw||"{}"):raw||{};
    if(parsed && typeof parsed==="object" && !Array.isArray(parsed))records={...parsed};
  } catch {records={};}
  if(Object.keys(records).length>=MAX_PROFILES && !Object.hasOwn(records,key))
    fail("Se ha alcanzado el límite de perfiles de proveedores.");
  // Metadata only. No API keys, products, prices or customer information.
  records[key]={columnMap:{...verified},updatedAt:now};
  const serialized=JSON.stringify(records);
  if(serialized.length>100000)fail("El almacenamiento de perfiles está lleno.");
  return serialized;
}
