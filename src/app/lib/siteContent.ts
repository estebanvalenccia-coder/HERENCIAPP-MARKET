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
  contactPage: {
    title: string;
    subtitle: string;
    whatsappTitle: string;
    whatsappSubtitle: string;
    callTitle: string;
    callSubtitle: string;
    locationTitle: string;
    locationSubtitle: string;
    hoursTitle: string;
    hours: Array<{ label: string; value: string }>;
    addressTitle: string;
    addressText: string;
    mapButtonLabel: string;
    mapEmbedUrl: string;
    helpTitle: string;
    helpIntro: string;
    helpItems: string[];
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
  contactPage: {
    title: "Contacto",
    subtitle: "Estamos aquí para ayudarte. Visítanos, llámanos o escríbenos.",
    whatsappTitle: "WhatsApp",
    whatsappSubtitle: "Haz clic para abrir chat",
    callTitle: "Teléfono",
    callSubtitle: "Haz clic para llamar",
    locationTitle: "Ubicación",
    locationSubtitle: "Ver en Google Maps",
    hoursTitle: "Horario",
    hours: [
      { label: "Lunes - Viernes", value: "9:00 - 20:00" },
      { label: "Sábado", value: "9:00 - 14:00" },
      { label: "Domingo", value: "Cerrado" },
    ],
    addressTitle: "Dirección",
    addressText: "Herencia Floristería",
    mapButtonLabel: "Ver en Google Maps",
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3037.5!2d-3.7!3d40.4!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDDCsDI0JzAwLjAiTiAzwrA0MicwMC4wIlc!5e0!3m2!1sen!2ses!4v1234567890",
    helpTitle: "¿Necesitas ayuda?",
    helpIntro: "Nuestro equipo está disponible para ayudarte con:",
    helpItems: [
      "Asesoramiento sobre plantas",
      "Pedidos especiales",
      "Servicios de jardinería",
      "Entregas a domicilio",
    ],
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
      contactPage: {
        ...defaultSiteContent.contactPage,
        ...(parsed.contactPage || {}),
        hours: defaultSiteContent.contactPage.hours.map((item, index) => ({
          ...item,
          ...(Array.isArray(parsed.contactPage?.hours) && parsed.contactPage.hours[index]
            ? parsed.contactPage.hours[index]
            : {}),
        })),
        helpItems: defaultSiteContent.contactPage.helpItems.map((item, index) =>
          Array.isArray(parsed.contactPage?.helpItems) && parsed.contactPage.helpItems[index]
            ? String(parsed.contactPage.helpItems[index])
            : item
        ),
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
