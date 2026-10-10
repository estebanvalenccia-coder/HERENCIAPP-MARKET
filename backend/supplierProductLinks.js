/**
 * Manually confirmed cross-supplier product-family links.
 * Never assumes that sizes, power plugs, colors or supplier VIDs match.
 * Does not alter catalog rows or enable automatic routing.
 */
import crypto from "node:crypto";
import { suggestSupplierMatches } from "./supplierOfflineIntelligence.js";

const fail=(msg,code=422)=>{const e=new Error(msg);e.statusCode=code;throw e;};
const validId=id=>/^[A-Za-z0-9_-]{1,100}$/.test(String(id||""));
export function readSupplierProductLinks(raw) {
  try{
    const items=JSON.parse(raw||"[]");
    return Array.isArray(items)?items.slice(0,200).filter(item=>item&&typeof item==="object"):[];
  }catch{return [];}
}
export function confirmSupplierProductLink(raw, {leftProductId,rightProductId}={},products=[],now=new Date().toISOString()) {
  const left=String(leftProductId||""),right=String(rightProductId||"");
  if(!validId(left)||!validId(right)||left===right)fail("Selecciona dos productos distintos y válidos.");
  const matched=products.filter(p=>String(p?.id)===left||String(p?.id)===right);
  if(matched.length!==2)fail("Ambos productos deben existir en Neon.");
  const [a,b]=matched;
  if(a?.metadata?.importedFromFile!==true||b?.metadata?.importedFromFile!==true)fail("Solo se pueden vincular productos importados.");
  const all=suggestSupplierMatches(matched);
  const proposal=all.candidates.find(p=>[p.leftProductId,p.rightProductId].sort().join("|")===[left,right].sort().join("|"));
  if(!proposal)fail("No hay GTIN validado ni fabricante+MPN que justifique la coincidencia.");
  const ordered=[left,right].sort();
  const id="slink_"+crypto.createHash("sha256").update(ordered.join("\u0000")).digest("hex").slice(0,32);
  const links=readSupplierProductLinks(raw);
  const existing=links.find(x=>x.id===id);
  if(existing) return {serialized:JSON.stringify(links),link:existing,created:false};
  if(links.length>=200)fail("Demasiadas agrupaciones de proveedores.");
  const link={
    id,leftProductId:ordered[0],rightProductId:ordered[1],
    reason:proposal.reason,createdAt:now,confirmedManually:true,
    variantsEquivalent:false,stockEquivalent:false,
    automaticRouting:false,automaticPurchases:false
  };
  links.unshift(link);
  return {serialized:JSON.stringify(links),link,created:true};
}
