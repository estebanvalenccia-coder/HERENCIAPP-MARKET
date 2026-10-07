export type StorefrontPostType = "offer" | "new" | "product" | "service" | "announcement" | "campaign" | "inspiration" | "event" | "free";
export type StorefrontPostLayout = "card" | "banner" | "feature" | "story" | "carousel";
export type StorefrontPostPlacement = "home" | "products" | "plants" | "services" | "colombia";
export type StorefrontPostStatus = "draft" | "published";

export type StorefrontPost = {
  id: string;
  type: StorefrontPostType;
  layout: StorefrontPostLayout;
  title: string;
  description: string;
  label: string;
  imageUrls: string[];
  ctaLabel: string;
  ctaHref: string;
  placements: StorefrontPostPlacement[];
  status: StorefrontPostStatus;
  startsAt: string;
  endsAt: string;
  priority: number;
  linkedProductId?: string;
  createdAt: string;
  updatedAt: string;
};

export const storefrontPostTypeOptions = [
  { value: "offer", label: "Oferta / Promoción", description: "Descuentos, rebajas y promociones temporales." },
  { value: "new", label: "Novedad", description: "Nuevos productos, colecciones o lanzamientos." },
  { value: "product", label: "Producto destacado", description: "Destaca un producto real del catálogo." },
  { value: "service", label: "Servicio destacado", description: "Jardinería, limpieza, asesoría y otros servicios." },
  { value: "announcement", label: "Anuncio", description: "Horarios, avisos e información importante." },
  { value: "campaign", label: "Campaña", description: "Navidad, San Valentín, Día de la Madre y más." },
  { value: "inspiration", label: "Consejo / Inspiración", description: "Ideas, cuidados y contenido editorial." },
  { value: "event", label: "Evento", description: "Talleres, actividades y fechas especiales." },
  { value: "free", label: "Publicación libre", description: "Foto, texto y botón con total libertad." },
] as const;

export const storefrontPostLayoutOptions = [
  { value: "card", label: "Tarjeta", description: "Formato equilibrado para el feed." },
  { value: "banner", label: "Banner horizontal", description: "Una promoción ancha con imagen de fondo." },
  { value: "feature", label: "Destacado grande", description: "Bloque protagonista con imagen y texto." },
  { value: "story", label: "Historia vertical", description: "Formato alto para inspiración y novedades." },
  { value: "carousel", label: "Carrusel", description: "Varias fotos dentro de la misma publicación." },
] as const;

export const storefrontPlacementOptions = [
  { value: "home", label: "Portada" },
  { value: "products", label: "Tienda / Productos" },
  { value: "plants", label: "Plantas" },
  { value: "services", label: "Servicios" },
  { value: "colombia", label: "Colombianísimas" },
] as const;

const TYPE_LABELS: Record<StorefrontPostType, string> = {
  offer: "OFERTA", new: "NUEVO", product: "DESTACADO", service: "SERVICIO", announcement: "ANUNCIO",
  campaign: "CAMPAÑA", inspiration: "INSPIRACIÓN", event: "EVENTO", free: "HERENCIA",
};

export function storefrontPostTypeLabel(type: StorefrontPostType) { return TYPE_LABELS[type] || "HERENCIA"; }

function cleanString(value: unknown) { return String(value || "").trim(); }
function normalizeDate(value: unknown) {
  const raw = cleanString(value);
  if (!raw) return "";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function normalizePost(input: any, index: number): StorefrontPost {
  const type = storefrontPostTypeOptions.some((item) => item.value === input?.type) ? input.type as StorefrontPostType : "free";
  const layout = storefrontPostLayoutOptions.some((item) => item.value === input?.layout) ? input.layout as StorefrontPostLayout : "card";
  const placements = Array.isArray(input?.placements) ? input.placements.filter((value: unknown) => storefrontPlacementOptions.some((item) => item.value === value)) : ["home"];
  const imageUrls = Array.isArray(input?.imageUrls) ? input.imageUrls.map(cleanString).filter(Boolean).slice(0, 8) : cleanString(input?.imageUrl) ? [cleanString(input.imageUrl)] : [];
  const createdAt = normalizeDate(input?.createdAt) || new Date().toISOString();
  return {
    id: cleanString(input?.id) || "post-" + (index + 1), type, layout,
    title: cleanString(input?.title).slice(0, 180), description: cleanString(input?.description).slice(0, 1400),
    label: cleanString(input?.label).slice(0, 40) || storefrontPostTypeLabel(type), imageUrls,
    ctaLabel: cleanString(input?.ctaLabel).slice(0, 80), ctaHref: cleanString(input?.ctaHref).slice(0, 600),
    placements: placements.length ? placements : ["home"], status: input?.status === "published" ? "published" : "draft",
    startsAt: normalizeDate(input?.startsAt), endsAt: normalizeDate(input?.endsAt),
    priority: Number.isFinite(Number(input?.priority)) ? Number(input.priority) : index,
    linkedProductId: cleanString(input?.linkedProductId) || undefined, createdAt, updatedAt: normalizeDate(input?.updatedAt) || createdAt,
  };
}

export function parseStorefrontPosts(raw: string | null | undefined): StorefrontPost[] {
  try { const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed.map(normalizePost) : []; } catch { return []; }
}
export function serializeStorefrontPosts(posts: StorefrontPost[]) { return JSON.stringify(posts.map(normalizePost)); }
export function visibleStorefrontPosts(posts: StorefrontPost[], placement: StorefrontPostPlacement = "home", now = new Date()) {
  const timestamp = now.getTime();
  return posts.filter((post) => post.status === "published" && post.placements.includes(placement))
    .filter((post) => (!post.startsAt || new Date(post.startsAt).getTime() <= timestamp) && (!post.endsAt || new Date(post.endsAt).getTime() >= timestamp))
    .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}