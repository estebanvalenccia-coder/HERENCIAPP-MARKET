import {useEffect,useState} from "react";
type ProviderKey="cj"|"printful"|"aliexpress";
type Budget={dailyMaxEur:number;perOrderMaxEur:number|null;minMarginPercent:number|null;
  providers:Record<ProviderKey,boolean>;paymentsEnabled:false;autoPurchaseEnabled:false;sharedLedgerActive:false};
const API="/api/admin/suppliers/universal-budget";
export function UniversalSupplierBudget(){
  const [daily,setDaily]=useState("100");
  const [perOrder,setPerOrder]=useState("");
  const [margin,setMargin]=useState("");
  const [providers,setProviders]=useState<Record<ProviderKey,boolean>>({cj:true,printful:true,aliexpress:true});
  const [status,setStatus]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [usage,setUsage]=useState<{remainingEur:number;committedEur:number;reservedAndUncertainEur:number;day:string}|null>(null);
  useEffect(()=>{
    let active=true;
    fetch(API,{credentials:"same-origin",cache:"no-store"}).then(async r=>{
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw Error(data.error||"No se pudo consultar el presupuesto");
      if(!active)return;
      const p:Budget=data.policy;
      setUsage(data.ledger||null);
      setDaily(String(p.dailyMaxEur??100));
      setPerOrder(p.perOrderMaxEur==null?"":String(p.perOrderMaxEur));
      setMargin(p.minMarginPercent==null?"":String(p.minMarginPercent));
      setProviders(p.providers);
      setLoaded(true);
    }).catch(e=>{if(active)setError(String(e.message||"No se pudo cargar el presupuesto"));});
    return()=>{active=false;};
  },[]);
  const save=async()=>{
    setBusy(true);setError("");setStatus("");
    try{
      const response=await fetch(API,{method:"PUT",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({dailyMaxEur:Number(daily),perOrderMaxEur:perOrder===""?null:Number(perOrder),
          minMarginPercent:margin===""?null:Number(margin),providers})});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(String(data.error||"No se pudieron guardar los límites."));
      setStatus("Límites guardados para el motor multiproveedor. No se han autorizado cargos automáticos.");
    }catch(e:any){setError(String(e?.message||"No se pudo guardar."));}
    finally{setBusy(false);}
  };
  return <section aria-label="Presupuesto universal de dropshipping" className="space-y-3 rounded-2xl border border-border bg-card p-4">
    <div>
      <h3 className="text-lg font-bold">Presupuesto y automatización universal</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Un único presupuesto para configurar el motor, independiente de CJ, Printful y AliExpress.
        La configuración no ejecuta compras hasta disponer de autorizaciones por proveedor
        y un contador transaccional de gasto compartido.
      </p>
    </div>
    {usage&&<p className="rounded-lg border border-border bg-background p-3 text-xs">Consumo universal de hoy ({usage.day}): gastado {usage.committedEur.toFixed(2)} € · reservado o incierto {usage.reservedAndUncertainEur.toFixed(2)} € · disponible {usage.remainingEur.toFixed(2)} €. No incluye compras de integraciones que aún no utilizan este contador.</p>}
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-xs font-semibold">Límite total diario (€)
        <input type="number" min="0.01" max="10000" step="0.01" value={daily}
          onChange={e=>setDaily(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2.5"/>
      </label>
      <label className="text-xs font-semibold">Máximo por pedido (€)
        <input type="number" min="0.01" step="0.01" value={perOrder} placeholder="Define un máximo"
          onChange={e=>setPerOrder(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2.5"/>
      </label>
      <label className="text-xs font-semibold">Margen neto mínimo (%)
        <input type="number" min="10" max="70" step="0.1" value={margin} placeholder="Entre 10 y 70"
          onChange={e=>setMargin(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background p-2.5"/>
      </label>
    </div>
    <div className="flex flex-wrap gap-4" role="group" aria-label="Proveedores incluidos en la configuración">
      {(["cj","printful","aliexpress"] as const).map(key=><label key={key} className="flex items-center gap-2 text-xs font-medium">
        <input type="checkbox" checked={providers[key]}
          onChange={e=>setProviders(old=>({...old,[key]:e.target.checked}))}/>
        {key==="cj"?"CJdropshipping":key==="printful"?"Printful":"AliExpress"}
      </label>)}
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={!loaded||busy||!perOrder||!margin} onClick={()=>void save()}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
        {busy?"Guardando…":"Guardar presupuesto universal"}
      </button>
      <span className="text-xs text-muted-foreground">No autoriza gastos ni modifica los presupuestos específicos de proveedores hasta que estén integrados.</span>
    </div>
    {status&&<p role="status" className="text-sm text-emerald-700">{status}</p>}
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  </section>;
}
