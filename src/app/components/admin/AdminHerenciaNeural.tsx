import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain, Bot, ShieldCheck, Power, Search, Globe2, Palette, History, Target, Activity, Database, Send, Sparkles, Package, ShoppingBag, Users, Euro, AlertTriangle, CheckCircle2, FlaskConical, RefreshCw, Network, ListTodo } from "lucide-react";
import { backendApi } from "../../lib/backendStorage";
import { toast } from "sonner";

type Mode="AUTO"|"ASK"|"BLOCK";
type Message={role:"user"|"neural";text:string};
const labels:Record<string,string>={internet_research:"Investigar en Internet",learn_from_orders:"Aprender de pedidos",analyze_sales:"Analizar ventas",answer_basic_questions:"Responder preguntas básicas",modify_stock:"Modificar stock",change_prices:"Cambiar precios",refunds:"Hacer devoluciones",payments:"Realizar pagos",publish_web_changes:"Publicar cambios web",create_products:"Crear productos",send_whatsapp:"Enviar WhatsApp",send_email:"Enviar emails"};

export function AdminHerenciaNeural(){
 const [tab,setTab]=useState("command");
 const [status,setStatus]=useState<any>(null);
 const [agents,setAgents]=useState<any[]>([]);
 const [tasks,setTasks]=useState<any[]>([]);
 const [goals,setGoals]=useState<any[]>([]);
 const [activity,setActivity]=useState<any[]>([]);
 const [signals,setSignals]=useState<any[]>([]);
 const [memory,setMemory]=useState<any[]>([]);
 const [graph,setGraph]=useState<any>({nodes:[],edges:[]});
 const [message,setMessage]=useState("");
 const [goal,setGoal]=useState("");
 const [memoryQuery,setMemoryQuery]=useState("");
 const [messages,setMessages]=useState<Message[]>([{role:"neural",text:"HERENCIA Neural Command Center. Esta conversación envía órdenes al Neural Core independiente."}]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState<string|null>(null);

 const refresh=useCallback(async()=>{
  setLoading(true);
  const results=await Promise.allSettled([backendApi.neuralStatus(),backendApi.neuralAgents(),backendApi.neuralTasks(),backendApi.neuralGoals(),backendApi.neuralActivity(),backendApi.neuralSignals(),backendApi.neuralGraph()]);
  const [s,a,t,g,act,sig,gr]=results;
  if(s.status==="fulfilled"){setStatus(s.value);setError(null)}else setError(s.reason?.message||"Neural no disponible");
  if(a.status==="fulfilled")setAgents(a.value.agents||[]);
  if(t.status==="fulfilled")setTasks(t.value.tasks||[]);
  if(g.status==="fulfilled")setGoals(g.value.goals||[]);
  if(act.status==="fulfilled")setActivity(act.value.events||[]);
  if(sig.status==="fulfilled")setSignals(sig.value.signals||[]);
  if(gr.status==="fulfilled")setGraph(gr.value||{nodes:[],edges:[]});
  setLoading(false);
 },[]);

 useEffect(()=>{void refresh();const timer=window.setInterval(()=>void refresh(),10000);return()=>window.clearInterval(timer)},[refresh]);

 const permissions:Record<string,Mode>=status?.policy?.permissions||{};
 const autonomy=status?.policy?.autonomy==="ACTIVE";
 const approvals=tasks.filter(t=>t.status==="WAITING_APPROVAL"||t.requiresApproval);
 const stats=useMemo(()=>({agents:agents.length,tasks:tasks.filter(t=>["PENDING","RUNNING","WAITING_APPROVAL"].includes(t.status)).length,approvals:approvals.length}),[agents,tasks,approvals.length]);

 const toggleAutonomy=async()=>{try{const next=autonomy?await backendApi.neuralEmergencyStop():await backendApi.neuralResume();toast.success(next.autonomy==="ACTIVE"?"Autonomía reactivada":"Autonomía detenida");await refresh()}catch(e:any){toast.error(e.message||"No se pudo cambiar la autonomía")}};
 const cycle=async(key:string)=>{const order:Mode[]=["AUTO","ASK","BLOCK"],current=(permissions[key]||"BLOCK") as Mode,next=order[(order.indexOf(current)+1)%3];try{await backendApi.neuralSetPermission(key,next);toast.success(`${labels[key]||key}: ${next}`);await refresh()}catch(e:any){toast.error(e.message)}};
 const send=async()=>{const q=message.trim();if(!q)return;setMessages(m=>[...m,{role:"user",text:q}]);setMessage("");try{const r=await backendApi.neuralCommand(q);setMessages(m=>[...m,{role:"neural",text:r.message||`Orden registrada: ${r.kind||"task"}`}]);await refresh()}catch(e:any){setMessages(m=>[...m,{role:"neural",text:`Error: ${e.message}`}])}};
 const addGoal=async()=>{const text=goal.trim();if(!text)return;try{await backendApi.neuralCreateGoal(text);setGoal("");toast.success("Objetivo creado en Neural Core");await refresh()}catch(e:any){toast.error(e.message)}};
 const observe=async()=>{try{const r=await backendApi.neuralObserveNow();toast.success(r.ok?"Digital Twin actualizado":`Observación: ${r.skipped||"sin cambios"}`);await refresh()}catch(e:any){toast.error(e.message)}};
 const searchMemory=async()=>{try{const r=await backendApi.neuralMemory(memoryQuery);setMemory(r.items||[])}catch(e:any){toast.error(e.message)}};
 const approve=async(id:string)=>{try{await backendApi.neuralApproveTask(id);toast.success("Tarea aprobada");await refresh()}catch(e:any){toast.error(e.message)}};

 const tabs=[["command","Command Center",Brain],["tasks","Tareas",ListTodo],["agents","Células",Bot],["memory","Memoria",Database],["research","Investigación",Globe2],["designer","Neural Designer",Palette],["goals","Objetivos",Target],["permissions","Permisos",ShieldCheck],["activity","Auditoría",Activity],["lab","Neural Lab",FlaskConical],["graph","Knowledge Graph",Network],["history","Time Machine",History]] as const;

 return <div className="space-y-6">
  <div className="rounded-3xl border bg-gradient-to-r from-emerald-950 to-emerald-800 text-white p-6 shadow-xl">
   <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
    <div className="flex gap-4 items-center"><div className="p-3 bg-white/10 rounded-2xl"><Brain className="w-9 h-9"/></div><div><h1 className="text-3xl font-black">HERENCIA Neural</h1><p className="text-emerald-100">Neural OS independiente · memoria persistente · autonomía gobernada</p></div></div>
    <div className="flex flex-wrap gap-3 items-center">
     <Badge text={error?"Neural desconectada":autonomy?"Neural activa":"Autonomía detenida"} ok={!error&&autonomy}/>
     <span className="px-4 py-2 rounded-xl bg-white/10">{stats.agents} células</span><span className="px-4 py-2 rounded-xl bg-white/10">{stats.tasks} tareas</span><span className="px-4 py-2 rounded-xl bg-white/10">{stats.approvals} aprobaciones</span>
     <button onClick={()=>void refresh()} className="p-3 rounded-xl bg-white/10 hover:bg-white/20" title="Actualizar"><RefreshCw className={`w-5 h-5 ${loading?"animate-spin":""}`}/></button>
     <button onClick={()=>void toggleAutonomy()} disabled={Boolean(error)} className={`px-5 py-3 rounded-xl font-bold flex gap-2 items-center disabled:opacity-50 ${autonomy?"bg-red-500 hover:bg-red-600":"bg-emerald-500 hover:bg-emerald-600"}`}><Power className="w-5 h-5"/>{autonomy?"DETENER AUTONOMÍA":"REACTIVAR"}</button>
    </div>
   </div>
   {error&&<div className="mt-4 rounded-xl bg-red-500/20 px-4 py-3 text-sm"><b>Conexión:</b> {error}. Configura NEURAL_SERVICE_URL y NEURAL_ADMIN_TOKEN en el backend de Herencia.</div>}
  </div>

  <div className="flex gap-2 overflow-x-auto pb-1">{tabs.map(([id,label,Icon])=><button key={id} onClick={()=>setTab(id)} className={`whitespace-nowrap px-4 py-2.5 rounded-xl border flex items-center gap-2 font-semibold ${tab===id?"bg-primary text-primary-foreground border-primary":"bg-card hover:bg-muted"}`}><Icon className="w-4 h-4"/>{label}</button>)}</div>

  {tab==="command"&&<div className="grid xl:grid-cols-3 gap-5">
   <Panel title="Hablar con HERENCIA Neural" icon={Sparkles} className="xl:col-span-2">
    <div className="h-72 overflow-y-auto space-y-3 pr-2">{messages.map((m,i)=><div key={i} className={`max-w-[88%] rounded-2xl p-4 ${m.role==="user"?"ml-auto bg-primary text-primary-foreground":"bg-muted"}`}>{m.text}</div>)}</div>
    <div className="flex gap-2 mt-4"><input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void send()} className="flex-1 border bg-background rounded-xl px-4" placeholder="Ej. revisa el stock y dime qué necesita atención"/><button onClick={()=>void send()} className="p-3 rounded-xl bg-primary text-primary-foreground"><Send/></button></div>
   </Panel>
   <Panel title="Estado vivo" icon={Activity}>
    <Metric icon={ShoppingBag} label="Pedidos observados" value={String(status?.twinRevision!=null?(status?.self?"Digital Twin r"+status.twinRevision:status.twinRevision):"—")}/>
    <Metric icon={Database} label="Memoria" value={status?.memory?.total!=null?`${status.memory.total} recuerdos`:"—"}/>
    <Metric icon={Bot} label="Células" value={String(agents.length)}/>
    <Metric icon={Package} label="Señales" value={String(signals.length)}/>
    <button onClick={()=>void observe()} className="w-full mt-4 py-3 rounded-xl border font-bold hover:bg-muted">Observar Herencia ahora</button>
   </Panel>
   <Panel title="Señales detectadas" icon={AlertTriangle} className="xl:col-span-2">
    {signals.length? <div className="grid md:grid-cols-2 gap-3">{signals.map((s:any,i)=><div key={s.entity||i} className="border rounded-2xl p-4"><div className="font-bold">{s.message||s.type}</div><div className="text-xs text-muted-foreground mt-1">{s.severity||"signal"} · {s.type}</div></div>)}</div>:<Empty text="No hay señales detectadas en el Digital Twin actual."/>}
   </Panel>
   <Panel title="Aprobaciones pendientes" icon={ShieldCheck}>
    {approvals.length?<div className="space-y-2">{approvals.slice(0,5).map((t:any)=><div key={t.id} className="border rounded-xl p-3"><b className="text-sm">{t.title}</b><button onClick={()=>void approve(t.id)} className="mt-2 w-full py-2 rounded-lg bg-amber-100 text-amber-900 font-bold">Aprobar</button></div>)}</div>:<Empty text="No hay tareas esperando autorización."/>}
   </Panel>
  </div>}

  {tab==="tasks"&&<Panel title="Cola de tareas Neural" icon={ListTodo}>{tasks.length?<div className="space-y-3">{tasks.map((t:any)=><div key={t.id} className="border rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between"><div><b>{t.title}</b><p className="text-xs text-muted-foreground mt-1">{t.intent} · {t.assignedCell||"sin asignar"} · {t.status}</p></div>{(t.status==="WAITING_APPROVAL"||t.requiresApproval)&&<button onClick={()=>void approve(t.id)} className="px-4 py-2 rounded-xl bg-amber-100 text-amber-900 font-bold">Aprobar</button>}</div>)}</div>:<Empty text="La cola está vacía."/>}</Panel>}

  {tab==="agents"&&<Panel title="Red de células" icon={Bot}><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{agents.map((a:any)=><div key={a.id} className="p-4 border rounded-2xl"><div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center mb-2"><Bot className="w-5 h-5 text-emerald-800"/></div><b className="capitalize">{a.specialty}</b><p className="text-xs text-muted-foreground mt-1">{a.status} · generación {a.generation}</p><p className="text-xs mt-2">Permisos: {a.permissions}</p></div>)}</div></Panel>}

  {tab==="memory"&&<Panel title="Memoria jerárquica" icon={Database}><div className="flex gap-2 mb-4"><input value={memoryQuery} onChange={e=>setMemoryQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void searchMemory()} className="flex-1 border rounded-xl px-4" placeholder="Buscar recuerdos, conocimiento, correcciones…"/><button onClick={()=>void searchMemory()} className="px-4 rounded-xl bg-primary text-primary-foreground"><Search/></button></div><div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-5">{Object.entries(status?.memory||{}).filter(([k])=>k!=="total").map(([k,v])=><div key={k} className="border rounded-xl p-3"><div className="text-xs text-muted-foreground capitalize">{k}</div><b>{String(v)}</b></div>)}</div>{memory.length?<div className="space-y-2">{memory.map((m:any)=><div key={m.id} className="border rounded-xl p-3"><div className="flex justify-between gap-2"><b className="text-sm">{m.tier} · {m.kind}</b><span className="text-xs">{m.verified?"verificado":"provisional"}</span></div><pre className="text-xs whitespace-pre-wrap mt-2 text-muted-foreground">{JSON.stringify(m.content,null,2)}</pre></div>)}</div>:<Empty text="Busca en la memoria para inspeccionar contenido y procedencia."/>}</Panel>}

  {tab==="goals"&&<Panel title="Objetivos persistentes" icon={Target}><div className="flex gap-2 mb-5"><input value={goal} onChange={e=>setGoal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void addGoal()} className="flex-1 border rounded-xl px-4 bg-background" placeholder="Ej. reducir roturas de stock"/><button onClick={()=>void addGoal()} className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold">Añadir</button></div><div className="space-y-3">{goals.map((g:any)=><div key={g.id} className="border rounded-2xl p-4"><div className="flex justify-between"><b>{g.text}</b><span>{g.progress||0}%</span></div><div className="h-2 bg-muted rounded-full mt-3 overflow-hidden"><div className="h-full bg-primary" style={{width:`${Math.max(0,Math.min(100,g.progress||0))}%`}}/></div><p className="text-xs text-muted-foreground mt-2">{g.status} · prioridad {g.priority||50}</p></div>)}</div></Panel>}

  {tab==="permissions"&&<Panel title="Permission Kernel externo" icon={ShieldCheck}><p className="text-muted-foreground mb-4">Esta capa vive fuera de los modelos y células. Pulsa un permiso para alternar AUTO → ASK → BLOCK.</p><div className="grid md:grid-cols-2 gap-3">{Object.entries(permissions).map(([k,v])=><button key={k} onClick={()=>void cycle(k)} className="flex justify-between items-center border rounded-xl p-4 hover:bg-muted"><span className="font-medium">{labels[k]||k}</span><ModeBadge mode={v}/></button>)}</div></Panel>}

  {tab==="activity"&&<Panel title="Auditoría append-only" icon={Activity}><div className="mb-4 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600"/>Integridad: {status?.audit?.ok===false?"fallo detectado":status?.audit?.ok?"verificada":"sin datos"}</div>{activity.length?<div className="space-y-2">{activity.slice(0,100).map((e:any)=><div key={e.id} className="border rounded-xl p-3"><div className="flex flex-wrap justify-between gap-2"><b className="text-sm">{e.intent||"evento"}</b><span className="text-xs text-muted-foreground">{e.at}</span></div><p className="text-xs mt-1">{e.actor||"system"} · {String(e.result||"")}</p></div>)}</div>:<Empty text="Todavía no hay actividad auditada."/>}</Panel>}

  {tab==="lab"&&<LabPanel/>}
  {tab==="graph"&&<Panel title="Knowledge Graph" icon={Network}><div className="grid grid-cols-2 gap-3 mb-5"><Metric icon={Database} label="Nodos" value={String(graph.nodes?.length||0)}/><Metric icon={Network} label="Relaciones" value={String(graph.edges?.length||0)}/></div><div className="grid md:grid-cols-3 gap-2">{(graph.nodes||[]).slice(0,60).map((n:any)=><div key={n.id} className="border rounded-xl p-3"><b className="text-sm">{n.type}</b><p className="text-xs truncate mt-1">{n.name||n.key}</p></div>)}</div></Panel>}
  {tab==="research"&&<InfoPanel title="Investigación" icon={Globe2} text="La investigación usa una herramienta separada y exige procedencia, fecha, confianza y verificación. Si no existe un proveedor configurado, Neural devuelve un error en lugar de inventar resultados."/>}
  {tab==="designer"&&<InfoPanel title="Neural Designer" icon={Palette} text="Los cambios web se representan como operaciones estructuradas y requieren preview. La publicación está gobernada por publish_web_changes y todavía no se muestra como operativa hasta completar el adapter de publicación/rollback."/>}
  {tab==="history"&&<InfoPanel title="Time Machine" icon={History} text="La capa de versionado/rollback se mantendrá separada de la memoria cognitiva. Ninguna restauración se hará sin un snapshot verificable."/>}
 </div>
}

function LabPanel(){const [items,setItems]=useState<any[]>([]);useEffect(()=>{backendApi.neuralLab().then(r=>setItems(r.experiments||[])).catch(()=>{})},[]);return <Panel title="Neural Lab" icon={FlaskConical}><p className="text-sm text-muted-foreground mb-4">Entorno aislado: variantes, mutación y fitness sin acceso automático a producción.</p>{items.length?<div className="space-y-2">{items.map(x=><div key={x.id} className="border rounded-xl p-3"><b>{x.hypothesis||"Experimento"}</b><p className="text-xs mt-1">{x.status} · fitness {x.fitness??"sin evaluar"}</p></div>)}</div>:<Empty text="Aún no hay experimentos creados."/>}</Panel>}
function Panel({title,icon:Icon,children,className=""}:any){return <section className={`bg-card border rounded-3xl p-5 shadow-sm ${className}`}><h2 className="font-black text-lg flex items-center gap-2 mb-4"><Icon className="w-5 h-5 text-primary"/>{title}</h2>{children}</section>}
function InfoPanel({title,icon,text}:any){return <Panel title={title} icon={icon}><div className="min-h-56 flex items-center justify-center"><div className="max-w-2xl text-center"><p className="text-lg text-muted-foreground">{text}</p></div></div></Panel>}
function Empty({text}:{text:string}){return <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>}
function Badge({text,ok}:any){return <span className={`px-4 py-2 rounded-xl font-bold ${ok?"bg-emerald-400/20 text-emerald-50":"bg-red-400/20 text-red-50"}`}>{text}</span>}
function ModeBadge({mode}:{mode:Mode}){return <span className={`px-3 py-1 rounded-full text-xs font-black ${mode==="AUTO"?"bg-emerald-100 text-emerald-800":mode==="ASK"?"bg-amber-100 text-amber-800":"bg-red-100 text-red-800"}`}>{mode==="AUTO"?"AUTÓNOMO":mode==="ASK"?"CONSULTAR":"BLOQUEADO"}</span>}
function Metric({icon:Icon,label,value}:any){return <div className="flex gap-3 items-center py-3 border-b last:border-0"><div className="p-2 bg-primary/10 rounded-xl"><Icon className="w-5 h-5 text-primary"/></div><div><p className="text-xs text-muted-foreground">{label}</p><b>{value}</b></div></div>}
