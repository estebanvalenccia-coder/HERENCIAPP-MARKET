import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router";
import { Droplets, Leaf, PawPrint, QrCode, Sun, ThermometerSun } from "lucide-react";
import { backendApi, backendStorage } from "../lib/backendStorage";
import { isPlantCareProduct } from "../lib/commerceCatalog";

export function PlantPassport(){
  const { id }=useParams();
  const [product,setProduct]=useState<any>(null);

  useEffect(()=>{
    let cancelled=false;
    async function load(){
      try{
        const result=id?await backendApi.getCommerceProduct(String(id)):null;
        const found=result?.product||null;
        if(!cancelled)setProduct(found&&isPlantCareProduct(found)?found:null);
      }catch{
        try{
          const rows=JSON.parse(backendStorage.getItem("adminProducts")||"[]");
          const found=rows.find((p:any)=>String(p.id)===String(id))||null;
          if(!cancelled)setProduct(found&&isPlantCareProduct(found)?found:null);
        }catch{
          if(!cancelled)setProduct(null);
        }
      }
    }
    void load();
    return()=>{cancelled=true;};
  },[id]);

  const url=useMemo(()=>typeof window!=="undefined"?window.location.href:"",[id]);
  const qr=`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(url)}`;

  if(!product)return <div className="min-h-[70vh] grid place-items-center px-4"><div className="text-center"><Leaf className="mx-auto h-12 w-12 text-primary"/><h1 className="mt-4 text-2xl font-bold">Pasaporte no encontrado</h1><p className="mt-2 text-sm text-muted-foreground">Este pasaporte solo está disponible para plantas con una ficha de cuidados guardada.</p><Link to="/productos" className="mt-4 inline-block text-primary">Ver productos</Link></div></div>;

  const profile=product.plantProfile&&typeof product.plantProfile==="object"?product.plantProfile:null;
  const care=profile?.care||{};
  const tip=String(profile?.tips||"").trim();

  return <div className="mx-auto max-w-5xl px-4 py-10">
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="grid lg:grid-cols-2"><div className="min-h-80 bg-muted">{product.image?<img src={product.image} alt={product.name} className="h-full w-full object-cover"/>:<div className="grid h-full min-h-80 place-items-center text-muted-foreground">Sin imagen</div>}</div><div className="p-7 lg:p-9"><p className="text-sm font-bold uppercase tracking-wider text-primary">Pasaporte de planta · Herencia</p><h1 className="mt-2 text-4xl font-black">{product.name}</h1>{product.scientificName&&<p className="mt-1 italic text-muted-foreground">{product.scientificName}</p>}<p className="mt-3 text-muted-foreground">{profile?.description||product.description}</p><div className="mt-6 grid grid-cols-2 gap-3"><Info icon={Droplets} label="Riego" value={product.water||care.water}/><Info icon={Sun} label="Luz" value={product.light||care.light}/><Info icon={ThermometerSun} label="Temperatura" value={product.temperature||care.temperature}/><Info icon={PawPrint} label="Mascotas" value={product.petSafe?"Apta para mascotas":product.toxicity||undefined}/></div></div></div>
      <div className="grid gap-6 border-t border-border p-7 lg:grid-cols-[1fr_auto] lg:items-center"><div><h2 className="text-2xl font-bold">Conserva este pasaporte</h2><p className="mt-2 text-muted-foreground">Escanea el QR para volver a los cuidados guardados de esta planta desde cualquier dispositivo. Puedes imprimirlo y entregarlo junto con la planta.</p>{tip&&<div className="mt-4 rounded-xl bg-primary/5 p-4 text-sm"><strong>Consejo HerencIA:</strong> {tip}</div>}</div><div className="text-center"><img src={qr} alt="QR de cuidados" className="mx-auto h-52 w-52 rounded-xl border border-border bg-white p-2"/><p className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground"><QrCode className="h-4 w-4"/>QR de cuidados</p></div></div>
    </div>
  </div>;
}

function Info({icon:Icon,label,value}:{icon:any;label:string;value?:string}){
  if(!value)return null;
  return <div className="rounded-xl border border-border p-3"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"><Icon className="h-4 w-4"/>{label}</div><p className="mt-1 font-semibold">{value}</p></div>;
}
