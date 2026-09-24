import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  GripVertical,
  History,
  Image as ImageIcon,
  LayoutTemplate,
  Monitor,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Smartphone,
  Tablet,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import logo from "figma:asset/8c5f2b4f88c45fd4812e5bb91610bff5272333d7.png";
import { backendStorage } from "../../lib/backendStorage";
import {
  BuilderBlock,
  BuilderBlockDesign,
  BuilderBlockType,
  createBuilderBlock,
  defaultBlockDesign,
  ensureBuilderBlocks,
  makeBuilderId,
  parseSiteContent,
  SiteContent,
  SiteLink,
  syncBuilderToLegacy,
} from "../../lib/siteContent";
import { StorefrontBlock } from "../site/StorefrontBlock";

type Device = "desktop" | "tablet" | "mobile";
type PageMode = "home" | "contact";
type SelectedTarget = "header" | "footer" | "contact" | string;
type EditorTab = "contenido" | "diseno" | "avanzado";

type StoredVersion = {
  id: string;
  at: string;
  label: string;
  content: string;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function readLegacyBanner(key: "heroBanner" | "ctaBanner") {
  try {
    const raw = backendStorage.getItem(key);
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return String(parsed?.imageUrl || "").trim();
  } catch {
    return "";
  }
}

function hydrateLegacyBanners(site: SiteContent): SiteContent {
  const heroImage = readLegacyBanner("heroBanner");
  const ctaImage = readLegacyBanner("ctaBanner");
  return {
    ...site,
    builder: {
      blocks: ensureBuilderBlocks(site).map((block) => {
        if (block.type === "hero" && !block.data?.imageUrl && heroImage) {
          return { ...block, data: { ...block.data, imageUrl: heroImage } };
        }
        if (block.type === "cta" && !block.data?.imageUrl && ctaImage) {
          return { ...block, data: { ...block.data, imageUrl: ctaImage } };
        }
        return block;
      }),
    },
  };
}

async function compressImage(file: File, maxWidth = 1920) {
  if (!file.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen");
  if (file.size > 8 * 1024 * 1024) throw new Error("La imagen supera 8 MB");

  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo procesar la imagen"));
    img.src = source;
  });

  const scale = Math.min(1, maxWidth / Math.max(1, image.width));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no puede procesar la imagen");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.86);
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-700">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
        />
      )}
    </label>
  );
}

function LinkFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SiteLink;
  onChange: (next: SiteLink) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</p>
        {(value?.label || value?.href) && (
          <button
            type="button"
            onClick={() => onChange({ label: "", href: "" })}
            className="text-[11px] font-bold text-rose-600 hover:underline"
          >
            Quitar
          </button>
        )}
      </div>
      <TextField label="Texto" value={value?.label || ""} onChange={(text) => onChange({ ...value, label: text })} placeholder="Escribe para añadir el botón" />
      <TextField
        label="Destino / URL"
        value={value?.href || ""}
        onChange={(href) => onChange({ ...value, href })}
        placeholder="/productos o https://..."
      />
    </div>
  );
}

function ImageFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [working, setWorking] = useState(false);

  async function onFile(file?: File) {
    if (!file) return;
    setWorking(true);
    try {
      onChange(await compressImage(file));
    } catch (error: any) {
      toast.error(error?.message || "No se pudo cargar la imagen");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <TextField
        label={`${label} · URL`}
        value={value.startsWith("data:image/") ? "" : value}
        onChange={onChange}
        placeholder="https://..."
      />
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white">
          <Upload className="h-3.5 w-3.5" />
          {working ? "Procesando..." : "Subir imagen"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={working}
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
          >
            Quitar
          </button>
        )}
      </div>
      {value && <img src={value} alt={label} className="h-28 w-full rounded-lg object-cover" />}
    </div>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-700">
        <span>{label}</span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-500">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-emerald-700"
      />
    </label>
  );
}

function deviceWidth(device: Device) {
  if (device === "mobile") return 390;
  if (device === "tablet") return 820;
  return 1440;
}

function blockTypeLabel(type: BuilderBlockType) {
  const labels: Record<BuilderBlockType, string> = {
    hero: "Portada",
    features: "Ventajas",
    categories: "Categorías",
    cta: "Banner",
    textImage: "Texto + imagen",
    gallery: "Galería",
    testimonials: "Testimonios",
  };
  return labels[type];
}

export function AdminVisualBuilder({
  onClose,
  onPublished,
}: {
  onClose: () => void;
  onPublished?: () => void;
}) {
  const [site, setSite] = useState<SiteContent>(() => {
    const draft = backendStorage.getItem("siteContentDraft");
    return hydrateLegacyBanners(parseSiteContent(draft || backendStorage.getItem("siteContent")));
  });
  const [publishedSite, setPublishedSite] = useState<SiteContent>(() =>
    hydrateLegacyBanners(parseSiteContent(backendStorage.getItem("siteContent")))
  );
  const [selected, setSelected] = useState<SelectedTarget>("header");
  const [pageMode, setPageMode] = useState<PageMode>("home");
  const [device, setDevice] = useState<Device>("desktop");
  const [tab, setTab] = useState<EditorTab>("contenido");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<SiteContent[]>([]);
  const [redoStack, setRedoStack] = useState<SiteContent[]>([]);
  const [versions, setVersions] = useState<StoredVersion[]>(() => {
    try {
      return JSON.parse(backendStorage.getItem("siteContentHistory") || "[]");
    } catch {
      return [];
    }
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [draftState, setDraftState] = useState<"guardado" | "guardando" | "pendiente">("guardado");
  const [publishing, setPublishing] = useState(false);
  const hydratedRef = useRef(false);

  const blocks = useMemo(() => ensureBuilderBlocks(site), [site]);
  const selectedBlock = blocks.find((block) => block.id === selected) || null;

  useEffect(() => {
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    setDraftState("pendiente");
    const timer = window.setTimeout(async () => {
      setDraftState("guardando");
      const result = await backendStorage.setItem("siteContentDraft", JSON.stringify(site));
      setDraftState(result.ok ? "guardado" : "pendiente");
    }, 900);
    return () => window.clearTimeout(timer);
  }, [site]);

  function commit(next: SiteContent) {
    setUndoStack((current) => [...current.slice(-29), clone(site)]);
    setRedoStack([]);
    setSite(next);
  }

  function updateSite(mutator: (current: SiteContent) => SiteContent) {
    commit(mutator(clone(site)));
  }

  function updateBlock(id: string, mutator: (block: BuilderBlock) => BuilderBlock) {
    updateSite((current) => ({
      ...current,
      builder: {
        blocks: ensureBuilderBlocks(current).map((block) =>
          block.id === id ? mutator(clone(block)) : block
        ),
      },
    }));
  }

  function updateBlockData(id: string, patch: Record<string, any>) {
    updateBlock(id, (block) => ({
      ...block,
      data: { ...block.data, ...patch },
    }));
  }

  function updateDesign(id: string, patch: Partial<BuilderBlockDesign>) {
    updateBlock(id, (block) => ({
      ...block,
      design: { ...block.design, ...patch },
    }));
  }

  function undo() {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    setRedoStack((current) => [clone(site), ...current].slice(0, 30));
    setUndoStack((current) => current.slice(0, -1));
    setSite(previous);
  }

  function redo() {
    const next = redoStack[0];
    if (!next) return;
    setUndoStack((current) => [...current.slice(-29), clone(site)]);
    setRedoStack((current) => current.slice(1));
    setSite(next);
  }

  function reorder(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    updateSite((current) => {
      const next = ensureBuilderBlocks(current);
      const from = next.findIndex((block) => block.id === sourceId);
      const to = next.findIndex((block) => block.id === targetId);
      if (from < 0 || to < 0) return current;
      const reordered = [...next];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      return { ...current, builder: { blocks: reordered } };
    });
  }

  function moveBlock(id: string, direction: -1 | 1) {
    const index = blocks.findIndex((block) => block.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= blocks.length) return;
    reorder(id, blocks[target].id);
  }

  function addBlock(type: BuilderBlockType) {
    const block = createBuilderBlock(type, site);
    updateSite((current) => ({
      ...current,
      builder: { blocks: [...ensureBuilderBlocks(current), block] },
    }));
    setSelected(block.id);
    setTab("contenido");
    setAddOpen(false);
  }

  function duplicateBlock(block: BuilderBlock) {
    const duplicate = clone(block);
    duplicate.id = makeBuilderId(block.type);
    duplicate.name = `${block.name} · copia`;
    updateSite((current) => {
      const currentBlocks = ensureBuilderBlocks(current);
      const index = currentBlocks.findIndex((item) => item.id === block.id);
      const next = [...currentBlocks];
      next.splice(index + 1, 0, duplicate);
      return { ...current, builder: { blocks: next } };
    });
    setSelected(duplicate.id);
  }

  function removeBlock(block: BuilderBlock) {
    if (!window.confirm(`¿Eliminar la sección “${block.name}”?`)) return;
    updateSite((current) => ({
      ...current,
      builder: {
        blocks: ensureBuilderBlocks(current).filter((item) => item.id !== block.id),
      },
    }));
    setSelected("header");
  }

  function resetBlockDesign(block: BuilderBlock) {
    updateBlock(block.id, (current) => ({
      ...current,
      design: defaultBlockDesign(current.type),
    }));
  }

  async function saveDraftNow() {
    setDraftState("guardando");
    const result = await backendStorage.setItem("siteContentDraft", JSON.stringify(site));
    if (!result.ok) {
      setDraftState("pendiente");
      toast.error(result.error || "No se pudo guardar el borrador");
      return;
    }
    setDraftState("guardado");
    toast.success("Borrador guardado");
  }

  async function publish() {
    setPublishing(true);
    try {
      const nextPublished = syncBuilderToLegacy(site, ensureBuilderBlocks(site));
      const previousRaw = backendStorage.getItem("siteContent");
      const previous = previousRaw ? parseSiteContent(previousRaw) : publishedSite;
      let nextHistory: StoredVersion[] = [
        {
          id: makeBuilderId("version"),
          at: new Date().toISOString(),
          label: `Antes de publicar · ${new Date().toLocaleString("es-ES")}`,
          content: JSON.stringify(previous),
        },
        ...versions,
      ].slice(0, 12);

      // Evita que el historial con imágenes base64 supere el límite del backend.
      while (nextHistory.length > 1 && JSON.stringify(nextHistory).length > 5_000_000) {
        nextHistory = nextHistory.slice(0, -1);
      }

      const hero = ensureBuilderBlocks(nextPublished).find((block) => block.type === "hero");
      const cta = ensureBuilderBlocks(nextPublished).find((block) => block.type === "cta");

      const results = await Promise.all([
        backendStorage.setItem("siteContent", JSON.stringify(nextPublished)),
        backendStorage.setItem("siteContentDraft", JSON.stringify(nextPublished)),
        backendStorage.setItem("siteContentHistory", JSON.stringify(nextHistory)),
        hero?.data?.imageUrl
          ? backendStorage.setItem("heroBanner", JSON.stringify({ imageUrl: hero.data.imageUrl }))
          : backendStorage.removeItem("heroBanner"),
        cta?.data?.imageUrl
          ? backendStorage.setItem("ctaBanner", JSON.stringify({ imageUrl: cta.data.imageUrl }))
          : backendStorage.removeItem("ctaBanner"),
      ]);

      const failed = results.find((result) => !result.ok);
      if (failed) throw new Error(failed.error || "No se pudo publicar");

      setSite(nextPublished);
      setPublishedSite(nextPublished);
      setVersions(nextHistory);
      setDraftState("guardado");
      window.dispatchEvent(new Event("backend-storage"));
      toast.success("Cambios publicados en Herencia");
      onPublished?.();
    } catch (error: any) {
      toast.error(error?.message || "No se pudo publicar");
    } finally {
      setPublishing(false);
    }
  }

  function restoreVersion(version: StoredVersion) {
    if (!window.confirm("¿Cargar esta versión en el editor? No se publicará hasta que pulses Publicar.")) return;
    try {
      commit(parseSiteContent(version.content));
      setHistoryOpen(false);
      toast.success("Versión cargada como borrador");
    } catch {
      toast.error("La versión guardada no se pudo leer");
    }
  }

  function discardDraft() {
    if (!window.confirm("¿Descartar el borrador y volver a la versión publicada?")) return;
    setUndoStack((current) => [...current.slice(-29), clone(site)]);
    setRedoStack([]);
    setSite(clone(publishedSite));
    toast.info("Se ha recuperado la versión publicada");
  }

  const previewWidth = deviceWidth(device);

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[#eef0ec] text-slate-900">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-sm sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Panel</span>
          </button>
          <div className="hidden min-w-0 md:block">
            <p className="truncate font-black">Constructor visual · Herencia</p>
            <p className="text-xs text-slate-500">
              {draftState === "guardando"
                ? "Guardando borrador…"
                : draftState === "guardado"
                ? "Borrador guardado"
                : "Cambios pendientes"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={undo}
            disabled={!undoStack.length}
            className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-30"
            title="Deshacer"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!redoStack.length}
            className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-30"
            title="Rehacer"
          >
            <Redo2 className="h-4 w-4" />
          </button>

          <div className="hidden rounded-xl bg-slate-100 p-1 lg:flex">
            {([
              ["desktop", Monitor],
              ["tablet", Tablet],
              ["mobile", Smartphone],
            ] as const).map(([value, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => setDevice(value)}
                className={`rounded-lg p-2 ${device === value ? "bg-white shadow-sm" : ""}`}
                title={value}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => window.open("/", "_blank")}
            className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold xl:flex"
          >
            <ExternalLink className="h-4 w-4" /> Ver sitio
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold sm:flex"
          >
            <History className="h-4 w-4" /> Historial
          </button>
          <button
            type="button"
            onClick={() => void saveDraftNow()}
            className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold md:flex"
          >
            <Save className="h-4 w-4" /> Borrador
          </button>
          <button
            type="button"
            onClick={() => void publish()}
            disabled={publishing}
            className="rounded-xl bg-[#2f6848] px-4 py-2 text-sm font-black text-white shadow-sm disabled:opacity-50"
          >
            {publishing ? "Publicando…" : "Publicar cambios"}
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)_350px]">
        <aside className="hidden overflow-y-auto border-r border-slate-200 bg-white lg:block">
          <div className="border-b border-slate-200 p-3">
            <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setPageMode("home");
                  if (selected === "contact") setSelected("header");
                }}
                className={`rounded-lg px-3 py-2 text-sm font-black ${pageMode === "home" ? "bg-white shadow-sm" : ""}`}
              >
                Inicio
              </button>
              <button
                type="button"
                onClick={() => {
                  setPageMode("contact");
                  setSelected("contact");
                }}
                className={`rounded-lg px-3 py-2 text-sm font-black ${pageMode === "contact" ? "bg-white shadow-sm" : ""}`}
              >
                Contacto
              </button>
            </div>
          </div>

          <div className="p-3">
            <p className="mb-2 px-1 text-xs font-black uppercase tracking-wider text-slate-400">
              Estructura
            </p>

            <button
              type="button"
              onClick={() => {
                setSelected("header");
                setTab("contenido");
              }}
              className={`mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left ${selected === "header" ? "border-emerald-600 bg-emerald-50" : "border-slate-200"}`}
            >
              <LayoutTemplate className="h-4 w-4 text-emerald-700" />
              <div>
                <p className="text-sm font-black">Header</p>
                <p className="text-xs text-slate-500">Logo y navegación</p>
              </div>
            </button>

            {pageMode === "home" ? (
              <div className="space-y-2">
                {blocks.map((block, index) => (
                  <div
                    key={block.id}
                    draggable
                    onDragStart={() => setDraggingId(block.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggingId) reorder(draggingId, block.id);
                      setDraggingId(null);
                    }}
                    className={`group rounded-xl border bg-white transition ${selected === block.id ? "border-emerald-600 bg-emerald-50 shadow-sm" : "border-slate-200"} ${draggingId === block.id ? "opacity-50" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(block.id);
                        setTab("contenido");
                      }}
                      className="flex w-full items-center gap-2 p-3 text-left"
                    >
                      <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black">{block.name}</p>
                        <p className="text-xs text-slate-500">{blockTypeLabel(block.type)}</p>
                      </div>
                      <span className={block.visible ? "text-emerald-600" : "text-slate-300"}>
                        {block.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </span>
                    </button>
                    <div className="hidden items-center justify-end gap-1 border-t border-slate-100 px-2 py-1.5 group-hover:flex">
                      <button type="button" onClick={() => moveBlock(block.id, -1)} disabled={index === 0} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => moveBlock(block.id, 1)} disabled={index === blocks.length - 1} className="rounded p-1 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => duplicateBlock(block)} className="rounded p-1 hover:bg-slate-100"><Copy className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => updateBlock(block.id, (item) => ({ ...item, visible: !item.visible }))} className="rounded p-1 hover:bg-slate-100">{block.visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
                    </div>
                  </div>
                ))}

                <div className="relative pt-1">
                  <button
                    type="button"
                    onClick={() => setAddOpen((open) => !open)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-400 bg-emerald-50 px-3 py-3 text-sm font-black text-emerald-800"
                  >
                    <Plus className="h-4 w-4" /> Añadir sección
                  </button>
                  {addOpen && (
                    <div className="absolute bottom-full left-0 z-30 mb-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
                      {(["textImage", "gallery", "testimonials", "cta", "categories", "features", "hero"] as BuilderBlockType[]).map((type) => (
                        <button key={type} type="button" onClick={() => addBlock(type)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-slate-100">
                          <Plus className="h-3.5 w-3.5 text-emerald-700" />
                          {blockTypeLabel(type)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSelected("contact");
                  setTab("contenido");
                }}
                className={`mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left ${selected === "contact" ? "border-emerald-600 bg-emerald-50" : "border-slate-200"}`}
              >
                <Clock3 className="h-4 w-4 text-emerald-700" />
                <div>
                  <p className="text-sm font-black">Página de contacto</p>
                  <p className="text-xs text-slate-500">Dirección, horario y mapa</p>
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setSelected("footer");
                setTab("contenido");
              }}
              className={`mt-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left ${selected === "footer" ? "border-emerald-600 bg-emerald-50" : "border-slate-200"}`}
            >
              <LayoutTemplate className="h-4 w-4 text-emerald-700" />
              <div>
                <p className="text-sm font-black">Footer</p>
                <p className="text-xs text-slate-500">Contacto y enlaces</p>
              </div>
            </button>
          </div>

          <div className="mt-auto border-t border-slate-200 p-3">
            <button type="button" onClick={discardDraft} className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100">
              <RotateCcw className="h-3.5 w-3.5" /> Volver a lo publicado
            </button>
          </div>
        </aside>

        <main className="min-w-0 overflow-auto bg-[#e5e9e3] p-3 sm:p-5">
          <div
            className="builder-page-container mx-auto origin-top overflow-hidden rounded-xl border border-slate-300 bg-white shadow-xl transition-all duration-300"
            style={{ width: `${previewWidth}px`, maxWidth: "100%" }}
          >
            <div
              className="flex min-h-14 items-center justify-between border-b px-4"
              style={{
                backgroundColor: site.builder.headerStyle.backgroundColor,
                borderColor: site.builder.headerStyle.borderColor,
                color: site.builder.headerStyle.textColor,
              }}
            >
              <button type="button" onClick={() => setSelected("header")} className={`text-left ${selected === "header" ? "rounded ring-2 ring-emerald-600" : ""}`}>
                {site.brand.logoUrl ? (
                  <img src={site.brand.logoUrl} alt={site.brand.logoAlt} className="h-10 w-auto" />
                ) : (
                  <span className="font-serif text-xl font-black text-emerald-900">{site.brand.name}</span>
                )}
              </button>
              <div className="hidden gap-4 text-xs md:flex">
                <span>{site.navigation.home.label}</span>
                <span>{site.navigation.products.label}</span>
                <span>{site.navigation.services.label}</span>
                <span>{site.navigation.herencia.label}</span>
              </div>
            </div>

            {pageMode === "home" ? (
              blocks.map((block) => (
                <div
                  key={block.id}
                  onClick={() => setSelected(block.id)}
                  className={`relative cursor-pointer ${selected === block.id ? "ring-4 ring-inset ring-emerald-600" : "hover:ring-2 hover:ring-inset hover:ring-emerald-400/50"}`}
                >
                  {!block.visible && (
                    <div className="absolute inset-0 z-20 grid place-items-center bg-white/80 text-sm font-black text-slate-500">
                      Sección oculta
                    </div>
                  )}
                  <StorefrontBlock block={{ ...block, visible: true }} site={site} logoFallback={logo} preview />
                </div>
              ))
            ) : (
              <ContactPreview site={site} selected={selected === "contact"} onSelect={() => setSelected("contact")} />
            )}

            <button
              type="button"
              onClick={() => setSelected("footer")}
              className={`grid w-full gap-5 p-6 text-left text-xs md:grid-cols-4 ${selected === "footer" ? "ring-4 ring-inset ring-emerald-600" : ""}`}
              style={{
                backgroundColor: site.builder.footerStyle.backgroundColor,
                color: site.builder.footerStyle.textColor,
              }}
            >
              <div><p className="font-black">{site.brand.name}</p><p className="mt-2 text-slate-600">{site.footer.description}</p></div>
              <div><p className="font-black">{site.footer.productsTitle}</p>{site.footer.productLinks.slice(0, 3).map((link, index) => <p key={index} className="mt-2 text-slate-600">{link.label}</p>)}</div>
              <div><p className="font-black">{site.footer.servicesTitle}</p>{site.footer.serviceLinks.slice(0, 3).map((link, index) => <p key={index} className="mt-2 text-slate-600">{link.label}</p>)}</div>
              <div><p className="font-black">{site.footer.contactTitle}</p><p className="mt-2 text-slate-600">{site.footer.whatsappLabel}</p><p className="mt-2 text-slate-600">{site.footer.instagramLabel}</p></div>
            </button>
          </div>
        </main>

        <aside className="overflow-y-auto border-l border-slate-200 bg-white">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Editando</p>
                <h2 className="mt-1 text-lg font-black">
                  {selectedBlock?.name || (selected === "header" ? "Header" : selected === "footer" ? "Footer" : "Contacto")}
                </h2>
              </div>
              {selectedBlock && (
                <button type="button" onClick={() => updateBlock(selectedBlock.id, (block) => ({ ...block, visible: !block.visible }))} className="rounded-lg border border-slate-200 p-2">
                  {selectedBlock.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              )}
            </div>

            {(selectedBlock || selected === "header" || selected === "footer") && (
              <div className="mt-3 grid grid-cols-3 rounded-xl bg-slate-100 p-1">
                {([
                  ["contenido", "Contenido"],
                  ["diseno", "Diseño"],
                  ["avanzado", "Avanzado"],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-lg px-2 py-2 text-xs font-black ${tab === value ? "bg-white shadow-sm" : "text-slate-500"}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4 p-4">
            {selected === "header" && tab === "contenido" && <HeaderEditor site={site} updateSite={updateSite} />}
            {selected === "header" && tab === "diseno" && <HeaderDesignEditor site={site} updateSite={updateSite} />}
            {selected === "header" && tab === "avanzado" && (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                El header usa los enlaces globales del sitio. Puedes cambiar sus destinos en Contenido y su apariencia en Diseño.
              </div>
            )}

            {selected === "footer" && tab === "contenido" && <FooterEditor site={site} updateSite={updateSite} />}
            {selected === "footer" && tab === "diseno" && <FooterDesignEditor site={site} updateSite={updateSite} />}
            {selected === "footer" && tab === "avanzado" && (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                El footer es global: los cambios se aplican a todas las páginas.
              </div>
            )}

            {selected === "contact" && <ContactEditor site={site} updateSite={updateSite} />}

            {selectedBlock && tab === "contenido" && (
              <BlockContentEditor
                block={selectedBlock}
                updateData={(patch) => updateBlockData(selectedBlock.id, patch)}
                updateBlock={(next) => updateBlock(selectedBlock.id, () => next)}
              />
            )}

            {selectedBlock && tab === "diseno" && (
              <DesignEditor
                block={selectedBlock}
                update={(patch) => updateDesign(selectedBlock.id, patch)}
              />
            )}

            {selectedBlock && tab === "avanzado" && (
              <div className="space-y-4">
                <TextField
                  label="Nombre interno de la sección"
                  value={selectedBlock.name}
                  onChange={(name) => updateBlock(selectedBlock.id, (block) => ({ ...block, name }))}
                />
                <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm font-bold">
                  Ocultar en móvil
                  <input
                    type="checkbox"
                    checked={selectedBlock.design.hiddenMobile}
                    onChange={(event) => updateDesign(selectedBlock.id, { hiddenMobile: event.target.checked })}
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm font-bold">
                  Sección visible
                  <input
                    type="checkbox"
                    checked={selectedBlock.visible}
                    onChange={(event) => updateBlock(selectedBlock.id, (block) => ({ ...block, visible: event.target.checked }))}
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => duplicateBlock(selectedBlock)} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-black">
                    <Copy className="h-4 w-4" /> Duplicar
                  </button>
                  <button type="button" onClick={() => resetBlockDesign(selectedBlock)} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-black">
                    <RotateCcw className="h-4 w-4" /> Diseño base
                  </button>
                </div>
                <button type="button" onClick={() => removeBlock(selectedBlock)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-50 px-3 py-3 text-sm font-black text-rose-700">
                  <Trash2 className="h-4 w-4" /> Eliminar sección
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {historyOpen && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-5">
              <div>
                <h2 className="text-xl font-black">Historial de versiones</h2>
                <p className="text-sm text-slate-500">Cada publicación guarda la versión anterior.</p>
              </div>
              <button type="button" onClick={() => setHistoryOpen(false)} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {!versions.length ? (
                <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">Todavía no hay versiones anteriores.</div>
              ) : (
                <div className="space-y-2">
                  {versions.map((version) => (
                    <div key={version.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                      <div>
                        <p className="font-black">{version.label}</p>
                        <p className="text-xs text-slate-500">{new Date(version.at).toLocaleString("es-ES")}</p>
                      </div>
                      <button type="button" onClick={() => restoreVersion(version)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white">Cargar</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HeaderEditor({
  site,
  updateSite,
}: {
  site: SiteContent;
  updateSite: (mutator: (site: SiteContent) => SiteContent) => void;
}) {
  return (
    <div className="space-y-4">
      <TextField label="Nombre de marca" value={site.brand.name} onChange={(name) => updateSite((current) => ({ ...current, brand: { ...current.brand, name } }))} />
      <TextField label="Texto alternativo del logo" value={site.brand.logoAlt} onChange={(logoAlt) => updateSite((current) => ({ ...current, brand: { ...current.brand, logoAlt } }))} />
      <ImageFields label="Logo" value={site.brand.logoUrl} onChange={(logoUrl) => updateSite((current) => ({ ...current, brand: { ...current.brand, logoUrl } }))} />
      {(["home", "products", "services", "herencia"] as const).map((key) => (
        <LinkFields
          key={key}
          label={key === "home" ? "Inicio" : key === "products" ? "Productos" : key === "services" ? "Servicios" : "Herenc(IA)"}
          value={site.navigation[key]}
          onChange={(value) => updateSite((current) => ({ ...current, navigation: { ...current.navigation, [key]: value } }))}
        />
      ))}
      <TextField label="Destino del carrito" value={site.headerActions.cartHref} onChange={(cartHref) => updateSite((current) => ({ ...current, headerActions: { ...current.headerActions, cartHref } }))} />
      <TextField label="Destino del perfil" value={site.headerActions.profileHref} onChange={(profileHref) => updateSite((current) => ({ ...current, headerActions: { ...current.headerActions, profileHref } }))} />
    </div>
  );
}

function HeaderDesignEditor({
  site,
  updateSite,
}: {
  site: SiteContent;
  updateSite: (mutator: (site: SiteContent) => SiteContent) => void;
}) {
  const design = site.builder.headerStyle;
  const patch = (value: Partial<SiteContent["builder"]["headerStyle"]>) =>
    updateSite((current) => ({
      ...current,
      builder: {
        ...current.builder,
        headerStyle: { ...current.builder.headerStyle, ...value },
      },
    }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-bold text-slate-700">
          <span className="mb-1.5 block">Fondo</span>
          <input type="color" value={design.backgroundColor} onChange={(event) => patch({ backgroundColor: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200" />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          <span className="mb-1.5 block">Texto</span>
          <input type="color" value={design.textColor} onChange={(event) => patch({ textColor: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200" />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          <span className="mb-1.5 block">Activo</span>
          <input type="color" value={design.activeColor} onChange={(event) => patch({ activeColor: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200" />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          <span className="mb-1.5 block">Fondo activo</span>
          <input type="color" value={design.activeBackground} onChange={(event) => patch({ activeBackground: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200" />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          <span className="mb-1.5 block">Borde</span>
          <input type="color" value={design.borderColor} onChange={(event) => patch({ borderColor: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200" />
        </label>
      </div>
      <RangeField label="Altura del logo" value={design.logoHeight} min={36} max={96} suffix="px" onChange={(logoHeight) => patch({ logoHeight })} />
      <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm font-bold">
        Header fijo al hacer scroll
        <input type="checkbox" checked={design.sticky} onChange={(event) => patch({ sticky: event.target.checked })} />
      </label>
    </div>
  );
}

function FooterDesignEditor({
  site,
  updateSite,
}: {
  site: SiteContent;
  updateSite: (mutator: (site: SiteContent) => SiteContent) => void;
}) {
  const design = site.builder.footerStyle;
  const patch = (value: Partial<SiteContent["builder"]["footerStyle"]>) =>
    updateSite((current) => ({
      ...current,
      builder: {
        ...current.builder,
        footerStyle: { ...current.builder.footerStyle, ...value },
      },
    }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-bold text-slate-700">
          <span className="mb-1.5 block">Fondo</span>
          <input type="color" value={design.backgroundColor} onChange={(event) => patch({ backgroundColor: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200" />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          <span className="mb-1.5 block">Texto</span>
          <input type="color" value={design.textColor} onChange={(event) => patch({ textColor: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200" />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          <span className="mb-1.5 block">Títulos</span>
          <input type="color" value={design.headingColor} onChange={(event) => patch({ headingColor: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200" />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          <span className="mb-1.5 block">Borde</span>
          <input type="color" value={design.borderColor} onChange={(event) => patch({ borderColor: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200" />
        </label>
      </div>
      <RangeField label="Espaciado vertical" value={design.paddingY} min={20} max={120} suffix="px" onChange={(paddingY) => patch({ paddingY })} />
    </div>
  );
}

function FooterEditor({
  site,
  updateSite,
}: {
  site: SiteContent;
  updateSite: (mutator: (site: SiteContent) => SiteContent) => void;
}) {
  function updateFooter(patch: Partial<SiteContent["footer"]>) {
    updateSite((current) => ({ ...current, footer: { ...current.footer, ...patch } }));
  }

  return (
    <div className="space-y-4">
      <TextField label="Descripción" value={site.footer.description} onChange={(description) => updateFooter({ description })} multiline />
      <TextField label="Título Productos" value={site.footer.productsTitle} onChange={(productsTitle) => updateFooter({ productsTitle })} />
      {site.footer.productLinks.map((link, index) => (
        <LinkFields
          key={index}
          label={`Producto ${index + 1}`}
          value={link}
          onChange={(value) =>
            updateFooter({
              productLinks: site.footer.productLinks.map((item, i) => (i === index ? value : item)),
            })
          }
        />
      ))}
      <TextField label="Título Servicios" value={site.footer.servicesTitle} onChange={(servicesTitle) => updateFooter({ servicesTitle })} />
      {site.footer.serviceLinks.map((link, index) => (
        <LinkFields
          key={index}
          label={`Servicio ${index + 1}`}
          value={link}
          onChange={(value) =>
            updateFooter({
              serviceLinks: site.footer.serviceLinks.map((item, i) => (i === index ? value : item)),
            })
          }
        />
      ))}
      <TextField label="Título Contacto" value={site.footer.contactTitle} onChange={(contactTitle) => updateFooter({ contactTitle })} />
      <TextField label="Texto WhatsApp" value={site.footer.whatsappLabel} onChange={(whatsappLabel) => updateFooter({ whatsappLabel })} />
      <TextField label="Número WhatsApp" value={site.footer.whatsappPhone} onChange={(whatsappPhone) => updateFooter({ whatsappPhone })} />
      <TextField label="Texto teléfono" value={site.footer.callLabel} onChange={(callLabel) => updateFooter({ callLabel })} />
      <TextField label="Teléfono" value={site.footer.callPhone} onChange={(callPhone) => updateFooter({ callPhone })} />
      <TextField label="Instagram" value={site.footer.instagramLabel} onChange={(instagramLabel) => updateFooter({ instagramLabel })} />
      <TextField label="URL Instagram" value={site.footer.instagramUrl} onChange={(instagramUrl) => updateFooter({ instagramUrl })} />
      <TextField label="Texto ubicación" value={site.footer.mapsLabel} onChange={(mapsLabel) => updateFooter({ mapsLabel })} />
      <TextField label="URL Google Maps" value={site.footer.mapsUrl} onChange={(mapsUrl) => updateFooter({ mapsUrl })} />
      <TextField label="Copyright" value={site.footer.copyright} onChange={(copyright) => updateFooter({ copyright })} />
    </div>
  );
}

function ContactEditor({
  site,
  updateSite,
}: {
  site: SiteContent;
  updateSite: (mutator: (site: SiteContent) => SiteContent) => void;
}) {
  function patch(patchValue: Partial<SiteContent["contactPage"]>) {
    updateSite((current) => ({
      ...current,
      contactPage: { ...current.contactPage, ...patchValue },
    }));
  }

  return (
    <div className="space-y-4">
      <TextField label="Título" value={site.contactPage.title} onChange={(title) => patch({ title })} />
      <TextField label="Subtítulo" value={site.contactPage.subtitle} onChange={(subtitle) => patch({ subtitle })} multiline />
      <TextField label="Dirección" value={site.contactPage.addressText} onChange={(addressText) => patch({ addressText })} multiline />
      <TextField label="URL del mapa" value={site.footer.mapsUrl} onChange={(mapsUrl) => updateSite((current) => ({ ...current, footer: { ...current.footer, mapsUrl } }))} />
      <TextField label="URL mapa embebido" value={site.contactPage.mapEmbedUrl} onChange={(mapEmbedUrl) => patch({ mapEmbedUrl })} />
      <TextField label="Título Horario" value={site.contactPage.hoursTitle} onChange={(hoursTitle) => patch({ hoursTitle })} />
      {site.contactPage.hours.map((row, index) => (
        <div key={index} className="grid grid-cols-2 gap-2">
          <TextField
            label={`Día ${index + 1}`}
            value={row.label}
            onChange={(label) => patch({ hours: site.contactPage.hours.map((item, i) => (i === index ? { ...item, label } : item)) })}
          />
          <TextField
            label="Horario"
            value={row.value}
            onChange={(value) => patch({ hours: site.contactPage.hours.map((item, i) => (i === index ? { ...item, value } : item)) })}
          />
        </div>
      ))}
      <TextField label="Título ayuda" value={site.contactPage.helpTitle} onChange={(helpTitle) => patch({ helpTitle })} />
      <TextField label="Introducción ayuda" value={site.contactPage.helpIntro} onChange={(helpIntro) => patch({ helpIntro })} multiline />
      {site.contactPage.helpItems.map((item, index) => (
        <TextField
          key={index}
          label={`Ayuda ${index + 1}`}
          value={item}
          onChange={(value) => patch({ helpItems: site.contactPage.helpItems.map((current, i) => (i === index ? value : current)) })}
        />
      ))}
    </div>
  );
}

function BlockContentEditor({
  block,
  updateData,
  updateBlock,
}: {
  block: BuilderBlock;
  updateData: (patch: Record<string, any>) => void;
  updateBlock: (block: BuilderBlock) => void;
}) {
  if (block.type === "hero") {
    return (
      <div className="space-y-4">
        <TextField label="Texto pequeño" value={block.data?.eyebrow || ""} onChange={(eyebrow) => updateData({ eyebrow })} />
        <TextField label="Título opcional" value={block.data?.heading || ""} onChange={(heading) => updateData({ heading })} placeholder="Vacío = muestra el logo/nombre" />
        <TextField label="Descripción" value={block.data?.description || ""} onChange={(description) => updateData({ description })} multiline />
        <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm font-bold">
          Mostrar logo si no hay título
          <input type="checkbox" checked={block.data?.showLogo !== false} onChange={(event) => updateData({ showLogo: event.target.checked })} />
        </label>
        <LinkFields label="Botón principal" value={block.data?.primaryButton || { label: "", href: "/" }} onChange={(primaryButton) => updateData({ primaryButton })} />
        <LinkFields label="Botón secundario" value={block.data?.secondaryButton || { label: "", href: "/" }} onChange={(secondaryButton) => updateData({ secondaryButton })} />
        <ImageFields label="Fondo" value={block.data?.imageUrl || ""} onChange={(imageUrl) => updateData({ imageUrl })} />
      </div>
    );
  }

  if (block.type === "features") {
    const items = Array.isArray(block.data?.items) ? block.data.items : [];
    return (
      <div className="space-y-3">
        {items.map((item: any, index: number) => (
          <div key={index} className="space-y-2 rounded-xl border border-slate-200 p-3">
            <TextField
              label={`Título ${index + 1}`}
              value={item?.title || ""}
              onChange={(title) => updateData({ items: items.map((row: any, i: number) => (i === index ? { ...row, title } : row)) })}
            />
            <TextField
              label="Descripción"
              value={item?.description || ""}
              onChange={(description) => updateData({ items: items.map((row: any, i: number) => (i === index ? { ...row, description } : row)) })}
            />
          </div>
        ))}
        <button type="button" onClick={() => updateData({ items: [...items, { title: "Nuevo bloque", description: "Descripción" }] })} className="w-full rounded-xl border border-dashed border-emerald-400 py-2 text-sm font-black text-emerald-700">
          + Añadir ventaja
        </button>
      </div>
    );
  }

  if (block.type === "categories") {
    const items = Array.isArray(block.data?.items) ? block.data.items : [];
    return (
      <div className="space-y-4">
        <TextField label="Título" value={block.data?.heading || ""} onChange={(heading) => updateData({ heading })} />
        <TextField label="Descripción" value={block.data?.description || ""} onChange={(description) => updateData({ description })} multiline />
        {items.map((item: any, index: number) => (
          <div key={index} className="space-y-2 rounded-xl border border-slate-200 p-3">
            <TextField label="Nombre" value={item?.name || ""} onChange={(name) => updateData({ items: items.map((row: any, i: number) => (i === index ? { ...row, name } : row)) })} />
            <TextField label="Destino" value={item?.href || ""} onChange={(href) => updateData({ items: items.map((row: any, i: number) => (i === index ? { ...row, href } : row)) })} />
            <ImageFields label="Imagen" value={item?.imageUrl || ""} onChange={(imageUrl) => updateData({ items: items.map((row: any, i: number) => (i === index ? { ...row, imageUrl } : row)) })} />
            <button type="button" onClick={() => updateData({ items: items.filter((_: any, i: number) => i !== index) })} className="text-xs font-bold text-rose-600">Eliminar tarjeta</button>
          </div>
        ))}
        <button type="button" onClick={() => updateData({ items: [...items, { name: "Nueva categoría", imageUrl: "", href: "/productos" }] })} className="w-full rounded-xl border border-dashed border-emerald-400 py-2 text-sm font-black text-emerald-700">
          + Añadir categoría
        </button>
      </div>
    );
  }

  if (block.type === "cta") {
    return (
      <div className="space-y-4">
        <TextField label="Título" value={block.data?.title || ""} onChange={(title) => updateData({ title })} />
        <TextField label="Subtítulo" value={block.data?.subtitle || ""} onChange={(subtitle) => updateData({ subtitle })} multiline />
        <LinkFields label="Botón" value={block.data?.button || { label: "", href: "/" }} onChange={(button) => updateData({ button })} />
        <ImageFields label="Fondo" value={block.data?.imageUrl || ""} onChange={(imageUrl) => updateData({ imageUrl })} />
      </div>
    );
  }

  if (block.type === "textImage") {
    return (
      <div className="space-y-4">
        <TextField label="Texto pequeño" value={block.data?.eyebrow || ""} onChange={(eyebrow) => updateData({ eyebrow })} />
        <TextField label="Título" value={block.data?.heading || ""} onChange={(heading) => updateData({ heading })} />
        <TextField label="Texto" value={block.data?.text || ""} onChange={(text) => updateData({ text })} multiline />
        <LinkFields label="Botón" value={block.data?.button || { label: "", href: "/" }} onChange={(button) => updateData({ button })} />
        <ImageFields label="Imagen" value={block.data?.imageUrl || ""} onChange={(imageUrl) => updateData({ imageUrl })} />
        <label className="block text-xs font-bold text-slate-700">
          <span className="mb-1.5 block">Posición de imagen</span>
          <select value={block.data?.imageSide || "right"} onChange={(event) => updateData({ imageSide: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5">
            <option value="left">Izquierda</option>
            <option value="right">Derecha</option>
          </select>
        </label>
      </div>
    );
  }

  if (block.type === "gallery") {
    const images = Array.isArray(block.data?.images) ? block.data.images : [];
    return (
      <div className="space-y-4">
        <TextField label="Título" value={block.data?.heading || ""} onChange={(heading) => updateData({ heading })} />
        <TextField label="Descripción" value={block.data?.description || ""} onChange={(description) => updateData({ description })} multiline />
        {images.map((item: any, index: number) => (
          <div key={index} className="space-y-2 rounded-xl border border-slate-200 p-3">
            <ImageFields label={`Imagen ${index + 1}`} value={item?.url || ""} onChange={(url) => updateData({ images: images.map((row: any, i: number) => (i === index ? { ...row, url } : row)) })} />
            <TextField label="Texto alternativo" value={item?.alt || ""} onChange={(alt) => updateData({ images: images.map((row: any, i: number) => (i === index ? { ...row, alt } : row)) })} />
            <button type="button" onClick={() => updateData({ images: images.filter((_: any, i: number) => i !== index) })} className="text-xs font-bold text-rose-600">Eliminar imagen</button>
          </div>
        ))}
        <button type="button" onClick={() => updateData({ images: [...images, { url: "", alt: "Nueva imagen" }] })} className="w-full rounded-xl border border-dashed border-emerald-400 py-2 text-sm font-black text-emerald-700">+ Añadir imagen</button>
      </div>
    );
  }

  const items = Array.isArray(block.data?.items) ? block.data.items : [];
  return (
    <div className="space-y-4">
      <TextField label="Título" value={block.data?.heading || ""} onChange={(heading) => updateData({ heading })} />
      <TextField label="Descripción" value={block.data?.description || ""} onChange={(description) => updateData({ description })} multiline />
      {items.map((item: any, index: number) => (
        <div key={index} className="space-y-2 rounded-xl border border-slate-200 p-3">
          <TextField label="Nombre" value={item?.name || ""} onChange={(name) => updateData({ items: items.map((row: any, i: number) => (i === index ? { ...row, name } : row)) })} />
          <TextField label="Testimonio" value={item?.text || ""} onChange={(text) => updateData({ items: items.map((row: any, i: number) => (i === index ? { ...row, text } : row)) })} multiline />
          <RangeField label="Estrellas" value={Number(item?.rating || 5)} min={1} max={5} onChange={(rating) => updateData({ items: items.map((row: any, i: number) => (i === index ? { ...row, rating } : row)) })} />
          <button type="button" onClick={() => updateData({ items: items.filter((_: any, i: number) => i !== index) })} className="text-xs font-bold text-rose-600">Eliminar testimonio</button>
        </div>
      ))}
      <button type="button" onClick={() => updateData({ items: [...items, { name: "Cliente", text: "Nuevo testimonio", rating: 5 }] })} className="w-full rounded-xl border border-dashed border-emerald-400 py-2 text-sm font-black text-emerald-700">+ Añadir testimonio</button>
    </div>
  );
}

function DesignEditor({
  block,
  update,
}: {
  block: BuilderBlock;
  update: (patch: Partial<BuilderBlockDesign>) => void;
}) {
  const design = block.design;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-bold text-slate-700">
          <span className="mb-1.5 block">Fondo</span>
          <input type="color" value={design.backgroundColor} onChange={(event) => update({ backgroundColor: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200" />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          <span className="mb-1.5 block">Texto</span>
          <input type="color" value={design.textColor} onChange={(event) => update({ textColor: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200" />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          <span className="mb-1.5 block">Acento</span>
          <input type="color" value={design.accentColor} onChange={(event) => update({ accentColor: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200" />
        </label>
        <label className="block text-xs font-bold text-slate-700">
          <span className="mb-1.5 block">Alineación</span>
          <select value={design.alignment} onChange={(event) => update({ alignment: event.target.value as any })} className="h-10 w-full rounded-lg border border-slate-200 px-2">
            <option value="left">Izquierda</option>
            <option value="center">Centro</option>
            <option value="right">Derecha</option>
          </select>
        </label>
      </div>
      <label className="block text-xs font-bold text-slate-700">
        <span className="mb-1.5 block">Tipografía</span>
        <select
          value={design.fontFamily || "inherit"}
          onChange={(event) => update({ fontFamily: event.target.value })}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
        >
          <option value="inherit">Tipografía del sitio</option>
          <option value="Georgia, 'Times New Roman', serif">Editorial / Serif</option>
          <option value="Inter, system-ui, sans-serif">Inter / Moderna</option>
          <option value="'Helvetica Neue', Arial, sans-serif">Helvetica / Limpia</option>
          <option value="'Trebuchet MS', Arial, sans-serif">Trebuchet / Amable</option>
        </select>
      </label>
      <RangeField label="Altura / relleno vertical" value={design.paddingY} min={16} max={160} suffix="px" onChange={(paddingY) => update({ paddingY })} />
      <RangeField label="Ancho máximo" value={design.maxWidth} min={760} max={1600} step={20} suffix="px" onChange={(maxWidth) => update({ maxWidth })} />
      <RangeField label="Tamaño del título" value={design.headingScale} min={70} max={180} suffix="%" onChange={(headingScale) => update({ headingScale })} />
      <RangeField label="Separación" value={design.gap} min={0} max={64} suffix="px" onChange={(gap) => update({ gap })} />
      <RangeField label="Redondeado" value={design.radius} min={0} max={48} suffix="px" onChange={(radius) => update({ radius })} />
      {["features", "categories", "gallery", "testimonials"].includes(block.type) && (
        <RangeField label="Columnas" value={design.columns} min={1} max={6} onChange={(columns) => update({ columns })} />
      )}
      {["hero", "cta"].includes(block.type) && (
        <>
          <RangeField label="Oscurecer imagen" value={design.overlay} min={0} max={85} suffix="%" onChange={(overlay) => update({ overlay })} />
          <RangeField label="Zoom de imagen" value={design.imageZoom || 100} min={100} max={180} suffix="%" onChange={(imageZoom) => update({ imageZoom })} />
          <RangeField label="Altura de sección" value={design.minHeight || (block.type === "hero" ? 650 : 0)} min={block.type === "hero" ? 360 : 0} max={900} step={10} suffix="px" onChange={(minHeight) => update({ minHeight })} />
          <label className="block text-xs font-bold text-slate-700">
            <span className="mb-1.5 block">Posición de la imagen</span>
            <select value={design.imagePosition} onChange={(event) => update({ imagePosition: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5">
              <option value="center">Centro</option>
              <option value="left center">Izquierda</option>
              <option value="right center">Derecha</option>
              <option value="center top">Arriba</option>
              <option value="center bottom">Abajo</option>
            </select>
          </label>
        </>
      )}
    </div>
  );
}

function ContactPreview({
  site,
  selected,
  onSelect,
}: {
  site: SiteContent;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect} className={`block w-full text-left ${selected ? "ring-4 ring-inset ring-emerald-600" : ""}`}>
      <div className="bg-slate-50 px-8 py-10">
        <h1 className="text-4xl font-black">{site.contactPage.title}</h1>
        <p className="mt-3 max-w-2xl text-slate-500">{site.contactPage.subtitle}</p>
      </div>
      <div className="grid gap-5 p-8 md:grid-cols-2">
        <div className="space-y-3">
          <div className="rounded-2xl bg-emerald-600 p-5 text-white"><p className="font-black">{site.contactPage.whatsappTitle}</p><p className="mt-1">{site.footer.whatsappLabel}</p></div>
          <div className="rounded-2xl bg-slate-900 p-5 text-white"><p className="font-black">{site.contactPage.callTitle}</p><p className="mt-1">{site.footer.callPhone}</p></div>
          <div className="rounded-2xl bg-blue-600 p-5 text-white"><p className="font-black">{site.contactPage.locationTitle}</p><p className="mt-1">{site.contactPage.addressText}</p></div>
        </div>
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 p-5"><p className="font-black">{site.contactPage.hoursTitle}</p>{site.contactPage.hours.map((row, index) => <div key={index} className="mt-2 flex justify-between text-sm"><span>{row.label}</span><span className="text-slate-500">{row.value}</span></div>)}</div>
          <div className="rounded-2xl border border-slate-200 p-5"><p className="font-black">{site.contactPage.addressTitle}</p><p className="mt-2 text-slate-500">{site.contactPage.addressText}</p></div>
        </div>
      </div>
    </button>
  );
}
