// La atención humana es la última opción: no derivar automáticamente por
// mencionar "pedido", "reembolso" o "devolución". Primero orientar sin
// acceder ni transmitir información privada.
const HUMAN_TOPICS = /(?:quiero|necesito|deseo|puedo|podr[ií]a|pas[aá]me|comun[ií]came).{0,45}(?:hablar|contactar|atenci[oó]n).{0,30}(?:persona|humano|agente|operador)|(?:hablar|contactar).{0,25}(?:persona|humano|agente|operador)/i;
const SENSITIVE = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b(?:\+?\d[\d\s().-]{7,}\d)\b|\bES\d{22}\b|\b\d{8}[A-Za-z]\b|(?:contrase(?:ñ|n)a|password|clave de acceso|n[uú]mero de tarjeta|CVV|CVC|IBAN|direcci[oó]n postal)/i;
export function containsPrivateSupportData(text = "") {
  return SENSITIVE.test(String(text || ""));
}
export function safeSupportHistory(history = []) {
  return (Array.isArray(history) ? history : []).slice(-8)
    .filter(message => ["customer","assistant"].includes(message?.role))
    .filter(message => !containsPrivateSupportData(message?.text))
    .map(message => ({
      role: message.role === "customer" ? "user" : "assistant",
      content: String(message.text || "").slice(0, 650),
    }));
}
export function needsHumanSupport(text = "") {
  return HUMAN_TOPICS.test(String(text));
}
function guidedReply(question) {
  const q = String(question).toLowerCase();
  if (/reembols|devoluci[oó]n|cancel|roto|da[nñ]ad|reclam/.test(q)) return "Puedo ayudarte a revisar las opciones de devolución o reembolso. ¿El artículo llegó dañado, recibiste un producto distinto o quieres devolverlo por otro motivo? Si llegó dañado, puedes adjuntar una fotografía. No necesito datos bancarios. Las condiciones exactas dependen de las políticas publicadas y del caso; si hace falta autorización especial te ofreceré hablar con tu Amigo Plantil.";
  if (/pedido|env[ií]o|entrega|seguim|retras|no lleg/.test(q)) return "Vamos a revisar qué ha ocurrido con tu pedido. ¿Quieres consultar el estado de entrega, comunicar un retraso o informar de un problema con lo recibido? Si necesitas datos específicos de tu pedido, tendrás que acceder a tu cuenta; no compartas información privada en este chat.";
  if (/factur|cobro|cargo|pago|tarjeta/.test(q)) return "Puedo orientarte con la facturación o el pago. ¿Necesitas una factura, consultar los métodos de pago o informar de un cobro que no reconoces? No compartas números de tarjeta ni contraseñas. Si es una operación concreta, el equipo podrá revisarla por un canal seguro.";
  return "";
}
export async function answerGeneralSupport(question, publicContext = "", history = []) {
  if (needsHumanSupport(question)) return {reply:"Claro. Si prefieres atención personal, puedes pulsar «Hablar con mi Amigo Plantil» para continuar esta conversación con nuestro equipo.",needsHuman:true};
  const privateInfo = containsPrivateSupportData(question);
  const key = String(process.env.GROQ_API_KEY || "").trim();
  const guide = guidedReply(question);
  if (privateInfo) return {reply:guide || "Puedo orientarte sin que compartas datos privados. Cuéntame de forma general qué necesitas resolver y buscaré la mejor opción.",needsHuman:false};
  if (!key) return {reply:guide || "Estoy aquí para ayudarte. Cuéntame un poco más sobre lo que necesitas y buscaré una solución. Si requiere una autorización especial, te ofreceré hablar con tu Amigo Plantil.",needsHuman:false};
  const messages = [
    {role:"system",content:"Eres Herencia IA, agente de atención al cliente de Herencia Market. Tu misión es RESOLVER antes de derivar. Conversa, haz una pregunta útil por turno, orienta en devoluciones, pedidos, plantas y servicios, y usa solo los datos verificados que recibas. No inventes políticas, pedidos, precios, stock, acciones realizadas ni plazos. Nunca solicites datos bancarios o contraseñas. No prometas un reembolso ni lo autorices. Si hace falta autorización humana o no puedes avanzar con la información disponible, marca needsHuman true y explica por qué; de otro modo false. Responde SOLO JSON con reply (texto español) y needsHuman (booleano)."},
    {role:"system",content:"Contexto público verificado: "+String(publicContext).slice(0,2500)},
    ...safeSupportHistory(history),
    {role:"user",content:String(question).slice(0,800)}
  ];
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions",{
    method:"POST",signal:AbortSignal.timeout(12000),
    headers:{"Content-Type":"application/json",Authorization:"Bearer "+key},
    body:JSON.stringify({model:process.env.GROQ_MODEL||"openai/gpt-oss-120b",temperature:0.2,stream:false,max_tokens:360,response_format:{type:"json_object"},messages})
  });
  if(!response.ok) throw new Error("Support model failed: "+response.status);
  const payload=await response.json();
  const parsed=JSON.parse(payload?.choices?.[0]?.message?.content||"{}");
  const reply=String(parsed.reply||"").trim().slice(0,1200);
  if(!reply)throw new Error("Empty support reply");
  return {reply,needsHuman:parsed.needsHuman===true};
}

// Evita respuestas automáticas que llegan después de la intervención humana,
// de una consulta nueva o del cierre de la conversación.
export function canAppendSupportAIReply(thread, sourceMessageId) {
  if (!thread || !sourceMessageId || thread.status !== "open") return false;
  const last = Array.isArray(thread.messages) ? thread.messages.at(-1) : null;
  return last?.id === sourceMessageId && last?.role === "customer";
}
