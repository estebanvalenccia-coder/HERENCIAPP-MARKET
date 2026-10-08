import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, ArrowRight, Bell, BellRing, Check, CheckCheck, CircleHelp,
  Clock3, Headphones, Inbox, Loader2, Mail, MessageCircle, Package,
  RefreshCcw, Search, Send, ShieldCheck, SlidersHorizontal, Sparkles,
  Ticket, Trash2, UserRound, X,
} from "lucide-react";
import { backendApi } from "../../lib/backendStorage";
import { AdminSupportKnowledge } from "./AdminSupportKnowledge";

type SupportStatus = "open" | "answered" | "automated" | "handoff" | "resolved";
type SupportPriority = "low" | "normal" | "high" | "urgent";
type SupportCategory = "general" | "orders" | "delivery" | "refunds" | "products" | "services" | "other";
type SupportMessage = {
  id: string;
  role: "customer" | "agent" | "assistant";
  text: string;
  createdAt: string;
  source?: string;
  attachmentId?: string;
  filename?: string;
  mime?: string;
};
type SupportThread = {
  id: string;
  ownerType?: "guest" | "customer";
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  ticketId?: string;
  status: SupportStatus;
  humanRequested?: boolean;
  priority?: SupportPriority;
  category?: SupportCategory;
  updatedAt: string;
  messages: SupportMessage[];
};
type Order = {
  id?: string;
  customerEmail?: string;
  customerName?: string;
  status?: string;
  total?: number;
  date?: string;
  createdAt?: string;
};

type Filter = "all" | "open" | "progress" | "resolved";
type AutomationSettings = { assistantEnabled: boolean; orderLookupEnabled: boolean };

const categories: Array<{ value: SupportCategory; label: string }> = [
  { value: "general", label: "Consulta general" },
  { value: "orders", label: "Pedidos" },
  { value: "delivery", label: "Envíos" },
  { value: "refunds", label: "Devoluciones" },
  { value: "products", label: "Productos y plantas" },
  { value: "services", label: "Servicios" },
  { value: "other", label: "Otros" },
];

const priorities: Array<{ value: SupportPriority; label: string }> = [
  { value: "low", label: "Baja" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const quickReplies = [
  { label: "Saludo", content: "¡Hola! Gracias por escribir a Herencia Market. Estoy revisando tu consulta y te ayudaré encantado." },
  { label: "Pedido", content: "Gracias por contactar. Voy a comprobar el estado de tu pedido y te confirmo la información en este chat." },
  { label: "Incidencia", content: "Lamento la incidencia. ¿Puedes indicarnos qué ha ocurrido y, si corresponde, el número de pedido? Lo revisaremos personalmente." },
  { label: "Despedida", content: "Gracias por contactar con Herencia Market. Si necesitas cualquier otra cosa, estaremos encantados de ayudarte." },
];

const statusLabels: Record<SupportStatus, string> = {
  open: "Pendiente · equipo", answered: "En curso", automated: "IA atendida", handoff: "IA · pendiente de confirmación", resolved: "Resuelto",
};
const priorityColors: Record<SupportPriority, string> = {
  low: "bg-slate-100 text-slate-600",
  normal: "bg-blue-50 text-blue-700",
  high: "bg-amber-50 text-amber-700",
  urgent: "bg-rose-50 text-rose-700",
};

async function supportFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include", cache: "no-store", ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "No se pudo conectar con el servicio de atención");
  return payload as T;
}

function formatTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(date);
}
function fullDate(value: string) {
  return value ? new Date(value).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }) : "";
}
function firstLetters(name: string) {
  return (name || "Cliente").trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("");
}
function money(value: unknown) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}
function statusPill(status: SupportStatus) {
  if (status === "open") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (status === "handoff") return "bg-violet-50 text-violet-700 ring-violet-200";
  if (status === "resolved") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return "bg-blue-50 text-blue-700 ring-blue-200";
}

function SupportCard({
  value, label, icon: Icon, sub, accent,
}: { value: number; label: string; icon: typeof Inbox; sub: string; accent: string }) {
  return (
    <div className="rounded-[22px] border border-[#e9e7df] bg-white px-5 py-4 shadow-[0_6px_22px_rgba(30,56,40,.035)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.1em] text-[#818b83]">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-[#203e2d] tabular-nums">{value}</p>
        </div>
        <span className={"grid h-11 w-11 place-items-center rounded-2xl " + accent}>
          <Icon size={21} />
        </span>
      </div>
      <p className="mt-2 text-xs text-[#889288]">{sub}</p>
    </div>
  );
}

export function AdminSupportPro() {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [filter, setFilter] = useState<Filter>("all");
  const [priorityFilter, setPriorityFilter] = useState<SupportPriority | "all">("all");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [draft, setDraft] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; ticketId: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showCustomerDetails, setShowCustomerDetails] = useState(true);
  const [automation, setAutomation] = useState<AutomationSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const seenMessageRef = useRef<Record<string, string>>({});
  const firstLoadRef = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = async (quiet = false) => {
    try {
      const response = await supportFetch<{ threads: SupportThread[] }>("/api/admin/support/v2/tickets");
      const rows = Array.isArray(response.threads) ? response.threads : [];
      if (!firstLoadRef.current && notificationsEnabled) {
        for (const row of rows) {
          const last = row.messages?.[row.messages.length - 1];
          const previous = seenMessageRef.current[row.id];
          if (previous && last && previous !== last.id && last.role === "customer" &&
              typeof Notification !== "undefined" && Notification.permission === "granted") {
            new Notification("Nuevo mensaje · Herencia", {
              body: (row.customerName || "Cliente") + ": " + last.text.slice(0, 110),
              tag: "herencia-support-" + row.id,
            });
          }
        }
      }
      seenMessageRef.current = Object.fromEntries(rows.map(row => [
        row.id, row.messages?.[row.messages.length - 1]?.id || "",
      ]));
      firstLoadRef.current = false;
      setThreads(rows);
      setError("");
    } catch (cause: any) {
      if (!quiet) setError(cause?.message || "No se pudo cargar la bandeja");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    supportFetch<{settings:AutomationSettings}>("/api/admin/support/v2/settings")
      .then(result => setAutomation(result.settings))
      .catch(cause => setError(cause.message || "No se pudo cargar la configuración de IA"));
    backendApi.listOrders().then(result => {
      setOrders(Array.isArray(result.orders) ? result.orders : []);
    }).catch(() => {});
    // EventSource updates are immediate when the server supports streaming.
    // Periodic refresh remains as a fallback after a disconnect.
    const eventSource = typeof EventSource !== "undefined" ? new EventSource("/api/admin/support/v2/events", { withCredentials: true }) : null;
    eventSource?.addEventListener("update", () => {
      if (document.visibilityState === "visible") void refresh(true);
    });
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, 20000);
    return () => { eventSource?.close(); window.clearInterval(timer); };
  }, [notificationsEnabled]);

  async function updateAutomation(key: keyof AutomationSettings, value: boolean) {
    if (!automation || savingSettings) return;
    setSavingSettings(true);
    try {
      const response=await supportFetch<{settings:AutomationSettings}>("/api/admin/support/v2/settings", {
        method:"PATCH",
        body:JSON.stringify({[key]:value}),
      });
      setAutomation(response.settings);
      setError("");
    } catch (cause:any) {
      setError(cause.message || "No se pudo guardar la configuración de Herencia IA");
    } finally { setSavingSettings(false); }
  }

  const counts = useMemo(() => ({
    all: threads.length,
    open: threads.filter(t => t.status === "open").length,
    progress: threads.filter(t => t.status === "answered" || t.status === "automated" || t.status === "handoff").length,
    resolved: threads.filter(t => t.status === "resolved").length,
  }), [threads]);

  const operations = useMemo(() => {
    const now = Date.now();
    const handoffs = threads.filter(t => t.humanRequested === true && t.status !== "resolved");
    const awaiting = handoffs.filter(t => !t.messages.some(m => m.role === "agent"));
    const overdue = awaiting.filter(t => {
      const lastCustomer = [...t.messages].reverse().find(m => m.role === "customer");
      const timestamp = Date.parse(lastCustomer?.createdAt || t.updatedAt);
      return Number.isFinite(timestamp) && now - timestamp > 60 * 60 * 1000;
    });
    const automated = threads.filter(t => t.status === "automated").length;
    const total = threads.length;
    return {handoffs:handoffs.length, awaiting:awaiting.length, overdue:overdue.length,
      automated, automatedRate:total ? Math.round(automated / total * 100) : 0};
  }, [threads]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return threads.filter(thread => {
      if (filter === "open" && thread.status !== "open") return false;
      if (filter === "progress" && !["answered", "automated", "handoff"].includes(thread.status)) return false;
      if (filter === "resolved" && thread.status !== "resolved") return false;
      if (priorityFilter !== "all" && (thread.priority || "normal") !== priorityFilter) return false;
      if (!normalized) return true;
      return [
        thread.customerName, thread.customerEmail, thread.ticketId,
        thread.category, ...thread.messages.slice(-10).map(message => message.text),
      ].some(item => String(item || "").toLowerCase().includes(normalized));
    });
  }, [threads, filter, priorityFilter, query]);

  const active = filtered.find(t => t.id === selectedId) || filtered[0] || null;
  const activeOrders = useMemo(() => active ? orders.filter(order =>
    active.ownerType !== "guest" && String(order.customerEmail || "").toLowerCase().trim() ===
    String(active.customerEmail || "").toLowerCase().trim()
  ).slice(0, 5) : [], [active?.customerEmail, orders]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [active?.id, active?.messages?.length]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!active || !draft.trim() || busy) return;
    setBusy(true);
    try {
      const response = await supportFetch<{ thread: SupportThread }>("/api/admin/support/v2/tickets/" + encodeURIComponent(active.id), {
        method: "POST", body: JSON.stringify({ text: draft.trim(), internal: internalNote }),
      });
      setDraft("");
      setInternalNote(false);
      setThreads(current => current.map(t => t.id === active.id ? response.thread : t));
      await refresh(true);
    } catch (cause: any) {
      setError(cause.message || "No se pudo enviar la respuesta");
    } finally { setBusy(false); }
  };

  const setStatus = async (status: "open" | "resolved") => {
    if (!active || busy) return;
    setBusy(true);
    try {
      const response = await supportFetch<{ thread: SupportThread }>(
        "/api/admin/support/v2/tickets/" + encodeURIComponent(active.id),
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      setThreads(current => current.map(t => t.id === active.id ? response.thread : t));
      await refresh(true);
    } catch (cause: any) { setError(cause.message || "No se pudo cambiar el estado"); }
    finally { setBusy(false); }
  };

  const deleteConversation = async () => {
    if (!deleteTarget || busy) return;
    const target = deleteTarget;
    setBusy(true);
    setError("");
    try {
      await supportFetch<{ ok: boolean; deletedId: string }>(
        "/api/admin/support/v2/tickets/" + encodeURIComponent(target.id),
        { method: "DELETE" },
      );
      setThreads(current => current.filter(thread => thread.id !== target.id));
      setSelectedId(current => current === target.id ? "" : current);
      delete seenMessageRef.current[target.id];
      setDraft("");
      setInternalNote(false);
      setDeleteTarget(null);
      await refresh(true);
    } catch (cause: any) {
      setError(cause.message || "No se pudo eliminar la conversación.");
    } finally {
      setBusy(false);
    }
  };

  const updateMeta = async (change: Partial<Pick<SupportThread, "priority" | "category">>) => {
    if (!active || busy) return;
    setBusy(true);
    try {
      const response = await supportFetch<{ thread: SupportThread }>(
        "/api/admin/support/v2/tickets/" + encodeURIComponent(active.id),
        { method: "PATCH", body: JSON.stringify(change) },
      );
      setThreads(current => current.map(t => t.id === active.id ? response.thread : t));
    } catch (cause: any) { setError(cause.message || "No se pudo actualizar la consulta"); }
    finally { setBusy(false); }
  };

  const enableNotifications = async () => {
    if (typeof Notification === "undefined") return setError("Este navegador no permite notificaciones.");
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === "granted");
    if (permission !== "granted") setError("Para recibir avisos, habilita las notificaciones del navegador.");
    else setError("");
  };

  return (
    <div className="min-h-[calc(100vh-120px)] bg-[#fafaf7] p-3 text-[#263d2c] sm:p-6 lg:p-8">
      {deleteTarget && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/55 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="support-delete-title" aria-describedby="support-delete-description"
            className="w-full max-w-md rounded-2xl border border-[#f0d4d4] bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-xl bg-red-50 p-3 text-red-700"><Trash2 size={22}/></span>
              <h2 id="support-delete-title" className="text-xl font-bold text-[#852727]">¿Eliminar esta conversación?</h2>
            </div>
            <p id="support-delete-description" className="text-sm leading-6 text-[#536057]">
              Se borrarán permanentemente todos los mensajes y archivos adjuntos de esta consulta de
              <strong> {deleteTarget.name}</strong> ({deleteTarget.ticketId}). Esta acción no se puede deshacer.
            </p>
            <p className="mt-3 rounded-lg bg-[#f3f6f1] p-3 text-xs font-medium text-[#43614b]">
              Los pedidos y la ficha del cliente no se eliminarán.
            </p>
            {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button type="button" disabled={busy} onClick={() => { setDeleteTarget(null); setError(""); }}
                className="rounded-xl border border-[#dde6dc] px-4 py-3 text-sm font-bold text-[#355442] hover:bg-[#f5f8f4] disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" disabled={busy} onClick={() => void deleteConversation()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#b32626] px-4 py-3 text-sm font-bold text-white hover:bg-[#8f2020] disabled:opacity-50">
                {busy ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16}/>}
                {busy ? "Eliminando…" : "Sí, eliminar chat"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-[1550px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.17em] text-[#74907c]">
              <span className="h-2 w-2 rounded-full bg-[#69a179]" />
              HERENCIA MARKET · SOPORTE
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#1b3828] sm:text-4xl">Servicio al cliente</h1>
            <p className="mt-2 text-sm text-[#7b887e]">Gestiona consultas, responde mensajes y acompaña a tus clientes desde una sola bandeja.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-xl border border-[#e4e9e1] bg-white px-4 py-2.5 text-sm font-semibold text-[#3c5947] shadow-sm hover:bg-[#f5f8f3]">
              <RefreshCcw size={16} /> Actualizar
            </button>
            <button onClick={() => void enableNotifications()} className={"inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm " + (notificationsEnabled ? "bg-[#e8f5ec] text-[#245c39]" : "bg-[#214d34] text-white hover:bg-[#153c29]")}>
              {notificationsEnabled ? <BellRing size={16}/> : <Bell size={16}/>}
              {notificationsEnabled ? "Avisos activos" : "Activar avisos"}
            </button>
          </div>
        </div>

        <div className="rounded-[22px] border border-[#dce8dc] bg-[#f5faf4] px-4 py-4 shadow-sm sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-[#356749]"/>
              <div>
                <h2 className="text-sm font-bold text-[#254c33]">Inteligencia de Atención</h2>
                <p className="text-xs text-[#76917a]">Controla cómo Herencia IA atiende a tus clientes.</p>
              </div>
            </div>
            <button type="button" onClick={() => setSettingsOpen(open => !open)}
              aria-expanded={settingsOpen} className="rounded-xl border border-[#c9dccb] bg-white px-3 py-2 text-xs font-bold text-[#31583c] hover:bg-[#eaf4e9]">
              {settingsOpen ? "Ocultar configuración" : "Configurar IA"}
            </button>
          </div>
          {settingsOpen && (
            <div className="mt-4 grid gap-3 border-t border-[#dce8dc] pt-4 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#dce9dd] bg-white p-4">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#2b6041]"
                  checked={automation?.assistantEnabled ?? true}
                  disabled={!automation || savingSettings}
                  onChange={event => void updateAutomation("assistantEnabled", event.target.checked)} />
                <span><strong className="block text-sm text-[#2c533b]">Herencia IA atiende automáticamente</strong>
                  <small className="mt-1 block text-xs leading-5 text-[#758a78]">La IA intenta resolver. Si la desactivas, las nuevas consultas pasan directamente al equipo humano.</small></span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#dce9dd] bg-white p-4">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#2b6041]"
                  checked={automation?.orderLookupEnabled ?? true}
                  disabled={!automation || savingSettings}
                  onChange={event => void updateAutomation("orderLookupEnabled", event.target.checked)}/>
                <span><strong className="block text-sm text-[#2c533b]">Consultar estados de pedidos reales</strong>
                  <small className="mt-1 block text-xs leading-5 text-[#758a78]">Solo los pedidos de clientes identificados, desde el servidor. No se envían datos del pedido al proveedor de IA.</small></span>
              </label>
              <div className="flex items-start gap-3 rounded-xl border border-[#dce9dd] bg-white p-4 sm:col-span-2">
                <input type="checkbox" checked disabled className="mt-0.5 h-4 w-4 accent-[#2b6041]"/>
                <div>
                  <strong className="block text-sm text-[#2c533b]">Aprobación humana para reembolsos</strong>
                  <p className="mt-1 text-xs leading-5 text-[#758a78]">Protección obligatoria: Herencia IA puede orientar, pero nunca autoriza ni ejecuta reembolsos. Amigo Plantil interviene cuando sea necesario.</p>
                </div>
              </div>
              <AdminSupportKnowledge />
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <SupportCard value={counts.open} label="Pendientes" icon={Inbox} sub="Necesitan una respuesta" accent="bg-[#fff5e6] text-[#b47824]" />
          <SupportCard value={counts.progress} label="En curso" icon={MessageCircle} sub="Con respuesta o asistencia IA" accent="bg-[#eaf2fe] text-[#4676b8]" />
          <SupportCard value={counts.resolved} label="Resueltos" icon={CheckCheck} sub="Consultas finalizadas" accent="bg-[#eaf5ed] text-[#417c58]" />
        </div>

        <div className="grid gap-3 sm:grid-cols-3" aria-label="Indicadores de atención al cliente">
          <SupportCard value={operations.awaiting} label="Esperando a Plantil" icon={Headphones} sub="Derivaciones sin primera respuesta humana" accent="bg-[#fff5e6] text-[#b47824]" />
          <SupportCard value={operations.overdue} label="Más de una hora" icon={Clock3} sub="Derivaciones pendientes de respuesta" accent="bg-[#fce9e7] text-[#b55349]" />
          <SupportCard value={operations.automatedRate} label="IA en curso (%)" icon={Sparkles} sub={`${operations.automated} de ${threads.length} conversaciones; no equivale a casos resueltos`} accent="bg-[#eaf5ed] text-[#417c58]" />
        </div>
        {operations.overdue > 0 && (
          <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            Hay {operations.overdue} {operations.overdue === 1 ? "conversación" : "conversaciones"} esperando atención humana desde hace más de una hora. Revisa las pendientes de Amigo Plantil.
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span className="flex items-center gap-2"><AlertCircle size={18}/>{error}</span>
            <button type="button" aria-label="Cerrar aviso" onClick={() => setError("")}><X size={18}/></button>
          </div>
        )}

        <div className="overflow-hidden rounded-[24px] border border-[#e6e9e3] bg-white shadow-[0_10px_50px_rgba(26,54,36,.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9eee8] px-4 py-4 sm:px-6">
            <div className="flex items-center gap-2">
              <Headphones className="text-[#406a50]" size={19}/>
              <h2 className="font-semibold text-[#253e2c]">Bandeja de conversaciones</h2>
              <span className="rounded-full bg-[#eff4ee] px-2.5 py-0.5 text-xs font-bold text-[#557361]">{counts.all}</span>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-[#8b978f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#68aa7b]"/> Actualización automática
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-[#edf0eb] px-4 py-3 sm:px-6">
            {([
              ["all", "Todas", counts.all],
              ["open", "Pendientes", counts.open],
              ["progress", "En curso", counts.progress],
              ["resolved", "Resueltas", counts.resolved],
            ] as const).map(([value, label, count]) => (
              <button type="button" key={value} onClick={() => { setFilter(value); setSelectedId(""); }}
                className={"rounded-xl px-3 py-2 text-xs font-semibold transition sm:text-sm " +
                  (filter === value ? "bg-[#234b35] text-white" : "text-[#728277] hover:bg-[#f3f6f1]")}>
                {label} <span className="opacity-70">{count}</span>
              </button>
            ))}
          </div>

          <div className={"grid min-h-[560px] " + (showCustomerDetails ? "lg:grid-cols-[290px_minmax(0,1fr)_255px] xl:grid-cols-[320px_minmax(0,1fr)_275px]" : "lg:grid-cols-[320px_minmax(0,1fr)]")}>
            <aside className="flex min-w-0 flex-col border-b border-[#e7ece6] lg:border-b-0 lg:border-r">
              <div className="space-y-2 border-b border-[#edf0eb] p-3 sm:p-4">
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#91a094]" size={16}/>
                    <input aria-label="Buscar conversaciones" className="h-10 w-full rounded-xl border border-[#e3e8e2] bg-[#fafbf8] pl-9 pr-3 text-sm outline-none focus:border-[#6b9676]" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar clientes, tickets..." />
                  </div>
                  <button type="button" onClick={() => setShowFilters(v=>!v)} aria-label="Filtrar por prioridad" className="grid h-10 w-10 place-items-center rounded-xl border border-[#e3e8e2] hover:bg-[#f5f8f5]"><SlidersHorizontal size={18}/></button>
                </div>
                {showFilters && (
                  <label className="flex items-center gap-2 text-xs text-[#6e8174]">
                    Prioridad
                    <select aria-label="Filtrar por prioridad" className="min-w-0 flex-1 rounded-lg border p-2" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as SupportPriority | "all")}>
                      <option value="all">Todas las prioridades</option>
                      {priorities.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </label>
                )}
              </div>

              <div className="max-h-[620px] min-h-[300px] flex-1 overflow-y-auto">
                {loading && <div className="flex items-center gap-2 p-5 text-sm text-[#748776]"><Loader2 size={18} className="animate-spin"/> Cargando conversaciones...</div>}
                {!loading && filtered.length === 0 && (
                  <div className="p-6 text-center text-[#819184]">
                    <CircleHelp className="mx-auto mb-2 opacity-50" size={26}/>
                    <p className="text-sm font-semibold">No hay conversaciones</p>
                    <p className="mt-1 text-xs">Prueba con otro filtro o espera una nueva consulta.</p>
                  </div>
                )}
                {filtered.map(thread => {
                  const last = thread.messages?.[thread.messages.length - 1];
                  const priority = thread.priority || "normal";
                  const selected = active?.id === thread.id;
                  return (
                    <button key={thread.id} type="button" onClick={() => { setSelectedId(thread.id); setDraft(""); }}
                      className={"flex w-full gap-3 border-b border-[#edf0eb] px-3 py-4 text-left transition sm:px-4 " +
                        (selected ? "bg-[#f0f6f0] shadow-[inset_3px_0_0_#4c8060]" : "hover:bg-[#fafbf8]")}>
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e7eee8] text-sm font-bold text-[#3f6a4b]">{firstLetters(thread.customerName)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="truncate text-sm text-[#294432]">{thread.customerName || thread.customerEmail || "Cliente"}</strong>
                          <span className="shrink-0 text-[11px] text-[#99a29a]">{formatTime(thread.updatedAt)}</span>
                        </div>
                        <p className="mt-1 truncate text-xs text-[#7c8a80]">{last?.text || "Sin mensajes todavía"}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className={"rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset " + statusPill(thread.status)}>{statusLabels[thread.status] || "Consulta"}</span>
                          {["urgent","high"].includes(priority) && (
                            <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold " + priorityColors[priority]}>{priority === "urgent" ? "Urgente" : "Alta prioridad"}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="flex min-w-0 flex-col bg-[#fffefd]">
              {!active ? (
                <div className="flex min-h-[450px] flex-1 flex-col items-center justify-center px-6 text-center text-[#829187]">
                  <span className="mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-[#edf4ec] text-[#63866d]"><MessageCircle size={34}/></span>
                  <h3 className="text-lg font-semibold text-[#355642]">Tus conversaciones aparecerán aquí</h3>
                  <p className="mt-2 max-w-xs text-sm">Selecciona un cliente de la bandeja para ver los mensajes y responder.</p>
                </div>
              ) : (
                <>
                  <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#edf0eb] px-4 py-4 sm:px-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#eaf3eb] font-bold text-[#447154]">{firstLetters(active.customerName)}</div>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-[#254332]">{active.customerName || "Cliente"}</h3>
                        <p className="truncate text-xs text-[#87968b]">{active.ticketId || "Consulta"} · {active.customerEmail}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setShowCustomerDetails(v=>!v)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#e5ebe4] px-3 py-2 text-xs font-semibold text-[#4a6e55] hover:bg-[#f5f8f4]">
                        <UserRound size={14}/> {showCustomerDetails ? "Ocultar cliente" : "Ver cliente"}
                      </button>
                      <button type="button" disabled={busy} onClick={() => { setError(""); setDeleteTarget({ id: active.id, ticketId: active.ticketId || active.id, name: active.customerName || "Cliente" }); }}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#f1c5c5] px-3 py-2 text-xs font-semibold text-[#a93636] hover:bg-[#fff1f1] disabled:opacity-50" title="Eliminar permanentemente la conversación">
                        <Trash2 size={14}/> Eliminar chat
                      </button>
                      <button disabled={busy} type="button" onClick={() => void setStatus(active.status === "resolved" ? "open" : "resolved")}
                        className={"inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50 " +
                          (active.status === "resolved" ? "border border-[#dfe8df] text-[#466951]" : "bg-[#244b35] text-white hover:bg-[#183a29]")}>
                        <Check size={15}/> {active.status === "resolved" ? "Reabrir" : "Resolver"}
                      </button>
                    </div>
                  </header>

                  <div className="flex flex-wrap items-center gap-3 border-b border-[#edf0eb] bg-[#fcfdfb] px-4 py-3 text-xs">
                    <span className={"rounded-full px-2.5 py-1 font-semibold ring-1 ring-inset " + statusPill(active.status)}>{statusLabels[active.status] || "Consulta"}</span>
                    <label className="flex items-center gap-2 text-[#718376]">Prioridad
                      <select aria-label="Prioridad del ticket" disabled={busy} value={active.priority || "normal"} onChange={e => void updateMeta({ priority: e.target.value as SupportPriority })}
                        className="rounded-lg border border-[#e2e9e0] bg-white p-1.5 text-xs font-semibold text-[#335340]">
                        {priorities.map(priority=><option key={priority.value} value={priority.value}>{priority.label}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-[#718376]">Categoría
                      <select aria-label="Categoría del ticket" disabled={busy} value={active.category || "general"} onChange={e => void updateMeta({ category: e.target.value as SupportCategory })}
                        className="max-w-[145px] rounded-lg border border-[#e2e9e0] bg-white p-1.5 text-xs font-semibold text-[#335340]">
                        {categories.map(category=><option key={category.value} value={category.value}>{category.label}</option>)}
                      </select>
                    </label>
                  </div>

                  <div className="h-[360px] flex-1 space-y-4 overflow-y-auto bg-[linear-gradient(180deg,#f9fbf8,#ffffff)] px-4 py-5 sm:px-6">
                    {active.messages.length === 0 && <p className="text-center text-sm text-[#8b968b]">Todavía no hay mensajes.</p>}
                    {active.messages.map(message=> (
                      <div key={message.id} className={"flex " + (message.role === "agent" || message.role === "internal" ? "justify-end" : "justify-start")}>
                        <div className={"max-w-[85%] rounded-2xl px-4 py-3 shadow-sm " +
                          (message.role === "internal" ? "border border-amber-200 bg-amber-50 text-amber-900" : message.role === "agent" ? "bg-[#2e5a40] text-white" :
                            message.role === "assistant" ? "border border-[#d6e6e2] bg-[#eef7f4] text-[#264536]" :
                            "border border-[#e9ede6] bg-white text-[#324a37]")}>
                          <span className={"mb-1 flex items-center gap-1.5 text-[11px] font-semibold " + (message.role === "agent" ? "text-[#deeadf]" : "text-[#71917b]")}>
                            {message.role === "assistant" ? <Sparkles size={13}/> : message.role === "agent" ? <Headphones size={13}/> : <UserRound size={13}/>}
                            {message.role === "internal" ? "Nota interna · solo Administración" : message.role === "agent" ? "Equipo Herencia" : message.role === "assistant" ? "Herencia IA" : active.customerName || "Cliente"}
                          </span>
                          <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
                          {message.attachmentId && (
                            <a href={"/api/support/v2/tickets/" + encodeURIComponent(active.id) + "/attachments/" + encodeURIComponent(message.attachmentId)}
                               target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 text-xs font-semibold underline">
                              <Package size={14}/> {message.filename || "Abrir archivo adjunto"}
                            </a>
                          )}
                          <time className={"mt-2 block text-right text-[10px] " + (message.role === "agent" ? "text-[#d3e4d7]" : "text-[#98a69b]")}>{fullDate(message.createdAt)}</time>
                        </div>
                      </div>
                    ))}
                    <div ref={bottomRef}/>
                  </div>

                  <div className="border-t border-[#edf0eb] bg-white px-4 py-4 sm:px-5">
                    <div className="mb-3 flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-[11px] font-semibold text-[#8a988d]">Respuestas rápidas:</span>
                      {quickReplies.map(reply => (
                        <button type="button" key={reply.label} onClick={() => setDraft(reply.content)}
                          className="rounded-full border border-[#e5eae3] bg-[#fafbf8] px-2.5 py-1 text-[11px] font-semibold text-[#5c8068] hover:border-[#9cbaa1] hover:bg-[#f1f7f0]">
                          {reply.label}
                        </button>
                      ))}
                    </div>
                    <label className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#6f8a75]">
                      <input type="checkbox" checked={internalNote} onChange={event => setInternalNote(event.target.checked)}/>
                      Nota interna (el cliente no la verá)
                    </label>
                    <form onSubmit={send} className="space-y-2">
                      <textarea aria-label="Responder al cliente" rows={3} maxLength={2000} value={draft} onChange={e=>setDraft(e.target.value)}
                        className="w-full resize-y rounded-2xl border border-[#e2e9e0] bg-[#fcfdfb] px-4 py-3 text-sm text-[#284334] outline-none transition focus:border-[#7ba787]"
                        placeholder={internalNote ? "Escribe una nota privada para el equipo..." : "Escribe una respuesta a tu cliente..."}/>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-[#98a39a]">{internalNote ? "Nota visible únicamente para Administración." : "La respuesta llegará al chat del cliente."}</span>
                        <button type="submit" disabled={busy || !draft.trim()}
                          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#214d34] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#143c28] disabled:cursor-not-allowed disabled:opacity-50">
                          {busy ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>} Enviar respuesta
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              )}
            </section>

            {showCustomerDetails && (
              <aside className="border-t border-[#e7ece6] bg-[#fdfefb] px-4 py-5 lg:border-l lg:border-t-0">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[#2d4d37]"><UserRound size={17}/> Ficha de cliente</h3>
                {active ? (
                  <div className="mt-5 space-y-5">
                    <div className="flex items-center gap-3 rounded-2xl bg-[#eff5ec] p-3">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#dcebdc] font-bold text-[#486d51]">{firstLetters(active.customerName)}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{active.customerName || "Cliente"}</p>
                        <p className="truncate text-xs text-[#6c8270]">{active.ownerType === "guest" ? "Visitante · sin cuenta" : "Cliente registrado"}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#9ba99e]">Contacto</p>
                      <p className="mt-2 flex items-start gap-2 break-all text-xs text-[#4b6552]"><Mail size={14} className="shrink-0"/>{active.customerEmail}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#9ba99e]">Consulta</p>
                      <p className="mt-2 flex items-center gap-2 text-xs text-[#4b6552]"><Ticket size={15}/> {active.ticketId || "Sin número"}</p>
                      <p className="mt-2 flex items-center gap-2 text-xs text-[#4b6552]"><Clock3 size={15}/> {fullDate(active.updatedAt)}</p>
                    </div>
                    <div className="border-t border-[#e7ece4] pt-5">
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-[#36533d]"><Package size={16}/> Pedidos asociados</h4>
                      {activeOrders.length === 0 ? (
                        <p className="mt-2 text-xs leading-5 text-[#8c9a8f]">No hay pedidos asociados a esta conversación en el listado disponible.</p>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {activeOrders.map((order, index)=>(
                            <div key={order.id || index} className="rounded-xl border border-[#e7ece4] bg-white p-3">
                              <p className="truncate text-xs font-semibold text-[#3d5b46]">#{order.id || "Pedido"}</p>
                              <div className="mt-1 flex justify-between gap-2 text-[11px] text-[#7b8c7f]">
                                <span>{order.status || "Pendiente"}</span>
                                <strong>{money(order.total)}</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="mt-2 text-[11px] leading-4 text-[#96a497]">Datos internos de pedidos, visibles solo para Administración.</p>
                    </div>
                    <div className="border-t border-[#e7ece4] pt-4 text-xs text-[#8d9a8f]">
                      <ShieldCheck size={16} className="mb-2 text-[#72947a]"/>
                      Los datos del cliente y sus pedidos no se envían automáticamente al asistente de IA.
                    </div>
                  </div>
                ) : (
                  <p className="mt-5 text-xs text-[#8d9a8f]">Abre una conversación para ver la ficha del cliente.</p>
                )}
              </aside>
            )}
          </div>
        </div>
        <p className="text-xs text-[#91a094]">
          Los avisos del navegador funcionan mientras tengas abierto el panel. Las conversaciones se actualizan automáticamente cada pocos segundos.
        </p>
      </div>
    </div>
  );
}
