const MAX_ARTICLES = 50;
const STOP = new Set(["este","esta","para","sobre","como","cual","donde","cuando","quiero","necesito","tengo","puedo","puedes","una","unos","unas","que","con","por","los","las","del","mis","pedido","pedidos"]);
function parseJson(raw) {
  if(typeof raw==="string"){try{return JSON.parse(raw)}catch{return []}}
  return raw;
}
export function normalizeSupportKnowledge(raw) {
  const value=parseJson(raw);
  const rows=Array.isArray(value)?value:(Array.isArray(value?.articles)?value.articles:[]);
  return rows.slice(0,MAX_ARTICLES).filter(x=>x&&typeof x==="object").map((item,index)=>({
    id:String(item.id||"support-"+index).slice(0,90),
    question:String(item.question||"").trim().slice(0,180),
    answer:String(item.answer||"").trim().slice(0,2500),
    enabled:item.enabled!==false,
  })).filter(item=>item.question.length>=4&&item.answer.length>=10);
}
export function validateSupportKnowledgePayload(input) {
  if(!input||typeof input!=="object"||Array.isArray(input)||!Array.isArray(input.articles)){
    throw new Error("Envía una lista de respuestas aprobadas");
  }
  if(input.articles.length>MAX_ARTICLES)throw new Error("Máximo 50 respuestas");
  const ids=new Set();
  const articles=input.articles.map((item,index)=>{
    if(!item||typeof item!=="object"||Array.isArray(item))throw new Error("Respuesta no válida");
    const id=String(item.id||"faq-"+index).trim().slice(0,90);
    const question=String(item.question||"").trim();
    const answer=String(item.answer||"").trim();
    if(!/^[a-zA-Z0-9_-]{1,90}$/.test(id)||ids.has(id))throw new Error("Identificador de respuesta duplicado o inválido");
    if(question.length<4||question.length>180||answer.length<10||answer.length>2500){
      throw new Error("Cada pregunta debe tener 4-180 caracteres y la respuesta 10-2500");
    }
    if(typeof item.enabled!=="boolean")throw new Error("El estado debe ser activado o desactivado");
    ids.add(id);
    return {id,question,answer,enabled:item.enabled};
  });
  return articles;
}
function terms(value) {
  return [...new Set(String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").match(/[a-z]{4,}/g)||[])]
    .map(x=>x.slice(0,6)).filter(x=>!STOP.has(x));
}
export function relevantSupportKnowledge(raw,question,limit=3){
  const candidates=normalizeSupportKnowledge(raw).filter(x=>x.enabled);
  const words=terms(question);
  if(!words.length)return [];
  return candidates.map(article=>{
    const title=terms(article.question),body=terms(article.answer);
    const score=words.reduce((sum,w)=>sum+(title.includes(w)?3:0)+(body.includes(w)?1:0),0);
    return {article,score};
  }).filter(item=>item.score>0)
    .sort((a,b)=>b.score-a.score)
    .slice(0,Math.max(1,Math.min(5,limit)))
    .map(x=>x.article);
}
export function knowledgeContext(articles, question) {
  const hits=relevantSupportKnowledge(articles,question,3);
  if(!hits.length)return "";
  return "Información verificada por Administración (no inventar condiciones adicionales):\n"+
    hits.map(x=>"P: "+x.question+"\nR: "+x.answer).join("\n\n").slice(0,1800);
}
