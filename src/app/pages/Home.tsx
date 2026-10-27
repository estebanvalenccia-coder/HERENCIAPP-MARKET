import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowRight,
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
import { primaryCollectionOf } from "../lib/commerceCatalog";
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
  const [collectionStatus, setCollectionStatus] = useState<Record<string, string>>({});
  const [colombiaDelivery, setColombiaDelivery] = useState<ColombiaDeliverySettings>(defaultColombiaDeliverySettings);

  useEffect(() => {
    const load = () => {
      if (!isEmbeddedAdminPreview()) setSite(parseSiteContent(backendStorage.getItem("siteContent")));
      setColombiaDelivery(parseColombiaDeliverySettings(backendStorage.getItem("internationalDeliverySettings")));
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
  const heroBlock = useMemo(
    () => ensureBuilderBlocks(site).find((block) => block.type === "hero"),
    [site]
  );
  const heroDesign = heroBlock?.design;
  const heroMinHeight = Math.max(360, Number(heroDesign?.minHeight || 620));
  const heroImage =
    safeHeroImage(heroBlock?.data?.imageUrl) ||
    safeHeroImage(market.home.heroImageUrl) ||
    safeHeroImage(site.hero.imageUrl) ||
    DEFAULT_HERO;

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

  // La colección editorial se alimenta exclusivamente de productos publicados:
  // nunca sustituir el catálogo real por artículos o precios del boceto.
  const creations3D = useMemo(() => catalog.filter((product) => {
    const text = [product.name, product.category, product.subcategory, product.collection,
      ...(Array.isArray(product.tags) ? product.tags : [])].filter(Boolean).join(" ").toLowerCase();
    return product.active !== false && !product.deletedAt && !["draft", "archived", "inactive"].includes(String(product.status || "active"))
      && /(?:impresi[oó]n\s*3d|creaciones?\s*3d|maceta\s*3d|dise[nñ]o\s*3d|3d\s*print)/i.test(text)
      && Boolean(product.image) && Number(product.onSale && product.salePrice ? product.salePrice : product.price || 0) > 0
      && (product.trackInventory === false || Number(product.stock || 0) > 0 || (Array.isArray(product.variants) && product.variants.some((variant: any) => Number(variant.stock || 0) > 0)));
  }).slice(0, 4), [catalog]);

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
      <StorefrontComponentBoundary id="home.hero" controls={market.componentControls} now={scheduleNow} enabled={sections.hero}>
        <section className="bg-[#f1f1e8] px-4 py-5 sm:px-8 sm:py-8 lg:px-10 lg:py-11" style={{ order: sectionOrder("hero"), backgroundColor: heroDesign?.backgroundColor || undefined }}>
          <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[1.5rem] border border-[#e1e3d9] bg-[#e8ecdf] shadow-sm lg:grid-cols-[0.9fr_1.1fr]" style={{ borderRadius: Math.max(0, Number(heroDesign?.radius ?? 24)) }}>
            <div className="flex flex-col justify-center px-7 py-14 sm:px-12 lg:px-14 lg:py-20" style={{ minHeight: Math.max(420, Number(heroDesign?.minHeight || heroMinHeight) - 80), textAlign: heroDesign?.alignment || "left", fontFamily: heroDesign?.fontFamily && heroDesign.fontFamily !== "inherit" ? heroDesign.fontFamily : undefined, color: heroDesign?.textColor && heroDesign.textColor !== "#ffffff" ? heroDesign.textColor : "#1c3f2c" }}>
              <p className="mb-6 text-xs font-bold uppercase tracking-[0.27em] text-[#6a816d]">{market.home.kicker}</p>
              <h1 className="max-w-[650px] font-serif text-[clamp(2.8rem,5vw,5.4rem)] font-normal leading-[1.07] tracking-[-0.04em]">{market.home.title}</h1>
              <p className="mt-6 max-w-lg text-base leading-8 text-[#536356] sm:text-lg">{market.home.description}</p>
              <div className="mt-9 flex flex-wrap gap-3" style={{ justifyContent: heroDesign?.alignment === "right" ? "flex-end" : heroDesign?.alignment === "center" ? "center" : "flex-start" }}>
                {site.hero.primaryButton.visible !== false && isWithinPublicationWindow(site.hero.primaryButton.schedule, scheduleNow) && <Link to={site.hero.primaryButton.href || "/productos"} className="inline-flex items-center gap-2 rounded-lg bg-[#234b35] px-7 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#153524]">{site.hero.primaryButton.label || "Explorar tienda"} <ArrowRight className="h-4 w-4" /></Link>}
                {site.hero.secondaryButton.visible !== false && isWithinPublicationWindow(site.hero.secondaryButton.schedule, scheduleNow) && <Link to={site.hero.secondaryButton.href || "/servicios"} className="inline-flex items-center gap-2 rounded-lg border border-[#728c75] px-7 py-3.5 text-sm font-semibold text-[#234b35] transition hover:bg-white/70">{site.hero.secondaryButton.label || "Nuestros servicios"}</Link>}
              </div>
              <div className="mt-12 flex flex-wrap gap-6 border-t border-[#d0dacd] pt-6 text-xs font-medium text-[#526a56]">
                <span className="inline-flex items-center gap-2"><Leaf className="h-4 w-4" /> Naturaleza y diseño</span>
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Compra segura</span>
              </div>
            </div>
            <div className="relative min-h-[340px] bg-[#dce3d4] lg:min-h-[550px]">
              <img src={heroImage} alt="Colección de Herencia Market" onError={(event) => imageFallback(event, IMAGE_FALLBACKS.hero)} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: heroDesign?.imagePosition || "center", transform: `scale(${Math.max(100, Number(heroDesign?.imageZoom || 100)) / 100})` }} />
              <div className="absolute bottom-5 left-5 rounded-lg border border-white/70 bg-[#fffdf7]/90 px-5 py-3 text-sm font-medium text-[#21412d] shadow-sm backdrop-blur-md sm:bottom-8 sm:left-8">HERENCIA MARKET · Naturaleza con identidad</div>
            </div>
          </div>
        </section>
      </StorefrontComponentBoundary>

      <StorefrontComponentBoundary id="home.delivery" controls={market.componentControls} now={scheduleNow} enabled={sections.delivery && colombiaDelivery.enabled}>
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

      <StorefrontComponentBoundary id="home.categoryStrip" controls={market.componentControls} now={scheduleNow} enabled={sections.categoryStrip}>
      <section style={{ order: sectionOrder("categoryStrip") }} className="border-b border-[#eae6de] bg-[#fffdf9]">
        <div className="mx-auto max-w-7xl px-5 py-9 sm:px-8 lg:px-10">
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 lg:grid-cols-7">
            {visibleHomeCategories.map((item) => (
              <Link key={item.title} to={item.href} className="group text-center">
                <div className="mx-auto h-24 w-24 max-w-full overflow-hidden rounded-full border border-[#e3ddd2] bg-[#f2eee6] transition duration-300 group-hover:-translate-y-1 group-hover:shadow-md">
                  <img src={item.imageUrl} alt="" onError={(event) => imageFallback(event, IMAGE_FALLBACKS.category)} className="h-full w-full object-cover" />
                </div>
                <p className="mt-2 text-xs font-black leading-tight text-[#1f3b2d] sm:text-sm">
                  {item.title}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section></StorefrontComponentBoundary>

      <StorefrontComponentBoundary id="home.plantCta" controls={market.componentControls} now={scheduleNow} enabled={sections.plantCta}><div style={{ order: sectionOrder("plantCta") }} className="mx-auto max-w-7xl px-5 py-4 sm:px-8 lg:px-10 text-center">
        <Link
          to="/catalogo/plantas"
          className="inline-flex items-center gap-2 rounded-lg bg-[#254932] px-6 py-3.5 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#173d2a]"
        >
          Descubre nuestras plantas
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div></StorefrontComponentBoundary>

      <StorefrontComponentBoundary id="home.feed" controls={market.componentControls} now={scheduleNow} enabled={sections.feed}><div style={{ order: sectionOrder("feed") }}><StorefrontFeed /></div></StorefrontComponentBoundary>

      <StorefrontComponentBoundary id="home.categoriesGrid" controls={market.componentControls} now={scheduleNow} enabled={sections.categoriesGrid}>
      <section style={{ order: sectionOrder("categoriesGrid") }} className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#6d7d72]">
              Nuestras categorías
            </p>
            <h2 className="mt-2 font-serif text-3xl font-normal tracking-tight sm:text-4xl">
              {market.home.categoriesTitle}
            </h2>
          </div>
          <Link to="/productos" className="inline-flex items-center gap-2 text-sm font-black text-[#315b42]">
            Ver toda la tienda <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(Number(market.home.categoryGridLimit ?? 8) === 0 ? visibleHomeCategories : visibleHomeCategories.slice(0, Math.max(1, Math.min(100, Number(market.home.categoryGridLimit ?? 8))))).map((item) => (
            <Link
              key={item.title}
              to={item.href}
              className="group overflow-hidden rounded-3xl border border-[#e5e1d8] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              style={{ backgroundColor: item.design?.backgroundColor || undefined, borderRadius: Math.max(0, Math.min(48, Number(item.design?.radius ?? 24))) }}
            >
              <div className="h-44 overflow-hidden bg-[#efece4]" style={{ height: `${Math.max(100, Math.min(300, Number(item.design?.imageHeight ?? 176))) }px` }}>
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  onError={(event) => imageFallback(event, IMAGE_FALLBACKS.category)}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  style={{ objectPosition: item.design?.imagePosition || "center" }}
                />
              </div>
              <div className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-black" style={{ color: item.design?.textColor || undefined }}>{item.title}</p>
                  <p className="mt-1 text-xs text-[#718076]">{item.subtitle}</p>
                </div>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f1efe8]">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section></StorefrontComponentBoundary>

      <StorefrontComponentBoundary id="home.services" controls={market.componentControls} now={scheduleNow} enabled={sections.services}>
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

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {market.home.services.filter((service) => service.visible !== false && isWithinPublicationWindow(service.schedule, scheduleNow)).map((service) => (
              <Link
                key={service.title}
                to={service.href}
                className="group overflow-hidden rounded-3xl border border-[#ded9cd] bg-[#fffdf9] shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
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
                  <h3 className="text-lg font-black leading-tight" style={{ color: service.design?.textColor || undefined }}>{service.title}</h3>
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

      <StorefrontComponentBoundary id="home.featured" controls={market.componentControls} now={scheduleNow} enabled={sections.featured}>
      <section style={{ order: sectionOrder("featured") }} className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#6d7d72]">
              Selección Herencia
            </p>
            <h2 className="mt-2 font-serif text-3xl font-normal tracking-tight sm:text-4xl">{market.home.featuredTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6c786f]">
              {market.home.featuredSubtitle}
            </p>
          </div>
          <Link to="/productos" className="inline-flex items-center gap-2 text-sm font-black text-[#315b42]">
            Ver todos <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {creations3D.length > 0 && (
          <div className="mt-8 overflow-hidden rounded-2xl border border-[#dfdccc] bg-[#eaf0e6] md:flex md:items-center">
            <div className="flex-1 px-7 py-8 md:px-10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#57705c]">Diseño y creatividad</p>
              <h3 className="mt-2 font-serif text-3xl tracking-tight text-[#173d2a] md:text-4xl">Creaciones 3D de Herencia</h3>
              <p className="mt-3 max-w-lg text-sm leading-6 text-[#4a604f]">Explora nuestras macetas, diseños y detalles creados con impresión 3D.</p>
              <Link to={`/producto/${creations3D[0].id}`} className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#254932] px-5 py-3 text-sm font-semibold text-white hover:bg-[#173d2a]">
                Descubrir creaciones <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <Link to={`/producto/${creations3D[0].id}`} className="block h-60 bg-[#e2e5d9] md:h-72 md:w-[38%]">
              <img src={creations3D[0].image} alt={creations3D[0].name} className="h-full w-full object-cover" />
            </Link>
          </div>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {featured.map((product) => {
            const price = Number(product.onSale && product.salePrice ? product.salePrice : product.price || 0);
            return (
              <article
                key={product.id}
                className="group overflow-hidden rounded-xl border border-[#ece7dc] bg-white transition duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <Link to={`/producto/${product.id}`} className="block aspect-[4/4.3] overflow-hidden bg-[#f1eee7]">
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
      </section></StorefrontComponentBoundary>

      <StorefrontComponentBoundary id="home.promotions" controls={market.componentControls} now={scheduleNow} enabled={sections.promotions}>
      <section style={{ order: sectionOrder("promotions") }} className="mx-auto grid w-full max-w-7xl gap-5 px-5 pb-14 sm:px-8 lg:grid-cols-2 lg:px-10">
        {[market.dulce, market.moda, ...market.home.campaigns].filter((promo) => {
          if (promo.enabled === false || !isWithinPublicationWindow(promo.schedule, scheduleNow) || !isMarketDestinationEnabled(market, promo.href)) return false;
          const dest = String(promo.href || "").split("?")[0];
          const related = dest === "/dulce" ? "dulce" : dest === "/moda" ? "moda" : "";
          return !related || !["draft", "archived", "inactive", "disabled", "hidden"].includes(collectionStatus[related]);
        }).map((promo, index) => (
          <Link
            key={("id" in promo && promo.id) || `${promo.title}-${index}`}
            to={promo.href}
            className="group relative min-h-[300px] overflow-hidden rounded-[2rem] border border-[#ded9cd]"
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

      <StorefrontComponentBoundary id="home.trust" controls={market.componentControls} now={scheduleNow} enabled={sections.trust}>
      <section style={{ order: sectionOrder("trust") }} className="border-y border-[#ded9cd] bg-[#f4f1e8]">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:px-10">
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

      <StorefrontComponentBoundary id="home.bottomCta" controls={market.componentControls} now={scheduleNow} enabled={sections.bottomCta}>
      <section style={{ order: sectionOrder("bottomCta") }} className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#173d2a] px-7 py-10 text-white sm:px-10">
          <Sparkles className="absolute right-8 top-8 h-20 w-20 text-white/5" />
          <p className="text-xs font-black uppercase tracking-[0.24em] text-white/65">HERENCIA</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-medium sm:text-4xl">
            {site.cta.title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78">{site.cta.subtitle}</p>
          {site.cta.button.visible !== false && isWithinPublicationWindow(site.cta.button.schedule, scheduleNow) && <Link
            to={site.cta.button.href || "/productos"}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#173d2a]"
          >
            {site.cta.button.label || "Explorar Herencia"} <ArrowRight className="h-4 w-4" />
          </Link>}
        </div>
      </section></StorefrontComponentBoundary>
    </div>
  );
}
