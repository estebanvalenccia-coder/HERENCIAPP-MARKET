import { useEffect, useState } from "react";
import { backendApi } from "../../lib/backendStorage";

type Readiness = Awaited<ReturnType<typeof backendApi.getCjAutomationReadiness>>;
type Sweep = Awaited<ReturnType<typeof backendApi.synchronizeCjTrackingSafely>>;
type Guardrails = Awaited<ReturnType<typeof backendApi.getCjAutopilotGuardrails>>;
type Simulation = Awaited<ReturnType<typeof backendApi.simulateCjAutopilotPreflight>>;

/**
 * Admin-only operational visibility. No frontend controls can create a CJ
 * order, debit supplier balance or switch automatic purchase flags here.
 */
export function AdminCjAutomationStatus(){
  const [data,setData]=useState<Readiness|null>(null);
  const [sweep,setSweep]=useState<Sweep|null>(null);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [guardrails,setGuardrails]=useState<Guardrails|null>(null);
  const [perOrder,setPerOrder]=useState("");
  const [perDay,setPerDay]=useState("");
  const [minMargin,setMinMargin]=useState("");
  const [allowedSupplierIds,setAllowedSupplierIds]=useState<string[]>([]);
  const [acknowledgeSimulation,setAcknowledgeSimulation]=useState(false);
  const [simulations,setSimulations]=useState<Record<string,Simulation>>({});
  const reload=async()=>{
    const [value,limits]=await Promise.all([
      backendApi.getCjAutomationReadiness(),
      backendApi.getCjAutopilotGuardrails(),
    ]);
    setData(value);
    setGuardrails(limits);
  };
  useEffect(()=>{
    let mounted=true;
    Promise.all([backendApi.getCjAutomationReadiness(),backendApi.getCjAutopilotGuardrails()])
      .then(([v,g])=>{
        if(!mounted)return;
        setData(v);setGuardrails(g);
        if(g.policy.configured){
          setPerOrder(String(g.policy.perOrderMaxEur??""));
          setPerDay(String(g.policy.dailyMaxEur??""));
          setMinMargin(String(g.policy.minMarginPercent??""));
          setAllowedSupplierIds(g.policy.allowedSupplierIds);
        }
      }).catch(e=>{if(mounted)setError(String(e?.message||"No se pudo consultar la configuración CJ."));});
    return()=>{mounted=false;};
  },[]);
  const sync=async()=>{
    if(busy)return;
    setBusy("sync");setError("");setSweep(null);
    try{
      const result=await backendApi.synchronizeCjTrackingSafely();
      setSweep(result);
      await reload();
    }catch(e:any){setError(String(e?.message||"No se pudo consultar el seguimiento CJ."));}
    finally{setBusy("");}
  };
  const saveLimits=async()=>{
    if(busy||!acknowledgeSimulation)return;
    setBusy("guardrails");setError("");
    try{
      await backendApi.saveCjAutopilotGuardrails({
        perOrderMaxEur:Number(perOrder),dailyMaxEur:Number(perDay),
        minMarginPercent:Number(minMargin),allowedSupplierIds,country:"ES",quantity:1,
      });
      setAcknowledgeSimulation(false);
      await reload();
    }catch(e:any){setError(String(e?.message||"No se pudieron guardar los límites."));}
    finally{setBusy("");}
  };
  const simulate=async(fulfillmentId:string)=>{
    if(busy)return;
    setBusy("simulate:"+fulfillmentId);setError("");
    try{
      const result=await backendApi.simulateCjAutopilotPreflight(fulfillmentId);
      setSimulations(current=>({...current,[fulfillmentId]:result}));
    }catch(e:any){setError(String(e?.message||"La simulación no pudo validar el pedido."));}
    finally{setBusy("");}
  };
  return <section id="supplier-cj-automation" className="scroll-mt-24 rounded-2xl border border-border bg-card p-6">
    <p className="text-sm font-bold uppercase tracking-wide text-primary">CJdropshipping · Automatización segura</p>
    <h2 className="mt-1 text-xl font-black">Centro de control de pedidos CJ</h2>
    <p className="mt-2 text-sm text-muted-foreground">
      La conexión CJ existente puede cotizar e inspeccionar pedidos. Los envíos
      comprados y confirmados pueden sincronizar tracking sin gastos adicionales.
      La creación de pedidos reales y el pago al proveedor mantienen autorizaciones independientes.
    </p>
    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      {[
        ["Pedidos en cola",data?.counts.queued],
        ["Pendientes de revisión",data?.counts.needsManualReview],
        ["Creaciones inciertas",data?.counts.creationUnknown],
        ["Pagos inciertos",data?.counts.paymentUnknown],
      ].map(([label,n])=><div key={String(label)} className="rounded-xl border border-border bg-muted/20 p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-black">{n ?? "—"}</p>
      </div>)}
    </div>
    <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4 text-sm">
      <p><strong>Conexión CJ:</strong> {data?.configured?"Clave detectada en Railway":"No comprobada o no configurada"}</p>
      <p className="mt-1"><strong>Sincronización de seguimiento:</strong> {data?.trackingReadOnlyEnabled
        ?"Activa, de solo lectura":"Desactivada"}</p>
      <p className="mt-1"><strong>Compras totalmente automáticas:</strong> desactivadas; requieren reglas de gasto aprobadas y pruebas reales.</p>
      <p className="mt-1"><strong>Pago automático a CJ:</strong> desactivado; el pago actual exige una segunda autorización.</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Una clave detectada no garantiza una conexión válida en este momento.
        Las operaciones ambiguas deben conciliarse antes de repetir cualquier paso.
      </p>
    </div>
    <button type="button" onClick={()=>void sync()} disabled={!data?.configured || Boolean(busy)}
      className="mt-4 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
      {busy?"Consultando pedidos…":"Actualizar seguimiento CJ (sin comprar)"}
    </button>
    {sweep&&<p role="status" className="mt-3 text-sm">
      Consultados: <strong>{sweep.checked}</strong> · Actualizaciones: <strong>{sweep.changed}</strong> ·
      Incidencias a revisar: <strong>{sweep.errors.length}</strong>. No se han efectuado compras ni pagos.
    </p>}
    {error&&<p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    <div className="mt-5 border-t border-border pt-4">
      <h3 className="text-lg font-bold">Límites de seguridad del autopiloto CJ</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Prepara tu presupuesto antes de automatizar compras. Guardarlo NO activa
        compras ni pagos: los importes siguen siendo límites de simulación hasta
        una autorización financiera independiente y pruebas reales controladas.
        No hemos elegido ninguna cifra por ti.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {[
          {label:"Máximo por pedido (€)",value:perOrder,set:setPerOrder},
          {label:"Presupuesto diario (€)",value:perDay,set:setPerDay},
          {label:"Margen neto mínimo (%)",value:minMargin,set:setMinMargin},
        ].map(field=><label key={field.label} className="text-xs font-semibold">
          {field.label}
          <input type="number" inputMode="decimal" min="0" step="0.01"
            value={field.value} onChange={e=>{
              field.set(e.target.value);setAcknowledgeSimulation(false);
            }}
            placeholder="Sin definir"
            className="mt-1 block w-full rounded-lg border border-border bg-background p-2.5"/>
        </label>)}
      </div>
      <p className="mt-3 text-xs font-semibold">Proveedores CJ a los que se podrían aplicar las reglas</p>
      <div className="mt-2 flex flex-wrap gap-4">
        {guardrails?.suppliers.filter(s=>!s.sandbox).map(s=><label key={s.id}
          className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={allowedSupplierIds.includes(s.id)}
            onChange={e=>{
              setAllowedSupplierIds(old=>e.target.checked?[...old,s.id]:old.filter(id=>id!==s.id));
              setAcknowledgeSimulation(false);
            }}/>
          {s.name}
        </label>)}
        {!guardrails?.suppliers.some(s=>!s.sandbox)&&
          <p className="text-xs text-amber-800">No aparece ningún proveedor CJ real activo para esta tienda.</p>}
      </div>
      <label className="mt-4 flex items-start gap-2 text-xs">
        <input type="checkbox" checked={acknowledgeSimulation} onChange={e=>setAcknowledgeSimulation(e.target.checked)}/>
        Confirmo que quiero guardar estos límites únicamente para pruebas.
        Comprendo que esto no autoriza a Herencia a gastar saldo de CJ.
      </label>
      <button type="button" disabled={Boolean(busy)||!acknowledgeSimulation||
        !perOrder||!perDay||!minMargin||!allowedSupplierIds.length}
        onClick={()=>void saveLimits()}
        className="mt-3 rounded-xl border border-primary px-4 py-2.5 text-sm font-bold disabled:opacity-50">
        {busy==="guardrails"?"Guardando…":"Guardar límites en modo simulación"}
      </button>
      <p className="mt-2 text-xs text-muted-foreground">
        Estado: {guardrails?.policy.configured?"Presupuesto de simulación guardado":"Sin presupuesto definido"} ·
        País: España · Unidades: 1 · Compras y pagos automáticos: desactivados.
      </p>
    </div>
    <div className="mt-5 border-t border-border pt-4">
      <h3 className="font-semibold">Comprobación de la cola CJ</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Las razones siguientes explican qué falta para automatizar cada pedido.
        Ninguna verificación mostrada autoriza por sí sola a gastar el saldo de CJ.
      </p>
      {!data?.previews.length&&<p className="mt-3 text-sm text-muted-foreground">No hay pedidos CJ preparados para revisar.</p>}
      <div className="mt-3 max-h-80 space-y-3 overflow-auto">
        {data?.previews.map(item=><div key={item.fulfillmentId} className="rounded-xl border border-border p-3">
          <p className="text-sm font-bold">Pedido {item.orderId} · {item.status}</p>
          <button type="button" disabled={Boolean(busy)||!guardrails?.policy.configured}
            onClick={()=>void simulate(item.fulfillmentId)}
            className="mt-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold disabled:opacity-50">
            {busy==="simulate:"+item.fulfillmentId?"Comprobando Stripe y CJ…":
              "Simular autorización (sin comprar)"}
          </button>
          {simulations[item.fulfillmentId]&&<div className="mt-2 rounded-lg bg-muted/30 p-3 text-xs">
            <p className="font-semibold">{simulations[item.fulfillmentId].eligibleForSupervisedTest?
              "Cumple las comprobaciones técnicas; falta aprobación para gastar.":
              "El pedido NO cumple todas las condiciones."}</p>
            <p className="mt-1">
              Coste proveedor: {simulations[item.fulfillmentId].currentSupplierCostUsd} USD ·
              Margen estimado: {simulations[item.fulfillmentId].estimatedMarginPercent}% ·
              Compras efectuadas: ninguna.
            </p>
            {simulations[item.fulfillmentId].blockers.map((v,i)=><p key={i} className="mt-1">• {v}</p>)}
          </div>}
          {item.blockers.length>0&&<ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {item.blockers.slice(0,6).map((reason,index)=><li key={index}>{reason}</li>)}
          </ul>}
        </div>)}
      </div>
    </div>
  </section>;
}
