import { useEffect, useState } from "react";
import { FlaskConical, HelpCircle, Megaphone, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { backendStorage } from "../../lib/backendStorage";

const defaults = {
  faqs: [
    { id: "faq-1", question: "¿Hacéis entregas a domicilio?", answer: "Sí. El coste y disponibilidad se calculan según la dirección de entrega." },
    { id: "faq-2", question: "¿Puedo programar una entrega?", answer: "Sí. Puedes elegir fecha y franja horaria durante el checkout." },
  ],
  campaigns: [],
  abTest: {
    enabled: false,
    allocationB: 50,
    variantA: { eyebrow: "", description: "", primaryLabel: "" },
    variantB: { eyebrow: "", description: "", primaryLabel: "" },
  },
};

export function AdminMarketingHub(){
  const [data,setData]=useState<any>(defaults);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{try{const raw=backendStorage.getItem("marketingContent");if(raw)setData({...defaults,...JSON.parse(raw)});}catch{}},[]);

  const save=async()=>{
    try{setSaving(true);const r=await backendStorage.setItem("marketingContent",JSON.stringify(data));if(!r.ok)throw new Error(r.error);toast.success("Marketing publicado");}
    catch(e:any){toast.error(e?.message||"No se pudo guardar");}finally{setSaving(false);}
  };
  const addFaq=()=>setData({...data,faqs:[...(data.faqs||[]),{id:crypto.randomUUID(),question:"",answer:""}]});
  const addCampaign=()=>setData({...data,campaigns:[...(data.campaigns||[]),{id:crypto.randomUUID(),slug:`campana-${Date.now().toString().slice(-5)}`,title:"Nueva campaña",eyebrow:"HERENCIA",description:"",imageUrl:"",buttonLabel:"Ver productos",buttonHref:"/productos",active:false,startAt:"",endAt:""}]});

  return <div className="space-y-6 pb-16">
    <section className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2 text-primary"><Megaphone className="h-5 w-5"/><span className="text-sm font-bold uppercase tracking-wider">Marketing Hub</span></div><h1 className="mt-2 text-3xl font-black">Campañas, FAQ y A/B testing</h1><p className="mt-2 text-muted-foreground">Publica campañas independientes y prueba dos mensajes de portada sin modificar la plantilla principal.</p></div><button onClick={()=>void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4"/>{saving?"Guardando…":"Guardar y publicar"}</button></div>
    </section>

    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between"><div><div className="flex items-center gap-2"><HelpCircle className="h-5 w-5 text-primary"/><h2 className="text-xl font-bold">Preguntas frecuentes</h2></div><p className="mt-1 text-sm text-muted-foreground">Se muestran en /faq.</p></div><button onClick={addFaq} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold"><Plus className="h-4 w-4"/>Añadir</button></div>
      <div className="mt-4 space-y-3">{(data.faqs||[]).map((faq:any,index:number)=><div key={faq.id} className="grid gap-2 rounded-xl border border-border p-4 md:grid-cols-[1fr_1.5fr_auto]"><input value={faq.question} onChange={(e)=>setData({...data,faqs:data.faqs.map((x:any,i:number)=>i===index?{...x,question:e.target.value}:x)})} placeholder="Pregunta" className="rounded-xl border border-border bg-background p-3"/><textarea value={faq.answer} onChange={(e)=>setData({...data,faqs:data.faqs.map((x:any,i:number)=>i===index?{...x,answer:e.target.value}:x)})} placeholder="Respuesta" className="rounded-xl border border-border bg-background p-3"/><button onClick={()=>setData({...data,faqs:data.faqs.filter((_:any,i:number)=>i!==index)})} className="p-3 text-destructive"><Trash2 className="h-4 w-4"/></button></div>)}</div>
    </section>

    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Landing pages de campaña</h2><p className="mt-1 text-sm text-muted-foreground">San Valentín, Día de la Madre, bodas, empresas o cualquier campaña temporal.</p></div><button onClick={addCampaign} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold"><Plus className="h-4 w-4"/>Nueva campaña</button></div>
      <div className="mt-4 space-y-4">{(data.campaigns||[]).map((c:any,index:number)=><div key={c.id} className="rounded-2xl border border-border bg-background p-4"><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"><input value={c.title} onChange={(e)=>setData({...data,campaigns:data.campaigns.map((x:any,i:number)=>i===index?{...x,title:e.target.value}:x)})} placeholder="Título" className="rounded-xl border border-border p-3"/><input value={c.slug} onChange={(e)=>setData({...data,campaigns:data.campaigns.map((x:any,i:number)=>i===index?{...x,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g,"-")}:x)})} placeholder="slug" className="rounded-xl border border-border p-3"/><input value={c.eyebrow||""} onChange={(e)=>setData({...data,campaigns:data.campaigns.map((x:any,i:number)=>i===index?{...x,eyebrow:e.target.value}:x)})} placeholder="Texto pequeño" className="rounded-xl border border-border p-3"/><textarea value={c.description||""} onChange={(e)=>setData({...data,campaigns:data.campaigns.map((x:any,i:number)=>i===index?{...x,description:e.target.value}:x)})} placeholder="Descripción" className="rounded-xl border border-border p-3 md:col-span-2"/><input value={c.imageUrl||""} onChange={(e)=>setData({...data,campaigns:data.campaigns.map((x:any,i:number)=>i===index?{...x,imageUrl:e.target.value}:x)})} placeholder="URL imagen" className="rounded-xl border border-border p-3"/><input value={c.buttonLabel||""} onChange={(e)=>setData({...data,campaigns:data.campaigns.map((x:any,i:number)=>i===index?{...x,buttonLabel:e.target.value}:x)})} placeholder="Texto botón" className="rounded-xl border border-border p-3"/><input value={c.buttonHref||""} onChange={(e)=>setData({...data,campaigns:data.campaigns.map((x:any,i:number)=>i===index?{...x,buttonHref:e.target.value}:x)})} placeholder="/productos" className="rounded-xl border border-border p-3"/><input type="datetime-local" value={c.startAt||""} onChange={(e)=>setData({...data,campaigns:data.campaigns.map((x:any,i:number)=>i===index?{...x,startAt:e.target.value}:x)})} className="rounded-xl border border-border p-3"/><input type="datetime-local" value={c.endAt||""} onChange={(e)=>setData({...data,campaigns:data.campaigns.map((x:any,i:number)=>i===index?{...x,endAt:e.target.value}:x)})} className="rounded-xl border border-border p-3"/></div><div className="mt-3 flex items-center justify-between"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(c.active)} onChange={(e)=>setData({...data,campaigns:data.campaigns.map((x:any,i:number)=>i===index?{...x,active:e.target.checked}:x)})}/>Activa</label><div className="flex gap-3"><a href={`/campana/${c.slug}`} target="_blank" className="text-sm font-semibold text-primary">Vista previa</a><button onClick={()=>setData({...data,campaigns:data.campaigns.filter((_:any,i:number)=>i!==index)})} className="text-sm font-semibold text-destructive">Eliminar</button></div></div></div>)}</div>
    </section>

    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-primary"/><h2 className="text-xl font-bold">A/B test de portada</h2></div>
      <div className="mt-4 flex items-center justify-between rounded-xl border border-border p-4"><div><p className="font-semibold">Activar experimento</p><p className="text-xs text-muted-foreground">Cada navegador queda asignado de forma estable a A o B.</p></div><input type="checkbox" checked={Boolean(data.abTest?.enabled)} onChange={(e)=>setData({...data,abTest:{...data.abTest,enabled:e.target.checked}})}/></div>
      <label className="mt-4 block text-sm font-medium">Porcentaje variante B: {Number(data.abTest?.allocationB||50)}%<input type="range" min="10" max="90" step="5" value={Number(data.abTest?.allocationB||50)} onChange={(e)=>setData({...data,abTest:{...data.abTest,allocationB:Number(e.target.value)}})} className="mt-2 w-full"/></label>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">{(["variantA","variantB"] as const).map((key)=><div key={key} className="rounded-xl border border-border p-4"><h3 className="font-bold">{key==="variantA"?"Variante A":"Variante B"}</h3><div className="mt-3 space-y-2"><input value={data.abTest?.[key]?.eyebrow||""} onChange={(e)=>setData({...data,abTest:{...data.abTest,[key]:{...data.abTest[key],eyebrow:e.target.value}}})} placeholder="Texto pequeño (vacío = original)" className="w-full rounded-xl border border-border p-3"/><textarea value={data.abTest?.[key]?.description||""} onChange={(e)=>setData({...data,abTest:{...data.abTest,[key]:{...data.abTest[key],description:e.target.value}}})} placeholder="Descripción" className="w-full rounded-xl border border-border p-3"/><input value={data.abTest?.[key]?.primaryLabel||""} onChange={(e)=>setData({...data,abTest:{...data.abTest,[key]:{...data.abTest[key],primaryLabel:e.target.value}}})} placeholder="Texto botón principal" className="w-full rounded-xl border border-border p-3"/></div></div>)}</div>
    </section>
  </div>;
}
