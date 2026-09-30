import { useEffect, useMemo, useState } from "react";
import { Archive, Edit3, ImagePlus, PackagePlus, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

type ProductForm = {
  id?: string;
  name: string;
  scientificName: string;
  description: string;
  type: string;
  category: string;
  price: string;
  compareAtPrice: string;
  cost: string;
  taxRate: string;
  sku: string;
  stock: string;
  status: "draft" | "active" | "archived";
  featured: boolean;
  image: string;
  collections: string[];
  environment: string;
  light: string;
  size: string;
  difficulty: string;
  petSafe: boolean;
  toxicity: string;
  water: string;
  temperature: string;
  humidity: string;
  growth: string;
  origin: string;
  potDiameter: string;
  height: string;
  allowDedication: boolean;
  seoTitle: string;
  seoDescription: string;
  variantsText: string;
};

const emptyForm = (): ProductForm => ({
  name: "", scientificName: "", description: "", type: "plant", category: "plantas",
  price: "", compareAtPrice: "", cost: "", taxRate: "21", sku: "", stock: "0",
  status: "active", featured: false, image: "", collections: ["plantas"],
  environment: "interior", light: "indirecta", size: "", difficulty: "Fácil",
  petSafe: false, toxicity: "", water: "", temperature: "", humidity: "", growth: "",
  origin: "", potDiameter: "", height: "", allowDedication: true, seoTitle: "",
  seoDescription: "", variantsText: "",
});

function formFromProduct(p: any): ProductForm {
  return {
    id: String(p.id), name: p.name || "", scientificName: p.scientificName || "",
    description: p.description || "", type: p.type || "plant", category: p.category || "plantas",
    price: String(p.price ?? ""), compareAtPrice: String(p.originalPrice ?? p.compareAtPrice ?? ""),
    cost: String(p.cost ?? ""), taxRate: String(p.iva ?? p.taxRate ?? 21), sku: p.sku || "",
    stock: String(p.stock ?? 0), status: p.deletedAt ? "archived" : p.active === false ? "draft" : "active",
    featured: Boolean(p.featured), image: p.image || "", collections: Array.isArray(p.collections) ? p.collections : [],
    environment: p.environment || "", light: p.light || "", size: p.size || "", difficulty: p.difficulty || "",
    petSafe: Boolean(p.petSafe), toxicity: p.toxicity || "", water: p.water || "", temperature: p.temperature || "",
    humidity: p.humidity || "", growth: p.growth || "", origin: p.origin || "", potDiameter: p.potDiameter || "",
    height: p.height || "", allowDedication: p.allowDedication !== false, seoTitle: p.seoTitle || "",
    seoDescription: p.seoDescription || "",
    variantsText: (p.variants || []).map((v:any)=>`${v.name || ""} | ${v.price ?? ""} | ${v.stock ?? ""} | ${v.sku ?? ""}`).join("\n"),
  };
}

function parseVariants(text: string) {
  return text.split("\n").map(x=>x.trim()).filter(Boolean).map((line)=>{
    const [name, price, stock, sku] = line.split("|").map(x=>x.trim());
    return { name, price: price ? Number(price) : undefined, stock: stock ? Math.max(0, Math.floor(Number(stock))) : 0, sku: sku || undefined };
  }).filter(v=>v.name);
}

function money(v:any){ return new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(Number(v||0)); }

export function AdminCommerceCatalog() {
  const [products,setProducts]=useState<any[]>([]);
  const [collections,setCollections]=useState<any[]>([]);
  const [selectedCollection,setSelectedCollection]=useState("all");
  const [query,setQuery]=useState("");
  const [form,setForm]=useState<ProductForm|null>(null);
  const [saving,setSaving]=useState(false);
  const [loading,setLoading]=useState(true);
  const [uploading,setUploading]=useState(false);

  const load=async()=>{
    try{
      setLoading(true);
      await backendApi.bootstrapCommerceCatalog().catch(()=>null);
      const [p,c]=await Promise.all([
        backendApi.listCommerceProducts({includeArchived:true}),
        backendApi.listCommerceCollections(),
      ]);
      setProducts(p.products||[]); setCollections(c.collections||[]);
    }catch(e:any){ toast.error(e?.message||"No se pudo cargar el catálogo comercial"); }
    finally{ setLoading(false); }
  };
  useEffect(()=>{ void load(); },[]);

  const visible=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return products.filter((p)=>{
      const collectionOk=selectedCollection==="all" || (p.collections||[]).includes(selectedCollection);
      const qOk=!q || [p.name,p.sku,p.category,p.scientificName,p.description].filter(Boolean).join(" ").toLowerCase().includes(q);
      return collectionOk && qOk;
    });
  },[products,selectedCollection,query]);

  const startNew=(collection?:string)=>{
    const next=emptyForm();
    if(collection && collection!=="all"){
      next.collections=[collection];
      next.category=collection==="dulce"?"dulce":collection==="moda"?"moda":collection;
      next.type=collection==="dulce"?"food":collection==="moda"?"fashion":"plant";
    }
    setForm(next);
  };

  const uploadImage=async(file?:File)=>{
    if(!file) return;
    if(file.size>8*1024*1024) return toast.error("La imagen supera 8 MB");
    try{
      setUploading(true);
      const dataUrl=await new Promise<string>((resolve,reject)=>{
        const r=new FileReader(); r.onload=()=>resolve(String(r.result||"")); r.onerror=()=>reject(new Error("No se pudo leer la imagen")); r.readAsDataURL(file);
      });
      const result=await backendApi.uploadSiteMedia({dataUrl,filename:file.name});
      setForm((f)=>f?{...f,image:result.media.url}:f);
      toast.success("Imagen subida a Supabase Storage");
    }catch(e:any){ toast.error(e?.message||"No se pudo subir la imagen"); }
    finally{ setUploading(false); }
  };

  const save=async()=>{
    if(!form) return;
    if(!form.name.trim()) return toast.error("Escribe el nombre del producto");
    if(!(Number(form.price)>=0)) return toast.error("Precio no válido");
    if(!form.collections.length) return toast.error("Selecciona al menos una colección");
    const payload={
      name:form.name.trim(), scientificName:form.scientificName.trim(), description:form.description.trim(),
      type:form.type, category:form.category, price:Number(form.price||0),
      compareAtPrice:form.compareAtPrice?Number(form.compareAtPrice):null, cost:form.cost?Number(form.cost):null,
      taxRate:Number(form.taxRate||21), sku:form.sku.trim(), stock:Math.max(0,Math.floor(Number(form.stock||0))),
      status:form.status, active:form.status==="active", featured:form.featured, image:form.image,
      images:form.image?[form.image]:[], collections:form.collections, environment:form.environment, light:form.light,
      size:form.size, difficulty:form.difficulty, petSafe:form.petSafe, toxicity:form.toxicity, water:form.water,
      temperature:form.temperature, humidity:form.humidity, growth:form.growth, origin:form.origin,
      potDiameter:form.potDiameter, height:form.height, allowDedication:form.allowDedication,
      seoTitle:form.seoTitle||form.name, seoDescription:form.seoDescription||form.description,
      variants:parseVariants(form.variantsText),
    };
    try{
      setSaving(true);
      if(form.id) await backendApi.updateCommerceProduct(form.id,payload);
      else await backendApi.createCommerceProduct(payload);
      toast.success(form.id?"Producto actualizado y publicado":"Producto creado y publicado");
      setForm(null); await load();
    }catch(e:any){ toast.error(e?.message||"No se pudo guardar el producto"); }
    finally{ setSaving(false); }
  };

  const archive=async(p:any)=>{
    if(!confirm(`¿Archivar "${p.name}"? Dejará de mostrarse en la tienda.`)) return;
    try{ await backendApi.deleteCommerceProduct(p.id,false); toast.success("Producto archivado"); await load(); }
    catch(e:any){toast.error(e?.message||"No se pudo archivar");}
  };

  return <section className="rounded-2xl border border-border bg-card p-6">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Catálogo conectado al frontend</p>
        <h3 className="mt-1 text-2xl font-black">Productos y publicaciones por sección</h3>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Crea aquí plantas, tartas, moda, decoración, semillas, sustratos o servicios. Al publicar, el mismo producto aparece en la colección elegida, el catálogo y su ficha de venta.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 font-bold"><RefreshCw className="h-4 w-4"/>Actualizar</button>
        <button type="button" onClick={()=>startNew(selectedCollection)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-black text-primary-foreground"><PackagePlus className="h-4 w-4"/>Añadir producto</button>
      </div>
    </div>

    <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
      <button onClick={()=>setSelectedCollection("all")} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${selectedCollection==="all"?"bg-primary text-primary-foreground":"border border-border"}`}>Todos</button>
      {collections.map(c=><button key={c.id} onClick={()=>setSelectedCollection(c.id)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${selectedCollection===c.id?"bg-primary text-primary-foreground":"border border-border"}`}>{c.name}</button>)}
    </div>

    <div className="relative mt-4">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar producto, SKU, categoría…" className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-4"/>
    </div>

    {loading?<p className="py-10 text-center text-muted-foreground">Cargando catálogo…</p>:
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map(p=><article key={p.id} className="overflow-hidden rounded-2xl border border-border bg-background">
          <div className="relative h-44 bg-muted">{p.image?<img src={p.image} alt={p.name} className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center text-muted-foreground">Sin imagen</div>}
            <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-black ${p.deletedAt?"bg-zinc-800 text-white":p.active===false?"bg-amber-100 text-amber-800":"bg-emerald-100 text-emerald-800"}`}>{p.deletedAt?"Archivado":p.active===false?"Borrador":"Publicado"}</span>
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between gap-3"><div><h4 className="font-black">{p.name}</h4><p className="text-xs text-muted-foreground">{p.sku||"Sin SKU"} · stock {Number(p.stock||0)}</p></div><b className="text-primary">{money(p.salePrice||p.price)}</b></div>
            <div className="mt-3 flex flex-wrap gap-1">{(p.collections||[]).map((id:string)=><span key={id} className="rounded-full bg-muted px-2 py-1 text-[11px]">{collections.find(c=>c.id===id)?.name||id}</span>)}</div>
            <div className="mt-4 flex gap-2"><button onClick={()=>setForm(formFromProduct(p))} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-bold"><Edit3 className="h-4 w-4"/>Editar</button>{!p.deletedAt&&<button onClick={()=>void archive(p)} className="rounded-xl border border-border px-3 py-2 text-sm font-bold text-destructive"><Archive className="h-4 w-4"/></button>}</div>
          </div>
        </article>)}
        {!visible.length&&<div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center"><p className="font-bold">No hay productos en esta sección</p><button onClick={()=>startNew(selectedCollection)} className="mt-4 rounded-xl bg-primary px-4 py-2 font-black text-primary-foreground">Añadir el primero</button></div>}
      </div>}

    {form&&<div className="fixed inset-0 z-[100] overflow-y-auto bg-black/55 p-4">
      <div className="mx-auto my-6 max-w-5xl rounded-3xl bg-card shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl border-b border-border bg-card px-6 py-4"><div><p className="text-xs font-black uppercase tracking-wider text-primary">{form.id?"Editar producto":"Nuevo producto"}</p><h3 className="text-xl font-black">{form.name||"Producto sin nombre"}</h3></div><button onClick={()=>setForm(null)} className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5"/></button></div>
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2"><Field label="Nombre *" value={form.name} onChange={v=>setForm({...form,name:v})}/><Field label="Nombre científico" value={form.scientificName} onChange={v=>setForm({...form,scientificName:v})}/></div>
            <TextArea label="Descripción" value={form.description} onChange={v=>setForm({...form,description:v})}/>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Field label="Precio € *" type="number" value={form.price} onChange={v=>setForm({...form,price:v})}/><Field label="Precio anterior €" type="number" value={form.compareAtPrice} onChange={v=>setForm({...form,compareAtPrice:v})}/><Field label="Coste €" type="number" value={form.cost} onChange={v=>setForm({...form,cost:v})}/><Field label="IVA %" type="number" value={form.taxRate} onChange={v=>setForm({...form,taxRate:v})}/></div>
            <div className="grid gap-4 md:grid-cols-3"><Field label="SKU" value={form.sku} onChange={v=>setForm({...form,sku:v})}/><Field label="Stock" type="number" value={form.stock} onChange={v=>setForm({...form,stock:v})}/><Select label="Estado" value={form.status} onChange={v=>setForm({...form,status:v as any})} options={[["active","Publicado"],["draft","Borrador"],["archived","Archivado"]]}/></div>
            <div><p className="mb-2 text-sm font-semibold">Colecciones donde aparece</p><div className="flex flex-wrap gap-2">{collections.map(c=>{const on=form.collections.includes(c.id);return <button type="button" key={c.id} onClick={()=>setForm({...form,collections:on?form.collections.filter(x=>x!==c.id):[...form.collections,c.id]})} className={`rounded-full border px-3 py-2 text-sm font-bold ${on?"border-primary bg-primary/10 text-primary":"border-border"}`}>{c.name}</button>})}</div></div>
            <div className="grid gap-4 md:grid-cols-3"><Select label="Tipo" value={form.type} onChange={v=>setForm({...form,type:v})} options={[["plant","Planta"],["food","Dulce/alimento"],["fashion","Moda"],["decor","Decoración"],["garden","Jardinería"],["service","Servicio"],["other","Otro"]]}/><Field label="Categoría interna" value={form.category} onChange={v=>setForm({...form,category:v})}/><label className="flex items-end gap-2 pb-3 text-sm font-semibold"><input type="checkbox" checked={form.featured} onChange={e=>setForm({...form,featured:e.target.checked})}/> Producto destacado</label></div>
            {form.type==="plant"&&<div className="rounded-2xl border border-border p-4"><h4 className="font-black">Ficha de planta</h4><div className="mt-4 grid gap-4 md:grid-cols-3"><Field label="Interior/exterior" value={form.environment} onChange={v=>setForm({...form,environment:v})}/><Field label="Luz" value={form.light} onChange={v=>setForm({...form,light:v})}/><Field label="Riego" value={form.water} onChange={v=>setForm({...form,water:v})}/><Field label="Tamaño" value={form.size} onChange={v=>setForm({...form,size:v})}/><Field label="Altura" value={form.height} onChange={v=>setForm({...form,height:v})}/><Field label="Diámetro maceta" value={form.potDiameter} onChange={v=>setForm({...form,potDiameter:v})}/><Field label="Humedad" value={form.humidity} onChange={v=>setForm({...form,humidity:v})}/><Field label="Temperatura" value={form.temperature} onChange={v=>setForm({...form,temperature:v})}/><Field label="Crecimiento" value={form.growth} onChange={v=>setForm({...form,growth:v})}/><Field label="Origen" value={form.origin} onChange={v=>setForm({...form,origin:v})}/><Field label="Dificultad" value={form.difficulty} onChange={v=>setForm({...form,difficulty:v})}/><Field label="Toxicidad" value={form.toxicity} onChange={v=>setForm({...form,toxicity:v})}/></div><label className="mt-4 flex gap-2 text-sm font-semibold"><input type="checkbox" checked={form.petSafe} onChange={e=>setForm({...form,petSafe:e.target.checked})}/> Apta para mascotas</label></div>}
            <TextArea label="Variantes (una por línea: nombre | precio | stock | SKU)" value={form.variantsText} onChange={v=>setForm({...form,variantsText:v})}/>
            <div className="grid gap-4 md:grid-cols-2"><Field label="Título SEO" value={form.seoTitle} onChange={v=>setForm({...form,seoTitle:v})}/><Field label="Descripción SEO" value={form.seoDescription} onChange={v=>setForm({...form,seoDescription:v})}/></div>
          </div>
          <aside className="space-y-4">
            <div className="rounded-2xl border border-border p-4"><p className="mb-3 font-black">Imagen principal</p>{form.image?<img src={form.image} alt="" className="h-64 w-full rounded-xl object-cover"/>:<div className="flex h-64 items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">Sin imagen</div>}<label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground"><ImagePlus className="h-4 w-4"/>{uploading?"Subiendo…":"Subir imagen"}<input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e=>void uploadImage(e.target.files?.[0])}/></label>{form.image&&<button onClick={()=>setForm({...form,image:""})} className="mt-2 w-full rounded-xl border border-border px-3 py-2 text-sm font-bold">Quitar imagen</button>}</div>
            <div className="rounded-2xl border border-border p-4"><p className="font-black">Publicación</p><p className="mt-2 text-sm text-muted-foreground">Publicado aparece inmediatamente en las colecciones elegidas. Borrador se guarda sin mostrarse al cliente.</p><label className="mt-4 flex gap-2 text-sm font-semibold"><input type="checkbox" checked={form.allowDedication} onChange={e=>setForm({...form,allowDedication:e.target.checked})}/> Permitir dedicatoria/personalización</label></div>
          </aside>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 rounded-b-3xl border-t border-border bg-card px-6 py-4"><button onClick={()=>setForm(null)} className="rounded-xl border border-border px-5 py-3 font-bold">Cancelar</button><button disabled={saving} onClick={()=>void save()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4"/>{saving?"Guardando…":"Guardar y publicar"}</button></div>
      </div>
    </div>}
  </section>;
}

function Field({label,value,onChange,type="text"}:{label:string;value:string;onChange:(v:string)=>void;type?:string}){
  return <label className="block"><span className="mb-2 block text-sm font-semibold">{label}</span><input type={type} value={value} onChange={e=>onChange(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5"/></label>;
}
function TextArea({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){
  return <label className="block"><span className="mb-2 block text-sm font-semibold">{label}</span><textarea rows={4} value={value} onChange={e=>onChange(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5"/></label>;
}
function Select({label,value,onChange,options}:{label:string;value:string;onChange:(v:string)=>void;options:[string,string][]}){
  return <label className="block"><span className="mb-2 block text-sm font-semibold">{label}</span><select value={value} onChange={e=>onChange(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5">{options.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>;
}
