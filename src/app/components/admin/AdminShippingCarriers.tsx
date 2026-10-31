import { useEffect, useState } from "react";
import { toast } from "sonner";
import { backendStorage } from "../../lib/backendStorage";
import { DEFAULT_LOCAL_PICKUP, localPickupSettings } from "../../../../backend/localPickupPolicy.js";

export function AdminShippingCarriers() {
  const [enabled,setEnabled] = useState(false);
  const [label,setLabel] = useState(DEFAULT_LOCAL_PICKUP.label);
  const [instructions,setInstructions] = useState(DEFAULT_LOCAL_PICKUP.instructions);
  const [saving,setSaving] = useState(false);
  useEffect(() => {
    try {
      const settings = JSON.parse(backendStorage.getItem("shippingSettings") || "{}");
      const pickup = localPickupSettings(settings);
      setEnabled(pickup.enabled);
      setLabel(pickup.label);
      setInstructions(pickup.instructions);
    } catch { /* use secure disabled defaults */ }
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const previous = JSON.parse(backendStorage.getItem("shippingSettings") || "{}");
      const next = { ...previous, localPickup: {
        enabled, label: label.trim().slice(0,120) || DEFAULT_LOCAL_PICKUP.label,
        instructions: instructions.trim().slice(0,400) || DEFAULT_LOCAL_PICKUP.instructions,
      }};
      const result = await backendStorage.setItem("shippingSettings", JSON.stringify(next));
      if (result?.ok === false) throw new Error(result.error || "No se pudo guardar");
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
        <h3 className="font-bold">Packlink PRO · Pendiente de conexión</h3>
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
