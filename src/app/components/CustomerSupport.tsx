import { type FormEvent, useEffect, useState } from "react";
import { Headphones, MessageCircle, Send, X } from "lucide-react";
import { Link, useLocation } from "react-router";
import { backendStorage } from "../lib/backendStorage";
import { defaultSiteContent, normalizeWhatsAppPhone, parseSiteContent } from "../lib/siteContent";
import { SUPPORT_HANDOFF_DRAFT_KEY } from "../lib/supportHandoff";

type Message = {
  id: string;
  role: "customer" | "agent" | "assistant";
  text: string;
  createdAt: string;
  source?: "account" | "website";
};
type Thread = {
  ticketId?: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  status: "open" | "automated" | "answered" | "resolved";
  messages: Message[];
  updatedAt: string;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "No se pudo conectar con atención al cliente");
  return result as T;
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
}

function roleName(role: Message["role"]) {
  return role === "assistant" ? "Asistente IA" : role === "agent" ? "Equipo Herencia" : "Tú";
}

export function CustomerSupport({ compact = false }: { compact?: boolean }) {
  const location = useLocation();
  const [thread, setThread] = useState<Thread | null>(null);
  const [text, setText] = useState(() => {
    try { return sessionStorage.getItem(SUPPORT_HANDOFF_DRAFT_KEY) || ""; }
    catch { return ""; }
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [allowAI, setAllowAI] = useState(false);

  const refresh = async () => {
    try {
      const result = await request<{ thread: Thread }>("/api/customer/support");
      setThread(result.thread);
      setRequiresLogin(false);
      setError("");
    } catch (err: any) {
      if (/sesión|inicia sesión|session|autentic/i.test(err.message)) {
        setRequiresLogin(true);
        setThread(null);
      } else setError(err.message);
    }
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 12000);
    return () => window.clearInterval(timer);
  }, []);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await request<{ thread: Thread }>("/api/customer/support", {
        method: "POST",
        body: JSON.stringify({
          text: text.trim(),
          allowAI,
          source: location.pathname === "/perfil" ? "account" : "website",
        }),
      });
      setThread(result.thread);
      setText("");
      try { sessionStorage.removeItem(SUPPORT_HANDOFF_DRAFT_KEY); } catch {}
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-3xl border border-[#dfdbd1] bg-white p-4 text-[#173126] shadow-sm sm:p-5" aria-label="Atención al cliente">
      <div className="mb-4 flex items-center gap-3">
        <Headphones className="text-[#315b42]" />
        <div className="min-w-0">
          <h2 className="text-lg font-bold sm:text-xl">Servicio al cliente</h2>
          <p className="text-xs text-[#6c786f]">
            {thread?.ticketId ? thread.ticketId + " · " : ""}Chat conectado con Herencia
          </p>
        </div>
      </div>

      {requiresLogin ? (
        <div className="space-y-3">
          <p className="text-sm">Inicia sesión para escribirnos, recibir respuestas y recuperar la conversación desde tu cuenta.</p>
          <Link className="inline-block rounded-full bg-[#315b42] px-5 py-3 text-sm font-semibold text-white" to="/login">
            Iniciar sesión o registrarme
          </Link>
        </div>
      ) : (
        <>
          <div
            className={"mb-3 space-y-3 overflow-y-auto rounded-2xl bg-[#faf8f3] p-3 sm:p-4 " + (compact ? "h-56" : "h-80")}
            role="log"
            aria-live="polite"
          >
            {!thread?.messages?.length && (
              <div className="space-y-2 text-sm text-[#6c786f]">
                <p>¡Hola! 👋 Estamos aquí para ayudarte con Herencia Market.</p>
                <p>Escríbenos tu consulta. Puedes elegir atención automática para preguntas generales o hablar con nuestro equipo.</p>
              </div>
            )}
            {thread?.messages?.map(message => (
              <div key={message.id} className={"flex " + (message.role === "customer" ? "justify-end" : "justify-start")}>
                <div className={"max-w-[90%] rounded-2xl px-3 py-2.5 text-sm " +
                  (message.role === "customer" ? "bg-[#315b42] text-white" : "border bg-white text-[#173126]")}>
                  <strong className="mb-1 block text-xs">{roleName(message.role)}</strong>
                  <p className="whitespace-pre-wrap break-words">{message.text}</p>
                  <time className="mt-1 block text-[10px] opacity-65">{formatDate(message.createdAt)}</time>
                </div>
              </div>
            ))}
          </div>
          {thread?.status === "resolved" && (
            <p className="mb-2 text-xs text-[#315b42]">Consulta resuelta. Si escribes de nuevo, volveremos a abrirla.</p>
          )}
          {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
          {text.startsWith("Consulta derivada desde") && (
            <p className="mb-2 text-xs text-[#315b42]">Hemos preparado el resumen de tu conversación anterior. Puedes editarlo antes de enviarlo al equipo.</p>
          )}
          <form onSubmit={send}>
            <div className="flex gap-2">
              <textarea
                rows={text.length > 150 ? 4 : 2}
                aria-label="Mensaje para atención al cliente"
                className="min-w-0 flex-1 rounded-xl border border-[#dfdbd1] px-3 py-2 text-sm outline-none focus:border-[#315b42]"
                maxLength={2000}
                placeholder="Cuéntanos qué necesitas..."
                value={text}
                onChange={event => setText(event.target.value)}
              />
              <button
                disabled={loading || !text.trim()}
                className="rounded-xl bg-[#315b42] px-4 py-2 text-white disabled:opacity-50"
                type="submit"
                aria-label="Enviar mensaje"
              >
                <Send size={18} />
              </button>
            </div>
            <label className="mt-3 flex items-start gap-2 text-xs text-[#6c786f]">
              <input type="checkbox" checked={allowAI} onChange={event => setAllowAI(event.target.checked)} className="mt-0.5" />
              <span>Quiero una respuesta automática con IA para preguntas generales. Mi consulta se procesará mediante el proveedor de IA. No incluir datos privados, bancarios ni contraseñas.</span>
            </label>
          </form>
          <p className="mt-2 text-xs text-[#6c786f]">
            Sin marcar la opción de IA, tu mensaje irá directamente al equipo de atención al cliente.
          </p>
        </>
      )}
    </section>
  );
}

export function FloatingCustomerSupport() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const closeOnSales = () => setOpen(false);
    window.addEventListener("herencia:sales-open", closeOnSales);
    return () => window.removeEventListener("herencia:sales-open", closeOnSales);
  }, []);
  const [whatsapp, setWhatsapp] = useState("");
  useEffect(() => {
    const update = () => {
      const site = parseSiteContent(backendStorage.getItem("siteContent"));
      setWhatsapp(normalizeWhatsAppPhone(site.footer.whatsappPhone || defaultSiteContent.footer.whatsappPhone));
    };
    update();
    window.addEventListener("backend-storage", update);
    return () => window.removeEventListener("backend-storage", update);
  }, []);
  if (location.pathname === "/contacto" || location.pathname === "/perfil") return null;
  return (
    <div className="fixed bottom-24 right-4 z-[95] flex flex-col items-end gap-2 sm:right-6">
      {open && (
        <div className="w-[min(370px,calc(100vw-32px))] max-h-[75vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
          <CustomerSupport compact />
          {whatsapp && (
            <a className="block px-5 pb-4 text-center text-xs font-semibold text-[#315b42] underline" href={"https://wa.me/" + whatsapp} target="_blank" rel="noopener noreferrer">
              Alternativa: abrir WhatsApp (conversación externa, no sincronizada)
            </a>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => { if (!open) window.dispatchEvent(new Event("herencia:support-open")); setOpen(value => !value); }}
        aria-label={open ? "Cerrar servicio al cliente" : "Abrir servicio al cliente"}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full bg-[#315b42] px-5 py-3.5 font-bold text-white shadow-xl hover:bg-[#244b36]"
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
        {open ? "Cerrar" : "Atención al cliente"}
      </button>
    </div>
  );
}

export function AdminSupport() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "resolved">("all");

  const refresh = async () => {
    try {
      const result = await request<{ threads: Thread[] }>("/api/admin/support");
      setThreads(result.threads || []);
      setError("");
    } catch (err: any) {
      setError(err.message);
    }
  };
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 12000);
    return () => window.clearInterval(timer);
  }, []);

  const pending = threads.filter(t => t.status === "open").length;
  const filtered = threads.filter(t => filter === "all" || (filter === "resolved" ? t.status === "resolved" : t.status === "open"));
  const active = threads.find(t => t.customerId === selected) || filtered[0] || null;

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!active || !text.trim() || loading) return;
    setLoading(true);
    try {
      await request("/api/admin/support/" + encodeURIComponent(active.customerId), {
        method: "POST", body: JSON.stringify({ text: text.trim() }),
      });
      setText("");
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setStatus = async (status: "open" | "resolved") => {
    if (!active) return;
    setLoading(true);
    try {
      await request("/api/admin/support/" + encodeURIComponent(active.customerId) + "/status", {
        method: "PATCH", body: JSON.stringify({ status }),
      });
      await refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="text-2xl font-bold">Servicio al cliente</h2>
        <p className="text-sm text-muted-foreground">Bandeja central: frontend y cuentas de clientes registrados.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={"rounded-full px-4 py-2 text-sm " + (filter === "all" ? "bg-[#315b42] text-white" : "border")} onClick={() => setFilter("all")}>Todas ({threads.length})</button>
        <button className={"rounded-full px-4 py-2 text-sm " + (filter === "pending" ? "bg-[#315b42] text-white" : "border")} onClick={() => setFilter("pending")}>Pendientes ({pending})</button>
        <button className={"rounded-full px-4 py-2 text-sm " + (filter === "resolved" ? "bg-[#315b42] text-white" : "border")} onClick={() => setFilter("resolved")}>Resueltas</button>
        <button className="rounded-full border px-4 py-2 text-sm" onClick={() => void refresh()}>Actualizar</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <aside className="max-h-[65vh] space-y-2 overflow-auto">
          {filtered.length === 0 && <p className="text-sm text-muted-foreground">No hay conversaciones con este filtro.</p>}
          {filtered.map(thread => (
            <button key={thread.customerId} onClick={() => setSelected(thread.customerId)}
              className={"w-full rounded-xl border p-3 text-left " + (active?.customerId === thread.customerId ? "border-[#315b42] bg-green-50" : "bg-white")}>
              <span className="flex items-center justify-between gap-2"><strong className="block truncate">{thread.customerName || thread.customerEmail}</strong>{thread.status === "open" && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs">Pendiente</span>}</span>
              <span className="block truncate text-xs">{thread.customerEmail}</span>
              <span className="mt-2 block truncate text-xs text-muted-foreground">{thread.messages?.[thread.messages.length - 1]?.text}</span>
              <span className="mt-1 block text-[11px] text-muted-foreground">{formatDate(thread.updatedAt)}</span>
            </button>
          ))}
        </aside>
        <section className="rounded-2xl border bg-white p-4">
          {active ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h3 className="font-bold">{active.customerName}</h3><p className="text-xs">{active.customerEmail} · {active.ticketId || "Consulta"}</p></div>
                <button disabled={loading} className="rounded-full border px-4 py-2 text-xs font-semibold" onClick={() => void setStatus(active.status === "resolved" ? "open" : "resolved")}>
                  {active.status === "resolved" ? "Reabrir" : "Marcar resuelta"}
                </button>
              </div>
              <div className="my-4 h-80 space-y-3 overflow-auto rounded-xl bg-gray-50 p-3" role="log">
                {active.messages.map(message => (
                  <div key={message.id} className={"rounded-xl p-3 text-sm " + (message.role === "agent" ? "ml-8 bg-green-100" : "mr-8 bg-white")}>
                    <strong>{message.role === "agent" ? "Equipo Herencia" : message.role === "assistant" ? "Asistente IA" : "Cliente"}</strong>
                    <p className="whitespace-pre-wrap break-words">{message.text}</p>
                    <time className="mt-1 block text-xs opacity-60">{formatDate(message.createdAt)}</time>
                  </div>
                ))}
              </div>
              <form onSubmit={send} className="flex gap-2">
                <input aria-label="Responder al cliente" className="min-w-0 flex-1 rounded-xl border p-3 text-sm"
                  maxLength={2000} value={text} onChange={event => setText(event.target.value)} placeholder="Escribe tu respuesta..." />
                <button type="submit" disabled={loading || !text.trim()} className="rounded-xl bg-[#315b42] px-4 text-sm text-white disabled:opacity-50">Responder</button>
              </form>
            </>
          ) : <p className="text-sm text-muted-foreground">Selecciona una conversación para responder.</p>}
        </section>
      </div>
    </div>
  );
}
