import { useEffect, useState } from "react";
import { ExternalLink, Save, Upload, Image as ImageIcon, PackagePlus, ListFilter } from "lucide-react";
import { backendStorage } from "../../lib/backendStorage";
import { toast } from "sonner";

export type ThreeDPageSettings = {
  title: string; subtitle: string; eyebrow: string; bannerUrl: string;
  categoryImages: Record<string,string>;
  showCategories: boolean; showFeatured: boolean; showMaterials: boolean; showPersonalized: boolean;
};
export const defaultThreeDPageSettings: ThreeDPageSettings = {
  title:"DISEÑA TU MUNDO EN 3D", subtitle:"Objetos únicos, funcionales y con estilo. Crea espacios que reflejen tu personalidad.",
  eyebrow:"DISEÑOS 3D QUE INSPIRAN", bannerUrl:"https://cdn.shopify.com/s/files/1/1105/9209/8695/files/herencia-market-creaciones-3d-escaparate.webp?v=1793281597",
  categoryImages:{},showCategories:true,showFeatured:true,showMaterials:true,showPersonalized:true
};
export function readThreeDPageSettings(): ThreeDPageSettings {
  try { const raw=backendStorage.getItem("creaciones3dPage"); const data=JSON.parse(raw||"{}"); return {...defaultThreeDPageSettings,...data,categoryImages:{...defaultThreeDPageSettings.categoryImages,...(data.categoryImages||{})}}; }
  catch {return defaultThreeDPageSettings;}
}
const categories=[["macetas-3d","Macetas 3D"],["jarrones-3d","Jarrones y decoración"],["cocina-hogar-3d","Cocina y hogar"],["organizacion-3d","Organización"],["figuras-3d","Figuras y arte"],["personalizados-3d","Personalizados"],["cortadores-moldes-3d","Cortadores y moldes"]];
export function AdminCreaciones3D({onProducts,onNewProduct,onCollections}:{onProducts:()=>void;onNewProduct:()=>void;onCollections:()=>void}) {
  const [form,setForm]=useState<ThreeDPageSettings>(readThreeDPageSettings);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{const update=()=>setForm(readThreeDPageSettings());window.addEventListener("backend-storage",update);return()=>window.removeEventListener("backend-storage",update);},[]);
  async function save(){
    setSaving(true);
    try{await backendStorage.setItem("creaciones3dPage",JSON.stringify(form));window.dispatchEvent(new Event("backend-storage"));toast.success("Página de Creaciones 3D guardada");}
    catch(e:any){toast.error(e?.message||"No se pudo guardar la página");}
    finally{setSaving(false);}
  }
  const field="w-full rounded-xl border border-[#d8d2c5] bg-white px-4 py-3 text-sm text-[#233c2e] outline-none focus:ring-2 focus:ring-[#315b42]/20";
  return <div className="space-y-7 pb-16">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[#78917c]">Tropical Plants / Administración</p><h1 className="mt-1 text-3xl font-black">Creaciones 3D — Editor de página</h1><p className="mt-2 text-sm text-muted-foreground">Controla el escaparate 3D sin modificar la tienda de plantas, sus pedidos ni Stripe.</p></div><div className="flex gap-2"><a target="_blank" rel="noreferrer" href="/creaciones-3d" className="inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold"><ExternalLink size={16}/> Vista pública</a><button type="button" disabled={saving} onClick={()=>void save()} className="inline-flex items-center gap-2 rounded-xl bg-[#315b42] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><Save size={17}/>{saving?"Guardando...":"Guardar cambios"}</button></div></div>
    <div className="grid gap-3 md:grid-cols-3">
      <button onClick={onNewProduct} className="flex items-center gap-3 rounded-2xl border bg-white p-5 text-left font-semibold"><PackagePlus/> Subir nuevo producto 3D</button>
      <button onClick={onProducts} className="flex items-center gap-3 rounded-2xl border bg-white p-5 text-left font-semibold"><ListFilter/> Clasificar productos existentes</button>
      <button onClick={onCollections} className="flex items-center gap-3 rounded-2xl border bg-white p-5 text-left font-semibold"><ImageIcon/> Administrar colecciones</button>
    </div>
    <section className="rounded-3xl border bg-white p-6"><h2 className="mb-5 text-xl font-bold">Banner principal</h2><div className="grid gap-6 lg:grid-cols-2"><div className="space-y-4">
      <label className="block text-sm font-semibold">Texto superior<input className={field+" mt-2"} value={form.eyebrow} onChange={e=>setForm({...form,eyebrow:e.target.value})}/></label>
      <label className="block text-sm font-semibold">Título<input className={field+" mt-2"} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
      <label className="block text-sm font-semibold">Descripción<textarea className={field+" mt-2"} rows={3} value={form.subtitle} onChange={e=>setForm({...form,subtitle:e.target.value})}/></label>
      <label className="block text-sm font-semibold">URL de imagen del banner<input type="url" className={field+" mt-2"} value={form.bannerUrl} onChange={e=>setForm({...form,bannerUrl:e.target.value})} placeholder="https://..."/></label><p className="text-xs text-muted-foreground">Utiliza la URL pública de una imagen de tu biblioteca multimedia. Guarda para actualizar la página pública.</p>
    </div><div className="min-h-64 overflow-hidden rounded-2xl bg-[#221611]">{form.bannerUrl?<img src={form.bannerUrl} alt="Vista previa del banner" className="h-full min-h-64 w-full object-cover"/>:<div className="flex min-h-64 items-center justify-center text-white">Añade una imagen de portada</div>}</div></div></section>
    <section className="rounded-3xl border bg-white p-6"><h2 className="mb-2 text-xl font-bold">Imágenes de categorías</h2><p className="mb-5 text-sm text-muted-foreground">Puedes sustituir la imagen de cada tarjeta. Si queda vacía, se usa la imagen de un producto publicado en esa categoría.</p><div className="grid gap-4 md:grid-cols-2">{categories.map(([id,name])=><label key={id} className="block rounded-2xl bg-[#f7f5f0] p-4 text-sm font-semibold">{name}<input className={field+" mt-2"} placeholder="URL pública de imagen" value={form.categoryImages[id]||""} onChange={e=>setForm({...form,categoryImages:{...form.categoryImages,[id]:e.target.value}})}/>{form.categoryImages[id]&&<img src={form.categoryImages[id]} alt={name} className="mt-3 h-36 w-full rounded-xl object-cover"/>}</label>)}</div></section>
    <section className="rounded-3xl border bg-white p-6"><h2 className="mb-4 text-xl font-bold">Editor de visibilidad</h2><div className="grid gap-3 md:grid-cols-2">{([["showCategories","Categorías visuales"],["showFeatured","Diseños destacados"],["showMaterials","Materiales premium"],["showPersonalized","Diseños personalizados"]] as const).map(([key,label])=><label key={key} className="flex items-center justify-between rounded-xl border p-4 font-semibold"><span>{label}</span><input type="checkbox" className="h-5 w-5 accent-[#315b42]" checked={form[key]} onChange={e=>setForm({...form,[key]:e.target.checked})}/></label>)}</div></section>
    <button type="button" disabled={saving} onClick={()=>void save()} className="inline-flex items-center gap-2 rounded-xl bg-[#315b42] px-6 py-3 font-bold text-white"><Save size={18}/> Guardar cambios</button>
  </div>;
}
