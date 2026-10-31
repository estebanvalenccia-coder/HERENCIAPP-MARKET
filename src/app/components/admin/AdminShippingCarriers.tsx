import { useEffect, useState } from "react";
import { toast } from "sonner";
import { backendStorage } from "../../lib/backendStorage";
import { DEFAULT_LOCAL_PICKUP, localPickupSettings } from "../../../../backend/localPickupPolicy.js";

export function AdminShippingCarriers() {
  const [enabled,setEnabled] = useState(false);
  const [label,setLabel] = useState(DEFAULT_LOCAL_PICKUP.label);
  const [instructions,setInstructions] = useState(DEFAULT_LOCAL_PICKUP.instructions);
  const [saving,setSaving] = useState(false);
  const [originPostalCode,setOriginPostalCode] = useState("");
  const [configStatus,setConfigStatus] = useState<"checking"|"ready"|"missing">("checking");
  const [diagnostic,setDiagnostic] = useState("");
  const [postalCode,setPostalCode] = useState("28001");
  const [weight,setWeight] = useState("0.5");
  const [length,setLength] = useState("20");
  const [width,setWidth] = useState("15");
  const [height,setHeight] = useState("10");
  const [rates,setRates] = useState<any[]>([]);
  const [points,setPoints] = useState<any[]>([]);
  const [busy,setBusy] = useState(false);
  useEffect(() => {
    try {
      const settings = JSON.parse(backendStorage.getItem("shippingSettings") || "{}");
      const pickup = localPickupSettings(settings);
      setOriginPostalCode(String(settings?.packlink?.originPostalCode || ""));
      setEnabled(pickup.enabled);
      setLabel(pickup.label);
      setInstructions(pickup.instructions);
    } catch { /* use secure disabled defaults */ }
  }, []);
  useEffect(() => {
    void fetch("/api/admin/shipping/packlink/status", {credentials:"include"})
      .then(async response => {if(!response.ok) throw Error("No se pudo consultar el estado");return response.json();})
      .then(result => setConfigStatus(result.configured ? "ready" : "missing"))
      .catch(() => setConfigStatus("missing"));
  }, []);

  const packlinkCall = async (path:string, body?:any) => {
    const response = await fetch("/api/admin/shipping/packlink/" + path, {
      method:"POST", credentials:"include", headers:{"Content-Type":"application/json"},
      body: JSON.stringify(body || {}),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "No se pudo consultar Packlink PRO");
    return result;
  };
  const testConnection = async () => {
    setBusy(true);
    try {
      const status = await packlinkCall("test");
      setDiagnostic(status.connected ? "Conexión verificada con Packlink PRO" : "Packlink no confirmó la cuenta");
    } catch(error:any){setDiagnostic(error.message);}
    finally {setBusy(false);}
  };
  const requestRates = async () => {
    setBusy(true); setRates([]); setPoints([]);
    try {
      const data = await packlinkCall("quote", {postalCode,parcel:{
        weightKg:Number(weight),lengthCm:Number(length),widthCm:Number(width),heightCm:Number(height),
      }});
      setRates(data.services || []);
      setDiagnostic(data.services?.length ? "Tarifas consultadas directamente en Packlink PRO" : "Packlink no ofrece servicios para estas medidas o esta ruta");
    } catch(error:any){setDiagnostic(error.message);}
    finally {setBusy(false);}
  };
  const requestPoints = async(serviceId:string) => {
    setBusy(true);setPoints([]);
    try {
      const data = await packlinkCall("points",{serviceId,postalCode});
      setPoints(data.points || []);
      setDiagnostic(data.points?.length ? "Puntos disponibles para este servicio" : "No hay puntos disponibles para este código postal");
    } catch(error:any){setDiagnostic(error.message);}
    finally {setBusy(false);}
  };

  const save = async () => {
    setSaving(true);
    try {
      const previous = JSON.parse(backendStorage.getItem("shippingSettings") || "{}");
      if (originPostalCode && !/^\d{5}$/.test(originPostalCode.trim())) throw new Error("Código postal de origen inválido");
      const next = { ...previous, packlink: {
        ...(previous?.packlink || {}), originPostalCode: originPostalCode.trim(),
        checkoutEnabled: false, autoPurchaseEnabled: false,
      }, localPickup: {
        enabled, label: label.trim().slice(0,120) || DEFAULT_LOCAL_PICKUP.label,
        instructions: instructions.trim().slice(0,400) || DEFAULT_LOCAL_PICKUP.instructions,
      }};
      const result = await backendStorage.setItem("shippingSettings", JSON.stringify(next));
      if (!result?.ok || !result.synced) throw new Error(result?.error || "Sin conexión con el servidor. Los cambios no se han guardado en la tienda.");
      window.dispatchEvent(new Event("backend-storage"));
      toast.success("Preferencias de recogida guardadas");
    } catch (error: any) {
      toast.error(error?.message || "No se pudieron guardar los cambios");
    } finally { setSaving(false); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-black text-[#263d32]">Envíos y puntos de recogida</h2>
        <p className="mt-2 text-sm text-muted-foreground">Controla los métodos de entrega. No se crean etiquetas ni se cobra transporte desde este panel.</p>
      </div>
      <section className="space-y-4 rounded-3xl border border-[#e2e6de] bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-bold">Recogida local en Horta, Barcelona</h3>
            <p className="text-sm text-muted-foreground">Para artículos propios. El lugar y la hora se acuerdan después del pedido.</p>
          </div>
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}
              className="h-5 w-5 accent-emerald-700" />
            {enabled ? "ON" : "OFF"}
          </label>
        </div>
        <label className="block space-y-1 text-sm font-semibold">
          <span>Nombre que verá el comprador</span>
          <input value={label} maxLength={120} onChange={e=>setLabel(e.target.value)}
            className="w-full rounded-xl border p-3 font-normal" />
        </label>
        <label className="block space-y-1 text-sm font-semibold">
          <span>Instrucciones para el comprador</span>
          <textarea value={instructions} maxLength={400} onChange={e=>setInstructions(e.target.value)}
            rows={3} className="w-full rounded-xl border p-3 font-normal" />
        </label>
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">
          Precio: gratis. No publicamos tu dirección privada. En productos externos o servicios esta modalidad no estará disponible.
        </p>
        <button type="button" onClick={save} disabled={saving} className="rounded-full bg-[#315b42] px-6 py-3 font-bold text-white disabled:opacity-50">
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </section>
      <section className="space-y-3 rounded-3xl border border-[#e2e6de] bg-white p-5 shadow-sm">
        <h3 className="font-bold">Packlink PRO · Conexión y simulador de tarifas reales</h3>
        <p className="text-sm">Clave API en Railway: <strong>{configStatus === "ready" ? "Configurada" : configStatus === "checking" ? "Comprobando…" : "No detectada"}</strong></p>
        <label className="block space-y-1 text-sm font-semibold">
          <span>Código postal de origen de los paquetes</span>
          <input value={originPostalCode} inputMode="numeric" maxLength={5} placeholder="08032"
            onChange={e=>setOriginPostalCode(e.target.value)} className="w-full rounded-xl border p-3 font-normal" />
        </label>
        <p className="text-xs text-muted-foreground">Indica el código postal desde donde salen realmente los paquetes y pulsa Guardar cambios arriba. No publiques tu dirección privada.</p>
        <button type="button" disabled={busy || configStatus !== "ready"} onClick={testConnection}
          className="rounded-xl border border-emerald-700 px-4 py-2 font-bold text-emerald-800 disabled:opacity-40">Probar conexión</button>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold">Destino (CP)
            <input value={postalCode} onChange={e=>setPostalCode(e.target.value)} className="mt-1 w-full rounded-lg border p-2" />
          </label>
          <label className="text-xs font-semibold">Peso (kg)
            <input value={weight} onChange={e=>setWeight(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border p-2" />
          </label>
          <label className="text-xs font-semibold">Longitud (cm)
            <input value={length} onChange={e=>setLength(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border p-2" />
          </label>
          <label className="text-xs font-semibold">Anchura (cm)
            <input value={width} onChange={e=>setWidth(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border p-2" />
          </label>
          <label className="text-xs font-semibold">Altura (cm)
            <input value={height} onChange={e=>setHeight(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border p-2" />
          </label>
        </div>
        <button type="button" disabled={busy || configStatus !== "ready" || !/^\d{5}$/.test(originPostalCode)}
          onClick={requestRates} className="rounded-full bg-[#315b42] px-5 py-3 font-bold text-white disabled:opacity-40">
          {busy ? "Consultando…" : "Consultar precios reales"}
        </button>
        {diagnostic && <p role="status" className="rounded-xl bg-[#f2f5f0] p-3 text-sm">{diagnostic}</p>}
        {rates.length>0 && <div className="space-y-2">
          {rates.map((rate:any)=><div key={rate.id} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
            <div><strong>{rate.carrier}</strong> · {rate.name}
              {rate.destinationPickup && <span className="block text-xs text-muted-foreground">Punto de recogida disponible</span>}
            </div>
            <div className="text-right"><strong>{Number(rate.price).toFixed(2)} €</strong>
              {rate.destinationPickup && <button className="block text-xs font-semibold text-emerald-800 underline"
                disabled={busy} onClick={()=>requestPoints(rate.id)}>Ver puntos</button>}
            </div>
          </div>)}
        </div>}
        {points.length>0 && <div className="space-y-2"><h4 className="font-bold">Puntos de recogida</h4>
          {points.map((p:any)=><p key={p.id} className="rounded-xl border p-2 text-sm">{p.name} · {p.address} · {p.city} ({p.zip})</p>)}
        </div>}
        <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">Packlink PRO no admite plantas naturales, flores ni terrarios. Utiliza esta conexión únicamente para creaciones 3D y artículos permitidos.</p>
        <p className="text-xs text-amber-700">Modo pruebas: estos precios NO se aplican todavía al checkout ni contratan etiquetas.</p>
        <p className="text-sm text-muted-foreground">
          Al generar tu clave API, guárdala como secreto del backend en Railway (PACKLINK_API_KEY).
          Nunca la pegues en un campo público, código del frontend, repositorio o chat.
          La API se habilitará al confirmar los permisos de cotizaciones, puntos de recogida y etiquetas.
        </p>
        <p className="text-sm text-muted-foreground">Mientras tanto, los envíos de transportistas conservan la tarifa actual de la tienda. No se muestran importes simulados.</p>
        <a href="https://support-pro.packlink.com/hc/es-es/articles/213431749--C%C3%B3mo-puedo-generar-una-Clave-API-en-Packlink-PRO" target="_blank" rel="noopener noreferrer"
          className="inline-block text-sm font-bold text-emerald-800 underline">Cómo generar la clave API en Packlink PRO</a>
      </section>
    </div>
  );
}
