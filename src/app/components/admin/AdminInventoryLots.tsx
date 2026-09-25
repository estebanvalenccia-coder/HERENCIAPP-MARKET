import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, PackageOpen, Save, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../../lib/backendStorage";

declare global {
  interface Window { BarcodeDetector?: any; }
}

export function AdminInventoryLots(){
  const [operations,setOperations]=useState<any>({});
  const [products,setProducts]=useState<any[]>([]);
  const [form,setForm]=useState({productId:"",lotCode:"",quantity:1,expiresAt:"",locationId:"tienda"});
  const [scannerOpen,setScannerOpen]=useState(false);
  const videoRef=useRef<HTMLVideoElement|null>(null);
  const streamRef=useRef<MediaStream|null>(null);

  const load=async()=>{try{const [r]=await Promise.all([backendApi.getPosOperations(),backendStorage.refresh()]);setOperations(r.operations||{});try{setProducts(JSON.parse(backendStorage.getItem("adminProducts")||"[]").filter((p:any)=>p.active!==false&&!p.deletedAt));}catch{setProducts([]);}}catch(e:any){toast.error(e?.message||"No se pudo cargar lotes");}};
  useEffect(()=>{void load();return()=>{streamRef.current?.getTracks().forEach(t=>t.stop());};},[]);

  const lots=Array.isArray(operations.inventoryLots)?operations.inventoryLots:[];
  const locations=useMemo(()=>{const rows=Array.isArray(operations.inventoryLocations)?operations.inventoryLocations:[];return rows.length?rows:[{id:"tienda",name:"Tienda"}];},[operations]);
  const today=new Date().toISOString().slice(0,10);
  const in30=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  const expiring=lots.filter((l:any)=>l.expiresAt&&l.remaining>0&&l.expiresAt<=in30);
  const expired=lots.filter((l:any)=>l.expiresAt&&l.remaining>0&&l.expiresAt<today);

  const save=async()=>{if(!form.productId||!form.lotCode||form.quantity<=0)return toast.error("Completa producto, lote y cantidad");try{const r=await backendApi.createInventoryLot(form);setOperations(r.operations);setForm({...form,lotCode:"",quantity:1,expiresAt:""});toast.success("Lote registrado");}catch(e:any){toast.error(e?.message||"No se pudo guardar");}};

  const startScanner=async()=>{
    const Detector=window.BarcodeDetector;
    if(!Detector)return toast.error("Este navegador no soporta escaneo de códigos. Puedes escribir el SKU/lote manualmente.");
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});
      streamRef.current=stream;setScannerOpen(true);
      setTimeout(async()=>{
        if(videoRef.current){videoRef.current.srcObject=stream;await videoRef.current.play();scanLoop();}
      },50);
    }catch(e:any){toast.error(e?.message||"No se pudo abrir la cámara");}
  };

  const stopScanner=()=>{streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;setScannerOpen(false);};

  const scanLoop=async()=>{
    const Detector=window.BarcodeDetector;
    if(!Detector||!streamRef.current||!videoRef.current)return;
    try{
      const detector=new Detector({formats:["ean_13","ean_8","code_128","qr_code","upc_a","upc_e"]});
      const codes=await detector.detect(videoRef.current);
      if(codes?.[0]?.rawValue){
        const code=String(codes[0].rawValue);
        const match=products.find((p:any)=>String(p.sku||"").toLowerCase()===code.toLowerCase()||String(p.id)===code);
        if(match){setForm(f=>({...f,productId:String(match.id),lotCode:f.lotCode||code}));toast.success(`Producto detectado: ${match.name}`);}
        else {setForm(f=>({...f,lotCode:code}));toast.success("Código leído; úsalo como lote o busca el producto manualmente");}
        stopScanner();return;
      }
    }catch{}
    if(streamRef.current)requestAnimationFrame(()=>void scanLoop());
  };

  const updateRemaining=async(lot:any,delta:number)=>{const next=Math.max(0,Number(lot.remaining||0)+delta);try{const r=await backendApi.updateInventoryLot(lot.id,{remaining:next});setOperations(r.operations);}catch(e:any){toast.error(e?.message||"No se pudo actualizar");}};

  return <div className="space-y-6">
    <section className="rounded-3xl border border-border bg-card p-6"><div className="flex items-center gap-3"><PackageOpen className="h-7 w-7 text-primary"/><div><h1 className="text-3xl font-black">Lotes, caducidad y escáner</h1><p className="mt-1 text-muted-foreground">Controla entradas identificables, fechas de caducidad y lectura de códigos desde móvil.</p></div></div></section>
    <div className="grid gap-4 md:grid-cols-3"><Metric label="Lotes activos" value={String(lots.filter((l:any)=>l.remaining>0).length)}/><Metric label="Caducan ≤30 días" value={String(expiring.length)}/><Metric label="Caducados" value={String(expired.length)}/></div>

    <section className="rounded-2xl border border-border bg-card p-6"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Registrar lote</h2><button onClick={()=>void startScanner()} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold"><Camera className="h-4 w-4"/>Escanear</button></div><div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5"><select value={form.productId} onChange={(e)=>setForm({...form,productId:e.target.value})} className="rounded-xl border border-border p-3"><option value="">Producto</option>{products.map((p:any)=><option key={p.id} value={p.id}>{p.name} · {p.sku||p.id}</option>)}</select><input value={form.lotCode} onChange={(e)=>setForm({...form,lotCode:e.target.value})} placeholder="Lote / código" className="rounded-xl border border-border p-3"/><input type="number" min="1" value={form.quantity} onChange={(e)=>setForm({...form,quantity:Math.max(1,Number(e.target.value||1))})} className="rounded-xl border border-border p-3"/><input type="date" value={form.expiresAt} onChange={(e)=>setForm({...form,expiresAt:e.target.value})} className="rounded-xl border border-border p-3"/><select value={form.locationId} onChange={(e)=>setForm({...form,locationId:e.target.value})} className="rounded-xl border border-border p-3">{locations.map((l:any)=><option key={l.id} value={l.id}>{l.name}</option>)}</select></div><button onClick={()=>void save()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"><Save className="h-4 w-4"/>Guardar lote</button></section>

    {scannerOpen&&<section className="rounded-2xl border border-primary/30 bg-primary/5 p-4"><div className="flex items-center justify-between"><p className="font-semibold">Apunta la cámara al código</p><button onClick={stopScanner} className="text-sm text-destructive">Cerrar cámara</button></div><video ref={videoRef} muted playsInline className="mt-3 max-h-80 w-full rounded-xl bg-black object-cover"/></section>}

    <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-xl font-bold">Lotes registrados</h2><div className="mt-4 overflow-auto"><table className="w-full min-w-[850px] text-sm"><thead><tr className="border-b border-border text-left"><th className="p-3">Producto</th><th>Lote</th><th>Ubicación</th><th>Recibido</th><th>Caduca</th><th>Restante</th><th></th></tr></thead><tbody>{lots.map((l:any)=>{const isExpired=l.expiresAt&&l.expiresAt<today;const isSoon=l.expiresAt&&l.expiresAt<=in30;return <tr key={l.id} className="border-b border-border/50"><td className="p-3 font-semibold">{products.find((p:any)=>String(p.id)===String(l.productId))?.name||l.productId}</td><td className="font-mono">{l.lotCode}</td><td>{locations.find((x:any)=>x.id===l.locationId)?.name||l.locationId}</td><td>{l.receivedAt}</td><td><span className={isExpired?"font-bold text-destructive":isSoon?"font-bold text-amber-600":""}>{l.expiresAt||"—"}</span></td><td className="font-bold">{l.remaining}/{l.quantity}</td><td><div className="flex gap-1"><button onClick={()=>void updateRemaining(l,-1)} className="rounded-lg border border-border px-2 py-1">−1</button><button onClick={()=>void updateRemaining(l,1)} className="rounded-lg border border-border px-2 py-1">+1</button>{isExpired&&<AlertTriangle className="ml-2 h-4 w-4 text-destructive"/>}</div></td></tr>})}</tbody></table></div></section>
  </div>;
}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-border bg-card p-5"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>}
