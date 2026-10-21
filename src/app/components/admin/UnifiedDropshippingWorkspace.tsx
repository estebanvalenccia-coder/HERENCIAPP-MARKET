import {useMemo,useState} from "react";
import {ArrowRight,Layers3,Link2,PackagePlus,ShoppingBag,Truck,Bot,AlertTriangle} from "lucide-react";
import {AdminAliExpressConnection} from "./AdminAliExpressConnection";
import {UniversalSupplierBudget} from "./UniversalSupplierBudget";

type Provider="all"|"aliexpress"|"cj"|"printful"|"manual";
type SupplierState={type:string;state:string;automaticOrders:boolean;supplierId?:string};
type Props={
  onNavigate:(id:string)=>void;
  onAdvanced:()=>void;
  onOpenProduct:(id:string)=>void;
  supplierConnectorStatuses:SupplierState[];
  products:any[];
  fulfillments:any[];
  onImportProductByUrl:(url:string)=>Promise<void>;
  onReload:()=>Promise<void>;
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
  {name:"Vincular",detail:"Confirmar cada variante/SKU",target:"supplier-catalog",Icon:Link2},
  {name:"Publicar",detail:"Precio, fotos, stock y margen",target:"supplier-catalog",Icon:Layers3},
  {name:"Pedidos",detail:"Modo manual, automatización y envío",target:"supplier-orders",Icon:ShoppingBag},
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
  supplierConnectorStatuses,products,fulfillments,onImportProductByUrl,onReload}:Props){
  const [provider,setProvider]=useState<Provider>("all");
  const [sourceUrl,setSourceUrl]=useState("");
  const [importing,setImporting]=useState(false);
  const [notice,setNotice]=useState("");
  const [importError,setImportError]=useState("");
  const [importedProductId,setImportedProductId]=useState("");
  const [aliOrderId,setAliOrderId]=useState("");
  const [aliOrderResult,setAliOrderResult]=useState<any>(null);
  const [aliOrderBusy,setAliOrderBusy]=useState(false);
  const [aliOrderError,setAliOrderError]=useState("");
  const checkAliOrder=async()=>{
    setAliOrderBusy(true);setAliOrderError("");setAliOrderResult(null);
    try{
      if(!/^[1-9][0-9]{7,21}$/.test(aliOrderId.trim()))
        throw new Error("Pega un ID de pedido AliExpress válido.");
      const response=await fetch("/api/admin/integrations/aliexpress/order?orderId="+encodeURIComponent(aliOrderId.trim()),{
        credentials:"same-origin",cache:"no-store"});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(String(data.error||"La API AliExpress no pudo confirmar el pedido."));
      setAliOrderResult(data);
    }catch(error:any){setAliOrderError(String(error?.message||"No se pudo consultar AliExpress."));}
    finally{setAliOrderBusy(false);}
  };

  const [activationStatus,setActivationStatus]=useState<any>(null);
  const [activationLoading,setActivationLoading]=useState(false);
  const [activationError,setActivationError]=useState("");
  const checkActivation=async()=>{
    setActivationLoading(true);setActivationError("");
    try{
      const res=await fetch("/api/admin/suppliers/automation-status",{credentials:"same-origin",cache:"no-store"});
      const body=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(String(body.error||"No se pudo consultar la autorización de compras."));
      setActivationStatus(body);
    }catch(error:any){setActivationError(String(error?.message||"No se pudo consultar."));}
    finally{setActivationLoading(false);}
  };

  const [printfulCatalog,setPrintfulCatalog]=useState<Array<{id:string;name:string;variants:number}>>([]);
  const [catalogBusy,setCatalogBusy]=useState(false);
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
  const loadPrintfulCatalog=async()=>{
    setCatalogBusy(true);setImportError("");
    try {
      const response=await fetch("/api/admin/printful/sync-products",{credentials:"same-origin",cache:"no-store"});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(String(body.error||"No se puede leer el catálogo Printful."));
      setPrintfulCatalog(Array.isArray(body.products)?body.products:[]);
      setNotice("Selecciona el producto de Printful y pulsa Importar y vincular.");
    } catch(e:any){setImportError(String(e?.message||"Error al consultar Printful."));}
    finally{setCatalogBusy(false);}
  };
  const importProduct=async()=>{
    const input=sourceUrl.trim();
    if(!input)return;
    setImporting(true);setNotice("");setImportError("");setImportedProductId("");
    try{
      let selected:Provider=provider;
      if(input.startsWith("https://")){
        const host=new URL(input).hostname.toLowerCase();
        if(host==="aliexpress.com"||host.endsWith(".aliexpress.com"))selected="aliexpress";
        else if(host==="cjdropshipping.com"||host.endsWith(".cjdropshipping.com"))selected="cj";
        else if(host==="printful.com"||host.endsWith(".printful.com"))selected="printful";
      }
      if(selected==="aliexpress"){
        const response=await fetch("/api/admin/integrations/aliexpress/draft",{method:"POST",
          credentials:"same-origin",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({productInput:input})});
        const result=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(String(result.error||"AliExpress no pudo importar el producto."));
        setNotice("AliExpress importado: "+result.variants+" variantes. Abre el borrador y comprueba el SKU, las variantes y el coste antes de publicar.");
        setImportedProductId(String(result.id||""));
        await onReload();
      }else if(selected==="printful"){
        let id=input;
        if(input.startsWith("https://")){
          const u=new URL(input);
          if(!(u.hostname==="printful.com"||u.hostname.endsWith(".printful.com")))throw new Error("Este enlace no pertenece a Printful.");
          const match=u.pathname.match(/\/(?:store\/)?products\/(\d{1,20})(?:\/|$)/);
          if(!match)throw new Error("Pega un enlace de producto sincronizado de tu tienda Printful o su ID.");
          id=match[1];
        }
        if(!/^\d{1,20}$/.test(id))throw new Error("Introduce un ID de producto sincronizado de Printful.");
        const response=await fetch("/api/admin/printful/sync-product",{method:"POST",
          credentials:"same-origin",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({syncProductId:id})});
        const result=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(String(result.error||"Printful no pudo importar el producto."));
        setNotice("Printful importado: "+result.variantCount+" variantes sincronizadas. Revisa la ficha antes de publicar.");
        setImportedProductId(String(result.product?.id||result.productId||result.id||""));
        await onReload();
      }else if(selected==="cj"){
        const previewRes=await fetch("/api/admin/catalog/import-url/preview",{
          method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({url:input,maxProducts:1}),
        });
        const preview=await previewRes.json().catch(()=>({}));
        if(!previewRes.ok)throw new Error(String(preview.error||"CJ no devolvió un producto."));
        const product=Array.isArray(preview.products)?preview.products[0]:null;
        if(!product||!product.supplierProductId||!Array.isArray(product.variants)||!product.variants.length)
          throw new Error("CJ no devolvió todas las variantes originales. No se creará un borrador incompleto.");
        const importRes=await fetch("/api/admin/catalog/import-url/product",{
          method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({product}),
        });
        const imported=await importRes.json().catch(()=>({}));
        if(!importRes.ok||!imported.product?.id)throw new Error(String(imported.error||"No se pudo guardar el producto de CJ."));
        setNotice(imported.skipped?"El artículo CJ ya existe; revisa el producto vinculado.":
          "CJ importado: "+product.variants.length+" variantes. Comprueba cada SKU, coste y transporte antes de publicar.");
        setImportedProductId(String(imported.product.id));
        await onReload();
      }else{
        await onImportProductByUrl(input);
        setNotice("Abre la importación detallada para verificar si se creó el borrador.");
      }
    }catch(error:any){
      setImportError(String(error?.message||"No se pudo completar la importación."));
    }finally{setImporting(false);}
  };

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
    <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
      <div><h3 className="font-bold">Importar y vincular producto</h3>
        <p className="text-xs text-muted-foreground">Un solo campo: enlaces de AliExpress, CJ y productos sincronizados de Printful. También puedes elegir el proveedor y pegar su ID.</p></div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={sourceUrl} onChange={event=>setSourceUrl(event.target.value)} aria-label="Enlace o ID del producto"
          placeholder="Pega enlace del producto o ID" className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-3 text-sm"/>
        <button type="button" onClick={()=>void importProduct()} disabled={importing||!sourceUrl.trim()}
          className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
          {importing?"Importando…":"Importar y vincular"}
        </button>
      </div>
      {provider==="printful"&&<div className="space-y-2">
        <button type="button" onClick={()=>void loadPrintfulCatalog()} disabled={catalogBusy}
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold disabled:opacity-50">
          {catalogBusy?"Consultando catálogo…":"Buscar en mis productos de Printful"}
        </button>
        {printfulCatalog.length>0&&<div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border bg-background p-2">
          {printfulCatalog.map(item=><button type="button" key={item.id} onClick={()=>setSourceUrl(item.id)}
            className={"block w-full rounded-lg border px-3 py-2 text-left text-xs "+(sourceUrl===item.id?"border-primary bg-primary/10":"border-transparent hover:bg-muted")}>
            <span className="font-bold">{item.name}</span> · {item.variants} variantes · ID {item.id}
          </button>)}
        </div>}
      </div>}
      {notice&&<p role="status" className="text-sm text-emerald-700">{notice}</p>}
      {importedProductId&&<button type="button" onClick={()=>onOpenProduct(importedProductId)}
        className="w-fit rounded-lg border border-primary px-4 py-2 text-sm font-bold text-primary">
        Siguiente: revisar variantes y publicar <ArrowRight className="ml-1 inline h-4 w-4"/>
      </button>}
      {importError&&<p role="alert" className="text-sm text-red-700">{importError}</p>}
      <p className="text-xs text-muted-foreground">Se guarda para revisión. Vincular no activa automáticamente pagos ni compras.</p>
    </div>
    <UniversalSupplierBudget/>
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
      {provider==="aliexpress"&&<div className="rounded-lg border border-border bg-background p-3 space-y-2">
        <h4 className="font-bold text-sm">Verificar pedidos en AliExpress</h4>
        <p className="text-xs text-muted-foreground">Comprueba un pedido existente por API OAuth. Consulta de solo lectura, no crea ni paga pedidos.</p>
        <div className="flex flex-wrap gap-2">
          <input value={aliOrderId} onChange={e=>setAliOrderId(e.target.value)}
            aria-label="ID de pedido AliExpress" placeholder="ID del pedido en AliExpress"
            className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm"/>
          <button type="button" disabled={aliOrderBusy||!aliOrderId.trim()}
            onClick={()=>void checkAliOrder()} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50">
            {aliOrderBusy?"Consultando…":"Verificar pedido"}
          </button>
        </div>
        {aliOrderError&&<p role="alert" className="text-xs text-red-700">{aliOrderError}</p>}
        {aliOrderResult&&<p role="status" className="text-xs">Pedido {aliOrderResult.orderId} · Estado: {aliOrderResult.status} · Pago proveedor: {aliOrderResult.paymentStatus} · Sin cargos realizados.</p>}
      </div>}
      {provider==="aliexpress"&&<details className="rounded-lg border border-border bg-background p-3"><summary className="cursor-pointer text-sm font-semibold">Estado de conexión, catálogo y opciones avanzadas de AliExpress</summary><div className="mt-3"><AdminAliExpressConnection/></div></details>}
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
    <div className="space-y-3 rounded-xl border border-border p-4" aria-label="Estado real de compras y pagos automáticos">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="font-bold">Estado real de compras y pagos</h3>
          <p className="text-xs text-muted-foreground">Diagnóstico del servidor, no una autorización para cargar dinero.</p></div>
        <button type="button" onClick={()=>void checkActivation()} disabled={activationLoading}
          className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50">
          {activationLoading?"Comprobando…":"Verificar automatización"}
        </button>
      </div>
      {activationError&&<p role="alert" className="text-sm text-red-700">{activationError}</p>}
      {activationStatus&&<div className="grid gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-lg border p-3"><strong className="block text-sm">CJdropshipping</strong>
          <p>Crear pedidos: {activationStatus.cj.orderCreationRequested?"Solicitado":"Desactivado"}</p>
          <p>Pagos: {activationStatus.cj.supplierPaymentRequested?"Solicitados":"Desactivados"}</p>
          <p>Autopilot: {activationStatus.cj.liveRunnerRequested?"Solicitado":"Desactivado"}</p>
          <p>Mandato: {activationStatus.cj.validMerchantMandate?"Vigente":"No validado"}</p>
          <p className="font-semibold">{activationStatus.cj.fullyAuthorized?"Autorización habilitada, sujeta a comprobaciones por pedido":"Compras desatendidas no autorizadas"}</p>
          <p className="mt-1 text-muted-foreground">Requiere mandato y pedido real supervisado.</p>
        </div>
        <div className="rounded-lg border p-3"><strong className="block text-sm">Printful</strong>
          <p>Confirmación: {activationStatus.printful.confirmationRequested?"Solicitada":"Desactivada"}</p>
          <p>Límites: {activationStatus.printful.limitsConfigured?"Configurados":"Incompletos"}</p>
          <p className="mt-1 text-muted-foreground">Solo ante pago Stripe verificado, cotización y margen válidos.</p>
        </div>
        <div className="rounded-lg border p-3"><strong className="block text-sm">AliExpress</strong>
          <p>Compras: No implementadas</p><p>Pagos: No implementados</p>
          <p className="mt-1 text-muted-foreground">La conexión de catálogo no permite comprar.</p>
        </div>
      </div>}
    </div>
    <p className="text-xs text-muted-foreground">Importar, publicar y crear pedidos son operaciones diferentes. Solo las API verificadas pueden enviar pedidos reales; publicar una ficha no autoriza compras. No hay pagos automáticos entre proveedores sin autorizaciones y controles individuales.</p>
  </section>;
}
