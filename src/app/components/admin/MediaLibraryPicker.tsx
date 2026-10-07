import { useEffect, useMemo, useState } from "react";
import { Check, Image as ImageIcon, Loader2, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

type MediaItem = {
  name: string;
  path: string;
  url: string;
  createdAt?: string | null;
  size?: number;
};

export function MediaLibraryPicker({
  currentUrls = [],
  max = 8,
  onSelect,
  label = "Usar de biblioteca",
  className = "",
}: {
  currentUrls?: string[];
  max?: number;
  onSelect: (urls: string[]) => void;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);

  const normalizedCurrent = useMemo(
    () => Array.from(new Set(currentUrls.map((url) => String(url || "").trim()).filter(Boolean))),
    [currentUrls]
  );
  const remaining = Math.max(0, max - normalizedCurrent.length);

  useEffect(() => {
    if (!open) return;
    const refresh = () => {
      void backendApi.listSiteMedia()
        .then((result) => setMedia(Array.isArray(result.media) ? result.media : []))
        .catch(() => undefined);
    };
    window.addEventListener("media-library-changed", refresh);
    return () => window.removeEventListener("media-library-changed", refresh);
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return media;
    return media.filter((item) =>
      [item.name, item.path].some((value) => String(value || "").toLowerCase().includes(q))
    );
  }, [media, query]);

  async function openLibrary() {
    if (!remaining) {
      toast.error(`La galería ya tiene el máximo de ${max} imágenes`);
      return;
    }
    setOpen(true);
    setLoading(true);
    setSelected([]);
    try {
      const result = await backendApi.listSiteMedia();
      setMedia(Array.isArray(result.media) ? result.media : []);
    } catch (error: any) {
      toast.error(error?.message || "No se pudo abrir la biblioteca multimedia");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  async function deleteMediaItem(item: MediaItem) {
    if (!item?.path || deletingPath) return;
    if (!window.confirm("¿Eliminar esta foto de la Biblioteca multimedia?\n\nEsto elimina el archivo de R2. Los productos que ya usen esta imagen podrían dejar de mostrarla.")) {
      return;
    }

    setDeletingPath(item.path);
    try {
      await backendApi.deleteSiteMedia(item.path);
      setMedia((current) => current.filter((mediaItem) => mediaItem.path !== item.path));
      setSelected((current) => current.filter((url) => url !== item.url));
      window.dispatchEvent(new Event("media-library-changed"));
      toast.success("Foto eliminada de la Biblioteca");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo eliminar la foto");
    } finally {
      setDeletingPath(null);
    }
  }

  function toggle(url: string) {
    if (normalizedCurrent.includes(url)) return;
    setSelected((current) => {
      if (current.includes(url)) return current.filter((item) => item !== url);
      if (current.length >= remaining) {
        toast.error(`Puedes elegir ${remaining} imagen${remaining === 1 ? "" : "es"} más`);
        return current;
      }
      return [...current, url];
    });
  }

  function confirmSelection() {
    if (!selected.length) return;
    onSelect(selected);
    setOpen(false);
    setSelected([]);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void openLibrary()}
        className={className || "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-black hover:bg-muted"}
      >
        <ImageIcon className="h-4 w-4" />
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[180] grid place-items-center bg-black/55 p-3 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-border p-5 sm:p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[.18em] text-primary">Biblioteca multimedia</p>
                <h3 className="mt-1 text-2xl font-black">Elegir fotos ya subidas</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Selecciona hasta {remaining} imagen{remaining === 1 ? "" : "es"} para este producto.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-border p-2 hover:bg-muted" aria-label="Cerrar biblioteca">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-border p-4 sm:p-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar foto por nombre…"
                  className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-4 text-sm"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {loading ? (
                <div className="grid min-h-64 place-items-center text-muted-foreground">
                  <div className="flex items-center gap-2 font-bold"><Loader2 className="h-5 w-5 animate-spin" /> Cargando biblioteca…</div>
                </div>
              ) : visible.length === 0 ? (
                <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-border text-center text-sm text-muted-foreground">
                  {media.length ? "No hay imágenes que coincidan con la búsqueda." : "Todavía no hay imágenes guardadas en la biblioteca."}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {visible.map((item) => {
                    const alreadyUsed = normalizedCurrent.includes(item.url);
                    const checked = selected.includes(item.url);
                    return (
                      <div
                        key={item.path}
                        className={`group overflow-hidden rounded-2xl border text-left transition ${checked ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"} ${alreadyUsed ? "opacity-70" : ""}`}
                      >
                        <div className="relative aspect-square bg-muted">
                          <button
                            type="button"
                            disabled={alreadyUsed}
                            onClick={() => toggle(item.url)}
                            className="absolute inset-0 z-10 disabled:cursor-not-allowed"
                            aria-label={alreadyUsed ? "Imagen ya usada" : "Seleccionar imagen"}
                          />
                          <img src={item.url} alt={item.name} className="h-full w-full object-cover" />
                          {checked && (
                            <span className="absolute right-2 top-2 z-20 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow pointer-events-none">
                              <Check className="h-4 w-4" />
                            </span>
                          )}
                          <button
                            type="button"
                            disabled={deletingPath === item.path}
                            onClick={(event) => {
                              event.stopPropagation();
                              void deleteMediaItem(item);
                            }}
                            className="absolute left-2 top-2 z-30 grid h-8 w-8 place-items-center rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 disabled:opacity-60"
                            aria-label="Eliminar de la biblioteca"
                            title="Eliminar de la biblioteca"
                          >
                            {deletingPath === item.path ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                          {alreadyUsed && (
                            <span className="absolute inset-x-2 bottom-2 z-20 rounded-lg bg-black/70 px-2 py-1 text-center text-[10px] font-black text-white pointer-events-none">
                              Ya usada
                            </span>
                          )}
                        </div>
                        <p className="truncate px-3 py-2 text-xs font-bold">{item.name}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <p className="text-sm text-muted-foreground">
                {selected.length} seleccionada{selected.length === 1 ? "" : "s"} · máximo total {max}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-border px-4 py-3 text-sm font-black hover:bg-muted">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmSelection}
                  disabled={!selected.length}
                  className="rounded-xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground disabled:opacity-50"
                >
                  Añadir {selected.length || ""} a la galería
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
