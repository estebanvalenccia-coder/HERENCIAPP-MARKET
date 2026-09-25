import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, History, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

export function AdminActivityLog(){
 const [events,setEvents]=useState<any[]>([]);
 const [loading,setLoading]=useState(true);
 const [filter,setFilter]=useState("all");

 const load=async()=>{try{setLoading(true);const r=await backendApi.adminAuditLog(300);setEvents(r.events||[]);}catch(e:any){toast.error(e?.message||"No se pudo cargar el registro");}finally{setLoading(false);}};
 useEffect(()=>{void load();},[]);
 const visible=useMemo(()=>filter==="all"?events:filter==="errors"?events.filter(e=>!e.ok):events.filter(e=>e.method===filter),[events,filter]);
 const clear=async()=>{if(!confirm("¿Vaciar el registro de actividad?"))return;try{await backendApi.clearAdminAuditLog();setEvents([]);toast.success("Registro vaciado");}catch(e:any){toast.error(e?.message||"No se pudo limpiar");}};

 return <div className="space-y-6">
  <section className="rounded-3xl border border-border bg-card p-6"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2 text-primary"><History className="h-5 w-5"/><span className="text-sm font-bold uppercase tracking-wider">Auditoría</span></div><h1 className="mt-2 text-3xl font-black">Registro de actividad</h1><p className="mt-2 text-muted-foreground">Acciones administrativas registradas sin almacenar contraseñas ni contenido sensible de formularios.</p></div><div className="flex gap-2"><button onClick={()=>void load()} className="rounded-xl border border-border p-3"><RefreshCw className="h-4 w-4"/></button><button onClick={()=>void clear()} className="inline-flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 font-semibold text-destructive"><Trash2 className="h-4 w-4"/>Vaciar</button></div></div></section>
  <div className="grid gap-4 md:grid-cols-3"><Card label="Eventos" value={String(events.length)}/><Card label="Correctos" value={String(events.filter(e=>e.ok).length)}/><Card label="Con error" value={String(events.filter(e=>!e.ok).length)}/></div>
  <section className="rounded-2xl border border-border bg-card p-6"><div className="mb-4 flex flex-wrap gap-2">{["all","POST","PUT","PATCH","DELETE","errors"].map(x=><button key={x} onClick={()=>setFilter(x)} className={`rounded-xl px-3 py-2 text-sm font-semibold ${filter===x?"bg-primary text-primary-foreground":"border border-border"}`}>{x==="all"?"Todo":x==="errors"?"Errores":x}</button>)}</div>{loading?<p className="text-sm text-muted-foreground">Cargando…</p>:visible.length===0?<p className="text-sm text-muted-foreground">No hay eventos para este filtro.</p>:<div className="space-y-2">{visible.map(e=><div key={e.id} className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-[110px_1fr_120px_160px] md:items-center"><div className="flex items-center gap-2">{e.ok?<CheckCircle2 className="h-4 w-4 text-emerald-600"/>:<AlertTriangle className="h-4 w-4 text-destructive"/>}<span className="font-bold">{e.method}</span></div><div className="min-w-0"><p className="truncate font-mono text-sm">{e.path}</p><p className="truncate text-xs text-muted-foreground">{e.userAgent||"Navegador desconocido"}{e.ip?` · ${e.ip}`:""}</p></div><span className={`text-sm font-bold ${e.ok?"text-emerald-600":"text-destructive"}`}>HTTP {e.status}</span><span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5"/>{new Date(e.at).toLocaleString("es-ES")} · {e.durationMs}ms</span></div>)}</div>}</section>
 </div>;
}
function Card({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-border bg-card p-5"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>}
