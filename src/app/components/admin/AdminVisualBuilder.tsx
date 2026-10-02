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
import { getMarketExperience } from "../../lib/marketExperience";
import {
  COMMERCE_COLLECTIONS,
  getCommerceCollection,
  primaryCollectionOf,
  productBelongsToCollection,
} from "../../lib/commerceCatalog";

type Device = "desktop" | "tablet" | "mobile";
type PageMode = "home" | "products" | "services" | "dulce" | "moda" | "about" | "contact" | "herencia";
type SelectedTarget = "header" | "footer" | "products" | "services" | "contact" | string;
type EditorTab = "contenido" | "diseno" | "avanzado";

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
  const [catalogPreview, setCatalogPreview] = useState<any[]>([]);
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

  useEffect(() => {
    if (!hydratedRef.current) return;
    void backendStorage.setItem(
      "visualBuilderAuxDraft",
      JSON.stringify({ menuIcons, herenciaSettings })
    );
  }, [menuIcons, herenciaSettings]);

  useEffect(() => {
    let cancelled = false;
    const loadCatalog = async () => {
      try {
        const result = await backendApi.listCommerceProducts();
        if (!cancelled) {
          setCatalogPreview(
            Array.isArray(result.products)
              ? result.products.filter((product: any) => product.status === "active" || product.active === true)
              : []
          );
        }
      } catch {
        if (!cancelled) {
          try {
            const cached = JSON.parse(backendStorage.getItem("adminProducts") || "[]");
            setCatalogPreview(Array.isArray(cached) ? cached.filter((product: any) => product.status === "active" || product.active !== false) : []);
          } catch {
            setCatalogPreview([]);
          }
        }
      }
    };
    void loadCatalog();
    const reload = () => void loadCatalog();
    window.addEventListener("backend-storage", reload);
    return () => {
      cancelled = true;
      window.removeEventListener("backend-storage", reload);
    };
  }, []);

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
        backendStorage.setItem("menuIcons", JSON.stringify(menuIcons)),
        backendStorage.setItem("herenciaSettings", JSON.stringify(herenciaSettings)),
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
      setPublishedMenuIcons(menuIcons);
      setPublishedHerenciaSettings(herenciaSettings);
      await backendStorage.removeItem("visualBuilderAuxDraft");
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
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              {([
                ["home", "Inicio"],
                ["products", "Productos"],
                ["services", "Servicios"],
                ["dulce", "Dulce"],
                ["moda", "Moda"],
                ["about", "Nosotros"],
                ["contact", "Contacto"],
                ["herencia", "Herenc(IA)"],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setPageMode(mode);
                    if (mode === "home") setSelected("header");
                    else setSelected(mode);
                    setTab("contenido");
                  }}
                  className={`rounded-lg px-2 py-2 text-xs font-black ${pageMode === mode ? "bg-white shadow-sm" : ""}`}
                >
                  {label}
                </button>
              ))}
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
                    <div className="flex items-center justify-end gap-1 border-t border-slate-100 px-2 py-1.5">
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
                  setSelected(pageMode);
                  setTab("contenido");
                }}
                className={`mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left ${selected === pageMode ? "border-emerald-600 bg-emerald-50" : "border-slate-200"}`}
              >
                <Clock3 className="h-4 w-4 text-emerald-700" />
                <div>
                  <p className="text-sm font-black">
                    {pageMode === "products" ? "Página de Productos"
                      : pageMode === "services" ? "Página de Servicios"
                      : pageMode === "dulce" ? "Página Dulce"
                      : pageMode === "moda" ? "Página Moda"
                      : pageMode === "about" ? "Página Nosotros"
                      : pageMode === "herencia" ? "Página Herenc(IA)"
                      : "Página de Contacto"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {pageMode === "products" ? "Catálogo, filtros y presentación"
                      : pageMode === "services" ? "Servicios y contratación"
                      : pageMode === "dulce" || pageMode === "moda" ? "Portada y colección"
                      : pageMode === "about" ? "Historia, imagen y valores"
                      : pageMode === "herencia" ? "Asistente de ventas y acciones"
                      : "Dirección, horario y mapa"}
                  </p>
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

        <main className="min-w-0 overflow-auto bg-[#e5e9e3] p-3 sm:p-5 max-lg:pb-[50vh]">
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm lg:hidden">
            <select
              value={selected}
              onChange={(event) => {
                const value = event.target.value;
                setSelected(value);
                if (["products","services","dulce","moda","about","contact","herencia"].includes(value)) {
                  setPageMode(value as PageMode);
                } else if (pageMode !== "home") {
                  setPageMode("home");
                }
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
              <option value="dulce">Dulce</option>
              <option value="moda">Moda</option>
              <option value="about">Nosotros</option>
              <option value="contact">Contacto</option>
              <option value="herencia">Herenc(IA)</option>
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
              {(["textImage", "gallery", "testimonials", "cta", "categories", "features", "hero"] as BuilderBlockType[]).map((type) => (
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
                {herenciaSettings.enabled && <span>{site.navigation.herencia.label}</span>}
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
            ) : pageMode === "products" ? (
              <ProductsPreview site={site} products={catalogPreview} selected={selected === "products"} onSelect={() => setSelected("products")} />
            ) : pageMode === "services" ? (
              <ServicesPreview site={site} products={catalogPreview} selected={selected === "services"} onSelect={() => setSelected("services")} />
            ) : pageMode === "dulce" || pageMode === "moda" ? (
              <CollectionPreview site={site} products={catalogPreview} kind={pageMode} selected={selected === pageMode} onSelect={() => setSelected(pageMode)} />
            ) : pageMode === "about" ? (
              <AboutPreview site={site} selected={selected === "about"} onSelect={() => setSelected("about")} />
            ) : pageMode === "herencia" ? (
              <HerenciaPreview site={site} selected={selected === "herencia"} onSelect={() => setSelected("herencia")} />
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

        <aside className="overflow-y-auto border-l border-slate-200 bg-white max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-[110] max-lg:h-[48vh] max-lg:border-l-0 max-lg:border-t max-lg:shadow-[0_-12px_35px_rgba(15,23,42,0.18)]">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Editando</p>
                <h2 className="mt-1 text-lg font-black">
                  {selectedBlock?.name || (
                    selected === "header" ? "Header"
                      : selected === "footer" ? "Footer"
                      : selected === "products" ? "Productos"
                      : selected === "services" ? "Servicios"
                      : selected === "dulce" ? "Dulce"
                      : selected === "moda" ? "Moda"
                      : selected === "about" ? "Nosotros"
                      : selected === "herencia" ? "Herenc(IA)"
                      : "Contacto"
                  )}
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

            {selected === "products" && <ProductsPageEditor site={site} updateSite={updateSite} />}
            {selected === "services" && <ServicesPageEditor site={site} updateSite={updateSite} />}
            {selected === "dulce" && <MarketExperiencePageEditor site={site} updateSite={updateSite} section="dulce" />}
            {selected === "moda" && <MarketExperiencePageEditor site={site} updateSite={updateSite} section="moda" />}
            {selected === "about" && <MarketExperiencePageEditor site={site} updateSite={updateSite} section="about" />}
            {selected === "herencia" && <MarketExperiencePageEditor site={site} updateSite={updateSite} section="sales" />}
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

    <div className="rounded-xl border border-slate-200 p-3">
      <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">Diseño del catálogo</p>
      <RangeField label="Columnas" value={Number(site.productsPage.columns || 4)} min={2} max={5} onChange={(columns) => patch({ columns })} />
      <RangeField label="Redondeado de tarjetas" value={Number(site.productsPage.cardRadius ?? 24)} min={0} max={40} suffix="px" onChange={(cardRadius) => patch({ cardRadius })} />

      <label className="mt-3 block text-xs font-bold text-slate-700">
        Proporción de imagen
        <select value={site.productsPage.imageAspect || "square"} onChange={(event) => patch({ imageAspect: event.target.value as SiteContent["productsPage"]["imageAspect"] })} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5">
          <option value="square">Cuadrada</option>
          <option value="portrait">Vertical</option>
          <option value="landscape">Horizontal</option>
        </select>
      </label>

      <label className="mt-3 block text-xs font-bold text-slate-700">
        Orden inicial
        <select value={site.productsPage.defaultSort || "relevance"} onChange={(event) => patch({ defaultSort: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5">
          <option value="relevance">Relevancia</option>
          <option value="featured">Destacados</option>
          <option value="newest">Novedades</option>
          <option value="price-asc">Precio menor a mayor</option>
          <option value="price-desc">Precio mayor a menor</option>
          <option value="stock">Disponibilidad</option>
        </select>
      </label>

      <div className="mt-4 space-y-2">
        {([
          ["showFilters", "Mostrar filtros"],
          ["showFavorites", "Mostrar favoritos"],
          ["showCollectionTabs", "Mostrar colecciones"],
          ["showSubcategories", "Mostrar subcategorías"],
        ] as const).map(([key, label]) => (
          <label key={key} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold">
            {label}
            <input type="checkbox" checked={site.productsPage[key] !== false} onChange={(event) => patch({ [key]: event.target.checked } as Partial<SiteContent["productsPage"]>)} />
          </label>
        ))}
      </div>
    </div>

    <p className="rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
      Aquí controlas cómo se presenta el catálogo. Precios, stock, variantes, imágenes y productos reales se gestionan desde Catálogo para mantener una sola fuente de datos en Neon.
    </p>
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

function MarketExperiencePageEditor({
  site,
  updateSite,
  section,
}: {
  site: SiteContent;
  updateSite: (mutator: (site: SiteContent) => SiteContent) => void;
  section: "dulce" | "moda" | "about" | "sales";
}) {
  const market = getMarketExperience(site);

  function patch(value: Record<string, any>) {
    updateSite((current) => {
      const currentMarket = getMarketExperience(current);
      return {
        ...current,
        marketExperience: {
          ...currentMarket,
          [section]: {
            ...(currentMarket as any)[section],
            ...value,
          },
        },
      } as SiteContent;
    });
  }

  if (section === "dulce" || section === "moda") {
    const page = market[section];
    return <div className="space-y-4">
      <TextField label="Texto pequeño" value={page.kicker} onChange={(kicker) => patch({ kicker })} />
      <TextField label="Título de página" value={page.pageTitle} onChange={(pageTitle) => patch({ pageTitle })} />
      <TextField label="Subtítulo" value={page.pageSubtitle} onChange={(pageSubtitle) => patch({ pageSubtitle })} multiline />
      <TextField label="Título de colección" value={page.title} onChange={(title) => patch({ title })} />
      <TextField label="Descripción de colección" value={page.subtitle} onChange={(subtitle) => patch({ subtitle })} multiline />
      <ImageFields label="Imagen de portada" value={page.imageUrl} onChange={(imageUrl) => patch({ imageUrl })} />
      <LinkFields label="Botón principal" value={{ label: page.buttonLabel, href: page.href }} onChange={(link) => patch({ buttonLabel: link.label, href: link.href })} />
      <p className="rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">Los artículos que aparecen debajo vienen de la colección real {section === "dulce" ? "Dulce" : "Moda"} de Neon.</p>
    </div>;
  }

  if (section === "about") {
    const page = market.about;
    return <div className="space-y-4">
      <TextField label="Texto pequeño" value={page.kicker} onChange={(kicker) => patch({ kicker })} />
      <TextField label="Título" value={page.title} onChange={(title) => patch({ title })} />
      <TextField label="Descripción" value={page.description} onChange={(description) => patch({ description })} multiline />
      <ImageFields label="Imagen" value={page.imageUrl} onChange={(imageUrl) => patch({ imageUrl })} />
      <div className="rounded-xl border border-slate-200 p-3">
        <p className="mb-3 text-xs font-black uppercase tracking-wider text-slate-500">Valores</p>
        {page.values.map((value, index) => (
          <div key={index} className="mb-3 rounded-lg bg-slate-50 p-3">
            <TextField label={`Título ${index + 1}`} value={value.title} onChange={(title) => patch({ values: page.values.map((item, i) => i === index ? { ...item, title } : item) })} />
            <TextField label="Descripción" value={value.description} onChange={(description) => patch({ values: page.values.map((item, i) => i === index ? { ...item, description } : item) })} multiline />
          </div>
        ))}
      </div>
    </div>;
  }

  const sales = market.sales;
  return <div className="space-y-4">
    <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm font-bold">
      Asistente de ventas activado
      <input type="checkbox" checked={sales.enabled} onChange={(event) => patch({ enabled: event.target.checked })} />
    </label>
    <TextField label="Texto del botón" value={sales.buttonLabel} onChange={(buttonLabel) => patch({ buttonLabel })} />
    <TextField label="Título" value={sales.title} onChange={(title) => patch({ title })} />
    <TextField label="Prompt principal" value={sales.prompt} onChange={(prompt) => patch({ prompt })} multiline />
    <TextField label="Texto de ayuda" value={sales.helperText} onChange={(helperText) => patch({ helperText })} multiline />
    <p className="rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">La lógica de IA sigue separada; aquí editas presentación, mensaje y disponibilidad del asistente de ventas.</p>
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
          {block.type === "hero" && (
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-black text-slate-700">
                <span>Color</span>
                <span className="font-mono">{design.overlayColor || "#102b20"}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {["#102b20", "#000000", "#4a2f24", "#8b4a35", "#20364f", "#6a5a43", "#6b2448", "#5b5b5b"].map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    aria-label={`Usar color ${color}`}
                    onClick={() => update({ overlayColor: color })}
                    className="h-8 w-8 rounded-full border-2 shadow-sm"
                    style={{
                      backgroundColor: color,
                      borderColor: (design.overlayColor || "#102b20").toLowerCase() === color.toLowerCase() ? "#16a34a" : "#ffffff",
                      outline: (design.overlayColor || "#102b20").toLowerCase() === color.toLowerCase() ? "2px solid #16a34a" : "1px solid #cbd5e1",
                    }}
                  />
                ))}
                <label className="flex h-8 items-center gap-2 rounded-lg border border-slate-200 px-2 text-xs font-bold">
                  Otro
                  <input
                    type="color"
                    value={design.overlayColor || "#102b20"}
                    onChange={(event) => update({ overlayColor: event.target.value })}
                    className="h-5 w-7 cursor-pointer border-0 bg-transparent p-0"
                  />
                </label>
              </div>
            </div>
          )}
          <RangeField
            label={block.type === "hero" ? "Intensidad del color" : "Oscurecer imagen"}
            value={design.overlay}
            min={0}
            max={100}
            suffix="%"
            onChange={(overlay) => update({ overlay })}
          />
          {block.type === "hero" && (
            <RangeField
              label="Extensión del color"
              value={design.overlayWidth ?? 72}
              min={25}
              max={100}
              suffix="%"
              onChange={(overlayWidth) => update({ overlayWidth })}
            />
          )}
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

function previewPrice(product: any) {
  return Number(product?.onSale && product?.salePrice ? product.salePrice : product?.price || 0);
}

function ProductsPreview({
  site,
  products,
  selected,
  onSelect,
}: {
  site: SiteContent;
  products: any[];
  selected: boolean;
  onSelect: () => void;
}) {
  const rows = products.slice(0, 8);
  const columns = Math.max(2, Math.min(5, Number(site.productsPage.columns || 4)));
  const gridClass =
    columns <= 2 ? "grid-cols-2"
      : columns === 3 ? "grid-cols-2 md:grid-cols-3"
      : columns >= 5 ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
      : "grid-cols-2 md:grid-cols-4";
  const imageClass =
    site.productsPage.imageAspect === "portrait"
      ? "h-44"
      : site.productsPage.imageAspect === "landscape"
        ? "h-28"
        : "h-36";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`block w-full text-left ${selected ? "ring-4 ring-inset ring-emerald-600" : ""}`}
    >
      <div className="border-b border-slate-200 bg-[#f4f1e8] px-8 py-9">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">HERENCIA MARKET</p>
        <h1 className="mt-2 text-3xl font-black text-[#173126]">{site.productsPage.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">{site.productsPage.subtitle}</p>
      </div>

      <div className="space-y-5 p-6">
        {site.productsPage.showCollectionTabs !== false && (
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-800 px-3 py-1.5 text-[11px] font-black text-white">Todo</span>
            {COMMERCE_COLLECTIONS.slice(0, 7).map((item) => (
              <span key={item.id} className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-bold">{item.name}</span>
            ))}
          </div>
        )}

        {site.productsPage.showFilters !== false && (
          <div className="flex gap-2">
            <div className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-400">Buscar productos…</div>
            <div className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">Filtros</div>
          </div>
        )}

        {rows.length ? (
          <div className={`grid gap-3 ${gridClass}`}>
            {rows.map((product) => (
              <div
                key={String(product.id)}
                className="overflow-hidden border border-slate-200 bg-white"
                style={{ borderRadius: `${Math.max(0, Math.min(40, Number(site.productsPage.cardRadius ?? 24)))}px` }}
              >
                <div className={`${imageClass} bg-slate-100`}>
                  {product.image ? <img src={product.image} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="p-3">
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-800">
                    {getCommerceCollection(primaryCollectionOf(product)).name}
                  </span>
                  <p className="mt-2 truncate text-sm font-black">{product.name}</p>
                  <p className="mt-1 text-sm font-black text-emerald-800">€{previewPrice(product).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            Aún no hay artículos publicados en el catálogo.
          </div>
        )}

        <p className="text-xs text-slate-400">{products.length} artículos reales cargados desde Commerce/Neon.</p>
      </div>
    </button>
  );
}

function ServicesPreview({
  site,
  products,
  selected,
  onSelect,
}: {
  site: SiteContent;
  products: any[];
  selected: boolean;
  onSelect: () => void;
}) {
  const rows = products.filter((product) => productBelongsToCollection(product, "servicios")).slice(0, 6);
  return (
    <button type="button" onClick={onSelect} className={`block w-full text-left ${selected ? "ring-4 ring-inset ring-emerald-600" : ""}`}>
      <div className="bg-[#173d2a] px-8 py-10 text-white">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">SERVICIOS HERENCIA</p>
        <h1 className="mt-2 text-4xl font-black">{site.servicesPage.title}</h1>
        <p className="mt-3 max-w-2xl text-sm text-white/70">{site.servicesPage.subtitle}</p>
      </div>
      <div className="grid gap-4 p-6 md:grid-cols-3">
        {rows.length ? rows.map((service) => (
          <div key={String(service.id)} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="h-36 bg-slate-100">
              {service.image ? <img src={service.image} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <div className="p-4">
              <p className="font-black">{service.name}</p>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{service.description}</p>
              <p className="mt-3 font-black text-emerald-800">€{previewPrice(service).toFixed(2)}</p>
            </div>
          </div>
        )) : (
          <>
            {[site.servicesPage.gardeningHeading, site.servicesPage.deliveryHeading, site.servicesPage.advisoryHeading].map((title) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="font-black">{title}</p>
                <p className="mt-2 text-xs text-slate-500">Añade servicios vendibles desde Catálogo para verlos aquí.</p>
              </div>
            ))}
          </>
        )}
      </div>
    </button>
  );
}

function CollectionPreview({
  site,
  products,
  kind,
  selected,
  onSelect,
}: {
  site: SiteContent;
  products: any[];
  kind: "dulce" | "moda";
  selected: boolean;
  onSelect: () => void;
}) {
  const market = getMarketExperience(site);
  const page = market[kind];
  const rows = products.filter((product) => productBelongsToCollection(product, kind)).slice(0, 4);

  return (
    <button type="button" onClick={onSelect} className={`block w-full text-left ${selected ? "ring-4 ring-inset ring-emerald-600" : ""}`}>
      <div className="relative min-h-72 overflow-hidden bg-slate-800">
        {page.imageUrl ? <img src={page.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" /> : null}
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent" />
        <div className="relative p-8 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/70">{page.kicker}</p>
          <h1 className="mt-3 text-4xl font-black">{page.pageTitle}</h1>
          <p className="mt-3 max-w-xl text-sm text-white/80">{page.pageSubtitle}</p>
        </div>
      </div>
      <div className="p-6">
        <h2 className="text-2xl font-black">{page.title}</h2>
        <p className="mt-1 text-sm text-slate-500">{page.subtitle}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {rows.map((product) => (
            <div key={String(product.id)} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="h-28 bg-slate-100">{product.image ? <img src={product.image} alt="" className="h-full w-full object-cover" /> : null}</div>
              <div className="p-3"><p className="truncate text-xs font-black">{product.name}</p><p className="mt-1 text-xs font-black text-emerald-800">€{previewPrice(product).toFixed(2)}</p></div>
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}

function AboutPreview({
  site,
  selected,
  onSelect,
}: {
  site: SiteContent;
  selected: boolean;
  onSelect: () => void;
}) {
  const about = getMarketExperience(site).about;
  return (
    <button type="button" onClick={onSelect} className={`block w-full text-left ${selected ? "ring-4 ring-inset ring-emerald-600" : ""}`}>
      <div className="grid min-h-80 md:grid-cols-2">
        <div className="bg-[#173d2a] p-8 text-white">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">{about.kicker}</p>
          <h1 className="mt-3 text-4xl font-black">{about.title}</h1>
          <p className="mt-4 text-sm leading-6 text-white/75">{about.description}</p>
        </div>
        <div className="bg-slate-100">{about.imageUrl ? <img src={about.imageUrl} alt="" className="h-full w-full object-cover" /> : null}</div>
      </div>
      <div className="grid gap-3 p-6 md:grid-cols-3">
        {about.values.map((value, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 p-4">
            <p className="font-black">{value.title}</p>
            <p className="mt-2 text-xs text-slate-500">{value.description}</p>
          </div>
        ))}
      </div>
    </button>
  );
}

function HerenciaPreview({
  site,
  selected,
  onSelect,
}: {
  site: SiteContent;
  selected: boolean;
  onSelect: () => void;
}) {
  const sales = getMarketExperience(site).sales;
  return (
    <button type="button" onClick={onSelect} className={`block w-full text-left ${selected ? "ring-4 ring-inset ring-emerald-600" : ""}`}>
      <div className="bg-gradient-to-br from-[#173d2a] to-[#315b42] p-10 text-white">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#e7d7a8]">HERENC(IA) · SALES</p>
        <h1 className="mt-3 text-4xl font-black">{sales.title}</h1>
        <p className="mt-3 max-w-2xl text-sm text-white/75">{sales.helperText}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {sales.quickActions.map((action) => (
            <span key={action.id} className="rounded-full border border-white/25 bg-white/10 px-3 py-2 text-xs font-black">{action.label}</span>
          ))}
        </div>
        <span className="mt-7 inline-flex rounded-full bg-white px-5 py-3 text-sm font-black text-[#173d2a]">{sales.buttonLabel}</span>
      </div>
    </button>
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
