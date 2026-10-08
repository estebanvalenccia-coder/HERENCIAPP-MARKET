import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, Loader2, Plus, Save, Trash2 } from "lucide-react";

type Article = { id:string;question:string;answer:string;enabled:boolean };
async function knowledgeApi(method="GET",articles?:Article[]){
  const response=await fetch("/api/admin/support/v2/knowledge",{
    method, credentials:"include", cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:method==="GET"?undefined:JSON.stringify({articles}),
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error||"No se pudo guardar la base de conocimientos");
  return result as {articles:Article[]};
}
export function AdminSupportKnowledge(){
  const [articles,setArticles]=useState<Article[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [dirty,setDirty]=useState(false);
  const [feedback,setFeedback]=useState("");
  const [isError,setIsError]=useState(false);
  useEffect(()=>{
    let alive=true;
    knowledgeApi().then(result=>{if(alive)setArticles(result.articles);})
      .catch(e=>{if(alive){setFeedback(e.message);setIsError(true)}})
      .finally(()=>{if(alive)setLoading(false)});
    return()=>{alive=false};
  },[]);
  function edit(id:string,change:Partial<Article>){
    setArticles(rows=>rows.map(item=>item.id===id?{...item,...change}:item));
    setDirty(true);setFeedback("");
  }
  function add(){
    if(articles.length>=50)return;
    const id="faq-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,6);
    setArticles(rows=>[...rows,{id,question:"",answer:"",enabled:true}]);
    setDirty(true);setFeedback("");
  }
  async function save(){
    if(saving||loading)return;
    setSaving(true);setIsError(false);setFeedback("");
    try{
      const result=await knowledgeApi("PUT",articles);
      setArticles(result.articles);setDirty(false);
      setFeedback("Respuestas guardadas. Herencia IA ya podrá usarlas para consultas relacionadas.");
    }catch(cause:any){setIsError(true);setFeedback(cause.message||"Error al guardar respuestas")}
    finally{setSaving(false)}
  }
  return <div className="space-y-3 rounded-2xl border border-[#d8e5d8] bg-white p-4 sm:col-span-2">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-bold text-[#2d523b]"><BookOpen size={18}/> Base de conocimientos de Herencia IA</h3>
        <p className="mt-1 max-w-xl text-xs leading-5 text-[#78907b]">Escribe las políticas y respuestas aprobadas de Herencia: devoluciones, horarios, servicios y cuidados. Solo se consultarán las respuestas activadas y relacionadas con la pregunta. No incluyas datos privados.</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={add} disabled={loading||saving||articles.length>=50}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#c9dacb] px-3 py-2 text-xs font-semibold text-[#366244] disabled:opacity-50"><Plus size={15}/> Añadir</button>
        <button type="button" onClick={()=>void save()} disabled={!dirty||loading||saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#2f6444] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
          {saving?<Loader2 size={15} className="animate-spin"/>:<Save size={15}/>} Guardar
        </button>
      </div>
    </div>
    {loading&&<p className="flex items-center gap-2 text-xs text-[#758c7c]"><Loader2 size={15} className="animate-spin"/> Cargando respuestas...</p>}
    {!loading&&!articles.length&&<p className="rounded-xl bg-[#f4f8f4] px-4 py-3 text-xs text-[#728a78]">Aún no hay respuestas aprobadas. Añade la primera para que la IA pueda consultar información verificada.</p>}
    <div className="max-h-[570px] space-y-3 overflow-y-auto">
      {articles.map(article=><div key={article.id} className="space-y-2 rounded-xl border border-[#e0e8df] p-3">
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-[#4a7153]">
            <input type="checkbox" className="accent-[#2b6041]" checked={article.enabled} disabled={saving}
              onChange={e=>edit(article.id,{enabled:e.target.checked})}/> Publicar esta respuesta
          </label>
          <button type="button" disabled={saving} aria-label="Eliminar respuesta" onClick={()=>{
            setArticles(rows=>rows.filter(item=>item.id!==article.id));setDirty(true);setFeedback("");
          }} className="rounded-lg p-1.5 text-[#9f5f59] hover:bg-red-50"><Trash2 size={16}/></button>
        </div>
        <label className="block text-xs font-semibold text-[#5c7562]">Pregunta o tema
          <input value={article.question} maxLength={180} disabled={saving}
            onChange={e=>edit(article.id,{question:e.target.value})}
            placeholder="Ej. ¿Cómo solicito una devolución?"
            className="mt-1 block w-full rounded-lg border border-[#dce7dc] px-3 py-2 text-sm text-[#254432] outline-none focus:border-[#619574]"/>
        </label>
        <label className="block text-xs font-semibold text-[#5c7562]">Respuesta aprobada
          <textarea rows={3} maxLength={2500} disabled={saving} value={article.answer}
            onChange={e=>edit(article.id,{answer:e.target.value})}
            placeholder="Explica aquí tus condiciones reales. No inventes plazos ni garantías."
            className="mt-1 block w-full resize-y rounded-lg border border-[#dce7dc] px-3 py-2 text-sm text-[#254432] outline-none focus:border-[#619574]"/>
        </label>
      </div>)}
    </div>
    {feedback&&<p role={isError?"alert":"status"} className={"flex items-start gap-2 rounded-lg px-3 py-2 text-xs "+(isError?"bg-red-50 text-red-700":"bg-[#eaf5eb] text-[#326044]")}>{!isError&&<CheckCircle2 size={16}/>} {feedback}</p>}
    <p className="text-[11px] text-[#92a096]">{articles.length}/50 respuestas · {dirty?"Cambios sin guardar":"Sin cambios pendientes"}</p>
  </div>;
}
