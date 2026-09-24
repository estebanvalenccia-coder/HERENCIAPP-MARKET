export type SiteLink = {
  label: string;
  href: string;
};

export type SiteContent = {
  brand: {
    name: string;
    logoUrl: string;
    logoAlt: string;
  };
  navigation: {
    home: SiteLink;
    products: SiteLink;
    services: SiteLink;
    herencia: SiteLink;
  };
  headerActions: {
    cartHref: string;
    profileHref: string;
  };
  hero: {
    eyebrow: string;
    description: string;
    primaryButton: SiteLink;
    secondaryButton: SiteLink;
    imageUrl: string;
  };
  features: Array<{
    title: string;
    description: string;
  }>;
  categories: Array<{
    name: string;
    imageUrl: string;
    href: string;
  }>;
  categoriesHeading: string;
  categoriesDescription: string;
  cta: {
    title: string;
    subtitle: string;
    button: SiteLink;
    imageUrl: string;
  };
  footer: {
    description: string;
    productsTitle: string;
    productLinks: SiteLink[];
    servicesTitle: string;
    serviceLinks: SiteLink[];
    contactTitle: string;
    whatsappLabel: string;
    whatsappPhone: string;
    callLabel: string;
    callPhone: string;
    instagramLabel: string;
    instagramUrl: string;
    mapsLabel: string;
    mapsUrl: string;
    copyright: string;
    developerLabel: string;
    privacyLabel: string;
    cookiesLabel: string;
    termsLabel: string;
    privacyHref: string;
    cookiesHref: string;
    termsHref: string;
  };
  floatingWhatsapp: {
    enabled: boolean;
    phone: string;
    ariaLabel: string;
  };
};

export const defaultSiteContent: SiteContent = {
  brand: {
    name: "Herencia Floristería",
    logoUrl: "",
    logoAlt: "Herencia Floristería",
  },
  navigation: {
    home: { label: "Inicio", href: "/" },
    products: { label: "Productos", href: "/productos" },
    services: { label: "Servicios", href: "/servicios" },
    herencia: { label: "Herenc(IA)", href: "/herencia" },
  },
  headerActions: {
    cartHref: "/carrito",
    profileHref: "/perfil",
  },
  hero: {
    eyebrow: "Bienvenido a",
    description:
      "Descubre la belleza natural. Flores, plantas y servicios de jardinería con elegancia y dedicación.",
    primaryButton: { label: "Ver catálogo", href: "/productos" },
    secondaryButton: { label: "Nuestros servicios", href: "/servicios" },
    imageUrl: "",
  },
  features: [
    { title: "Productos naturales", description: "Flores y plantas frescas" },
    { title: "Entrega a domicilio", description: "Envío rápido y seguro" },
    { title: "Cursos disponibles", description: "Aprende jardinería" },
    { title: "Asesoría personalizada", description: "Te ayudamos a elegir" },
  ],
  categoriesHeading: "Explora nuestras categorías",
  categoriesDescription: "Encuentra todo lo que necesitas para crear espacios llenos de vida",
  categories: [
    {
      name: "Flores",
      imageUrl:
        "https://images.unsplash.com/photo-1637426456082-e0b7c02daec5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
      href: "/productos?categoria=flores",
    },
    {
      name: "Plantas de Interior",
      imageUrl:
        "https://images.unsplash.com/photo-1612366211377-357e2bc523cb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
      href: "/productos?categoria=plantas-interior",
    },
    {
      name: "Orquídeas",
      imageUrl:
        "https://images.unsplash.com/photo-1768368052646-a6185df478c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
      href: "/productos?categoria=orquideas",
    },
    {
      name: "Jardín Exterior",
      imageUrl:
        "https://images.unsplash.com/photo-1703113690930-fc391676e0de?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
      href: "/productos?categoria=plantas-exterior",
    },
  ],
  cta: {
    title: "¿Listo para transformar tu espacio?",
    subtitle: "Descubre nuestra colección completa de flores, plantas y accesorios para el jardín",
    button: { label: "Explorar productos", href: "/productos" },
    imageUrl: "",
  },
  footer: {
    description: "Flores, plantas y servicios de jardinería con elegancia natural.",
    productsTitle: "Productos",
    productLinks: [
      { label: "Flores", href: "/productos?categoria=flores" },
      { label: "Plantas de interior", href: "/productos?categoria=plantas-interior" },
      { label: "Plantas de exterior", href: "/productos?categoria=plantas-exterior" },
      { label: "Orquídeas", href: "/productos?categoria=orquideas" },
    ],
    servicesTitle: "Servicios",
    serviceLinks: [
      { label: "Jardinería", href: "/servicios?tipo=jardineria" },
      { label: "Cursos", href: "/servicios?tipo=cursos" },
      { label: "Entrega a domicilio", href: "/servicios?tipo=entrega" },
      { label: "Asesoría", href: "/servicios?tipo=asesoria" },
    ],
    contactTitle: "Contacto",
    whatsappLabel: "WhatsApp: +34 624 23 95 98",
    whatsappPhone: "34624239598",
    callLabel: "Llamar",
    callPhone: "+34624239598",
    instagramLabel: "@floristeriaherencia",
    instagramUrl: "https://instagram.com/floristeriaherencia",
    mapsLabel: "Cómo llegar",
    mapsUrl: "https://maps.app.goo.gl/WLihx3aD1Xhqc9WT8",
    copyright: "© 2026 Herencia Floristería. Todos los derechos reservados.",
    developerLabel: "Desarrollado por DEVB",
    privacyLabel: "Política de Privacidad",
    cookiesLabel: "Política de Cookies",
    termsLabel: "Términos y Condiciones",
    privacyHref: "/privacidad",
    cookiesHref: "/cookies",
    termsHref: "/terminos",
  },
  floatingWhatsapp: {
    enabled: true,
    phone: "34624239598",
    ariaLabel: "Contactar por WhatsApp",
  },
};

function mergeLinks(defaults: SiteLink[], incoming: unknown): SiteLink[] {
  if (!Array.isArray(incoming)) return defaults;
  return defaults.map((item, index) => ({
    ...item,
    ...(incoming[index] && typeof incoming[index] === "object" ? incoming[index] : {}),
  }));
}

export function parseSiteContent(raw: string | null): SiteContent {
  if (!raw) return defaultSiteContent;

  try {
    const parsed = JSON.parse(raw) || {};
    return {
      ...defaultSiteContent,
      ...parsed,
      brand: { ...defaultSiteContent.brand, ...(parsed.brand || {}) },
      navigation: {
        home: { ...defaultSiteContent.navigation.home, ...(parsed.navigation?.home || {}) },
        products: { ...defaultSiteContent.navigation.products, ...(parsed.navigation?.products || {}) },
        services: { ...defaultSiteContent.navigation.services, ...(parsed.navigation?.services || {}) },
        herencia: { ...defaultSiteContent.navigation.herencia, ...(parsed.navigation?.herencia || {}) },
      },
      headerActions: {
        ...defaultSiteContent.headerActions,
        ...(parsed.headerActions || {}),
      },
      hero: {
        ...defaultSiteContent.hero,
        ...(parsed.hero || {}),
        primaryButton: {
          ...defaultSiteContent.hero.primaryButton,
          ...(parsed.hero?.primaryButton || {}),
        },
        secondaryButton: {
          ...defaultSiteContent.hero.secondaryButton,
          ...(parsed.hero?.secondaryButton || {}),
        },
      },
      features: defaultSiteContent.features.map((item, index) => ({
        ...item,
        ...(Array.isArray(parsed.features) && parsed.features[index] ? parsed.features[index] : {}),
      })),
      categoriesHeading: String(parsed.categoriesHeading || defaultSiteContent.categoriesHeading),
      categoriesDescription: String(
        parsed.categoriesDescription || defaultSiteContent.categoriesDescription
      ),
      categories: defaultSiteContent.categories.map((item, index) => ({
        ...item,
        ...(Array.isArray(parsed.categories) && parsed.categories[index]
          ? parsed.categories[index]
          : {}),
      })),
      cta: {
        ...defaultSiteContent.cta,
        ...(parsed.cta || {}),
        button: {
          ...defaultSiteContent.cta.button,
          ...(parsed.cta?.button || {}),
        },
      },
      footer: {
        ...defaultSiteContent.footer,
        ...(parsed.footer || {}),
        productLinks: mergeLinks(defaultSiteContent.footer.productLinks, parsed.footer?.productLinks),
        serviceLinks: mergeLinks(defaultSiteContent.footer.serviceLinks, parsed.footer?.serviceLinks),
      },
      floatingWhatsapp: {
        ...defaultSiteContent.floatingWhatsapp,
        ...(parsed.floatingWhatsapp || {}),
      },
    };
  } catch {
    return defaultSiteContent;
  }
}

export function normalizePhoneForHref(value: string) {
  return String(value || "").replace(/[^+\d]/g, "");
}

export function normalizeWhatsAppPhone(value: string) {
  return String(value || "").replace(/\D/g, "");
}

export function isExternalHref(href: string) {
  return /^(https?:|mailto:|tel:|sms:|whatsapp:)/i.test(String(href || "").trim());
}
