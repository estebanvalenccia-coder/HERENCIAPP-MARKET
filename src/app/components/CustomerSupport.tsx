import { useEffect, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { Link } from "react-router";

type Message = { id: string; role: "customer" | "agent"; text: string; createdAt: string };
type Thread = { customerId: string; customerName: string; customerEmail: string; status: "open" | "closed"; messages: Message[]; updatedAt: string };

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "No se pudo conectar con atención al cliente");
  return result as T;
}
export function CustomerSupport({ compact = false }: { compact?: boolean }) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const refresh = async () => {
    try { const result = await request<{ thread: Thread }>("/api/customer/support"); setThread(result.thread); setRequiresLogin(false); }
    catch (err: any) { if (/sesión|inicia sesión/i.test(err.message)) setRequiresLogin(true); else setError(err.message); }
  };
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 12000);
    return () => window.clearInterval(timer);
  }, []);
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim() || loading) return;
    setLoading(true); setError("");
    try {
      const result = await request<{ thread: Thread }>("/api/customer/support", { method: "POST", body: JSON.stringify({ text: text.trim() }) });
      setThread(result.thread); setText("");
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };
  return <section className="rounded-3xl border border-[#dfdbd1] bg-white p-5 shadow-sm" aria-label="Atención al cliente">
    <div className="mb-4 flex items-center gap-3"><MessageCircle className="text-[#315b42]" /><div><h2 className="text-xl font-bold">Atención al cliente</h2><p className="text-sm text-[#6c786f]">Chat directo con el equipo de Herencia</p></div></div>
    {requiresLogin ? <div className="space-y-3"><p>Inicia sesión para escribirnos y consultar tus conversaciones desde cualquier dispositivo.</p><Link className="inline-block rounded-full bg-[#315b42] px-5 py-3 text-white" to="/login">Iniciar sesión</Link></div> : <>
      <div className={`mb-4 space-y-3 overflow-y-auto rounded-2xl bg-[#faf8f3] p-4 ${compact ? "h-56" : "h-80"}`} role="log" aria-live="polite">
        {!thread?.messages?.length && <p className="text-sm text-[#6c786f]">Cuéntanos en qué podemos ayudarte. Una persona de nuestro equipo responderá en este chat.</p>}
        {thread?.messages?.map(m => <div key={m.id} className={`flex ${m.role === "customer" ? "justify-end" : "justify-start"}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm ${m.role === "customer" ? "bg-[#315b42] text-white" : "border bg-white text-[#173126]"}`}><p className="whitespace-pre-wrap break-words">{m.text}</p><time className="mt-1 block text-[10px] opacity-65">{new Date(m.createdAt).toLocaleString("es-ES")}</time></div></div>)}
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
      <form onSubmit={send} className="flex gap-2"><input aria-label="Mensaje para atención al cliente" className="min-w-0 flex-1 rounded-xl border px-3 py-2" maxLength={2000} placeholder="Escribe tu mensaje..." value={text} onChange={e => setText(e.target.value)} /><button disabled={loading || !text.trim()} className="rounded-xl bg-[#315b42] px-4 py-2 text-white disabled:opacity-50" type="submit"><Send size={18}/></button></form>
      <p className="mt-2 text-xs text-[#6c786f]">Atención humana. Te responderemos en cuanto sea posible.</p>
    </>}
  </section>;
}
export function AdminSupport() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const refresh = async () => {
    try { const result = await request<{ threads: Thread[] }>("/api/admin/support"); setThreads(result.threads || []); setError(""); }
    catch (err: any) { setError(err.message); }
  };
  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 12000); return () => window.clearInterval(timer); }, []);
  const active = threads.find(t => t.customerId === selected) || threads[0];
  const send = async (event: React.FormEvent) => {
    event.preventDefault(); if (!active || !text.trim() || loading) return;
    setLoading(true);
    try { await request("/api/admin/support/" + encodeURIComponent(active.customerId), { method: "POST", body: JSON.stringify({ text: text.trim() }) }); setText(""); await refresh(); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };
  return <div className="space-y-4 p-4"><h2 className="text-2xl font-bold">Servicio al cliente · Bandeja de entrada</h2><p>Conversaciones de clientes registrados, conectadas al frontend y a sus cuentas.</p>{error && <p role="alert" className="text-red-700">{error}</p>}<div className="grid gap-4 lg:grid-cols-[300px_1fr]"><aside className="max-h-[65vh] space-y-2 overflow-auto">{threads.length === 0 && <p>No hay conversaciones todavía.</p>}{threads.map(t => <button key={t.customerId} onClick={() => setSelected(t.customerId)} className={`w-full rounded-xl border p-3 text-left ${active?.customerId === t.customerId ? "border-green-800 bg-green-50" : ""}`}><strong className="block">{t.customerName || t.customerEmail}</strong><span className="block truncate text-xs">{t.customerEmail}</span><span className="text-xs">{t.messages?.at(-1)?.text}</span></button>)}</aside><section className="rounded-2xl border p-4">{active ? <><h3 className="font-bold">{active.customerName} · {active.customerEmail}</h3><div className="my-4 h-80 space-y-3 overflow-auto rounded-xl bg-gray-50 p-3">{active.messages.map(m => <div key={m.id} className={`rounded-xl p-3 text-sm ${m.role === "agent" ? "ml-8 bg-green-100" : "mr-8 bg-white"}`}><strong>{m.role === "agent" ? "Herencia" : "Cliente"}</strong><p className="whitespace-pre-wrap">{m.text}</p></div>)}</div><form onSubmit={send} className="flex gap-2"><input aria-label="Responder al cliente" className="min-w-0 flex-1 rounded-xl border p-3" maxLength={2000} value={text} onChange={e => setText(e.target.value)} placeholder="Escribe tu respuesta..." /><button type="submit" disabled={loading || !text.trim()} className="rounded-xl bg-green-900 px-4 text-white">Responder</button></form></> : <p>Selecciona una conversación.</p>}</section></div></div>;
}
