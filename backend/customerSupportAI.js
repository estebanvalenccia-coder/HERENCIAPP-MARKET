// La IA solo responde preguntas generales. Los casos que afectan a una cuenta o un pedido
// se trasladan a una persona sin enviar datos privados al proveedor del modelo.
const HUMAN_TOPICS = /reembols|devoluci[oó]n|cancel|pedido|env[ií]o|seguim|reclam|queja|factur|cobro|cargo|pago|tarjeta|cuenta|contrase[nñ]a|datos personales|entrega|retras|incidencia|no lleg|roto|da[nñ]ad|hablar con|hablar a|persona|humano|agente|operador|whatsapp/i;

export function needsHumanSupport(text = "") {
  return HUMAN_TOPICS.test(String(text));
}

export async function answerGeneralSupport(question, publicContext = "") {
  if (needsHumanSupport(question) || /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:\+?\d[\d\s-]{7,}\d)/.test(String(question))) return { reply: "Voy a dejar tu consulta pendiente para que una persona de Herencia pueda ayudarte directamente desde este chat.", needsHuman: true };
  const key = String(process.env.GROQ_API_KEY || "").trim();
  if (!key) return { reply: "He recibido tu mensaje. Nuestro equipo te responderá en este mismo chat.", needsHuman: true };
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(12000),
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      temperature: 0.15,
      stream: false,
      max_tokens: 270,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Eres el asistente de ATENCIÓN AL CLIENTE de Herencia Market, distinto al asistente de ventas. Contesta en español, breve y con amabilidad. Usa SOLO el contexto público facilitado. No inventes horarios, direcciones, precios, pedidos, disponibilidad, leyes, devoluciones ni plazos. No dices que has realizado una acción. Si falta información, marca needsHuman true. Nunca solicites datos bancarios ni contraseñas. Devuelve JSON exacto: {\\\"reply\\\":\\\"texto\\\",\\\"needsHuman\\\":boolean}." },
        { role: "system", content: "Contexto público: " + String(publicContext || "").slice(0, 1500) },
        { role: "user", content: String(question || "").slice(0, 800) }
      ],
    }),
  });
  if (!response.ok) throw new Error("Support model failed: " + response.status);
  const payload = await response.json();
  const raw = payload?.choices?.[0]?.message?.content || "";
  const parsed = JSON.parse(raw);
  const reply = String(parsed?.reply || "").trim().slice(0, 1000);
  if (!reply) throw new Error("Support model returned empty reply");
  return { reply, needsHuman: parsed.needsHuman !== false };
}

// Evita respuestas automáticas que llegan después de la intervención humana,
// de una consulta nueva o del cierre de la conversación.
export function canAppendSupportAIReply(thread, sourceMessageId) {
  if (!thread || !sourceMessageId || thread.status !== "open") return false;
  const last = Array.isArray(thread.messages) ? thread.messages.at(-1) : null;
  return last?.id === sourceMessageId && last?.role === "customer";
}
