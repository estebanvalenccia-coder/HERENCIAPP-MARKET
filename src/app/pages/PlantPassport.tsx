import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router";
import { Droplets, Leaf, PawPrint, QrCode, Sun, ThermometerSun } from "lucide-react";
import { backendStorage } from "../lib/backendStorage";

export function PlantPassport(){
  const { id }=useParams();
  const [product,setProduct]=useState<any>(null);
  useEffect(()=>{try{const rows=JSON.parse(backendStorage.getItem("adminProducts")||"[]");setProduct(rows.find((p:any)=>String(p.id)===String(id))||null);}catch{setProduct(null);}},[id]);
  const url=useMemo(()=>typeof window!=="undefined"?window.location.href:"",[id]);
  const qr=`https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(url)}`;
  if(!product)return <div className="min-h-[70vh] grid place-items-center px-4"><div className="text-center"><Leaf className="mx-auto h-12 w-12 text-primary"/><h1 className="mt-4 text-2xl font-bold">Pasaporte no encontrado</h1><Link to="/productos" className="mt-4 inline-block text-primary">Ver productos</Link></div></div>;
  return <div className="mx-auto max-w-5xl px-4 py-10">
    <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
      <div className="grid lg:grid-cols-2"><div className="min-h-80 bg-muted"><img src={product.image} alt={product.name} className="h-full w-full object-cover"/></div><div className="p-7 lg:p-9"><p className="text-sm font-bold uppercase tracking-wider text-primary">Pasaporte de planta · Herencia</p><h1 className="mt-2 text-4xl font-black">{product.name}</h1><p className="mt-3 text-muted-foreground">{product.description}</p><div className="mt-6 grid grid-cols-2 gap-3"><Info icon={Droplets} label="Riego" value={product.water||"Según necesidad del sustrato"}/><Info icon={Sun} label="Luz" value={product.light||"Consultar ficha"}/><Info icon={ThermometerSun} label="Temperatura" value={product.temperature||"Ambiente estable"}/><Info icon={PawPrint} label="Mascotas" value={product.petSafe?"Apta para mascotas":product.toxicity||"Consultar"}/></div></div></div>
      <div className="grid gap-6 border-t border-border p-7 lg:grid-cols-[1fr_auto] lg:items-center"><div><h2 className="text-2xl font-bold">Conserva este pasaporte</h2><p className="mt-2 text-muted-foreground">Escanea el QR para volver a los cuidados de esta planta desde cualquier dispositivo. Puedes imprimirlo y entregarlo junto con la planta.</p><div className="mt-4 rounded-xl bg-primary/5 p-4 text-sm"><strong>Consejo Herencia:</strong> observa hojas y humedad del sustrato antes de regar; los cuidados pueden variar según estación, luz y temperatura del hogar.</div></div><div className="text-center"><img src={qr} alt="QR de cuidados" className="mx-auto h-52 w-52 rounded-xl border border-border bg-white p-2"/><p className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground"><QrCode className="h-4 w-4"/>QR de cuidados</p></div></div>
    </div>
  </div>;
}
function Info({icon:Icon,label,value}:{icon:any;label:string;value:string}){return <div className="rounded-xl border border-border p-3"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"><Icon className="h-4 w-4"/>{label}</div><p className="mt-1 font-semibold capitalize">{value}</p></div>}
