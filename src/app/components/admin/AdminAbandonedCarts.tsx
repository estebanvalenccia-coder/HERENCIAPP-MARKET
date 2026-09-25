import { useEffect, useMemo, useState } from "react";
import { Mail, RefreshCw, ShoppingCart, Timer } from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

export function AdminAbandonedCarts(){
  const [rows,setRows]=useState<any[]>([]);
  const [minutes,setMinutes]=useState(30);
  const [loading,setLoading]=useState(true);

  const load=async()=>{try{setLoading(true);const r=await backendApi.listAbandonedCarts(minutes);setRows(r.carts||[]);}catch(e:any){toast.error(e?.message||"No se pudieron cargar los carritos");}finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);

  const totals=useMemo(()=>({carts:rows.length,value:rows.reduce((s,r)=>s+Number(r.total||0),0),items:rows.reduce((s,r)=>s+Number(r.itemCount||0),0)}),[rows]);

  return <div className="space-y-6">
    <section className="rounded-3xl border border-border bg-card p-6"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-bold uppercase tracking-wider text-primary">Recuperación de ventas</p><h1 className="mt-2 text-3xl font-black">Carritos abandonados</h1><p className="mt-2 text-muted-foreground">Detectados desde los carritos reales que Herencia ya guarda por visitante.</p></div><div className="flex gap-2"><input type="number" min="5" value={minutes} onChange={(e)=>setMinutes(Math.max(5,Number(e.target.value||30)))} className="w-24 rounded-xl border border-border bg-background p-3"/><button onClick={()=>void load()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"><RefreshCw className="h-4 w-4"/>Revisar</button></div></div></section>
    <div className="grid gap-4 md:grid-cols-3"><Metric label="Carritos" value={String(totals.carts)}/><Metric label="Productos" value={String(totals.items)}/><Metric label="Valor potencial" value={new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(totals.value)}/></div>
    <section className="rounded-2xl border border-border bg-card p-6"><div className="space-y-3">{loading?<p className="text-sm text-muted-foreground">Analizando carritos…</p>:rows.length===0?<p className="text-sm text-muted-foreground">No hay carritos no vacíos con más de {minutes} minutos.</p>:rows.map((row)=><div key={row.visitorId} className="rounded-xl border border-border p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><ShoppingCart className="h-4 w-4 text-primary"/><p className="font-semibold">{row.customer?.name||"Visitante sin cuenta"}</p>{row.customer?.email&&<span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">email disponible</span>}</div><p className="mt-1 text-sm text-muted-foreground">{row.itemCount} productos · {new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(row.total)}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Timer className="h-3.5 w-3.5"/>Sin cambios desde hace {row.ageMinutes} min</p><p className="mt-2 text-xs text-muted-foreground line-clamp-2">{(row.items||[]).map((i:any)=>`${i.name} x${i.quantity||1}`).join(", ")}</p></div>{row.customer?.email&&<a href={`mailto:${row.customer.email}?subject=${encodeURIComponent("¿Te ayudamos con tu compra en Herencia?")}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold"><Mail className="h-4 w-4"/>Contactar</a>}</div></div>)}</div></section>
  </div>;
}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-border bg-card p-5"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>}
