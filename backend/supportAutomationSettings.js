export const DEFAULT_SUPPORT_AUTOMATION_SETTINGS = Object.freeze({
  assistantEnabled: true,
  orderLookupEnabled: true,
});
const KEYS = Object.keys(DEFAULT_SUPPORT_AUTOMATION_SETTINGS);
export function parseSupportAutomationSettings(raw) {
  let source=raw;
  if(typeof source==="string"){
    try{source=JSON.parse(source);}catch{source={};}
  }
  const settings={...DEFAULT_SUPPORT_AUTOMATION_SETTINGS};
  if(source&&typeof source==="object"&&!Array.isArray(source)){
    for(const key of KEYS)if(typeof source[key]==="boolean")settings[key]=source[key];
  }
  return settings;
}
export function validateSupportAutomationPatch(raw) {
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Configuración no válida");
  const keys=Object.keys(raw);
  if(!keys.length||keys.some(key=>!KEYS.includes(key)))throw new Error("Solo se permiten opciones reconocidas");
  const changes={};
  for(const key of keys){
    if(typeof raw[key]!=="boolean")throw new Error("La opción debe estar activada o desactivada");
    changes[key]=raw[key];
  }
  return changes;
}
