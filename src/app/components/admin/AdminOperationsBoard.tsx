import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Clock3, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

type Task={id:string;title:string;assignedTo?:string;dueAt?:string;priority:"baja"|"media"|"alta";done:boolean;createdAt:string};
type ChecklistItem={id:string;label:string;done:boolean};

const defaultOpening:ChecklistItem[]=[
 {id:"open-cash",label:"Comprobar apertura de caja",done:false},
 {id:"open-stock",label:"Revisar alertas de stock y reposición",done:false},
 {id:"open-orders",label:"Revisar pedidos y entregas del día",done:false},
 {id:"open-plants",label:"Revisar riego/estado de plantas",done:false},
];
const defaultClosing:ChecklistItem[]=[
 {id:"close-orders",label:"Confirmar pedidos completados o pendientes",done:false},
 {id:"close-cash",label:"Realizar cierre de caja",done:false},
 {id:"close-clean",label:"Limpieza y orden de zona de trabajo",done:false},
 {id:"close-security",label:"Revisar puertas, luces y equipos",done:false},
];

export function AdminOperationsBoard(){
 const [operations,setOperations]=useState<any>({});
 const [title,setTitle]=useState("");
 const [assignedTo,setAssignedTo]=useState("");
 const [priority,setPriority]=useState<"baja"|"media"|"alta">("media");
 const [dueAt,setDueAt]=useState("");

 const load=async()=>{try{const r=await backendApi.getPosOperations();setOperations(r.operations||{});}catch(e:any){toast.error(e?.message||"No se pudieron cargar las operaciones");}};
 useEffect(()=>{void load();},[]);

 const tasks:Task[]=Array.isArray(operations.internalTasks)?operations.internalTasks:[];
 const opening:ChecklistItem[]=Array.isArray(operations.openingChecklist)?operations.openingChecklist:defaultOpening;
 const closing:ChecklistItem[]=Array.isArray(operations.closingChecklist)?operations.closingChecklist:defaultClosing;
 const staff=Array.isArray(operations.staff)?operations.staff.filter((x:any)=>x.active!==false):[];
 const shifts=Array.isArray(operations.staffShifts)?operations.staffShifts:[];

 const savePatch=async(patch:any)=>{try{const r=await backendApi.savePosOperations(patch);setOperations(r.operations||{...operations,...patch});}catch(e:any){toast.error(e?.message||"No se pudo guardar");throw e;}};

 const addTask=async()=>{if(!title.trim())return toast.error("Escribe una tarea");const task:Task={id:crypto.randomUUID(),title:title.trim(),assignedTo:assignedTo||undefined,dueAt:dueAt||undefined,priority,done:false,createdAt:new Date().toISOString()};await savePatch({internalTasks:[task,...tasks]});setTitle("");setAssignedTo("");setDueAt("");toast.success("Tarea creada");};
 const toggleTask=async(id:string)=>savePatch({internalTasks:tasks.map(t=>t.id===id?{...t,done:!t.done}:t)});
 const removeTask=async(id:string)=>savePatch({internalTasks:tasks.filter(t=>t.id!==id)});
 const toggleChecklist=async(kind:"opening"|"closing",id:string)=>{const source=kind==="opening"?opening:closing;const next=source.map(item=>item.id===id?{...item,done:!item.done}:item);await savePatch(kind==="opening"?{openingChecklist:next}:{closingChecklist:next});};
 const resetChecklist=async(kind:"opening"|"closing")=>savePatch(kind==="opening"?{openingChecklist:opening.map(i=>({...i,done:false}))}:{closingChecklist:closing.map(i=>({...i,done:false}))});

 const activeShifts=useMemo(()=>shifts.filter((s:any)=>!s.endedAt&&s.status!=="ended"),[shifts]);
 return <div className="space-y-6">
  <section className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-6"><div className="flex items-center gap-3"><ClipboardCheck className="h-7 w-7 text-primary"/><div><h1 className="text-3xl font-black">Operaciones del equipo</h1><p className="mt-1 text-muted-foreground">Tareas, apertura/cierre y situación de los turnos desde un único panel.</p></div></div></section>

  <div className="grid gap-4 md:grid-cols-3"><Metric icon={ClipboardCheck} label="Tareas pendientes" value={String(tasks.filter(t=>!t.done).length)}/><Metric icon={CheckCircle2} label="Completadas" value={String(tasks.filter(t=>t.done).length)}/><Metric icon={Users} label="Turnos activos" value={String(activeShifts.length)}/></div>

  <section className="rounded-2xl border border-border bg-card p-6"><h2 className="text-xl font-bold">Nueva tarea</h2><div className="mt-4 grid gap-3 lg:grid-cols-[1.5fr_1fr_160px_210px_auto]"><input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Ej: preparar pedido, llamar cliente, regar…" className="rounded-xl border border-border bg-background p-3"/><select value={assignedTo} onChange={(e)=>setAssignedTo(e.target.value)} className="rounded-xl border border-border bg-background p-3"><option value="">Sin asignar</option>{staff.map((s:any)=><option key={s.id} value={s.name}>{s.name}</option>)}</select><select value={priority} onChange={(e)=>setPriority(e.target.value as any)} className="rounded-xl border border-border bg-background p-3"><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option></select><input type="datetime-local" value={dueAt} onChange={(e)=>setDueAt(e.target.value)} className="rounded-xl border border-border bg-background p-3"/><button onClick={()=>void addTask()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"><Plus className="h-4 w-4"/>Crear</button></div>
  <div className="mt-5 space-y-2">{tasks.length===0?<p className="text-sm text-muted-foreground">No hay tareas.</p>:tasks.map(t=><div key={t.id} className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${t.done?"border-primary/20 bg-primary/5":"border-border"}`}><button onClick={()=>void toggleTask(t.id)} className={`grid h-8 w-8 place-items-center rounded-full border ${t.done?"border-primary bg-primary text-primary-foreground":"border-border"}`}>{t.done&&<CheckCircle2 className="h-4 w-4"/>}</button><div className="flex-1"><p className={`font-semibold ${t.done?"line-through text-muted-foreground":""}`}>{t.title}</p><p className="text-xs text-muted-foreground">{t.assignedTo||"Sin asignar"} · prioridad {t.priority}{t.dueAt?` · ${new Date(t.dueAt).toLocaleString("es-ES")}`:""}</p></div><button onClick={()=>void removeTask(t.id)} className="p-2 text-destructive"><Trash2 className="h-4 w-4"/></button></div>)}</div></section>

  <div className="grid gap-6 xl:grid-cols-2"><Checklist title="Apertura" items={opening} onToggle={(id)=>toggleChecklist("opening",id)} onReset={()=>resetChecklist("opening")}/><Checklist title="Cierre" items={closing} onToggle={(id)=>toggleChecklist("closing",id)} onReset={()=>resetChecklist("closing")}/></div>

  <section className="rounded-2xl border border-border bg-card p-6"><div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-primary"/><h2 className="text-xl font-bold">Turnos activos</h2></div><div className="mt-4 space-y-2">{activeShifts.length===0?<p className="text-sm text-muted-foreground">No hay empleados con turno abierto.</p>:activeShifts.map((shift:any)=><div key={shift.id} className="rounded-xl border border-border p-4"><p className="font-semibold">{shift.staffName||shift.staffId}</p><p className="text-xs text-muted-foreground">Desde {shift.startedAt?new Date(shift.startedAt).toLocaleString("es-ES"):"—"}</p></div>)}</div></section>
 </div>;
}
function Checklist({title,items,onToggle,onReset}:{title:string;items:ChecklistItem[];onToggle:(id:string)=>void;onReset:()=>void}){return <section className="rounded-2xl border border-border bg-card p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Checklist de {title.toLowerCase()}</h2><button onClick={onReset} className="text-xs font-semibold text-muted-foreground">Reiniciar</button></div><div className="mt-4 space-y-2">{items.map(item=><button key={item.id} onClick={()=>onToggle(item.id)} className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left"><span className={`grid h-6 w-6 place-items-center rounded-full border ${item.done?"border-primary bg-primary text-white":"border-border"}`}>{item.done&&<CheckCircle2 className="h-3.5 w-3.5"/>}</span><span className={item.done?"line-through text-muted-foreground":"font-medium"}>{item.label}</span></button>)}</div></section>}
function Metric({icon:Icon,label,value}:{icon:any;label:string;value:string}){return <div className="rounded-2xl border border-border bg-card p-5"><Icon className="h-6 w-6 text-primary"/><p className="mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>}
