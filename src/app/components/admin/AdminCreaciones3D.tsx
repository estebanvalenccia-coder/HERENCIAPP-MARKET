import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Save, Upload, Image as ImageIcon, PackagePlus, ListFilter } from "lucide-react";
import { backendApi, backendStorage } from "../../lib/backendStorage";
import { toast } from "sonner";

export type ThreeDPageSettings = {
  title: string; subtitle: string; eyebrow: string; bannerUrl: string;
  categoryImages: Record<string,string>;
  categoryVisibility: Record<string,boolean>;
  categoryTitles: Record<string,string>;
  categoryOrder: string[];
  showCategories: boolean; showFeatured: boolean; showMaterials: boolean; showPersonalized: boolean;
};
export const defaultThreeDPageSettings: ThreeDPageSettings = {
  title:"DISEÑA TU MUNDO EN 3D", subtitle:"Objetos únicos, funcionales y con estilo. Crea espacios que reflejen tu personalidad.",
  eyebrow:"DISEÑOS 3D QUE INSPIRAN", bannerUrl:"https://cdn.shopify.com/s/files/1/1105/9209/8695/files/herencia-market-creaciones-3d-escaparate.webp?v=1793281597",
  categoryImages:{},categoryVisibility:{"cortadores-moldes-3d":false},categoryTitles:{},
  categoryOrder:["macetas-3d","jarrones-3d","cocina-hogar-3d","organizacion-3d","figuras-3d","personalizados-3d","cortadores-moldes-3d"],
  showCategories:true,showFeatured:true,showMaterials:true,showPersonalized:true
};
export function readThreeDPageSettings(): ThreeDPageSettings {
  try { const raw=backendStorage.getItem("creaciones3dPage"); const data=JSON.parse(raw||"{}"); return {...defaultThreeDPageSettings,...data,categoryImages:{...defaultThreeDPageSettings.categoryImages,...(data.categoryImages||{})},categoryVisibility:{...defaultThreeDPageSettings.categoryVisibility,...(data.categoryVisibility||{})},categoryTitles:{...defaultThreeDPageSettings.categoryTitles,...(data.categoryTitles||{})},categoryOrder:Array.isArray(data.categoryOrder)?data.categoryOrder:defaultThreeDPageSettings.categoryOrder}; }
  catch {return defaultThreeDPageSettings;}
}
const categories=[["macetas-3d","Macetas 3D"],["jarrones-3d","Jarrones y decoración"],["cocina-hogar-3d","Cocina y hogar"],["organizacion-3d","Organización"],["figuras-3d","Figuras y arte"],["personalizados-3d","Personalizados"],["cortadores-moldes-3d","Cortadores y moldes"]];
export function AdminCreaciones3D({onProducts,onNewProduct,onCollections}:{onProducts:()=>void;onNewProduct:()=>void;onCollections:()=>void}) {
  const [form,setForm]=useState<ThreeDPageSettings>(readThreeDPageSettings);
  const [saving,setSaving]=useState(false);
  const [uploading,setUploading]=useState<string|null>(null);
  const orderedCategories = [...new Set([...form.categoryOrder,...categories.map(([id])=>id)])];
  useEffect(()=>{
    let active=true;
    void backendApi.preload().then(()=>{if(active)setForm(readThreeDPageSettings());});
    const update=()=>setForm(readThreeDPageSettings());
    window.addEventListener("backend-storage",update);
    return()=>{active=false;window.removeEventListener("backend-storage",update);};
  },[]);
  async function uploadImage(file:File|undefined, categoryId?:string){
    if(!file)return;
    const target=categoryId||"banner";
    setUploading(target);
    try{
      const result=await backendApi.uploadSiteMediaFile(file);
      const url=String(result.media?.url||"");
      if(!url)throw new Error("No se ha recibido una URL pública para la fotografía");
      setForm(current=>categoryId
        ?{...current,categoryImages:{...current.categoryImages,[categoryId]:url}}
        :{...current,bannerUrl:url});
      toast.success("Foto subida correctamente. Pulsa Guardar cambios para publicarla.");
    }catch(error:any){toast.error(error?.message||"No se pudo subir la imagen");}
    finally{setUploading(null);}
  }
  function moveCategory(id:string,direction:number){
    setForm(current=>{
      const order=[...new Set([...current.categoryOrder,...categories.map(([categoryId])=>categoryId)])];
      const index=order.indexOf(id);
      const next=index+direction;
      if(index<0||next<0||next>=order.length)return current;
      [order[index],order[next]]=[order[next],order[index]];
      return {...current,categoryOrder:order};
    });
  }
  async function save(){
    setSaving(true);
    try{const result=await backendStorage.setItem("creaciones3dPage",JSON.stringify(form));if(!result.synced)throw new Error(result.error||"No se pudo guardar en el servidor");window.dispatchEvent(new Event("backend-storage"));toast.success("Página de Creaciones 3D guardada y publicada");}
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
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#315b42] px-4 py-3 text-sm font-bold text-[#315b42]">
        <Upload size={17}/>{uploading==="banner"?"Subiendo foto...":"Subir foto desde el dispositivo"}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="sr-only" disabled={!!uploading} onChange={e=>{const file=e.target.files?.[0];e.target.value="";void uploadImage(file);}}/>
      </label>
    </div><div className="min-h-64 overflow-hidden rounded-2xl bg-[#221611]">{form.bannerUrl?<img src={form.bannerUrl} alt="Vista previa del banner" className="h-full min-h-64 w-full object-cover"/>:<div className="flex min-h-64 items-center justify-center text-white">Añade una imagen de portada</div>}</div></div></section>
    <section className="rounded-3xl border bg-white p-6">
      <div className="mb-5">
        <h2 className="text-xl font-bold">Categorías de Creaciones 3D</h2>
        <p className="mt-2 text-sm text-muted-foreground">Activa u oculta cada categoría de forma independiente, cambia el nombre y la fotografía, o cambia su orden. OFF la oculta del escaparate 3D, sin borrar los productos.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {orderedCategories.map((id,index)=>{
          const category=categories.find(([categoryId])=>categoryId===id);
          if(!category)return null;
          const name=category[1];
          const enabled=form.categoryVisibility[id]!==false;
          const image=form.categoryImages[id]||"";
          return <div key={id} className="overflow-hidden rounded-2xl border border-[#e6dfd6] bg-[#f9f7f3]">
            <div className="flex items-center justify-between gap-3 border-b bg-white p-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-[#68816e]">Categoría {index+1}</p>
                <h3 className="truncate font-bold text-[#203a2a]">{form.categoryTitles[id]||name}</h3>
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-bold text-[#315b42]">
                <input type="checkbox" className="h-5 w-5 accent-[#315b42]" checked={enabled}
                  onChange={e=>setForm(current=>({...current,categoryVisibility:{...current.categoryVisibility,[id]:e.target.checked}}))}/>
                {enabled?"ON · Visible":"OFF · Oculta"}
              </label>
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-[minmax(110px,38%)_1fr]">
              <div className="flex min-h-44 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-[#d5ab93] to-[#3b3028]">
                {image?<img src={image} alt={"Vista previa "+name} className="h-full w-full object-cover"/>:<span className="px-3 text-center text-xs font-semibold text-white/80">Sin foto personalizada: se mostrará un producto de la categoría</span>}
              </div>
              <div className="space-y-3">
                <label className="block text-xs font-semibold">Nombre visible
                  <input className={field+" mt-1"} value={form.categoryTitles[id]??""} placeholder={name}
                    onChange={e=>setForm(current=>({...current,categoryTitles:{...current.categoryTitles,[id]:e.target.value}}))}/>
                </label>
                <label className="block text-xs font-semibold">URL de fotografía
                  <input className={field+" mt-1"} value={image} placeholder="https://..."
                    onChange={e=>setForm(current=>({...current,categoryImages:{...current.categoryImages,[id]:e.target.value}}))}/>
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#315b42] px-3 py-2.5 text-xs font-bold text-white">
                  <Upload size={16}/>{uploading===id?"Subiendo...":"Subir / reemplazar foto"}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="sr-only" disabled={!!uploading}
                    onChange={e=>{const file=e.target.files?.[0];e.target.value="";void uploadImage(file,id);}}/>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={()=>moveCategory(id,-1)} disabled={index===0} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs disabled:opacity-40"><ArrowUp size={14}/> Subir</button>
                  <button type="button" onClick={()=>moveCategory(id,1)} disabled={index===orderedCategories.length-1} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs disabled:opacity-40"><ArrowDown size={14}/> Bajar</button>
                  {image&&<button type="button" className="rounded-lg border px-2.5 py-2 text-xs" onClick={()=>setForm(current=>({...current,categoryImages:{...current.categoryImages,[id]:""}}))}>Quitar foto</button>}
                </div>
              </div>
            </div>
          </div>;
        })}
      </div>
      <p className="mt-5 text-sm text-muted-foreground">Para añadir o reclasificar artículos, entra en <button type="button" onClick={onProducts} className="font-bold text-[#315b42] underline">Productos</button>, elige la colección “Creaciones 3D” y su categoría. También puedes <button type="button" onClick={onNewProduct} className="font-bold text-[#315b42] underline">subir un nuevo producto 3D</button>.</p>
    </section>
    <section className="rounded-3xl border bg-white p-6"><h2 className="mb-4 text-xl font-bold">Editor de visibilidad</h2><div className="grid gap-3 md:grid-cols-2">{([["showCategories","Categorías visuales"],["showFeatured","Diseños destacados"],["showMaterials","Materiales premium"],["showPersonalized","Diseños personalizados"]] as const).map(([key,label])=><label key={key} className="flex items-center justify-between rounded-xl border p-4 font-semibold"><span>{label}</span><input type="checkbox" className="h-5 w-5 accent-[#315b42]" checked={form[key]} onChange={e=>setForm({...form,[key]:e.target.checked})}/></label>)}</div></section>
    <button type="button" disabled={saving} onClick={()=>void save()} className="inline-flex items-center gap-2 rounded-xl bg-[#315b42] px-6 py-3 font-bold text-white"><Save size={18}/> Guardar cambios</button>
  </div>;
}
