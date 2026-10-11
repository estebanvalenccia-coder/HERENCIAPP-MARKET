import {useCallback,useEffect,useMemo,useState} from "react";
import {ArrowRight,CheckCircle2,ClipboardCheck,HelpCircle,
  LockKeyhole,RefreshCw,ShieldCheck,Store,TriangleAlert} from "lucide-react";
import {backendApi} from "../../lib/backendStorage";
import {buildDropshippingLaunchStatus} from "../../lib/dropshippingLaunchStatus.js";
import {AdminCjDistanceSaleCompliance} from "./AdminCjDistanceSaleCompliance";

type Readiness=Awaited<ReturnType<typeof backendApi.getCjAutomationReadiness>>;
type Props={
  suppliers:any[];
  products:any[];
  fulfillments:any[];
  onNavigate:(target:string)=>void;
  onRefresh:()=>void;
  onOpenProduct:(productId:string)=>void;
};
const tone:Record<string,string>={
  configured:"border-emerald-200 bg-emerald-50 text-emerald-900",
  review_required:"border-amber-200 bg-amber-50 text-amber-900",
  action_required:"border-border bg-muted/40 text-foreground",
  blocked:"border-amber-200 bg-amber-50 text-amber-900",
  unknown:"border-border bg-muted/40 text-muted-foreground",
};
const label:Record<string,string>={
  configured:"Configuración detectada",review_required:"Requiere comprobación",
  action_required:"Pendiente",blocked:"No autorizado",unknown:"Sin verificar",
};

/** Visibility and guidance only: never submits an order, payment or mandate. */
export function DropshippingLaunchGuide({suppliers,products,fulfillments,onNavigate,onRefresh,onOpenProduct}:Props){
  const [readiness,setReadiness]=useState<Readiness|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const refresh=useCallback(async()=>{
    setLoading(true);setError("");
    try{setReadiness(await backendApi.getCjAutomationReadiness());}
    catch(e:any){
      setReadiness(null);
      setError(String(e?.message||"No se pudo consultar el estado CJ de producción."));
    }finally{setLoading(false);}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  const state=useMemo(()=>buildDropshippingLaunchStatus({
    suppliers,products,fulfillments,readiness,
  }),[suppliers,products,fulfillments,readiness]);
  const onReload=()=>{
    onRefresh();
    void refresh();
  };
  return <section id="supplier-launch-guide" className="scroll-mt-24 rounded-3xl border border-border bg-card p-5 md:p-7" aria-label="Guía para empezar a vender con CJ">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary"><Store className="h-4 w-4"/>Modo guiado · CJdropshipping</p>
        <h2 className="mt-2 text-2xl font-black">De conectar CJ a tu primera venta</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Avanza en este orden. Los indicadores muestran configuración registrada, no garantizan
          que el proveedor acepte pedidos ni que un pago o envío real funcione.
        </p>
      </div>
      <button type="button" onClick={onReload} disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
        <RefreshCw className={`h-4 w-4 ${loading?"animate-spin":""}`}/>
        {loading?"Comprobando…":"Actualizar diagnóstico"}
      </button>
    </div>
    {error&&<div role="alert" className="mt-4 flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0"/><span>Estado de CJ sin verificar: {error}. No actives compras reales basándote en esta pantalla.</span>
    </div>}
    <ol className="mt-6 grid gap-3 lg:grid-cols-5">
      {state.steps.map((step,index)=><li key={step.id} className="flex">
        <div className="flex w-full flex-col rounded-2xl border border-border bg-background p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black tracking-widest text-muted-foreground">PASO {index+1}</span>
            {step.state==="configured"?<CheckCircle2 className="h-5 w-5 text-emerald-700"/>:
              step.state==="blocked"?<LockKeyhole className="h-5 w-5 text-amber-700"/>:
              step.state==="review_required"?<ClipboardCheck className="h-5 w-5 text-amber-700"/>:
              <HelpCircle className="h-5 w-5 text-muted-foreground"/>}
          </div>
          <h3 className="mt-3 min-h-10 text-sm font-bold">{step.title}</h3>
          <span className={`mt-2 inline-flex w-fit rounded-lg border px-2 py-1 text-[11px] font-bold ${tone[step.state]||tone.unknown}`}>
            {loading?"Comprobando…":label[step.state]||"Sin verificar"}
          </span>
          <p className="mt-3 flex-1 text-xs leading-relaxed text-muted-foreground">{step.detail}</p>
          <button type="button" onClick={()=>onNavigate(step.target)}
            className="mt-4 inline-flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left text-xs font-bold hover:bg-muted">
            Abrir este paso <ArrowRight className="h-4 w-4 shrink-0"/>
          </button>
        </div>
      </li>)}
    </ol>
    <div className="mt-5 rounded-2xl border border-border bg-muted/20 p-4">
      <h3 className="font-bold">Estado de los productos CJ registrados</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {state.activeCjProducts} publicados · {state.linkedCount} vinculados no archivados.
        Los archivados no cuentan como productos preparados para vender.
      </p>
      {state.catalogReview.filter(p=>p.status==="active").length===0?
        <p className="mt-3 text-sm text-muted-foreground">No hay productos CJ publicados que revisar. Importa y prepara un borrador antes de vender.</p>:
        <div className="mt-3 space-y-2">
          {state.catalogReview.filter(p=>p.status==="active").slice(0,6).map(p=>
            <div key={p.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-200 bg-background p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{p.name}</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-amber-900">
                  {p.issues.map((issue:string,i:number)=><li key={i}>{issue}</li>)}
                </ul>
                <AdminCjDistanceSaleCompliance product={products.find(item=>String(item?.id)===p.id)} onSaved={onRefresh}/>
              </div>
              <button type="button" onClick={()=>onOpenProduct(p.id)}
                className="rounded-lg border border-border px-3 py-2 text-xs font-bold hover:bg-muted">
                Revisar ficha
              </button>
            </div>)}
          {state.activeCjProducts>6&&<p className="text-xs text-muted-foreground">Mostrando 6 productos. Consulta Productos para revisar los demás.</p>}
        </div>}
      <p className="mt-3 text-xs text-muted-foreground">
        Este resumen no ejecuta pruebas de cobro. El checkout vuelve a consultar al proveedor
        y bloquea un producto si CJ sigue en Sandbox, falta el transporte o no puede verificar costes o stock.
      </p>
    </div>
    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-muted/25 p-4">
        <h3 className="flex items-center gap-2 font-bold"><ClipboardCheck className="h-5 w-5 text-primary"/>Siguiente acción</h3>
        <p className="mt-2 text-sm">{state.next.detail}</p>
        <button type="button" onClick={()=>onNavigate(state.next.target)}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
          Ir a {state.next.title.toLowerCase()} <ArrowRight className="h-4 w-4"/>
        </button>
      </div>
      <div className="rounded-2xl border border-border p-4">
        <h3 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5 text-primary"/>Seguridad de compras</h3>
        <p className="mt-2 text-sm">El diagnóstico no crea pedidos, no paga proveedores y no activa el piloto automático.</p>
        <p className="mt-2 text-sm font-semibold">
          Compras automáticas CJ: {loading?"Comprobando estado…":
            state.automaticPurchasesVerified?"Autorizadas en el backend (con límites)":"No acreditadas como activas"}
        </p>
        {state.blockers.length>0&&<div className="mt-3 text-xs">
          <p className="font-semibold">Bloqueos detectados:</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
            {state.blockers.slice(0,3).map((b:string,i:number)=><li key={i}>{b}</li>)}
          </ul>
          {state.blockers.length>3&&<p className="mt-1 text-muted-foreground">Y {state.blockers.length-3} más. Consulta CJ automatización.</p>}
        </div>}
        <button type="button" onClick={()=>onNavigate("supplier-cj-automation")}
          className="mt-3 text-xs font-bold text-primary underline underline-offset-4">Abrir diagnóstico detallado</button>
      </div>
    </div>
    <p className="mt-4 text-xs text-muted-foreground">
      Alcance actual de CJ: un artículo, una unidad y destino español compatible.
      Variantes, costes, IVA y entrega deben validarse antes de aceptar una venta.
      AliExpress/DSers, Printful y EPROLO mantienen sus capacidades y limitaciones propias.
    </p>
  </section>;
}
