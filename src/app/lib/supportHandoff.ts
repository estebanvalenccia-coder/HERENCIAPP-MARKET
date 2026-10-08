export const SUPPORT_HANDOFF_DRAFT_KEY = "herencia_support_handoff_draft";

type SourceMessage = { role?: string; content?: string };

export function stageSupportHandoff(source: string, messages: SourceMessage[]) {
  const transcript = (Array.isArray(messages) ? messages : [])
    .filter(message => typeof message.content === "string" && message.content.trim())
    .slice(-6)
    .map(message => (message.role === "user" ? "Cliente: " : "Asistente: ") + String(message.content).slice(0, 230))
    .join("\n");
  const draft = ("Consulta derivada desde " + source + ":\n" +
    (transcript || "Necesito atención de una persona.")).slice(0, 1900);
  try { sessionStorage.setItem(SUPPORT_HANDOFF_DRAFT_KEY, draft); }
  catch { /* El cliente puede escribir directamente en soporte. */ }
}
