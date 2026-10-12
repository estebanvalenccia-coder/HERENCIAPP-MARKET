import {assessCjDistanceSaleCompliance,isCjSupplierItem} from "./cjDistanceSaleCompliance.js";
/**
 * Conservative review: missing documents are PENDING, never a regulatory violation.
 * Only explicit verified prohibitions or confirmed unavailable shipping qualify as blocked.
 * This does not replace legal review of CE/product-specific requirements.
 */
export function assessCjAutomatedProduct(product={},observation={}){
 if(!isCjSupplierItem(product))return {applicable:false};
 const compliance=assessCjDistanceSaleCompliance(product);
 const metadata=product.metadata||{};
 const issues=[];
 const confirmed=[];
 if(product.status==="archived"||product.deletedAt||metadata.cjConfirmedProhibited===true)
   confirmed.push("Producto retirado o prohibición confirmada: no está a la venta.");
 if(observation.shipping?.verified===true && observation.shipping?.available===false)
   confirmed.push("CJ confirmó que no hay transporte a España para esta variante y dirección.");
 if(observation.stock?.verified===true && observation.stock?.available===false)
   confirmed.push("CJ confirmó falta de existencias de la variante seleccionada.");
 if(compliance.blockers.length)issues.push(...compliance.blockers);
 if(!observation.stock?.verified)issues.push("Stock por variante y almacén sin verificar en CJ.");
 if(!observation.shipping?.verified)issues.push("Transporte a España sin cotización válida para la dirección del comprador.");
 if(!observation.price?.verified)issues.push("Precio de compra de la variante sin comprobación reciente.");
 if(!Array.isArray(product.variants)||!product.variants.length)
   issues.push("Sin variantes verificadas de CJ en el catálogo.");
 const state=confirmed.length?"blocked":issues.length?"pending":"ready";
 return {applicable:true,state,ready:state==="ready",verified:false,
  // 'ready' is a conditional technical indicator; legal evidence remains separately reviewed.
  pending:issues,confirmed,warnings:compliance.warnings,
  checkedAt:new Date().toISOString(),requiresLegalReview:!compliance.ready};
}
export function summarizeCjProductReviews(products=[],observations={}){
 const results=(products||[]).filter(isCjSupplierItem).map(product=>({
  productId:String(product.id),name:String(product.name||""),
  ...assessCjAutomatedProduct(product,observations[String(product.id)]||{})
 }));
 return {total:results.length,ready:results.filter(r=>r.state==="ready").length,
  pending:results.filter(r=>r.state==="pending").length,
  blocked:results.filter(r=>r.state==="blocked").length,results};
}
