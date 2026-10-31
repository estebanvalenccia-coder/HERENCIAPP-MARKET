import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Box, Heart, Layers3, Package, Palette, Printer, ShieldCheck, ShoppingCart, Sparkles, Truck } from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../lib/backendStorage";
import { needsExplicitVariantSelection } from "../lib/printfulVariantSelection.js";
import { productBelongsToCollection } from "../lib/commerceCatalog";
import { readThreeDPageSettings, type ThreeDPageSettings } from "../components/admin/AdminCreaciones3D";

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
const HERO_ART = "https://cdn.shopify.com/s/files/1/1105/9209/8695/files/herencia-market-creaciones-3d-escaparate.webp?v=1793281597";
function isLegacy3D(p:any) {
  const collection=String(p.collection||"").toLowerCase();
  const category=String(p.category||"").toLowerCase();
  const joined=(Array.isArray(p.collections)?p.collections:[]).map(String).join(" ").toLowerCase();
  const title=String(p.name||"").toLowerCase();
  const tags=(Array.isArray(p.tags)?p.tags:[p.tags]).join(" ").toLowerCase();
  if (productBelongsToCollection(p,"creaciones-3d")) return true;
  if (/3d|impresi[oó]n 3d|impreso en 3d/.test([collection,category,joined,tags].join(" ")) || /(?:impresi[oó]n|impreso|impresa|diseño|diseños)\s*(?:en\s*)?3d|3d\s*(?:print|impreso)/i.test(title))return true;
  // Only confidently identifiable handmade printed objects: avoid moving ordinary plants.
  if (/cortador(?:es)? de (?:galletas|masa)|tortillero|pataconera|jarr[oó]n naranja escult[oó]rico/i.test(title))return true;
  return false;
}
function legacyCategory(p:any) {
  const cat=String(p.category||"");
  if(cat==="macetas-3d")return cat;
  const title=String(p.name||"").toLowerCase();
  if(/maceta|planter/.test(title))return "macetas-3d";
  if(/jarr[oó]n|florero|l[aá]mpara|decoraci[oó]n/.test(title))return "jarrones-3d";
  if(/cortador|molde|galletas/.test(title))return "cortadores-moldes-3d";
  if(/tortillero|pataconera|cocina/.test(title))return "cocina-hogar-3d";
  if(/personaliz|nombre|placa/.test(title))return "personalizados-3d";
  if(/organizador|porta|soporte/.test(title))return "organizacion-3d";
  if(/figura|escultura/.test(title))return "figuras-3d";
  return cat;
}
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
  const [pageSettings,setPageSettings]=useState<ThreeDPageSettings>(readThreeDPageSettings);
  useEffect(()=>{const refresh=()=>setPageSettings(readThreeDPageSettings());window.addEventListener("storage",refresh);window.addEventListener("backend-storage",refresh);return()=>{window.removeEventListener("storage",refresh);window.removeEventListener("backend-storage",refresh);};},[]);
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
  const designs=useMemo(()=>items.filter(p=>!p.deletedAt && p.active!==false && p.status!=="archived" && isLegacy3D(p)), [items]);
  const filtered=useMemo(()=>designs.filter(p=>(filter==="todos"||legacyCategory(p)===filter)&&[p.name,p.description,p.category,...(Array.isArray(p.tags)?p.tags:[])].join(" ").toLocaleLowerCase().includes(query.toLocaleLowerCase())),[designs,filter,query]);
  
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
    <section className="relative isolate overflow-hidden bg-[#0d0c0b] text-white">
      <div className="absolute inset-0 bg-cover bg-center opacity-80" style={{backgroundImage:`linear-gradient(90deg, #090909 0%, #0c0b0b 26%, rgba(10,10,10,.42) 59%, rgba(14,12,11,.2) 100%), url("${pageSettings.bannerUrl || HERO_ART}")`}} />
      <div className="pointer-events-none absolute right-[10%] top-[9%] h-[380px] w-[380px] rounded-full border-[5px] border-[#ffa06a] shadow-[0_0_40px_#fd7957,0_0_110px_#ab492d] opacity-80"/>
      <div className="pointer-events-none absolute left-[24%] top-[18%] h-48 w-[47%] -rotate-12 rounded-[100%] border-[22px] border-[#e4aa84]/25 blur-[3px]"/>
      <div className="relative mx-auto flex min-h-[490px] max-w-7xl items-center px-6 pb-20 pt-10 lg:min-h-[530px] lg:px-12">
        <div className="relative z-10 max-w-[560px]">
          <p className="mb-3 text-[11px] font-semibold tracking-[.43em] text-[#f6cfb4]">{pageSettings.eyebrow}</p>
          <h1 className="font-sans text-[clamp(3.4rem,6.5vw,6.2rem)] font-black uppercase leading-[.95] tracking-[-.065em]">{pageSettings.title.toUpperCase().includes("TU MUNDO") ? <>DISEÑA<br/><span className="text-[#ff805f]">TU MUNDO</span><br/>EN 3D</> : pageSettings.title}</h1>
          <p className="mt-5 max-w-[420px] text-base text-white/90">{pageSettings.subtitle}</p>
          <div className="mt-6 flex flex-wrap gap-3"><a href="#disenos" className="inline-flex items-center gap-3 rounded-full bg-[#ff805f] px-6 py-3.5 text-sm font-bold text-black hover:bg-[#ffa58b]">Explorar diseños <ArrowRight size={18}/></a><Link to="/contacto?asunto=diseno-3d" className="inline-flex items-center gap-3 rounded-full border border-white/80 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/10">Personaliza el tuyo <Box size={18}/></Link></div>
        </div>
        <p className="absolute bottom-28 right-10 hidden rotate-[-9deg] font-serif text-2xl italic leading-tight text-white lg:block">Imagina<br/>Diseña<br/>Imprime<br/>Disfruta</p>
        <div className="absolute bottom-5 left-6 flex flex-wrap gap-x-7 gap-y-2 text-[11px] text-white/90 lg:left-12"><span className="flex items-center gap-2"><Truck size={18}/> Envío disponible</span><span className="flex items-center gap-2"><Layers3 size={18}/> Materiales de calidad</span><span className="flex items-center gap-2"><ShieldCheck size={18}/> Pago seguro</span></div>
      </div>
      <svg className="absolute bottom-[-1px] left-0 h-10 w-full" viewBox="0 0 1440 52" preserveAspectRatio="none"><path fill="#fcfaf6" d="M0 34 C180 75 220 2 440 34 S720 50 870 25 S1240 20 1440 8 V52 H0Z"/></svg>
    </section>
    {pageSettings.showCategories && <section className="mx-auto max-w-7xl px-6 py-12 lg:px-12">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5"><div><h2 className="text-3xl font-black uppercase">Categorías</h2><p className="mt-2 text-sm text-neutral-600">Encuentra inspiración en nuestras colecciones.</p></div><Link to="/productos?coleccion=creaciones-3d" className="inline-flex items-center gap-2 text-sm font-semibold">Ver catálogo completo <ArrowRight size={16}/></Link></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">{categories.filter(c=>c.id!=="todos"&&c.id!=="cortadores-moldes-3d").map((c,i)=><button type="button" onClick={()=>{setFilter(c.id);document.getElementById("disenos")?.scrollIntoView({behavior:"smooth"});}} key={c.id} className={`group relative flex min-h-[205px] flex-col justify-end overflow-hidden rounded-[2.6rem] p-4 text-left transition hover:-translate-y-1 ${filter===c.id?"ring-4 ring-[#ff805f]":""}`} style={{background:["#545b3b","#b77351","#d5ab93","#574132","#827061","#ee857c"][i%6]}}>
        {pageSettings.categoryImages[c.id] ? <img src={pageSettings.categoryImages[c.id]} alt={c.title} className="absolute inset-0 h-full w-full object-cover"/> : designs.filter(p=>legacyCategory(p)===c.id&&imageOf(p)).slice(0,1).map(p=><img key={p.id} src={imageOf(p)} alt="" className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-110"/>)}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-white/10"/>
        <span className="relative text-4xl text-white/80">{c.icon}</span><span className="relative mt-7 flex items-end justify-between gap-2 text-sm font-bold text-white">{c.title}<span className="rounded-full bg-white p-2 text-black"><ArrowRight size={15}/></span></span></button>)}</div>
    </section>}
    {pageSettings.showFeatured && <section id="disenos" className="mx-auto max-w-7xl scroll-mt-28 px-6 pb-20 lg:px-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-5"><div><h2 className="text-3xl font-black uppercase">Diseños destacados</h2><p className="mt-2 text-sm text-neutral-600">{filtered.length} diseños disponibles</p></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar diseños 3D..." className="w-full rounded-full border border-[#d8d0c6] bg-white px-5 py-3 text-sm outline-none sm:w-72"/></div>
      {loading?<p className="py-16 text-center">Cargando diseños...</p>:filtered.length?<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{filtered.map(p=><article key={p.id} className="overflow-hidden rounded-[1.5rem] bg-white shadow-sm"><div className="relative aspect-[4/4.2] overflow-hidden bg-[#eee6dd]"><Link to={`/producto/${p.id}`}>{imageOf(p)?<img loading="lazy" src={imageOf(p)} alt={p.name} className="h-full w-full object-cover transition duration-500 hover:scale-105"/>:<div className="flex h-full items-center justify-center"><Printer size={54} className="text-neutral-400"/></div>}</Link><button type="button" aria-label="Favorito" onClick={()=>void toggleFavorite(p.id)} className="absolute right-3 top-3 rounded-full bg-white/90 p-2"><Heart size={19} fill={favorites.includes(String(p.id))?"#ff805f":"none"}/></button></div><div className="p-4"><Link to={`/producto/${p.id}`} className="line-clamp-2 font-bold hover:underline">{p.name}</Link><div className="mt-4 flex items-center justify-between gap-2"><b>{formatPrice(p.onSale&&p.salePrice?p.salePrice:p.price)}</b><button type="button" onClick={()=>addToCart(p)} className="rounded-xl bg-black p-3 text-white" aria-label="Añadir al carrito"><ShoppingCart size={18}/></button></div></div></article>)}</div>:<div className="rounded-3xl border border-dashed border-[#bcb4aa] px-6 py-16 text-center"><Printer className="mx-auto mb-4 text-[#ff805f]" size={42}/><h3 className="text-xl font-bold">Todavía no hay diseños en esta categoría</h3><p className="mt-2 text-neutral-600">Publica productos en Administración → Productos → Creaciones 3D.</p>{filter!=="todos"&&<button className="mt-5 underline" onClick={()=>setFilter("todos")}>Ver todos los diseños</button>}</div>}
    </section>}
    <section className="grid md:grid-cols-2">{pageSettings.showMaterials && <div className="bg-[#201c1a] px-8 py-16 text-white lg:px-20"><p className="text-xs tracking-[.3em] text-[#ffae88]">MATERIALES PREMIUM</p><h2 className="mt-5 text-4xl font-black uppercase">Calidad en cada detalle</h2><p className="mt-4 max-w-md text-white/75">PLA, PETG, TPU y otros materiales según el diseño. Piezas creadas para dar vida a tus ideas.</p><Link to="/contacto" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#ffe1be] px-6 py-3 font-semibold text-black">Consultar materiales <ArrowRight size={17}/></Link></div>}{pageSettings.showPersonalized && <div className="bg-[#dbc7ad] px-8 py-16 lg:px-20"><p className="text-xs tracking-[.3em]">DISEÑOS PERSONALIZADOS</p><h2 className="mt-5 text-4xl font-black uppercase">Tu idea,<br/> nuestra impresión</h2><p className="mt-4 max-w-md">Macetas, accesorios, figuras y más. Cuéntanos qué necesitas y estudiamos cómo hacerlo realidad.</p><Link to="/contacto?asunto=diseno-3d" className="mt-6 inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 font-semibold text-white">Solicitar diseño <ArrowRight size={17}/></Link></div>}</section>
  </div>;
}
