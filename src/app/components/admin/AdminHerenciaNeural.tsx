import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain, Bot, ShieldCheck, Power, Search, Globe2, Palette, History, Target, Activity, Database, Send, Sparkles, Package, ShoppingBag, AlertTriangle, CircleDollarSign, CheckCircle2, FlaskConical, RefreshCw, Network, ListTodo } from "lucide-react";
import { backendApi } from "../../lib/backendStorage";
import { toast } from "sonner";

type Mode="AUTO"|"ASK"|"BLOCK";
type Message={role:"user"|"neural";text:string};
const labels:Record<string,string>={internet_research:"Investigar en Internet",learn_from_orders:"Aprender de pedidos",analyze_sales:"Analizar ventas",answer_basic_questions:"Responder preguntas básicas",prepare_web_changes:"Preparar borradores web",modify_stock:"Modificar stock",change_prices:"Cambiar precios",publish_web_changes:"Publicar cambios web",rollback_web_changes:"Restaurar versiones web",create_products:"Crear productos",edit_products:"Editar productos",delete_products:"Eliminar productos",record_expenses:"Registrar gastos",send_whatsapp:"Enviar WhatsApp",send_email:"Enviar emails",contact_suppliers:"Contactar proveedores",manage_crm:"Gestionar CRM",create_promotions:"Crear promociones",issue_invoices:"Emitir facturas",purchases:"Realizar compras",refunds:"Hacer devoluciones",payments:"Realizar pagos"};

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
 const [brief,setBrief]=useState<any>(null);
 const [trace,setTrace]=useState<any>(null);
 const [selfModel,setSelfModel]=useState<any>(null);
 const [demand,setDemand]=useState<any>(null);
 const [patterns,setPatterns]=useState<any>(null);
 const [diagnostic,setDiagnostic]=useState<any>(null);

 const refresh=useCallback(async()=>{
  setLoading(true);
  const results=await Promise.allSettled([backendApi.neuralStatus(),backendApi.neuralAgents(),backendApi.neuralTasks(),backendApi.neuralGoals(),backendApi.neuralActivity(),backendApi.neuralSignals(),backendApi.neuralGraph(),backendApi.neuralBrief(),backendApi.neuralSelfModel(),backendApi.neuralDemand(),backendApi.neuralPatterns(),backendApi.neuralSelfTest()]);
  const [s,a,t,g,act,sig,gr,br,self,dmd,pat,diag]=results;
  if(s.status==="fulfilled"){setStatus(s.value);setError(null)}else setError(s.reason?.message||"Neural no disponible");
  if(a.status==="fulfilled")setAgents(a.value.agents||[]);
  if(t.status==="fulfilled")setTasks(t.value.tasks||[]);
  if(g.status==="fulfilled")setGoals(g.value.goals||[]);
  if(act.status==="fulfilled")setActivity(act.value.events||[]);
  if(sig.status==="fulfilled")setSignals(sig.value.signals||[]);
  if(gr.status==="fulfilled")setGraph(gr.value||{nodes:[],edges:[]});
  if(br.status==="fulfilled")setBrief(br.value);
  if(self.status==="fulfilled")setSelfModel(self.value);
  if(dmd.status==="fulfilled")setDemand(dmd.value);
  if(pat.status==="fulfilled")setPatterns(pat.value);
  if(diag.status==="fulfilled")setDiagnostic(diag.value); else if(diag.status==="rejected")setDiagnostic({ok:false,tests:[],error:diag.reason?.message});
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
 const explain=async(actionId:string)=>{try{setTrace(await backendApi.neuralTraceByAction(actionId))}catch(e:any){toast.error(e.message||"No se encontró la traza de decisión")}};

 const tabs=[["command","Command Center",Brain],["brain","Cerebro / Self Model",Brain],["learning","Aprendizaje",Sparkles],["tasks","Tareas",ListTodo],["agents","Células",Bot],["memory","Memoria",Database],["research","Investigación",Globe2],["designer","Neural Designer",Palette],["goals","Objetivos",Target],["permissions","Permisos",ShieldCheck],["activity","Auditoría",Activity],["lab","Neural Lab",FlaskConical],["graph","Knowledge Graph",Network],["history","Time Machine",History]] as const;

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
   <Panel title="Brief del negocio" icon={Brain} className="xl:col-span-2">
    {brief?<div className="grid gap-3 md:grid-cols-4">
      <Metric icon={ShoppingBag} label="Ventas verificadas" value={String(brief.business?.verifiedSales||0)}/>
      <Metric icon={CircleDollarSign} label="Ingresos verificados" value={new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(Number(brief.business?.verifiedRevenue||0))}/>
      <Metric icon={Package} label="Productos" value={String(brief.business?.products||0)}/>
      <Metric icon={AlertTriangle} label="Atención" value={String((brief.attention?.signals||[]).length)}/>
      <div className="md:col-span-4 rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground">
        Neural resume únicamente el estado que observa en Herencia. Las ventas e ingresos aquí mostrados proceden de pedidos con estado verificado.
      </div>
    </div>:<Empty text="El brief aparecerá cuando Neural pueda observar Herencia."/>}
   </Panel>
   <Panel title="Autodiagnóstico" icon={CheckCircle2}>
    {diagnostic?<div className="space-y-2"><div className={`rounded-xl p-3 text-sm font-black ${diagnostic.ok?"bg-emerald-50 text-emerald-800":"bg-amber-50 text-amber-900"}`}>{diagnostic.ok?"Núcleo verificado":"Hay elementos pendientes de configuración o verificación"}</div>{(diagnostic.tests||[]).map((x:any)=><div key={x.name} className="flex items-start justify-between gap-3 border-b py-2 last:border-0"><div><b className="text-sm">{x.name}</b><p className="text-xs text-muted-foreground">{x.detail}</p></div><span className={`text-xs font-black ${x.ok?"text-emerald-700":"text-amber-700"}`}>{x.ok?"OK":"PENDIENTE"}</span></div>)}</div>:<Empty text="Diagnóstico no disponible."/>}
   </Panel>
   <Panel title="Aprobaciones pendientes" icon={ShieldCheck}>
    {approvals.length?<div className="space-y-2">{approvals.slice(0,5).map((t:any)=><div key={t.id} className="border rounded-xl p-3"><b className="text-sm">{t.title}</b><button onClick={()=>void approve(t.id)} className="mt-2 w-full py-2 rounded-lg bg-amber-100 text-amber-900 font-bold">Aprobar</button></div>)}</div>:<Empty text="No hay tareas esperando autorización."/>}
   </Panel>
  </div>}

  {tab==="brain"&&<Panel title="Cerebro / Self Model" icon={Brain}>{selfModel?<div className="grid gap-5 xl:grid-cols-3"><div className="xl:col-span-2 rounded-2xl border p-5"><div className="text-xs uppercase tracking-wider text-muted-foreground">Identidad persistente</div><h3 className="mt-1 text-2xl font-black">{selfModel.identity||"HERENCIA Neural"}</h3><p className="mt-3 text-muted-foreground">{selfModel.purpose}</p><div className="mt-4 flex flex-wrap gap-2">{(selfModel.principles||[]).map((x:string)=><span key={x} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{x}</span>)}</div></div><div className="rounded-2xl border p-5"><div className="text-sm font-black">Continuidad</div><div className="mt-3 space-y-2 text-sm"><Row label="Versión" value={selfModel.version||"—"}/><Row label="Generación" value={String(selfModel.generation||1)}/><Row label="Capacidades" value={String((selfModel.capabilities||[]).length)}/><Row label="Limitaciones" value={String((selfModel.limitations||[]).length)}/><Row label="Aprendizajes" value={String((selfModel.learnings||[]).length)}/></div></div><div className="rounded-2xl border p-5"><b>Capacidades</b><div className="mt-3 flex flex-wrap gap-2">{(selfModel.capabilities||[]).map((x:string)=><span key={x} className="rounded-lg bg-muted px-2 py-1 text-xs">{x}</span>)}</div></div><div className="rounded-2xl border p-5"><b>Limitaciones conocidas</b>{(selfModel.limitations||[]).length?<ul className="mt-3 space-y-2 text-sm">{selfModel.limitations.map((x:string)=><li key={x}>• {x}</li>)}</ul>:<p className="mt-3 text-sm text-muted-foreground">No hay limitaciones registradas en el Self Model actual.</p>}</div><div className="rounded-2xl border p-5"><b>Estado cognitivo</b><div className="mt-3 space-y-2 text-sm"><Row label="Tareas activas" value={String((selfModel.tasks||[]).length)}/><Row label="Errores recientes" value={String((selfModel.errors||[]).length)}/><Row label="Correcciones" value={String((selfModel.corrections||[]).length)}/></div></div></div>:<Empty text="Self Model no disponible."/ >}</Panel>}

  {tab==="learning"&&<Panel title="Aprendizaje y patrones" icon={Sparkles}><div className="grid gap-5 xl:grid-cols-2"><div className="rounded-2xl border p-5"><h3 className="font-black">Demanda aprendida de conversaciones</h3><p className="mt-1 text-sm text-muted-foreground">Las conversaciones siguen siendo provisionales; Neural agrega señales de demanda sin convertirlas en hechos.</p><div className="mt-4 space-y-2">{(demand?.topics||[]).slice(0,20).map((entry:any,i:number)=>{const key=Array.isArray(entry)?entry[0]:entry?.topic;const rows=Array.isArray(entry)?entry[1]:entry?.rows;return <div key={key||i} className="flex items-center justify-between rounded-xl bg-muted/50 p-3"><span className="font-medium">{key||"sin tema"}</span><b>{Array.isArray(rows)?rows.length:Number(entry?.count||0)}</b></div>})}{!(demand?.topics||[]).length&&<Empty text="Todavía no hay suficiente demanda agregada."/>}</div></div><div className="rounded-2xl border p-5"><h3 className="font-black">Patrones de negocio</h3><p className="mt-1 text-sm text-muted-foreground">Descriptivos, no causales. La confianza depende del tamaño de la muestra.</p><div className="mt-4 grid grid-cols-2 gap-3"><Mini label="Ventas muestra" value={String(patterns?.sample?.verifiedSales||0)}/><Mini label="Confianza" value={String(patterns?.confidence||"—")}/><Mini label="Clientes recurrentes" value={String(patterns?.repeatCustomers||0)}/><Mini label="Combos detectados" value={String((patterns?.coPurchases||[]).length)}/></div><div className="mt-4 space-y-2">{(patterns?.topProducts||[]).slice(0,8).map((p:any)=><div key={p.id} className="flex justify-between rounded-xl border p-3 text-sm"><span>{p.name}</span><b>{p.units} uds.</b></div>)}</div></div></div></Panel>}

  {tab==="tasks"&&<Panel title="Cola de tareas Neural" icon={ListTodo}>{tasks.length?<div className="space-y-3">{tasks.map((t:any)=><div key={t.id} className="border rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between"><div><b>{t.title}</b><p className="text-xs text-muted-foreground mt-1">{t.intent} · {t.assignedCell||"sin asignar"} · {t.status}</p></div>{(t.status==="WAITING_APPROVAL"||t.requiresApproval)&&<button onClick={()=>void approve(t.id)} className="px-4 py-2 rounded-xl bg-amber-100 text-amber-900 font-bold">Aprobar</button>}</div>)}</div>:<Empty text="La cola está vacía."/>}</Panel>}

  {tab==="agents"&&<Panel title="Red de células" icon={Bot}><div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">{agents.map((a:any)=><div key={a.id} className="p-4 border rounded-2xl"><div className="flex items-start justify-between gap-3"><div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center"><Bot className="w-5 h-5 text-emerald-800"/></div><span className="text-[11px] rounded-full bg-muted px-2 py-1">{a.status}</span></div><b className="mt-3 block capitalize">{a.specialty}</b><p className="mt-1 text-xs text-muted-foreground">{a.role||"Célula especializada"}</p><div className="mt-3 flex flex-wrap gap-1">{(a.skills||[]).slice(0,4).map((skill:string)=><span key={skill} className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] text-emerald-800">{skill}</span>)}</div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-muted/50 p-2"><span className="text-muted-foreground">Generación</span><b className="block">{a.generation}</b></div><div className="rounded-xl bg-muted/50 p-2"><span className="text-muted-foreground">Éxito</span><b className="block">{a.performance?.successRate==null?"—":Math.round(a.performance.successRate*100)+"%"}</b></div></div><p className="mt-3 text-[11px] text-muted-foreground">Permisos: {a.permissions} · conexiones {(a.connections||[]).length}</p></div>)}</div></Panel>}

  {tab==="memory"&&<Panel title="Memoria jerárquica" icon={Database}><div className="flex gap-2 mb-4"><input value={memoryQuery} onChange={e=>setMemoryQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void searchMemory()} className="flex-1 border rounded-xl px-4" placeholder="Buscar recuerdos, conocimiento, correcciones…"/><button onClick={()=>void searchMemory()} className="px-4 rounded-xl bg-primary text-primary-foreground"><Search/></button></div><div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-5">{Object.entries(status?.memory||{}).filter(([k])=>k!=="total").map(([k,v])=><div key={k} className="border rounded-xl p-3"><div className="text-xs text-muted-foreground capitalize">{k}</div><b>{String(v)}</b></div>)}</div>{memory.length?<div className="space-y-2">{memory.map((m:any)=><div key={m.id} className="border rounded-xl p-3"><div className="flex justify-between gap-2"><b className="text-sm">{m.tier} · {m.kind}</b><span className="text-xs">{m.verified?"verificado":"provisional"}</span></div><pre className="text-xs whitespace-pre-wrap mt-2 text-muted-foreground">{JSON.stringify(m.content,null,2)}</pre></div>)}</div>:<Empty text="Busca en la memoria para inspeccionar contenido y procedencia."/>}</Panel>}

  {tab==="goals"&&<Panel title="Objetivos persistentes" icon={Target}><div className="flex gap-2 mb-5"><input value={goal} onChange={e=>setGoal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void addGoal()} className="flex-1 border rounded-xl px-4 bg-background" placeholder="Ej. reducir roturas de stock"/><button onClick={()=>void addGoal()} className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold">Añadir</button></div><div className="space-y-3">{goals.map((g:any)=><div key={g.id} className="border rounded-2xl p-4"><div className="flex justify-between"><b>{g.text}</b><span>{g.progress||0}%</span></div><div className="h-2 bg-muted rounded-full mt-3 overflow-hidden"><div className="h-full bg-primary" style={{width:`${Math.max(0,Math.min(100,g.progress||0))}%`}}/></div><p className="text-xs text-muted-foreground mt-2">{g.status} · prioridad {g.priority||50}</p></div>)}</div></Panel>}

  {tab==="permissions"&&<Panel title="Permission Kernel externo" icon={ShieldCheck}><p className="text-muted-foreground mb-4">Esta capa vive fuera de los modelos y células. Pulsa un permiso para alternar AUTO → ASK → BLOCK.</p><div className="grid md:grid-cols-2 gap-3">{Object.entries(permissions).map(([k,v])=><button key={k} onClick={()=>void cycle(k)} className="flex justify-between items-center border rounded-xl p-4 hover:bg-muted"><span className="font-medium">{labels[k]||k}</span><ModeBadge mode={v}/></button>)}</div></Panel>}

  {tab==="activity"&&<Panel title="Auditoría append-only" icon={Activity}><div className="mb-4 text-sm flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600"/>Integridad: {status?.audit?.ok===false?"fallo detectado":status?.audit?.ok?"verificada":"sin datos"}</div>{trace&&<div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex justify-between gap-3"><b>¿Por qué hizo esto?</b><button onClick={()=>setTrace(null)} className="text-xs underline">Cerrar</button></div><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(trace,null,2)}</pre></div>}{activity.length?<div className="space-y-2">{activity.slice(0,100).map((e:any)=><div key={e.id} className="border rounded-xl p-3"><div className="flex flex-wrap justify-between gap-2"><b className="text-sm">{e.intent||"evento"}</b><span className="text-xs text-muted-foreground">{e.at}</span></div><div className="mt-1 flex items-center justify-between gap-2"><p className="text-xs">{e.actor||"system"} · {String(e.result||"")}</p>{e.actionId&&<button onClick={()=>void explain(e.actionId)} className="rounded-lg border px-2 py-1 text-xs font-bold hover:bg-muted">¿Por qué?</button>}</div></div>)}</div>:<Empty text="Todavía no hay actividad auditada."/>}</Panel>}

  {tab==="lab"&&<LabPanel/>}
  {tab==="graph"&&<Panel title="Knowledge Graph" icon={Network}><div className="grid grid-cols-2 gap-3 mb-5"><Metric icon={Database} label="Nodos" value={String(graph.nodes?.length||0)}/><Metric icon={Network} label="Relaciones" value={String(graph.edges?.length||0)}/></div><div className="grid md:grid-cols-3 gap-2">{(graph.nodes||[]).slice(0,60).map((n:any)=><div key={n.id} className="border rounded-xl p-3"><b className="text-sm">{n.type}</b><p className="text-xs truncate mt-1">{n.name||n.key}</p></div>)}</div></Panel>}
  {tab==="research"&&<ResearchPanel/>}
  {tab==="designer"&&<DesignerPanel onChanged={refresh}/>}
  {tab==="history"&&<TimeMachinePanel onChanged={refresh}/>}
 </div>
}


function ResearchPanel(){
 const [provider,setProvider]=useState<any>(null),[query,setQuery]=useState("");
 useEffect(()=>{backendApi.neuralResearchStatus().then(setProvider).catch(()=>setProvider({enabled:false,provider:null}))},[]);
 const research=async()=>{if(!query.trim())return;try{const r=await backendApi.neuralCommand(`investiga ${query.trim()}`);toast.success(r.message||"Investigación añadida a la cola");setQuery("")}catch(e:any){toast.error(e.message)}};
 return <Panel title="Investigación con procedencia" icon={Globe2}><div className="mb-5 rounded-2xl border p-4"><b>{provider?.enabled?`Proveedor activo: ${provider.provider}`:"Proveedor de búsqueda no configurado"}</b><p className="mt-1 text-sm text-muted-foreground">Los resultados web entran como memoria provisional y no se convierten automáticamente en conocimiento verificado.</p></div><div className="flex gap-2"><input className="flex-1 rounded-xl border px-4" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void research()} placeholder="Investigar tendencias, proveedores, productos…"/><button onClick={()=>void research()} className="rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">Investigar</button></div></Panel>
}

function DesignerPanel({onChanged}:{onChanged:()=>Promise<void>}){
 const [drafts,setDrafts]=useState<any[]>([]),[title,setTitle]=useState(""),[subtitle,setSubtitle]=useState(""),[columns,setColumns]=useState(3),[loading,setLoading]=useState(false);
 const load=useCallback(()=>backendApi.neuralWebDrafts().then(r=>setDrafts(r.drafts||[])).catch(()=>setDrafts([])),[]);
 useEffect(()=>{void load()},[load]);
 const create=async()=>{if(!title.trim())return;setLoading(true);try{await backendApi.neuralCreateWebDraft({title:`Nueva sección: ${title.trim()}`,operations:[{type:"createSection",section:{title:title.trim(),subtitle:subtitle.trim(),columns,items:[]}}]});toast.success("Borrador creado. Aún no está publicado.");setTitle("");setSubtitle("");await load();await onChanged()}catch(e:any){toast.error(e.message)}finally{setLoading(false)}};
 const requestPublish=async(id:string)=>{try{await backendApi.neuralRequestPublish(id,"Publicación solicitada desde Neural Designer");toast.success("Publicación enviada a aprobación");await onChanged()}catch(e:any){toast.error(e.message)}};
 return <Panel title="Neural Designer · borradores reales" icon={Palette}>
  <div className="grid gap-5 lg:grid-cols-2">
   <div className="rounded-2xl border p-4"><h3 className="font-black">Crear sección estructurada</h3><p className="mt-1 text-sm text-muted-foreground">Se guarda primero como borrador. Publicarla es una acción separada gobernada por permisos.</p><div className="mt-4 space-y-3"><input value={title} onChange={e=>setTitle(e.target.value)} className="w-full rounded-xl border px-4 py-3" placeholder="Título de la sección"/><textarea value={subtitle} onChange={e=>setSubtitle(e.target.value)} className="w-full rounded-xl border px-4 py-3" rows={3} placeholder="Subtítulo"/><label className="block text-sm font-bold">Columnas<select value={columns} onChange={e=>setColumns(Number(e.target.value))} className="mt-2 w-full rounded-xl border px-4 py-3"><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option></select></label><button disabled={loading||!title.trim()} onClick={()=>void create()} className="w-full rounded-xl bg-primary px-5 py-3 font-black text-primary-foreground disabled:opacity-50">{loading?"Creando…":"Crear borrador"}</button></div></div>
   <div><h3 className="mb-3 font-black">Borradores</h3>{drafts.length?<div className="space-y-3">{drafts.slice(0,20).map(d=><div key={d.id} className="rounded-2xl border p-4"><div className="flex justify-between gap-3"><div><b>{d.title||d.id}</b><p className="mt-1 text-xs text-muted-foreground">{d.status} · {d.createdAt}</p></div>{d.status!=="PUBLISHED"&&<button onClick={()=>void requestPublish(d.id)} className="h-fit rounded-xl bg-amber-100 px-3 py-2 text-xs font-black text-amber-900">Solicitar publicación</button>}</div><p className="mt-3 text-xs">{Array.isArray(d.operations)?d.operations.length:0} operaciones estructuradas</p></div>)}</div>:<Empty text="No hay borradores."/>}</div>
  </div>
 </Panel>
}

function TimeMachinePanel({onChanged}:{onChanged:()=>Promise<void>}){
 const [versions,setVersions]=useState<any[]>([]);
 const load=useCallback(()=>backendApi.neuralWebVersions().then(r=>setVersions(r.versions||[])).catch(()=>setVersions([])),[]);
 useEffect(()=>{void load()},[load]);
 const rollback=async(id:string)=>{try{await backendApi.neuralRequestRollback(id);toast.success("Restauración enviada a aprobación");await onChanged()}catch(e:any){toast.error(e.message)}};
 return <Panel title="Time Machine" icon={History}><p className="mb-4 text-sm text-muted-foreground">Cada publicación guarda el estado anterior. Restaurar crea una tarea ASK y antes de ejecutarse vuelve a crear un snapshot de seguridad.</p>{versions.length?<div className="space-y-3">{versions.map(v=><div key={v.id} className="flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between"><div><b>{v.label||v.reason||"Versión web"}</b><p className="mt-1 text-xs text-muted-foreground">{v.at||v.createdAt||"sin fecha"} · {v.id}</p></div><button onClick={()=>void rollback(v.id)} className="rounded-xl border px-4 py-2 font-bold hover:bg-muted">Solicitar restauración</button></div>)}</div>:<Empty text="Todavía no hay versiones. La primera se creará al publicar un borrador."/>}</Panel>
}

function LabPanel(){
 const [items,setItems]=useState<any[]>([]),[agents,setAgents]=useState<any[]>([]),[parentId,setParentId]=useState(""),[hypothesis,setHypothesis]=useState(""),[fitness,setFitness]=useState<Record<string,string>>({});
 const load=useCallback(async()=>{const [l,a]=await Promise.all([backendApi.neuralLab(),backendApi.neuralAgents()]);setItems(l.experiments||[]);setAgents((a.agents||[]).filter((x:any)=>x.status==="ACTIVE"));setParentId(p=>p||a.agents?.find((x:any)=>x.status==="ACTIVE")?.id||"")},[]);
 useEffect(()=>{void load()},[load]);
 const mutate=async()=>{if(!parentId||!hypothesis.trim())return;try{await backendApi.neuralLabMutate({parentId,hypothesis:hypothesis.trim(),mutation:{}});setHypothesis("");toast.success("Variante creada en sandbox");await load()}catch(e:any){toast.error(e.message)}};
 const evaluate=async(id:string)=>{const v=Number(fitness[id]);if(!Number.isFinite(v))return toast.error("Indica un fitness numérico");try{await backendApi.neuralLabEvaluate(id,{fitness:v,source:"admin_manual_evaluation"});toast.success("Experimento evaluado");await load()}catch(e:any){toast.error(e.message)}};
 const promote=async(id:string)=>{try{await backendApi.neuralLabPromote(id);toast.success("Variante promovida con aprobación humana");await load()}catch(e:any){toast.error(e.message)}};
 const retire=async(id:string)=>{try{await backendApi.neuralLabRetire(id);toast.success("Experimento retirado");await load()}catch(e:any){toast.error(e.message)}};
 return <Panel title="Neural Lab" icon={FlaskConical}><p className="text-sm text-muted-foreground mb-4">Sandbox evolutivo separado de Producción. Las variantes nunca ganan permisos y jamás se promocionan solas.</p><div className="mb-5 grid gap-3 rounded-2xl border p-4 md:grid-cols-[220px_1fr_auto]"><select value={parentId} onChange={e=>setParentId(e.target.value)} className="rounded-xl border px-3 py-2">{agents.map(a=><option key={a.id} value={a.id}>{a.specialty} · gen {a.generation}</option>)}</select><input value={hypothesis} onChange={e=>setHypothesis(e.target.value)} className="rounded-xl border px-4 py-2" placeholder="Hipótesis del experimento"/><button onClick={()=>void mutate()} className="rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground">Crear variante</button></div>{items.length?<div className="space-y-3">{items.map(x=><div key={x.id} className="rounded-2xl border p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><b>{x.hypothesis||"Experimento"}</b><p className="mt-1 text-xs text-muted-foreground">{x.status} · fitness {x.fitness??"sin evaluar"} · variante {x.variantCellId||"—"}</p></div><div className="flex flex-wrap gap-2">{x.status==="SANDBOX"&&<><input value={fitness[x.id]||""} onChange={e=>setFitness(v=>({...v,[x.id]:e.target.value}))} className="w-24 rounded-lg border px-2 py-1 text-sm" placeholder="fitness"/><button onClick={()=>void evaluate(x.id)} className="rounded-lg border px-3 py-1 text-sm font-bold">Evaluar</button></>}{x.status==="EVALUATED"&&Number(x.fitness)>0&&<button onClick={()=>void promote(x.id)} className="rounded-lg bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-900">Promover</button>}{!["PROMOTED","RETIRED"].includes(x.status)&&<button onClick={()=>void retire(x.id)} className="rounded-lg bg-red-50 px-3 py-1 text-sm font-bold text-red-800">Retirar</button>}</div></div></div>)}</div>:<Empty text="Aún no hay experimentos creados."/>}</Panel>
}
function Panel({title,icon:Icon,children,className=""}:any){return <section className={`bg-card border rounded-3xl p-5 shadow-sm ${className}`}><h2 className="font-black text-lg flex items-center gap-2 mb-4"><Icon className="w-5 h-5 text-primary"/>{title}</h2>{children}</section>}
function InfoPanel({title,icon,text}:any){return <Panel title={title} icon={icon}><div className="min-h-56 flex items-center justify-center"><div className="max-w-2xl text-center"><p className="text-lg text-muted-foreground">{text}</p></div></div></Panel>}
function Row({label,value}:{label:string;value:string}){return <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{label}</span><b>{value}</b></div>}
function Mini({label,value}:{label:string;value:string}){return <div className="rounded-xl bg-muted/50 p-3"><div className="text-xs text-muted-foreground">{label}</div><b className="mt-1 block">{value}</b></div>}
function Empty({text}:{text:string}){return <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>}
function Badge({text,ok}:any){return <span className={`px-4 py-2 rounded-xl font-bold ${ok?"bg-emerald-400/20 text-emerald-50":"bg-red-400/20 text-red-50"}`}>{text}</span>}
function ModeBadge({mode}:{mode:Mode}){return <span className={`px-3 py-1 rounded-full text-xs font-black ${mode==="AUTO"?"bg-emerald-100 text-emerald-800":mode==="ASK"?"bg-amber-100 text-amber-800":"bg-red-100 text-red-800"}`}>{mode==="AUTO"?"AUTÓNOMO":mode==="ASK"?"CONSULTAR":"BLOQUEADO"}</span>}
function Metric({icon:Icon,label,value}:any){return <div className="flex gap-3 items-center py-3 border-b last:border-0"><div className="p-2 bg-primary/10 rounded-xl"><Icon className="w-5 h-5 text-primary"/></div><div><p className="text-xs text-muted-foreground">{label}</p><b>{value}</b></div></div>}
