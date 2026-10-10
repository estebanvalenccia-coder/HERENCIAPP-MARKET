import { useEffect, useState } from "react";
import { backendApi } from "../../lib/backendStorage";
import { offlinePricingSuggestion } from "../../lib/supplierOfflineIntelligence.js";
import { EU_COUNTRIES } from "../../lib/supplierMarketplace.js";

type Overview=Awaited<ReturnType<typeof backendApi.getOfflineSupplierOverview>>;
type Case=Awaited<ReturnType<typeof backendApi.listSupplierAftercareCases>>["cases"][number];
const money=(v:number)=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(v);
const REASONS=[
  ["delivery_delay","Retraso de envío"],["wrong_variant","Variante incorrecta"],
  ["damaged","Producto dañado"],["lost","Pedido perdido"],
  ["return_request","Solicitud de devolución"],["refund_request","Solicitud de reembolso"],
  ["supplier_error","Error del proveedor"]
];
const STATES:Record<string,string>={
  open:"Abierta",in_review:"En revisión",awaiting_supplier:"Esperando proveedor",
  resolved:"Resuelta",closed:"Cerrada"
};
/**
 * Operating console: supplier identity evidence, offline margin planning and
 * aftercare cases. NO Stripe/provider payment or fulfillment actions here.
 */
export function AdminSupplierOperations({
  suppliers=[],onOpenProduct,
}:{
  suppliers?:any[];onOpenProduct:(productId:string)=>void;
}) {
  const [overview,setOverview]=useState<Overview|null>(null);
  const [links,setLinks]=useState<string[]>([]);
  const [consent,setConsent]=useState<Record<string,boolean>>({});
  const [cases,setCases]=useState<Case[]>([]);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [orderId,setOrderId]=useState("");
  const [supplierId,setSupplierId]=useState("");
  const [reason,setReason]=useState("delivery_delay");
  const [caseNote,setCaseNote]=useState("");
  const [destination,setDestination]=useState("ES");
  const [postalCode,setPostalCode]=useState("08032");
  const [variantId,setVariantId]=useState("");
  const [productCost,setProductCost]=useState("10");
  const [shippingCost,setShippingCost]=useState("5");
  const [otherCosts,setOtherCosts]=useState("1");
  const [vat,setVat]=useState("21");
  const [margin,setMargin]=useState("30");
  const [pricing,setPricing]=useState<ReturnType<typeof offlinePricingSuggestion>|null>(null);
  const [pricingError,setPricingError]=useState("");

  const reload=async()=>{
    const [o,matching,incidents]=await Promise.all([
      backendApi.getOfflineSupplierOverview(),
      backendApi.getSupplierProductLinks(),
      backendApi.listSupplierAftercareCases(),
    ]);
    setOverview(o);setLinks(matching.links.map(link=>link.id));setCases(incidents.cases);
  };
  useEffect(()=>{
    let active=true;
    Promise.all([backendApi.getOfflineSupplierOverview(),
      backendApi.getSupplierProductLinks(),backendApi.listSupplierAftercareCases()
    ]).then(([o,m,c])=>{
      if(active){setOverview(o);setLinks(m.links.map(x=>x.id));setCases(c.cases);}
    }).catch(e=>{if(active)setError(String(e?.message||"No se pudieron cargar los indicadores."));});
    return ()=>{active=false;};
  },[]);
  const link=async(leftProductId:string,rightProductId:string)=>{
    const id=[leftProductId,rightProductId].sort().join("|");
    if(!consent[id]||busy)return;
    setBusy("link:"+id);setError("");
    try{
      await backendApi.confirmSupplierProductLink(leftProductId,rightProductId);
      await reload();
      setConsent({});
    }catch(e:any){setError(String(e?.message||"No se pudieron asociar los productos."));}
    finally{setBusy("");}
  };
  const createCase=async()=>{
    if(busy)return;
    setBusy("newCase");setError("");
    try{
      await backendApi.createSupplierAftercareCase({orderId:orderId.trim(),supplierId,reason,note:caseNote});
      setCaseNote("");
      await reload();
    }catch(e:any){setError(String(e?.message||"No se pudo registrar la incidencia."));}
    finally{setBusy("");}
  };
  const updateCase=async(item:Case,toStatus:string)=>{
    if(busy)return;
    setBusy("case:"+item.id);setError("");
    try{
      await backendApi.transitionSupplierAftercareCase(item.id,item.revision,toStatus);
      await reload();
    }catch(e:any){setError(String(e?.message||"La incidencia cambió. Actualiza el estado."));}
    finally{setBusy("");}
  };
  const estimate=()=>{
    setPricing(null);setPricingError("");
    try{
      const now=new Date().toISOString();
      setPricing(offlinePricingSuggestion({
        supplierVariantId:variantId.trim(),productCost:Number(productCost),currency:"EUR",
        shippingCost:Number(shippingCost),otherCosts:Number(otherCosts),
        shippingCheckedAt:now,shippingCurrency:"EUR",
        destination,postalCode:postalCode.trim(),vatPercent:Number(vat),
        minimumMarginPercent:Number(margin),
      }));
    }catch(e:any){setPricingError(String(e?.message||"Datos de cálculo incompletos."));}
  };
  return <section id="supplier-operations" className="scroll-mt-24 space-y-5">
    <div className="rounded-2xl border border-border bg-card p-6">
      <p className="text-sm font-bold uppercase tracking-wider text-primary">Operaciones y control de proveedores</p>
      <h2 className="mt-1 text-xl font-black">Central inteligente sin compras automáticas</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Estos datos proceden de catálogos importados y registros internos. No representan
        existencias verificadas por el proveedor ni autorizan cambiar precios en la tienda.
      </p>
      {overview && <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Importados",overview.totalImported],["Borradores",overview.unpublishedDrafts],
          ["Costes sin verificar",overview.supplierCostsUnverified],
          ["Incidencias abiertas",overview.aftercareOpen],
        ].map(([label,value])=><div key={label} className="rounded-xl border border-border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-black">{value}</p>
        </div>)}
      </div>}
      {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      <div className="mt-5 border-t border-border pt-4">
        <h3 className="font-bold">Posibles referencias iguales entre proveedores</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Solo se sugieren coincidencias basadas en GTIN válido o fabricante + MPN.
          No se agrupan por un nombre parecido. Confirmar agrupa la familia comercial,
          <strong> nunca sustituye colores, enchufes ni SKU automáticamente</strong>.
        </p>
        {!overview?.potentialMatches.length && <p className="mt-3 text-sm text-muted-foreground">
          No hay coincidencias fiables pendientes con los datos actuales.
        </p>}
        <div className="mt-3 max-h-72 space-y-3 overflow-auto">
          {overview?.potentialMatches.slice(0,12).map(match=>{
            const key=[match.leftProductId,match.rightProductId].sort().join("|");
            return <div key={key} className="rounded-lg border border-border p-3">
              <p className="text-xs font-semibold">{match.reason==="gtin"?"Mismo GTIN":"Fabricante y modelo (MPN) coincidentes"}</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">
                {match.leftProductId} · {match.rightProductId}
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <button type="button" className="text-xs font-semibold underline"
                  onClick={()=>onOpenProduct(match.leftProductId)}>Ver primera ficha</button>
                <button type="button" className="text-xs font-semibold underline"
                  onClick={()=>onOpenProduct(match.rightProductId)}>Ver segunda ficha</button>
              </div>
              <label className="mt-3 flex items-start gap-2 text-xs">
                <input type="checkbox" checked={Boolean(consent[key])}
                  onChange={e=>setConsent(current=>({...current,[key]:e.target.checked}))}/>
                He revisado ambos productos y confirmo la misma referencia comercial. Las variantes siguen siendo independientes.
              </label>
              <button type="button" disabled={!consent[key]||Boolean(busy)}
                onClick={()=>void link(match.leftProductId,match.rightProductId)}
                className="mt-2 rounded-lg border border-border px-3 py-2 text-xs font-bold disabled:opacity-50">
                {busy==="link:"+key?"Guardando…":"Confirmar misma referencia"}
              </button>
            </div>;
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Familias confirmadas: {overview?.confirmedProductFamilies??"—"}.
          Equivalencia de variantes y cambio automático de proveedor: desactivados.
        </p>
      </div>
    </div>

    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-lg font-bold">Simulador de precio recomendado por variante</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Cálculo orientativo con valores que introduces manualmente. Indica el IVA del destino
        y los portes presupuestados. No valida fiscalidad, moneda, stock ni conecta con el cobro.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["ID variante","text",variantId,setVariantId],
          ["Coste producto (€)","number",productCost,setProductCost],
          ["Envío (€)","number",shippingCost,setShippingCost],
          ["Otros costes (€)","number",otherCosts,setOtherCosts],
          ["Código postal","text",postalCode,setPostalCode],
          ["IVA previsto (%)","number",vat,setVat],
          ["Margen neto objetivo (%)","number",margin,setMargin],
        ].map(([label,type,value,setter])=><label key={label as string} className="text-xs font-semibold">
          {label as string}
          <input type={type as string} min={type==="number"?"0":undefined}
            step={type==="number"?"0.01":undefined} value={value as string}
            onChange={e=>{(setter as (v:string)=>void)(e.target.value);setPricing(null);}}
            className="mt-1 block w-full rounded-lg border border-border bg-background p-2.5"/>
        </label>)}
        <label className="text-xs font-semibold">Destino UE
          <select value={destination} onChange={e=>{setDestination(e.target.value);setPricing(null);}}
            className="mt-1 block w-full rounded-lg border border-border bg-background p-2.5">
            {EU_COUNTRIES.map(c=><option value={c} key={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <button type="button" onClick={estimate} className="mt-4 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
        Calcular precio orientativo
      </button>
      {pricingError&&<p className="mt-2 text-sm text-red-800">{pricingError}</p>}
      {pricing&&<div role="status" className="mt-3 rounded-xl border border-border bg-muted/20 p-4 text-sm">
        <p>Precio recomendado (IVA incluido): <strong>{money(pricing.suggestedRetailEur)}</strong></p>
        <p>Beneficio neto estimado: <strong>{money(pricing.expectedProfitEur)}</strong></p>
        <p>Margen neto estimado: <strong>{pricing.expectedMarginPercent}%</strong></p>
        <p className="mt-2 text-xs text-amber-800">Simulación no verificada. No publica ni modifica precios reales.</p>
      </div>}
    </div>

    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-lg font-bold">Incidencias de proveedores y devoluciones</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Registra retrasos, variantes incorrectas, productos dañados y solicitudes de devolución
        o reembolso. Este panel <strong>no envía pedidos, no devuelve dinero y no escribe en Stripe</strong>.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-semibold">ID de pedido existente
          <input value={orderId} onChange={e=>setOrderId(e.target.value.slice(0,110))}
            placeholder="ID del pedido de Herencia"
            className="mt-1 block w-full rounded-lg border border-border bg-background p-2.5"/>
        </label>
        <label className="text-xs font-semibold">Proveedor
          <select value={supplierId} onChange={e=>setSupplierId(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-background p-2.5">
            <option value="">Seleccionar proveedor</option>
            {suppliers.filter(s=>s.active!==false).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold">Motivo
          <select value={reason} onChange={e=>setReason(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-border bg-background p-2.5">
            {REASONS.map(([v,label])=><option key={v} value={v}>{label}</option>)}
          </select>
        </label>
      </div>
      <label className="mt-3 block text-xs font-semibold">Nota interna (no se envía automáticamente)
        <textarea rows={2} maxLength={450} value={caseNote}
          onChange={e=>setCaseNote(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-border bg-background p-2.5"/>
      </label>
      <button type="button" disabled={Boolean(busy)||!orderId.trim()||!supplierId}
        onClick={()=>void createCase()}
        className="mt-3 rounded-lg border border-border px-4 py-2.5 text-sm font-bold disabled:opacity-50">
        {busy==="newCase"?"Guardando…":"Registrar incidencia"}
      </button>
      <div className="mt-4 max-h-96 space-y-3 overflow-auto">
        {!cases.length&&<p className="text-sm text-muted-foreground">No hay incidencias registradas todavía.</p>}
        {cases.map(item=><div key={item.id} className="rounded-xl border border-border bg-muted/20 p-3">
          <p className="text-sm font-bold">{REASONS.find(([value])=>value===item.reason)?.[1]||item.reason}
            {" · "}{STATES[item.status]||item.status}</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">Pedido {item.orderId} · Proveedor {item.supplierId} · Revisiones {item.revision}</p>
          {item.note&&<p className="mt-2 text-xs">{item.note}</p>}
          {item.instructions?.steps?.length>0&&<p className="mt-2 text-xs text-muted-foreground">
            Siguiente revisión: {item.instructions.steps.join(" · ")}
          </p>}
          {!!item.instructions?.nextStatuses?.length&&<div className="mt-3 flex flex-wrap gap-2">
            {item.instructions.nextStatuses.map(status=><button key={status} type="button"
              disabled={Boolean(busy)} onClick={()=>void updateCase(item,status)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold disabled:opacity-50">
              {STATES[status]||status}
            </button>)}
          </div>}
        </div>)}
      </div>
    </div>
  </section>;
}
