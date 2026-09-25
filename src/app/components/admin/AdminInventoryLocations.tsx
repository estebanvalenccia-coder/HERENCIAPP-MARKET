import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, MapPin, Plus, Save, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../../lib/backendStorage";

export function AdminInventoryLocations(){
  const [operations,setOperations]=useState<any>({});
  const [products,setProducts]=useState<any[]>([]);
  const [locationName,setLocationName]=useState("");
  const [selectedProduct,setSelectedProduct]=useState("");
  const [selectedLocation,setSelectedLocation]=useState("");
  const [stock,setStock]=useState(0);
  const [transfer,setTransfer]=useState({productId:"",from:"",to:"",quantity:1});

  const load=async()=>{try{const [r]=await Promise.all([backendApi.getPosOperations(),backendStorage.refresh()]);setOperations(r.operations||{});try{setProducts(JSON.parse(backendStorage.getItem("adminProducts")||"[]").filter((p:any)=>p.active!==false&&!p.deletedAt));}catch{setProducts([]);}}catch(e:any){toast.error(e?.message||"No se pudo cargar el inventario");}};
  useEffect(()=>{void load();},[]);

  const locations=useMemo(()=>{const rows=Array.isArray(operations.inventoryLocations)?operations.inventoryLocations:[];return rows.length?rows:[{id:"tienda",name:"Tienda",active:true}];},[operations]);
  const locationStock=operations.inventoryLocationStock||{};
  const transfers=operations.inventoryTransfers||[];

  const addLocation=async()=>{if(!locationName.trim())return;try{const r=await backendApi.createInventoryLocation(locationName);setOperations(r.operations);setLocationName("");toast.success("Ubicación creada");}catch(e:any){toast.error(e?.message||"No se pudo crear");}};
  const saveStock=async()=>{if(!selectedProduct||!selectedLocation)return toast.error("Selecciona producto y ubicación");try{const r=await backendApi.setInventoryLocationStock({productId:selectedProduct,locationId:selectedLocation,stock});setOperations(r.operations);toast.success("Stock de ubicación actualizado");}catch(e:any){toast.error(e?.message||"No se pudo guardar");}};
  const doTransfer=async()=>{if(!transfer.productId||!transfer.from||!transfer.to)return toast.error("Completa la transferencia");try{const r=await backendApi.transferInventory(transfer);setOperations(r.operations);toast.success("Transferencia registrada");}catch(e:any){toast.error(e?.message||"No se pudo transferir");}};

  return <div className="space-y-6">
    <section className="rounded-3xl border border-border bg-card p-6"><div className="flex items-center gap-3"><Warehouse className="h-7 w-7 text-primary"/><div><h1 className="text-3xl font-black">Inventario por ubicación</h1><p className="mt-1 text-muted-foreground">Distribuye existencias entre tienda, almacén, vehículo u otras ubicaciones y registra transferencias.</p></div></div></section>
    <div className="grid gap-4 md:grid-cols-3">{locations.map((l:any)=><div key={l.id} className="rounded-2xl border border-border bg-card p-5"><MapPin className="h-5 w-5 text-primary"/><p className="mt-2 text-lg font-bold">{l.name}</p><p className="text-xs text-muted-foreground">{l.id}</p></div>)}<div className="rounded-2xl border border-dashed border-border bg-card p-5"><input value={locationName} onChange={(e)=>setLocationName(e.target.value)} placeholder="Nueva ubicación" className="w-full rounded-xl border border-border p-2"/><button onClick={()=>void addLocation()} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4"/>Crear</button></div></div>

    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-xl font-bold">Asignar stock a ubicación</h2><div className="mt-4 space-y-3"><select value={selectedProduct} onChange={(e)=>{setSelectedProduct(e.target.value);setStock(Number(locationStock?.[e.target.value]?.[selectedLocation]||0));}} className="w-full rounded-xl border border-border p-3"><option value="">Producto</option>{products.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select><select value={selectedLocation} onChange={(e)=>{setSelectedLocation(e.target.value);setStock(Number(locationStock?.[selectedProduct]?.[e.target.value]||0));}} className="w-full rounded-xl border border-border p-3"><option value="">Ubicación</option>{locations.map((l:any)=><option key={l.id} value={l.id}>{l.name}</option>)}</select><input type="number" min="0" value={stock} onChange={(e)=>setStock(Math.max(0,Number(e.target.value||0)))} className="w-full rounded-xl border border-border p-3"/><button onClick={()=>void saveStock()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"><Save className="h-4 w-4"/>Guardar stock</button></div></section>

      <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-xl font-bold">Transferir existencias</h2><div className="mt-4 space-y-3"><select value={transfer.productId} onChange={(e)=>setTransfer({...transfer,productId:e.target.value})} className="w-full rounded-xl border border-border p-3"><option value="">Producto</option>{products.map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select><div className="grid grid-cols-2 gap-3"><select value={transfer.from} onChange={(e)=>setTransfer({...transfer,from:e.target.value})} className="rounded-xl border border-border p-3"><option value="">Origen</option>{locations.map((l:any)=><option key={l.id} value={l.id}>{l.name}</option>)}</select><select value={transfer.to} onChange={(e)=>setTransfer({...transfer,to:e.target.value})} className="rounded-xl border border-border p-3"><option value="">Destino</option>{locations.map((l:any)=><option key={l.id} value={l.id}>{l.name}</option>)}</select></div><input type="number" min="1" value={transfer.quantity} onChange={(e)=>setTransfer({...transfer,quantity:Math.max(1,Number(e.target.value||1))})} className="w-full rounded-xl border border-border p-3"/><button onClick={()=>void doTransfer()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"><ArrowRightLeft className="h-4 w-4"/>Transferir</button></div></section>
    </div>

    <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-xl font-bold">Mapa de stock</h2><div className="mt-4 overflow-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b border-border text-left"><th className="p-3">Producto</th>{locations.map((l:any)=><th key={l.id} className="p-3">{l.name}</th>)}<th className="p-3">Catálogo</th></tr></thead><tbody>{products.map((p:any)=><tr key={p.id} className="border-b border-border/50"><td className="p-3 font-semibold">{p.name}</td>{locations.map((l:any)=><td key={l.id} className="p-3">{Number(locationStock?.[String(p.id)]?.[l.id]||0)}</td>)}<td className="p-3 font-bold">{Number(p.stock||0)}</td></tr>)}</tbody></table></div></section>

    <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-xl font-bold">Transferencias recientes</h2><div className="mt-4 space-y-2">{transfers.length===0?<p className="text-sm text-muted-foreground">Sin transferencias.</p>:transfers.slice(0,50).map((t:any)=><div key={t.id} className="rounded-xl border border-border p-3 text-sm"><strong>{products.find((p:any)=>String(p.id)===String(t.productId))?.name||t.productId}</strong> · {t.quantity} uds. · {locations.find((l:any)=>l.id===t.from)?.name||t.from} → {locations.find((l:any)=>l.id===t.to)?.name||t.to} · {new Date(t.createdAt).toLocaleString("es-ES")}</div>)}</div></section>
  </div>;
}
