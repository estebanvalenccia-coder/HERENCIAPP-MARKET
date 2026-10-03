import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, PackageCheck, RefreshCw, Save, Search, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../../lib/backendStorage";

export function AdminStockControl() {
  const [products, setProducts] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [threshold, setThreshold] = useState(3);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await backendApi.listCommerceProducts({ includeArchived: true });
      const rows = (Array.isArray(result.products) ? result.products : []).filter(
        (product: any) => !product?.deletedAt && String(product?.status || "active") !== "archived"
      );
      setProducts(rows);
      setDrafts(Object.fromEntries(rows.map((product: any) => [String(product.id), Math.max(0, Math.floor(Number(product.stock || 0)))])));
      try {
        const suite = JSON.parse(backendStorage.getItem("businessSuiteSettings") || "{}");
        setThreshold(Math.max(0, Number(suite.lowStockThreshold ?? 3)));
      } catch {
        setThreshold(3);
      }
    } catch (error: any) {
      toast.error(error?.message || "No se pudo cargar el inventario");
      setProducts([]);
      setDrafts({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const metrics = useMemo(() => {
    const active = products.filter((product) => product.active !== false);
    const low = active.filter((product) => Number(drafts[String(product.id)] ?? product.stock ?? 0) <= threshold);
    const none = active.filter((product) => Number(drafts[String(product.id)] ?? product.stock ?? 0) <= 0);
    const value = active.reduce(
      (sum, product) => sum + Number(drafts[String(product.id)] ?? product.stock ?? 0) * Number(product.cost ?? product.price ?? 0),
      0
    );
    return { active, low, none, value };
  }, [products, drafts, threshold]);

  const changed = useMemo(
    () =>
      products.filter(
        (product) =>
          Math.max(0, Math.floor(Number(drafts[String(product.id)] ?? 0))) !==
          Math.max(0, Math.floor(Number(product.stock || 0)))
      ),
    [products, drafts]
  );

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return metrics.active;
    return metrics.active.filter((product) =>
      [product.name, product.sku, product.category, product.collection]
        .some((value) => String(value || "").toLowerCase().includes(text))
    );
  }, [metrics.active, query]);

  const saveProducts = async (rows: any[]) => {
    if (!rows.length) return;
    setSaving(true);
    try {
      const operationsResult = await backendApi.getPosOperations().catch(() => ({ operations: {} as any }));
      const operations = operationsResult.operations || {};
      const locations = Array.isArray(operations.inventoryLocations) ? operations.inventoryLocations.filter((item: any) => item?.active !== false) : [];
      let primaryLocation = locations[0];

      if (!primaryLocation) {
        const created = await backendApi.createInventoryLocation("Almacén principal");
        primaryLocation = created.location;
      }

      for (const product of rows) {
        const stock = Math.max(0, Math.floor(Number(drafts[String(product.id)] ?? 0)));
        await backendApi.updateCommerceProduct(product.id, {
          stock,
          trackInventory: product.trackInventory !== false,
        });

        const existingByLocation = operations.inventoryLocationStock?.[String(product.id)] || {};
        const hasLocationBreakdown = Object.keys(existingByLocation).length > 0;
        if (!hasLocationBreakdown && product.trackInventory !== false && primaryLocation?.id) {
          await backendApi.setInventoryLocationStock({
            productId: String(product.id),
            locationId: String(primaryLocation.id),
            stock,
          });
        }
      }

      toast.success(rows.length === 1 ? "Stock actualizado" : `${rows.length} existencias actualizadas`);
      await load();
      window.dispatchEvent(new Event("backend-storage"));
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar el stock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card icon={Boxes} label="Productos" value={String(metrics.active.length)} />
        <Card icon={AlertTriangle} label={`Stock ≤ ${threshold}`} value={String(metrics.low.length)} />
        <Card icon={TrendingDown} label="Agotados" value={String(metrics.none.length)} />
        <Card
          icon={PackageCheck}
          label="Valor inventario"
          value={new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(metrics.value)}
        />
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-2xl font-black">Inventario inicial y ajustes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Introduce las existencias reales antes de abrir ventas. Los cambios se guardan directamente en Commerce/Neon.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || saving}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-bold"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Recargar
            </button>
            <button
              type="button"
              onClick={() => void saveProducts(changed)}
              disabled={saving || changed.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Guardar cambios ({changed.length})
            </button>
          </div>
        </div>

        <div className="relative mt-5">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, SKU o categoría…"
            className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm"
          />
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-muted-foreground">Cargando inventario…</p>
        ) : visible.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No hay productos activos para mostrar.</p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-3">Producto</th>
                  <th className="px-3 py-3">SKU</th>
                  <th className="px-3 py-3">Actual</th>
                  <th className="px-3 py-3">Nuevo stock</th>
                  <th className="px-3 py-3">Control</th>
                  <th className="px-3 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((product: any) => {
                  const id = String(product.id);
                  const current = Math.max(0, Math.floor(Number(product.stock || 0)));
                  const draft = Math.max(0, Math.floor(Number(drafts[id] ?? current)));
                  const dirty = current !== draft;
                  return (
                    <tr key={id} className="border-b border-border/70">
                      <td className="px-3 py-3">
                        <p className="font-bold">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.category || product.collection || "Sin categoría"}</p>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{product.sku || "—"}</td>
                      <td className="px-3 py-3">{current}</td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={draft}
                          onChange={(event) =>
                            setDrafts((state) => ({
                              ...state,
                              [id]: Math.max(0, Math.floor(Number(event.target.value || 0))),
                            }))
                          }
                          disabled={product.trackInventory === false}
                          className="w-28 rounded-lg border border-border bg-background px-3 py-2 font-bold disabled:opacity-50"
                        />
                      </td>
                      <td className="px-3 py-3">
                        {product.trackInventory === false ? (
                          <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">Sin límite</span>
                        ) : draft <= 0 ? (
                          <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">Agotado</span>
                        ) : draft <= threshold ? (
                          <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">Bajo</span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">Disponible</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          disabled={!dirty || saving || product.trackInventory === false}
                          onClick={() => void saveProducts([product])}
                          className="rounded-lg border border-border px-3 py-2 text-xs font-bold disabled:opacity-40"
                        >
                          Guardar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-2xl font-black">Alertas de stock</h2>
        <p className="text-sm text-muted-foreground">Productos activos por debajo del umbral configurado.</p>
        <div className="mt-5 space-y-2">
          {metrics.low.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin alertas.</p>
          ) : (
            metrics.low.map((product: any) => (
              <div key={product.id} className="flex items-center justify-between rounded-xl border border-border p-4">
                <div>
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-xs text-muted-foreground">SKU: {product.sku || product.id}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-bold ${
                    Number(drafts[String(product.id)] ?? product.stock ?? 0) <= 0
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {Number(drafts[String(product.id)] ?? product.stock ?? 0)} uds.
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Card({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <Icon className="h-6 w-6 text-primary" />
      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
