import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Copy,
  Eye,
  Image as ImageIcon,
  Megaphone,
  Pencil,
  Plus,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../../lib/backendStorage";
import {
  parseStorefrontPosts,
  serializeStorefrontPosts,
  storefrontPlacementOptions,
  storefrontPostLayoutOptions,
  storefrontPostTypeLabel,
  storefrontPostTypeOptions,
  type StorefrontPost,
  type StorefrontPostPlacement,
  type StorefrontPostType,
} from "../../lib/storefrontPosts";
import { MediaLibraryPicker } from "./MediaLibraryPicker";

function makeId() {
  return "post-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

function isoToLocalInput(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function localInputToIso(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function emptyPost(priority = 0): StorefrontPost {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    type: "free",
    layout: "card",
    title: "",
    description: "",
    label: "HERENCIA",
    imageUrls: [],
    ctaLabel: "Ver más",
    ctaHref: "",
    placements: ["home"],
    status: "draft",
    startsAt: "",
    endsAt: "",
    priority,
    createdAt: now,
    updatedAt: now,
  };
}

function publicationState(post: StorefrontPost) {
  if (post.status !== "published") return "Borrador";
  const now = Date.now();
  if (post.startsAt && new Date(post.startsAt).getTime() > now) return "Programada";
  if (post.endsAt && new Date(post.endsAt).getTime() < now) return "Finalizada";
  return "Publicada";
}

export function AdminPublications() {
  const [posts, setPosts] = useState<StorefrontPost[]>([]);
  const [editing, setEditing] = useState<StorefrontPost | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const reload = () => {
    setPosts(parseStorefrontPosts(backendStorage.getItem("storefrontPosts")));
    try {
      const rows = JSON.parse(backendStorage.getItem("adminProducts") || "[]");
      setProducts(
        (Array.isArray(rows) ? rows : []).filter(
          (item: any) => item?.active !== false && !item?.deletedAt && String(item?.status || "active") !== "archived"
        )
      );
    } catch {
      setProducts([]);
    }
  };

  useEffect(() => {
    let mounted = true;
    const start = async () => {
      await backendStorage.refresh().catch(() => null);
      if (mounted) reload();
    };
    void start();
    const sync = () => reload();
    window.addEventListener("backend-storage", sync);
    window.addEventListener("storage", sync);
    return () => {
      mounted = false;
      window.removeEventListener("backend-storage", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const orderedPosts = useMemo(
    () =>
      [...posts].sort(
        (a, b) =>
          Number(a.priority || 0) - Number(b.priority || 0) ||
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    [posts]
  );

  async function persist(next: StorefrontPost[], message: string) {
    setSaving(true);
    try {
      const normalized = next.map((post, index) => ({
        ...post,
        priority: Number.isFinite(Number(post.priority)) ? Number(post.priority) : index,
      }));
      const result = await backendStorage.setItem("storefrontPosts", serializeStorefrontPosts(normalized));
      if (!result.ok) throw new Error(result.error || "No se pudo sincronizar con el backend");
      setPosts(normalized);
      toast.success(message);
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar la publicación");
      throw error;
    } finally {
      setSaving(false);
    }
  }

  async function saveEditing(status: "draft" | "published") {
    if (!editing) return;
    if (!editing.title.trim()) {
      toast.error("Escribe un título para la publicación");
      return;
    }
    if (!editing.placements.length) {
      toast.error("Selecciona al menos un lugar donde mostrarla");
      return;
    }
    if (editing.startsAt && editing.endsAt && new Date(editing.endsAt) <= new Date(editing.startsAt)) {
      toast.error("La fecha de finalización debe ser posterior al inicio");
      return;
    }

    const now = new Date().toISOString();
    const nextPost: StorefrontPost = {
      ...editing,
      title: editing.title.trim(),
      description: editing.description.trim(),
      label: editing.label.trim() || storefrontPostTypeLabel(editing.type),
      ctaLabel: editing.ctaLabel.trim(),
      ctaHref: editing.ctaHref.trim(),
      status,
      updatedAt: now,
    };
    const exists = posts.some((post) => post.id === nextPost.id);
    const next = exists
      ? posts.map((post) => (post.id === nextPost.id ? nextPost : post))
      : [...posts, nextPost];
    await persist(next, status === "published" ? "Publicación enviada al frontend" : "Borrador guardado");
    setEditing(null);
  }

  function selectType(type: StorefrontPostType) {
    if (!editing) return;
    setEditing({
      ...editing,
      type,
      label: storefrontPostTypeLabel(type),
      layout: type === "offer" || type === "campaign" ? "banner" : editing.layout,
    });
  }

  function selectProduct(productId: string) {
    if (!editing) return;
    const product = products.find((item) => String(item.id) === String(productId));
    if (!product) {
      setEditing({ ...editing, linkedProductId: undefined });
      return;
    }
    const image = String(product.image || product.images?.[0] || "").trim();
    setEditing({
      ...editing,
      linkedProductId: String(product.id),
      type: "product",
      label: "DESTACADO",
      title: String(product.name || editing.title),
      description: String(product.shortDescription || product.description || editing.description || "").slice(0, 1400),
      imageUrls: image ? [image, ...editing.imageUrls.filter((url) => url !== image)].slice(0, 8) : editing.imageUrls,
      ctaLabel: "Ver producto",
      ctaHref: "/producto/" + product.id,
    });
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!editing || !fileList?.length) return;
    const remaining = Math.max(0, 8 - editing.imageUrls.length);
    const files = Array.from(fileList).slice(0, remaining);
    if (!files.length) return toast.error("La publicación ya tiene 8 imágenes");

    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const uploaded = await backendApi.uploadSiteMediaFile(file);
        const url = String(uploaded.media?.url || "").trim();
        if (url) urls.push(url);
      }
      if (!urls.length) throw new Error("No se pudo subir ninguna imagen");
      setEditing((current) =>
        current ? { ...current, imageUrls: [...current.imageUrls, ...urls].slice(0, 8) } : current
      );
      toast.success(urls.length === 1 ? "Foto añadida" : urls.length + " fotos añadidas");
    } catch (error: any) {
      toast.error(error?.message || "No se pudieron subir las fotos");
    } finally {
      setUploading(false);
    }
  }

  async function togglePublished(post: StorefrontPost) {
    const status = post.status === "published" ? "draft" : "published";
    await persist(
      posts.map((item) =>
        item.id === post.id ? { ...item, status, updatedAt: new Date().toISOString() } : item
      ),
      status === "published" ? "Publicación activada" : "Publicación ocultada"
    );
  }

  async function removePost(post: StorefrontPost) {
    if (!window.confirm('¿Eliminar "' + post.title + '"?')) return;
    await persist(posts.filter((item) => item.id !== post.id), "Publicación eliminada");
    if (editing?.id === post.id) setEditing(null);
  }

  async function duplicatePost(post: StorefrontPost) {
    const now = new Date().toISOString();
    const copy: StorefrontPost = {
      ...post,
      id: makeId(),
      title: post.title + " · copia",
      status: "draft",
      priority: posts.length,
      createdAt: now,
      updatedAt: now,
    };
    await persist([...posts, copy], "Copia creada como borrador");
    setEditing(copy);
  }

  async function move(post: StorefrontPost, direction: -1 | 1) {
    const rows = orderedPosts;
    const index = rows.findIndex((item) => item.id === post.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= rows.length) return;
    const nextRows = [...rows];
    [nextRows[index], nextRows[target]] = [nextRows[target], nextRows[index]];
    await persist(
      nextRows.map((item, position) => ({ ...item, priority: position, updatedAt: item.id === post.id ? new Date().toISOString() : item.updatedAt })),
      "Orden actualizado"
    );
  }

  if (editing) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Publicaciones · Frontend</p>
            <h2 className="mt-1 text-3xl font-black">{posts.some((post) => post.id === editing.id) ? "Editar publicación" : "Nueva publicación"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">Foto, texto, botón, formato, programación y ubicación desde un único editor.</p>
          </div>
          <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-border px-4 py-3 font-black hover:bg-muted">Volver al feed</button>
        </div>

        <section className="rounded-3xl border border-border bg-card p-5 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">1. ¿Qué quieres publicar?</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {storefrontPostTypeOptions.map((item) => (
              <button
                type="button"
                key={item.value}
                onClick={() => selectType(item.value)}
                className={`rounded-2xl border p-4 text-left transition ${editing.type === item.value ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "border-border hover:border-primary/40"}`}
              >
                <p className="font-black">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
              </button>
            ))}
          </div>

          {editing.type === "product" && (
            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-black">Producto del catálogo</span>
              <select
                value={editing.linkedProductId || ""}
                onChange={(event) => selectProduct(event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-3"
              >
                <option value="">Seleccionar producto…</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
              <span className="mt-2 block text-xs text-muted-foreground">Al elegirlo se rellenan automáticamente foto, nombre y enlace real del producto.</span>
            </label>
          )}
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">2. Galería</p>
              <h3 className="mt-1 text-xl font-black">Fotos de la publicación</h3>
            </div>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-black">{editing.imageUrls.length}/8</span>
          </div>

          {editing.imageUrls.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {editing.imageUrls.map((url, index) => (
                <div key={url + index} className="group relative overflow-hidden rounded-2xl border border-border bg-muted">
                  <img src={url} alt="" className="aspect-square h-full w-full object-cover" />
                  {index === 0 && <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-black text-white">PRINCIPAL</span>}
                  <button
                    type="button"
                    onClick={() => setEditing({ ...editing, imageUrls: editing.imageUrls.filter((_, i) => i !== index) })}
                    className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-red-600 text-white shadow"
                    aria-label="Quitar foto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <label className="relative inline-flex cursor-pointer items-center gap-2 overflow-hidden rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground">
              <Upload className="h-4 w-4" /> {uploading ? "Subiendo…" : "Subir fotos"}
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                disabled={uploading}
                className="absolute inset-0 cursor-pointer opacity-0"
                onChange={(event) => {
                  const input = event.currentTarget;
                  void uploadFiles(input.files).finally(() => { input.value = ""; });
                }}
              />
            </label>
            <MediaLibraryPicker
              currentUrls={editing.imageUrls}
              max={8}
              label="Usar de biblioteca"
              onSelect={(urls) => setEditing({ ...editing, imageUrls: [...editing.imageUrls, ...urls].slice(0, 8) })}
            />
          </div>
        </section>

        <section className="grid gap-6 rounded-3xl border border-border bg-card p-5 sm:p-7 lg:grid-cols-2">
          <div className="space-y-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">3. Contenido</p>
            <label className="block">
              <span className="mb-2 block text-sm font-black">Título *</span>
              <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} maxLength={180} className="w-full rounded-xl border border-border bg-background px-4 py-3" placeholder="Ej. Semana Verde" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-black">Descripción</span>
              <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={5} maxLength={1400} className="w-full rounded-xl border border-border bg-background px-4 py-3" placeholder="Cuenta qué quieres destacar…" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-black">Etiqueta</span>
              <input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} maxLength={40} className="w-full rounded-xl border border-border bg-background px-4 py-3" placeholder="OFERTA, NUEVO, EVENTO…" />
            </label>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">4. Acción</p>
            <label className="block">
              <span className="mb-2 block text-sm font-black">Texto del botón</span>
              <input value={editing.ctaLabel} onChange={(e) => setEditing({ ...editing, ctaLabel: e.target.value })} className="w-full rounded-xl border border-border bg-background px-4 py-3" placeholder="Ver oferta" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-black">Destino</span>
              <input value={editing.ctaHref} onChange={(e) => setEditing({ ...editing, ctaHref: e.target.value })} className="w-full rounded-xl border border-border bg-background px-4 py-3" placeholder="/productos o https://…" />
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                ["Tienda", "/productos"],
                ["Servicios", "/servicios"],
                ["Colombia", "/colombia"],
                ["Herenc(IA)", "/ia"],
              ].map(([label, href]) => (
                <button key={href} type="button" onClick={() => setEditing({ ...editing, ctaLabel: "Ver " + label, ctaHref: href })} className="rounded-full border border-border px-3 py-2 text-xs font-black hover:bg-muted">{label}</button>
              ))}
              <button type="button" onClick={() => setEditing({ ...editing, ctaLabel: "", ctaHref: "" })} className="rounded-full border border-border px-3 py-2 text-xs font-black hover:bg-muted">Sin botón</button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">5. Formato del frontend</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {storefrontPostLayoutOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setEditing({ ...editing, layout: item.value })}
                className={`rounded-2xl border p-4 text-left ${editing.layout === item.value ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "border-border hover:border-primary/40"}`}
              >
                <p className="font-black">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-6 rounded-3xl border border-border bg-card p-5 sm:p-7 lg:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">6. Dónde mostrarla</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {storefrontPlacementOptions.map((item) => {
                const checked = editing.placements.includes(item.value);
                return (
                  <label key={item.value} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 ${checked ? "border-primary bg-primary/5" : "border-border"}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const placements = checked
                          ? editing.placements.filter((value) => value !== item.value)
                          : [...editing.placements, item.value as StorefrontPostPlacement];
                        setEditing({ ...editing, placements });
                      }}
                    />
                    <span className="font-black">{item.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">7. Programación</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-black">Empieza</span>
                <input type="datetime-local" value={isoToLocalInput(editing.startsAt)} onChange={(e) => setEditing({ ...editing, startsAt: localInputToIso(e.target.value) })} className="w-full rounded-xl border border-border bg-background px-3 py-3" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-black">Termina</span>
                <input type="datetime-local" value={isoToLocalInput(editing.endsAt)} onChange={(e) => setEditing({ ...editing, endsAt: localInputToIso(e.target.value) })} className="w-full rounded-xl border border-border bg-background px-3 py-3" />
              </label>
            </div>
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-black">Prioridad / orden</span>
              <input type="number" min={0} value={editing.priority} onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value || 0) })} className="w-full rounded-xl border border-border bg-background px-3 py-3" />
            </label>
          </div>
        </section>

        <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Puedes dejarla en borrador, publicarla ahora o programarla con una fecha futura.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-border px-4 py-3 font-black">Cancelar</button>
            <button type="button" disabled={saving} onClick={() => void saveEditing("draft")} className="rounded-xl border border-primary px-4 py-3 font-black text-primary disabled:opacity-50">Guardar borrador</button>
            <button type="button" disabled={saving} onClick={() => void saveEditing("published")} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" /> Guardar y publicar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary"><Megaphone className="h-3.5 w-3.5" /> FEED DEL FRONTEND</div>
            <h2 className="mt-3 text-3xl font-black">Publicaciones</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Crea ofertas, novedades, campañas, productos destacados, servicios, anuncios, eventos o contenido libre y publícalo directamente en Herencia Market.</p>
          </div>
          <button type="button" onClick={() => setEditing(emptyPost(posts.length))} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-primary-foreground shadow-lg"><Plus className="h-4 w-4" /> Nueva publicación</button>
        </div>

        <div className="grid gap-3 border-t border-border bg-muted/20 p-5 sm:grid-cols-4">
          <Metric label="Total" value={posts.length} />
          <Metric label="Publicadas" value={posts.filter((post) => post.status === "published").length} />
          <Metric label="Programadas" value={posts.filter((post) => publicationState(post) === "Programada").length} />
          <Metric label="Borradores" value={posts.filter((post) => post.status === "draft").length} />
        </div>
      </section>

      {orderedPosts.length === 0 ? (
        <section className="grid min-h-80 place-items-center rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <div>
            <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-xl font-black">Todavía no hay publicaciones</h3>
            <p className="mt-2 text-sm text-muted-foreground">Crea la primera y aparecerá en el frontend cuando la publiques.</p>
            <button type="button" onClick={() => setEditing(emptyPost(0))} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-primary-foreground"><Plus className="h-4 w-4" /> Crear primera publicación</button>
          </div>
        </section>
      ) : (
        <div className="space-y-3">
          {orderedPosts.map((post, index) => (
            <article key={post.id} className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm md:grid-cols-[150px_1fr_auto] md:items-center">
              <div className="aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                {post.imageUrls[0] ? <img src={post.imageUrls[0]} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-muted-foreground"><ImageIcon className="h-7 w-7" /></div>}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black text-primary">{post.label || storefrontPostTypeLabel(post.type)}</span>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-black">{publicationState(post)}</span>
                  <span className="text-xs text-muted-foreground">{storefrontPostLayoutOptions.find((item) => item.value === post.layout)?.label}</span>
                </div>
                <h3 className="mt-2 truncate text-lg font-black">{post.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{post.description || "Sin descripción"}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-muted-foreground">
                  {post.placements.map((placement) => <span key={placement}>#{storefrontPlacementOptions.find((item) => item.value === placement)?.label || placement}</span>)}
                  {post.startsAt && <span>· desde {new Date(post.startsAt).toLocaleString("es-ES")}</span>}
                  {post.endsAt && <span>· hasta {new Date(post.endsAt).toLocaleString("es-ES")}</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 md:max-w-[240px] md:justify-end">
                <button type="button" disabled={index === 0 || saving} onClick={() => void move(post, -1)} className="rounded-lg border border-border p-2 disabled:opacity-30" title="Subir"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" disabled={index === orderedPosts.length - 1 || saving} onClick={() => void move(post, 1)} className="rounded-lg border border-border p-2 disabled:opacity-30" title="Bajar"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" disabled={saving} onClick={() => void togglePublished(post)} className={`inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-black ${post.status === "published" ? "border-amber-300 bg-amber-50 text-amber-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}><Eye className="h-3.5 w-3.5" /> {post.status === "published" ? "Ocultar" : "Publicar"}</button>
                <button type="button" onClick={() => setEditing({ ...post })} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-black"><Pencil className="h-3.5 w-3.5" /> Editar</button>
                <button type="button" onClick={() => void duplicatePost(post)} className="rounded-lg border border-border p-2" title="Duplicar"><Copy className="h-4 w-4" /></button>
                <button type="button" onClick={() => void removePost(post)} className="rounded-lg border border-red-200 p-2 text-red-600" title="Eliminar"><Trash2 className="h-4 w-4" /></button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-3"><CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><p>Las publicaciones programadas se muestran automáticamente cuando llega la fecha de inicio y desaparecen al llegar la fecha final. No necesitas volver al Admin para activarlas o quitarlas.</p></div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
