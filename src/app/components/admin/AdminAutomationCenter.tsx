import { useEffect, useState } from "react";
import { AlertTriangle, BellRing, CheckCircle2, PackageX, Save, Timer, Workflow } from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

export function AdminAutomationCenter(){
  const [rules,setRules]=useState<any>({lowStock:{enabled:true,threshold:3},outOfStock:{enabled:true},delayedOrder:{enabled:true,minutes:90}});
  const [notifications,setNotifications]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [notificationPermission,setNotificationPermission]=useState<string>(()=>typeof Notification!=="undefined"?Notification.permission:"unsupported");

  const load=async()=>{try{const r=await backendApi.adminAutomations();setRules(r.rules);setNotifications(r.notifications||[]);}catch(e:any){toast.error(e?.message||"No se pudieron cargar automatizaciones");}finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);

  const enableBrowserNotifications=async()=>{
    if(typeof Notification==="undefined") return toast.error("Este navegador no admite notificaciones");
    const permission=await Notification.requestPermission();
    setNotificationPermission(permission);
    if(permission!=="granted") return toast.error("Permiso de notificaciones no concedido");
    try{
      const registration=await navigator.serviceWorker?.ready;
      registration?.active?.postMessage({type:"SHOW_NOTIFICATION",title:"Herencia",body:"Notificaciones del administrador activadas.",tag:"herencia-test",url:"/admin"});
      toast.success("Notificaciones del navegador activadas");
    }catch{toast.success("Permiso de notificaciones activado");}
  };

  const save=async()=>{try{const r=await backendApi.saveAutomationRules(rules);setRules(r.rules);toast.success("Reglas guardadas");await load();}catch(e:any){toast.error(e?.message||"No se pudieron guardar");}};
  const resolve=async(id:string)=>{try{await backendApi.updateAutomationNotification(id,{read:true,resolved:true});setNotifications(rows=>rows.map(n=>n.id===id?{...n,read:true,resolved:true}:n));}catch(e:any){toast.error(e?.message||"No se pudo resolver");}};

  if(loading)return <div className="py-16 text-center text-muted-foreground">Cargando automatizaciones…</div>;
  const active=notifications.filter(n=>!n.resolved);
  return <div className="space-y-6">
    <section className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2 text-primary"><Workflow className="h-5 w-5"/><span className="text-sm font-bold uppercase tracking-wider">Motor automático</span></div><h1 className="mt-2 text-3xl font-black">Automatizaciones Herencia</h1><p className="mt-2 text-muted-foreground">Vigila stock y pedidos y genera avisos operativos sin depender de revisar cada pantalla.</p></div><div className="flex flex-wrap gap-2"><button onClick={()=>void enableBrowserNotifications()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 font-semibold"><BellRing className="h-4 w-4"/>{notificationPermission==="granted"?"Notificaciones activas":"Activar notificaciones"}</button><button onClick={()=>void save()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground"><Save className="h-4 w-4"/>Guardar reglas</button></div></div></section>
    <div className="grid gap-4 md:grid-cols-3">
      <Rule icon={AlertTriangle} title="Stock bajo" enabled={rules.lowStock?.enabled} onToggle={()=>setRules({...rules,lowStock:{...rules.lowStock,enabled:!rules.lowStock?.enabled}})}><input type="number" min="0" value={rules.lowStock?.threshold??3} onChange={(e)=>setRules({...rules,lowStock:{...rules.lowStock,threshold:Number(e.target.value||0)}})} className="mt-3 w-full rounded-xl border border-border bg-background p-2"/><p className="mt-1 text-xs text-muted-foreground">Avisar cuando llegue a este número.</p></Rule>
      <Rule icon={PackageX} title="Producto agotado" enabled={rules.outOfStock?.enabled} onToggle={()=>setRules({...rules,outOfStock:{enabled:!rules.outOfStock?.enabled}})}><p className="mt-3 text-sm text-muted-foreground">Crea una alerta inmediata cuando el stock llega a cero.</p></Rule>
      <Rule icon={Timer} title="Pedido sin avanzar" enabled={rules.delayedOrder?.enabled} onToggle={()=>setRules({...rules,delayedOrder:{...rules.delayedOrder,enabled:!rules.delayedOrder?.enabled}})}><input type="number" min="15" step="15" value={rules.delayedOrder?.minutes??90} onChange={(e)=>setRules({...rules,delayedOrder:{...rules.delayedOrder,minutes:Number(e.target.value||90)}})} className="mt-3 w-full rounded-xl border border-border bg-background p-2"/><p className="mt-1 text-xs text-muted-foreground">Minutos antes de avisar.</p></Rule>
    </div>
    <section className="rounded-2xl border border-border bg-card p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Centro de alertas</h2><p className="text-sm text-muted-foreground">{active.length} pendientes.</p></div><button onClick={()=>void load()} className="rounded-xl border border-border px-3 py-2 text-sm">Revisar ahora</button></div><div className="mt-5 space-y-2">{active.length===0?<div className="rounded-xl bg-primary/5 p-5 text-sm text-muted-foreground">No hay alertas pendientes.</div>:active.map(n=><div key={n.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center"><div className="flex-1"><p className="font-semibold">{n.title}</p><p className="text-sm text-muted-foreground">{n.message}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString("es-ES")}</p></div><button onClick={()=>void resolve(n.id)} className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-semibold text-primary"><CheckCircle2 className="h-4 w-4"/>Resolver</button></div>)}</div></section>
  </div>;
}
function Rule({icon:Icon,title,enabled,onToggle,children}:{icon:any;title:string;enabled:boolean;onToggle:()=>void;children:any}){return <div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Icon className="h-5 w-5 text-primary"/><h3 className="font-bold">{title}</h3></div><button onClick={onToggle} className={`relative h-6 w-11 rounded-full ${enabled?"bg-primary":"bg-muted-foreground/30"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${enabled?"translate-x-6":"translate-x-1"}`}/></button></div>{children}</div>}
