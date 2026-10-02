import { useEffect, useMemo, useState } from "react";
import { Copy, Edit3, Home, Layers3, MapPin, PackagePlus, Search, Shirt, Sparkles, Store, Trash2, Upload, WandSparkles, X } from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../../lib/backendStorage";
import type { SiteContent } from "../../lib/siteContent";
import {
  getMarketExperience,
  type MarketExperienceContent,
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
  const [managedCategory, setManagedCategory] = useState<{ title: string; key: string } | null>(null);

  const setMarket = (next: MarketExperienceContent) => {
    onChange(withMarketExperience(site, next));
  };

  const patch = (value: Partial<MarketExperienceContent>) => {
    setMarket({ ...market, ...value });
  };

  const patchHome = (value: Partial<MarketExperienceContent["home"]>) => {
    setMarket({ ...market, home: { ...market.home, ...value } });
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

          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="mb-4 flex items-center gap-2 font-black">
              <Store className="h-5 w-5 text-primary" />
              Menú principal
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {market.navigation.map((item, index) => (
                <div key={index} className="rounded-xl border border-border bg-[#fbfaf6] p-3">
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
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="mb-5 flex items-center gap-2">
            <Home className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-black">Inicio · Hero y estructura principal</h4>
              <p className="text-sm text-muted-foreground">
                La fotografía principal debe representar hogar, naturaleza y estilo de vida; no un ramo como protagonista.
              </p>
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
              <Field
                label="Título de categorías"
                value={market.home.categoriesTitle}
                onChange={(categoriesTitle) => patchHome({ categoriesTitle })}
              />
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
              <Field
                label="Texto de productos destacados"
                value={market.home.featuredSubtitle}
                onChange={(featuredSubtitle) => patchHome({ featuredSubtitle })}
                multiline
              />
            </div>
            <ImageField
              label="Foto principal · URL"
              value={market.home.heroImageUrl}
              onChange={(heroImageUrl) => patchHome({ heroImageUrl })}
            />
          </div>

          <div className="mt-6">
            <p className="mb-3 font-black">Categorías visibles en Inicio</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {market.home.categories.map((category, index) => (
                <div key={index} className="space-y-3 rounded-2xl border border-border bg-[#fbfaf6] p-4">
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
          </div>

          <div className="mt-6">
            <p className="mb-3 font-black">Servicios visibles en Inicio</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {market.home.services.map((service, index) => (
                <div key={index} className="space-y-3 rounded-2xl border border-border bg-[#fbfaf6] p-4">
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
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-3 font-black">Beneficios visibles en Inicio</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {market.home.trust.map((item, index) => (
                <div key={index} className="space-y-3 rounded-2xl border border-border bg-[#fbfaf6] p-4">
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
            <div key={kind} className="rounded-2xl border border-border bg-white p-5">
              <div className="mb-5 flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <h4 className="font-black">{kind === "dulce" ? "Dulce" : "Moda"} · portada y banner</h4>
              </div>
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
                <ImageField label="Imagen · URL" value={promo.imageUrl} onChange={(imageUrl) => patchPromo(kind, { imageUrl })} />
              </div>
            </div>
          );
        })}

        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="mb-5 flex items-center gap-2">
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
                setMarket({ ...market, sales: { ...market.sales, enabled: event.target.checked } })
              }
            />
            Mostrar “Crear con Herencia”
          </label>
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
