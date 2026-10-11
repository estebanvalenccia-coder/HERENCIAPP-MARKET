import {assessCjPublicProductStatus,isCjSupplierItem} from "./cjFulfillmentIdentity.js";
import {assessCjDistanceSaleCompliance} from "./cjDistanceSaleCompliance.js";
/**
 * Read-only, conservative onboarding indicators. Records in Neon describe what
 * has been configured, NOT proof that a supplier accepts live orders or that a
 * checkout, shipment or refund has succeeded end to end.
 */
export function buildDropshippingLaunchStatus({
  suppliers=[],products=[],fulfillments=[],readiness=null,
}={}) {
  const safeSuppliers=Array.isArray(suppliers)?suppliers:[];
  const safeProducts=Array.isArray(products)?products:[];
  const safeFulfillments=Array.isArray(fulfillments)?fulfillments:[];
  const cj=safeSuppliers.filter(s=>s?.integrationType==="cj"&&s?.active!==false);
  const liveCj=cj.filter(s=>s.cjSandbox===false);
  const cjIds=new Set(cj.map(s=>String(s.id)));
  const related=safeProducts.filter(p=>{
    const m=p?.metadata;
    return Boolean(m&&typeof m==="object"&&cjIds.has(String(m.supplierId||"")))||
      isCjSupplierItem(p);
  });
  // Archived imports are historical records, not evidence of a usable catalog.
  const linked=related.filter(p=>!["archived","deleted","trash"].includes(String(p?.status||"draft")));
  const catalogReview=related.map(p=>{
    const meta=p?.metadata&&typeof p.metadata==="object"?p.metadata:{};
    const supplier=safeSuppliers.find(s=>String(s?.id||"")===String(meta.supplierId||""));
    const issues=[];
    const status=String(p?.status||"draft");
    if(!supplier || supplier.active===false || supplier.integrationType!=="cj")
      issues.push("No hay un proveedor CJ activo correctamente vinculado.");
    else if(supplier.cjSandbox!==false)
      issues.push("El proveedor CJ sigue en Sandbox: no se pueden cobrar pedidos reales.");
    if(status!=="active")
      issues.push(status==="archived"?"Producto archivado; no está a la venta.":"Producto en borrador o sin publicar.");
    const sellability=assessCjPublicProductStatus(p);
    if(sellability.cj) issues.push(...sellability.blockers);
    if(sellability.cj)issues.push(...assessCjDistanceSaleCompliance(p).blockers);
    if(!Number.isFinite(Number(p?.price))||Number(p.price)<=0)
      issues.push("Falta un precio de venta válido.");
    if(!Number.isSafeInteger(Number(p?.stock))||Number(p.stock)<=0)
      issues.push("No hay unidades disponibles según el catálogo local.");
    // Neither positive local stock nor a previously saved quote proves live CJ stock.
    if(status==="active")
      issues.push("Pendiente de verificar stock, coste, IVA y portes CJ en tiempo real antes de cobrar.");
    return {id:String(p?.id||""),name:String(p?.name||"Producto sin nombre"),status,
      issues,needsReview:issues.length>0};
  });
  const cjQueue=safeFulfillments.filter(row=>
    row?.provider==="cj"||cjIds.has(String(row?.supplierId||"")));
  const supervised=cjQueue.some(row=>
    row?.cjManualAuthorization?.approvedByAdminAt&&row.paidAt&&
    (row.externalOrderId||row.cjShipmentOrderId)&&
    ["ordered","shipped","delivered"].includes(String(row.status)));
  const hasQuote=cjQueue.some(row=>
    row?.items?.length===1&&row.items[0]?.cjPricingEstimate&&
    Number(row?.estimatedCost)>0);
  const loaded=Boolean(readiness);
  const hasLiveConnection=readiness?.configured===true&&liveCj.length>0;
  const automatic=readiness?.readyForUnattendedBuying===true;
  const blockerList=Array.isArray(readiness?.activationBlockers)?
    readiness.activationBlockers.filter(x=>typeof x==="string"):[];
  const steps=[
    {id:"supplier",title:"Conectar proveedor CJ",target:"supplier-registered",
      state:loaded?(hasLiveConnection?"configured":"action_required"):"unknown",
      detail:hasLiveConnection?"CJ registrado en modo real; la clave está detectada. Esto no prueba una compra.":
        cj.length===0?"Registra CJdropshipping antes de importar artículos.":
        liveCj.length===0?"CJ está en Sandbox. Valida la conexión antes de pasar a producción.":
        "Falta comprobar la API de CJ en el servidor."},
    {id:"products",title:"Importar y vincular producto",target:"supplier-import",
      state:linked.length>0?"configured":"action_required",
      detail:linked.length>0?
        linked.length+" producto(s) vinculados a CJ. Revisa cada variante antes de publicar.":
        "Importa una URL de CJ y revisa el borrador. Importar no publica automáticamente."},
    {id:"pricing",title:"Comprobar precio, stock y envío",target:"supplier-catalog",
      state:hasQuote?"review_required":"action_required",
      detail:hasQuote?
        "Hay cotizaciones registradas; pueden caducar. Revalida SKU/VID, stock, margen y envío para España.":
        "No hay una cotización CJ registrada en la cola. Verifica una variante y su entrega."},
    {id:"trial",title:"Primera compra supervisada",target:"supplier-orders",
      state:supervised?"review_required":"action_required",
      detail:supervised?
        "Existe un registro de compra CJ supervisada. Confirma también el cargo real Stripe/CJ y el tracking.":
        "Falta registrar y verificar una compra real con aprobación humana. No se realiza desde esta guía."},
    {id:"automation",title:"Automatización con límites",target:"supplier-cj-automation",
      state:!loaded?"unknown":automatic?"configured":"blocked",
      detail:automatic?
        "Autopilot autorizado en el backend para pedidos CJ elegibles; revisa su mandato y presupuesto.":
        "Compras y pagos automáticos aún no acreditados. Consulta los bloqueos antes de autorizar gastos."},
  ];
  const next=steps.find(s=>s.state!=="configured")||steps[steps.length-1];
  return {steps,next,blockers:blockerList,linkedCount:linked.length,
    catalogReview,activeCjProducts:catalogReview.filter(p=>p.status==="active").length,
    cjCount:cj.length,queueCount:cjQueue.length,supervisedRecord:supervised,
    automaticPurchasesVerified:automatic,backendReadinessLoaded:loaded};
}
