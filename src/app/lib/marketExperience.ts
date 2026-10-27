import type { SiteContent, SiteLink } from "./siteContent";

export type PublicationWindow = { startAt?: string; endAt?: string };

export type MarketCard = {
  visible?: boolean;
  schedule?: PublicationWindow;
  title: string;
  subtitle: string;
  imageUrl: string;
  href: string;
};

export type MarketServiceCard = MarketCard & {
  ctaLabel: string;
};

export type MarketPromo = {
  enabled?: boolean;
  schedule?: PublicationWindow;
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
  enabled?: boolean;
};

export type MarketExperienceContent = {
  locationLabel: string;
  announcement: string;
  navigation: SiteLink[];
  layout: {
    announcement: boolean;
    search: boolean;
    account: boolean;
    favorites: boolean;
    cart: boolean;
    deliverySelector: boolean;
    footer: boolean;
  };
  home: {
    sections: {
      hero: boolean;
      delivery: boolean;
      categoryStrip: boolean;
      plantCta: boolean;
      categoriesGrid: boolean;
      services: boolean;
      featured: boolean;
      promotions: boolean;
      trust: boolean;
    };

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
    trust: Array<{ title: string; description: string; visible?: boolean; schedule?: PublicationWindow }>;
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
    position: "left" | "right";
    bottomOffset: number;
    buttonColor: string;
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
    { label: "Plantas", href: "/productos?coleccion=plantas", children: [
      { label: "Ver todas las plantas", href: "/productos?coleccion=plantas" },
      { label: "Interior", href: "/productos?coleccion=plantas&categoria=plantas-interior" },
      { label: "Exterior", href: "/productos?coleccion=plantas&categoria=plantas-exterior" },
      { label: "Cactus y suculentas", href: "/productos?coleccion=plantas&categoria=cactus-suculentas" },
      { label: "Orquídeas", href: "/productos?coleccion=plantas&categoria=orquideas" },
      { label: "Exóticas", href: "/productos?coleccion=plantas&categoria=plantas-exoticas" },
    ] },
    { label: "Tienda", href: "/productos" },
    { label: "Jardinería", href: "/productos?coleccion=jardineria", children: [
      { label: "Artículos de jardinería", href: "/productos?coleccion=jardineria" },
      { label: "Huerto urbano", href: "/productos?coleccion=jardineria&categoria=huerto-urbano" },
      { label: "Herramientas", href: "/productos?coleccion=jardineria&categoria=herramientas" },
      { label: "Riego", href: "/productos?coleccion=jardineria&categoria=riego" },
      { label: "Fertilizantes", href: "/productos?coleccion=jardineria&categoria=fertilizantes" },
      { label: "Accesorios", href: "/productos?coleccion=jardineria&categoria=accesorios-jardin" },
      { label: "Fungicidas", href: "/productos?coleccion=jardineria&categoria=fungicidas" },
      { label: "Acaricidas", href: "/productos?coleccion=jardineria&categoria=acaricidas" },
      { label: "Insecticidas", href: "/productos?coleccion=jardineria&categoria=insecticidas" },
      { label: "Otros fitosanitarios", href: "/productos?coleccion=jardineria&categoria=tratamientos-fitosanitarios" },
      { label: "Servicios de huerto urbano", href: "/servicios#huerto-urbano" },
    ] },
    { label: "Servicios", href: "/servicios" },
    { label: "Dulce", href: "/dulce" },
    { label: "Moda", href: "/moda" },
    { label: "Nosotros", href: "/nosotros" },
    { label: "Comunidad", href: "/comunidad" },
    { label: "Contacto", href: "/contacto" },
  ],
  layout: {
    announcement: true,
    search: true,
    account: true,
    favorites: true,
    cart: true,
    deliverySelector: true,
    footer: true,
  },
  home: {
    sections: {
      hero: true,
      delivery: true,
      categoryStrip: true,
      plantCta: true,
      categoriesGrid: true,
      services: true,
      featured: true,
      promotions: true,
      trust: true,
    },
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
        href: "/productos?coleccion=plantas",
      },
      {
        title: "Semillas",
        subtitle: "Pequeños comienzos",
        imageUrl: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=700&q=82",
        href: "/productos?coleccion=semillas",
      },
      {
        title: "Artículos de jardinería",
        subtitle: "Herramientas y accesorios",
        imageUrl: "https://images.unsplash.com/photo-1617576683096-00fc8eecb3af?auto=format&fit=crop&w=700&q=82",
        href: "/productos?coleccion=jardineria",
      },
      {
        title: "Tierra y sustratos",
        subtitle: "La base de un buen cultivo",
        imageUrl: "https://images.unsplash.com/photo-1627920769842-6887c6df05ca?auto=format&fit=crop&w=700&q=82",
        href: "/productos?coleccion=sustratos",
      },
      {
        title: "Decoración",
        subtitle: "Hogar con identidad",
        imageUrl: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=700&q=82",
        href: "/productos?coleccion=decoracion",
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
      {
        title: "Instalación y cuidado de huertos urbanos",
        subtitle: "Diseño, montaje, siembra y mantenimiento de huertos en balcones, patios y terrazas de Barcelona.",
        imageUrl: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=82",
        href: "/servicios#huerto-urbano",
        ctaLabel: "Solicitar información",
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
    position: "right",
    bottomOffset: 24,
    buttonColor: "#173d2a",
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
  // An explicitly empty list means "no items"; never repopulate removed items.
  if (!Array.isArray(incoming)) return JSON.parse(JSON.stringify(base));
  return incoming.map((item, index) => ({ ...(base[index] || {}), ...(item || {}) })) as T[];
}

function mergeNavigation(base: SiteLink[], incoming: unknown): SiteLink[] {
  if (!Array.isArray(incoming)) return JSON.parse(JSON.stringify(base));
  // Match by href rather than position. Reordering must not attach Plantas children to another link.
  return incoming.map((item: SiteLink) => {
    const defaults = base.find((entry) => entry.href === item.href);
    return { ...(defaults || {}), ...(item || {}) };
  });
}

function isDisabledSalesAction(item: any) {
  const id = String(item?.id || "").toLowerCase();
  const label = String(item?.label || "").toLowerCase();
  return (
    id.includes("florist") ||
    id.includes("florister") ||
    id.includes("handoff") ||
    label.includes("floristería") ||
    label.includes("floristeria")
  );
}

function mergeSalesActions(base: MarketSalesAction[], incoming: unknown): MarketSalesAction[] {
  const current = Array.isArray(incoming) ? incoming : base;
  return current.filter((item) => item && !isDisabledSalesAction(item)).map((item) => ({ ...item })) as MarketSalesAction[];
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
    layout: { ...defaultMarketExperience.layout, ...(incoming.layout || {}) },
    home: {
      ...defaultMarketExperience.home,
      ...homeIncoming,
      sections: { ...defaultMarketExperience.home.sections, ...(homeIncoming.sections || {}) },
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
