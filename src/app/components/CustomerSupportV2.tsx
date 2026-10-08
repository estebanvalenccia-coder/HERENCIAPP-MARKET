import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, FileText, Headphones, ImagePlus, Loader2, MessageCircle, Plus, Send, X } from "lucide-react";
import { useLocation } from "react-router";
import { SUPPORT_HANDOFF_DRAFT_KEY } from "../lib/supportHandoff";
import { backendStorage } from "../lib/backendStorage";
import { defaultSiteContent, normalizeWhatsAppPhone, parseSiteContent } from "../lib/siteContent";

type SupportMessage = {
  id: string;
  role: "customer" | "agent" | "assistant";
  text: string;
  createdAt: string;
  attachmentId?: string;
  filename?: string;
  mime?: string;
};
type SupportThread = {
  id: string;
  ticketId: string;
  subject: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  status: string;
  updatedAt: string;
  messages: SupportMessage[];
};
type Actor = { type: "customer" | "guest"; name: string; email: string };
const path = "/api/support/v2";

async function api<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path + endpoint, {
    credentials: "include", cache: "no-store", ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "No se ha podido conectar con Herencia");
  return result as T;
}
function niceDate(value: string) {
  if (!value) return "";
  return new Date(value).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
export function CustomerSupportV2({ compact = false }: { compact?: boolean }) {
  const location = useLocation();
  const [actor, setActor] = useState<Actor | null>(null);
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [name, setName] = useState("");
  const [text, setText] = useState(() => {
    try { return sessionStorage.getItem(SUPPORT_HANDOFF_DRAFT_KEY) || ""; } catch { return ""; }
  });
  const [allowAI, setAllowAI] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputFileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const update = async (quiet = false) => {
    try {
      const response = await api<{ threads: SupportThread[] }>("/tickets");
      const rows = Array.isArray(response.threads) ? response.threads : [];
      setThreads(rows);
      setSelectedId(old => rows.some(t => t.id === old) ? old : rows[0]?.id || "");
      if (!quiet) setError("");
    } catch (cause: any) {
      if (!quiet) setError(cause.message || "Error cargando las conversaciones");
    } finally {
      if (!quiet) setLoading(false);
    }
  };
  useEffect(() => {
    let live = true;
    api<{ actor: Actor }>("/session").then(result => {
      if (live) setActor(result.actor);
      return update();
    }).catch(cause => {
      if (live) { setError(cause.message || "No se pudo iniciar la conversación"); setLoading(false); }
    });
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && live) void update(true);
    }, 4500);
    return () => { live = false; window.clearInterval(timer); };
  }, []);
  const active = threads.find(t => t.id === selectedId) || null;
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [selectedId, active?.messages?.length]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim() || busy) return;
    if (text.length > 2000) return setError("El mensaje supera 2000 caracteres");
    setBusy(true); setError("");
    try {
      let response: {thread: SupportThread};
      if (!active || creating) {
        response = await api<{thread:SupportThread}>("/tickets", {
          method: "POST", body: JSON.stringify({
            subject: subject.trim() || text.trim().slice(0, 55),
            name: actor?.type === "guest" ? name.trim() : undefined,
            text: text.trim(), allowAI,
          }),
        });
      } else {
        response = await api<{thread:SupportThread}>("/tickets/" + encodeURIComponent(active.id) + "/messages", {
          method: "POST", body: JSON.stringify({ text: text.trim(), allowAI }),
        });
      }
      setText(""); setSubject(""); setCreating(false);
      try { sessionStorage.removeItem(SUPPORT_HANDOFF_DRAFT_KEY); } catch {}
      await update(true);
      setSelectedId(response.thread.id);
    } catch (cause: any) { setError(cause.message || "No se ha enviado el mensaje"); }
    finally { setBusy(false); }
  };

  async function attachFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !active || uploading) return;
    if (file.size > 1_500_000) { setError("Archivo demasiado grande. El máximo actual es 1,5 MB."); return; }
    if (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(file.type)) {
      setError("Selecciona una imagen JPG, PNG, WebP o PDF"); return;
    }
    setUploading(true); setError("");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
        reader.readAsDataURL(file);
      });
      const result = await api<{thread:SupportThread}>("/tickets/" + encodeURIComponent(active.id) + "/attachments", {
        method: "POST", body: JSON.stringify({ filename: file.name, dataUrl: base64 }),
      });
      setThreads(rows => rows.map(row => row.id === active.id ? result.thread : row));
      await update(true);
    } catch (cause: any) { setError(cause.message || "No se ha podido adjuntar el archivo"); }
    finally { setUploading(false); if (inputFileRef.current) inputFileRef.current.value = ""; }
  }

  const startNew = () => {
    setCreating(true); setSelectedId("");
    setSubject(""); setText(""); setError("");
  };
  const back = () => { setCreating(false); setSelectedId(active?.id || threads[0]?.id || ""); setError(""); };

  return <section className="overflow-hidden rounded-[24px] border border-[#e2e8df] bg-white text-[#243f30] shadow-[0_8px_35px_rgba(35,70,43,.09)]" aria-label="Atención al cliente">
    <header className="flex items-center justify-between gap-2 border-b border-[#e6ede6] bg-[#f7faf6] px-4 py-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#2c6545] text-white"><Headphones size={19}/></span>
        <div>
          <h2 className="text-lg font-bold">Servicio al cliente</h2>
          <p className="text-xs text-[#6d8573]">{actor?.type === "customer" ? "Tus conversaciones de Herencia" : "Estamos aquí para ayudarte"}</p>
        </div>
      </div>
      {!creating && <button type="button" onClick={startNew} className="flex items-center gap-1 rounded-xl bg-[#28543a] px-3 py-2 text-xs font-bold text-white" aria-label="Nueva consulta"><Plus size={15}/> Nueva</button>}
    </header>
    {loading ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-[#77897b]"><Loader2 className="animate-spin"/> Cargando soporte...</div> : <>
      {!creating && threads.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-b border-[#e9eee8] bg-white px-3 py-2" aria-label="Seleccionar consulta">
          {threads.map(thread=><button type="button" key={thread.id} onClick={()=>setSelectedId(thread.id)}
            className={"shrink-0 rounded-xl border px-3 py-2 text-left text-xs transition " + (selectedId===thread.id ? "border-[#3b7050] bg-[#eaf3e9] text-[#27533a]" : "border-[#e4e9e2] text-[#66806d] hover:bg-[#f7faf5]")}>
            <strong className="block max-w-[170px] truncate">{thread.subject || thread.ticketId}</strong>
            <span className="text-[10px]">{thread.status==="resolved" ? "Resuelta" : thread.status==="open" ? "Pendiente" : "En curso"}</span>
          </button>)}
        </div>
      )}
      {(creating || !active) && <div className="space-y-3 border-b border-[#e9eee8] bg-[#fdfefc] px-4 py-4">
        {threads.length > 0 && <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-[#57765f]" onClick={back}><ArrowLeft size={14}/> Volver</button>}
        <h3 className="font-semibold">¿En qué podemos ayudarte?</h3>
        <input aria-label="Asunto de la consulta" maxLength={100} value={subject} onChange={e=>setSubject(e.target.value)}
          className="w-full rounded-xl border border-[#e0e8dc] px-3 py-2 text-sm" placeholder="Asunto (por ejemplo: entrega de pedido)"/>
        {actor?.type==="guest" && <input aria-label="Tu nombre" maxLength={70} value={name} onChange={e=>setName(e.target.value)}
          className="w-full rounded-xl border border-[#e0e8dc] px-3 py-2 text-sm" placeholder="Tu nombre (opcional)"/>}
        {actor?.type==="guest" && <p className="text-xs leading-5 text-[#758b78]">
          Puedes consultar sin registrarte. Guardaremos el chat en este navegador durante 30 días. Para consultar datos privados de pedidos, inicia sesión con tu cuenta.
        </p>}
      </div>}
      {active && !creating && <>
        <div className="flex items-center justify-between gap-2 bg-[#fcfdfa] px-4 py-2 text-xs text-[#859688]">
          <span>{active.ticketId} · {active.subject || "Consulta"}</span>
          <span>{active.status==="resolved"?"Resuelta":active.status==="open"?"Pendiente":"En curso"}</span>
        </div>
        <div className={(compact?"h-52":"h-72") + " space-y-3 overflow-y-auto bg-[#f9fbf7] px-4 py-4"} role="log" aria-live="polite">
          {active.messages.filter(m=>m.role!=="internal").map(message=>(
            <div key={message.id} className={"flex " + (message.role==="customer"?"justify-end":"justify-start")}>
              <div className={"max-w-[88%] rounded-2xl px-3 py-2 text-sm shadow-sm " +
                (message.role==="customer"?"bg-[#315e43] text-white":"border border-[#dfe9df] bg-white")}>
                <p className="mb-1 text-[10px] font-bold opacity-75">{message.role==="customer"?"Tú":message.role==="assistant"?"Asistente Herencia":"Equipo Herencia"}</p>
                <p className="whitespace-pre-wrap break-words leading-5">{message.text}</p>
                {message.attachmentId && <a className="mt-2 inline-flex items-center gap-2 text-xs underline" target="_blank" rel="noopener noreferrer"
                  href={path+"/tickets/"+encodeURIComponent(active.id)+"/attachments/"+encodeURIComponent(message.attachmentId)}>
                  <FileText size={15}/> {message.filename || "Ver adjunto"}
                </a>}
                <time className="mt-1 block text-right text-[10px] opacity-60">{niceDate(message.createdAt)}</time>
              </div>
            </div>
          ))}
          <div ref={bottomRef}/>
        </div>
      </>}
      {error && <p className="mx-4 my-2 rounded-lg bg-red-50 p-2 text-xs text-red-700" role="alert">{error}</p>}
      <form onSubmit={send} className="space-y-3 border-t border-[#ebf0e9] bg-white px-4 py-4">
        <div className="flex items-end gap-2">
          <textarea aria-label="Escribe un mensaje al servicio de atención" maxLength={2000} rows={2} value={text} onChange={e=>setText(e.target.value)}
            placeholder={creating||!active?"Describe tu consulta...":"Escribe un mensaje..."} className="min-h-[55px] min-w-0 flex-1 rounded-xl border border-[#e2e9e1] px-3 py-2 text-sm outline-none focus:border-[#49825b]"/>
          {active && !creating && <>
            <input type="file" hidden ref={inputFileRef} onChange={attachFile} accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"/>
            <button type="button" disabled={uploading} onClick={()=>inputFileRef.current?.click()} className="grid h-11 w-11 place-items-center rounded-xl border border-[#e0e7df] text-[#4c7957] disabled:opacity-50" aria-label="Adjuntar imagen o PDF">
              {uploading?<Loader2 size={17} className="animate-spin"/>:<ImagePlus size={19}/>}
            </button>
          </>}
          <button type="submit" disabled={busy || !text.trim()} className="grid h-11 w-11 place-items-center rounded-xl bg-[#285c3e] text-white disabled:opacity-50" aria-label="Enviar mensaje">
            {busy?<Loader2 className="animate-spin" size={19}/>:<Send size={19}/>}
          </button>
        </div>
        <label className="flex items-start gap-2 text-[11px] leading-4 text-[#738779]">
          <input className="mt-0.5" type="checkbox" checked={allowAI} onChange={e=>setAllowAI(e.target.checked)}/>
          <span>Quiero recibir una respuesta automática con IA para preguntas generales; entiendo que el texto de mi consulta se enviará al proveedor de IA. No incluyas datos bancarios ni contraseñas.</span>
        </label>
        {active && <p className="text-[11px] text-[#8ca091]">Puedes adjuntar JPG, PNG, WebP o PDF de hasta 1,5 MB. Solo los participantes autorizados pueden abrirlos.</p>}
      </form>
    </>}
  </section>;
}

export function FloatingCustomerSupportV2() {
  const location=useLocation();
  const [open,setOpen]=useState(false);
  const [whatsapp,setWhatsapp]=useState("");
  useEffect(()=>{
    const close=()=>setOpen(false);
    window.addEventListener("herencia:sales-open",close);
    return ()=>window.removeEventListener("herencia:sales-open",close);
  },[]);
  useEffect(()=>{
    const site=parseSiteContent(backendStorage.getItem("siteContent"));
    setWhatsapp(normalizeWhatsAppPhone(site.footer.whatsappPhone || defaultSiteContent.footer.whatsappPhone));
  },[]);
  if(["/contacto","/perfil"].includes(location.pathname))return null;
  return <div className="fixed bottom-24 right-4 z-[95] flex flex-col items-end gap-2 sm:right-6">
    {open && <div className="max-h-[78vh] w-[min(400px,calc(100vw-32px))] overflow-y-auto rounded-[25px] bg-white shadow-2xl">
      <CustomerSupportV2 compact/>
      {whatsapp && <a href={"https://wa.me/"+whatsapp} target="_blank" rel="noopener noreferrer"
        className="block px-4 py-3 text-center text-xs font-semibold text-[#376247] underline">
        WhatsApp como alternativa (chat externo no sincronizado)
      </a>}
    </div>}
    <button type="button" onClick={()=>{if(!open)window.dispatchEvent(new Event("herencia:support-open"));setOpen(!open);}}
      className="flex items-center gap-2 rounded-full bg-[#315b42] px-5 py-3.5 font-bold text-white shadow-xl"
      aria-label={open?"Cerrar atención al cliente":"Abrir atención al cliente"} aria-expanded={open}>
      {open?<X size={20}/>:<MessageCircle size={20}/>} {open?"Cerrar":"Atención al cliente"}
    </button>
  </div>;
}
