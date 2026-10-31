import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Box, Heart, Layers3, Package, Palette, Printer, ShieldCheck, ShoppingCart, Sparkles, Truck } from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../lib/backendStorage";
import { needsExplicitVariantSelection } from "../lib/printfulVariantSelection.js";
import { primaryCollectionOf, productBelongsToCollection } from "../lib/commerceCatalog";

const categories = [
  { id:"todos", title:"Todos los diseños", icon:"✦" },
  { id:"macetas-3d", title:"Macetas y jardinería", icon:"✿" },
  { id:"jarrones-3d", title:"Decoración y hogar", icon:"◈" },
  { id:"cocina-hogar-3d", title:"Cocina y hogar", icon:"⌂" },
  { id:"organizacion-3d", title:"Organización", icon:"▦" },
  { id:"figuras-3d", title:"Figuras y arte", icon:"☆" },
  { id:"personalizados-3d", title:"Personalizados", icon:"♡" },
  { id:"cortadores-moldes-3d", title:"Cortadores y moldes", icon:"✳" },
];
const formatPrice=(value:unknown)=>new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(Number(value||0));
function imageOf(product:any) {
  const gallery=Array.isArray(product?.images)?product.images:[];
  return String(product?.image || product?.imageUrl || product?.image_url || gallery.map((x:any)=>typeof x==="string"?x:x?.url||x?.imageUrl).find(Boolean)||"");
}
export function Creaciones3D() {
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState("todos");
  const [query,setQuery]=useState("");
  const [favorites,setFavorites]=useState<string[]>([]);
  useEffect(()=>{
    let active=true;
    async function load(){
      try{
        const result=await backendApi.listCommerceProducts();
        if(active)setItems((result.products||[]).filter((p:any)=>p.status==="active"||p.active===true));
      }catch{
        try{const cached=JSON.parse(backendStorage.getItem("adminProducts")||"[]");if(active)setItems(Array.isArray(cached)?cached:[]);}catch{if(active)setItems([]);}
      }finally{if(active)setLoading(false);}
    }
    void load();
    const onChange=()=>void load();
    window.addEventListener("commerce-products-changed",onChange);
    return()=>{active=false;window.removeEventListener("commerce-products-changed",onChange);};
  },[]);
  useEffect(()=>{try{setFavorites(JSON.parse(backendStorage.getItem("wishlist")||"[]").map(String));}catch{setFavorites([]);}},[]);
  const designs=useMemo(()=>items.filter(p=>!p.deletedAt && p.active!==false && p.status!=="archived" && productBelongsToCollection(p,"creaciones-3d")), [items]);
  const filtered=useMemo(()=>designs.filter(p=>(filter==="todos"||p.category===filter)&&[p.name,p.description,p.category,...(Array.isArray(p.tags)?p.tags:[])].join(" ").toLocaleLowerCase().includes(query.toLocaleLowerCase())),[designs,filter,query]);
  const showcase=designs.filter(p=>imageOf(p)).slice(0,3);
  async function toggleFavorite(id:any){
    const value=String(id);
    const next=favorites.includes(value)?favorites.filter(x=>x!==value):[...favorites,value];
    setFavorites(next);
    await backendStorage.setItem("wishlist",JSON.stringify(next));
    backendApi.customerSaveWishlist(next).catch(()=>null);
    window.dispatchEvent(new Event("storage"));
  }
  function addToCart(p:any){
    if(needsExplicitVariantSelection(p)){window.location.href="/producto/"+p.id;return;}
    const variants=Array.isArray(p.variants)?p.variants:[];
    const variant=variants.length?variants.find((x:any)=>p.trackInventory===false||Number(x.stock||0)>0):null;
    if(variants.length&&!variant){toast.error("No hay variantes disponibles");return;}
    const price=Number(variant?.price ?? (p.onSale&&p.salePrice?p.salePrice:p.price));
    if(price<=0){toast.error("Este artículo no tiene un precio válido");return;}
    const selectedVariant=variant?String(variant.name||variant):"";
    const key=`${p.id}::${selectedVariant||"base"}::`;
    const cart=JSON.parse(backendStorage.getItem("cart")||"[]");
    const existing=cart.find((x:any)=>x.lineKey===key);
    const quantity=Number(existing?.quantity||0)+1;
    const stock=Number(variant?.stock??p.stock??0);
    if(p.trackInventory!==false && quantity>stock){toast.error("No hay suficientes unidades disponibles");return;}
    if(existing)existing.quantity=quantity;
    else cart.push({...p,price,quantity:1,lineKey:key,selectedVariant:selectedVariant||undefined});
    void backendStorage.setItem("cart",JSON.stringify(cart));
    window.dispatchEvent(new Event("storage"));
    toast.success("Añadido al carrito");
  }
  return <div className="min-h-screen bg-[#fcfaf6] text-[#191919]">
    <section className="relative isolate overflow-hidden bg-[#101010] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-80" style={{background:"radial-gradient(ellipse at 76% 40%, #ad593f 0%, #513021 27%, transparent 56%), linear-gradient(120deg,#0a0a0a,#242020)"}}/>
      <div className="relative mx-auto grid min-h-[540px] max-w-7xl items-center gap-8 px-6 py-20 lg:grid-cols-[.95fr_1.05fr] lg:px-12">
        <div className="z-10">
          <p className="mb-5 text-xs font-semibold tracking-[.46em] text-[#efc4aa]">DISEÑOS 3D QUE INSPIRAN</p>
          <h1 className="text-[clamp(3.6rem,7vw,7rem)] font-black uppercase leading-[.88] tracking-[-.06em]">DISEÑA<br/><span className="text-[#ff805f]">TU MUNDO</span><br/>EN 3D</h1>
          <p className="mt-6 max-w-lg text-lg text-white/80">Objetos únicos, funcionales y con estilo. Crea espacios que reflejen tu personalidad.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#disenos" className="inline-flex items-center gap-3 rounded-full bg-[#ff805f] px-7 py-4 font-bold text-black transition hover:bg-[#ffa58b]">Explorar diseños <ArrowRight size={18}/></a>
            <Link to="/contacto" className="inline-flex items-center gap-3 rounded-full border border-white/70 px-7 py-4 font-semibold text-white hover:bg-white/10">Personaliza el tuyo <Box size={18}/></Link>
          </div>
        </div>
        <div className="relative flex min-h-[320px] items-end justify-center gap-3">
          <div className="absolute right-1/4 top-0 h-64 w-64 rounded-full border-[5px] border-[#ff936c] shadow-[0_0_80px_#f87547] lg:h-80 lg:w-80"/>
          {showcase.length?showcase.map((p,i)=><Link key={p.id} to={`/producto/${p.id}`} className={`relative overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 shadow-2xl ${i===1?"-translate-y-12":""}`} style={{width:i===1?"38%":"29%",aspectRatio:"3/4"}}><img src={imageOf(p)} alt={p.name} className="h-full w-full object-cover"/><span className="absolute bottom-0 block w-full bg-black/60 p-2 text-xs font-semibold">{p.name}</span></Link>):<div className="flex h-72 w-full items-center justify-center rounded-[2rem] border border-white/20 bg-white/5 text-center"><div><Printer size={66} className="mx-auto mb-3 text-[#ff805f]"/><p>Próximamente, nuestros diseños 3D</p></div></div>}
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs text-white/80 lg:col-span-2">
          <span className="flex items-center gap-2"><Truck size={19}/> Envíos disponibles</span>
          <span className="flex items-center gap-2"><Layers3 size={19}/> Impresión por capas</span>
          <span className="flex items-center gap-2"><ShieldCheck size={19}/> Pago seguro</span>
          <span className="flex items-center gap-2"><Sparkles size={19}/> Diseños originales</span>
        </div>
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-6 py-12 lg:px-12">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5"><div><h2 className="text-3xl font-black uppercase">Categorías</h2><p className="mt-2 text-sm text-neutral-600">Encuentra inspiración en nuestras colecciones.</p></div><Link to="/productos?coleccion=creaciones-3d" className="inline-flex items-center gap-2 text-sm font-semibold">Ver catálogo completo <ArrowRight size={16}/></Link></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">{categories.map((c,i)=><button type="button" onClick={()=>{setFilter(c.id);document.getElementById("disenos")?.scrollIntoView({behavior:"smooth"});}} key={c.id} className={`group flex min-h-36 flex-col justify-between rounded-[1.7rem] p-4 text-left transition hover:-translate-y-1 ${filter===c.id?"bg-[#ff805f] text-black ring-2 ring-black":"bg-[#eae3dc] text-[#26211d]"}`}><span className="text-4xl">{c.icon}</span><span className="text-sm font-bold">{c.title} ↗</span></button>)}</div>
    </section>
    <section id="disenos" className="mx-auto max-w-7xl scroll-mt-28 px-6 pb-20 lg:px-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-5"><div><h2 className="text-3xl font-black uppercase">Diseños destacados</h2><p className="mt-2 text-sm text-neutral-600">{filtered.length} diseños disponibles</p></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar diseños 3D..." className="w-full rounded-full border border-[#d8d0c6] bg-white px-5 py-3 text-sm outline-none sm:w-72"/></div>
      {loading?<p className="py-16 text-center">Cargando diseños...</p>:filtered.length?<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{filtered.map(p=><article key={p.id} className="overflow-hidden rounded-[1.5rem] bg-white shadow-sm"><div className="relative aspect-[4/4.2] overflow-hidden bg-[#eee6dd]"><Link to={`/producto/${p.id}`}>{imageOf(p)?<img loading="lazy" src={imageOf(p)} alt={p.name} className="h-full w-full object-cover transition duration-500 hover:scale-105"/>:<div className="flex h-full items-center justify-center"><Printer size={54} className="text-neutral-400"/></div>}</Link><button type="button" aria-label="Favorito" onClick={()=>void toggleFavorite(p.id)} className="absolute right-3 top-3 rounded-full bg-white/90 p-2"><Heart size={19} fill={favorites.includes(String(p.id))?"#ff805f":"none"}/></button></div><div className="p-4"><Link to={`/producto/${p.id}`} className="line-clamp-2 font-bold hover:underline">{p.name}</Link><div className="mt-4 flex items-center justify-between gap-2"><b>{formatPrice(p.onSale&&p.salePrice?p.salePrice:p.price)}</b><button type="button" onClick={()=>addToCart(p)} className="rounded-xl bg-black p-3 text-white" aria-label="Añadir al carrito"><ShoppingCart size={18}/></button></div></div></article>)}</div>:<div className="rounded-3xl border border-dashed border-[#bcb4aa] px-6 py-16 text-center"><Printer className="mx-auto mb-4 text-[#ff805f]" size={42}/><h3 className="text-xl font-bold">Todavía no hay diseños en esta categoría</h3><p className="mt-2 text-neutral-600">Publica productos en Administración → Productos → Creaciones 3D.</p>{filter!=="todos"&&<button className="mt-5 underline" onClick={()=>setFilter("todos")}>Ver todos los diseños</button>}</div>}
    </section>
    <section className="grid md:grid-cols-2"><div className="bg-[#201c1a] px-8 py-16 text-white lg:px-20"><p className="text-xs tracking-[.3em] text-[#ffae88]">MATERIALES PREMIUM</p><h2 className="mt-5 text-4xl font-black uppercase">Calidad en cada detalle</h2><p className="mt-4 max-w-md text-white/75">PLA, PETG, TPU y otros materiales según el diseño. Piezas creadas para dar vida a tus ideas.</p><Link to="/contacto" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#ffe1be] px-6 py-3 font-semibold text-black">Consultar materiales <ArrowRight size={17}/></Link></div><div className="bg-[#dbc7ad] px-8 py-16 lg:px-20"><p className="text-xs tracking-[.3em]">DISEÑOS PERSONALIZADOS</p><h2 className="mt-5 text-4xl font-black uppercase">Tu idea,<br/> nuestra impresión</h2><p className="mt-4 max-w-md">Macetas, accesorios, figuras y más. Cuéntanos qué necesitas y estudiamos cómo hacerlo realidad.</p><Link to="/contacto" className="mt-6 inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 font-semibold text-white">Solicitar diseño <ArrowRight size={17}/></Link></div></section>
  </div>;
}
