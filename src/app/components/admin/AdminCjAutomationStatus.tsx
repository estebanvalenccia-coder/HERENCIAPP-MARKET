import { useEffect, useState } from "react";
import { backendApi } from "../../lib/backendStorage";

type Readiness = Awaited<ReturnType<typeof backendApi.getCjAutomationReadiness>>;
type Sweep = Awaited<ReturnType<typeof backendApi.synchronizeCjTrackingSafely>>;

/**
 * Admin-only operational visibility. No frontend controls can create a CJ
 * order, debit supplier balance or switch automatic purchase flags here.
 */
export function AdminCjAutomationStatus(){
  const [data,setData]=useState<Readiness|null>(null);
  const [sweep,setSweep]=useState<Sweep|null>(null);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const reload=async()=>{
    const value=await backendApi.getCjAutomationReadiness();
    setData(value);
  };
  useEffect(()=>{
    let mounted=true;
    backendApi.getCjAutomationReadiness().then(v=>{if(mounted)setData(v);})
      .catch(e=>{if(mounted)setError(String(e?.message||"CJ no devolvió estado."));});
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
      <h3 className="font-semibold">Comprobación de la cola CJ</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Las razones siguientes explican qué falta para automatizar cada pedido.
        Ninguna verificación mostrada autoriza por sí sola a gastar el saldo de CJ.
      </p>
      {!data?.previews.length&&<p className="mt-3 text-sm text-muted-foreground">No hay pedidos CJ preparados para revisar.</p>}
      <div className="mt-3 max-h-80 space-y-3 overflow-auto">
        {data?.previews.map(item=><div key={item.fulfillmentId} className="rounded-xl border border-border p-3">
          <p className="text-sm font-bold">Pedido {item.orderId} · {item.status}</p>
          {item.blockers.length>0&&<ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {item.blockers.slice(0,6).map((reason,index)=><li key={index}>{reason}</li>)}
          </ul>}
        </div>)}
      </div>
    </div>
  </section>;
}
