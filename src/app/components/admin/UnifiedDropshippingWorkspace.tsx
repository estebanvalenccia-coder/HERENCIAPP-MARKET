import {useState} from "react";
import {ArrowRight, Layers3, Link2, PackagePlus, ShoppingBag, Truck, Bot, AlertTriangle} from "lucide-react";
import {AdminAliExpressConnection} from "./AdminAliExpressConnection";

type Provider="aliexpress"|"cj"|"printful"|"manual";
type Props={
  onNavigate:(id:string)=>void;
  onAdvanced:()=>void;
  supplierConnectorStatuses:Array<{type:string;state:string;automaticOrders:boolean}>;
  importedCount:number;
  pendingOrders:number;
};
const PROVIDERS:Array<{id:Provider;name:string;detail:string;target:string}>= [
  {id:"aliexpress",name:"AliExpress",detail:"API autorizada · importar por enlace",target:"supplier-import"},
  {id:"cj",name:"CJdropshipping",detail:"API · catálogo y cotizaciones",target:"supplier-catalog"},
  {id:"printful",name:"Printful",detail:"Impresión bajo demanda",target:"supplier-printful"},
  {id:"manual",name:"Entrada manual / CSV",detail:"Proveedores sin API",target:"supplier-file-import"},
];
const FLOW=[
  {step:"1",name:"Conectar proveedor",detail:"Comprueba cada API y sus permisos",target:"supplier-registered",Icon:Link2},
  {step:"2",name:"Importar producto",detail:"Pega un enlace o importa del catálogo",target:"supplier-import",Icon:PackagePlus},
  {step:"3",name:"Revisar y publicar",detail:"Variantes, envío, impuestos y margen",target:"supplier-catalog",Icon:Layers3},
  {step:"4",name:"Recibir venta",detail:"Pedido del cliente y pago confirmado",target:"supplier-orders",Icon:ShoppingBag},
  {step:"5",name:"Enviar al proveedor",detail:"Proveedor correcto, pedido y seguimiento",target:"supplier-orders",Icon:Truck},
];
export function UnifiedDropshippingWorkspace({onNavigate,onAdvanced,supplierConnectorStatuses,importedCount,pendingOrders}:Props){
  const [provider,setProvider]=useState<Provider>("aliexpress");
  const current=PROVIDERS.find(item=>item.id===provider)!;
  const status=supplierConnectorStatuses.find(s=>String(s.type||"").toLowerCase()===provider);
  const isVerified=status?.state==="ready";
  const isConfigured=status?.state==="configured";
  const navigate=(target:string)=>{onAdvanced();onNavigate(target);};
  return <section aria-label="Motor unificado de dropshipping" className="space-y-5 rounded-3xl border border-border bg-card p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Un sistema · múltiples proveedores</p>
        <h2 className="mt-1 text-2xl font-bold">Motor de Dropshipping</h2>
        <p className="mt-1 text-sm text-muted-foreground">Elige el proveedor una vez. Los productos y pedidos se gestionan juntos, sin crear un motor distinto para cada API.</p>
      </div>
      <button type="button" onClick={()=>navigate("supplier-orders")} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold">Cola de pedidos · {pendingOrders}</button>
    </div>
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" role="group" aria-label="Elegir proveedor">
      {PROVIDERS.map(item=><button key={item.id} type="button" aria-pressed={provider===item.id}
        onClick={()=>setProvider(item.id)}
        className={"rounded-xl border p-3 text-left transition-colors "+(provider===item.id?"border-primary bg-primary/10 ring-1 ring-primary":"border-border bg-background hover:bg-muted/40")}>
        <span className="block font-bold text-sm">{item.name}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span>
      </button>)}
    </div>
    <div className="rounded-2xl border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">{current.name}</h3>
          <p className="text-xs text-muted-foreground">
            {provider==="aliexpress"?"El estado de conexión se comprueba abajo en tiempo real.":
            provider==="manual"?"Importación de CSV/JSON/XML, sin automatización de compra por API.":
            isVerified?"Conexión API verificada.":isConfigured?"Configuración detectada; faltan pruebas de operación.":"Revisa los permisos y la conexión del proveedor."}
          </p>
        </div>
        {provider!=="aliexpress"&&<button type="button" onClick={()=>navigate(current.target)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
          {provider==="manual"?"Importar archivo":"Abrir "+current.name}<ArrowRight className="h-4 w-4"/>
        </button>}
      </div>
      {provider==="aliexpress"&&<div className="mt-4"><AdminAliExpressConnection/></div>}
    </div>
    <div>
      <h3 className="font-bold">Un solo proceso para todos</h3>
      <div className="mt-3 grid gap-2 md:grid-cols-5">
        {FLOW.map(item=><button type="button" key={item.step} onClick={()=>navigate(item.target)}
          className="rounded-xl border border-border bg-background p-3 text-left hover:bg-muted/40">
          <span className="flex items-center gap-2 text-xs font-bold text-primary"><item.Icon className="h-4 w-4"/>Paso {item.step}</span>
          <span className="mt-2 block text-sm font-bold">{item.name}</span>
          <span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span>
        </button>)}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xs text-muted-foreground">{importedCount} productos importados en Herencia Market · Una cola común de pedidos.</span>
      <button type="button" onClick={()=>navigate("supplier-operations")} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold">
        <AlertTriangle className="h-4 w-4"/> Incidencias
      </button>
      <button type="button" onClick={()=>navigate("supplier-cj-automation")} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold">
        <Bot className="h-4 w-4"/> Automatizaciones avanzadas
      </button>
    </div>
    <p className="text-xs text-muted-foreground">Las API funcionan por separado detrás del motor común. La compra automática solo se habilita por proveedor cuando pagos, costes, autorizaciones y protección contra duplicados estén verificados.</p>
  </section>;
}
