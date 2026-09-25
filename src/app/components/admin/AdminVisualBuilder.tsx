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
  Home,
  LayoutTemplate,
  Monitor,
  Plus,
  BriefcaseBusiness,
  Package,
  Phone,
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
import { backendApi, backendStorage } from "../../lib/backendStorage";
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
type PageMode = "home" | "products" | "services" | "contact";
type SelectedTarget = "header" | "footer" | "products" | "services" | "contact" | string;
type EditorTab = "contenido" | "diseno" | "fondo" | "avanzado";

type StoredVersion = {
  id: string;
  at: string;
  label: string;
  content: string;
};

type MenuIconSettings = {
  home: string;
  products: string;
  services: string;
  herencia: string;
};

type HerenciaSettings = {
  enabled: boolean;
  url: string;
};

const defaultMenuIcons: MenuIconSettings = {
  home: "Home",
  products: "Leaf",
  services: "Briefcase",
  herencia: "Bot",
};

function readJsonValue<T>(key: string, fallback: T): T {
  try {
    const raw = backendStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

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
      ...site.builder,
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
  showIconControl = false,
}: {
  label: string;
  value: SiteLink;
  onChange: (next: SiteLink) => void;
  showIconControl?: boolean;
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
      {showIconControl && <label className="flex items-center justify-between text-xs font-semibold text-slate-700">Mostrar icono <input type="checkbox" checked={value?.showIcon === true} onChange={(event) => onChange({ ...value, showIcon: event.target.checked })} /></label>}
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
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [media, setMedia] = useState<Array<{ name: string; path: string; url: string }>>([]);

  async function loadLibrary() {
    setMediaLoading(true);
    try {
      const result = await backendApi.listSiteMedia();
      setMedia(Array.isArray(result.media) ? result.media : []);
      setLibraryOpen(true);
    } catch (error: any) {
      toast.error(error?.message || "No se pudo abrir la biblioteca multimedia");
    } finally {
      setMediaLoading(false);
    }
  }

  async function onFile(file?: File) {
    if (!file) return;
    setWorking(true);
    try {
      const compressed = await compressImage(file);
      try {
        const result = await backendApi.uploadSiteMedia({
          dataUrl: compressed,
          filename: file.name,
        });
        if (!result.media?.url) throw new Error("El servidor no devolvió la URL de la imagen");
        onChange(result.media.url);
        toast.success("Imagen subida a la biblioteca");
      } catch (uploadError: any) {
        // Conserva la edición incluso si Supabase Storage no está disponible.
        onChange(compressed);
        toast.warning(
          uploadError?.message
            ? `La imagen se guardó en el contenido, pero no en la biblioteca: ${uploadError.message}`
            : "La imagen se guardó en el contenido, pero no en la biblioteca"
        );
      }
    } catch (error: any) {
      toast.error(error?.message || "No se pudo cargar la imagen");
    } finally {
      setWorking(false);
    }
  }

  async function removeMedia(item: { path: string; url: string }) {
    if (!window.confirm("¿Eliminar esta imagen de la biblioteca?")) return;
    try {
      await backendApi.deleteSiteMedia(item.path);
      setMedia((current) => current.filter((entry) => entry.path !== item.path));
      if (value === item.url) onChange("");
      toast.success("Imagen eliminada de la biblioteca");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo eliminar la imagen");
    }
  }

  return (
    <>
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
          <button
            type="button"
            onClick={() => void loadLibrary()}
            disabled={mediaLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            {mediaLoading ? "Cargando..." : "Biblioteca"}
          </button>
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

      {libraryOpen && (
        <div className="fixed inset-0 z-[150] grid place-items-center bg-black/50 p-4">
          <div className="max-h-[82vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-5">
              <div>
                <h3 className="text-xl font-black">Biblioteca multimedia</h3>
                <p className="text-sm text-slate-500">Reutiliza imágenes ya subidas sin volver a cargarlas.</p>
              </div>
              <button type="button" onClick={() => setLibraryOpen(false)} className="rounded-lg p-2 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[68vh] overflow-y-auto p-4">
              {!media.length ? (
                <div className="rounded-xl bg-slate-50 p-10 text-center text-sm text-slate-500">
                  Todavía no hay imágenes en la biblioteca.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {media.map((item) => (
                    <div key={item.path} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <button
                        type="button"
                        onClick={() => {
                          onChange(item.url);
                          setLibraryOpen(false);
                        }}
                        className="block w-full"
                      >
                        <img src={item.url} alt={item.name} className="h-36 w-full object-cover" />
                        <p className="truncate px-3 py-2 text-left text-xs font-bold">{item.name}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeMedia(item)}
                        className="w-full border-t border-slate-100 px-3 py-2 text-xs font-bold text-rose-600"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
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
    services: "Servicios",
    products: "Productos",
    buttons: "Botones",
    elements: "Contenido personalizado",
    categories: "Categorías",
    cta: "Banner",
    textImage: "Texto + imagen",
    gallery: "Galería",
    testimonials: "Testimonios",
  };
  return labels[type];
}

function blockThumbnail(block: BuilderBlock): string {
  const first = block.data?.items?.[0] || block.data?.images?.[0];
  return String(block.data?.imageUrl || first?.imageUrl || first?.url || (typeof first === "string" ? first : "") || "");
}

export function AdminVisualBuilder({
  onClose,
  onOpenTheme,
  onPublished,
}: {
  onClose: () => void;
  onOpenTheme?: () => void;
  onPublished?: () => void;
}) {
  const [site, setSite] = useState<SiteContent>(() => {
    const draft = backendStorage.getItem("siteContentDraft");
    return hydrateLegacyBanners(parseSiteContent(draft || backendStorage.getItem("siteContent")));
  });
  const [publishedSite, setPublishedSite] = useState<SiteContent>(() =>
    hydrateLegacyBanners(parseSiteContent(backendStorage.getItem("siteContent")))
  );
  const initialAuxDraft = readJsonValue<{
    menuIcons?: MenuIconSettings;
    herenciaSettings?: HerenciaSettings;
  }>("visualBuilderAuxDraft", {});
  const [menuIcons, setMenuIcons] = useState<MenuIconSettings>(
    initialAuxDraft.menuIcons || readJsonValue<MenuIconSettings>("menuIcons", defaultMenuIcons)
  );
  const [publishedMenuIcons, setPublishedMenuIcons] = useState<MenuIconSettings>(
    readJsonValue<MenuIconSettings>("menuIcons", defaultMenuIcons)
  );
  const [herenciaSettings, setHerenciaSettings] = useState<HerenciaSettings>(
    initialAuxDraft.herenciaSettings ||
      readJsonValue<HerenciaSettings>("herenciaSettings", { enabled: false, url: "" })
  );
  const [publishedHerenciaSettings, setPublishedHerenciaSettings] = useState<HerenciaSettings>(
    readJsonValue<HerenciaSettings>("herenciaSettings", { enabled: false, url: "" })
  );
  const [selected, setSelected] = useState<SelectedTarget>(() => ensureBuilderBlocks(site)[0]?.id || "header");
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
  const canvasRef = useRef<HTMLElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(900);
  const hydratedRef = useRef(false);

  const blocks = useMemo(() => ensureBuilderBlocks(site), [site]);
  const selectedBlock = blocks.find((block) => block.id === selected) || null;
  const hasUnpublishedChanges = useMemo(
    () => JSON.stringify(site) !== JSON.stringify(publishedSite) || JSON.stringify(menuIcons) !== JSON.stringify(publishedMenuIcons) || JSON.stringify(herenciaSettings) !== JSON.stringify(publishedHerenciaSettings),
    [site, publishedSite, menuIcons, publishedMenuIcons, herenciaSettings, publishedHerenciaSettings]
  );

  useEffect(() => {
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    setDraftState("pendiente");
    const timer = window.setTimeout(async () => {
      setDraftState("guardando");
      const results = await Promise.all([
        backendStorage.setItem("siteContentDraft", JSON.stringify(site)),
        backendStorage.setItem("visualBuilderAuxDraft", JSON.stringify({ menuIcons, herenciaSettings })),
      ]);
      setDraftState(results.every((result) => result.ok && result.synced) ? "guardado" : "pendiente");
    }, 900);
    return () => window.clearTimeout(timer);
  }, [site, menuIcons, herenciaSettings]);

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
        ...current.builder,
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
      return { ...current, builder: { ...current.builder, blocks: reordered } };
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
      builder: { ...current.builder, blocks: [...ensureBuilderBlocks(current), block] },
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
      return { ...current, builder: { ...current.builder, blocks: next } };
    });
    setSelected(duplicate.id);
  }

  function removeBlock(block: BuilderBlock) {
    if (!window.confirm(`¿Eliminar la sección “${block.name}”?`)) return;
    updateSite((current) => ({
      ...current,
      builder: {
        ...current.builder,
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
    const [result, auxResult] = await Promise.all([
      backendStorage.setItem("siteContentDraft", JSON.stringify(site)),
      backendStorage.setItem(
        "visualBuilderAuxDraft",
        JSON.stringify({ menuIcons, herenciaSettings })
      ),
    ]);
    if (!result.ok || !auxResult.ok) {
      setDraftState("pendiente");
      toast.error(result.error || "No se pudo guardar el borrador");
      return;
    }
    setDraftState("guardado");
    toast.success("Borrador guardado");
  }

  async function leaveEditor(destination: () => void) {
    await saveDraftNow();
    destination();
  }

  async function publish() {
    const invalidButton = blocks.find((block) => block.type === "buttons" && Array.isArray(block.data?.buttons) && block.data.buttons.some((button: any) => {
      if (button.visible === false) return false;
      const destination = String(button.href || "").trim();
      if (!String(button.label || "").trim()) return true;
      if (!["page", "url", "product", "category", "service", "whatsapp", "email", "phone", "cart", "checkout"].includes(button.action)) return true;
      if (["cart", "checkout"].includes(button.action)) return false;
      if (button.action === "url") return !/^https?:\/\/[^\s]+$/i.test(destination);
      if (button.action === "page") return !destination.startsWith("/") || destination.startsWith("//");
      if (button.action === "email") return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination);
      return !destination;
    }));
    if (invalidButton) {
      setSelected(invalidButton.id);
      setTab("contenido");
      toast.error(`Revisa los botones de “${invalidButton.name}” antes de publicar`);
      return;
    }
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
      while (nextHistory.length > 1 && JSON.stringify(nextHistory).length > 2_000_000) {
        nextHistory = nextHistory.slice(0, -1);
      }

      const hero = ensureBuilderBlocks(nextPublished).find((block) => block.type === "hero");
      const cta = ensureBuilderBlocks(nextPublished).find((block) => block.type === "cta");

      const values = {
        siteContent: JSON.stringify(nextPublished),
        siteContentDraft: JSON.stringify(nextPublished),
        siteContentHistory: JSON.stringify(nextHistory),
        visualBuilderAuxDraft: "{}",
        menuIcons: JSON.stringify(menuIcons),
        herenciaSettings: JSON.stringify(herenciaSettings),
        heroBanner: JSON.stringify({ imageUrl: hero?.data?.imageUrl || "" }),
        ctaBanner: JSON.stringify({ imageUrl: cta?.data?.imageUrl || "" }),
      };
      await backendApi.publishSite(values);
      backendStorage.applyPublishedValues(values);

      setSite(nextPublished);
      setPublishedSite(nextPublished);
      setVersions(nextHistory);
      setPublishedMenuIcons(menuIcons);
      setPublishedHerenciaSettings(herenciaSettings);
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
    setMenuIcons(clone(publishedMenuIcons));
    setHerenciaSettings(clone(publishedHerenciaSettings));
    void backendStorage.removeItem("visualBuilderAuxDraft");
    toast.info("Se ha recuperado la versión publicada");
  }

  const previewWidth = deviceWidth(device);
  const previewScale = Math.min(1, Math.max(0.3, (canvasWidth - 32) / previewWidth));

  useEffect(() => {
    if (!canvasRef.current) return;
    const observer = new ResizeObserver(([entry]) => setCanvasWidth(entry.contentRect.width));
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);

  function choosePage(mode: PageMode) {
    setPageMode(mode);
    setSelected(mode === "home" ? (blocks[0]?.id || "header") : mode);
    setTab("contenido");
  }

  function openRealPreview() {
    try {
      window.sessionStorage.setItem("herenciaBuilderPreview", JSON.stringify(syncBuilderToLegacy(site, blocks)));
      window.sessionStorage.setItem("herenciaBuilderPreviewAux", JSON.stringify({ menuIcons, herenciaSettings }));
      const path = pageMode === "home" ? "/" : pageMode === "products" ? "/productos" : pageMode === "services" ? "/servicios" : "/contacto";
      window.open(`${path}?preview=builder`, "_blank");
    } catch {
      toast.error("No se pudo abrir la vista previa de este borrador");
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex bg-[#eef0ec] text-slate-900">
      <aside className="hidden w-[190px] shrink-0 flex-col bg-[#19221e] text-white xl:flex">
        <div className="flex h-[74px] items-center gap-2.5 border-b border-white/10 px-5">
          <img src={logo} alt="Logo de Herencia" className="h-10 w-10 object-contain brightness-0 invert" />
          <div><p className="font-serif text-lg leading-5 tracking-wide">HERENCIA</p><p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/55">Administración</p></div>
        </div>
        <nav aria-label="Páginas del editor" className="flex-1 space-y-1 overflow-y-auto px-3 py-5 text-[13px]">
          {([
            ["home", Home, "Inicio"],
            ["products", Package, "Productos"],
            ["services", BriefcaseBusiness, "Servicios"],
            ["contact", Phone, "Contacto"],
          ] as const).map(([mode, Icon, label]) => <button key={mode} type="button" onClick={() => choosePage(mode)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${pageMode === mode ? "bg-[#315f47] text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}><Icon className="h-4 w-4" />{label}</button>)}
          <p className="px-3 pb-1 pt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Contenido</p>
          <div className="rounded-lg bg-[#315f47] px-3 py-2.5 font-semibold text-white"><span className="flex items-center gap-3"><LayoutTemplate className="h-4 w-4" />Editor visual</span></div>
          <button type="button" onClick={() => { setSelected("header"); setTab("contenido"); }} className="block w-full rounded-lg px-5 py-2 text-left text-white/65 hover:bg-white/10">Menú y logo</button>
          <button type="button" onClick={() => { setSelected("footer"); setTab("contenido"); }} className="block w-full rounded-lg px-5 py-2 text-left text-white/65 hover:bg-white/10">Footer</button>
          {onOpenTheme && <button type="button" onClick={() => void leaveEditor(onOpenTheme)} className="block w-full rounded-lg px-5 py-2 text-left text-white/65 hover:bg-white/10">Plantilla y colores ↗</button>}
        </nav>
        <button type="button" onClick={() => void leaveEditor(onClose)} className="m-3 rounded-lg border border-white/20 px-3 py-3 text-left text-xs font-semibold text-white/85 hover:bg-white/10">← Volver al panel</button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-sm sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => void leaveEditor(onClose)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Panel</span>
          </button>
          <div className="hidden min-w-0 md:block">
            <p className="truncate font-semibold text-[#213d2c]">Editor visual <span className="font-normal text-slate-400">/ {pageMode === "home" ? "Inicio" : pageMode === "products" ? "Productos" : pageMode === "services" ? "Servicios" : "Contacto"}</span></p>
            <p className="text-xs text-slate-500">
              {draftState === "guardando"
                ? "Guardando borrador…"
                : draftState !== "guardado"
                ? "Borrador pendiente de guardar"
                : hasUnpublishedChanges
                ? "Borrador guardado · Sin publicar"
                : "Todo publicado"}
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

          <div className="hidden rounded-xl border border-slate-200 bg-[#f6f8f5] p-1 lg:flex">
            {([
              ["desktop", Monitor],
              ["tablet", Tablet],
              ["mobile", Smartphone],
            ] as const).map(([value, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => setDevice(value)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold ${device === value ? "bg-white text-[#275d42] shadow-sm" : "text-slate-500"}`}
                title={value === "desktop" ? "Escritorio" : value === "tablet" ? "Tablet" : "Móvil"}
              >
                <Icon className="h-4 w-4" /><span className="hidden 2xl:inline">{value === "desktop" ? "Escritorio" : value === "tablet" ? "Tablet" : "Móvil"}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={openRealPreview}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-2 py-2 text-sm font-bold sm:px-3"
          >
            <ExternalLink className="h-4 w-4" /><span className="hidden xl:inline">Vista previa real</span>
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

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[215px_minmax(0,1fr)_320px]">
        <aside className="hidden overflow-y-auto border-r border-slate-200 bg-[#fbfcfa] lg:block">
          <div className="border-b border-slate-200 p-3">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Página</label>
            <select value={pageMode} onChange={(event) => choosePage(event.target.value as PageMode)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#284732]">
              <option value="home">Inicio</option><option value="products">Productos</option><option value="services">Servicios</option><option value="contact">Contacto</option>
            </select>
          </div>

          <div className="p-3">
            <div className="mb-3 flex items-center justify-between px-1"><p className="text-xs font-bold text-[#253b2b]">Secciones de la página</p><button type="button" onClick={() => setAddOpen((open) => !open)} title="Añadir sección" className="rounded-md border border-slate-200 bg-white p-1.5 text-[#305b41]"><Plus className="h-4 w-4" /></button></div>

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
                    className={`group overflow-hidden rounded-lg border bg-white transition ${selected === block.id ? "border-[#2f6848] bg-[#f1f8f3] shadow-sm" : "border-slate-200 hover:border-[#a5bdab]"} ${draggingId === block.id ? "opacity-50" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(block.id);
                        setTab("contenido");
                      }}
                      className="flex w-full items-center gap-2 p-1.5 text-left"
                    >
                      <div className="h-12 w-14 shrink-0 overflow-hidden rounded border border-slate-200 bg-[#edf2eb]">{blockThumbnail(block) ? <img src={blockThumbnail(block)} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[#7c9b84]"><LayoutTemplate className="h-5 w-5" /></div>}</div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">{block.name}</p>
                        <p className="truncate text-[10px] text-slate-500">{blockTypeLabel(block.type)}</p>
                      </div>
                      <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-400" />
                      <span className={block.visible ? "text-emerald-600" : "text-slate-300"}>
                        {block.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </span>
                    </button>
                    <div className={`items-center justify-end gap-1 border-t border-slate-100 px-2 py-1 ${selected === block.id ? "flex" : "hidden group-hover:flex group-focus-within:flex"}`}>
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
                      {(["elements", "textImage", "gallery", "testimonials", "cta", "categories", "services", "products", "buttons", "features", "hero"] as BuilderBlockType[]).map((type) => (
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
                  setSelected(pageMode);
                  setTab("contenido");
                }}
                className={`mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left ${selected === pageMode ? "border-emerald-600 bg-emerald-50" : "border-slate-200"}`}
              >
                <Clock3 className="h-4 w-4 text-emerald-700" />
                <div>
                  <p className="text-sm font-black">{pageMode === "products" ? "Página de productos" : pageMode === "services" ? "Página de servicios" : "Página de contacto"}</p>
                  <p className="text-xs text-slate-500">{pageMode === "contact" ? "Dirección, horario y mapa" : "Textos y acciones"}</p>
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

        <main ref={canvasRef} className="min-w-0 overflow-auto bg-[#e9ede8] p-3 sm:p-5 max-lg:pb-[50vh]">
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm lg:hidden">
            <select
              value={selected}
              onChange={(event) => {
                const value = event.target.value;
                setSelected(value);
                if (value === "contact") setPageMode("contact");
                else if (value === "products") setPageMode("products");
                else if (value === "services") setPageMode("services");
                else if (pageMode !== "home") setPageMode("home");
              }}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold"
            >
              <option value="header">Header</option>
              {blocks.map((block) => (
                <option key={block.id} value={block.id}>
                  {block.name}
                </option>
              ))}
              <option value="footer">Footer</option>
              <option value="products">Productos</option>
              <option value="services">Servicios</option>
              <option value="contact">Contacto</option>
            </select>
            <div className="flex rounded-lg bg-slate-100 p-1">
              {([
                ["desktop", Monitor],
                ["tablet", Tablet],
                ["mobile", Smartphone],
              ] as const).map(([value, Icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDevice(value)}
                  className={`rounded-md p-1.5 ${device === value ? "bg-white shadow-sm" : ""}`}
                  title={value}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
            {pageMode === "home" && (
              <button
                type="button"
                onClick={() => setAddOpen((open) => !open)}
                className="rounded-lg bg-emerald-700 p-2 text-white"
                title="Añadir sección"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>

          {addOpen && pageMode === "home" && (
            <div className="relative z-40 mb-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xl lg:hidden">
              {(["elements", "textImage", "gallery", "testimonials", "cta", "categories", "services", "products", "buttons", "features", "hero"] as BuilderBlockType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addBlock(type)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-black"
                >
                  <Plus className="h-3.5 w-3.5 text-emerald-700" />
                  {blockTypeLabel(type)}
                </button>
              ))}
            </div>
          )}
          <div
            className="builder-page-container mx-auto origin-top overflow-hidden rounded-lg border border-[#d6ddd3] bg-white shadow-[0_16px_50px_rgba(23,46,29,0.14)] transition-all duration-300"
            style={{ width: `${previewWidth}px`, maxWidth: "none", zoom: previewScale }}
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
              <div className="builder-preview-nav hidden gap-4 text-xs md:flex">
                <span>{site.navigation.home.label}</span>
                <span>{site.navigation.products.label}</span>
                <span>{site.navigation.services.label}</span>
                {herenciaSettings.enabled && <span>{site.navigation.herencia.label}</span>}
              </div>
            </div>

            {pageMode === "home" ? (
              blocks.map((block) => (
                <div
                  key={block.id}
                  onClick={() => setSelected(block.id)}
                  onClickCapture={(event) => {
                    const target = event.target as HTMLElement;
                    if (target.closest("a")) event.preventDefault();
                    if (target.closest("img")) setTab(["hero", "cta", "textImage"].includes(block.type) ? "fondo" : "contenido");
                    else if (target.closest("a")) setTab("contenido");
                  }}
                  className={`relative cursor-pointer ${selected === block.id ? "ring-4 ring-inset ring-emerald-600" : "hover:ring-2 hover:ring-inset hover:ring-emerald-400/50"}`}
                >
                  {!block.visible && (
                    <div className="absolute inset-0 z-20 grid place-items-center bg-white/80 text-sm font-black text-slate-500">
                      Sección oculta
                    </div>
                  )}
                  <StorefrontBlock block={{ ...block, visible: true }} site={site} logoFallback={logo} preview onEditField={(key, value) => updateBlockData(block.id, { [key]: value })} />
                </div>
              ))
            ) : pageMode === "contact" ? (
              <ContactPreview site={site} selected={selected === "contact"} onSelect={() => setSelected("contact")} />
            ) : (
              <button type="button" onClick={() => setSelected(pageMode)} className={`block w-full px-8 py-20 text-left ${selected === pageMode ? "ring-4 ring-inset ring-emerald-600" : ""}`}>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Herencia · {pageMode === "products" ? "Tienda" : "Servicios"}</p>
                <h1 className="mt-4 font-serif text-5xl font-bold text-[#223c2b]">{pageMode === "products" ? site.productsPage.title : site.servicesPage.title}</h1>
                <p className="mt-5 max-w-xl text-lg text-slate-600">{pageMode === "products" ? site.productsPage.subtitle : site.servicesPage.subtitle}</p>
                <div className="mt-12 grid grid-cols-2 gap-5 md:grid-cols-3">{site.categories.slice(0, 3).map((category, index) => <div key={index} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">{category.imageUrl && <img src={category.imageUrl} alt="" className="h-40 w-full object-cover" />}<p className="p-4 font-semibold">{pageMode === "products" ? category.name : [site.servicesPage.gardeningHeading, site.servicesPage.coursesHeading, site.servicesPage.advisoryHeading][index]}</p></div>)}</div>
              </button>
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

        <aside className="overflow-y-auto border-l border-slate-200 bg-white max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-[110] max-lg:h-[48vh] max-lg:border-l-0 max-lg:border-t max-lg:shadow-[0_-12px_35px_rgba(15,23,42,0.18)]">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Editando</p>
                <h2 className="mt-1 text-lg font-black">
                  {selectedBlock?.type === "hero" ? "Portada principal" : selectedBlock?.name || (selected === "header" ? "Header" : selected === "footer" ? "Footer" : selected === "products" ? "Productos" : selected === "services" ? "Servicios" : "Contacto")}
                </h2>
              </div>
              {selectedBlock && (
                <button type="button" onClick={() => updateBlock(selectedBlock.id, (block) => ({ ...block, visible: !block.visible }))} className="rounded-lg border border-slate-200 p-2">
                  {selectedBlock.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              )}
            </div>

            {(selectedBlock || selected === "header" || selected === "footer") && (
              <div className="mt-3 grid grid-cols-4 rounded-lg bg-[#f2f4f1] p-1">
                {([
                  ["contenido", "Contenido"],
                  ["diseno", "Diseño"],
                  ["fondo", "Fondo"],
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
            {selected === "header" && tab === "contenido" && (
              <HeaderEditor
                site={site}
                updateSite={updateSite}
                menuIcons={menuIcons}
                setMenuIcons={setMenuIcons}
                herenciaSettings={herenciaSettings}
                setHerenciaSettings={setHerenciaSettings}
              />
            )}
            {selected === "header" && (tab === "diseno" || tab === "fondo") && <HeaderDesignEditor site={site} updateSite={updateSite} />}
            {selected === "header" && tab === "avanzado" && (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                El header usa los enlaces globales del sitio. Puedes cambiar sus destinos en Contenido y su apariencia en Diseño.
              </div>
            )}

            {selected === "footer" && tab === "contenido" && <FooterEditor site={site} updateSite={updateSite} />}
            {selected === "footer" && (tab === "diseno" || tab === "fondo") && <FooterDesignEditor site={site} updateSite={updateSite} />}
            {selected === "footer" && tab === "avanzado" && (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                El footer es global: los cambios se aplican a todas las páginas.
              </div>
            )}

            {selected === "products" && <ProductsPageEditor site={site} updateSite={updateSite} />}
            {selected === "services" && <ServicesPageEditor site={site} updateSite={updateSite} />}
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

            {selectedBlock && tab === "fondo" && (
              <BlockBackgroundEditor block={selectedBlock} updateData={(patch) => updateBlockData(selectedBlock.id, patch)} update={(patch) => updateDesign(selectedBlock.id, patch)} />
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
                  <button
                    type="button"
                    onClick={() => moveBlock(selectedBlock.id, -1)}
                    disabled={blocks.findIndex((item) => item.id === selectedBlock.id) <= 0}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-black disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" /> Subir
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(selectedBlock.id, 1)}
                    disabled={blocks.findIndex((item) => item.id === selectedBlock.id) >= blocks.length - 1}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-black disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" /> Bajar
                  </button>
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
    </div>
  );
}

function HeaderEditor({
  site,
  updateSite,
  menuIcons,
  setMenuIcons,
  herenciaSettings,
  setHerenciaSettings,
}: {
  site: SiteContent;
  updateSite: (mutator: (site: SiteContent) => SiteContent) => void;
  menuIcons: MenuIconSettings;
  setMenuIcons: (value: MenuIconSettings) => void;
  herenciaSettings: HerenciaSettings;
  setHerenciaSettings: (value: HerenciaSettings) => void;
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
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-black uppercase tracking-wider text-slate-500">Iconos del menú</p>
        {(["home", "products", "services", "herencia"] as const).map((key) => (
          <label key={key} className="block text-xs font-bold text-slate-700">
            <span className="mb-1.5 block">
              {key === "home" ? "Inicio" : key === "products" ? "Productos" : key === "services" ? "Servicios" : "Herenc(IA)"}
            </span>
            <select
              value={menuIcons[key]}
              onChange={(event) => setMenuIcons({ ...menuIcons, [key]: event.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
            >
              {["Home", "House", "Sparkles", "Flower", "Flower2", "Leaf", "LeafyGreen", "Package", "ShoppingBag", "Briefcase", "Scissors", "Store", "Building", "Bot", "Brain", "Zap", "Star"].map((icon) => (
                <option key={icon} value={icon}>{icon}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <label className="flex items-center justify-between text-sm font-bold">
          Mostrar Herenc(IA) en el menú
          <input
            type="checkbox"
            checked={herenciaSettings.enabled}
            onChange={(event) =>
              setHerenciaSettings({ ...herenciaSettings, enabled: event.target.checked })
            }
          />
        </label>
        <TextField
          label="URL interna/configuración Herenc(IA)"
          value={herenciaSettings.url}
          onChange={(url) => setHerenciaSettings({ ...herenciaSettings, url })}
          placeholder="Opcional"
        />
      </div>
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
      <TextField label="Crédito / desarrollador" value={site.footer.developerLabel} onChange={(developerLabel) => updateFooter({ developerLabel })} />
      <LinkFields
        label="Privacidad"
        value={{ label: site.footer.privacyLabel, href: site.footer.privacyHref }}
        onChange={(value) => updateFooter({ privacyLabel: value.label, privacyHref: value.href })}
      />
      <LinkFields
        label="Cookies"
        value={{ label: site.footer.cookiesLabel, href: site.footer.cookiesHref }}
        onChange={(value) => updateFooter({ cookiesLabel: value.label, cookiesHref: value.href })}
      />
      <LinkFields
        label="Términos"
        value={{ label: site.footer.termsLabel, href: site.footer.termsHref }}
        onChange={(value) => updateFooter({ termsLabel: value.label, termsHref: value.href })}
      />
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <label className="flex items-center justify-between text-sm font-bold">
          Botón flotante de WhatsApp
          <input
            type="checkbox"
            checked={site.floatingWhatsapp.enabled}
            onChange={(event) =>
              updateSite((current) => ({
                ...current,
                floatingWhatsapp: { ...current.floatingWhatsapp, enabled: event.target.checked },
              }))
            }
          />
        </label>
        <TextField
          label="Número del botón flotante"
          value={site.floatingWhatsapp.phone}
          onChange={(phone) =>
            updateSite((current) => ({
              ...current,
              floatingWhatsapp: { ...current.floatingWhatsapp, phone },
            }))
          }
        />
        <TextField
          label="Descripción accesible"
          value={site.floatingWhatsapp.ariaLabel}
          onChange={(ariaLabel) =>
            updateSite((current) => ({
              ...current,
              floatingWhatsapp: { ...current.floatingWhatsapp, ariaLabel },
            }))
          }
        />
      </div>
    </div>
  );
}

function ProductsPageEditor({ site, updateSite }: { site: SiteContent; updateSite: (mutator: (site: SiteContent) => SiteContent) => void }) {
  const patch = (value: Partial<SiteContent["productsPage"]>) => updateSite((current) => ({ ...current, productsPage: { ...current.productsPage, ...value } }));
  return <div className="space-y-4">
    <TextField label="Título" value={site.productsPage.title} onChange={(title) => patch({ title })} />
    <TextField label="Subtítulo" value={site.productsPage.subtitle} onChange={(subtitle) => patch({ subtitle })} multiline />
    <TextField label="Buscador" value={site.productsPage.searchPlaceholder} onChange={(searchPlaceholder) => patch({ searchPlaceholder })} />
    <TextField label="Filtros" value={site.productsPage.filtersLabel} onChange={(filtersLabel) => patch({ filtersLabel })} />
    <TextField label="Sin resultados" value={site.productsPage.emptyText} onChange={(emptyText) => patch({ emptyText })} />
    <TextField label="Destacado" value={site.productsPage.featuredLabel} onChange={(featuredLabel) => patch({ featuredLabel })} />
    <TextField label="Botón añadir" value={site.productsPage.addButtonLabel} onChange={(addButtonLabel) => patch({ addButtonLabel })} />
    <TextField label="Agotado" value={site.productsPage.outOfStockText} onChange={(outOfStockText) => patch({ outOfStockText })} />
    <p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">Productos, precios, fotos y stock se gestionan desde el módulo Productos.</p>
  </div>;
}

function ServicesPageEditor({ site, updateSite }: { site: SiteContent; updateSite: (mutator: (site: SiteContent) => SiteContent) => void }) {
  const p=site.servicesPage;
  const patch=(value:Partial<SiteContent["servicesPage"]>)=>updateSite((current)=>({...current,servicesPage:{...current.servicesPage,...value}}));
  return <div className="space-y-4">
    <TextField label="Título" value={p.title} onChange={(title)=>patch({title})}/>
    <TextField label="Subtítulo" value={p.subtitle} onChange={(subtitle)=>patch({subtitle})} multiline/>
    <TextField label="Título Jardinería" value={p.gardeningHeading} onChange={(gardeningHeading)=>patch({gardeningHeading})}/>
    <TextField label="Descripción Jardinería" value={p.gardeningDescription} onChange={(gardeningDescription)=>patch({gardeningDescription})} multiline/>
    <TextField label="Título Cursos" value={p.coursesHeading} onChange={(coursesHeading)=>patch({coursesHeading})}/>
    <TextField label="Descripción Cursos" value={p.coursesDescription} onChange={(coursesDescription)=>patch({coursesDescription})} multiline/>
    <TextField label="Título Entrega" value={p.deliveryHeading} onChange={(deliveryHeading)=>patch({deliveryHeading})}/>
    <TextField label="Descripción Entrega" value={p.deliveryDescription} onChange={(deliveryDescription)=>patch({deliveryDescription})} multiline/>
    <TextField label="Título Asesoría" value={p.advisoryHeading} onChange={(advisoryHeading)=>patch({advisoryHeading})}/>
    <TextField label="Descripción Asesoría" value={p.advisoryDescription} onChange={(advisoryDescription)=>patch({advisoryDescription})} multiline/>
    <TextField label="CTA" value={p.ctaTitle} onChange={(ctaTitle)=>patch({ctaTitle})}/>
    <TextField label="Descripción CTA" value={p.ctaDescription} onChange={(ctaDescription)=>patch({ctaDescription})} multiline/>
    <TextField label="Botón WhatsApp" value={p.whatsappButtonLabel} onChange={(whatsappButtonLabel)=>patch({whatsappButtonLabel})}/>
    <TextField label="Botón llamar" value={p.callButtonLabel} onChange={(callButtonLabel)=>patch({callButtonLabel})}/>
    <p className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">Los botones de servicios usan el WhatsApp y teléfono reales configurados en el Footer.</p>
  </div>;
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
      <TextField label="Título WhatsApp" value={site.contactPage.whatsappTitle} onChange={(whatsappTitle) => patch({ whatsappTitle })} />
      <TextField label="Texto bajo WhatsApp" value={site.contactPage.whatsappSubtitle} onChange={(whatsappSubtitle) => patch({ whatsappSubtitle })} />
      <TextField label="Título teléfono" value={site.contactPage.callTitle} onChange={(callTitle) => patch({ callTitle })} />
      <TextField label="Texto bajo teléfono" value={site.contactPage.callSubtitle} onChange={(callSubtitle) => patch({ callSubtitle })} />
      <TextField label="Título ubicación" value={site.contactPage.locationTitle} onChange={(locationTitle) => patch({ locationTitle })} />
      <TextField label="Texto bajo ubicación" value={site.contactPage.locationSubtitle} onChange={(locationSubtitle) => patch({ locationSubtitle })} />
      <TextField label="Título dirección" value={site.contactPage.addressTitle} onChange={(addressTitle) => patch({ addressTitle })} />
      <TextField label="Dirección" value={site.contactPage.addressText} onChange={(addressText) => patch({ addressText })} multiline />
      <TextField label="Texto botón de mapa" value={site.contactPage.mapButtonLabel} onChange={(mapButtonLabel) => patch({ mapButtonLabel })} />
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

const elementTypes = ["title", "subtitle", "text", "image", "card", "separator", "spacer"] as const;

function ElementsEditor({ block, updateData }: { block: BuilderBlock; updateData: (patch: Record<string, any>) => void }) {
  const elements: any[] = Array.isArray(block.data?.elements) ? block.data.elements : [];
  const save = (next: any[]) => updateData({ elements: next });
  const change = (index: number, patch: Record<string, any>) => save(elements.map((element, i) => i === index ? { ...element, ...patch } : element));
  return <div className="space-y-3">
    {elements.map((element, index) => <div key={element.id || index} className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
      <label className="block text-xs font-bold">Tipo<select value={elementTypes.includes(element.type) ? element.type : "text"} onChange={(event) => change(index, { type: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2">{elementTypes.map((type) => <option key={type} value={type}>{({ title: "Título", subtitle: "Subtítulo", text: "Texto", image: "Imagen", card: "Tarjeta", separator: "Separador", spacer: "Espacio" } as Record<string, string>)[type]}</option>)}</select></label>
      {!["separator", "spacer", "image"].includes(element.type) && <TextField label="Contenido" value={element.text || ""} onChange={(value) => change(index, { text: value })} multiline={element.type === "text" || element.type === "card"} />}
      {element.type === "image" && <><TextField label="URL de imagen" value={element.url || ""} onChange={(url) => change(index, { url })} placeholder="https://..." /><TextField label="Texto alternativo" value={element.alt || ""} onChange={(alt) => change(index, { alt })} /></>}
      {!["separator", "spacer", "image"].includes(element.type) && <><RangeField label="Tamaño" value={Number(element.fontSize || 20)} min={12} max={72} suffix="px" onChange={(fontSize) => change(index, { fontSize })} /><label className="block text-xs font-bold">Alineación<select value={element.align || "left"} onChange={(event) => change(index, { align: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2"><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option></select></label><label className="block text-xs font-bold">Color<input type="color" value={element.color || "#263a2d"} onChange={(event) => change(index, { color: event.target.value })} className="mt-1 h-9 w-full" /></label><label className="flex justify-between text-xs font-bold">Negrita<input type="checkbox" checked={element.bold === true} onChange={(event) => change(index, { bold: event.target.checked })} /></label></>}
      {element.type === "image" && <RangeField label="Altura de imagen" value={Number(element.height || 300)} min={80} max={700} suffix="px" onChange={(height) => change(index, { height })} />}
      {element.type === "spacer" && <RangeField label="Altura del espacio" value={Number(element.height || 32)} min={8} max={200} suffix="px" onChange={(height) => change(index, { height })} />}
      <RangeField label="Espacio inferior" value={Number(element.marginBottom ?? 16)} min={0} max={100} suffix="px" onChange={(marginBottom) => change(index, { marginBottom })} />
      <div className="flex flex-wrap gap-3 text-xs font-bold">{(["desktop", "tablet", "mobile"] as const).map((device) => <label key={device} className="flex gap-1">{({ desktop: "Ordenador", tablet: "Tableta", mobile: "Móvil" })[device]}<input type="checkbox" checked={element[device] !== false} onChange={(event) => change(index, { [device]: event.target.checked })} /></label>)}</div>
      <div className="flex flex-wrap gap-2 text-xs font-bold"><button type="button" disabled={index === 0} onClick={() => { const next = [...elements]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; save(next); }} className="rounded border p-2 disabled:opacity-30">Subir</button><button type="button" disabled={index === elements.length - 1} onClick={() => { const next = [...elements]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; save(next); }} className="rounded border p-2 disabled:opacity-30">Bajar</button><button type="button" onClick={() => save([...elements, { ...element, id: makeBuilderId("element") }])} className="rounded border p-2">Duplicar</button><button type="button" onClick={() => { if (window.confirm("¿Eliminar este elemento?")) save(elements.filter((_, i) => i !== index)); }} className="rounded border border-rose-200 p-2 text-rose-700">Eliminar</button></div>
    </div>)}
    <div className="grid grid-cols-2 gap-2">{elementTypes.map((type) => <button key={type} type="button" onClick={() => save([...elements, { id: makeBuilderId("element"), type, text: type === "title" ? "Nuevo título" : type === "card" ? "Nueva tarjeta" : "Nuevo texto", fontSize: type === "title" ? 36 : 20, desktop: true, tablet: true, mobile: true }])} className="rounded-lg border border-dashed border-emerald-400 px-2 py-2 text-xs font-bold text-emerald-700">+ {({ title: "Título", subtitle: "Subtítulo", text: "Texto", image: "Imagen", card: "Tarjeta", separator: "Separador", spacer: "Espacio" } as Record<string, string>)[type]}</button>)}</div>
  </div>;
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
  if (block.type === "elements") return <ElementsEditor block={block} updateData={updateData} />;
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
        <LinkFields label="Botón principal" value={block.data?.primaryButton || { label: "", href: "/" }} onChange={(primaryButton) => updateData({ primaryButton })} showIconControl />
        <LinkFields label="Botón secundario" value={block.data?.secondaryButton || { label: "", href: "/" }} onChange={(secondaryButton) => updateData({ secondaryButton })} showIconControl />
      </div>
    );
  }

  if (block.type === "buttons") {
    const buttons = Array.isArray(block.data?.buttons) ? block.data.buttons : [];
    const change = (index: number, patch: Record<string, any>) => updateData({ buttons: buttons.map((button: any, i: number) => i === index ? { ...button, ...patch } : button) });
    return <div className="space-y-4">
      <TextField label="Título opcional" value={block.data?.heading || ""} onChange={(heading) => updateData({ heading })} />
      {buttons.map((button: any, index: number) => <div key={button.id || index} className="space-y-3 rounded-xl border border-slate-200 p-3">
        <TextField label="Nombre interno" value={button.name || ""} onChange={(name) => change(index, { name })} />
        <TextField label="Texto visible" value={button.label || ""} onChange={(label) => change(index, { label })} />
        <label className="block text-xs font-bold">Acción<select value={button.action || "page"} onChange={(event) => change(index, { action: event.target.value, href: "" })} className="mt-1 w-full rounded-lg border border-slate-200 p-2">
          <option value="page">Página interna</option><option value="url">URL externa</option><option value="product">Producto</option><option value="category">Categoría</option><option value="service">Servicio</option><option value="whatsapp">WhatsApp</option><option value="email">Correo electrónico</option><option value="phone">Llamada</option><option value="cart">Carrito</option><option value="checkout">Finalizar compra</option>
        </select></label>
        {!(["cart", "checkout"].includes(button.action)) && <TextField label={button.action === "whatsapp" || button.action === "phone" ? "Número" : button.action === "email" ? "Correo" : button.action === "product" ? "ID de producto" : button.action === "service" ? "Destino del servicio" : "Destino"} value={button.href || ""} onChange={(href) => change(index, { href })} placeholder={button.action === "url" ? "https://..." : button.action === "page" ? "/contacto" : ""} />}
        <div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold">Fondo<input type="color" value={button.background || "#315f47"} onChange={(event) => change(index, { background: event.target.value })} className="mt-1 h-9 w-full" /></label><label className="text-xs font-bold">Texto<input type="color" value={button.color || "#ffffff"} onChange={(event) => change(index, { color: event.target.value })} className="mt-1 h-9 w-full" /></label></div>
        <label className="block text-xs font-bold">Color al pasar el cursor<input type="color" value={button.hoverBackground || "#234c36"} onChange={(event) => change(index, { hoverBackground: event.target.value })} className="mt-1 h-9 w-full" /></label>
        <label className="block text-xs font-bold">Tipografía<select value={button.fontFamily || "inherit"} onChange={(event) => change(index, { fontFamily: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2"><option value="inherit">Fuente del sitio</option><option value="Georgia, serif">Editorial</option><option value="Arial, sans-serif">Limpia</option><option value="Inter, system-ui, sans-serif">Moderna</option></select></label>
        <RangeField label="Tamaño de texto" value={Number(button.fontSize || 14)} min={12} max={32} suffix="px" onChange={(fontSize) => change(index, { fontSize })} />
        <RangeField label="Relleno horizontal" value={Number(button.paddingX || 20)} min={8} max={64} suffix="px" onChange={(paddingX) => change(index, { paddingX })} />
        <RangeField label="Relleno vertical" value={Number(button.paddingY || 12)} min={4} max={32} suffix="px" onChange={(paddingY) => change(index, { paddingY })} />
        <RangeField label="Redondeado" value={Number(button.radius ?? 12)} min={0} max={40} suffix="px" onChange={(radius) => change(index, { radius })} />
        <label className="flex justify-between text-xs font-bold">Mostrar icono<input type="checkbox" checked={button.showIcon === true} onChange={(event) => change(index, { showIcon: event.target.checked })} /></label>
        <label className="flex justify-between text-xs font-bold">Visible<input type="checkbox" checked={button.visible !== false} onChange={(event) => change(index, { visible: event.target.checked })} /></label>
        <div className="flex flex-wrap gap-2 text-xs font-bold"><button type="button" disabled={index === 0} onClick={() => { const next = [...buttons]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; updateData({ buttons: next }); }} className="rounded border p-2 disabled:opacity-30">Subir</button><button type="button" disabled={index === buttons.length - 1} onClick={() => { const next = [...buttons]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; updateData({ buttons: next }); }} className="rounded border p-2 disabled:opacity-30">Bajar</button><button type="button" onClick={() => updateData({ buttons: [...buttons, { ...button, id: makeBuilderId("button"), name: `${button.name || "Botón"} copia` }] })} className="rounded border p-2">Duplicar</button><button type="button" onClick={() => { if (window.confirm("¿Seguro que deseas eliminar este botón?")) updateData({ buttons: buttons.filter((_: any, i: number) => i !== index) }); }} className="rounded border border-rose-200 p-2 text-rose-700">Eliminar</button></div>
      </div>)}
      <button type="button" onClick={() => updateData({ buttons: [...buttons, { id: makeBuilderId("button"), name: "Nuevo botón", label: "Nuevo botón", action: "page", href: "/contacto", visible: true, background: "#315f47", color: "#ffffff" }] })} className="w-full rounded-xl border border-dashed border-emerald-400 py-3 text-sm font-bold text-emerald-700">+ Añadir botón</button>
    </div>;
  }

  if (block.type === "services" || block.type === "products") {
    return (
      <div className="space-y-4">
        <TextField label="Título" value={block.data?.heading || ""} onChange={(heading) => updateData({ heading })} />
        <TextField label="Descripción" value={block.data?.description || ""} onChange={(description) => updateData({ description })} multiline />
        <LinkFields label="Botón" value={block.data?.button || { label: "Ver más", href: block.type === "services" ? "/servicios" : "/productos" }} onChange={(button) => updateData({ button })} showIconControl />
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
        <LinkFields label="Botón" value={block.data?.button || { label: "", href: "/" }} onChange={(button) => updateData({ button })} showIconControl />
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
        <TextField label="Texto alternativo de la imagen" value={block.data?.imageAlt || ""} onChange={(imageAlt) => updateData({ imageAlt })} />
        <label className="block text-xs font-bold text-slate-700"><span className="mb-1.5 block">Encaje de la imagen</span><select value={block.data?.imageFit || "cover"} onChange={(event) => updateData({ imageFit: event.target.value })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5"><option value="cover">Cubrir</option><option value="contain">Mostrar completa</option><option value="fill">Estirar</option></select></label>
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

function BlockBackgroundEditor({ block, updateData, update }: { block: BuilderBlock; updateData: (patch: Record<string, any>) => void; update: (patch: Partial<BuilderBlockDesign>) => void }) {
  const design = block.design;
  const hasImage = ["hero", "cta", "textImage"].includes(block.type);
  return <div className="space-y-4">
    <p className="text-xs leading-5 text-slate-500">Ajusta el fondo y comprueba el resultado en la vista central antes de publicar.</p>
    {hasImage && <ImageFields label="Imagen de fondo" value={block.data?.imageUrl || ""} onChange={(imageUrl) => updateData({ imageUrl })} />}
    <label className="block text-xs font-bold text-slate-700">Color de fondo<input type="color" value={design.backgroundColor} onChange={(event) => update({ backgroundColor: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-slate-200" /></label>
    {(["hero", "cta", "textImage"].includes(block.type)) && <>
      <label className="block text-xs font-bold text-slate-700">Posición de imagen<select value={design.imagePosition} onChange={(event) => update({ imagePosition: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5"><option value="center">Centro</option><option value="left center">Izquierda</option><option value="right center">Derecha</option><option value="center top">Arriba</option><option value="center bottom">Abajo</option></select></label>
      {block.type !== "textImage" && <RangeField label="Altura de la sección" value={design.minHeight || (block.type === "hero" ? 650 : 0)} min={block.type === "hero" ? 360 : 0} max={900} step={10} suffix="px" onChange={(minHeight) => update({ minHeight })} />}
      <RangeField label="Zoom de imagen" value={design.imageZoom || 100} min={100} max={180} suffix="%" onChange={(imageZoom) => update({ imageZoom })} />
      {block.type !== "textImage" && <RangeField label="Oscurecer fondo" value={design.overlay} min={0} max={85} suffix="%" onChange={(overlay) => update({ overlay })} />}
    </>}
  </div>;
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
      {["features", "categories", "gallery", "testimonials", "services", "products"].includes(block.type) && (
        <div className="space-y-3">
          <RangeField label="Columnas · escritorio" value={design.columns} min={1} max={6} onChange={(columns) => update({ columns })} />
          <RangeField label="Columnas · tablet" value={design.columnsTablet ?? 2} min={1} max={4} onChange={(columnsTablet) => update({ columnsTablet })} />
          <RangeField label="Columnas · móvil" value={design.columnsMobile ?? 1} min={1} max={2} onChange={(columnsMobile) => update({ columnsMobile })} />
        </div>
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
