import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Layers3,
  Plus,
  RefreshCw,
  Save,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

const CORE_COLLECTIONS = new Set([
  "plantas",
  "semillas",
  "jardineria",
  "sustratos",
  "decoracion",
  "dulce",
  "moda",
  "servicios",
]);

type CollectionRow = {
  id: string;
  slug?: string;
  name: string;
  description?: string;
  imageUrl?: string;
  image_url?: string;
  status?: "active" | "draft" | "archived";
  sortOrder?: number;
  sort_order?: number;
  metadata?: {
    categories?: Array<{ id: string; name: string }>;
    badge?: string;
    seasonal?: boolean;
  };
};

type ProductRow = {
  id: string | number;
  name: string;
  image?: string;
  sku?: string;
  status?: string;
  collections?: string[];
  category?: string;
};

type CategoryDraft = {
  id: string;
  name: string;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function emptyDraft(nextSort = 100) {
  return {
    id: "",
    name: "",
    description: "",
    imageUrl: "",
    status: "active" as "active" | "draft" | "archived",
    sortOrder: nextSort,
    categories: [] as CategoryDraft[],
    productIds: [] as string[],
  };
}

export function AdminCollectionsManager() {
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [draft, setDraft] = useState(() => emptyDraft());
  const [search, setSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const selectedCollection = collections.find((item) => item.id === selectedId) || null;
  const isCore = selectedCollection ? CORE_COLLECTIONS.has(selectedCollection.id) : false;

  const visibleCollections = useMemo(() => {
    const query = search.trim().toLowerCase();
    return collections.filter((item) => {
      if (!query) return true;
      return [item.name, item.id, item.description].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [collections, search]);

  const visibleProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return products.filter((product) => {
      if (product.status === "archived") return false;
      if (!query) return true;
      return [product.name, product.sku, product.category].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [products, productSearch]);

  async function load() {
    try {
      setLoading(true);
      const [collectionResult, productResult] = await Promise.all([
        backendApi.listCommerceCollections({ includeArchived: true }),
        backendApi.listCommerceProducts({ includeArchived: true }),
      ]);
      const collectionRows = Array.isArray(collectionResult.collections) ? collectionResult.collections : [];
      const productRows = Array.isArray(productResult.products) ? productResult.products : [];
      setCollections(collectionRows);
      setProducts(productRows);
    } catch (error: any) {
      toast.error(error?.message || "No se pudieron cargar las colecciones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function chooseCollection(row: CollectionRow) {
    const categories = Array.isArray(row.metadata?.categories)
      ? row.metadata!.categories!.map((item) => ({
          id: String(item.id || slugify(item.name || "")),
          name: String(item.name || ""),
        }))
      : [];

    const assigned = products
      .filter((product) => Array.isArray(product.collections) && product.collections.includes(row.id))
      .map((product) => String(product.id));

    setSelectedId(row.id);
    setDraft({
      id: row.id,
      name: row.name || "",
      description: row.description || "",
      imageUrl: row.imageUrl || row.image_url || "",
      status: row.status || "active",
      sortOrder: Number(row.sortOrder ?? row.sort_order ?? 0),
      categories,
      productIds: assigned,
    });
  }

  function createNew() {
    const nextSort =
      collections.reduce((max, row) => Math.max(max, Number(row.sortOrder ?? row.sort_order ?? 0)), 0) + 10;
    setSelectedId("");
    setDraft(emptyDraft(nextSort));
  }

  function patchCategory(index: number, patch: Partial<CategoryDraft>) {
    setDraft((current) => ({
      ...current,
      categories: current.categories.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const next = { ...item, ...patch };
        if (patch.name !== undefined && (!item.id || item.id === slugify(item.name))) {
          next.id = slugify(patch.name);
        }
        return next;
      }),
    }));
  }

  function toggleProduct(id: string | number) {
    const key = String(id);
    setDraft((current) => ({
      ...current,
      productIds: current.productIds.includes(key)
        ? current.productIds.filter((item) => item !== key)
        : [...current.productIds, key],
    }));
  }

  async function uploadImage(file?: File) {
    if (!file) return;
    try {
      setUploading(true);
      const uploaded = await backendApi.uploadSiteMediaFile(file);
      const url = String(uploaded.media?.url || "");
      if (!url) throw new Error("No se recibió la URL de la imagen");
      setDraft((current) => ({ ...current, imageUrl: url }));
      toast.success("Imagen de colección subida");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    const name = draft.name.trim();
    if (!name) return toast.error("Escribe el nombre de la colección");
    const id = draft.id.trim() || slugify(name);
    if (!id) return toast.error("No se pudo crear un identificador válido");

    const categories = draft.categories
      .map((item) => ({
        id: slugify(item.id || item.name),
        name: item.name.trim(),
      }))
      .filter((item) => item.id && item.name);

    try {
      setSaving(true);
      await backendApi.saveCommerceCollection({
        id,
        slug: slugify(name),
        name,
        description: draft.description.trim(),
        imageUrl: draft.imageUrl || null,
        status: draft.status,
        sortOrder: Math.max(0, Math.floor(Number(draft.sortOrder || 0))),
        metadata: {
          ...(selectedCollection?.metadata || {}),
          ...(!CORE_COLLECTIONS.has(id) || categories.length > 0 ? { categories } : {}),
        },
      });

      if (!CORE_COLLECTIONS.has(id)) {
        await backendApi.setCommerceCollectionProducts(id, draft.productIds);
      }

      await load();
      const refreshed = (await backendApi.listCommerceCollections({ includeArchived: true })).collections || [];
      const saved = refreshed.find((row: CollectionRow) => row.id === id);
      if (saved) chooseCollection(saved);
      toast.success(selectedCollection ? "Colección actualizada" : "Colección creada");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar la colección");
    } finally {
      setSaving(false);
    }
  }

  async function move(row: CollectionRow, direction: -1 | 1) {
    const ordered = [...collections].sort(
      (a, b) => Number(a.sortOrder ?? a.sort_order ?? 0) - Number(b.sortOrder ?? b.sort_order ?? 0)
    );
    const index = ordered.findIndex((item) => item.id === row.id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;
    const target = ordered[targetIndex];
    const rowOrder = Number(row.sortOrder ?? row.sort_order ?? index * 10);
    const targetOrder = Number(target.sortOrder ?? target.sort_order ?? targetIndex * 10);

    try {
      await Promise.all([
        backendApi.saveCommerceCollection({ ...row, sortOrder: targetOrder, imageUrl: row.imageUrl || row.image_url }),
        backendApi.saveCommerceCollection({ ...target, sortOrder: rowOrder, imageUrl: target.imageUrl || target.image_url }),
      ]);
      await load();
      toast.success("Orden actualizado");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo cambiar el orden");
    }
  }

  async function archiveSelected() {
    if (!selectedCollection || isCore) return;
    if (!window.confirm(`¿Archivar "${selectedCollection.name}"? Los productos no se eliminan.`)) return;
    try {
      await backendApi.saveCommerceCollection({
        ...selectedCollection,
        imageUrl: selectedCollection.imageUrl || selectedCollection.image_url,
        status: "archived",
      });
      createNew();
      await load();
      toast.success("Colección archivada");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo archivar");
    }
  }

  if (loading) {
    return <div className="rounded-3xl border border-border bg-card p-12 text-center text-muted-foreground">Cargando colecciones de Neon…</div>;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <aside className="space-y-4">
        <div className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Commerce · Neon</p>
              <h2 className="mt-1 text-2xl font-black">Colecciones</h2>
            </div>
            <button type="button" onClick={createNew} className="rounded-xl bg-primary p-3 text-primary-foreground" title="Nueva colección">
              <Plus className="h-5 w-5" />
            </button>
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar colección…"
              className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          {visibleCollections.map((row) => {
            const active = row.id === selectedId;
            const core = CORE_COLLECTIONS.has(row.id);
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => chooseCollection(row)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  active ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "border-border bg-card hover:bg-muted/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="h-14 w-14 overflow-hidden rounded-xl bg-muted">
                    {(row.imageUrl || row.image_url) ? (
                      <img src={row.imageUrl || row.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center"><Layers3 className="h-5 w-5 text-muted-foreground" /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-black">{row.name}</p>
                      {core && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-600">BASE</span>}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">/{row.slug || row.id}</p>
                    <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-black ${
                      row.status === "archived"
                        ? "bg-slate-100 text-slate-600"
                        : row.status === "draft"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {row.status === "archived" ? "Archivada" : row.status === "draft" ? "Borrador" : "Publicada"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => { event.stopPropagation(); void move(row, -1); }}
                      className="rounded-lg border border-border p-1.5"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => { event.stopPropagation(); void move(row, 1); }}
                      className="rounded-lg border border-border p-1.5"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="rounded-3xl border border-border bg-card p-5 sm:p-7">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
              {selectedCollection ? "Editar colección" : "Nueva colección"}
            </p>
            <h2 className="mt-1 text-3xl font-black">{draft.name || "Colección sin nombre"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Las colecciones personalizadas sirven para campañas, temporadas, regalos, bodas y agrupaciones comerciales.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-bold">
            <RefreshCw className="h-4 w-4" /> Actualizar
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <div className="space-y-3">
            <div className="aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
              {draft.imageUrl ? (
                <img src={draft.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
                  <div><ImagePlus className="mx-auto mb-2 h-8 w-8" />Sin imagen</div>
                </div>
              )}
            </div>
            <label className="relative flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-3 py-3 text-sm font-black">
              <ImagePlus className="h-4 w-4" /> {uploading ? "Subiendo…" : "Subir imagen"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                disabled={uploading}
                onChange={(event) => {
                  const input = event.currentTarget;
                  void uploadImage(input.files?.[0]).finally(() => { input.value = ""; });
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            {draft.imageUrl && (
              <button type="button" onClick={() => setDraft((current) => ({ ...current, imageUrl: "" }))} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs font-bold">
                <X className="h-3.5 w-3.5" /> Quitar imagen
              </button>
            )}
          </div>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">
                Nombre *
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                    id: selectedCollection ? current.id : slugify(event.target.value),
                  }))}
                  placeholder="Ej: Navidad"
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
                />
              </label>
              <label className="text-sm font-bold">
                Identificador
                <input
                  value={draft.id}
                  disabled={Boolean(selectedCollection)}
                  onChange={(event) => setDraft((current) => ({ ...current, id: slugify(event.target.value) }))}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 disabled:opacity-60"
                />
              </label>
            </div>

            <label className="block text-sm font-bold">
              Descripción
              <textarea
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                rows={4}
                placeholder="Describe esta colección para clientes y buscadores."
                className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-3"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">
                Estado
                <select
                  value={draft.status}
                  onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as any }))}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
                >
                  <option value="active">Publicada</option>
                  <option value="draft">Borrador / oculta</option>
                  {selectedCollection && !isCore && <option value="archived">Archivada</option>}
                </select>
              </label>
              <label className="text-sm font-bold">
                Orden
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={draft.sortOrder}
                  onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value || 0) }))}
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-border p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-black">Subcategorías</p>
                  <p className="text-xs text-muted-foreground">Ej.: Navidad → Regalos, Centros, Dulces, Moda.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDraft((current) => ({
                    ...current,
                    categories: [...current.categories, { id: "", name: "" }],
                  }))}
                  className="rounded-xl bg-primary px-3 py-2 text-xs font-black text-primary-foreground"
                >
                  + Subcategoría
                </button>
              </div>

              <div className="space-y-3">
                {draft.categories.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    Esta colección todavía no tiene subcategorías.
                  </div>
                )}
                {draft.categories.map((category, index) => (
                  <div key={`${category.id}-${index}`} className="grid gap-2 rounded-xl bg-muted/20 p-3 sm:grid-cols-[1fr_1fr_auto]">
                    <input
                      value={category.name}
                      onChange={(event) => patchCategory(index, { name: event.target.value })}
                      placeholder="Nombre"
                      className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                    />
                    <input
                      value={category.id}
                      onChange={(event) => patchCategory(index, { id: slugify(event.target.value) })}
                      placeholder="slug"
                      className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setDraft((current) => ({
                        ...current,
                        categories: current.categories.filter((_, itemIndex) => itemIndex !== index),
                      }))}
                      className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-black text-destructive"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {!isCore && (
              <div className="rounded-2xl border border-border p-4">
                <div className="mb-4">
                  <p className="font-black">Productos de esta colección</p>
                  <p className="text-xs text-muted-foreground">
                    Selecciona productos existentes. No se duplican: solo se agrupan en esta colección.
                  </p>
                </div>

                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Buscar productos…"
                    className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm"
                  />
                </div>

                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {visibleProducts.map((product) => {
                    const checked = draft.productIds.includes(String(product.id));
                    return (
                      <label key={String(product.id)} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${
                        checked ? "border-primary bg-primary/5" : "border-border"
                      }`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleProduct(product.id)} />
                        <div className="h-11 w-11 overflow-hidden rounded-lg bg-muted">
                          {product.image ? <img src={product.image} alt="" className="h-full w-full object-cover" /> : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black">{product.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{product.sku || product.category || "Sin SKU"}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <p className="mt-3 text-xs font-bold text-muted-foreground">
                  {draft.productIds.length} productos seleccionados
                </p>
              </div>
            )}

            {isCore && (
              <div className="rounded-xl bg-amber-50 p-4 text-xs leading-5 text-amber-800">
                Esta es una colección base que define el tipo principal del artículo. Puedes cambiar nombre, imagen, descripción, subcategorías y orden. La pertenencia de productos base se gestiona desde cada producto para no romper su tipo/stock.
              </div>
            )}

            <div className="sticky bottom-3 flex flex-col gap-2 rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:justify-end">
              {selectedCollection && !isCore && (
                <button type="button" onClick={() => void archiveSelected()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-black text-destructive">
                  <Archive className="h-4 w-4" /> Archivar
                </button>
              )}
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || uploading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-black text-primary-foreground disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar colección"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
