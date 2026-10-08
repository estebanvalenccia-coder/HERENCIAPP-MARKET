import { useEffect, useState } from "react";
import { ExternalLink, Monitor, RefreshCw, Smartphone, Tablet, WandSparkles } from "lucide-react";

function embeddedPreviewUrl(raw: string | null, sha: string | null): string | null {
 try {
  if (!raw) return null;
  const url = new URL(raw);
  if (url.protocol !== "https:" || !/^neural-preview-[a-f0-9]{32}-production\.up\.railway\.app$/i.test(url.hostname)) return null;
  url.pathname = "/admin";
  if (sha && /^[a-f0-9]{40}$/i.test(sha)) url.searchParams.set("neural_revision", sha.slice(0, 12));
  return url.href;
 } catch { return null; }
}
type Props = {
 taskId: string;
 previewUrl: string | null;
 previewSha: string | null;
 ready: boolean;
 busy: boolean;
 revisionCount: number;
 reviewed: boolean;
 onReviewed: (checked: boolean) => void;
 onRevise: (text: string) => Promise<void>;
 onRefresh: () => Promise<void>;
};
export function NeuralPreviewWorkspace({taskId, previewUrl, previewSha, ready, busy, revisionCount, reviewed, onReviewed, onRevise, onRefresh}: Props) {
 const [expanded, setExpanded] = useState(false);
 const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
 const [instruction, setInstruction] = useState("");
 const [submitting, setSubmitting] = useState(false);
 const [refreshing, setRefreshing] = useState(false);
 const [revisionError, setRevisionError] = useState<string | null>(null);
 const [frameRevision, setFrameRevision] = useState(0);
 const iframeUrl = ready ? embeddedPreviewUrl(previewUrl, previewSha) : null;
 useEffect(() => { setRevisionError(null); setExpanded(false); setInstruction(""); }, [taskId]);
 const submitRevision = async () => {
  const text = instruction.trim();
  if (text.length < 10 || text.length > 1500 || submitting || busy) return;
  setSubmitting(true); setRevisionError(null);
  try { await onRevise(text); setInstruction(""); }
  catch (error) { setRevisionError(error instanceof Error ? error.message : "No se pudo enviar la corrección."); }
  finally { setSubmitting(false); }
 };
 const refresh = async () => {
  if (refreshing) return;
  setRefreshing(true);
  try { await onRefresh(); } finally { setRefreshing(false); }
 };
 return (
  <section className="mt-4 rounded-2xl border border-indigo-200 bg-white p-3 sm:p-4">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <div>
     <h4 className="font-black text-slate-900">Workspace de preview</h4>
     <p className="text-xs text-slate-600">Misma tarea · misma PR · ninguna publicación automática</p>
    </div>
    <div className="flex flex-wrap gap-2">
     <button type="button" onClick={() => void refresh()} disabled={refreshing || busy}
      className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50">
      <RefreshCw className={"h-3.5 w-3.5 " + (refreshing ? "animate-spin" : "")}/> Actualizar estado
     </button>
     {ready && previewUrl && <a href={previewUrl} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold text-indigo-800">
      <ExternalLink className="h-3.5 w-3.5"/> Abrir aparte
     </a>}
    </div>
   </div>
   {busy && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-900">
    Neural está editando esta misma PR. Espera el nuevo despliegue para revisar el resultado.
   </p>}
   {!ready && !busy && <p role="status" className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
    Esperando el despliegue de la nueva versión. Aquí aparecerá cuando Railway confirme el commit.
   </p>}
   {ready && iframeUrl && <div className="mt-3">
    <button type="button" onClick={() => setExpanded(value => !value)}
     className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white hover:bg-indigo-700">
     {expanded ? "OCULTAR PREVIEW INTEGRADA" : "VER PREVIEW DENTRO DE NEURAL"}
    </button>
    {expanded && <div className="mt-3 rounded-xl border bg-slate-100 p-2">
     <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="font-semibold text-slate-700">La preview es de demostración y no tiene acceso a tus datos privados.</span>
      <div className="flex gap-1" role="group" aria-label="Tamaño de la preview">
       {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([kind, Icon]) =>
        <button key={kind} type="button" onClick={() => setDevice(kind)} title={kind}
         aria-pressed={device === kind} className={"rounded-md p-2 " + (device === kind ? "bg-indigo-100 text-indigo-900" : "bg-white text-slate-700")}>
         <Icon className="h-4 w-4"/>
        </button>)}
       <button type="button" onClick={() => setFrameRevision(value => value + 1)} title="Recargar pantalla"
        className="rounded-md bg-white p-2 text-slate-700"><RefreshCw className="h-4 w-4"/></button>
      </div>
     </div>
     <div className="mx-auto overflow-hidden rounded-lg border bg-white transition-all"
      style={{ width: device === "mobile" ? "min(100%, 390px)" : device === "tablet" ? "min(100%, 780px)" : "100%" }}>
      <iframe key={taskId + ":" + (previewSha || "pending") + ":" + frameRevision} src={iframeUrl}
       title="Vista previa segura de la rama de HERENCIA Neural" loading="lazy"
       sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer"
       className="h-[560px] w-full border-0" />
     </div>
     <p className="mt-2 text-xs text-slate-600">Se recarga automáticamente cuando la nueva versión queda lista. Si el proveedor bloquea la vista integrada, usa «Abrir aparte».</p>
    </div>}
   </div>}
   {ready && !iframeUrl && <p className="mt-3 text-xs text-amber-900">Este proveedor no permite la preview integrada segura. Usa «Abrir aparte».</p>}
   {ready && <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-950">
    <input type="checkbox" checked={reviewed} onChange={event => onReviewed(event.target.checked)}
     className="mt-1 h-4 w-4 accent-emerald-700"/>
    <span>He comprobado en la preview que el cambio solicitado aparece y funciona. Solo entonces permitir publicar esta versión.</span>
   </label>}
   <div className="mt-4 rounded-xl border border-slate-200 p-3">
    <label htmlFor={"neural-revise-" + taskId} className="flex items-center gap-2 text-sm font-black text-slate-900">
     <WandSparkles className="h-4 w-4"/> Pedir corrección sobre esta preview
    </label>
    <p className="mt-1 text-xs text-slate-600">Ejemplo: «El reloj no se ve; ponlo arriba a la derecha del administrador». No crea otra PR.</p>
    <textarea id={"neural-revise-" + taskId} value={instruction} onChange={event => setInstruction(event.target.value)}
     rows={3} maxLength={1500} placeholder="Describe qué quieres ajustar en esta misma versión de prueba…"
     disabled={busy || submitting || revisionCount >= 8}
     className="mt-2 w-full resize-y rounded-lg border px-3 py-2 text-sm disabled:opacity-50"/>
    {revisionError && <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{revisionError}</p>}
    <button type="button" onClick={() => void submitRevision()}
     disabled={busy || submitting || revisionCount >= 8 || instruction.trim().length < 10}
     className="mt-2 w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
     {submitting ? "ENVIANDO CORRECCIÓN…" : "CORREGIR EN LA MISMA RAMA"}
    </button>
    <p className="mt-2 text-xs text-slate-600">{revisionCount}/8 correcciones · Cada corrección produce un único commit y una nueva compilación, sin tocar main.</p>
   </div>
  </section>
 );
}
