export type SiteLink = {
  label: string;
  href: string;
  showIcon?: boolean;
};

export type BuilderBlockType =
  | "hero"
  | "features"
  | "categories"
  | "cta"
  | "textImage"
  | "gallery"
  | "testimonials"
  | "services"
  | "products"
  | "buttons"
  | "elements";

export type BuilderAlignment = "left" | "center" | "right";

export type BuilderBlockDesign = {
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  paddingY: number;
  maxWidth: number;
  columns: number;
  columnsTablet?: number;
  columnsMobile?: number;
  gap: number;
  radius: number;
  overlay: number;
  alignment: BuilderAlignment;
  imagePosition: string;
  imageZoom: number;
  minHeight: number;
  headingScale: number;
  fontFamily: string;
  hiddenMobile: boolean;
};

export type BuilderBlock = {
  id: string;
  type: BuilderBlockType;
  name: string;
  visible: boolean;
  data: any;
  design: BuilderBlockDesign;
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
  productsPage: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    filtersLabel: string;
    emptyText: string;
    featuredLabel: string;
    addButtonLabel: string;
    outOfStockText: string;
  };
  servicesPage: {
    title: string;
    subtitle: string;
    gardeningHeading: string;
    gardeningDescription: string;
    coursesHeading: string;
    coursesDescription: string;
    deliveryHeading: string;
    deliveryDescription: string;
    advisoryHeading: string;
    advisoryDescription: string;
    ctaTitle: string;
    ctaDescription: string;
    whatsappButtonLabel: string;
    callButtonLabel: string;
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
  builder: {
    blocks: BuilderBlock[];
    headerStyle: {
      backgroundColor: string;
      textColor: string;
      activeColor: string;
      activeBackground: string;
      borderColor: string;
      logoHeight: number;
      sticky: boolean;
    };
    footerStyle: {
      backgroundColor: string;
      textColor: string;
      headingColor: string;
      borderColor: string;
      paddingY: number;
    };
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
  productsPage: {
    title: "Nuestros Productos",
    subtitle: "Explora nuestra selección de flores, plantas y accesorios de jardinería",
    searchPlaceholder: "Buscar productos...",
    filtersLabel: "Filtros",
    emptyText: "No se encontraron productos",
    featuredLabel: "Destacado",
    addButtonLabel: "Añadir",
    outOfStockText: "Agotado",
  },
  servicesPage: {
    title: "Nuestros Servicios",
    subtitle: "Soluciones personalizadas para cuidar, decorar y transformar tus espacios",
    gardeningHeading: "Servicios de Jardinería",
    gardeningDescription: "Profesionales especializados para el cuidado de tus plantas",
    coursesHeading: "Cursos Disponibles",
    coursesDescription: "Aprende con nuestros expertos y desarrolla tus habilidades",
    deliveryHeading: "Servicio de Entrega",
    deliveryDescription: "Llevamos tus plantas y flores directamente a tu puerta",
    advisoryHeading: "Asesoría Personalizada",
    advisoryDescription: "Consultoría experta para el cuidado y diseño de tus espacios",
    ctaTitle: "¿Necesitas un servicio personalizado?",
    ctaDescription: "Cuéntanos qué necesitas y prepararemos una propuesta a medida.",
    whatsappButtonLabel: "Contactar por WhatsApp",
    callButtonLabel: "Llamar ahora",
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
  builder: {
    blocks: [],
    headerStyle: {
      backgroundColor: "#ffffff",
      textColor: "#475569",
      activeColor: "#1f5137",
      activeBackground: "#e8f3eb",
      borderColor: "#e2e8f0",
      logoHeight: 56,
      sticky: true,
    },
    footerStyle: {
      backgroundColor: "#edf4ef",
      textColor: "#52645a",
      headingColor: "#17251d",
      borderColor: "#dce8df",
      paddingY: 48,
    },
  },
};

function mergeLinks(defaults: SiteLink[], incoming: unknown): SiteLink[] {
  if (!Array.isArray(incoming)) return defaults;
  return defaults.map((item, index) => ({
    ...item,
    ...(incoming[index] && typeof incoming[index] === "object" ? incoming[index] : {}),
  }));
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function makeBuilderId(prefix = "section") {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

export function defaultBlockDesign(type: BuilderBlockType): BuilderBlockDesign {
  const base: BuilderBlockDesign = {
    backgroundColor: "#ffffff",
    textColor: "#1f2937",
    accentColor: "#2f6848",
    paddingY: 64,
    maxWidth: 1280,
    columns: 4,
    columnsTablet: 2,
    columnsMobile: 1,
    gap: 24,
    radius: 16,
    overlay: 42,
    alignment: "left",
    imagePosition: "center",
    imageZoom: 100,
    minHeight: 0,
    headingScale: 100,
    fontFamily: "inherit",
    hiddenMobile: false,
  };

  if (type === "hero") {
    return {
      ...base,
      backgroundColor: "#294c35",
      textColor: "#ffffff",
      paddingY: 96,
      overlay: 52,
      radius: 0,
      imageZoom: 100,
      minHeight: 650,
      headingScale: 125,
    };
  }

  if (type === "features") {
    return { ...base, backgroundColor: "#f7f8f5", paddingY: 48, columns: 4 };
  }

  if (type === "categories") {
    return { ...base, paddingY: 72, columns: 4 };
  }

  if (type === "cta") {
    return {
      ...base,
      backgroundColor: "#315a3f",
      textColor: "#ffffff",
      paddingY: 80,
      overlay: 45,
      alignment: "center",
      radius: 0,
      headingScale: 115,
    };
  }

  if (type === "gallery") {
    return { ...base, columns: 3, paddingY: 72 };
  }

  if (type === "testimonials") {
    return { ...base, backgroundColor: "#f6f4ee", columns: 3, paddingY: 72 };
  }

  if (type === "products" || type === "services") {
    return { ...base, columns: 4, paddingY: 72 };
  }

  return base;
}

export function createBuilderBlock(
  type: BuilderBlockType,
  site: SiteContent = defaultSiteContent,
  id = makeBuilderId(type)
): BuilderBlock {
  if (type === "hero") {
    return {
      id,
      type,
      name: "Portada",
      visible: true,
      data: {
        eyebrow: site.hero.eyebrow,
        description: site.hero.description,
        primaryButton: copy(site.hero.primaryButton),
        secondaryButton: copy(site.hero.secondaryButton),
        imageUrl: site.hero.imageUrl,
        showLogo: true,
        heading: "",
      },
      design: defaultBlockDesign(type),
    };
  }

  if (type === "features") {
    return {
      id,
      type,
      name: "Ventajas",
      visible: true,
      data: { items: copy(site.features) },
      design: defaultBlockDesign(type),
    };
  }

  if (type === "categories") {
    return {
      id,
      type,
      name: "Categorías",
      visible: true,
      data: {
        heading: site.categoriesHeading,
        description: site.categoriesDescription,
        items: copy(site.categories),
      },
      design: defaultBlockDesign(type),
    };
  }

  if (type === "cta") {
    return {
      id,
      type,
      name: "Banner promocional",
      visible: true,
      data: {
        title: site.cta.title,
        subtitle: site.cta.subtitle,
        button: copy(site.cta.button),
        imageUrl: site.cta.imageUrl,
      },
      design: defaultBlockDesign(type),
    };
  }

  if (type === "gallery") {
    return {
      id,
      type,
      name: "Galería",
      visible: true,
      data: {
        heading: "Galería",
        description: "Una selección visual de nuestros trabajos y productos.",
        images: site.categories.slice(0, 4).map((item) => ({
          url: item.imageUrl,
          alt: item.name,
        })),
      },
      design: defaultBlockDesign(type),
    };
  }

  if (type === "testimonials") {
    return {
      id,
      type,
      name: "Testimonios",
      visible: true,
      data: {
        heading: "Lo que dicen nuestros clientes",
        description: "Experiencias reales de quienes confían en Herencia.",
        items: [
          { name: "Cliente 1", text: "Una experiencia excelente.", rating: 5 },
          { name: "Cliente 2", text: "Todo llegó precioso y a tiempo.", rating: 5 },
          { name: "Cliente 3", text: "Atención cercana y muy profesional.", rating: 5 },
        ],
      },
      design: defaultBlockDesign(type),
    };
  }

  if (type === "services") {
    return { id, type, name: "Servicios", visible: true, data: { heading: "Servicios para tu espacio", description: site.servicesPage.subtitle, button: { label: "Ver todos los servicios", href: "/servicios" } }, design: defaultBlockDesign(type) };
  }

  if (type === "products") {
    return { id, type, name: "Productos destacados", visible: true, data: { heading: "Productos destacados", description: "Selección de nuestra tienda", button: { label: "Ver todos los productos", href: "/productos" } }, design: defaultBlockDesign(type) };
  }

  if (type === "buttons") {
    return { id, type, name: "Botones", visible: true, data: { heading: "", buttons: [] }, design: { ...defaultBlockDesign(type), paddingY: 32 } };
  }

  if (type === "elements") {
    return { id, type, name: "Contenido personalizado", visible: true, data: { elements: [] }, design: { ...defaultBlockDesign(type), paddingY: 48 } };
  }

  return {
    id,
    type: "textImage",
    name: "Texto + imagen",
    visible: true,
    data: {
      eyebrow: "HERENCIA",
      heading: "Una historia que merece ser contada",
      text: "Añade aquí el contenido que quieras destacar.",
      button: { label: "Saber más", href: "/servicios" },
      imageUrl: site.categories[0]?.imageUrl || "",
      imageSide: "right",
    },
    design: defaultBlockDesign("textImage"),
  };
}

export function ensureBuilderBlocks(site: SiteContent): BuilderBlock[] {
  const incoming = site.builder?.blocks;
  if (Array.isArray(incoming) && incoming.length > 0) {
    return incoming.map((block: any) => ({
      ...block,
      id: String(block.id || makeBuilderId(block.type || "section")),
      name: String(block.name || block.type || "Sección"),
      visible: block.visible !== false,
      design: {
        ...defaultBlockDesign(block.type || "textImage"),
        ...(block.design || {}),
      },
      data: block.data || {},
    }));
  }

  return [
    createBuilderBlock("hero", site, "hero-main"),
    createBuilderBlock("features", site, "features-main"),
    createBuilderBlock("categories", site, "categories-main"),
    createBuilderBlock("cta", site, "cta-main"),
  ];
}

export function syncBuilderToLegacy(site: SiteContent, blocks: BuilderBlock[]): SiteContent {
  const next = copy(site);
  const hero = blocks.find((block) => block.type === "hero");
  const features = blocks.find((block) => block.type === "features");
  const categories = blocks.find((block) => block.type === "categories");
  const cta = blocks.find((block) => block.type === "cta");

  if (hero) {
    next.hero = {
      eyebrow: String(hero.data?.eyebrow || ""),
      description: String(hero.data?.description || ""),
      primaryButton: {
        ...next.hero.primaryButton,
        ...(hero.data?.primaryButton || {}),
      },
      secondaryButton: {
        ...next.hero.secondaryButton,
        ...(hero.data?.secondaryButton || {}),
      },
      imageUrl: String(hero.data?.imageUrl || ""),
    };
  }

  if (features && Array.isArray(features.data?.items)) {
    next.features = features.data.items.map((item: any) => ({
      title: String(item?.title || ""),
      description: String(item?.description || ""),
    }));
  }

  if (categories) {
    next.categoriesHeading = String(categories.data?.heading || "");
    next.categoriesDescription = String(categories.data?.description || "");
    if (Array.isArray(categories.data?.items)) {
      next.categories = categories.data.items.map((item: any) => ({
        name: String(item?.name || ""),
        imageUrl: String(item?.imageUrl || ""),
        href: String(item?.href || "/"),
      }));
    }
  }

  if (cta) {
    next.cta = {
      title: String(cta.data?.title || ""),
      subtitle: String(cta.data?.subtitle || ""),
      button: {
        ...next.cta.button,
        ...(cta.data?.button || {}),
      },
      imageUrl: String(cta.data?.imageUrl || ""),
    };
  }

  next.builder = { ...next.builder, blocks: copy(blocks) };
  return next;
}

export function syncLegacyToBuilder(site: SiteContent): SiteContent {
  const seen = new Set<BuilderBlockType>();
  const blocks = ensureBuilderBlocks(site).map((block) => {
    if (seen.has(block.type)) return block;

    if (block.type === "hero") {
      seen.add(block.type);
      return {
        ...block,
        data: {
          ...block.data,
          eyebrow: site.hero.eyebrow,
          description: site.hero.description,
          primaryButton: copy(site.hero.primaryButton),
          secondaryButton: copy(site.hero.secondaryButton),
          imageUrl: site.hero.imageUrl,
        },
      };
    }
    if (block.type === "features") {
      seen.add(block.type);
      return { ...block, data: { ...block.data, items: copy(site.features) } };
    }
    if (block.type === "categories") {
      seen.add(block.type);
      return {
        ...block,
        data: {
          ...block.data,
          heading: site.categoriesHeading,
          description: site.categoriesDescription,
          items: copy(site.categories),
        },
      };
    }
    if (block.type === "cta") {
      seen.add(block.type);
      return {
        ...block,
        data: {
          ...block.data,
          title: site.cta.title,
          subtitle: site.cta.subtitle,
          button: copy(site.cta.button),
          imageUrl: site.cta.imageUrl,
        },
      };
    }
    return block;
  });

  return { ...site, builder: { ...site.builder, blocks } };
}

export function parseSiteContent(raw: string | null): SiteContent {
  if (!raw) return copy(defaultSiteContent);

  try {
    const parsed = JSON.parse(raw) || {};
    const result: SiteContent = {
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
      productsPage: {
        ...defaultSiteContent.productsPage,
        ...(parsed.productsPage || {}),
      },
      servicesPage: {
        ...defaultSiteContent.servicesPage,
        ...(parsed.servicesPage || {}),
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
      builder: {
        blocks: Array.isArray(parsed.builder?.blocks) ? parsed.builder.blocks : [],
        headerStyle: {
          ...defaultSiteContent.builder.headerStyle,
          ...(parsed.builder?.headerStyle || {}),
        },
        footerStyle: {
          ...defaultSiteContent.builder.footerStyle,
          ...(parsed.builder?.footerStyle || {}),
        },
      },
    };

    result.builder.blocks = ensureBuilderBlocks(result);
    return result;
  } catch {
    const fallback = copy(defaultSiteContent);
    fallback.builder.blocks = ensureBuilderBlocks(fallback);
    return fallback;
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

/** The draft preview is private to the browser tab opened by the administrator. */
export function readPreviewSiteContent(published: string | null): SiteContent {
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("preview") === "builder") {
    try {
      const draft = window.sessionStorage.getItem("herenciaBuilderPreview");
      if (draft) return parseSiteContent(draft);
    } catch { /* Private browsing may block session storage. */ }
  }
  return parseSiteContent(published);
}
