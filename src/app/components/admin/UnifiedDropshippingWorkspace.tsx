import {useMemo,useState} from "react";
import {ArrowRight,Layers3,Link2,PackagePlus,ShoppingBag,Truck,Bot,AlertTriangle} from "lucide-react";
import {AdminAliExpressConnection} from "./AdminAliExpressConnection";

type Provider="all"|"aliexpress"|"cj"|"printful"|"manual";
type SupplierState={type:string;state:string;automaticOrders:boolean;supplierId?:string};
type Props={
  onNavigate:(id:string)=>void;
  onAdvanced:()=>void;
  onOpenProduct:(id:string)=>void;
  supplierConnectorStatuses:SupplierState[];
  products:any[];
  fulfillments:any[];
};
const PROVIDERS:Array<{id:Provider;name:string;detail:string;target:string}>= [
  {id:"all",name:"Todos",detail:"Vista global",target:"supplier-registered"},
  {id:"aliexpress",name:"AliExpress",detail:"Enlaces e ID por API",target:"supplier-import"},
  {id:"cj",name:"CJdropshipping",detail:"Catálogo y envíos",target:"supplier-catalog"},
  {id:"printful",name:"Printful",detail:"Impresión bajo demanda",target:"supplier-printful"},
  {id:"manual",name:"Manual / archivos",detail:"CSV, JSON y XML",target:"supplier-file-import"},
];
const STEPS=[
  {name:"Proveedores",detail:"Conectar y verificar",target:"supplier-registered",Icon:Link2},
  {name:"Importar",detail:"URL, catálogo o archivo",target:"supplier-import",Icon:PackagePlus},
  {name:"Publicar",detail:"Revisar ficha, stock y margen",target:"supplier-catalog",Icon:Layers3},
  {name:"Pedidos",detail:"Ventas y pago confirmado",target:"supplier-orders",Icon:ShoppingBag},
  {name:"Envíos",detail:"Proveedor y seguimiento",target:"supplier-orders",Icon:Truck},
];
const ATTENTION=new Set(["supplier_required","supplier_disabled","cost_required","mapping_required","address_required",
  "connector_required","approval_required","action_required","payment_required","cj_creation_unknown","cj_payment_unknown",
  "supplier_dispatch_unknown","cj_payment_unknown"]);
const DONE=new Set(["delivered","cancelled","canceled","closed","refunded"]);
export function supplierKind(product:any):Provider {
  const meta=product?.metadata&&typeof product.metadata==="object"?product.metadata:{};
  const all=[meta.sourceProvider,meta.integrationType,meta.provider,meta.vendor,meta.sourceHost,
    meta.sourceProductUrl,meta.supplierName,meta.supplierId,product?.supplierName,product?.supplierType]
    .map(value=>String(value||"").toLowerCase()).join(" ");
  if(/aliexpress/.test(all))return "aliexpress";
  if(/cjdropshipping|\bcj\b/.test(all))return "cj";
  if(/printful/.test(all))return "printful";
  return "manual";
}
function fulfillmentKind(row:any):Provider{
  const all=[row?.supplierName,row?.integrationType,row?.provider,row?.supplierType,row?.supplierId]
    .map(value=>String(value||"").toLowerCase()).join(" ");
  if(/aliexpress/.test(all))return "aliexpress";
  if(/cjdropshipping|\bcj\b/.test(all))return "cj";
  if(/printful/.test(all))return "printful";
  return "manual";
}
function productPublishable(product:any){
  const metadata=product?.metadata&&typeof product.metadata==="object"?product.metadata:{};
  const draft=String(product?.status||"").toLowerCase()!=="active"||product?.active===false;
  const variants=Array.isArray(product?.variants)?product.variants:[];
  const variantConfigured=variants.length>0&&variants.every((variant:any)=>
    Boolean(String(variant?.sku||"").trim())&&Number(variant?.price)>0&&Number(variant?.stock)>=0);
  if(draft)return {ready:false,reason:"Borrador: revisar ficha antes de publicar"};
  if(metadata.approvedForPublication===false||metadata.complianceVerified===false)
    return {ready:false,reason:"Revisión de costes o normativa pendiente"};
  if(!(Number(product?.price)>0)&&!variantConfigured)return {ready:false,reason:"Faltan precio y variantes verificadas"};
  return {ready:true,reason:"Publicado (la compra al proveedor se verifica por separado)"};
}
export function UnifiedDropshippingWorkspace({onNavigate,onAdvanced,onOpenProduct,
  supplierConnectorStatuses,products,fulfillments}:Props){
  const [provider,setProvider]=useState<Provider>("all");
  const [orderFilter,setOrderFilter]=useState<"attention"|"active"|"all">("attention");
  const [productFilter,setProductFilter]=useState<"all"|"draft"|"published">("all");
  const current=PROVIDERS.find(item=>item.id===provider)!;
  const filteredProducts=useMemo(()=>products.filter((product:any)=>{
    if(product?.deletedAt||product?.status==="archived")return false;
    if(provider!=="all"&&supplierKind(product)!==provider)return false;
    const active=product?.status==="active"&&product?.active!==false;
    return productFilter==="all"||(productFilter==="published"?active:!active);
  }),[products,provider,productFilter]);
  const filteredOrders=useMemo(()=>fulfillments.filter((row:any)=>{
    if(row?.queueRemoved===true)return false;
    if(provider!=="all"&&fulfillmentKind(row)!==provider)return false;
    const state=String(row?.status||"");
    return orderFilter==="all"||(orderFilter==="attention"?ATTENTION.has(state):!DONE.has(state));
  }),[fulfillments,provider,orderFilter]);
  const pending=fulfillments.filter((row:any)=>!DONE.has(String(row?.status||""))&&row?.queueRemoved!==true).length;
  const attention=fulfillments.filter((row:any)=>ATTENTION.has(String(row?.status||""))&&row?.queueRemoved!==true).length;
  const configured=supplierConnectorStatuses.filter(x=>x.state==="ready"||x.state==="configured").length;
  const activeStatus=supplierConnectorStatuses.find(x=>String(x.type||"").toLowerCase()===provider);
  const go=(id:string)=>{onAdvanced();onNavigate(id);};
  const nameFor=(id:Provider)=>PROVIDERS.find(x=>x.id===id)?.name||id;
  return <section aria-label="Motor unificado de dropshipping" className="space-y-5 rounded-3xl border border-border bg-card p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Un motor · Proveedores independientes</p>
        <h2 className="mt-1 text-2xl font-bold">Motor de Dropshipping</h2>
        <p className="mt-1 text-sm text-muted-foreground">Conecta, importa, publica y gestiona todos los pedidos desde un solo lugar.</p>
      </div>
      <button type="button" onClick={()=>go("supplier-orders")} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold">
        Ver cola completa · {pending}</button>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label="Filtrar por proveedor">
      {PROVIDERS.map(item=><button key={item.id} type="button" aria-pressed={provider===item.id} onClick={()=>setProvider(item.id)}
        className={"rounded-xl border p-3 text-left "+(provider===item.id?"border-primary bg-primary/10 ring-1 ring-primary":"border-border bg-background hover:bg-muted/40")}>
        <span className="block font-bold text-sm">{item.name}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span>
      </button>)}
    </div>
    <div className="grid grid-cols-3 gap-2 text-center text-xs">
      <div className="rounded-xl border p-3"><strong className="block text-lg">{configured}</strong>API configuradas</div>
      <div className="rounded-xl border p-3"><strong className="block text-lg">{pending}</strong>Pedidos activos</div>
      <div className="rounded-xl border p-3"><strong className="block text-lg">{attention}</strong>Incidencias</div>
    </div>
    <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="font-bold">{current.name==="Todos"?"Conexiones de proveedores":current.name}</h3>
          <p className="text-xs text-muted-foreground">{provider==="all"?"Selecciona un proveedor para importar o verificar su API.":
            provider==="aliexpress"?"Consulta productos por enlace o ID; importa variantes reales como borrador.":
            provider==="manual"?"Importa fichas de proveedores sin conexión API, sin compras automáticas.":
            activeStatus?.state==="ready"?"Conexión verificada; comprueba las operaciones por separado.":
            activeStatus?.state==="configured"?"Configuración detectada; compras sin verificar.":"Conexión y permisos pendientes de verificar."}</p></div>
        {provider!=="all"&&provider!=="aliexpress"&&<button onClick={()=>go(current.target)} type="button"
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold">
          Abrir {current.name}<ArrowRight className="h-4 w-4"/></button>}
      </div>
      {provider==="all"&&<div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {PROVIDERS.filter(x=>x.id!=="all").map(x=><button key={x.id} onClick={()=>setProvider(x.id)} type="button"
          className="rounded-lg border bg-background p-3 text-left text-sm font-semibold">{x.name}
          <span className="block text-xs font-normal text-muted-foreground">Configurar / importar</span></button>)}
      </div>}
      {provider==="aliexpress"&&<AdminAliExpressConnection/>}
    </div>
    <div>
      <h3 className="font-bold">Las cinco etapas (para todos los proveedores)</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((item,index)=><button key={item.name} type="button" onClick={()=>go(item.target)}
          className="rounded-xl border bg-background p-3 text-left hover:bg-muted/40">
          <span className="flex items-center gap-2 text-xs font-bold text-primary"><item.Icon className="h-4 w-4"/>{index+1}. {item.name}</span>
          <span className="mt-2 block text-xs text-muted-foreground">{item.detail}</span></button>)}
      </div>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-border p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">Productos · {filteredProducts.length}</h3>
          <button type="button" onClick={()=>go("supplier-catalog")} className="text-xs font-semibold underline">Abrir catálogo completo</button>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar productos">
          {([{id:"all",name:"Todos"},{id:"draft",name:"Borradores"},{id:"published",name:"Publicados"}] as const).map(x=>
            <button type="button" key={x.id} onClick={()=>setProductFilter(x.id)}
              aria-pressed={productFilter===x.id}
              className={"rounded-lg border px-3 py-1.5 text-xs "+(productFilter===x.id?"border-primary font-bold":"border-border")}>{x.name}</button>)}
        </div>
        <div className="max-h-80 space-y-2 overflow-auto">
          {filteredProducts.length===0?<p className="text-sm text-muted-foreground">No hay productos para este filtro. Usa «Importar» o selecciona un proveedor.</p>:
            filteredProducts.slice(0,12).map((product:any)=>{
              const readiness=productPublishable(product);
              return <div key={String(product.id)} className="flex items-start justify-between gap-2 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{String(product.name||"Producto sin nombre")}</p>
                  <p className="text-xs text-muted-foreground">{nameFor(supplierKind(product))} · {readiness.reason}</p>
                  <p className="text-xs text-muted-foreground">{Array.isArray(product.variants)?product.variants.length:0} variantes</p>
                </div>
                <button type="button" onClick={()=>onOpenProduct(String(product.id))}
                  className="shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold">Revisar</button>
              </div>;
            })}
        </div>
        {filteredProducts.length>12&&<button type="button" onClick={()=>go("supplier-catalog")} className="text-xs font-semibold underline">Ver los demás productos</button>}
      </div>
      <div className="rounded-2xl border border-border p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">Cola de pedidos · {filteredOrders.length}</h3>
          <button type="button" onClick={()=>go("supplier-orders")} className="text-xs font-semibold underline">Gestionar pedidos</button>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar pedidos">
          {([{id:"attention",name:"Incidencias"},{id:"active",name:"Activos"},{id:"all",name:"Todos"}] as const).map(x=>
            <button key={x.id} type="button" onClick={()=>setOrderFilter(x.id)} aria-pressed={orderFilter===x.id}
              className={"rounded-lg border px-3 py-1.5 text-xs "+(orderFilter===x.id?"border-primary font-bold":"border-border")}>{x.name}</button>)}
        </div>
        <div className="max-h-80 space-y-2 overflow-auto">
          {filteredOrders.length===0?<p className="text-sm text-muted-foreground">No hay pedidos con este filtro.</p>:
            filteredOrders.slice(0,12).map((order:any)=><div key={String(order.id)} className="flex items-start justify-between gap-2 rounded-lg border p-3">
              <div className="min-w-0"><p className="text-sm font-bold">Pedido {String(order.orderId||order.id||"").slice(0,28)}</p>
                <p className="text-xs text-muted-foreground">{String(order.supplierName||nameFor(fulfillmentKind(order)))} · {String(order.status||"pendiente")}</p>
                <p className="text-xs text-muted-foreground">{order.externalOrderId?"Pedido proveedor: "+String(order.externalOrderId):"Sin ID de pedido del proveedor confirmado"}</p>
              </div>
              <button type="button" onClick={()=>go("supplier-orders")} className="shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold">Abrir</button>
            </div>)}
        </div>
        {filteredOrders.length>12&&<button type="button" onClick={()=>go("supplier-orders")} className="text-xs font-semibold underline">Ver todos los pedidos</button>}
      </div>
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={()=>go("supplier-operations")} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><AlertTriangle className="h-4 w-4"/>Incidencias</button>
      <button type="button" onClick={()=>go("supplier-cj-automation")} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"><Bot className="h-4 w-4"/>Configuración técnica avanzada</button>
    </div>
    <p className="text-xs text-muted-foreground">Importar, publicar y crear pedidos son operaciones diferentes. Solo las API verificadas pueden enviar pedidos reales; publicar una ficha no autoriza compras. No hay pagos automáticos entre proveedores sin autorizaciones y controles individuales.</p>
  </section>;
}
