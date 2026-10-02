import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Flower2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { backendStorage } from "../../lib/backendStorage";
import {
  BOUQUET_CATALOG_KEY,
  parseBouquetCatalog,
  serializeBouquetCatalog,
  type BouquetCatalogItem,
} from "../../lib/bouquetCatalog";

const slug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const emptyDraft = {
  name: "",
  category: "Flores",
  price: 1,
  previewColor: "#d7b6c7",
};

export function AdminBouquetCatalog() {
  const [items, setItems] = useState<BouquetCatalogItem[]>(() =>
    parseBouquetCatalog(backendStorage.getItem(BOUQUET_CATALOG_KEY))
  );
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category))).filter(Boolean),
    [items]
  );

  useEffect(() => {
    const load = () => setItems(parseBouquetCatalog(backendStorage.getItem(BOUQUET_CATALOG_KEY)));
    void backendStorage.refresh().then(load).catch(() => null);
  }, []);

  const patch = (id: string, values: Partial<BouquetCatalogItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...values } : item)));
  };

  const save = async (next = items) => {
    setSaving(true);
    try {
      const result = await backendStorage.setItem(BOUQUET_CATALOG_KEY, serializeBouquetCatalog(next));
      if (!result.ok) throw new Error(result.error || "No se pudo publicar el catálogo");
      setItems(parseBouquetCatalog(serializeBouquetCatalog(next)));
      window.dispatchEvent(new Event("backend-storage"));
      toast.success("Catálogo del creador de ramos publicado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    if (!draft.name.trim()) return toast.error("Escribe el nombre");
    if (!draft.category.trim()) return toast.error("Escribe una categoría");

    const baseId = slug(draft.name) || "flor";
    const id = items.some((item) => item.id === baseId) ? `${baseId}-${Date.now()}` : baseId;
    const next: BouquetCatalogItem[] = [
      ...items,
      {
        id,
        name: draft.name.trim(),
        category: draft.category.trim(),
        price: Math.max(0, Number(draft.price || 0)),
        active: true,
        previewColor: draft.previewColor,
        sortOrder: (items.length + 1) * 10,
      },
    ];

    setItems(next);
    setDraft(emptyDraft);
    void save(next);
  };

  const removeItem = (id: string) => {
    const item = items.find((current) => current.id === id);
    if (!item) return;
    if (!window.confirm(`¿Quitar "${item.name}" del creador de ramos?`)) return;
    const next = items.filter((current) => current.id !== id);
    setItems(next);
    void save(next);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border/50 bg-gradient-to-r from-emerald-50 via-card to-rose-50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              <Flower2 className="h-4 w-4" /> Catálogo del creador
            </div>
            <h1 className="text-3xl font-bold">Flores, verdes y rellenos</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Lo que pongas aquí es exactamente lo que podrá elegir el cliente en “Crea tu ramo”.
              Puedes añadir, quitar, ocultar, renombrar, cambiar categoría, precio, color visual y orden.
            </p>
          </div>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saving ? "Guardando..." : "Guardar y publicar"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Referencias</p>
          <p className="mt-1 text-2xl font-black">{items.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Visibles</p>
          <p className="mt-1 text-2xl font-black">{items.filter((item) => item.active).length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Categorías</p>
          <p className="mt-1 text-2xl font-black">{categories.length}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-border/50 bg-card p-6 shadow-sm">
        <div className="overflow-x-auto rounded-2xl border border-border/50">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="p-3 text-left">Visible</th>
                <th className="p-3 text-left">Nombre</th>
                <th className="p-3 text-left">Categoría</th>
                <th className="p-3 text-left">Precio / unidad</th>
                <th className="p-3 text-left">Color visual</th>
                <th className="p-3 text-left">Orden</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id} className="border-t border-border/50">
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => patch(item.id, { active: !item.active })}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${
                        item.active ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      {item.active ? "Visible" : "Oculto"}
                    </button>
                  </td>
                  <td className="p-3">
                    <input
                      value={item.name}
                      onChange={(event) => patch(item.id, { name: event.target.value })}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      value={item.category}
                      list="bouquet-categories"
                      onChange={(event) => patch(item.id, { category: event.target.value })}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2"
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.price}
                      onChange={(event) => patch(item.id, { price: Math.max(0, Number(event.target.value || 0)) })}
                      className="w-28 rounded-xl border border-border bg-background px-3 py-2"
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={item.previewColor}
                        onChange={(event) => patch(item.id, { previewColor: event.target.value })}
                        className="h-10 w-12 rounded-lg border border-border bg-background p-1"
                      />
                      <span className="font-mono text-xs text-muted-foreground">{item.previewColor}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="rounded-lg border border-border p-2 disabled:opacity-30">
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1} className="rounded-lg border border-border p-2 disabled:opacity-30">
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <button type="button" onClick={() => removeItem(item.id)} className="rounded-xl p-2 text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No hay flores ni verdes publicados. Añade una referencia abajo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <datalist id="bouquet-categories">
          {categories.map((category) => <option key={category} value={category} />)}
          <option value="Rosas" />
          <option value="Tulipanes" />
          <option value="Lirios" />
          <option value="Girasoles" />
          <option value="Verdes y relleno" />
          <option value="Flores de temporada" />
        </datalist>

        <div className="mt-5 grid gap-3 rounded-2xl bg-muted/40 p-4 md:grid-cols-[1.4fr_1fr_160px_110px_auto]">
          <input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="Ej.: Ruscus"
            className="rounded-xl border border-border bg-background px-3 py-2"
          />
          <input
            value={draft.category}
            list="bouquet-categories"
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
            placeholder="Categoría"
            className="rounded-xl border border-border bg-background px-3 py-2"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.price}
            onChange={(event) => setDraft({ ...draft, price: Math.max(0, Number(event.target.value || 0)) })}
            placeholder="Precio"
            className="rounded-xl border border-border bg-background px-3 py-2"
          />
          <input
            type="color"
            value={draft.previewColor}
            onChange={(event) => setDraft({ ...draft, previewColor: event.target.value })}
            className="h-11 w-full rounded-xl border border-border bg-background p-1"
            title="Color de previsualización"
          />
          <button onClick={addItem} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground">
            <Plus className="h-4 w-4" /> Añadir
          </button>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          “Oculto” lo quita de la tienda sin borrarlo. “Eliminar” lo retira del catálogo. Los cambios se publican en el creador de ramos para todos los clientes.
        </p>
      </section>
    </div>
  );
}
