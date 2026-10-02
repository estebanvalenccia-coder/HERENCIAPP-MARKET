import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Edit,
  Eye,
  EyeOff,
  Printer,
  Search,
  Sparkles,
  Tag as TagIcon,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../../lib/backendStorage";
import {
  COMMERCE_COLLECTIONS,
  getCommerceCollection,
  isPlantLikeCollection,
  primaryCollectionOf,
  productTypeForCollection,
} from "../../lib/commerceCatalog";

type Product = {
  id: string | number;
  name: string;
  description?: string;
  category?: string;
  collections?: string[];
  type?: string;
  price?: number;
  salePrice?: number;
  compareAtPrice?: number;
  originalPrice?: number;
  onSale?: boolean;
  cost?: number;
  image?: string;
  images?: any[];
  sku?: string;
  barcode?: string;
  stock?: number;
  trackInventory?: boolean;
  iva?: number;
  taxRate?: number;
  status?: string;
  active?: boolean;
  featured?: boolean;
  deletedAt?: string;
  environment?: string;
  light?: string;
  size?: string;
  difficulty?: string;
  petSafe?: boolean;
  toxicity?: string;
  water?: string;
  temperature?: string;
  scientificName?: string;
  allowDedication?: boolean;
  variants?: Array<{ name: string; price?: number; stock?: number; sku?: string }>;
  seoTitle?: string;
  seoDescription?: string;
  tags?: string[] | string;
  [key: string]: any;
};

const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";

function getGeminiApiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY || "";
}

function buildProductImagePrompt(product: Product, customPrompt: string) {
  const idea = customPrompt.trim() || `${product.name}. ${product.description || ""}`;
  const collection = getCommerceCollection(primaryCollectionOf(product)).name;

  return `Crea una fotografía comercial premium para Herencia Market.
Artículo: ${idea}
Colección: ${collection}.
Estilo: ecommerce elegante, natural, contemporáneo, iluminación cuidada, producto protagonista, fondo limpio y coherente con la categoría, alta calidad, sin texto, sin logos y sin marcas de agua.`;
}

async function generateProductImageWithGemini(prompt: string) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Falta configurar VITE_GEMINI_API_KEY");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );

  if (!response.ok) throw new Error((await response.text()) || "No se pudo generar la imagen");
  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((part: any) => part.inlineData || part.inline_data);
  const inlineData = imagePart?.inlineData || imagePart?.inline_data;
  if (!inlineData?.data) throw new Error("La IA no devolvió una imagen");
  return `data:${inlineData.mimeType || inlineData.mime_type || "image/png"};base64,${inlineData.data}`;
}

const emptyEdit = {
  name: "",
  description: "",
  collection: "plantas",
  category: "plantas-interior",
  image: "",
  price: 0,
  salePrice: 0,
  onSale: false,
  cost: 0,
  sku: "",
  barcode: "",
  stock: 0,
  trackInventory: true,
  iva: 21,
  status: "active",
  featured: false,
  scientificName: "",
  environment: "interior",
  light: "indirecta",
  size: "",
  difficulty: "Fácil",
  petSafe: false,
  toxicity: "",
  water: "",
  temperature: "",
  allowDedication: true,
  variantsText: "",
  tags: "",
  seoTitle: "",
  seoDescription: "",
};

export function AdminProducts({ onAddNew }: { onAddNew: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyEdit });
  const [saving, setSaving] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [collectionFilter, setCollectionFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  async function loadProducts() {
    try {
      setLoading(true);
      const result = await backendApi.listCommerceProducts({ includeArchived: true });
      const rows = Array.isArray(result.products) ? result.products : [];
      setProducts(rows);
      void backendStorage.setItem("adminProducts", JSON.stringify(rows));
    } catch (error) {
      try {
        const cached = JSON.parse(backendStorage.getItem("adminProducts") || "[]");
        setProducts(Array.isArray(cached) ? cached : []);
      } catch {
        setProducts([]);
      }
      console.error(error);
      toast.error("No se pudo actualizar el catálogo desde Neon");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const archived = product.status === "archived" || Boolean(product.deletedAt);
      if (showTrash !== archived) return false;
      if (collectionFilter !== "todos" && primaryCollectionOf(product) !== collectionFilter) return false;
      if (!query) return true;
      return [product.name, product.description, product.sku, product.category, primaryCollectionOf(product)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [products, showTrash, collectionFilter, search]);

  async function updateProduct(product: Product, payload: any, message?: string) {
    try {
      await backendApi.updateCommerceProduct(product.id, payload);
      await loadProducts();
      if (message) toast.success(message);
    } catch (error: any) {
      toast.error(error?.message || "No se pudo actualizar el artículo");
    }
  }

  async function toggleActive(product: Product) {
    const active = product.status === "active" || product.active === true;
    await updateProduct(
      product,
      { status: active ? "draft" : "active", active: !active },
      active ? "Artículo pasado a borrador" : "Artículo publicado"
    );
  }

  async function toggleSale(product: Product) {
    const regular = Number(product.price || 0);
    if (product.onSale) {
      await updateProduct(
        product,
        {
          price: regular,
          salePrice: undefined,
          compareAtPrice: null,
          onSale: false,
        },
        "Oferta desactivada"
      );
      return;
    }

    const sale = Math.round(regular * 0.8 * 100) / 100;
    await updateProduct(
      product,
      { price: regular, salePrice: sale, compareAtPrice: regular, onSale: true },
      "Oferta del 20% activada"
    );
  }

  async function archiveProduct(product: Product) {
    if (!confirm("¿Mover este artículo a la papelera?")) return;
    try {
      await backendApi.deleteCommerceProduct(product.id, false);
      await loadProducts();
      toast.success("Artículo movido a la papelera");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo archivar");
    }
  }

  async function restoreProduct(product: Product) {
    await updateProduct(product, { status: "active", active: true, deletedAt: null }, "Artículo restaurado");
  }

  async function permanentlyDeleteProduct(product: Product) {
    if (!confirm("Esta acción es definitiva. ¿Eliminar permanentemente?")) return;
    try {
      await backendApi.deleteCommerceProduct(product.id, true);
      await loadProducts();
      toast.success("Artículo eliminado definitivamente");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo eliminar");
    }
  }

  async function duplicateProduct(product: Product) {
    try {
      const primary = primaryCollectionOf(product);
      const copy = {
        ...product,
        id: undefined,
        name: `${product.name} · copia`,
        sku: product.sku ? `${product.sku}-COPY` : "",
        status: "draft",
        active: false,
        deletedAt: undefined,
        collections: Array.isArray(product.collections) && product.collections.length
          ? product.collections
          : [primary],
      };
      delete copy.id;
      await backendApi.createCommerceProduct(copy);
      await loadProducts();
      toast.success("Copia creada como borrador");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo duplicar");
    }
  }

  function startEdit(product: Product) {
    const collection = primaryCollectionOf(product);
    const regularPrice = Number(product.price || 0);
    const salePrice = product.onSale ? Number(product.salePrice || 0) : 0;
    setEditingProduct(product);
    setAiPrompt("");
    setEditForm({
      name: product.name || "",
      description: product.description || "",
      collection,
      category: product.category || getCommerceCollection(collection).categories[0]?.id || collection,
      image: product.image || "",
      price: regularPrice,
      salePrice,
      onSale: Boolean(product.onSale),
      cost: Number(product.cost || 0),
      sku: product.sku || "",
      barcode: product.barcode || "",
      stock: Math.max(0, Number(product.stock || 0)),
      trackInventory: product.trackInventory !== false,
      iva: Number(product.iva ?? product.taxRate ?? 21),
      status: product.status === "draft" ? "draft" : "active",
      featured: Boolean(product.featured),
      scientificName: product.scientificName || "",
      environment: product.environment || "interior",
      light: product.light || "indirecta",
      size: product.size || "",
      difficulty: product.difficulty || "Fácil",
      petSafe: Boolean(product.petSafe),
      toxicity: product.toxicity || "",
      water: product.water || "",
      temperature: product.temperature || "",
      allowDedication: product.allowDedication !== false,
      variantsText: (product.variants || [])
        .map((variant) => `${variant.name} | ${variant.price ?? ""} | ${variant.stock ?? ""} | ${variant.sku ?? ""}`)
        .join("\n"),
      tags: Array.isArray(product.tags) ? product.tags.join(", ") : String(product.tags || ""),
      seoTitle: product.seoTitle || product.name || "",
      seoDescription: product.seoDescription || product.description || "",
    });
  }

  function cancelEdit() {
    setEditingProduct(null);
    setEditForm({ ...emptyEdit });
    setAiPrompt("");
  }

  async function generateAiImage() {
    if (!editingProduct) return;
    try {
      setAiGenerating(true);
      const imageUrl = await generateProductImageWithGemini(
        { ...editingProduct, name: editForm.name, description: editForm.description },
        aiPrompt
      );
      setEditForm((current) => ({ ...current, image: imageUrl }));
      toast.success("Imagen generada");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo generar la imagen");
    } finally {
      setAiGenerating(false);
    }
  }

  async function saveEdit() {
    if (!editingProduct) return;
    if (!editForm.name.trim()) return toast.error("El nombre es obligatorio");
    if (editForm.price <= 0) return toast.error("El precio debe ser mayor que 0");
    if (editForm.onSale && (editForm.salePrice <= 0 || editForm.salePrice >= editForm.price)) {
      return toast.error("El precio de oferta debe ser menor que el precio normal");
    }

    try {
      setSaving(true);
      let imageUrl = editForm.image.trim();
      if (imageUrl.startsWith("data:image/")) {
        const uploaded = await backendApi.uploadSiteMedia({
          dataUrl: imageUrl,
          filename: `${editForm.name.replace(/[^a-z0-9]+/gi, "-") || "producto"}.jpg`,
        });
        imageUrl = String(uploaded.media?.url || "");
      }

      const plantLike = isPlantLikeCollection(editForm.collection);
      const variants = editForm.variantsText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, price, stock, sku] = line.split("|").map((part) => part.trim());
          return {
            name,
            price: price ? Math.max(0, Number(price)) : undefined,
            stock: stock ? Math.max(0, Math.floor(Number(stock))) : 0,
            sku: sku || undefined,
          };
        })
        .filter((variant) => variant.name);

      await backendApi.updateCommerceProduct(editingProduct.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        collection: editForm.collection,
        collections: [editForm.collection],
        category: editForm.category,
        type: productTypeForCollection(editForm.collection),
        status: editForm.status,
        active: editForm.status === "active",
        featured: editForm.featured,
        price: editForm.price,
        salePrice: editForm.onSale ? editForm.salePrice : undefined,
        compareAtPrice: editForm.onSale ? editForm.price : null,
        onSale: editForm.onSale,
        cost: editForm.cost || null,
        sku: editForm.sku.trim(),
        barcode: editForm.barcode.trim(),
        stock: editForm.trackInventory ? editForm.stock : 0,
        trackInventory: editForm.trackInventory,
        taxRate: editForm.iva,
        image: imageUrl || undefined,
        images: imageUrl ? [imageUrl] : [],
        scientificName: plantLike ? editForm.scientificName.trim() : "",
        environment: plantLike ? editForm.environment : "",
        light: plantLike ? editForm.light : "",
        size: plantLike ? editForm.size.trim() : "",
        difficulty: plantLike ? editForm.difficulty : "",
        petSafe: plantLike ? editForm.petSafe : false,
        toxicity: plantLike ? editForm.toxicity.trim() : "",
        water: plantLike ? editForm.water.trim() : "",
        temperature: plantLike ? editForm.temperature.trim() : "",
        allowDedication: editForm.allowDedication,
        variants,
        seoTitle: editForm.seoTitle.trim() || editForm.name.trim(),
        seoDescription: editForm.seoDescription.trim() || editForm.description.trim(),
        metadata: {
          ...(editingProduct.metadata || {}),
          tags: editForm.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        },
      });

      await loadProducts();
      toast.success("Artículo actualizado en Neon");
      cancelEdit();
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar el artículo");
    } finally {
      setSaving(false);
    }
  }

  function printLabel(product: Product) {
    const url = `${window.location.origin}/producto/${product.id}`;
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
    const popup = window.open("", "_blank", "width=520,height=700");
    if (!popup) return toast.error("El navegador bloqueó la ventana");
    const sale = product.onSale && product.salePrice ? product.salePrice : product.price;
    popup.document.write(`<!doctype html><html><head><title>${product.name}</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#24352b}.label{border:2px solid #426047;border-radius:22px;padding:24px;max-width:390px;margin:auto;text-align:center}.brand{font-weight:900;letter-spacing:2px;color:#426047}.name{font-size:25px;font-weight:800;margin:14px 0}.price{font-size:28px;font-weight:900}.meta{font-size:13px;color:#66756c;margin:6px}.qr{width:170px;height:170px;margin:16px auto 6px}@media print{button{display:none}body{padding:0}}</style></head><body><div class="label"><div class="brand">HERENCIA</div><div class="name">${product.name}</div><div class="price">€${Number(sale||0).toFixed(2)}</div><div class="meta">SKU: ${product.sku||product.id}</div><img class="qr" src="${qr}" alt="QR"/><div class="meta">${url}</div></div><p style="text-align:center"><button onclick="window.print()">Imprimir etiqueta</button></p></body></html>`);
    popup.document.close();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Commerce · Neon</p>
          <h2 className="mt-1 text-3xl font-black text-foreground">Catálogo de venta</h2>
          <p className="mt-1 text-muted-foreground">
            {products.filter((product) => product.status !== "archived" && !product.deletedAt).length} activos/borradores · {products.filter((product) => product.status === "archived" || product.deletedAt).length} en papelera
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowTrash((value) => !value)} className="rounded-xl bg-muted px-4 py-3 font-bold">
            {showTrash ? "Volver al catálogo" : "Papelera"}
          </button>
          <button onClick={onAddNew} className="rounded-xl bg-primary px-6 py-3 font-black text-primary-foreground">
            + Crear artículo
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 lg:grid-cols-[1fr_260px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, SKU, categoría…"
            className="w-full rounded-xl border border-border bg-background py-3 pl-11 pr-4"
          />
        </div>
        <select
          value={collectionFilter}
          onChange={(event) => setCollectionFilter(event.target.value)}
          className="rounded-xl border border-border bg-background px-4 py-3 font-bold"
        >
          <option value="todos">Todas las colecciones</option>
          {COMMERCE_COLLECTIONS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">Cargando catálogo de Neon…</div>
      ) : visibleProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <p className="text-xl font-black">No hay artículos aquí</p>
          <p className="mt-2 text-sm text-muted-foreground">Crea un producto, servicio, artículo de moda o dulce desde “Crear artículo”.</p>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {visibleProducts.map((product) => {
            const collection = getCommerceCollection(primaryCollectionOf(product));
            const published = product.status === "active" || product.active === true;
            const salePrice = product.onSale && product.salePrice ? Number(product.salePrice) : null;
            return (
              <article key={String(product.id)} className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
                <div className="grid sm:grid-cols-[180px_1fr]">
                  <div className="h-52 bg-muted sm:h-full">
                    {product.image ? (
                      <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full min-h-44 items-center justify-center p-5 text-center text-sm text-muted-foreground">Sin imagen</div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="mb-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary">{collection.name}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${published ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                            {published ? "Publicado" : "Borrador"}
                          </span>
                          {product.featured && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-black text-violet-800">Destacado</span>}
                        </div>
                        <h3 className="text-xl font-black">{product.name}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
                      </div>
                      <button onClick={() => printLabel(product)} className="rounded-lg border border-border p-2" title="Imprimir etiqueta"><Printer className="h-4 w-4" /></button>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div><p className="text-xs text-muted-foreground">Precio</p><p className="font-black">{salePrice ? <><span className="mr-1 text-xs line-through">€{Number(product.price||0).toFixed(2)}</span>€{salePrice.toFixed(2)}</> : `€${Number(product.price||0).toFixed(2)}`}</p></div>
                      <div><p className="text-xs text-muted-foreground">Stock</p><p className="font-black">{product.trackInventory === false ? "∞" : Math.max(0, Number(product.stock || 0))}</p></div>
                      <div><p className="text-xs text-muted-foreground">SKU</p><p className="truncate font-bold">{product.sku || "—"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Tipo</p><p className="font-bold">{product.type || collection.productType}</p></div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button onClick={() => void toggleActive(product)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-bold">
                        {published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {published ? "Pasar a borrador" : "Publicar"}
                      </button>
                      <button onClick={() => void toggleSale(product)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-bold">
                        <TagIcon className="h-4 w-4" /> {product.onSale ? "Quitar oferta" : "Oferta -20%"}
                      </button>
                      <button onClick={() => startEdit(product)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground">
                        <Edit className="h-4 w-4" /> Editar
                      </button>
                      <button onClick={() => void duplicateProduct(product)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-bold">
                        <Copy className="h-4 w-4" /> Duplicar
                      </button>
                      {showTrash ? (
                        <>
                          <button onClick={() => void restoreProduct(product)} className="rounded-lg border border-border px-3 py-2 text-sm font-bold">Restaurar</button>
                          <button onClick={() => void permanentlyDeleteProduct(product)} className="inline-flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive"><Trash2 className="h-4 w-4" /> Eliminar</button>
                        </>
                      ) : (
                        <button onClick={() => void archiveProduct(product)} className="inline-flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive"><Trash2 className="h-4 w-4" /> Papelera</button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editingProduct && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Editar artículo real</p>
                <h3 className="mt-1 text-2xl font-black">{editingProduct.name}</h3>
                <p className="text-xs text-muted-foreground">Los cambios se guardan directamente en Commerce/Neon.</p>
              </div>
              <button onClick={cancelEdit} className="rounded-xl border border-border px-4 py-2 font-bold">Cerrar</button>
            </div>

            <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
              <div className="space-y-4">
                <div className="h-72 overflow-hidden rounded-2xl border border-border bg-muted">
                  {editForm.image ? <img src={editForm.image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-muted-foreground">Sin imagen</div>}
                </div>
                <label className="block text-sm font-bold">URL de imagen
                  <input value={editForm.image} onChange={(e) => setEditForm({ ...editForm, image: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                </label>
                <label className="block text-sm font-bold">Prompt de imagen IA
                  <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={3} className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-3" />
                </label>
                <button onClick={() => void generateAiImage()} disabled={aiGenerating} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground disabled:opacity-60">
                  <Sparkles className="h-4 w-4" /> {aiGenerating ? "Generando…" : "Generar imagen con IA"}
                </button>
              </div>

              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="sm:col-span-2 text-sm font-bold">Nombre
                    <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3" />
                  </label>
                  <label className="sm:col-span-2 text-sm font-bold">Descripción
                    <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={4} className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-3" />
                  </label>

                  <label className="text-sm font-bold">Colección
                    <select
                      value={editForm.collection}
                      onChange={(e) => {
                        const next = getCommerceCollection(e.target.value);
                        setEditForm({ ...editForm, collection: next.id, category: next.categories[0]?.id || next.id, trackInventory: next.inventoryDefault });
                      }}
                      className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
                    >
                      {COMMERCE_COLLECTIONS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-bold">Subcategoría
                    <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3">
                      {getCommerceCollection(editForm.collection).categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>

                  <label className="text-sm font-bold">Precio normal (€)
                    <input type="number" min="0" step="0.01" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value || 0) })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3" />
                  </label>
                  <label className="text-sm font-bold">Coste (€)
                    <input type="number" min="0" step="0.01" value={editForm.cost} onChange={(e) => setEditForm({ ...editForm, cost: Number(e.target.value || 0) })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3" />
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setEditForm({ ...editForm, onSale: !editForm.onSale })} className={`rounded-xl border px-4 py-2 text-sm font-bold ${editForm.onSale ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{editForm.onSale ? "✓ En oferta" : "Activar oferta"}</button>
                  <button type="button" onClick={() => setEditForm({ ...editForm, featured: !editForm.featured })} className={`rounded-xl border px-4 py-2 text-sm font-bold ${editForm.featured ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{editForm.featured ? "✓ Destacado" : "Destacar"}</button>
                </div>

                {editForm.onSale && <label className="block max-w-xs text-sm font-bold">Precio de oferta (€)
                  <input type="number" min="0" step="0.01" value={editForm.salePrice} onChange={(e) => setEditForm({ ...editForm, salePrice: Number(e.target.value || 0) })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3" />
                </label>}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-sm font-bold">SKU
                    <input value={editForm.sku} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                  </label>
                  <label className="text-sm font-bold">Código barras
                    <input value={editForm.barcode} onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                  </label>
                  <label className="text-sm font-bold">Stock
                    <input type="number" min="0" disabled={!editForm.trackInventory} value={editForm.stock} onChange={(e) => setEditForm({ ...editForm, stock: Math.max(0, Number(e.target.value || 0)) })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 disabled:opacity-50" />
                  </label>
                  <label className="text-sm font-bold">IVA
                    <input type="number" min="0" step="0.01" value={editForm.iva} onChange={(e) => setEditForm({ ...editForm, iva: Math.max(0, Number(e.target.value || 0)) })} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3" />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-bold">Estado
                    <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3">
                      <option value="active">Publicado</option><option value="draft">Borrador</option>
                    </select>
                  </label>
                  <label className="mt-7 flex items-center gap-2 text-sm font-bold">
                    <input type="checkbox" checked={editForm.trackInventory} disabled={editForm.collection === "servicios"} onChange={(e) => setEditForm({ ...editForm, trackInventory: e.target.checked })} />
                    Controlar inventario
                  </label>
                </div>

                {isPlantLikeCollection(editForm.collection) && (
                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <h4 className="font-black">Cuidados / ficha de planta</h4>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <input value={editForm.scientificName} onChange={(e) => setEditForm({ ...editForm, scientificName: e.target.value })} placeholder="Nombre científico" className="rounded-xl border border-border bg-background px-3 py-3" />
                      <select value={editForm.environment} onChange={(e) => setEditForm({ ...editForm, environment: e.target.value })} className="rounded-xl border border-border bg-background px-3 py-3"><option value="interior">Interior</option><option value="exterior">Exterior</option><option value="interior exterior">Interior/exterior</option></select>
                      <select value={editForm.light} onChange={(e) => setEditForm({ ...editForm, light: e.target.value })} className="rounded-xl border border-border bg-background px-3 py-3"><option value="baja">Poca luz</option><option value="indirecta">Indirecta</option><option value="sol">Sol</option></select>
                      <input value={editForm.size} onChange={(e) => setEditForm({ ...editForm, size: e.target.value })} placeholder="Tamaño" className="rounded-xl border border-border bg-background px-3 py-3" />
                      <input value={editForm.water} onChange={(e) => setEditForm({ ...editForm, water: e.target.value })} placeholder="Riego" className="rounded-xl border border-border bg-background px-3 py-3" />
                      <input value={editForm.temperature} onChange={(e) => setEditForm({ ...editForm, temperature: e.target.value })} placeholder="Temperatura" className="rounded-xl border border-border bg-background px-3 py-3" />
                      <input value={editForm.toxicity} onChange={(e) => setEditForm({ ...editForm, toxicity: e.target.value })} placeholder="Toxicidad" className="rounded-xl border border-border bg-background px-3 py-3" />
                      <select value={editForm.difficulty} onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value })} className="rounded-xl border border-border bg-background px-3 py-3"><option>Fácil</option><option>Media</option><option>Avanzada</option></select>
                    </div>
                    <button type="button" onClick={() => setEditForm({ ...editForm, petSafe: !editForm.petSafe })} className={`mt-3 rounded-xl border px-3 py-2 text-sm font-bold ${editForm.petSafe ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>🐾 {editForm.petSafe ? "Apta para mascotas" : "Marcar apta para mascotas"}</button>
                  </div>
                )}

                <label className="block text-sm font-bold">Variantes
                  <textarea value={editForm.variantsText} onChange={(e) => setEditForm({ ...editForm, variantsText: e.target.value })} rows={4} placeholder={"nombre | precio | stock | SKU"} className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-3" />
                </label>
                <label className="block text-sm font-bold">Etiquetas
                  <input value={editForm.tags} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} placeholder="regalo, verano, premium" className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3" />
                </label>

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="text-sm font-bold">Título SEO
                    <input value={editForm.seoTitle} onChange={(e) => setEditForm({ ...editForm, seoTitle: e.target.value.slice(0, 70) })} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3" />
                  </label>
                  <label className="text-sm font-bold">Meta descripción
                    <textarea value={editForm.seoDescription} onChange={(e) => setEditForm({ ...editForm, seoDescription: e.target.value.slice(0, 170) })} rows={3} className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-4 py-3" />
                  </label>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 mt-7 flex justify-end gap-2 border-t border-border bg-card/95 pt-4 backdrop-blur">
              <button onClick={cancelEdit} className="rounded-xl border border-border px-5 py-3 font-bold">Cancelar</button>
              <button onClick={() => void saveEdit()} disabled={saving} className="rounded-xl bg-primary px-6 py-3 font-black text-primary-foreground disabled:opacity-60">{saving ? "Guardando…" : "Guardar cambios"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
