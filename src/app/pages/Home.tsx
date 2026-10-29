import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowRight,
  Bot,
  Heart,
  HeartHandshake,
  Leaf,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  Globe2,
} from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../lib/backendStorage";
import { needsExplicitVariantSelection } from "../lib/printfulVariantSelection.js";
import { primaryCollectionOf, productBelongsToCollection } from "../lib/commerceCatalog";
import { defaultSiteContent, ensureBuilderBlocks, parseSiteContent, type SiteContent } from "../lib/siteContent";
import { getMarketExperience, type MarketHomeSectionId } from "../lib/marketExperience";
import { isMarketDestinationEnabled } from "../lib/marketCollectionVisibility.mjs";
import { isWithinPublicationWindow } from "../lib/publicationSchedule.mjs";
import { isEmbeddedAdminPreview, useAdminPreviewSite } from "../lib/useAdminPreviewSite";
import { parseColombiaDeliverySettings, defaultColombiaDeliverySettings, type ColombiaDeliverySettings } from "../lib/internationalDelivery";
import { StorefrontFeed } from "../components/site/StorefrontFeed";
import { StorefrontComponentBoundary } from "../components/StorefrontComponentBoundary";

// El archivo AVIF antiguo quedó truncado en el repositorio; usar una fotografía válida mientras se reemplaza el recurso local.
const DEFAULT_HERO = "https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=2000&q=86";
const DEFAULT_3D_SHOWCASE = "https://cdn.shopify.com/s/files/1/1105/9209/8695/files/herencia-market-creaciones-3d-escaparate.webp?v=1793281597";

function safeHeroImage(value: unknown): string {
  const image = String(value || "").trim();
  // The old bundled cover is truncated: its AVIF declares more bytes than exist on disk.
  if (!image || image.split("?")[0].endsWith("/herencia-portada.avif")) return "";
  return image;
}

function hexToRgb(hex: string, fallback = { r: 16, g: 43, b: 32 }) {
  const normalized = String(hex || "").trim().replace("#", "");
  const full = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return fallback;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

const IMAGE_FALLBACKS = {
  hero: DEFAULT_HERO,
  dulce: "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=1600&q=86",
  moda: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1600&q=86",
  category: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=900&q=82",
};

function imageFallback(event: any, fallback: string) {
  const img = event.currentTarget as HTMLImageElement;
  if (img.dataset.fallbackApplied === "1") return;
  img.dataset.fallbackApplied = "1";
  img.src = fallback;
}

function money(value: unknown) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

export function Home() {
  const navigate=useNavigate();
  const [site, setSite] = useState<SiteContent>(defaultSiteContent);
  useAdminPreviewSite(setSite);
  const [scheduleNow, setScheduleNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setScheduleNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [activeProductFilter, setActiveProductFilter] = useState("Todas");
  const [assistantEnabled, setAssistantEnabled] = useState(false);
  const [collectionStatus, setCollectionStatus] = useState<Record<string, string>>({});
  const [colombiaDelivery, setColombiaDelivery] = useState<ColombiaDeliverySettings>(defaultColombiaDeliverySettings);

  useEffect(() => {
    const load = () => {
      if (!isEmbeddedAdminPreview()) setSite(parseSiteContent(backendStorage.getItem("siteContent")));
      setColombiaDelivery(parseColombiaDeliverySettings(backendStorage.getItem("internationalDeliverySettings")));
      try {
        setAssistantEnabled(Boolean(JSON.parse(backendStorage.getItem("herenciaSettings") || "{}").enabled));
      } catch {
        setAssistantEnabled(false);
      }
      try {
        const wishlist = JSON.parse(backendStorage.getItem("wishlist") || "[]");
        setFavorites(Array.isArray(wishlist) ? wishlist.map(String) : []);
      } catch {
        setFavorites([]);
      }
      try {
        const saved = JSON.parse(backendStorage.getItem("adminProducts") || "[]");
        setCatalog(
          Array.isArray(saved)
            ? saved.filter((item: any) => item.active !== false && !item.deletedAt && String(item.status || "active") !== "archived")
            : []
        );
      } catch {
        setCatalog([]);
      }
    };

    load();
    window.addEventListener("storage", load);
    window.addEventListener("backend-storage", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("backend-storage", load);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadCollections = async () => {
      try {
        const result = await backendApi.listCommerceCollections({ includeArchived: true });
        if (cancelled) return;
        const next: Record<string, string> = {};
        for (const row of Array.isArray(result.collections) ? result.collections : []) {
          next[String(row.id)] = String(row.status || "active");
        }
        setCollectionStatus(next);
      } catch {
        // Si la API no responde, conservamos la portada actual en vez de ocultarla entera.
      }
    };
    void loadCollections();
    const refresh = () => void loadCollections();
    window.addEventListener("backend-storage", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("backend-storage", refresh);
    };
  }, []);

  // Use the same published commerce API as the /productos page. Cached admin
  // products remain the offline fallback, and the embedded editor keeps its draft.
  useEffect(() => {
    if (isEmbeddedAdminPreview()) return;
    let cancelled = false;
    const fetchPublishedProducts = async () => {
      try {
        const result = await backendApi.listCommerceProducts();
        if (cancelled || !Array.isArray(result.products)) return;
        const rows = result.products.filter((p: any) =>
          (p.status === "active" || p.active === true) && p.active !== false && !p.deletedAt
        );
        setCatalog(rows);
      } catch {
        // Do not clear the previously cached product grid on transient API errors.
      }
    };
    void fetchPublishedProducts();
    return () => { cancelled = true; };
  }, []);

  const market = getMarketExperience(site);

  const collectionIdForCard = (item: any) => {
    const href = String(item?.href || "").toLowerCase();
    const title = String(item?.title || "").toLowerCase();
    if (href.includes("semillas") || title.includes("semilla")) return "semillas";
    if (href.includes("accesorios") || href.includes("jardiner") || title.includes("jardiner")) return "jardineria";
    if (href.includes("sustratos") || title.includes("sustrato") || title.includes("tierra")) return "sustratos";
    if (href.includes("decoracion") || href.includes("decoración") || title.includes("decor")) return "decoracion";
    if (href.includes("/servicios") || title.includes("servicio")) return "servicios";
    if (href.includes("/dulce") || title.includes("dulce")) return "dulce";
    if (href.includes("/moda") || title.includes("moda")) return "moda";
    return "plantas";
  };

  const visibleHomeCategories = market.home.categories.filter(
    (item) => item.visible !== false && isWithinPublicationWindow(item.schedule, scheduleNow) && isMarketDestinationEnabled(market, item.href) && !["draft", "archived", "inactive", "disabled", "hidden"].includes(collectionStatus[collectionIdForCard(item)])
  );
  const shopFirst = market.home.shopFirst === true;
  const heroBlock = useMemo(
    () => ensureBuilderBlocks(site).find((block) => block.type === "hero"),
    [site]
  );
  const heroDesign = heroBlock?.design;
  // The legacy builder shipped with a 650px hero. Match the reference's
  // shorter editorial banner, but continue to honor other admin-set sizes.
  const heroConfiguredHeight = Number(heroDesign?.minHeight || 420);
  const heroMinHeight = Math.max(340, Math.min(760, heroConfiguredHeight === 650 ? 420 : heroConfiguredHeight));
  const originalHeroImage =
    safeHeroImage(heroBlock?.data?.imageUrl) ||
    safeHeroImage(market.home.heroImageUrl) ||
    safeHeroImage(site.hero.imageUrl) ||
    DEFAULT_HERO;
  const referenceMode = market.home.referenceHero !== false;
  // A new sales layout must NEVER swap the administrator's saved hero photo.
  // When the reference banner is ON, its editor fields take precedence.
  // When OFF, the original hero remains exactly as configured in Administration.
  const heroImage = referenceMode
    ? safeHeroImage(market.home.referenceHeroImageUrl) || originalHeroImage
    : originalHeroImage;
  const displayHeroTitle = referenceMode
    ? market.home.referenceHeroTitle || market.home.title
    : market.home.title;
  const displayHeroDescription = referenceMode
    ? market.home.referenceHeroDescription || market.home.description
    : market.home.description;

  const featured = useMemo(() => {
    const rows = [...catalog].sort(
      (a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured))
    );
    return rows.filter((item) => {
      if (!item?.image || Number(item?.onSale && item?.salePrice ? item.salePrice : item?.price || 0) <= 0) return false;
      if (!isMarketDestinationEnabled(market, `/productos?coleccion=${primaryCollectionOf(item)}`)) return false;
      if (item?.trackInventory === false) return true;
      if (Number(item?.stock || 0) > 0) return true;
      return Array.isArray(item?.variants) && item.variants.some((variant: any) => Number(variant?.stock || 0) > 0);
    }).slice(0, Math.max(1, Math.min(48, Number(market.home.featuredLimit ?? 6))));
  }, [catalog, market.home.featuredLimit, market.dulce.enabled, market.moda.enabled]);

  const productDisplay = market.home.productDisplay!;
  const selectionDisplay = market.home.selectionDisplay!;
  const productTags = (product: any) => [
    product.name, product.category, product.subcategory, product.collection,
    product.description, ...(Array.isArray(product.tags) ? product.tags : []),
  ].filter(Boolean).join(" ").toLocaleLowerCase("es");
  const productMatchesChip = (product: any, label: string) => {
    const key = String(label || "").trim().toLocaleLowerCase("es");
    if (!key || key === "todas") return true;
    const aliases: Record<string, string[]> = {
      "purificadoras": ["purific", "sansevieria", "spathiphyllum", "espatifilo"],
      "fáciles de cuidar": ["fácil", "facil", "resistente", "bajo mantenimiento", "pothos", "sansevieria", "zamioculca"],
      "con flor": ["flor", "orquídea", "orquidea", "anthurium", "espatifilo"],
      "colgantes": ["colgante", "hoya", "pothos", "tradescantia"],
      "tropicales": ["tropical", "monstera", "calathea", "philodendron", "filodendro"],
      "pequeñas": ["mini", "peque", "small"],
      "grandes": ["grande", "large", "xl"],
    };
    const text = productTags(product);
    return (aliases[key] || [key]).some(value => text.includes(value));
  };
  const shoppingProducts = useMemo(() => {
    if (!shopFirst) return featured;
    const mode = productDisplay.mode;
    const candidates = [...catalog]
      .filter((p: any) => p && p.active !== false && !p.deletedAt && !["draft", "archived", "inactive"].includes(String(p.status || "active")))
      .filter((p: any) => p.image && Number(p.onSale && p.salePrice ? p.salePrice : p.price || 0) > 0)
      .filter((p: any) => p.trackInventory === false || Number(p.stock || 0) > 0 ||
        (Array.isArray(p.variants) && p.variants.some((v: any) => Number(v.stock || 0) > 0)))
      .filter((p: any) => isMarketDestinationEnabled(market, `/productos?coleccion=${primaryCollectionOf(p)}`))
      .filter((p: any) => mode === "all" || mode === "featured" && p.featured ||
        mode === "plants" && productBelongsToCollection(p, "plantas"))
      .sort((a: any,b: any) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
    return candidates.filter((product) => productMatchesChip(product, activeProductFilter))
      .slice(0, Math.max(1, Math.min(48, productDisplay.limit)));
  }, [catalog, shopFirst, productDisplay.mode, productDisplay.limit, activeProductFilter, featured, market.home.sections, market.dulce.enabled, market.moda.enabled]);
  const availableShopFilters = shopFirst && productDisplay.filtersEnabled
    ? productDisplay.filterLabels.filter((label) =>
      label === "Todas" || catalog.some((product) => (
        (productDisplay.mode !== "plants" || productBelongsToCollection(product,"plantas"))
        && productMatchesChip(product, label)))
    ) : [];
  const selectionProducts = useMemo(() => catalog
    .filter((product: any) => product && product.active !== false && !product.deletedAt && !["draft", "archived", "inactive"].includes(String(product.status || "active")))
    .filter((product: any) => Boolean(product.image) && Number(product.onSale && product.salePrice ? product.salePrice : product.price || 0) > 0)
    .filter((product: any) => product.trackInventory === false || Number(product.stock || 0) > 0 ||
      (Array.isArray(product.variants) && product.variants.some((variant: any) => Number(variant.stock || 0) > 0)))
    .filter((product: any) => !productBelongsToCollection(product, "plantas"))
    .filter((product: any) => {
      const text = [product.name, product.category, product.subcategory, product.collection,
        ...(Array.isArray(product.tags) ? product.tags : [])].filter(Boolean).join(" ");
      return !/(?:3d|impresi[oó]n\s*3d|diseño\s*3d)/i.test(text);
    })
    .filter((product: any) => isMarketDestinationEnabled(market, `/productos?coleccion=${primaryCollectionOf(product)}`))
    .sort((a: any, b: any) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)))
    .slice(0, Math.max(1, Math.min(12, Number(selectionDisplay.limit || 6)))),
  [catalog, market.dulce.enabled, market.moda.enabled, selectionDisplay.limit]);
  const gridColumns = shopFirst ? productDisplay.columns : 6;
  const shopGridClass = gridColumns === 8
    ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8"
    : gridColumns === 6
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
      : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";

  // La colección editorial se alimenta exclusivamente de productos publicados:
  // nunca sustituir el catálogo real por artículos o precios del boceto.
  // A curated 3D shelf is purely a presentation of existing products. Removing
  // a product ID here never changes the shared catalog, stock or prices.
  const storefrontCreations3D = useMemo(() => {
    const config = market.home.creations3D;
    const eligible = catalog.filter((product) => {
      const price = Number(product?.onSale && product?.salePrice ? product.salePrice : product?.price || 0);
      const available = product?.trackInventory === false || Number(product?.stock || 0) > 0 ||
        (Array.isArray(product?.variants) && product.variants.some((variant: any) => Number(variant?.stock || 0) > 0));
      return product && product.active !== false && !product.deletedAt &&
        !["draft", "archived", "inactive"].includes(String(product.status || "active")) &&
        Boolean(product.image) && Number.isFinite(price) && price > 0 && available &&
        isMarketDestinationEnabled(market, "/productos?coleccion=" + primaryCollectionOf(product));
    });
    const selected = config.mode === "manual"
      ? config.productIds.map((id) => eligible.find((product) => String(product.id) === String(id))).filter(Boolean)
      : eligible.filter((product) => {
          const text = [product.name, product.category, product.subcategory, product.collection,
            ...(Array.isArray(product.tags) ? product.tags : [])].filter(Boolean).join(" ");
          return /(?:3d|impresi[oó]n\s*3d|maceta\s*3d|diseño\s*3d)/i.test(text);
        });
    return selected.slice(0, Math.max(1, Math.min(12, Number(config.limit || 4)))) as any[];
  }, [catalog, market.home.creations3D, market.dulce.enabled, market.moda.enabled]);

  // Curated storefront collections are derived from the real, administrator-controlled cards.
  // Editorial collection cards only appear when their corresponding
  // administrator-managed categories are active; no invented fallback banners.
  const spotlightCollections = visibleHomeCategories.filter((item) => {
    const is3D = /(?:3d|impresi[oó]n)/i.test(`${item.title} ${item.subtitle} ${item.href}`);
    const isColombia = /(?:colombia|regalos?)/i.test(`${item.title} ${item.subtitle} ${item.href}`);
    return is3D || (isColombia && colombiaDelivery.enabled);
  });

  // The reference layout must never invent categories or override Administration.
  // Styling is selected in the editor; content, destinations and visibility come
  // exclusively from the actual published market.home.categories collection.
  const availableHomeCategories = visibleHomeCategories
    .filter((item) => String(item.href || "").split("?")[0] !== "/colombia" || colombiaDelivery.enabled);
  const displayedHomeCategories = Number(market.home.categoryGridLimit) === 0
    ? availableHomeCategories
    : availableHomeCategories.slice(0, Math.max(1, Math.min(100, Number(market.home.categoryGridLimit || 5))));


  const toggleFavorite = async (productId: unknown) => {
    const id = String(productId);
    const next = favorites.includes(id) ? favorites.filter((entry) => entry !== id) : [...favorites, id];
    setFavorites(next);
    try {
      await backendStorage.setItem("wishlist", JSON.stringify(next));
      window.dispatchEvent(new Event("backend-storage"));
      void backendApi.customerSaveWishlist(next).catch(() => null);
      toast.success(next.includes(id) ? "Añadido a favoritos" : "Eliminado de favoritos");
    } catch {
      setFavorites(favorites);
      toast.error("No se pudieron guardar los favoritos");
    }
  };

  const addToCart = (product: any) => {
    if (needsExplicitVariantSelection(product)) {navigate(`/producto/${product.id}`);return;}
    try {
      const variants = Array.isArray(product?.variants) ? product.variants : [];
      const variant = variants.length
        ? variants.find((item: any) => product.trackInventory === false || Number(item?.stock || 0) > 0) || null
        : null;
      if (variants.length && !variant) return toast.error("Este producto está agotado");

      const trackInventory = product.trackInventory !== false;
      const stock = trackInventory
        ? Math.max(0, Math.floor(Number(variant?.stock ?? product.stock ?? 0)))
        : Number.POSITIVE_INFINITY;
      const selectedVariant = variant ? String(variant?.name || variant) : "";
      const price = Number(variant?.price ?? (product.onSale && product.salePrice ? product.salePrice : product.price || 0));
      if (trackInventory && stock <= 0) return toast.error("Este producto está agotado");
      if (!Number.isFinite(price) || price <= 0) return toast.error("Este producto no tiene un precio válido");

      const cart = JSON.parse(backendStorage.getItem("cart") || "[]");
      const lineKey = `${product.id}::${selectedVariant || "base"}::`;
      const existing = cart.find((item: any) => item.lineKey === lineKey);
      const nextQuantity = Number(existing?.quantity || 0) + 1;
      if (trackInventory && nextQuantity > stock) return toast.error(`Solo quedan ${stock} unidades disponibles`);

      if (existing) existing.quantity = nextQuantity;
      else cart.push({ ...product, price, quantity: 1, lineKey, selectedVariant: selectedVariant || undefined });
      void backendStorage.setItem("cart", JSON.stringify(cart));
      window.dispatchEvent(new Event("storage"));
      toast.success(`${product.name} añadido al carrito`);
    } catch {
      toast.error("No se pudo añadir el producto");
    }
  };

  const trustIcons = [ShieldCheck, Truck, HeartHandshake, Leaf];
  const sections = market.home.sections;
  const sectionOrder = (key: MarketHomeSectionId) => market.home.sectionOrder.indexOf(key) + 1;

  return (
    <div className="flex flex-col bg-[#fffdf9] text-[#173126]">
      <StorefrontComponentBoundary id="home.hero" order={sectionOrder("hero")} controls={market.componentControls} now={scheduleNow} enabled={sections.hero}>
      <section
        className="relative overflow-hidden"
        style={{
          order: sectionOrder("hero"),
          minHeight: `${heroMinHeight}px`,
          backgroundColor: heroDesign?.backgroundColor || undefined,
          // The CSS background remains visible if a saved custom image fails to load.
          backgroundImage: `url("${DEFAULT_HERO}")`,
          backgroundSize: "cover",
          backgroundPosition: heroDesign?.imagePosition || "center 15%",
          color: heroDesign?.textColor || undefined,
          borderRadius: `${Math.max(0, Number(heroDesign?.radius || 0))}px`,
          fontFamily:
            heroDesign?.fontFamily && heroDesign.fontFamily !== "inherit"
              ? heroDesign.fontFamily
              : undefined,
        }}
      >
        <img
          src={heroImage}
          alt=""
          onError={(event) => imageFallback(event, IMAGE_FALLBACKS.hero)}
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            objectPosition: heroDesign?.imagePosition || "center 15%",
            transform: `scale(${Math.max(100, Number(heroDesign?.imageZoom || 100)) / 100})`,
          }}
        />
        {(() => {
          const overlayOpacity = Math.max(
            0,
            Math.min(100, Number(heroDesign?.overlay ?? market.home.heroOverlayOpacity ?? 90))
          ) / 100;
          const overlayWidth = Math.max(
            25,
            Math.min(100, Number(heroDesign?.overlayWidth ?? market.home.heroOverlayWidth ?? 72))
          );
          const overlayMid = Math.round(overlayWidth * 0.58);
          // Default showroom uses the reference's warm light overlay. An explicitly
          // customized color in the visual builder still takes precedence.
          const chosen = heroDesign?.overlayColor && heroDesign.overlayColor !== "#102b20"
            ? heroDesign.overlayColor
            : market.home.heroOverlayColor && market.home.heroOverlayColor !== "#102b20"
              ? market.home.heroOverlayColor
              : "#102b20";
          const color = hexToRgb(chosen);
          return (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(90deg,
                  rgba(${color.r}, ${color.g}, ${color.b}, ${overlayOpacity}) 0%,
                  rgba(${color.r}, ${color.g}, ${color.b}, ${overlayOpacity * 0.69}) ${overlayMid}%,
                  rgba(${color.r}, ${color.g}, ${color.b}, 0) ${overlayWidth}%
                )`,
              }}
            />
          );
        })()}
        <div
          className="relative mx-auto flex items-center px-5 sm:px-8 lg:px-10"
          style={{
            minHeight: `${heroMinHeight}px`,
            maxWidth: `${Math.max(760, Number(heroDesign?.maxWidth || 1280))}px`,
            paddingTop: `${Math.max(16, Number(heroDesign?.paddingY || 64))}px`,
            paddingBottom: `${Math.max(16, Number(heroDesign?.paddingY || 64))}px`,
          }}
        >
          <div
            className="max-w-2xl"
            style={{
              color: heroDesign?.textColor && heroDesign.textColor !== "#ffffff" ? heroDesign.textColor : "#fffdf5",
              textAlign:
                heroDesign?.alignment === "center"
                  ? "center"
                  : heroDesign?.alignment === "right"
                    ? "right"
                    : "left",
              marginLeft: heroDesign?.alignment === "right" ? "auto" : undefined,
              marginRight: heroDesign?.alignment === "center" ? "auto" : undefined,
            }}
          >
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/45 bg-white/10 px-4 py-2 text-[10px] font-black tracking-[0.22em] text-white shadow-sm backdrop-blur">
              <Leaf className="h-3.5 w-3.5" /> HERENCIA MARKET
            </span>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-[#dfd2a9]">
              {market.home.kicker}
            </p>
            <h1 className="max-w-xl font-serif text-5xl font-normal leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              {displayHeroTitle}
            </h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-[#fffdf5]/90 sm:text-lg">
              {displayHeroDescription}
            </p>
            <div
              className="mt-8 flex flex-wrap"
              style={{
                gap: `${Math.max(0, Number(heroDesign?.gap || 12))}px`,
                justifyContent:
                  heroDesign?.alignment === "center"
                    ? "center"
                    : heroDesign?.alignment === "right"
                      ? "flex-end"
                      : "flex-start",
              }}
            >
              {site.hero.primaryButton.visible !== false && isWithinPublicationWindow(site.hero.primaryButton.schedule, scheduleNow) && <Link
                to={site.hero.primaryButton.href || "/productos"}
                className="inline-flex items-center gap-2 rounded-lg bg-[#254932] px-6 py-3.5 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#173d2a]"
              >
                {site.hero.primaryButton.label || "Explorar tienda"}
                <ArrowRight className="h-4 w-4" />
              </Link>}
              {site.hero.secondaryButton.visible !== false && isWithinPublicationWindow(site.hero.secondaryButton.schedule, scheduleNow) && <Link
                to={site.hero.secondaryButton.href || "/servicios"}
                className="inline-flex items-center gap-2 rounded-md border border-[#668772]/70 bg-white/75 px-6 py-3.5 font-semibold text-[#173d2a] backdrop-blur transition hover:bg-white"
              >
                {site.hero.secondaryButton.label || "Nuestros servicios"}
              </Link>}
            </div>
          </div>
        </div>
        <StorefrontComponentBoundary id="home.heroIA" controls={market.componentControls} now={scheduleNow}
          enabled={assistantEnabled && site.navigation.herencia.visible !== false}>
          <Link to={site.navigation.herencia.href || "/herencia"}
            className="absolute right-5 top-7 hidden w-[290px] flex-col rounded-2xl border border-white/70 bg-[#fffcf5]/95 p-5 text-[#193527] shadow-[0_15px_45px_rgba(0,0,0,.2)] backdrop-blur-lg transition hover:-translate-y-1 lg:flex xl:right-8">
            <span className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#e6ecdf] text-[#244c32]"><Bot className="h-7 w-7"/></span>
              <span><strong className="block font-serif text-2xl font-semibold">Herenc(IA)</strong>
                <span className="text-xs text-[#627468]">Tu asistente inteligente</span></span>
            </span>
            <span className="mt-4 space-y-2 text-xs leading-5 text-[#3c5544]">
              <span className="block">✓ Te ayuda a elegir tus plantas</span>
              <span className="block">✓ Responde tus dudas</span>
              <span className="block">✓ Recomendaciones personalizadas</span>
            </span>
            <span className="mt-4 flex items-center justify-center gap-2 rounded-full bg-[#173d2a] px-4 py-3 text-sm font-semibold text-white">
              Habla con Herenc(IA) <ArrowRight className="h-4 w-4"/>
            </span>
          </Link>
        </StorefrontComponentBoundary>
        <StorefrontComponentBoundary id="home.heroIA" controls={market.componentControls} now={scheduleNow}
          enabled={assistantEnabled && site.navigation.herencia.visible !== false}>
          <Link to={site.navigation.herencia.href || "/herencia"}
            className="mx-5 mb-5 flex items-center justify-between gap-4 rounded-2xl border border-white/70 bg-[#fffcf5]/95 p-4 text-[#193527] shadow-xl backdrop-blur lg:hidden">
            <span className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e6ecdf] text-[#244c32]"><Bot className="h-6 w-6"/></span>
              <span><strong className="block font-serif text-xl font-semibold">Herenc(IA)</strong><span className="text-xs text-[#627468]">Tu asistente de Herencia Market</span></span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#173d2a] px-3 py-2 text-xs font-bold text-white">Hablar <ArrowRight className="h-3.5 w-3.5"/></span>
          </Link>
        </StorefrontComponentBoundary>
      </section></StorefrontComponentBoundary>

      <StorefrontComponentBoundary id="home.delivery" order={sectionOrder("delivery")} controls={market.componentControls} now={scheduleNow} enabled={sections.delivery && colombiaDelivery.enabled}>
        <section style={{ order: sectionOrder("delivery") }} className="border-b border-[#d9e1d9] bg-[#edf4ee]">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-7 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-2xl shadow-sm">🇨🇴</div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#6d7d72]">Herencia internacional</p>
                <h2 className="mt-1 text-2xl font-semibold text-[#173126]">Ahora también entregamos en {colombiaDelivery.regionLabel}</h2>
                <p className="mt-1 text-sm leading-6 text-[#637168]">Envía plantas y regalos a tus seres queridos en Colombia con entrega local.</p>
              </div>
            </div>
            <Link to="/colombia" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#315b42] px-6 py-3 font-black text-white shadow-sm transition hover:bg-[#234832]">
              <Globe2 className="h-4 w-4" /> Enviar a Colombia <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </StorefrontComponentBoundary>

      <StorefrontComponentBoundary id="home.categoryStrip" order={sectionOrder("categoryStrip")} controls={market.componentControls} now={scheduleNow} enabled={sections.categoryStrip}>
      <section style={{ order: sectionOrder("categoryStrip") }} className="border-b border-[#eae6de] bg-[#fffdf9]">
        <div className="mx-auto max-w-7xl px-5 py-5 sm:px-8 lg:px-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#738174]">Encuentra lo que buscas</p>
              <h2 className="mt-1 font-serif text-2xl text-[#1c3c2b] sm:text-3xl">Explora Herencia Market</h2>
            </div>
            <Link to="/productos" className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-[#315b42] hover:underline">
              Ver tienda <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {market.home.referenceCategories !== false ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {displayedHomeCategories.map((item, index) => (
                <Link key={`${item.href}-${index}`} to={item.href}
                  className="group relative flex min-h-[146px] flex-col justify-between overflow-hidden border border-[#e8e1d6] bg-[#e9e4d9] p-4 text-[#172f21] shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                  style={{ borderRadius: Math.max(0, Math.min(48, Number(item.design?.radius ?? 10))), backgroundColor: item.design?.backgroundColor || undefined }}>
                  {item.imageUrl && <img src={item.imageUrl} alt="" loading="lazy"
                    onError={(event) => imageFallback(event, IMAGE_FALLBACKS.category)}
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    style={{ objectPosition: item.design?.imagePosition || "center" }} />}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#f6f0e6]/95 via-[#f6f0e6]/80 to-[#f6f0e6]/10" />
                  <div className="relative max-w-[79%]">
                    <h2 className="font-serif text-lg font-semibold leading-tight sm:text-xl">{item.title}</h2>
                    {item.subtitle && <p className="mt-1 line-clamp-2 text-xs text-[#4c554a]">{item.subtitle}</p>}
                  </div>
                  <span className="relative mt-3 grid h-8 w-8 place-items-center rounded-full bg-[#143c27] text-white transition group-hover:translate-x-1" aria-hidden="true">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-7">
              {displayedHomeCategories.map((item, index) => (
                <Link key={`${item.href}-${index}`} to={item.href} className="group text-center">
                  <div className="mx-auto h-20 w-20 max-w-full overflow-hidden rounded-full border border-[#e3ddd2] bg-[#f2e6d5] transition duration-300 group-hover:-translate-y-1 group-hover:shadow-md sm:h-24 sm:w-24">
                    {item.imageUrl && <img src={item.imageUrl} alt="" loading="lazy" onError={(event) => imageFallback(event, IMAGE_FALLBACKS.category)} className="h-full w-full object-cover" />}
                  </div>
                  <p className="mx-auto mt-2 max-w-32 font-serif text-sm font-medium leading-tight text-[#1f3b2d] sm:text-base">{item.title}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section></StorefrontComponentBoundary>

      <StorefrontComponentBoundary id="home.plantCta" order={sectionOrder("plantCta")} controls={market.componentControls} now={scheduleNow} enabled={sections.plantCta}><div style={{ order: sectionOrder("plantCta") }} className="mx-auto max-w-7xl px-5 py-4 sm:px-8 lg:px-10 text-center">
        <Link
          to="/productos?coleccion=plantas"
          className="inline-flex items-center gap-2 rounded-lg bg-[#254932] px-6 py-3.5 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#173d2a]"
        >
          Descubre nuestras plantas
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div></StorefrontComponentBoundary>

      <StorefrontComponentBoundary id="home.feed" order={sectionOrder("feed")} controls={market.componentControls} now={scheduleNow} enabled={sections.feed}><div style={{ order: sectionOrder("feed") }}><StorefrontFeed /></div></StorefrontComponentBoundary>

      <StorefrontComponentBoundary id="home.categoriesGrid" order={sectionOrder("categoriesGrid")} controls={market.componentControls} now={scheduleNow} enabled={sections.categoriesGrid}>
      <section style={{ order: sectionOrder("categoriesGrid") }} className="mx-auto w-full max-w-7xl px-5 pt-5 pb-3 sm:px-8 lg:px-10">
        {spotlightCollections.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {spotlightCollections.map((collection) => (
              <Link key={collection.href} to={collection.href} className="group relative flex min-h-[215px] items-end overflow-hidden rounded-lg border border-[#e9e5dc] bg-[#1d412e] text-white shadow-sm md:min-h-[245px] xl:min-h-[260px]">
                {collection.imageUrl
                  ? <img src={collection.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" onError={(event) => imageFallback(event, IMAGE_FALLBACKS.category)} />
                  : <div aria-hidden="true" className="absolute inset-0 flex items-center justify-end bg-[radial-gradient(circle_at_75%_50%,#718e6d,#224b32_65%,#153322)] pr-12"><Sparkles className="h-32 w-32 text-white/35" /></div>
                }
                <div className="absolute inset-0 bg-gradient-to-r from-[#102b20]/90 via-[#102b20]/50 to-transparent" />
                <div className="relative max-w-[78%] p-5 sm:p-7">
                  <h2 className="font-serif text-3xl font-normal tracking-tight sm:text-4xl">{collection.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-white/90">{collection.subtitle}</p>
                  <span className="mt-5 inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold text-[#173d2a]">Explorar colección <ArrowRight className="h-4 w-4" /></span>
                </div>
              </Link>
            ))}
          </div>
        )}
        {/* Existing category cards remain in admin; the homepage uses the reference's
            compact round categories above and two editorial banners here. */}
      </section></StorefrontComponentBoundary>

      <StorefrontComponentBoundary id="home.selection" order={sectionOrder("selection")} controls={market.componentControls} now={scheduleNow} enabled={sections.selection && selectionProducts.length > 0}>
        <section style={{ order: sectionOrder("selection") }} className="bg-[#f8f6f0]">
          <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#738174]">Más para completar tu espacio</p>
                <h2 className="mt-2 font-serif text-3xl font-normal tracking-tight text-[#1b3c2a] sm:text-4xl">{selectionDisplay.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68756a]">{selectionDisplay.subtitle}</p>
              </div>
              <Link to={selectionDisplay.href || "/productos"} className="inline-flex w-fit items-center gap-2 rounded-full border border-[#b7c7b5] px-5 py-2.5 text-sm font-bold text-[#315b42] transition hover:bg-[#e9f0e6]">
                {selectionDisplay.buttonLabel || "Ver toda la tienda"}<ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className={`mt-7 grid gap-4 ${selectionDisplay.columns === 4 ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"}`}>
              {selectionProducts.map((product: any) => {
                const price = Number(product.onSale && product.salePrice ? product.salePrice : product.price || 0);
                const productTags = [product.vendor, product.fulfillmentType, product.shippingProfile,
                  ...(Array.isArray(product.tags) ? product.tags : [])].filter(Boolean).join(" ");
                const specialShipping = /dropship|printful|env[ií]o\s*especial/i.test(productTags);
                return (
                  <article key={product.id} className="group relative overflow-hidden rounded-2xl border border-[#e8e4da] bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
                    <button type="button" onClick={() => void toggleFavorite(product.id)}
                      aria-label={favorites.includes(String(product.id)) ? `Quitar ${product.name} de favoritos` : `Guardar ${product.name} en favoritos`}
                      className="absolute right-2 top-2 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-[#294a35] shadow-sm">
                      <Heart className="h-4 w-4" fill={favorites.includes(String(product.id)) ? "currentColor" : "none"}/>
                    </button>
                    {specialShipping && <span className="absolute left-2 top-2 z-10 rounded-full bg-[#f3ead6] px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-[#705c32]">{selectionDisplay.specialShippingLabel}</span>}
                    <Link to={`/producto/${product.id}`} className="block aspect-[4/4.3] overflow-hidden bg-[#f1eee7]">
                      <img src={product.image} alt={product.name} loading="lazy" onError={(event) => imageFallback(event, IMAGE_FALLBACKS.category)}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/>
                    </Link>
                    <div className="p-3">
                      <Link to={`/producto/${product.id}`} className="line-clamp-2 min-h-10 text-sm font-black text-[#213b2a]">{product.name}</Link>
                      <p className="mt-2 text-base font-black text-[#315b42]">{money(price)}</p>
                      <button type="button" onClick={() => addToCart(product)}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#285a3d] px-3 py-2.5 text-xs font-bold text-white transition hover:bg-[#173d2a]">
                        <ShoppingCart className="h-3.5 w-3.5"/> {needsExplicitVariantSelection(product) ? "Elegir opciones" : "Añadir al carrito"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </StorefrontComponentBoundary>

      <StorefrontComponentBoundary id="home.services" order={sectionOrder("services")} controls={market.componentControls} now={scheduleNow} enabled={sections.services}>
      <section style={{ order: sectionOrder("services") }} className="bg-[#f4f1e8]">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#6d7d72]">
                Servicios
              </p>
              <h2 className="mt-2 font-serif text-3xl font-normal tracking-tight sm:text-4xl">{market.home.servicesTitle}</h2>
            </div>
            <Link to="/servicios" className="hidden items-center gap-2 text-sm font-black text-[#315b42] sm:inline-flex">
              Ver todos <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {market.home.services.filter((service) => service.visible !== false && isWithinPublicationWindow(service.schedule, scheduleNow)).map((service) => (
              <Link
                key={service.title}
                to={service.href}
                className="group overflow-hidden rounded-[1.25rem] border border-[#e6e2d7] bg-[#fffdf9] transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                style={{ backgroundColor: service.design?.backgroundColor || undefined, borderRadius: Math.max(0, Math.min(48, Number(service.design?.radius ?? 24))) }}
              >
                <div className="h-40 overflow-hidden" style={{ height: `${Math.max(100, Math.min(300, Number(service.design?.imageHeight ?? 160)))}px` }}>
                  <img
                    src={service.imageUrl}
                    alt=""
                    onError={(event) => imageFallback(event, IMAGE_FALLBACKS.category)}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    style={{ objectPosition: service.design?.imagePosition || "center" }}
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-serif text-xl font-medium leading-tight" style={{ color: service.design?.textColor || undefined }}>{service.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#6c786f]">{service.subtitle}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#315b42]">
                    {service.ctaLabel} <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section></StorefrontComponentBoundary>

      <StorefrontComponentBoundary id="home.featured" order={sectionOrder("featured")} controls={market.componentControls} now={scheduleNow} enabled={sections.featured}>
      <section style={{ order: sectionOrder("featured") }} className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="sr-only">Selección Herencia</p>
            <h2 className="mt-2 font-serif text-3xl font-normal tracking-tight sm:text-4xl">{shopFirst ? productDisplay.title : market.home.featuredTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6c786f]">
              {shopFirst ? productDisplay.subtitle : market.home.featuredSubtitle}
            </p>
          </div>
          <Link to="/productos" className="inline-flex items-center gap-2 text-sm font-black text-[#315b42]">
            Ver todos <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {availableShopFilters.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Filtros de plantas">
            {availableShopFilters.map((label) => (
              <button key={label} type="button"
                onClick={() => setActiveProductFilter(label)}
                aria-pressed={activeProductFilter === label}
                className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${activeProductFilter === label ? "bg-[#234b35] text-white" : "bg-[#f1eee8] text-[#4e6153] hover:bg-[#e1e9dd]"}`}>
                {label}
              </button>
            ))}
          </div>
        )}
        <div className={`mt-4 grid gap-3 ${shopGridClass}`}>
          {shoppingProducts.map((product) => {
            const price = Number(product.onSale && product.salePrice ? product.salePrice : product.price || 0);
            return (
              <article
                key={product.id}
                className="group relative overflow-hidden rounded-xl border border-[#ece7dc] bg-white transition duration-300 hover:-translate-y-1 hover:shadow-lg"
                style={shopFirst ? {borderRadius: `${productDisplay.cardRadius}px`} : undefined}
              >
                <button type="button" onClick={() => void toggleFavorite(product.id)}
                  aria-label={favorites.includes(String(product.id)) ? `Quitar ${product.name} de favoritos` : `Guardar ${product.name} en favoritos`}
                  className="absolute right-2 top-2 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-[#294a35] shadow-sm transition hover:bg-[#e8f2e7]">
                  <Heart className="h-4 w-4" fill={favorites.includes(String(product.id)) ? "currentColor" : "none"}/>
                </button>
                <Link to={`/producto/${product.id}`}
                  className={`block overflow-hidden bg-[#f1eee7] ${shopFirst && productDisplay.imageAspect === "square" ? "aspect-square" : "aspect-[4/4.3]"}`}>
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full object-cover transition duration-500 hover:scale-105"
                  />
                </Link>
                <div className="p-3">
                  <Link to={`/producto/${product.id}`} className="line-clamp-2 min-h-10 text-sm font-black">
                    {product.name}
                  </Link>
                  <p className="mt-2 text-base font-black text-[#315b42]">{money(price)}</p>
                  {Number(product.rating || product.averageRating || 0) > 0 && (
                    <p className="mt-1 text-xs text-[#bd871c]" aria-label={`Valoración ${Number(product.rating || product.averageRating).toFixed(1)} de 5`}>
                      {"★".repeat(Math.max(0, Math.min(5, Math.round(Number(product.rating || product.averageRating)))))}
                      {Number(product.reviewCount || product.reviewsCount || 0) > 0 &&
                        <span className="ml-1 text-[#718076]">({Number(product.reviewCount || product.reviewsCount)})</span>}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => addToCart(product)}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-[#254932] px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-[#173d2a]"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" /> {needsExplicitVariantSelection(product) ? "Elegir talla y color" : "Añadir"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {shopFirst && shoppingProducts.length === 0 && (
          <div className="mt-5 rounded-xl border border-[#e1e5db] bg-white p-6 text-sm text-[#445d4a]">
            No hay productos disponibles con estos filtros.
            <Link to="/productos?coleccion=plantas" className="ml-2 font-semibold underline">Ver el catálogo</Link>
          </div>
        )}
      </section></StorefrontComponentBoundary>

      <StorefrontComponentBoundary id="home.promotions" order={sectionOrder("promotions")} controls={market.componentControls} now={scheduleNow} enabled={sections.promotions}>
      <section style={{ order: sectionOrder("promotions") }} className="mx-auto grid w-full max-w-7xl gap-6 px-5 pb-16 sm:px-8 lg:grid-cols-2 lg:px-10">
        {[market.dulce, market.moda, ...market.home.campaigns].filter((promo) => {
          if (promo.enabled === false || !isWithinPublicationWindow(promo.schedule, scheduleNow) || !isMarketDestinationEnabled(market, promo.href)) return false;
          const dest = String(promo.href || "").split("?")[0];
          const related = dest === "/dulce" ? "dulce" : dest === "/moda" ? "moda" : "";
          return !related || !["draft", "archived", "inactive", "disabled", "hidden"].includes(collectionStatus[related]);
        }).map((promo, index) => (
          <Link
            key={("id" in promo && promo.id) || `${promo.title}-${index}`}
            to={promo.href}
            className="group relative min-h-[300px] overflow-hidden rounded-[1.25rem] border border-[#ded9cd]"
            style={{ minHeight: Math.max(240, Math.min(620, Number(promo.design?.minHeight ?? 300))), borderRadius: Math.max(0, Math.min(48, Number(promo.design?.radius ?? 32))) }}
          >
            <img
              src={promo.imageUrl}
              alt=""
              onError={(event) => imageFallback(event, promo.href === "/dulce" ? IMAGE_FALLBACKS.dulce : IMAGE_FALLBACKS.moda)}
              className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
              style={{ objectPosition: promo.design?.imagePosition || "center" }}
            />
            <div
              style={{ opacity: Math.max(0, Math.min(100, Number(promo.design?.overlayOpacity ?? 100))) / 100 }}
              className={`absolute inset-0 ${
                promo.href === "/dulce"
                  ? "bg-gradient-to-r from-[#6b3327]/80 via-[#7d4030]/52 to-transparent"
                  : "bg-gradient-to-r from-[#173d2a]/88 via-[#173d2a]/50 to-transparent"
              }`}
            />
            <div className={`relative flex min-h-[300px] max-w-md flex-col justify-center p-8 text-white ${promo.design?.textAlign === "center" ? "mx-auto items-center text-center" : promo.design?.textAlign === "right" ? "ml-auto items-end text-right" : "items-start text-left"}`}
              style={{ minHeight: Math.max(240, Math.min(620, Number(promo.design?.minHeight ?? 300))) }}>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-white/75">{"kicker" in promo ? promo.kicker : "HERENCIA"}</p>
              <h2 className="mt-3 text-4xl font-medium">{promo.title}</h2>
              <p className="mt-3 text-sm leading-6 text-white/88">{promo.subtitle}</p>
              <span className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-black text-[#193325]">
                {promo.buttonLabel} <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        ))}
      </section></StorefrontComponentBoundary>

      
      <StorefrontComponentBoundary id="home.creations3d" order={sectionOrder("creations3d")}
        controls={market.componentControls} now={scheduleNow} enabled={sections.creations3d}>
        <section aria-label="Creaciones 3D" style={{ order: sectionOrder("creations3d") }} className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-8 lg:px-10">
          <div className="group relative mb-6 overflow-hidden rounded-[1.75rem] border border-[#dbe4d8] bg-[#112f22] text-white shadow-[0_20px_55px_rgba(13,43,28,0.16)]">
            <img
              src={market.home.creations3D.imageUrl || DEFAULT_3D_SHOWCASE}
              alt="Escaparate de macetas, jarrones, figuras y accesorios creados con impresión 3D"
              loading="lazy"
              decoding="async"
              onError={(event) => imageFallback(event, storefrontCreations3D[0]?.image || IMAGE_FALLBACKS.category)}
              className="absolute inset-y-0 right-0 h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.04] sm:w-[72%] lg:w-[60%]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a281d] via-[#0a281d]/90 to-[#0a281d]/15 md:bg-gradient-to-r md:from-[#0a281d] md:via-[#0a281d]/95 md:to-transparent" />
            <div className="relative z-10 flex min-h-[375px] max-w-[620px] flex-col justify-end px-6 pb-8 pt-44 sm:px-10 md:min-h-[330px] md:justify-center md:py-10">
              <span className="mb-3 w-fit rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/90 backdrop-blur-sm">
                HERENCIA MARKET · DISEÑO 3D
              </span>
              <h2 className="font-serif text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
                {market.home.creations3D.title}
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-white/85 sm:text-base">
                {market.home.creations3D.subtitle}
              </p>
              <Link
                to={market.home.creations3D.href || "/productos?buscar=3D"}
                className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#173d2a] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f4f4e9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {market.home.creations3D.buttonLabel || "Explorar creaciones 3D"}
                <ArrowRight className="h-4 w-4"/>
              </Link>
            </div>
          </div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-serif text-2xl font-semibold text-[#172d20]">Descubre las piezas</h3>
            <Link to={market.home.creations3D.href || "/productos?buscar=3D"}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#234b35] hover:underline">
              Ver colección <ArrowRight className="h-4 w-4"/>
            </Link>
          </div>
              {storefrontCreations3D.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                  {storefrontCreations3D.map((product) => {
                    const price = Number(product.onSale && product.salePrice ? product.salePrice : product.price || 0);
                    return (
                      <article key={product.id} className="group relative flex flex-col overflow-hidden rounded-xl border border-[#e5e9df] bg-white transition duration-300 hover:-translate-y-1 hover:shadow-md">
                        <button type="button" onClick={() => void toggleFavorite(product.id)}
                          aria-label={(favorites.includes(String(product.id)) ? "Quitar de" : "Añadir a") + " favoritos: " + product.name}
                          className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/95 text-[#244b35] shadow-sm">
                          <Heart className="h-4 w-4" fill={favorites.includes(String(product.id)) ? "currentColor" : "none"}/>
                        </button>
                        <Link to={"/producto/" + product.id} className="block aspect-[4/4.3] overflow-hidden bg-[#f0efe9]">
                          <img src={product.image} alt={product.name} loading="lazy" onError={(event) => imageFallback(event, IMAGE_FALLBACKS.category)}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/>
                        </Link>
                        <div className="flex flex-1 flex-col p-2.5">
                          <Link to={"/producto/" + product.id} className="line-clamp-2 min-h-9 text-xs font-semibold leading-snug text-[#1c3b29] hover:underline">{product.name}</Link>
                          <p className="mt-1 text-sm font-bold text-[#28563b]">{money(price)}</p>
                          <button type="button" onClick={() => addToCart(product)}
                            className="mt-auto inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[#244c34] px-2 py-2 text-xs font-bold text-white hover:bg-[#173b27]">
                            <ShoppingCart className="h-3.5 w-3.5"/> {needsExplicitVariantSelection(product) ? "Elegir opciones" : "Añadir"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-[240px] items-center rounded-xl border border-dashed border-[#cfdbce] bg-[#f5f7f2] p-6 text-sm text-[#586d5d]">
                  Los diseños 3D publicados y disponibles se mostrarán aquí cuando se asignen desde Administración.
                </div>
              )}
        </section>
      </StorefrontComponentBoundary>

      <StorefrontComponentBoundary id="home.trust" order={sectionOrder("trust")} controls={market.componentControls} now={scheduleNow} enabled={sections.trust}>
      <section style={{ order: sectionOrder("trust") }} className="border-y border-[#ebe7df] bg-[#faf9f5]">
        <div className="mx-auto grid max-w-7xl gap-3 px-5 py-5 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:px-10">
          {market.home.trust.filter((item) => item.visible !== false && isWithinPublicationWindow(item.schedule, scheduleNow)).map((item, index) => {
            const Icon = trustIcons[index % trustIcons.length];
            return (
              <div key={item.title} className="flex gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#315b42] shadow-sm">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-black">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-[#6c786f]">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section></StorefrontComponentBoundary>

      <StorefrontComponentBoundary id="home.bottomCta" order={sectionOrder("bottomCta")} controls={market.componentControls} now={scheduleNow} enabled={sections.bottomCta}>
      <section style={{ order: sectionOrder("bottomCta") }} className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:px-10 lg:py-20">
        <div className="relative overflow-hidden rounded-xl border border-[#e4dfd3] bg-[#ece5d8] px-7 py-12 text-[#173d2a] sm:px-10">
          {site.cta.imageUrl && <>
            <img src={site.cta.imageUrl} alt="" className="pointer-events-none absolute inset-y-0 right-0 h-full w-full object-cover opacity-70 md:w-[44%]" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#ece5d8] via-[#ece5d8]/95 to-[#ece5d8]/15" />
          </>}
          <Sparkles className="pointer-events-none absolute right-8 top-8 h-20 w-20 text-[#315b42]/15" />
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#315b42]/70">HERENCIA</p>
          <h2 className="relative mt-2 max-w-2xl font-serif text-3xl font-medium sm:text-4xl">
            {site.cta.title}
          </h2>
          <p className="relative mt-3 max-w-2xl text-sm leading-6 text-[#4b6453]">{site.cta.subtitle}</p>
          {site.cta.button.visible !== false && isWithinPublicationWindow(site.cta.button.schedule, scheduleNow) && <Link
            to={site.cta.button.href || "/productos"}
            className="relative mt-6 inline-flex items-center gap-2 rounded-md bg-[#254932] px-5 py-3 text-sm font-semibold text-white"
          >
            {site.cta.button.label || "Explorar Herencia"} <ArrowRight className="h-4 w-4" />
          </Link>}
        </div>
      </section></StorefrontComponentBoundary>
    </div>
  );
}
