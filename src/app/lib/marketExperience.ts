import type { SiteContent, SiteLink } from "./siteContent";

export type MarketCard = {
  title: string;
  subtitle: string;
  imageUrl: string;
  href: string;
};

export type MarketServiceCard = MarketCard & {
  ctaLabel: string;
};

export type MarketPromo = {
  title: string;
  subtitle: string;
  imageUrl: string;
  href: string;
  buttonLabel: string;
};

export type MarketSalesAction = {
  id: "bouquet" | "plant" | "sweet" | "gardening" | "seeds" | "soil" | "decor" | "fashion" | "services" | "photo" | "gift" | "surprise";
  label: string;
  prompt: string;
};

export type MarketExperienceContent = {
  locationLabel: string;
  announcement: string;
  navigation: SiteLink[];
  home: {
    kicker: string;
    title: string;
    description: string;
    heroImageUrl: string;
    heroOverlayColor: string;
    heroOverlayOpacity: number;
    heroOverlayWidth: number;
    categoriesTitle: string;
    categories: MarketCard[];
    servicesTitle: string;
    services: MarketServiceCard[];
    featuredTitle: string;
    featuredSubtitle: string;
    trust: Array<{ title: string; description: string }>;
  };
  dulce: MarketPromo & {
    kicker: string;
    pageTitle: string;
    pageSubtitle: string;
  };
  moda: MarketPromo & {
    kicker: string;
    pageTitle: string;
    pageSubtitle: string;
  };
  about: {
    kicker: string;
    title: string;
    description: string;
    imageUrl: string;
    values: Array<{ title: string; description: string }>;
  };
  sales: {
    enabled: boolean;
    buttonLabel: string;
    title: string;
    prompt: string;
    helperText: string;
    quickActions: MarketSalesAction[];
  };
};

export const defaultMarketExperience: MarketExperienceContent = {
  locationLabel: "Barcelona",
  announcement: "Envíos en Barcelona · Productos y servicios para un hogar con más vida · Asesoría personalizada",
  navigation: [
    { label: "Inicio", href: "/" },
    { label: "Plantas", href: "/productos?coleccion=plantas" },
    { label: "Tienda", href: "/productos" },
    { label: "Servicios", href: "/servicios" },
    { label: "Dulce", href: "/dulce" },
    { label: "Moda", href: "/moda" },
    { label: "Nosotros", href: "/nosotros" },
    { label: "Comunidad", href: "/comunidad" },
    { label: "Contacto", href: "/contacto" },
  ],
  home: {
    kicker: "PLANTAS · HOGAR · NATURALEZA",
    title: "Haz de tu hogar un espacio con vida",
    description: "Plantas, decoración, productos, servicios y detalles únicos para crear espacios que te hagan bien.",
    heroImageUrl: "/herencia-portada.avif",
    heroOverlayColor: "#102b20",
    heroOverlayOpacity: 90,
    heroOverlayWidth: 72,
    categoriesTitle: "Todo para un estilo de vida más verde",
    categories: [
      {
        title: "Plantas",
        subtitle: "Verde para cada rincón",
        imageUrl: "https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=700&q=82",
        href: "/productos?categoria=plantas-interior",
      },
      {
        title: "Semillas",
        subtitle: "Pequeños comienzos",
        imageUrl: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=700&q=82",
        href: "/productos?categoria=semillas",
      },
      {
        title: "Artículos de jardinería",
        subtitle: "Herramientas y accesorios",
        imageUrl: "https://images.unsplash.com/photo-1617576683096-00fc8eecb3af?auto=format&fit=crop&w=700&q=82",
        href: "/productos?categoria=accesorios",
      },
      {
        title: "Tierra y sustratos",
        subtitle: "La base de un buen cultivo",
        imageUrl: "https://images.unsplash.com/photo-1627920769842-6887c6df05ca?auto=format&fit=crop&w=700&q=82",
        href: "/productos?categoria=sustratos",
      },
      {
        title: "Decoración",
        subtitle: "Hogar con identidad",
        imageUrl: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=700&q=82",
        href: "/productos?categoria=decoracion",
      },
      {
        title: "Servicios",
        subtitle: "Te acompañamos en tu proyecto",
        imageUrl: "https://images.unsplash.com/photo-1598902108854-10e335adac99?auto=format&fit=crop&w=700&q=82",
        href: "/servicios",
      },
      {
        title: "Dulce",
        subtitle: "Momentos que se celebran",
        imageUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=700&q=82",
        href: "/dulce",
      },
      {
        title: "Moda",
        subtitle: "Funcionalidad con estilo",
        imageUrl: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=700&q=82",
        href: "/moda",
      },
    ],
    servicesTitle: "Nuestros servicios",
    services: [
      {
        title: "Asesoría personalizada",
        subtitle: "Te ayudamos a elegir lo ideal para tu espacio, necesidad o regalo.",
        imageUrl: "https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=900&q=82",
        href: "/servicios#asesoria",
        ctaLabel: "Saber más",
      },
      {
        title: "Diseño de jardín y mantenimiento",
        subtitle: "Creamos y cuidamos espacios verdes para que funcionen todo el año.",
        imageUrl: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=900&q=82",
        href: "/servicios#jardineria",
        ctaLabel: "Saber más",
      },
      {
        title: "Decoración de espacios",
        subtitle: "Ambientes con plantas, objetos y detalles que se sienten tuyos.",
        imageUrl: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=82",
        href: "/servicios#decoracion",
        ctaLabel: "Saber más",
      },
      {
        title: "Limpieza de muebles y casas",
        subtitle: "Espacios cuidados, frescos y listos para disfrutarse.",
        imageUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=82",
        href: "/servicios#limpieza",
        ctaLabel: "Saber más",
      },
      {
        title: "Diseño floral por encargo",
        subtitle: "Flores creadas para una ocasión, una persona o un espacio concreto.",
        imageUrl: "https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=900&q=82",
        href: "/crear-ramo",
        ctaLabel: "Crear un ramo",
      },
    ],
    featuredTitle: "Productos destacados",
    featuredSubtitle: "Una selección de Herencia para tu casa, tu jardín y tus momentos especiales.",
    trust: [
      { title: "Calidad seleccionada", description: "Productos y servicios elegidos con cuidado." },
      { title: "Envíos en Barcelona", description: "Entrega clara y seguimiento de tu pedido." },
      { title: "Asesoría personalizada", description: "Te acompañamos antes y después de comprar." },
      { title: "Compra segura", description: "Pagos y procesos preparados para vender con confianza." },
    ],
  },
  dulce: {
    kicker: "PEQUEÑOS DETALLES, GRANDES MOMENTOS",
    title: "Dulce",
    subtitle: "Desayunos sorpresa, postres por encargo y decoración de ambientes para celebrar de una forma especial.",
    imageUrl: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1600&q=88",
    href: "/dulce",
    buttonLabel: "Ver colección",
    pageTitle: "Dulces momentos para hacer la vida más especial",
    pageSubtitle: "Desayunos sorpresa, postres por encargo y decoración de ambientes preparados con mimo en Barcelona.",
  },
  moda: {
    kicker: "ESTILO EN CADA DETALLE",
    title: "Moda",
    subtitle: "Camisas, delantales y guantes pensados para trabajar, crear y vivir la naturaleza con comodidad.",
    imageUrl: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1600&q=88",
    href: "/moda",
    buttonLabel: "Ver colección",
    pageTitle: "Moda con propósito",
    pageSubtitle: "Prendas y accesorios funcionales, cómodos y con una estética coherente con el universo Herencia.",
  },
  about: {
    kicker: "SOBRE HERENCIA",
    title: "Naturaleza, hogar y detalles con alma",
    description: "Herencia une productos, servicios y experiencias alrededor de una idea sencilla: ayudarte a crear espacios más vivos, cuidados y personales.",
    imageUrl: "https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?auto=format&fit=crop&w=1600&q=88",
    values: [
      { title: "Naturaleza cercana", description: "Lo verde forma parte de la vida cotidiana, no solo de ocasiones especiales." },
      { title: "Diseño con intención", description: "Cada producto y servicio debe tener una función y sentirse bien en el espacio." },
      { title: "Atención humana", description: "La tecnología ayuda a vender mejor, pero el trato sigue siendo cercano." },
      { title: "Barcelona", description: "Nuestra referencia de servicio y comunicación local es Barcelona." },
    ],
  },
  sales: {
    enabled: true,
    buttonLabel: "Crear con Herencia",
    title: "HERENCIA SALES",
    prompt: "¿Qué quieres crear o encontrar hoy? 🌿",
    helperText: "Solo compras, personalización y productos de Herencia.",
    quickActions: [
      { id: "bouquet", label: "Crear un ramo", prompt: "Quiero crear un ramo personalizado con las flores reales disponibles." },
      { id: "plant", label: "Plantas", prompt: "Muéstrame plantas disponibles para comprar." },
      { id: "sweet", label: "Dulces", prompt: "Muéstrame dulces, tartas, chocolates, galletas y cajas regalo disponibles." },
      { id: "gardening", label: "Jardinería", prompt: "Muéstrame productos de jardinería disponibles: macetas, herramientas, riego, fertilizantes y accesorios." },
      { id: "seeds", label: "Semillas", prompt: "Muéstrame semillas disponibles para comprar." },
      { id: "soil", label: "Tierra y sustratos", prompt: "Muéstrame tierra, sustratos, humus, compost y productos relacionados disponibles." },
      { id: "decor", label: "Decoración", prompt: "Muéstrame productos de decoración disponibles para comprar." },
      { id: "fashion", label: "Moda", prompt: "Muéstrame productos de moda disponibles, incluyendo tallas, colores y variantes." },
      { id: "services", label: "Servicios", prompt: "Muéstrame los servicios de Herencia que puedo contratar." },
      { id: "photo", label: "Buscar por foto", prompt: "" },
      { id: "gift", label: "Buscar un regalo", prompt: "Quiero encontrar un regalo usando productos reales disponibles." },
      { id: "surprise", label: "Sorpréndeme", prompt: "Sorpréndeme con algo real que pueda comprar ahora en Herencia." },
    ],
  },
};

const LEGACY_HOME_HERO_URLS = new Set([
  "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=2000&q=88",
  "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=2000&q=86",
]);

function mergeObject<T extends Record<string, any>>(base: T, incoming: unknown): T {
  if (!incoming || typeof incoming !== "object") return JSON.parse(JSON.stringify(base));
  return { ...base, ...(incoming as Partial<T>) } as T;
}

function mergeList<T extends Record<string, any>>(base: T[], incoming: unknown): T[] {
  if (!Array.isArray(incoming) || incoming.length === 0) return JSON.parse(JSON.stringify(base));
  return incoming.map((item, index) => ({ ...(base[index] || {}), ...(item || {}) })) as T[];
}

function mergeNavigation(base: SiteLink[], incoming: unknown): SiteLink[] {
  const merged = mergeList(base, incoming);
  const hasPlants = merged.some((item) => {
    const label = String(item?.label || "").toLowerCase();
    const href = String(item?.href || "").toLowerCase();
    return label === "plantas" || href.includes("coleccion=plantas");
  });
  const hasCommunity = merged.some((item) => String(item?.href || "").split("?")[0] === "/comunidad");
  let ensured = merged;
  if (!hasCommunity) {
    const contactIndex = ensured.findIndex((item) => String(item?.href || "").split("?")[0] === "/contacto");
    const community: SiteLink = { label: "Comunidad", href: "/comunidad" };
    ensured = contactIndex >= 0 ? [...ensured.slice(0, contactIndex), community, ...ensured.slice(contactIndex)] : [...ensured, community];
  }
  if (hasPlants) return ensured;
  const plants: SiteLink = { label: "Plantas", href: "/productos?coleccion=plantas" };
  const startIndex = ensured.findIndex((item) => String(item?.href || "") === "/");
  if (startIndex >= 0) return [...ensured.slice(0, startIndex + 1), plants, ...ensured.slice(startIndex + 1)];
  return [plants, ...ensured];
}

function mergeSalesActions(base: MarketSalesAction[], incoming: unknown): MarketSalesAction[] {
  if (!Array.isArray(incoming) || incoming.length === 0) return JSON.parse(JSON.stringify(base));
  const incomingById = new Map(
    incoming
      .filter((item: any) => item && typeof item.id === "string")
      .map((item: any) => [item.id, item])
  );
  const baseIds = new Set(base.map((item) => item.id));
  const merged = base.map((item) => ({ ...item, ...(incomingById.get(item.id) || {}) })) as MarketSalesAction[];
  const customExtras = incoming.filter(
    (item: any) => item && typeof item.id === "string" && !baseIds.has(item.id)
  ) as MarketSalesAction[];
  return [...merged, ...customExtras];
}

export function getMarketExperience(site: SiteContent): MarketExperienceContent {
  const incoming = (site as SiteContent & { marketExperience?: Partial<MarketExperienceContent> }).marketExperience || {};
  const homeIncoming = incoming.home || {};
  const dulceIncoming = incoming.dulce || {};
  const modaIncoming = incoming.moda || {};
  const aboutIncoming = incoming.about || {};
  const salesIncoming = incoming.sales || {};
  const savedHeroImageUrl = String((homeIncoming as any).heroImageUrl || "").trim();
  const invalidDataUrl = savedHeroImageUrl.startsWith("data:") && !savedHeroImageUrl.startsWith("data:image/");
  const resolvedHeroImageUrl =
    !savedHeroImageUrl || invalidDataUrl || LEGACY_HOME_HERO_URLS.has(savedHeroImageUrl)
      ? defaultMarketExperience.home.heroImageUrl
      : savedHeroImageUrl;

  return {
    ...defaultMarketExperience,
    ...incoming,
    locationLabel: String(incoming.locationLabel || defaultMarketExperience.locationLabel),
    announcement: String(incoming.announcement || defaultMarketExperience.announcement),
    navigation: mergeNavigation(defaultMarketExperience.navigation, incoming.navigation),
    home: {
      ...defaultMarketExperience.home,
      ...homeIncoming,
      heroImageUrl: resolvedHeroImageUrl,
      categories: mergeList(defaultMarketExperience.home.categories, homeIncoming.categories),
      services: mergeList(defaultMarketExperience.home.services, homeIncoming.services),
      trust: mergeList(defaultMarketExperience.home.trust, homeIncoming.trust),
    },
    dulce: mergeObject(defaultMarketExperience.dulce, dulceIncoming),
    moda: mergeObject(defaultMarketExperience.moda, modaIncoming),
    about: {
      ...defaultMarketExperience.about,
      ...aboutIncoming,
      values: mergeList(defaultMarketExperience.about.values, aboutIncoming.values),
    },
    sales: {
      ...defaultMarketExperience.sales,
      ...salesIncoming,
      quickActions: mergeSalesActions(defaultMarketExperience.sales.quickActions, salesIncoming.quickActions),
    },
  };
}

export function withMarketExperience(site: SiteContent, marketExperience: MarketExperienceContent): SiteContent {
  return {
    ...(site as any),
    marketExperience,
  } as SiteContent;
}
