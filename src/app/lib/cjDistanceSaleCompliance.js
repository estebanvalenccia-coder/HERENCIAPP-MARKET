// Read-only, conservative controls for physical CJ goods offered to EU consumers.
// GPSR 2023/988 Art. 19: https://eur-lex.europa.eu/eli/reg/2023/988/spa
// Customs: EU temporary €3 duty for affected low-value CN imports since 2026-07-01.
// An operator's declaration does not equal independent legal certification.
import {isCjSupplierItem} from "./cjFulfillmentIdentity.js";
const EU=new Set("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE".split(" "));
const filled=x=>typeof x==="string"&&x.trim().length>1;
const email=x=>filled(x)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.trim());
const validCost=value=>value!==null&&value!==undefined&&value!==""&&
  Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=1000;

export function assessCjDistanceSaleCompliance(product={}){
  if(!isCjSupplierItem(product))return {cj:false,ready:true,blockers:[],warnings:[]};
  const m=product?.metadata&&typeof product.metadata==="object"?product.metadata:{};
  const blockers=[],warnings=[];
  if(!filled(m.gpsrManufacturerName))blockers.push("Falta identificar al fabricante del producto (GPSR).");
  if(!filled(m.gpsrManufacturerPostalAddress))blockers.push("Falta la dirección postal del fabricante (GPSR).");
  if(!email(m.gpsrManufacturerEmail))blockers.push("Falta el correo de contacto del fabricante (GPSR).");
  const country=String(m.gpsrManufacturerCountryCode||"").trim().toUpperCase();
  if(!/^[A-Z]{2}$/.test(country))blockers.push("Verifica el país del fabricante para determinar el responsable en la UE.");
  else if(!EU.has(country)){
    if(!filled(m.gpsrEuResponsibleName))blockers.push("Falta identificar la persona responsable en la UE.");
    if(!filled(m.gpsrEuResponsiblePostalAddress))blockers.push("Falta la dirección postal de la persona responsable en la UE.");
    if(!email(m.gpsrEuResponsibleEmail))blockers.push("Falta el correo de la persona responsable en la UE.");
  }
  if(!filled(m.gpsrProductModel)&&!filled(m.supplierSku)&&!filled(product?.sku))
    blockers.push("Falta modelo o referencia identificativa real del producto.");
  if(!filled(m.gpsrSafetyWarningsEs)&&m.gpsrNoWarningsApplicable!==true)
    blockers.push("Revisa las advertencias de seguridad en español o confirma documentalmente que no proceden.");
  if(m.gpsrSafetyReviewed!==true)
    blockers.push("Falta confirmar que se han revisado las instrucciones y riesgos con el proveedor.");
  if(!["DDP","IOSS"].includes(String(m.cjImportArrangement||"")))
    blockers.push("Falta documentar cómo se gestionan IVA y aduanas para envíos desde China.");
  if(m.cjImportCostsReviewed!==true||!validCost(m.cjAdditionalImportCostEur))
    blockers.push("Falta comprobar el coste adicional de importación aplicable desde julio de 2026 (incluido el arancel provisional cuando corresponda).");
  if(!filled(m.gpsrSafetyWarningsEs))
    warnings.push("Solo marca «sin advertencias» tras comprobar documentación real del producto.");
  warnings.push("La verificación final del cumplimiento legal, IVA, aduanas, envases y seguridad corresponde al vendedor.");
  return {cj:true,ready:blockers.length===0,blockers,warnings,
    manufacturerCountry:country,additionalImportCostEur:validCost(m.cjAdditionalImportCostEur)?
      Number(m.cjAdditionalImportCostEur):null};
}
