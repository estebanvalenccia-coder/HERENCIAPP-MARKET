import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";
import { isCarrierEligibleProduct } from "../../../../backend/catalogShippingRules.js";

type Product = {
  id: string | number;
  name: string;
  category?: string;
  status?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
};
type ParcelDraft = { length: string; width: string; height: string; weight: string };
const empty: ParcelDraft = { length: "", width: "", height: "", weight: "" };
const idOf = (p: Product) => String(p.id);
const is3DCreation = (p: Product) => /-3d$/.test(String(p.category || "").toLowerCase()) ||
  [p.collection, ...(Array.isArray(p.collections) ? p.collections : [])]
    .some(value => String(value || "").toLowerCase() === "creaciones-3d");

function initialDraft(product: Product): ParcelDraft {
  const metadata = product.metadata || {};
  const dims = String(metadata.shippingDimensions || "").match(/\d+(?:[.,]\d+)?/g) || [];
  const rawWeight = String(metadata.shippingWeight || "").trim().replace(",", ".");
  const weightMatch = rawWeight.match(/^(\d+(?:\.\d+)?)\s*(kg|g)$/i);
  return {
    length: dims[0] || "",
    width: dims[1] || "",
    height: dims[2] || "",
    weight: weightMatch
      ? String(Number(weightMatch[1]) * (weightMatch[2].toLowerCase() === "g" ? 0.001 : 1))
      : "",
  };
}

function validateParcel(draft: ParcelDraft): string | null {
  const dimensions = [draft.length, draft.width, draft.height].map(v => Number(String(v).replace(",", ".")));
  if ([draft.length, draft.width, draft.height].some(v => !v.trim()) ||
      dimensions.some(n => !Number.isFinite(n) || n < 1 || n > 120)) {
    return "Indica las tres medidas reales del paquete, entre 1 y 120 cm.";
  }
  const weight = Number(String(draft.weight).replace(",", "."));
  if (!draft.weight.trim() || !Number.isFinite(weight) || weight < 0.01 || weight > 40) {
    return "Indica el peso real del paquete, entre 0,01 y 40 kg.";
  }
  return null;
}

export function AdminParcelDimensions() {
  const [products, setProducts] = useState<Product[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ParcelDraft>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [only3D, setOnly3D] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { products: all } = await backendApi.listCommerceProducts({ status: "active" });
      if (!Array.isArray(all)) throw new Error("El catálogo no está disponible.");
      const eligible: Product[] = all.filter((p: Product) =>
        p && p.status !== "archived" && p.status !== "draft" &&
        isCarrierEligibleProduct(p));
      setProducts(eligible);
      setDrafts(Object.fromEntries(eligible.map(p => [idOf(p), initialDraft(p)])));
    } catch (err: any) {
      setError(err?.message || "No se pudo leer el catálogo.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const updateDraft = (id: string, field: keyof ParcelDraft, value: string) => {
    setDrafts(old => ({ ...old, [id]: { ...(old[id] || empty), [field]: value } }));
  };
  const ready = (p: Product) => !validateParcel(drafts[idOf(p)] || empty);
  const readyCount = products.filter(ready).length;
  const creations3D = products.filter(is3DCreation);
  const filtered = useMemo(() => products.filter(p =>
    (!only3D || is3DCreation(p)) &&
    [p.name, p.category].join(" ").toLowerCase().includes(search.toLowerCase().trim())
  ).sort((a, b) => Number(ready(a)) - Number(ready(b))), [products, search, only3D, drafts]);

  const save = async (product: Product) => {
    const id = idOf(product);
    const draft = drafts[id] || empty;
    const invalid = validateParcel(draft);
    if (invalid) return toast.error(invalid);
    setSavingId(id);
    try {
      // Read the latest metadata before patching so we do not discard supplier,
      // catalogue, tax or other fields saved from a second admin session.
      const latest = await backendApi.getCommerceProduct(id);
      if (!latest?.product) throw new Error("No se encontró el producto.");
      const dimension = [draft.length, draft.width, draft.height]
        .map(v => Number(v.replace(",", ".")));
      const weight = Number(draft.weight.replace(",", "."));
      const patch = {
        metadata: {
          ...(latest.product.metadata || {}),
          shippingDimensions: dimension.join(" × ") + " cm",
          shippingWeight: weight + " kg",
        },
      };
      await backendApi.updateCommerceProduct(id, patch);
      setProducts(current => current.map(p =>
        idOf(p) === id ? { ...p, metadata: { ...(p.metadata || {}), ...patch.metadata } } : p
      ));
      toast.success("Medidas del paquete guardadas en el catálogo.");
    } catch (err: any) {
      toast.error(err?.message || "No se pudieron guardar las medidas.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="space-y-4 rounded-3xl border border-[#e2e6de] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">Medidas reales de paquetes · Envíos 3D y artículos</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Introduce las medidas exteriores de la caja ya embalada y su peso total con protección.
            Estos datos son distintos de las dimensiones del producto y se usan para cotizar
            transportistas. No generan etiquetas ni compras de envío.
          </p>
          <p className="mt-2 text-sm font-semibold">
            {readyCount} de {products.length} artículos admitidos con medidas registradas en este editor.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading || savingId !== null}
          className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50">
          {loading ? "Cargando…" : "Actualizar catálogo"}
        </button>
      </div>
      <label className="block space-y-1 text-sm font-semibold">
        Buscar artículo
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl border p-3 font-normal"
          placeholder="Maceta, jarrón, creación 3D…" />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={only3D} onChange={e => setOnly3D(e.target.checked)}
          className="h-4 w-4 accent-emerald-700" />
        Solo Creaciones 3D aptas para paquetería ({creations3D.length})
      </label>
      <p className="text-xs text-muted-foreground">Se muestran primero los productos pendientes de medidas. Las creaciones que incluyan plantas vivas se excluyen de este transportista.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!loading && !error && filtered.length === 0 &&
        <p className="text-sm text-muted-foreground">No hay artículos admitidos que coincidan con la búsqueda.</p>}
      <div className="max-h-[650px] space-y-3 overflow-y-auto">
        {filtered.map(product => {
          const id = idOf(product);
          const draft = drafts[id] || empty;
          const isSaved = Boolean(product.metadata?.shippingDimensions && product.metadata?.shippingWeight);
          return (
            <div key={id} className="space-y-3 rounded-2xl border border-[#e4e7dd] bg-[#fbfaf6] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <strong className="text-sm">{product.name}</strong>
                  <p className="text-xs text-muted-foreground">{product.category || "Artículo físico"}</p>
                </div>
                <span className="text-xs font-semibold">{isSaved ? "Medidas guardadas" : "Pendiente de medidas"}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {([
                  ["length", "Largo (cm)"], ["width", "Ancho (cm)"],
                  ["height", "Alto (cm)"], ["weight", "Peso total (kg)"],
                ] as const).map(([field, label]) =>
                  <label key={field} className="space-y-1 text-xs font-semibold">
                    <span>{label}</span>
                    <input type="number" inputMode="decimal" min={field === "weight" ? "0.01" : "1"}
                      max={field === "weight" ? "40" : "120"} step="any"
                      value={draft[field]}
                      onChange={e => updateDraft(id, field, e.target.value)}
                      className="w-full rounded-xl border bg-white p-2 font-normal" />
                  </label>
                )}
              </div>
              <div className="flex justify-end">
                <button type="button" disabled={savingId !== null}
                  onClick={() => void save(product)}
                  className="rounded-full bg-[#315b42] px-5 py-2 text-sm font-bold text-white disabled:opacity-40">
                  {savingId === id ? "Guardando…" : "Guardar medidas"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-amber-800">
        Los productos que contienen plantas vivas, artículos de proveedores externos o
        mercancías restringidas no se habilitan para estas tarifas. Para plantas hace
        falta un servicio de entrega expresamente confirmado.
      </p>
    </section>
  );
}
