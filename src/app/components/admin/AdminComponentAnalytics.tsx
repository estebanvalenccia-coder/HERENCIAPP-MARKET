import { useEffect, useMemo, useState } from "react";
import { BarChart3, RefreshCcw } from "lucide-react";
import { backendApi } from "../../lib/backendStorage";
import { STOREFRONT_COMPONENT_REGISTRY } from "../../lib/componentRegistry";

type AnalyticsState = { days: number; generatedAt: string; componentClicks: Array<{ label: string; value: number }>; commerceOrders?: { orders: number; revenue: number } };

export function AdminComponentAnalytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    backendApi.getStorefrontComponentAnalytics(days)
      .then((result) => { if (!cancelled) setData(result); })
      .catch((cause) => { if (!cancelled) setError(String(cause?.message || "No hay métricas disponibles")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days, refresh]);

  const values = useMemo(() => (data?.componentClicks || []).map((item) => ({
    ...item,
    label: STOREFRONT_COMPONENT_REGISTRY.find((entry) => entry.id === item.label)?.name || item.label,
  })), [data]);
  const max = Math.max(1, ...values.map((item) => Number(item.value) || 0));
  return (
    <section className="rounded-2xl border border-[#dce6dc] bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-[#315b42]" />
          <div>
            <h4 className="font-black">Clics en los elementos de la tienda</h4>
            <p className="text-xs text-muted-foreground">Métricas agregadas de visitantes que aceptaron medición. No equivalen a compras.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="rounded-lg border p-2 text-xs" aria-label="Período de analítica">
            <option value={7}>7 días</option>
            <option value={30}>30 días</option>
            <option value={90}>90 días</option>
          </select>
          <button type="button" onClick={() => setRefresh((value) => value + 1)} aria-label="Actualizar analítica" className="rounded-lg border p-2"><RefreshCcw className="h-4 w-4" /></button>
        </div>
      </div>
      {data?.commerceOrders && !error && !loading && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border bg-[#f5f9f5] p-4">
            <p className="text-xs font-semibold text-[#536a58]">Pedidos en estado pagado o confirmado</p>
            <p className="mt-2 text-2xl font-black">{Number(data.commerceOrders.orders || 0).toLocaleString("es-ES")}</p>
          </div>
          <div className="rounded-xl border bg-[#f5f9f5] p-4">
            <p className="text-xs font-semibold text-[#536a58]">Importe agregado de esos pedidos</p>
            <p className="mt-2 text-2xl font-black">{Number(data.commerceOrders.revenue || 0).toLocaleString("es-ES", { style:"currency", currency:"EUR" })}</p>
          </div>
          <p className="text-xs text-slate-500 sm:col-span-2">Son cifras independientes de los clics. No se atribuyen ventas a un botón o campaña sin una medición comprobada del recorrido del cliente.</p>
        </div>
      )}
      {loading && <p className="text-sm text-muted-foreground">Consultando estadísticas…</p>}
      {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900">{error}</p>}
      {!loading && !error && values.length === 0 && <p className="rounded-xl bg-[#f5f8f4] p-4 text-sm text-muted-foreground">Aún no hay clics registrados en el período seleccionado. Los datos aparecen cuando la función esté publicada y los visitantes acepten la medición.</p>}
      {!loading && !error && values.length > 0 && (
        <div className="space-y-3">
          {values.map((item, index) => (
            <div key={`${item.label}-${index}`} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <span>{item.label}</span><span>{Number(item.value).toLocaleString("es-ES")}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#e5eee4]">
                <div className="h-full rounded-full bg-[#315b42]" style={{ width: `${Math.max(2, (Number(item.value) / max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
