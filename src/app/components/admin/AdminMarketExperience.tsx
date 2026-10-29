import { useEffect, useMemo, useState } from "react";
import { Copy, Edit3, Home, Layers3, MapPin, PackagePlus, Search, Shirt, Sparkles, Store, Trash2, Upload, WandSparkles, X } from "lucide-react";
import { toast } from "sonner";
import { AdminElementControls, AdminAddElement, AdminScheduleFields, reorderItem } from "./AdminElementControls";
import { AdminComponentRegistry, AdminVisibilityOverview } from "./AdminComponentRegistry";
import { AdminSiteDiagnostics } from "./AdminSiteDiagnostics";
import { AdminCardDesignFields, AdminPromoDesignFields } from "./AdminVisualStyleFields";
import { AdminCampaigns } from "./AdminCampaigns";
import { AdminComponentAnalytics } from "./AdminComponentAnalytics";
import { backendApi, backendStorage } from "../../lib/backendStorage";
import type { SiteContent } from "../../lib/siteContent";
import {
  DEFAULT_HOME_SECTION_ORDER,
  PLANT_SHOP_HOME_SECTION_ORDER,
  getMarketExperience,
  type MarketExperienceContent,
  type MarketHomeSectionId,
  withMarketExperience,
} from "../../lib/marketExperience";

function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      {multiline ? (
        <textarea
          rows={3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      )}
    </label>
  );
}

async function compressImage(file: File, maxWidth = 1800, targetBytes = 1_500_000) {
  if (!file.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen");
  if (file.size > 8 * 1024 * 1024) throw new Error("La imagen supera 8 MB");

  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo procesar la imagen"));
    img.src = source;
  });

  const naturalWidth = Math.max(1, image.naturalWidth || image.width || 1);
  const naturalHeight = Math.max(1, image.naturalHeight || image.height || 1);
  const maxHeight = 1800;
  const maxPixels = 3_000_000;
  const pixelScale = Math.sqrt(maxPixels / Math.max(1, naturalWidth * naturalHeight));
  const scale = Math.min(1, maxWidth / naturalWidth, maxHeight / naturalHeight, pixelScale);

  let width = Math.max(1, Math.round(naturalWidth * scale));
  let height = Math.max(1, Math.round(naturalHeight * scale));
  let quality = 0.86;

  const validDataUrl = (value: string) => /^data:image\/jpeg;base64,.+/i.test(value);
  const dataUrlBytes = (value: string) => {
    if (!validDataUrl(value)) return Number.POSITIVE_INFINITY;
    const payload = value.slice(value.indexOf(",") + 1);
    return Math.ceil((payload.length * 3) / 4);
  };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("El navegador no puede procesar imágenes");
    ctx.drawImage(image, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (validDataUrl(dataUrl) && dataUrlBytes(dataUrl) <= targetBytes) return dataUrl;

    width = Math.max(480, Math.round(width * 0.82));
    height = Math.max(1, Math.round(naturalHeight * (width / naturalWidth)));
    quality = Math.max(0.5, quality - 0.06);
  }

  throw new Error("Safari no pudo convertir la imagen a un formato válido. Prueba otra imagen o una versión más pequeña.");
}

function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [working, setWorking] = useState(false);

  const upload = async (file?: File) => {
    if (!file) return;
    setWorking(true);
    try {
      const status = await backendApi.siteMediaStatus();
      if (status.provider !== "cloudflare_r2" || !status.configured || status.connection?.ok === false) {
        throw new Error(status.connection?.error || "Cloudflare R2 no está disponible");
      }
      const result = await backendApi.uploadSiteMediaFile(file);
      const uploadedUrl = String(result.media?.url || "").trim();
      if (!uploadedUrl) throw new Error("R2 no devolvió una URL pública para la imagen");
      onChange(uploadedUrl);
      toast.success("Imagen subida a Cloudflare R2. Pulsa Guardar y publicar.");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo subir la imagen a Cloudflare R2");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-2">
      <Field label={label} value={value.startsWith("data:image/") ? "" : value} onChange={onChange} />
      <div className="flex flex-wrap gap-2">
        <label className="relative inline-flex cursor-pointer items-center gap-2 overflow-hidden rounded-xl bg-[#315b42] px-3 py-2 text-xs font-black text-white">
          <Upload className="h-4 w-4" />
          {working ? "Subiendo..." : "Subir imagen"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            disabled={working}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(event) => {
              const input = event.currentTarget;
              const file = input.files?.[0];
              void upload(file).finally(() => {
                input.value = "";
              });
            }}
          />
        </label>
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded-xl border border-border px-3 py-2 text-xs font-black"
          >
            Quitar
          </button>
        ) : null}
      </div>
      {value ? (
        <img
          src={value}
          alt=""
          className="h-32 w-full rounded-xl border border-border object-cover"
        />
      ) : null}
    </div>
  );
}

type CommerceProduct = {
  id: string | number;
  name: string;
  description?: string;
  category: string;
  price: number;
  salePrice?: number;
  cost?: number;
  iva?: number;
  sku?: string;
  stock?: number;
  image?: string;
  images?: string[];
  active?: boolean;
  featured?: boolean;
  onSale?: boolean;
  status?: "draft" | "published" | "hidden" | "soldout";
  tags?: string[];
  variants?: Array<{ name: string; price?: number; stock?: number; sku?: string; image?: string }>;
  relatedProductIds?: Array<string | number>;
  personalization?: boolean;
  deletedAt?: string;
  compareAtPrice?: number;
  weight?: number;
  barcode?: string;
  vendor?: string;
  collection?: string;
  seoTitle?: string;
  seoDescription?: string;
  scheduledAt?: string;
  minOrder?: number;
  maxOrder?: number;
  care?: string;
  material?: string;
  flavor?: string;
  serviceDuration?: string;
};

const CATEGORY_ALIASES: Record<string, string[]> = {
  plantas: ["plantas", "plantas-interior", "plantas-exterior", "flores", "orquideas"],
  semillas: ["semillas"],
  jardineria: ["jardineria", "jardín", "jardin"],
  sustratos: ["sustratos", "tierra", "tierra-y-sustratos"],
  decoracion: ["decoracion", "decoración"],
  servicios: ["servicios"],
  dulce: ["dulce", "tartas", "postres"],
  moda: ["moda", "ropa"],
};

function categoryKey(title: string, href: string) {
  const text = (title + " " + href).toLowerCase();
  if (text.includes("dulce")) return "dulce";
  if (text.includes("moda")) return "moda";
  if (text.includes("semilla")) return "semillas";
  if (text.includes("sustrat") || text.includes("tierra")) return "sustratos";
  if (text.includes("decor")) return "decoracion";
  if (text.includes("servicio")) return "servicios";
  if (text.includes("jardin")) return "jardineria";
  return "plantas";
}

function ProductManager({ title, category, onClose }: { title: string; category: string; onClose: () => void }) {
  const [products, setProducts] = useState<CommerceProduct[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<CommerceProduct | null>(null);
  const [selected, setSelected] = useState<Array<string | number>>([]);
  const [sort, setSort] = useState("name");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showTrash, setShowTrash] = useState(false);

  const load = async () => {
    try {
      await backendApi.bootstrapCommerceCatalog().catch(() => null);
      const result = await backendApi.listCommerceProducts({ includeArchived: true });
      setProducts(Array.isArray(result.products) ? result.products : []);
    } catch {
      try { setProducts(JSON.parse(backendStorage.getItem("adminProducts") || "[]")); }
      catch { setProducts([]); }
    }
  };
  useEffect(() => { void load(); }, []);

  const aliases = CATEGORY_ALIASES[category] || [category];
  const visible = useMemo(() => products
    .filter((p) => (showTrash ? !!p.deletedAt : !p.deletedAt) && aliases.includes(String(p.category || "").toLowerCase()))
    .filter((p) => statusFilter === "all" || (p.status || (p.active!==false ? "published" : "hidden")) === statusFilter)
    .filter((p) => !query || (p.name + " " + (p.sku || "") + " " + (p.tags||[]).join(" ")).toLowerCase().includes(query.toLowerCase()))
    .sort((a,b) => sort==="price" ? Number(a.price)-Number(b.price) : sort==="stock" ? Number(a.stock||0)-Number(b.stock||0) : a.name.localeCompare(b.name)), [products, query, category, sort, statusFilter, showTrash]);

  const persist = async (next: CommerceProduct[]) => {
    const previous = new Map(products.map((p) => [String(p.id), p]));
    const nextMap = new Map(next.map((p) => [String(p.id), p]));
    setProducts(next);

    try {
      for (const product of next) {
        const exists = previous.has(String(product.id));
        const status = product.deletedAt ? "archived" : product.status === "published" ? "active" : "draft";
        const payload = {
          ...product,
          status,
          active: status === "active",
          collections: [category],
          taxRate: product.iva ?? 21,
          compareAtPrice: product.compareAtPrice || (product.onSale && product.salePrice ? product.price : null),
          images: product.images?.length ? product.images : product.image ? [product.image] : [],
        };
        if (exists) await backendApi.updateCommerceProduct(product.id, payload);
        else await backendApi.createCommerceProduct(payload);
      }
      for (const [id] of previous) {
        if (!nextMap.has(id)) await backendApi.deleteCommerceProduct(id, true);
      }
      await backendStorage.refresh().catch(() => null);
    } catch (error: any) {
      const fallback = await backendStorage.setItem("adminProducts", JSON.stringify(next));
      if (!fallback.ok) toast.error(error?.message || fallback.error || "No se pudo sincronizar el catálogo");
    }
  };

  const blank = (): CommerceProduct => ({
    id: Date.now(), name: "", description: "", category, price: 0, cost: 0, iva: 21, sku: "", stock: 0,
    image: "", images: [], active: false, featured: false, onSale: false, status: "draft", tags: [], variants: [],
    relatedProductIds: [], personalization: false, care: "", material: "", flavor: "", serviceDuration: "", compareAtPrice: 0, weight: 0, barcode: "", vendor: "", collection: "", seoTitle: "", seoDescription: "", scheduledAt: "", minOrder: 1, maxOrder: 99,
  });

  const save = async () => {
    if (!editing || !editing.name.trim()) return toast.error("Escribe el nombre del producto");
    if (Number(editing.price) < 0) return toast.error("El precio no es válido");
    const normalized = { ...editing, category, active: editing.status === "published", sku: editing.sku?.trim() || `HER-${category.slice(0,4).toUpperCase()}-${String(editing.id).slice(-6)}` };
    const exists = products.some((p) => p.id === normalized.id);
    await persist(exists ? products.map((p) => p.id === normalized.id ? normalized : p) : [normalized, ...products]);
    setEditing(null); toast.success("Producto guardado en el catálogo central");
  };

  const duplicate = async (product: CommerceProduct) => {
    const copy = { ...product, id: Date.now(), name: product.name + " (copia)", sku: "", status: "draft" as const, active: false };
    await persist([copy, ...products]); toast.success("Producto duplicado como borrador");
  };

  const bulkStatus = async (status: CommerceProduct["status"]) => {
    if (!selected.length) return toast.error("Selecciona al menos un producto");
    await persist(products.map(p => selected.includes(p.id) ? {...p,status,active:status==="published"} : p));
    setSelected([]); toast.success("Productos actualizados");
  };

  const exportCsv = () => {
    const rows = visible.map(p => [p.sku||"",p.name,p.category,p.price,p.stock||0,p.iva||21,p.status||"", (p.tags||[]).join("|")]);
    const csv = [["SKU","Nombre","Categoría","Precio","Stock","IVA","Estado","Etiquetas"],...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})); a.download=`herencia-${category}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  const remove = async (id: string | number) => {
    if (!confirm("¿Mover este producto a la papelera?")) return;
    await persist(products.map((p:any) => p.id === id ? { ...p, active:false, deletedAt:new Date().toISOString() } : p));
  };

  const restore = async (id: string | number) => {
    await persist(products.map((p:any) => p.id === id ? { ...p, deletedAt: undefined, status:"draft", active:false } : p));
    toast.success("Producto recuperado como borrador");
  };

  const importCsv = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return toast.error("El CSV no contiene productos");
    const parse = (line:string) => line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v=>v.replace(/^"|"$/g,"").replace(/""/g,'"')) || [];
    const headers=parse(lines[0]).map(x=>x.toLowerCase());
    const imported=lines.slice(1).map((line,idx)=>{
      const row=parse(line); const get=(name:string)=>row[headers.indexOf(name)]||"";
      return { ...blank(), id:Date.now()+idx, sku:get("sku"), name:get("nombre")||get("name"), category:category, price:Number(get("precio")||get("price")||0), stock:Number(get("stock")||0), iva:Number(get("iva")||21), status:(get("estado")||"draft") as any, active:(get("estado")||"draft")==="published", tags:(get("etiquetas")||"").split("|").filter(Boolean) };
    }).filter(p=>p.name);
    if(!imported.length) return toast.error("No se encontraron filas válidas");
    await persist([...imported,...products]); toast.success(`${imported.length} productos importados`);
  };

  return <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/55 p-3 backdrop-blur-sm sm:p-6">
    <div className="mx-auto max-w-6xl rounded-3xl border border-border bg-[#fbfaf6] shadow-2xl">
      <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-t-3xl border-b border-border bg-white/95 p-5 backdrop-blur md:flex-row md:items-center md:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[.16em] text-primary">Catálogo central</p><h3 className="text-2xl font-black">{title}</h3><p className="text-sm text-muted-foreground">{visible.length} productos · sincronizados con tienda, stock, carrito y TPV</p></div>
        <div className="flex gap-2"><button onClick={()=>setEditing(blank())} className="inline-flex items-center gap-2 rounded-xl bg-[#315b42] px-4 py-2.5 text-sm font-black text-white"><PackagePlus className="h-4 w-4"/>Nuevo producto</button><button onClick={onClose} className="rounded-xl border border-border p-2.5"><X className="h-5 w-5"/></button></div>
      </div>
      <div className="p-5">
        <div className="mb-4 grid gap-2 lg:grid-cols-[1fr_auto_auto_auto]">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3"><Search className="h-4 w-4 text-muted-foreground"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por nombre, SKU o etiqueta…" className="w-full bg-transparent py-3 outline-none"/></div>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-bold"><option value="all">Todos los estados</option><option value="published">Publicados</option><option value="draft">Borradores</option><option value="hidden">Ocultos</option><option value="soldout">Agotados</option></select>
          <select value={sort} onChange={e=>setSort(e.target.value)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-bold"><option value="name">Ordenar: nombre</option><option value="price">Precio</option><option value="stock">Stock</option></select>
          <div className="flex gap-2"><button onClick={exportCsv} className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-black">Exportar CSV</button><label className="cursor-pointer rounded-xl border border-border bg-white px-3 py-2 text-sm font-black">Importar CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={e=>void importCsv(e.target.files?.[0])}/></label><button onClick={()=>setShowTrash(!showTrash)} className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-black">{showTrash?"Ver catálogo":"Papelera"}</button></div>
        </div>
        {selected.length?<div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-[#eef4ef] p-3 text-sm"><b>{selected.length} seleccionados</b><button onClick={()=>void bulkStatus("published")} className="rounded-lg bg-[#315b42] px-3 py-2 font-bold text-white">Publicar</button><button onClick={()=>void bulkStatus("hidden")} className="rounded-lg border border-border bg-white px-3 py-2 font-bold">Ocultar</button><button onClick={()=>void bulkStatus("draft")} className="rounded-lg border border-border bg-white px-3 py-2 font-bold">Borrador</button></div>:null}
        <div className="grid gap-3">
          {visible.map(p=><div key={p.id} className="grid gap-4 rounded-2xl border border-border bg-white p-4 md:grid-cols-[84px_1fr_auto] md:items-center">
            <div className="flex items-center gap-3"><input type="checkbox" checked={selected.includes(p.id)} onChange={e=>setSelected(e.target.checked?[...selected,p.id]:selected.filter(id=>id!==p.id))}/><div className="h-20 w-20 overflow-hidden rounded-xl bg-muted">{p.image?<img src={p.image} className="h-full w-full object-cover"/>:null}</div></div>
            <div><div className="flex flex-wrap items-center gap-2"><p className="font-black">{p.name}</p><span className="rounded-full bg-muted px-2 py-1 text-[11px] font-bold uppercase">{p.status || (p.active!==false?"published":"hidden")}</span></div><p className="mt-1 text-sm text-muted-foreground">{p.sku || "Sin SKU"} · Stock {Number(p.stock||0)} · IVA {Number(p.iva||21)}%</p><p className="mt-1 font-black">{Number(p.salePrice||p.price||0).toLocaleString("es-ES",{style:"currency",currency:"EUR"})}</p></div>
            <div className="flex flex-wrap gap-2">{showTrash?<button onClick={()=>void restore(p.id)} className="rounded-xl border border-emerald-200 px-3 py-2 text-xs font-black text-emerald-700">Recuperar</button>:null}<button onClick={()=>setEditing({...p})} className="rounded-xl border border-border p-2.5" title="Editar"><Edit3 className="h-4 w-4"/></button><button onClick={()=>void duplicate(p)} className="rounded-xl border border-border p-2.5" title="Duplicar"><Copy className="h-4 w-4"/></button><button onClick={()=>void remove(p.id)} className="rounded-xl border border-red-200 p-2.5 text-red-600" title="Papelera"><Trash2 className="h-4 w-4"/></button></div>
          </div>)}
          {!visible.length?<div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center"><PackagePlus className="mx-auto h-9 w-9 text-primary"/><p className="mt-3 font-black">Aún no hay productos en {title}</p><button onClick={()=>setEditing(blank())} className="mt-3 text-sm font-black text-primary">+ Añadir el primero</button></div>:null}
        </div>
      </div>
    </div>
    {editing?<div className="fixed inset-0 z-[90] overflow-y-auto bg-black/50 p-4"><div className="mx-auto max-w-4xl rounded-3xl bg-white p-6 shadow-2xl">
      <div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[.14em] text-primary">Ficha comercial</p><h4 className="text-2xl font-black">{editing.name||"Nuevo producto"}</h4></div><button onClick={()=>setEditing(null)}><X/></button></div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre" value={editing.name} onChange={name=>setEditing({...editing,name})}/>
        <Field label="SKU / código de barras" value={editing.sku||""} onChange={sku=>setEditing({...editing,sku})}/>
        <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-[.12em] text-muted-foreground">Precio €</span><input type="number" step=".01" value={editing.price} onChange={e=>setEditing({...editing,price:Number(e.target.value)})} className="w-full rounded-xl border border-border px-3 py-2.5"/></label>
        <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-[.12em] text-muted-foreground">Coste €</span><input type="number" step=".01" value={editing.cost||0} onChange={e=>setEditing({...editing,cost:Number(e.target.value)})} className="w-full rounded-xl border border-border px-3 py-2.5"/></label>
        <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-[.12em] text-muted-foreground">Stock</span><input type="number" value={editing.stock||0} onChange={e=>setEditing({...editing,stock:Math.max(0,Number(e.target.value))})} className="w-full rounded-xl border border-border px-3 py-2.5"/></label>
        <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-[.12em] text-muted-foreground">IVA %</span><input type="number" step=".01" value={editing.iva||21} onChange={e=>setEditing({...editing,iva:Number(e.target.value)})} className="w-full rounded-xl border border-border px-3 py-2.5"/></label>
        <Field label="Código de barras / EAN" value={editing.barcode||""} onChange={barcode=>setEditing({...editing,barcode})}/>
        <Field label="Proveedor / marca" value={editing.vendor||""} onChange={vendor=>setEditing({...editing,vendor})}/>
        <Field label="Colección / subcategoría" value={editing.collection||""} onChange={collection=>setEditing({...editing,collection})}/>
        <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-[.12em] text-muted-foreground">Peso (g)</span><input type="number" value={editing.weight||0} onChange={e=>setEditing({...editing,weight:Number(e.target.value)})} className="w-full rounded-xl border border-border px-3 py-2.5"/></label>
        <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-[.12em] text-muted-foreground">Precio anterior €</span><input type="number" step=".01" value={editing.compareAtPrice||0} onChange={e=>setEditing({...editing,compareAtPrice:Number(e.target.value)})} className="w-full rounded-xl border border-border px-3 py-2.5"/></label>
        <Field label="Publicar el (ISO/fecha)" value={editing.scheduledAt||""} onChange={scheduledAt=>setEditing({...editing,scheduledAt})}/>
        <div className="md:col-span-2"><Field label="Descripción" value={editing.description||""} onChange={description=>setEditing({...editing,description})} multiline/></div><div className="md:col-span-2 rounded-2xl border border-border bg-[#f7f7f3] p-4"><p className="mb-3 font-black">Datos específicos de ${title}</p><div className="grid gap-3 md:grid-cols-2">
          {category==="plantas"||category==="semillas"||category==="jardineria"||category==="sustratos"?<Field label="Cuidados / instrucciones" value={editing.care||""} onChange={care=>setEditing({...editing,care})} multiline/>:null}
          {category==="moda"||category==="decoracion"?<Field label="Material / composición" value={editing.material||""} onChange={material=>setEditing({...editing,material})}/>:null}
          {category==="dulce"?<Field label="Sabor / alérgenos / conservación" value={editing.flavor||""} onChange={flavor=>setEditing({...editing,flavor})} multiline/>:null}
          {category==="servicios"?<Field label="Duración / condiciones del servicio" value={editing.serviceDuration||""} onChange={serviceDuration=>setEditing({...editing,serviceDuration})} multiline/>:null}
        </div></div>
        <div className="md:col-span-2"><ImageField label="Imagen principal" value={editing.image||""} onChange={image=>setEditing({...editing,image})}/></div>
        <div className="md:col-span-2 rounded-2xl border border-border p-4"><p className="mb-3 font-black">Galería de imágenes</p><div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">{(editing.images||[]).map((img,i)=><div key={i} className="rounded-xl border border-border p-2"><img src={img} className="h-28 w-full rounded-lg object-cover"/><div className="mt-2 flex gap-1"><button onClick={()=>setEditing({...editing,image:img})} className="flex-1 rounded-lg bg-muted px-2 py-1 text-xs font-bold">Portada</button><button onClick={()=>setEditing({...editing,images:(editing.images||[]).filter((_,x)=>x!==i)})} className="rounded-lg px-2 py-1 text-xs text-red-600">Quitar</button></div></div>)}</div><div className="mt-3"><ImageField label="Añadir imagen a galería" value="" onChange={img=>img&&setEditing({...editing,images:[...(editing.images||[]),img]})}/></div></div>
        <div className="md:col-span-2 rounded-2xl border border-border bg-muted/20 p-4"><p className="mb-3 font-black">SEO y venta</p><div className="grid gap-3 md:grid-cols-2"><Field label="Título SEO" value={editing.seoTitle||""} onChange={seoTitle=>setEditing({...editing,seoTitle})}/><Field label="Meta descripción" value={editing.seoDescription||""} onChange={seoDescription=>setEditing({...editing,seoDescription})}/><label className="text-sm font-bold">Compra mínima<input type="number" min="1" value={editing.minOrder||1} onChange={e=>setEditing({...editing,minOrder:Number(e.target.value)})} className="mt-2 w-full rounded-xl border border-border p-2.5"/></label><label className="text-sm font-bold">Compra máxima<input type="number" min="1" value={editing.maxOrder||99} onChange={e=>setEditing({...editing,maxOrder:Number(e.target.value)})} className="mt-2 w-full rounded-xl border border-border p-2.5"/></label></div></div>
        <div className="md:col-span-2"><Field label="Etiquetas (separadas por coma)" value={(editing.tags||[]).join(", ")} onChange={v=>setEditing({...editing,tags:v.split(",").map(x=>x.trim()).filter(Boolean)})}/></div>
        <div className="md:col-span-2"><Field label="Variantes · una por línea: nombre | precio | stock | SKU | imagen" value={(editing.variants||[]).map(v=>`${v.name} | ${v.price??""} | ${v.stock??""} | ${v.sku??""} | ${v.image??""}`).join("\n")} onChange={v=>setEditing({...editing,variants:v.split("\n").map(x=>{const [n,p,s,sku,image]=x.split("|").map(y=>y.trim());return {name:n,price:p?Number(p):undefined,stock:s?Number(s):undefined,sku:sku||undefined,image:image||undefined}}).filter(x=>x.name)})} multiline/></div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <label className="rounded-xl border border-border p-3 text-sm font-bold">Estado<select value={editing.status||"draft"} onChange={e=>setEditing({...editing,status:e.target.value as any})} className="mt-2 w-full rounded-lg border border-border p-2"><option value="draft">Borrador</option><option value="published">Publicado</option><option value="hidden">Oculto</option><option value="soldout">Agotado</option></select></label>
        <label className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm font-bold"><input type="checkbox" checked={!!editing.featured} onChange={e=>setEditing({...editing,featured:e.target.checked})}/>Destacado en tienda</label>
        <label className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm font-bold"><input type="checkbox" checked={!!editing.personalization} onChange={e=>setEditing({...editing,personalization:e.target.checked})}/>Permitir personalización</label>
      </div>
      <div className="mt-6 flex justify-end gap-2"><button onClick={()=>setEditing(null)} className="rounded-xl border border-border px-5 py-3 font-bold">Cancelar</button><button onClick={()=>void save()} className="rounded-xl bg-[#315b42] px-6 py-3 font-black text-white">Guardar producto</button></div>
    </div></div>:null}
  </div>;
}

export function AdminMarketExperience({
  site,
  onChange,
}: {
  site: SiteContent;
  onChange: (site: SiteContent) => void;
}) {
  const market = getMarketExperience(site);
  const productDisplay = market.home.productDisplay!;
  const [managedCategory, setManagedCategory] = useState<{ title: string; key: string } | null>(null);
  const [draggedSection, setDraggedSection] = useState<MarketHomeSectionId | null>(null);
  const [products3D, setProducts3D] = useState<Array<{id: string | number; name: string; image?: string; status?: string; active?: boolean; deletedAt?: unknown}>>([]);
  const [search3D, setSearch3D] = useState("");
  const [loading3D, setLoading3D] = useState(false);
  const reloadProducts3D = async () => {
    setLoading3D(true);
    try {
      const result = await backendApi.listCommerceProducts({includeArchived: true});
      setProducts3D(Array.isArray(result.products) ? result.products : []);
    } catch {
      try {
        const cached = JSON.parse(backendStorage.getItem("adminProducts") || "[]");
        setProducts3D(Array.isArray(cached) ? cached : []);
      } catch { setProducts3D([]); }
    } finally { setLoading3D(false); }
  };
  useEffect(() => { void reloadProducts3D(); }, []);


  const setMarket = (next: MarketExperienceContent) => {
    onChange(withMarketExperience(site, next));
  };

  const patch = (value: Partial<MarketExperienceContent>) => {
    setMarket({ ...market, ...value });
  };

  const patchHome = (value: Partial<MarketExperienceContent["home"]>) => {
    const controls = { ...market.componentControls };
    if (value.sections) {
      for (const [key, enabled] of Object.entries(value.sections)) {
        const id = `home.${key}`;
        controls[id] = { ...(controls[id] || {}), enabled };
      }
    }
    setMarket({
      ...market,
      home: { ...market.home, ...value },
      componentControls: controls,
    });
  };

  const patchLayout = (key: keyof MarketExperienceContent["layout"], enabled: boolean) => {
    const id = key === "footer" ? "footer.main" : `header.${key}`;
    setMarket({
      ...market,
      layout: { ...market.layout, [key]: enabled },
      componentControls: {
        ...market.componentControls,
        [id]: { ...(market.componentControls[id] || {}), enabled },
      },
    });
  };

  const patchPromo = (
    kind: "dulce" | "moda",
    value: Partial<MarketExperienceContent["dulce"]>
  ) => {
    setMarket({ ...market, [kind]: { ...market[kind], ...value } } as MarketExperienceContent);
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-[#dce6dc] bg-[#fbfaf6] shadow-sm">
      <div className="border-b border-[#dce6dc] bg-gradient-to-r from-[#173d2a] to-[#315b42] px-6 py-5 text-white">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-white/75">
              <Layers3 className="h-4 w-4" />
              Frontend sincronizado
            </div>
            <h3 className="mt-2 text-2xl font-black">HERENCIA MARKET · Contenido visible</h3>
            <p className="mt-1 max-w-3xl text-sm text-white/80">
              Esta zona corresponde directamente a la nueva cara de la tienda. Lo que edites aquí cambia
              Inicio, Servicios, Dulce, Moda, Nosotros y HERENCIA SALES al publicar.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold">
            Frontend ⇄ Administración
          </div>
        </div>
      </div>

      <div className="space-y-8 p-6">
        <AdminVisibilityOverview market={market} onChange={setMarket} />
        <AdminComponentRegistry market={market} onChange={setMarket} />
        <AdminSiteDiagnostics site={site} market={market} />
        <AdminComponentAnalytics />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="mb-4 flex items-center gap-2 font-black">
              <MapPin className="h-5 w-5 text-primary" />
              Ubicación y franja superior
            </div>
            <div className="space-y-4">
              <Field
                label="Ubicación pública"
                value={market.locationLabel}
                onChange={(locationLabel) => patch({ locationLabel })}
              />
              <Field
                label="Mensaje superior"
                value={market.announcement}
                onChange={(announcement) => patch({ announcement })}
                multiline
              />
            </div>
          </div>

          <div id="market-editor-navegacion" className="scroll-mt-6 rounded-2xl border border-border bg-white p-5">
            <div className="mb-4 flex items-center gap-2 font-black">
              <Store className="h-5 w-5 text-primary" />
              Menú principal
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {market.navigation.map((item, index) => (
                <div key={index} className="rounded-xl border border-border bg-[#fbfaf6] p-3">
                  <AdminElementControls label={item.label || "Enlace"} visible={item.visible !== false}
                    onToggle={(visible) => patch({ navigation: market.navigation.map((current, i) => i === index ? { ...current, visible } : current) })}
                    onMoveUp={() => patch({ navigation: reorderItem(market.navigation, index, index - 1) })}
                    onMoveDown={() => patch({ navigation: reorderItem(market.navigation, index, index + 1) })}
                    moveUpDisabled={index === 0} moveDownDisabled={index === market.navigation.length - 1}
                    onDuplicate={() => patch({ navigation: [...market.navigation.slice(0, index + 1), { ...item }, ...market.navigation.slice(index + 1)] })}
                    onRemove={() => patch({ navigation: market.navigation.filter((_, i) => i !== index) })}
                  />
                  <AdminScheduleFields label={item.label} value={item.schedule} onChange={(schedule) => patch({ navigation: market.navigation.map((current, i) => i === index ? { ...current, schedule } : current) })} />
                  <div className="my-2 flex flex-wrap items-center gap-4 text-xs font-bold">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={item.showDesktop !== false} onChange={(event) => patch({ navigation: market.navigation.map((entry, i) => i === index ? { ...entry, showDesktop: event.target.checked } : entry) })} /> Ordenador</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={item.showMobile !== false} onChange={(event) => patch({ navigation: market.navigation.map((entry, i) => i === index ? { ...entry, showMobile: event.target.checked } : entry) })} /> Móvil</label>
                  </div>
                  <details className="my-2 rounded-xl border border-[#dce6dc] bg-white p-3">
                    <summary className="cursor-pointer text-xs font-black">Submenú · {(item.children || []).length} enlaces</summary>
                    <div className="mt-3 space-y-3">
                      {(item.children || []).map((child, childIndex) => (
                        <div key={childIndex} className="space-y-2 rounded-xl border bg-[#fafcf9] p-3">
                          <AdminElementControls label={child.label} visible={child.visible !== false}
                            onToggle={(visible) => patch({ navigation: market.navigation.map((entry, i) => i === index ? { ...entry, children: (entry.children || []).map((link, j) => j === childIndex ? { ...link, visible } : link) } : entry) })}
                            onMoveUp={() => patch({ navigation: market.navigation.map((entry, i) => i === index ? { ...entry, children: reorderItem(entry.children || [], childIndex, childIndex - 1) } : entry) })}
                            onMoveDown={() => patch({ navigation: market.navigation.map((entry, i) => i === index ? { ...entry, children: reorderItem(entry.children || [], childIndex, childIndex + 1) } : entry) })}
                            moveUpDisabled={childIndex === 0} moveDownDisabled={childIndex === (item.children || []).length - 1}
                            onRemove={() => patch({ navigation: market.navigation.map((entry, i) => i === index ? { ...entry, children: (entry.children || []).filter((_, j) => j !== childIndex) } : entry) })}
                          />
                          <Field label="Título" value={child.label} onChange={(label) => patch({ navigation: market.navigation.map((entry, i) => i === index ? { ...entry, children: (entry.children || []).map((link, j) => j === childIndex ? { ...link, label } : link) } : entry) })} />
                          <Field label="Destino" value={child.href} onChange={(href) => patch({ navigation: market.navigation.map((entry, i) => i === index ? { ...entry, children: (entry.children || []).map((link, j) => j === childIndex ? { ...link, href } : link) } : entry) })} />
                          <AdminScheduleFields label={child.label} value={child.schedule} onChange={(schedule) => patch({ navigation: market.navigation.map((entry, i) => i === index ? { ...entry, children: (entry.children || []).map((link, j) => j === childIndex ? { ...link, schedule } : link) } : entry) })} />
                        </div>
                      ))}
                      <AdminAddElement label="Añadir subenlace" onAdd={() => patch({ navigation: market.navigation.map((entry, i) => i === index ? { ...entry, children: [...(entry.children || []), { label: "Nuevo subenlace", href: "/productos", visible: false }] } : entry) })} />
                    </div>
                  </details>

                  <Field
                    label={`Enlace ${index + 1} · texto`}
                    value={item.label}
                    onChange={(label) => {
                      const navigation = market.navigation.map((current, i) =>
                        i === index ? { ...current, label } : current
                      );
                      patch({ navigation });
                    }}
                  />
                  <div className="mt-2">
                    <Field
                      label="Destino"
                      value={item.href}
                      onChange={(href) => {
                        const navigation = market.navigation.map((current, i) =>
                          i === index ? { ...current, href } : current
                        );
                        patch({ navigation });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3"><AdminAddElement label="Añadir enlace" onAdd={() => patch({ navigation: [...market.navigation, { label: "Nuevo enlace", href: "/productos", visible: false }] })} /></div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-5">
          <h4 className="mb-3 font-black">Cabecera y pie de página · ON/OFF</h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ["announcement", "Franja superior"], ["search", "Buscador"], ["account", "Mi cuenta"],
              ["favorites", "Favoritos"], ["cart", "Carrito"], ["deliverySelector", "Selector de entrega"],
              ["footer", "Pie de página"],
            ] as Array<[keyof MarketExperienceContent["layout"], string]>).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 rounded-xl bg-[#f5f8f3] p-3 text-sm font-bold">
                <input type="checkbox" checked={market.layout[key]} onChange={(event) => patchLayout(key, event.target.checked)} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div id="market-editor-portada" className="scroll-mt-6 rounded-2xl border border-border bg-white p-5">
          <div className="mb-5 flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-black">Inicio · Hero y estructura principal</h4>
              <p className="text-sm text-muted-foreground">
                La fotografía principal debe representar hogar, naturaleza y estilo de vida; no un ramo como protagonista.
              </p>
            </div>
          </div>

          <div className="mb-5 rounded-xl border border-[#e0e9dd] bg-[#f5f9f5] p-4">
            <p className="mb-2 font-black">ON/OFF y posición de las secciones de Inicio</p>
            <p className="mb-4 text-xs text-muted-foreground">Arrastra las tarjetas o utiliza las flechas para cambiar el orden real de aparición en la tienda.</p>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border border-[#dce6dc] bg-white px-4 py-3 text-sm font-semibold">
                <input type="checkbox" checked={market.home.referenceNavigation !== false}
                  onChange={(e) => patchHome({ referenceNavigation: e.target.checked })}/>
                Orden de menú del boceto (respeta todos tus enlaces)
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-[#dce6dc] bg-white px-4 py-3 text-sm font-semibold">
                <input type="checkbox" checked={market.home.referenceCategories !== false}
                  onChange={(e) => patchHome({ referenceCategories: e.target.checked })}/>
                Tarjetas de categorías con imagen como el boceto
              </label>
            </div>
            <div className="mb-5 space-y-4 rounded-2xl border border-[#c7d8c7] bg-[#f3f8f1] p-5">
              <div>
                <h4 className="text-lg font-bold text-[#234b35]">Escaparate de plantas · Diseño de tienda</h4>
                <p className="mt-1 text-sm text-[#526c55]">Las tarjetas, fotografías, enlaces, precios y asistentes se alimentan de las configuraciones y catálogos reales; este botón solo cambia distribución, nunca elimina productos ni sobreescribe tus fotografías. Guarda y publica el borrador con el sistema habitual.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button"
                  onClick={() => patchHome({
                    shopFirst: true,
                    shopFirstPreviousSectionOrder: market.home.shopFirst
                      ? market.home.shopFirstPreviousSectionOrder
                      : [...market.home.sectionOrder],
                    sectionOrder: [...PLANT_SHOP_HOME_SECTION_ORDER],
                    referenceNavigation: true,
                    referenceCategories: true,
                    referenceHero: true,
                    categoryGridLimit: 5,
                    productDisplay: { ...productDisplay, mode: "plants", limit: 6, columns: 6, filtersEnabled: false },
                    creations3D: { ...market.home.creations3D, limit: 6 },
                  })}
                  className="rounded-lg bg-[#234b35] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#173d2a]">
                  Aplicar diseño del boceto en borrador
                </button>
                <button type="button" onClick={() => patchHome({
                  shopFirst: false,
                  sectionOrder: market.home.shopFirstPreviousSectionOrder || market.home.sectionOrder,
                  shopFirstPreviousSectionOrder: undefined,
                })}
                  className="rounded-lg border border-[#abc3ad] bg-white px-4 py-2.5 text-sm font-semibold text-[#234b35] hover:bg-[#e5efe5]">
                  Volver a la distribución anterior
                </button>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={market.home.shopFirst === true}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    patchHome(enabled
                      ? {
                          shopFirst: true,
                          shopFirstPreviousSectionOrder: [...market.home.sectionOrder],
                          sectionOrder: [...PLANT_SHOP_HOME_SECTION_ORDER],
                        }
                      : {
                          shopFirst: false,
                          sectionOrder: market.home.shopFirstPreviousSectionOrder || market.home.sectionOrder,
                          shopFirstPreviousSectionOrder: undefined,
                        });
                  }}/>
                Mostrar escaparate comercial de plantas
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block text-xs font-semibold">Origen de productos
                  <select value={productDisplay.mode}
                    onChange={(event) => patchHome({ productDisplay: { ...productDisplay, mode: event.target.value as "featured" | "plants" | "all" } })}
                    className="mt-1 w-full rounded-lg border border-[#c7d8c7] bg-white p-2.5 text-sm">
                    <option value="plants">Solo plantas activas</option>
                    <option value="featured">Solo destacados</option>
                    <option value="all">Todos los productos activos</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold">Productos en portada
                  <input type="number" min="1" max="48" value={productDisplay.limit}
                    onChange={(event) => patchHome({ productDisplay: { ...productDisplay, limit: Math.max(1, Math.min(48, Number(event.target.value) || 1)) } })}
                    className="mt-1 w-full rounded-lg border border-[#c7d8c7] bg-white p-2.5 text-sm"/>
                </label>
                <label className="block text-xs font-semibold">Columnas en ordenador
                  <select value={productDisplay.columns}
                    onChange={(event) => patchHome({ productDisplay: { ...productDisplay, columns: Number(event.target.value) as 4 | 6 | 8 } })}
                    className="mt-1 w-full rounded-lg border border-[#c7d8c7] bg-white p-2.5 text-sm">
                    <option value={4}>4 · Fotos grandes</option>
                    <option value={6}>6 · Equilibrado</option>
                    <option value={8}>8 · Más productos</option>
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold">Proporción de la fotografía
                  <select value={productDisplay.imageAspect}
                    onChange={(event) => patchHome({ productDisplay: {...productDisplay, imageAspect: event.target.value as "square" | "portrait"} })}
                    className="mt-1 w-full rounded-lg border border-[#c7d8c7] bg-white p-2.5 text-sm">
                    <option value="portrait">Vertical · como el boceto</option>
                    <option value="square">Cuadrada</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold">Redondeo de tarjetas: {productDisplay.cardRadius}px
                  <input type="range" min="0" max="32" step="1" value={productDisplay.cardRadius}
                    onChange={(event) => patchHome({ productDisplay: { ...productDisplay, cardRadius: Number(event.target.value) } })}
                    className="mt-2 block w-full"/>
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Título del escaparate" value={productDisplay.title}
                  onChange={(title) => patchHome({ productDisplay: {...productDisplay, title} })}/>
                <Field label="Texto debajo del título" value={productDisplay.subtitle}
                  onChange={(subtitle) => patchHome({ productDisplay: {...productDisplay, subtitle} })}/>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={productDisplay.filtersEnabled}
                  onChange={(event) => patchHome({ productDisplay: {...productDisplay, filtersEnabled: event.target.checked} })}/>
                Mostrar filtros de productos en la portada
              </label>
              {productDisplay.filtersEnabled && (
                <label className="block text-xs font-semibold">Nombres de filtros (separados por comas)
                  <textarea rows={2}
                    value={productDisplay.filterLabels.join(", ")}
                    onChange={(event) => patchHome({ productDisplay: {
                      ...productDisplay,
                      filterLabels: event.target.value.split(",").map(label => label.trimStart()).slice(0,12),
                    } })}
                    className="mt-1 w-full rounded-lg border border-[#c7d8c7] bg-white p-2.5 text-sm"/>
                </label>
              )}
              <p className="text-xs text-[#526c55]">Los precios, fotos, existencias, carrito y favoritos siguen conectados al catálogo original. No se publicarán artículos ficticios para rellenar huecos.</p>
            </div>

            <section className="mb-5 rounded-2xl border border-[#bdd2be] bg-white p-4" aria-label="Gestionar escaparate Creaciones 3D">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-lg font-black text-[#1e4932]">Creaciones 3D · Escaparate</h4>
                  <p className="text-xs text-[#66776b]">Selecciona productos del catálogo existente. Quitarlos de esta sección no los elimina de la tienda.</p>
                </div>
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input type="checkbox" checked={market.home.sections.creations3d}
                    onChange={(event) => patchHome({sections: {...market.home.sections, creations3d: event.target.checked}})}/>
                  {market.home.sections.creations3d ? "ON · Visible" : "OFF · Oculto"}
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Título" value={market.home.creations3D.title}
                  onChange={(title) => patchHome({creations3D: {...market.home.creations3D, title}})}/>
                <Field label="Texto del botón" value={market.home.creations3D.buttonLabel}
                  onChange={(buttonLabel) => patchHome({creations3D: {...market.home.creations3D, buttonLabel}})}/>
                <Field label="Descripción" value={market.home.creations3D.subtitle}
                  onChange={(subtitle) => patchHome({creations3D: {...market.home.creations3D, subtitle}})} multiline/>
                <div className="space-y-3">
                  <Field label="Enlace de la colección" value={market.home.creations3D.href}
                    onChange={(href) => patchHome({creations3D: {...market.home.creations3D, href}})}/>
                  <Field label="Imagen principal (URL opcional)" value={market.home.creations3D.imageUrl}
                    onChange={(imageUrl) => patchHome({creations3D: {...market.home.creations3D, imageUrl}})}/>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold">
                  Productos del escaparate
                  <select className="mt-1 block w-full rounded-lg border border-[#d3e0d2] bg-white p-2.5 text-sm"
                    value={market.home.creations3D.mode}
                    onChange={(event) => patchHome({creations3D: {...market.home.creations3D, mode: event.target.value as "automatic" | "manual"}})}>
                    <option value="automatic">Automáticos: productos identificados como 3D</option>
                    <option value="manual">Elegidos por mí</option>
                  </select>
                </label>
                <label className="text-xs font-bold">
                  Número de productos
                  <input type="number" min={1} max={12} value={market.home.creations3D.limit}
                    onChange={(event) => patchHome({creations3D: {...market.home.creations3D, limit: Math.max(1, Math.min(12, Number(event.target.value) || 1))}})}
                    className="mt-1 block w-full rounded-lg border border-[#d3e0d2] p-2.5 text-sm"/>
                </label>
              </div>
              {market.home.creations3D.mode === "manual" && (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold">Productos seleccionados · {market.home.creations3D.productIds.length}</p>
                    <button type="button" onClick={() => void reloadProducts3D()} disabled={loading3D}
                      className="rounded-lg border border-[#cfdecf] px-3 py-2 text-xs font-bold disabled:opacity-50">
                      {loading3D ? "Actualizando…" : "Actualizar catálogo"}
                    </button>
                  </div>
                  {market.home.creations3D.productIds.map((id, index) => {
                    const selected = products3D.find(product => String(product.id) === id);
                    const swap = (direction: -1 | 1) => {
                      const ids = [...market.home.creations3D.productIds];
                      const dest = index + direction;
                      if (dest < 0 || dest >= ids.length) return;
                      [ids[index], ids[dest]] = [ids[dest], ids[index]];
                      patchHome({creations3D: {...market.home.creations3D, productIds: ids}});
                    };
                    return (
                      <div key={id} className="flex items-center gap-2 rounded-xl border border-[#e1e9df] px-3 py-2 text-sm">
                        {selected?.image ? <img src={selected.image} alt="" className="h-11 w-11 rounded-lg object-cover"/> : <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#e8eee6]">3D</span>}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold">{selected?.name || "Producto no encontrado (" + id + ")"}</p>
                          <p className="text-xs text-[#657669]">{selected?.deletedAt ? "Archivado" : selected?.status || "Catálogo existente"}</p>
                        </div>
                        <button type="button" onClick={() => swap(-1)} disabled={index === 0} aria-label={"Subir " + (selected?.name || id)} className="rounded-md border px-2 py-1 disabled:opacity-40">↑</button>
                        <button type="button" onClick={() => swap(1)} disabled={index === market.home.creations3D.productIds.length - 1} aria-label={"Bajar " + (selected?.name || id)} className="rounded-md border px-2 py-1 disabled:opacity-40">↓</button>
                        <button type="button" onClick={() => patchHome({creations3D: {...market.home.creations3D, productIds: market.home.creations3D.productIds.filter(value => value !== id)}})}
                          className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-700">Quitar</button>
                      </div>
                    );
                  })}
                  <input value={search3D} onChange={(event) => setSearch3D(event.target.value)}
                    placeholder="Buscar producto por nombre..." aria-label="Buscar productos para Creaciones 3D"
                    className="w-full rounded-lg border border-[#c9d9cb] px-3 py-2.5 text-sm"/>
                  <div className="max-h-56 space-y-1 overflow-y-auto">
                    {products3D.filter(product => !product.deletedAt &&
                      !market.home.creations3D.productIds.includes(String(product.id)) &&
                      (!search3D || (product.name || "").toLowerCase().includes(search3D.toLowerCase()))
                    ).slice(0, 24).map(product => (
                      <div key={product.id} className="flex items-center gap-3 rounded-lg border border-[#e2e9e1] p-2">
                        {product.image && <img src={product.image} alt="" className="h-10 w-10 rounded-md object-cover"/>}
                        <span className="flex-1 truncate text-sm">{product.name}</span>
                        <button type="button" onClick={() => patchHome({creations3D: {...market.home.creations3D,
                            productIds: [...market.home.creations3D.productIds, String(product.id)]
                          }})} className="rounded-lg bg-[#28533a] px-3 py-1.5 text-xs font-bold text-white">
                          Añadir
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="mt-4 text-xs text-[#657669]">Para crear un artículo nuevo, usa la gestión de Productos que ya existe en Administración. Después selecciónalo aquí. Las modificaciones siguen el flujo Guardar borrador → Guardar y publicar.</p>
            </section>
            <button type="button" onClick={() => patchHome({ sectionOrder: [...DEFAULT_HOME_SECTION_ORDER] })}
              className="mb-4 inline-flex items-center gap-2 rounded-lg border border-[#b9cdbb] bg-white px-4 py-2 text-sm font-semibold text-[#244a35] hover:bg-[#e9f3e8]">
              <Sparkles className="h-4 w-4" /> Aplicar orden del boceto de Herencia
            </button>
            <p className="mb-4 text-xs text-muted-foreground">El botón solo cambia el orden del borrador: usa Guardar y Publicar para reflejarlo en la tienda.</p>
            <div className="grid gap-2 md:grid-cols-2">
              {market.home.sectionOrder.map((key, index) => {
                const names: Record<MarketHomeSectionId, string> = {
                  hero: "Portada principal", delivery: "Envíos a Colombia", categoryStrip: "Categorías redondas",
                  plantCta: "Botón descubrir plantas", feed: "Contenido dinámico", categoriesGrid: "Colecciones y banners de portada",
                  services: "Servicios", featured: "Productos destacados", promotions: "Banners promocionales", creations3d: "Creaciones 3D",
                  trust: "Beneficios", bottomCta: "Banner CTA inferior",
                };
                return (
                  <div key={key} draggable onDragStart={() => setDraggedSection(key)}
                    onDragOver={(event) => event.preventDefault()}
                    onDragEnd={() => setDraggedSection(null)}
                    onDrop={() => {
                      if (draggedSection) {
                        const from = market.home.sectionOrder.indexOf(draggedSection);
                        patchHome({ sectionOrder: reorderItem(market.home.sectionOrder, from, index) });
                      }
                      setDraggedSection(null);
                    }}
                    className={`rounded-xl border bg-white p-2 ${draggedSection === key ? "border-emerald-600 opacity-60" : "border-[#dce6dc]"}`}>
                    <p className="mb-2 text-xs font-black">{index + 1}. {names[key]}</p>
                    <AdminElementControls label={names[key]} visible={market.home.sections[key]}
                      onToggle={(visible) => patchHome({ sections: { ...market.home.sections, [key]: visible } })}
                      onMoveUp={() => patchHome({ sectionOrder: reorderItem(market.home.sectionOrder, index, index - 1) })}
                      onMoveDown={() => patchHome({ sectionOrder: reorderItem(market.home.sectionOrder, index, index + 1) })}
                      moveUpDisabled={index === 0} moveDownDisabled={index === market.home.sectionOrder.length - 1}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <Field label="Texto pequeño" value={market.home.kicker} onChange={(kicker) => patchHome({ kicker })} />
              <Field label="Título principal" value={market.home.title} onChange={(title) => patchHome({ title })} />
              <Field
                label="Descripción"
                value={market.home.description}
                onChange={(description) => patchHome({ description })}
                multiline
              />
              <div className="rounded-xl border border-[#dce6dc] bg-[#f5f8f3] p-4">
                <label className="mb-3 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={market.home.referenceHero !== false} onChange={(e) => patchHome({referenceHero:e.target.checked})}/> Activar banner visual de referencia</label>
                <h4 className="mb-2 font-bold">Hero del diseño de referencia</h4>
                <p className="mb-3 text-xs text-muted-foreground">Estos campos controlan la imagen y los textos que aparecen realmente en el banner del diseño nuevo. Al desactivar este modo vuelve a mostrarse el banner anterior.</p>
                <Field label="URL de fotografía botánica" value={market.home.referenceHeroImageUrl || ""}
                  onChange={(referenceHeroImageUrl) => patchHome({referenceHeroImageUrl})} />
                <Field label="Título del banner" value={market.home.referenceHeroTitle || ""}
                  onChange={(referenceHeroTitle) => patchHome({referenceHeroTitle})} />
                <Field label="Descripción del banner" value={market.home.referenceHeroDescription || ""}
                  onChange={(referenceHeroDescription) => patchHome({referenceHeroDescription})} multiline />
              </div>
              <Field
                label="Título de categorías"
                value={market.home.categoriesTitle}
                onChange={(categoriesTitle) => patchHome({ categoriesTitle })}
              />
              <label className="block text-xs font-bold">
                Número de categorías en portada (0 = todas)
                <input type="number" min="0" max="100" value={market.home.categoryGridLimit} onChange={(event) => patchHome({ categoryGridLimit: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })} className="mt-2 block w-full rounded-xl border p-3 text-sm" />
              </label>
              <Field
                label="Título de servicios"
                value={market.home.servicesTitle}
                onChange={(servicesTitle) => patchHome({ servicesTitle })}
              />
              <Field
                label="Título de productos destacados"
                value={market.home.featuredTitle}
                onChange={(featuredTitle) => patchHome({ featuredTitle })}
              />
              <label className="block text-xs font-bold">
                Cantidad de productos destacados
                <input type="number" min="1" max="48" value={market.home.featuredLimit} onChange={(event) => patchHome({ featuredLimit: Math.max(1, Math.min(48, Number(event.target.value) || 1)) })} className="mt-2 block w-full rounded-xl border p-3 text-sm" />
              </label>
              <Field
                label="Texto de productos destacados"
                value={market.home.featuredSubtitle}
                onChange={(featuredSubtitle) => patchHome({ featuredSubtitle })}
                multiline
              />
            </div>
            <div className="space-y-4">
              <ImageField
                label="Foto principal · URL"
                value={market.home.heroImageUrl}
                onChange={(heroImageUrl) => patchHome({ heroImageUrl })}
              />

              <div className="rounded-2xl border border-border bg-[#fbfaf6] p-4">
                <p className="mb-4 font-black">Color de la portada</p>

                <div className="mb-5">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm font-bold">
                    <span>Color</span>
                    <span className="font-mono text-xs">{market.home.heroOverlayColor || "#102b20"}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {["#102b20", "#000000", "#4a2f24", "#8b4a35", "#20364f", "#6a5a43", "#6b2448", "#5b5b5b"].map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Usar color ${color}`}
                        title={color}
                        onClick={() => patchHome({ heroOverlayColor: color })}
                        className="h-9 w-9 rounded-full border-2 shadow-sm"
                        style={{
                          backgroundColor: color,
                          borderColor: (market.home.heroOverlayColor || "#102b20").toLowerCase() === color.toLowerCase() ? "#16a34a" : "#ffffff",
                          outline: (market.home.heroOverlayColor || "#102b20").toLowerCase() === color.toLowerCase() ? "2px solid #16a34a" : "1px solid #d1d5db",
                        }}
                      />
                    ))}
                    <label className="flex h-9 items-center gap-2 rounded-xl border border-border bg-white px-2 text-xs font-bold">
                      Personalizado
                      <input
                        type="color"
                        value={market.home.heroOverlayColor || "#102b20"}
                        onChange={(event) => patchHome({ heroOverlayColor: event.target.value })}
                        className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
                      />
                    </label>
                  </div>
                </div>

                <label className="block">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm font-bold">
                    <span>Intensidad del color</span>
                    <span>{Math.round(Number(market.home.heroOverlayOpacity ?? 90))}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={Number(market.home.heroOverlayOpacity ?? 90)}
                    onChange={(event) => patchHome({ heroOverlayOpacity: Number(event.target.value) })}
                    className="w-full"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">0% = sin sombra · 100% = muy oscura</p>
                </label>

                <label className="mt-5 block">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm font-bold">
                    <span>Extensión del color</span>
                    <span>{Math.round(Number(market.home.heroOverlayWidth ?? 72))}%</span>
                  </div>
                  <input
                    type="range"
                    min="25"
                    max="100"
                    step="1"
                    value={Number(market.home.heroOverlayWidth ?? 72)}
                    onChange={(event) => patchHome({ heroOverlayWidth: Number(event.target.value) })}
                    className="w-full"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Bájala para mostrar más foto · súbela para llevar el color más hacia la derecha</p>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-3 font-black">Categorías visibles en Inicio</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {market.home.categories.map((category, index) => (
                <div key={index} className="space-y-3 rounded-2xl border border-border bg-[#fbfaf6] p-4">
                  <AdminElementControls label={category.title || "Categoría"} visible={category.visible !== false}
                    onToggle={(visible) => patchHome({ categories: market.home.categories.map((current, i) => i === index ? { ...current, visible } : current) })}
                    onMoveUp={() => patchHome({ categories: reorderItem(market.home.categories, index, index - 1) })}
                    onMoveDown={() => patchHome({ categories: reorderItem(market.home.categories, index, index + 1) })}
                    moveUpDisabled={index === 0} moveDownDisabled={index === market.home.categories.length - 1}
                    onDuplicate={() => patchHome({ categories: [...market.home.categories.slice(0, index + 1), { ...category }, ...market.home.categories.slice(index + 1)] })}
                    onRemove={() => patchHome({ categories: market.home.categories.filter((_, i) => i !== index) })}
                  />
                  <AdminScheduleFields label={category.title} value={category.schedule} onChange={(schedule) => patchHome({ categories: market.home.categories.map((current, i) => i === index ? { ...current, schedule } : current) })} />
                  <Field
                    label="Nombre"
                    value={category.title}
                    onChange={(title) => {
                      const categories = market.home.categories.map((item, i) =>
                        i === index ? { ...item, title } : item
                      );
                      patchHome({ categories });
                    }}
                  />
                  <Field
                    label="Texto corto"
                    value={category.subtitle}
                    onChange={(subtitle) => {
                      const categories = market.home.categories.map((item, i) =>
                        i === index ? { ...item, subtitle } : item
                      );
                      patchHome({ categories });
                    }}
                  />
                  <Field
                    label="Destino"
                    value={category.href}
                    onChange={(href) => {
                      const categories = market.home.categories.map((item, i) =>
                        i === index ? { ...item, href } : item
                      );
                      patchHome({ categories });
                    }}
                  />
                  <ImageField
                    label="Imagen · URL"
                    value={category.imageUrl}
                    onChange={(imageUrl) => {
                      const categories = market.home.categories.map((item, i) =>
                        i === index ? { ...item, imageUrl } : item
                      );
                      patchHome({ categories });
                    }}
                  />
                  <AdminCardDesignFields label={category.title} value={category.design}
                    onChange={(design) => patchHome({ categories: market.home.categories.map((current, i) => i === index ? { ...current, design } : current) })}
                  />
                  <button
                    type="button"
                    onClick={() => setManagedCategory({ title: category.title, key: categoryKey(category.title, category.href) })}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#173d2a] px-3 py-2.5 text-sm font-black text-white shadow-sm hover:bg-[#315b42]"
                  >
                    <PackagePlus className="h-4 w-4" />
                    Gestionar productos
                  </button>
                </div>
              ))}
            </div>
            <AdminAddElement label="Añadir categoría" onAdd={() => patchHome({ categories: [...market.home.categories, { title: "Nueva categoría", subtitle: "", href: "/productos", imageUrl: "", visible: false }] })} />
          </div>

          <div id="market-editor-servicios" className="mt-6 scroll-mt-6">
            <p className="mb-3 font-black">Servicios visibles en Inicio</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {market.home.services.map((service, index) => (
                <div key={index} className="space-y-3 rounded-2xl border border-border bg-[#fbfaf6] p-4">
                  <AdminElementControls label={service.title || "Servicio"} visible={service.visible !== false}
                    onToggle={(visible) => patchHome({ services: market.home.services.map((current, i) => i === index ? { ...current, visible } : current) })}
                    onMoveUp={() => patchHome({ services: reorderItem(market.home.services, index, index - 1) })}
                    onMoveDown={() => patchHome({ services: reorderItem(market.home.services, index, index + 1) })}
                    moveUpDisabled={index === 0} moveDownDisabled={index === market.home.services.length - 1}
                    onDuplicate={() => patchHome({ services: [...market.home.services.slice(0, index + 1), { ...service }, ...market.home.services.slice(index + 1)] })}
                    onRemove={() => patchHome({ services: market.home.services.filter((_, i) => i !== index) })}
                  />
                  <AdminScheduleFields label={service.title} value={service.schedule} onChange={(schedule) => patchHome({ services: market.home.services.map((current, i) => i === index ? { ...current, schedule } : current) })} />
                  <Field
                    label="Servicio"
                    value={service.title}
                    onChange={(title) => {
                      const services = market.home.services.map((item, i) =>
                        i === index ? { ...item, title } : item
                      );
                      patchHome({ services });
                    }}
                  />
                  <Field
                    label="Descripción"
                    value={service.subtitle}
                    onChange={(subtitle) => {
                      const services = market.home.services.map((item, i) =>
                        i === index ? { ...item, subtitle } : item
                      );
                      patchHome({ services });
                    }}
                    multiline
                  />
                  <Field
                    label="Destino"
                    value={service.href}
                    onChange={(href) => {
                      const services = market.home.services.map((item, i) =>
                        i === index ? { ...item, href } : item
                      );
                      patchHome({ services });
                    }}
                  />
                  <Field
                    label="Texto del botón"
                    value={service.ctaLabel}
                    onChange={(ctaLabel) => {
                      const services = market.home.services.map((item, i) =>
                        i === index ? { ...item, ctaLabel } : item
                      );
                      patchHome({ services });
                    }}
                  />
                  <ImageField
                    label="Imagen · URL"
                    value={service.imageUrl}
                    onChange={(imageUrl) => {
                      const services = market.home.services.map((item, i) =>
                        i === index ? { ...item, imageUrl } : item
                      );
                      patchHome({ services });
                    }}
                  />
                  <AdminCardDesignFields label={service.title} value={service.design} defaultImageHeight={160} defaultBackgroundColor="#fffdf9"
                    onChange={(design) => patchHome({ services: market.home.services.map((current, i) => i === index ? { ...current, design } : current) })}
                  />
                </div>
              ))}
            </div>
            <AdminAddElement label="Añadir servicio" onAdd={() => patchHome({ services: [...market.home.services, { title: "Nuevo servicio", subtitle: "", href: "/servicios", imageUrl: "", ctaLabel: "Saber más", visible: false }] })} />
          </div>

          <div className="mt-6">
            <p className="mb-3 font-black">Beneficios visibles en Inicio</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {market.home.trust.map((item, index) => (
                <div key={index} className="space-y-3 rounded-2xl border border-border bg-[#fbfaf6] p-4">
                  <AdminElementControls label={item.title || "Beneficio"} visible={item.visible !== false}
                    onToggle={(visible) => patchHome({ trust: market.home.trust.map((current, i) => i === index ? { ...current, visible } : current) })}
                    onMoveUp={() => patchHome({ trust: reorderItem(market.home.trust, index, index - 1) })}
                    onMoveDown={() => patchHome({ trust: reorderItem(market.home.trust, index, index + 1) })}
                    moveUpDisabled={index === 0} moveDownDisabled={index === market.home.trust.length - 1}
                    onDuplicate={() => patchHome({ trust: [...market.home.trust.slice(0, index + 1), { ...item }, ...market.home.trust.slice(index + 1)] })}
                    onRemove={() => patchHome({ trust: market.home.trust.filter((_, i) => i !== index) })}
                  />
                  <AdminScheduleFields label={item.title} value={item.schedule} onChange={(schedule) => patchHome({ trust: market.home.trust.map((current, i) => i === index ? { ...current, schedule } : current) })} />
                  <Field
                    label="Título"
                    value={item.title}
                    onChange={(title) => {
                      const trust = market.home.trust.map((current, i) =>
                        i === index ? { ...current, title } : current
                      );
                      patchHome({ trust });
                    }}
                  />
                  <Field
                    label="Descripción"
                    value={item.description}
                    onChange={(description) => {
                      const trust = market.home.trust.map((current, i) =>
                        i === index ? { ...current, description } : current
                      );
                      patchHome({ trust });
                    }}
                    multiline
                  />
                </div>
              ))}
            </div>
            <AdminAddElement label="Añadir beneficio" onAdd={() => patchHome({ trust: [...market.home.trust, { title: "Nuevo beneficio", description: "", visible: false }] })} />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="mb-5">
            <h4 className="font-black">Página de Servicios y Contacto</h4>
            <p className="text-sm text-muted-foreground">
              Estos campos están conectados a las nuevas ventanas del frontend.
            </p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4 rounded-xl border border-border bg-[#fbfaf6] p-4">
              <p className="font-black">Servicios</p>
              <Field
                label="Título de página"
                value={site.servicesPage.title}
                onChange={(title) =>
                  onChange({ ...site, servicesPage: { ...site.servicesPage, title } })
                }
              />
              <Field
                label="Subtítulo"
                value={site.servicesPage.subtitle}
                onChange={(subtitle) =>
                  onChange({ ...site, servicesPage: { ...site.servicesPage, subtitle } })
                }
                multiline
              />
            </div>
            <div className="space-y-4 rounded-xl border border-border bg-[#fbfaf6] p-4">
              <p className="font-black">Contacto</p>
              <Field
                label="Título de página"
                value={site.contactPage.title}
                onChange={(title) =>
                  onChange({ ...site, contactPage: { ...site.contactPage, title } })
                }
              />
              <Field
                label="Subtítulo"
                value={site.contactPage.subtitle}
                onChange={(subtitle) =>
                  onChange({ ...site, contactPage: { ...site.contactPage, subtitle } })
                }
                multiline
              />
              <Field
                label="Título del formulario"
                value={site.contactPage.helpTitle}
                onChange={(helpTitle) =>
                  onChange({ ...site, contactPage: { ...site.contactPage, helpTitle } })
                }
              />
              <Field
                label="Texto del formulario"
                value={site.contactPage.helpIntro}
                onChange={(helpIntro) =>
                  onChange({ ...site, contactPage: { ...site.contactPage, helpIntro } })
                }
                multiline
              />
            </div>
          </div>
        </div>

        {(["dulce", "moda"] as const).map((kind) => {
          const promo = market[kind];
          const Icon = kind === "dulce" ? Sparkles : Shirt;
          return (
            <div key={kind} id={kind === "dulce" ? "market-editor-promociones" : undefined} className="scroll-mt-6 rounded-2xl border border-border bg-white p-5">
              <div className="mb-5 flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <h4 className="font-black">{kind === "dulce" ? "Dulce" : "Moda"} · portada y banner</h4>
              </div>
              <label className="mb-4 flex items-center gap-2 rounded-xl bg-[#f2f5ef] p-3 text-sm font-bold"><input type="checkbox" checked={promo.enabled !== false} onChange={(event) => patchPromo(kind, { enabled: event.target.checked })} /> Mostrar sección {kind === "dulce" ? "Dulce" : "Moda"} en la tienda</label>
              <p className="mb-4 text-xs text-muted-foreground">Al desactivarla se ocultan el menú, las tarjetas de inicio, los banners y la página pública. Puedes seguir editándola aquí sin perder su contenido. Pulsa Guardar y publicar para aplicar el cambio.</p>
              <AdminScheduleFields label={promo.title} value={promo.schedule} onChange={(schedule) => patchPromo(kind, { schedule })} />
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-4">
                  <Field label="Texto pequeño" value={promo.kicker} onChange={(kicker) => patchPromo(kind, { kicker })} />
                  <Field label="Título de banner" value={promo.title} onChange={(title) => patchPromo(kind, { title })} />
                  <Field label="Descripción de banner" value={promo.subtitle} onChange={(subtitle) => patchPromo(kind, { subtitle })} multiline />
                  <Field label="Título de página" value={promo.pageTitle} onChange={(pageTitle) => patchPromo(kind, { pageTitle })} />
                  <Field label="Subtítulo de página" value={promo.pageSubtitle} onChange={(pageSubtitle) => patchPromo(kind, { pageSubtitle })} multiline />
                  <Field label="Texto del botón" value={promo.buttonLabel} onChange={(buttonLabel) => patchPromo(kind, { buttonLabel })} />
                  <Field label="Destino" value={promo.href} onChange={(href) => patchPromo(kind, { href })} />
                </div>
                <div className="space-y-3">
                  <ImageField label="Imagen · URL" value={promo.imageUrl} onChange={(imageUrl) => patchPromo(kind, { imageUrl })} />
                  <AdminPromoDesignFields value={promo.design} onChange={(design) => patchPromo(kind, { design })} />
                </div>
              </div>
            </div>
          );
        })}

        <AdminCampaigns campaigns={market.home.campaigns} onChange={(campaigns) => patchHome({ campaigns })} />


        <div className="rounded-2xl border border-[#dce6dc] bg-white p-5">
          <h4 className="mb-3 font-black">WhatsApp · botón flotante</h4>
          <p className="mb-4 text-xs text-muted-foreground">El número de teléfono se administra en el pie de página. Aquí puedes ocultar el botón, ajustar posición, color y texto inicial.</p>
          <label className="mb-4 flex items-center gap-2 text-sm font-bold">
            <input type="checkbox"
              checked={market.componentControls["floating.whatsapp"]?.enabled !== false}
              onChange={(event) => setMarket({ ...market, componentControls: {
                ...market.componentControls, "floating.whatsapp": { ...market.componentControls["floating.whatsapp"], enabled: event.target.checked },
              } })} />
            ON/OFF · Mostrar botón de WhatsApp
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mensaje inicial" value={market.whatsapp.message}
              onChange={(message) => setMarket({ ...market, whatsapp: { ...market.whatsapp, message } })} />
            <label className="block text-xs font-bold">
              Posición
              <select className="mt-2 block w-full rounded-lg border bg-white p-3"
                value={market.whatsapp.position}
                onChange={(event) => setMarket({ ...market, whatsapp: { ...market.whatsapp, position: event.target.value as "left" | "right" } })}>
                <option value="left">Inferior izquierda</option>
                <option value="right">Inferior derecha</option>
              </select>
            </label>
            <label className="block text-xs font-bold">
              Separación inferior: {market.whatsapp.bottomOffset}px
              <input type="range" min="12" max="240" className="mt-3 block w-full"
                value={market.whatsapp.bottomOffset}
                onChange={(event) => setMarket({ ...market, whatsapp: { ...market.whatsapp, bottomOffset: Number(event.target.value) } })} />
            </label>
            <label className="block text-xs font-bold">
              Color del botón
              <input type="color" className="mt-2 block h-10 w-20 cursor-pointer"
                value={market.whatsapp.buttonColor}
                onChange={(event) => setMarket({ ...market, whatsapp: { ...market.whatsapp, buttonColor: event.target.value } })} />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-[#dce6dc] bg-white p-5">
          <h4 className="mb-3 font-black">Atención al cliente · botón flotante</h4>
          <p className="mb-4 text-xs text-muted-foreground">Estos ajustes afectan al acceso visual al soporte. La mensajería y los datos privados no se modifican.</p>
          <label className="mb-4 flex items-center gap-2 text-sm font-bold">
            <input type="checkbox"
              checked={market.componentControls["floating.support"]?.enabled !== false}
              onChange={(event) => setMarket({ ...market, componentControls: {
                ...market.componentControls, "floating.support": { ...market.componentControls["floating.support"], enabled: event.target.checked },
              } })} />
            ON/OFF · Mostrar atención al cliente
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Texto del botón" value={market.support.buttonLabel}
              onChange={(buttonLabel) => setMarket({ ...market, support: { ...market.support, buttonLabel } })} />
            <label className="block text-xs font-bold">
              Posición
              <select className="mt-2 block w-full rounded-lg border bg-white p-3"
                value={market.support.position}
                onChange={(event) => setMarket({ ...market, support: { ...market.support, position: event.target.value as "left" | "right" } })}>
                <option value="right">Inferior derecha</option>
                <option value="left">Inferior izquierda</option>
              </select>
            </label>
            <label className="block text-xs font-bold">
              Separación inferior: {market.support.bottomOffset}px
              <input type="range" min="12" max="240" className="mt-3 block w-full"
                value={market.support.bottomOffset}
                onChange={(event) => setMarket({ ...market, support: { ...market.support, bottomOffset: Number(event.target.value) } })} />
            </label>
            <label className="block text-xs font-bold">
              Color del botón
              <input type="color" className="mt-2 block h-10 w-20 cursor-pointer"
                value={market.support.buttonColor}
                onChange={(event) => setMarket({ ...market, support: { ...market.support, buttonColor: event.target.value } })} />
            </label>
          </div>
        </div>


        <div className="rounded-2xl border border-border bg-white p-5">
          <div id="market-editor-sales" className="mb-5 flex items-center gap-2 scroll-mt-6">
            <WandSparkles className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-black">HERENCIA SALES · “Crear con Herencia”</h4>
              <p className="text-sm text-muted-foreground">
                Este es el chat comercial del frontend. No es asesoría gratuita: está orientado a crear, encontrar y vender.
              </p>
            </div>
          </div>
          <label className="mb-5 flex items-center gap-3 rounded-xl bg-[#f2f5ef] p-4 font-bold">
            <input
              type="checkbox"
              checked={market.sales.enabled}
              onChange={(event) =>
                setMarket({ ...market, sales: { ...market.sales, enabled: event.target.checked }, componentControls: {
                  ...market.componentControls, "floating.sales": { ...(market.componentControls["floating.sales"] || {}), enabled: event.target.checked },
                } })
              }
            />
            Mostrar “Crear con Herencia”
          </label>
          <div className="mb-5 grid gap-4 rounded-xl border border-[#dce6dc] bg-[#f5f9f5] p-4 sm:grid-cols-3">
            <label className="block text-sm font-bold">
              Posición del botón
              <select value={market.sales.position} onChange={(event) => setMarket({ ...market, sales: { ...market.sales, position: event.target.value as "left" | "right" } })} className="mt-2 w-full rounded-lg border bg-white p-2">
                <option value="left">Abajo a la izquierda</option>
                <option value="right">Abajo a la derecha</option>
              </select>
            </label>
            <label className="block text-sm font-bold">
              Distancia al borde inferior: {market.sales.bottomOffset}px
              <input className="mt-3 w-full" type="range" min="12" max="200" value={market.sales.bottomOffset} onChange={(event) => setMarket({ ...market, sales: { ...market.sales, bottomOffset: Number(event.target.value) } })} />
            </label>
            <label className="block text-sm font-bold">
              Color del botón
              <input type="color" className="mt-2 block h-10 w-20 cursor-pointer" value={market.sales.buttonColor} onChange={(event) => setMarket({ ...market, sales: { ...market.sales, buttonColor: event.target.value } })} />
            </label>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Field
              label="Texto del botón flotante"
              value={market.sales.buttonLabel}
              onChange={(buttonLabel) => setMarket({ ...market, sales: { ...market.sales, buttonLabel } })}
            />
            <Field
              label="Título del chat"
              value={market.sales.title}
              onChange={(title) => setMarket({ ...market, sales: { ...market.sales, title } })}
            />
            <Field
              label="Pregunta inicial"
              value={market.sales.prompt}
              onChange={(prompt) => setMarket({ ...market, sales: { ...market.sales, prompt } })}
            />
            <Field
              label="Texto inferior"
              value={market.sales.helperText}
              onChange={(helperText) => setMarket({ ...market, sales: { ...market.sales, helperText } })}
            />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {market.sales.quickActions.map((action, index) => (
              <div key={action.id} className="rounded-xl border border-border bg-[#fbfaf6] p-3">
                <label className="mb-2 flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={action.enabled !== false} onChange={(event) => setMarket({ ...market, sales: { ...market.sales, quickActions: market.sales.quickActions.map((current, i) => i === index ? { ...current, enabled: event.target.checked } : current) } })} /> ON/OFF · Acción rápida</label>
                <Field
                  label={`Acción ${index + 1}`}
                  value={action.label}
                  onChange={(label) => {
                    const quickActions = market.sales.quickActions.map((item, i) =>
                      i === index ? { ...item, label } : item
                    );
                    setMarket({ ...market, sales: { ...market.sales, quickActions } });
                  }}
                />
                {action.id !== "photo" ? (
                  <div className="mt-2">
                    <Field
                      label="Prompt comercial"
                      value={action.prompt}
                      onChange={(prompt) => {
                        const quickActions = market.sales.quickActions.map((item, i) =>
                          i === index ? { ...item, prompt } : item
                        );
                        setMarket({ ...market, sales: { ...market.sales, quickActions } });
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="mb-5 flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <h4 className="font-black">Sobre Herencia</h4>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <Field label="Texto pequeño" value={market.about.kicker} onChange={(kicker) => setMarket({ ...market, about: { ...market.about, kicker } })} />
              <Field label="Título" value={market.about.title} onChange={(title) => setMarket({ ...market, about: { ...market.about, title } })} />
              <Field label="Descripción" value={market.about.description} onChange={(description) => setMarket({ ...market, about: { ...market.about, description } })} multiline />
            </div>
            <ImageField label="Imagen · URL" value={market.about.imageUrl} onChange={(imageUrl) => setMarket({ ...market, about: { ...market.about, imageUrl } })} />
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {market.about.values.map((value, index) => (
              <div key={index} className="space-y-3 rounded-xl border border-border bg-[#fbfaf6] p-4">
                <Field
                  label="Valor / título"
                  value={value.title}
                  onChange={(title) => {
                    const values = market.about.values.map((current, i) =>
                      i === index ? { ...current, title } : current
                    );
                    setMarket({ ...market, about: { ...market.about, values } });
                  }}
                />
                <Field
                  label="Descripción"
                  value={value.description}
                  onChange={(description) => {
                    const values = market.about.values.map((current, i) =>
                      i === index ? { ...current, description } : current
                    );
                    setMarket({ ...market, about: { ...market.about, values } });
                  }}
                  multiline
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      {managedCategory ? <ProductManager title={managedCategory.title} category={managedCategory.key} onClose={() => setManagedCategory(null)} /> : null}
    </section>
  );
}
