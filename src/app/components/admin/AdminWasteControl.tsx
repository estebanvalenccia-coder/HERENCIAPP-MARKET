import { useEffect, useMemo, useState } from "react";
import { PackageMinus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../../lib/backendStorage";

export function AdminWasteControl(){
  const [products,setProducts]=useState<any[]>([]);
  const [adjustments,setAdjustments]=useState<any[]>([]);
  const [productId,setProductId]=useState("");
  const [qty,setQty]=useState(1);
  const [reason,setReason]=useState("Producto dañado");

  const load=async()=>{try{setProducts(JSON.parse(backendStorage.getItem("adminProducts")||"[]"));const r=await backendApi.getPosOperations();setAdjustments((r.operations?.inventoryAdjustments||[]).filter((a:any)=>["waste","breakage"].includes(a.type)));}catch(e:any){toast.error(e?.message||"No se pudieron cargar las mermas");}};
  useEffect(()=>{void load();},[]);

  const selected=products.find(p=>String(p.id)===String(productId));
  const loss=useMemo(()=>Number(selected?.price||0)*Math.max(0,qty),[selected,qty]);

  const register=async()=>{if(!productId||qty<=0)return toast.error("Selecciona producto y cantidad");try{await backendApi.adjustPosInventory({productId:String(productId),type:"waste",reason,delta:-Math.abs(Math.floor(qty))});toast.success("Merma registrada y stock actualizado");setQty(1);await backendStorage.refresh();await load();}catch(e:any){toast.error(e?.message||"No se pudo registrar la merma");}};

  return <div className="space-y-6"><div className="grid gap-4 md:grid-cols-3"><Card icon={Trash2} label="Mermas" value={String(adjustments.length)}/><Card icon={PackageMinus} label="Unidades afectadas" value={String(adjustments.reduce((s:number,a:any)=>s+Math.abs(Number(a.delta||0)),0))}/><Card icon={Trash2} label="Pérdida estimada actual" value={new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(loss)}/></div>
  <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-2xl font-black">Registrar merma</h2><p className="mt-1 text-sm text-muted-foreground">Descuenta el stock real mediante el backend del TPV.</p><div className="mt-4 grid gap-3 md:grid-cols-4"><select value={productId} onChange={(e)=>setProductId(e.target.value)} className="rounded-xl border border-border bg-background p-3"><option value="">Selecciona producto</option>{products.filter(p=>p.active!==false).map(p=><option key={p.id} value={p.id}>{p.name} · stock {p.stock||0}</option>)}</select><input type="number" min="1" value={qty} onChange={(e)=>setQty(Math.max(1,Number(e.target.value||1)))} className="rounded-xl border border-border bg-background p-3"/><input value={reason} onChange={(e)=>setReason(e.target.value)} placeholder="Motivo" className="rounded-xl border border-border bg-background p-3"/><button onClick={()=>void register()} className="rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground">Registrar y descontar</button></div></section>
  <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-xl font-bold mb-4">Historial</h2><div className="space-y-2">{adjustments.length===0?<p className="text-sm text-muted-foreground">Sin mermas registradas.</p>:adjustments.slice(0,50).map((a:any)=><div key={a.id} className="flex items-center justify-between rounded-xl border border-border p-3"><div><p className="font-semibold">{a.productName||a.productId}</p><p className="text-xs text-muted-foreground">{a.reason||a.type} · {a.createdAt?new Date(a.createdAt).toLocaleString("es-ES"):""}</p></div><span className="font-bold text-destructive">{a.delta||0}</span></div>)}</div></section></div>;
}
function Card({icon:Icon,label,value}:{icon:any;label:string;value:string}){return <div className="rounded-2xl border border-border bg-card p-5"><Icon className="h-6 w-6 text-primary"/><p className="mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>}
