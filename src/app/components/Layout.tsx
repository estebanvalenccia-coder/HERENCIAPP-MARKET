import { FormEvent, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { Bot, ChevronDown, Heart, Search, ShoppingCart, Sparkles, User } from "lucide-react";
import { Toaster } from "sonner";
import { backendApi, backendStorage } from "../lib/backendStorage";
import {
  defaultSiteContent,
  isExternalHref,
  normalizePhoneForHref,
  normalizeWhatsAppPhone,
  parseSiteContent,
  type SiteContent,
} from "../lib/siteContent";
import { getMarketExperience } from "../lib/marketExperience";
import { isWithinPublicationWindow } from "../lib/publicationSchedule.mjs";
import { useAdminPreviewSite } from "../lib/useAdminPreviewSite";
import { isComponentAllowed } from "../lib/componentRegistry";
import { parseColombiaDeliverySettings } from "../lib/internationalDelivery";
import { SalesChatWidget } from "./SalesChatWidget";
import { MarketNavigationMenu } from "./MarketNavigationMenu";
import { StorefrontComponentBoundary } from "./StorefrontComponentBoundary";
import { FloatingCustomerSupportV2 } from "./CustomerSupportV2";
import { AccessibilityPanel } from "./AccessibilityPanel";
import logo from "figma:asset/8c5f2b4f88c45fd4812e5bb91610bff5272333d7.png";

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [site, setSite] = useState<SiteContent>(defaultSiteContent);
  useAdminPreviewSite(setSite);
  const [scheduleNow, setScheduleNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setScheduleNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  const [collectionStatus, setCollectionStatus] = useState<Record<string, string>>({});
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [search, setSearch] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [herenciaEnabled, setHerenciaEnabled] = useState(false);
  const [colombiaEnabled, setColombiaEnabled] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [cookieConsent, setCookieConsent] = useState<string>(() => {
    try {
      return localStorage.getItem("herencia_cookie_consent") || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 18);
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const load = () => {
      setSite(parseSiteContent(backendStorage.getItem("siteContent")));

      try {
        const cart = JSON.parse(backendStorage.getItem("cart") || "[]");
        setCartCount(
          Array.isArray(cart)
            ? cart.reduce((sum: number, item: any) => sum + Math.max(1, Number(item?.quantity || 1)), 0)
            : 0
        );
      } catch {
        setCartCount(0);
      }

      try {
        const wishlist = JSON.parse(backendStorage.getItem("wishlist") || "[]");
        setWishlistCount(Array.isArray(wishlist) ? wishlist.length : 0);
      } catch {
        setWishlistCount(0);
      }

      try {
        const settings = JSON.parse(backendStorage.getItem("herenciaSettings") || "{}");
        setHerenciaEnabled(Boolean(settings.enabled));
      } catch {
        setHerenciaEnabled(false);
      }

      try {
        const suite = JSON.parse(backendStorage.getItem("businessSuiteSettings") || "{}");
        setMaintenanceMode(Boolean(suite.maintenanceMode));
      } catch {
        setMaintenanceMode(false);
      }

      try {
        setColombiaEnabled(parseColombiaDeliverySettings(backendStorage.getItem("internationalDeliverySettings")).enabled);
      } catch {
        setColombiaEnabled(false);
      }
    };

    load();
    window.addEventListener("storage", load);
    window.addEventListener("backend-storage", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("backend-storage", load);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (cookieConsent !== "accepted") return;

    let sessionId = "";
    try {
      sessionId = sessionStorage.getItem("herencia_analytics_session") || "";
      if (!sessionId) {
        sessionId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem("herencia_analytics_session", sessionId);
      }
    } catch {
      sessionId = `session-${Date.now()}`;
    }

    const ua = navigator.userAgent || "";
    const browser = /Edg\//.test(ua)
      ? "Edge"
      : /OPR\//.test(ua)
        ? "Opera"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua) && !/Chrome\//.test(ua)
            ? "Safari"
            : /Firefox\//.test(ua)
              ? "Firefox"
              : "Otro";
    const device = /ipad|tablet/i.test(ua)
      ? "Tablet"
      : /mobi|android|iphone/i.test(ua)
        ? "Móvil"
        : "Ordenador";

    fetch("/api/analytics/visit", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "pageview",
        path: `${location.pathname}${location.search}`,
        referrer: document.referrer || "",
        sessionId,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        language: navigator.language || "",
        device,
        browser,
      }),
    }).catch(() => null);
  }, [location.pathname, location.search, cookieConsent]);

  useEffect(() => {
    if (location.pathname !== "/productos") return;
    const params = new URLSearchParams(location.search);
    setSearch(params.get("buscar") || "");
  }, [location.pathname, location.search]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const result = await backendApi.listCommerceCollections({ includeArchived: true });
        if (cancelled) return;
        const next: Record<string, string> = {};
        for (const row of Array.isArray(result.collections) ? result.collections : []) {
          next[String(row.id)] = String(row.status || "active");
        }
        setCollectionStatus(next);
      } catch {
        // Preserve navigation if collection service is temporarily unavailable.
      }
    };
    void refresh();
    window.addEventListener("backend-storage", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("backend-storage", refresh);
    };
  }, []);

  const market = useMemo(() => getMarketExperience(site), [site]);
  const visibleNavigation = market.navigation.filter((item) => {
    if (item.visible === false || !isWithinPublicationWindow(item.schedule, scheduleNow)) return false;
    const path = String(item.href || "").split("?")[0].toLowerCase();
    const collectionId = path === "/dulce" ? "dulce" : path === "/moda" ? "moda" : "";
    return !collectionId || !["draft", "archived", "inactive", "disabled", "hidden"].includes(collectionStatus[collectionId]);
  });

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/productos?buscar=${encodeURIComponent(query)}` : "/productos");
  };

  if (maintenanceMode) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <div className="grid min-h-screen place-items-center bg-[#fbfaf6] px-6 text-[#173126]">
          <div className="max-w-xl text-center">
            <img
              src={site.brand.logoUrl || logo}
              alt={site.brand.logoAlt || site.brand.name}
              className="mx-auto h-28 w-auto object-contain"
            />
            <h1 className="mt-8 text-4xl font-medium">Herencia está preparando algo bonito</h1>
            <p className="mt-4 text-lg text-[#6d776f]">
              La tienda está temporalmente en mantenimiento. Volveremos a estar disponibles en cuanto terminemos.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="herencia-marketfront min-h-screen bg-[#fbfaf6] text-[#173126]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-[#315b42] focus:px-4 focus:py-2 focus:text-white"
        >
          Saltar al contenido principal
        </a>

        <StorefrontComponentBoundary id="header.announcement" controls={market.componentControls} now={scheduleNow} enabled={market.layout.announcement}><div className="bg-[#173d2a] px-4 py-2 text-center text-[11px] font-bold tracking-wide text-white/90 sm:text-xs">
          {market.announcement}
        </div></StorefrontComponentBoundary>

        <header
          className={`z-50 border-b border-[#e8e2d8] bg-[#fffdf9]/95 transition-all duration-300 ${
            site.builder?.headerStyle?.sticky !== false ? "sticky top-0" : "relative"
          } ${isScrolled ? "shadow-[0_10px_30px_rgba(39,61,45,0.08)] backdrop-blur-xl" : ""}`}
          style={{
            backgroundColor: site.builder.headerStyle.backgroundColor || "#fffdf9",
            borderColor: site.builder.headerStyle.borderColor || "#e8e2d8",
            "--market-nav-text": site.builder.headerStyle.textColor || "#526158",
            "--market-nav-active": site.builder.headerStyle.activeColor || "#244a35",
            "--market-nav-bg": site.builder.headerStyle.activeBackground || "#eef2eb",
          } as CSSProperties}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex min-h-[76px] items-center gap-5">
              <Link to="/" className="shrink-0">
                <img
                  src={site.brand.logoUrl || logo}
                  alt={site.brand.logoAlt || site.brand.name}
                  className="w-auto object-contain"
                  style={{ height: Math.max(28, Math.min(120, Number(site.builder.headerStyle.logoHeight) || 56)) }}
                />
              </Link>

              <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
                {visibleNavigation.filter((item) => item.showDesktop !== false).map((item, index) =>
                  item.children?.length ? (
                    <MarketNavigationMenu key={`${item.href}-${index}`} item={item} now={scheduleNow} active={isPathActive(location.pathname, item.href)} />
                  ) : (
                    <MarketNavLink key={`${item.href}-${index}`} href={item.href} label={item.label} active={isPathActive(location.pathname, item.href)} />
                  )
                )}
                {herenciaEnabled && site.navigation.herencia.visible !== false ? (
                  <MarketNavLink
                    href={site.navigation.herencia.href || "/herencia"}
                    label={site.navigation.herencia.label || "Herenc(IA)"}
                    active={isPathActive(location.pathname, site.navigation.herencia.href || "/herencia")}
                    icon={<Bot className="h-3.5 w-3.5" />}
                  />
                ) : null}
              </nav>

              <div className="ml-auto flex items-center gap-1.5">
                <StorefrontComponentBoundary id="header.deliverySelector" controls={market.componentControls} now={scheduleNow} enabled={colombiaEnabled && market.layout.deliverySelector}>
                  <div className="group relative hidden lg:block">
                    <button type="button" className="inline-flex h-11 items-center gap-2 rounded-full border border-[#315b42]/30 bg-white px-4 text-sm font-black text-[#315b42] transition hover:bg-[#f1f6f2]">
                      <span>Entregar en:</span><span>{location.pathname === "/colombia" ? "🇨🇴 Cali" : "🇪🇸 Barcelona"}</span><ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <div className="pointer-events-none absolute right-0 top-full z-[90] w-72 pt-3 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                      <div className="overflow-hidden rounded-2xl border border-[#e4ded4] bg-[#fffdf9] p-2 shadow-[0_18px_55px_rgba(31,62,44,0.16)]">
                        <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-[#f4f1e9]"><span className="text-xl">🇪🇸</span><div><p className="text-sm font-black">Barcelona</p><p className="text-xs text-[#718076]">Plantas y productos locales</p></div></Link>
                        <Link to="/colombia" className="mt-1 flex items-center gap-3 rounded-xl bg-[#edf4ee] px-3 py-3"><span className="text-xl">🇨🇴</span><div className="flex-1"><p className="text-sm font-black">Cali, Candelaria y Palmira</p><p className="text-xs text-[#718076]">Regalos y plantas en Colombia</p></div><span className="rounded-full bg-[#315b42] px-2 py-1 text-[9px] font-black text-white">NUEVO</span></Link>
                        <div className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3 text-[#718076]"><span className="text-xl">🌎</span><div><p className="text-sm font-black">Próximamente</p><p className="text-xs">Más destinos</p></div></div>
                      </div>
                    </div>
                  </div>
                </StorefrontComponentBoundary>
                <StorefrontComponentBoundary id="header.search" controls={market.componentControls} now={scheduleNow} enabled={market.layout.search}><form onSubmit={submitSearch} className="relative hidden w-[220px] xl:block">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718076]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar plantas, productos, servicios..."
                    className="h-11 w-full rounded-full border border-[#ded9cd] bg-white pl-10 pr-4 text-sm outline-none transition focus:border-[#315b42] focus:ring-2 focus:ring-[#315b42]/10"
                  />
                </form></StorefrontComponentBoundary>

                <StorefrontComponentBoundary id="header.search" controls={market.componentControls} now={scheduleNow} enabled={market.layout.search}>
                  <button type="button"
                  onClick={() => {
                    const query = window.prompt("¿Qué quieres buscar en Herencia?", search);
                    if (query === null) return;
                    setSearch(query);
                    navigate(query.trim() ? `/productos?buscar=${encodeURIComponent(query.trim())}` : "/productos");
                  }}
                  className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-[#f0eee7] xl:hidden"
                  aria-label="Buscar"
                >
                  <Search className="h-5 w-5" />
                </button></StorefrontComponentBoundary>

                <StorefrontComponentBoundary id="header.account" controls={market.componentControls} now={scheduleNow} enabled={market.layout.account}>
                  <Link to={site.headerActions.profileHref || "/perfil"}
                  className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-[#f0eee7]"
                  aria-label="Mi cuenta"
                >
                  <User className="h-5 w-5" />
                </Link></StorefrontComponentBoundary>

                <StorefrontComponentBoundary id="header.favorites" controls={market.componentControls} now={scheduleNow} enabled={market.layout.favorites}>
                  <Link to="/perfil"
                  className="relative hidden h-10 w-10 place-items-center rounded-full transition hover:bg-[#f0eee7] sm:grid"
                  aria-label="Favoritos"
                >
                  <Heart className="h-5 w-5" />
                  {wishlistCount > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#c9836b] px-1 text-[9px] font-black text-white">
                      {wishlistCount}
                    </span>
                  ) : null}
                </Link></StorefrontComponentBoundary>

                <StorefrontComponentBoundary id="header.cart" controls={market.componentControls} now={scheduleNow} enabled={market.layout.cart}>
                  <Link to={site.headerActions.cartHref || "/carrito"}
                  className="relative grid h-10 w-10 place-items-center rounded-full transition hover:bg-[#f0eee7]"
                  aria-label="Carrito"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {cartCount > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#315b42] px-1 text-[9px] font-black text-white">
                      {cartCount}
                    </span>
                  ) : null}
                </Link></StorefrontComponentBoundary>
              </div>
            </div>

            <nav className="flex items-center gap-1 overflow-x-auto border-t border-[#eee9df] py-2 lg:hidden">
              {visibleNavigation.filter((item) => item.showMobile !== false).map((item, index) =>
                item.children?.length ? (
                  <MarketNavigationMenu key={`${item.href}-${index}`} item={item} now={scheduleNow} mobile active={isPathActive(location.pathname, item.href)} />
                ) : (
                  <MarketNavLink key={`${item.href}-${index}`} href={item.href} label={item.label} active={isPathActive(location.pathname, item.href)} mobile />
                )
              )}
              {herenciaEnabled && site.navigation.herencia.visible !== false ? (
                <MarketNavLink
                  href={site.navigation.herencia.href || "/herencia"}
                  label={site.navigation.herencia.label || "Herenc(IA)"}
                  active={isPathActive(location.pathname, site.navigation.herencia.href || "/herencia")}
                  mobile
                />
              ) : null}
              <StorefrontComponentBoundary id="header.deliverySelector" controls={market.componentControls} now={scheduleNow} enabled={colombiaEnabled && market.layout.deliverySelector}>
                <MarketNavLink href="/colombia" label="🇨🇴 Cali" active={location.pathname === "/colombia"} mobile />
              </StorefrontComponentBoundary>
            </nav>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="min-h-[60vh]">
          <Outlet />
        </main>

        <StorefrontComponentBoundary id="footer.main" controls={market.componentControls} now={scheduleNow} enabled={market.layout.footer}><footer className="border-t border-[#d9ddd6] bg-[#173d2a] text-white" style={{ backgroundColor: site.builder.footerStyle.backgroundColor || "#173d2a", color: site.builder.footerStyle.textColor || "#ffffff", borderColor: site.builder.footerStyle.borderColor || "#d9ddd6", "--market-footer-heading": site.builder.footerStyle.headingColor || "#ffffff", "--market-footer-text": site.builder.footerStyle.textColor || "#ffffff" } as CSSProperties}>
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10" style={{ paddingTop: Math.max(12, Math.min(130, Number(site.builder.footerStyle.paddingY) || 48)), paddingBottom: Math.max(12, Math.min(130, Number(site.builder.footerStyle.paddingY) || 48)) }}>
            <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.2fr_.8fr_.8fr_1fr]">
              <div>
                <img
                  src={site.brand.logoUrl || logo}
                  alt={site.brand.logoAlt || site.brand.name}
                  className="h-20 w-auto rounded-xl bg-[#fffdf9] p-2 object-contain"
                />
                <p className="mt-5 max-w-sm text-sm leading-6 text-white/72">
                  {site.footer.description || "Plantas, hogar, servicios y detalles que hacen la vida más bonita."}
                </p>
                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold">
                  <Sparkles className="h-4 w-4 text-[#d8c49c]" />
                  {market.locationLabel}
                </div>
              </div>

              <FooterColumn
                title={site.footer.productsTitle}
                links={site.footer.productLinks.filter((item) => item.visible !== false && isWithinPublicationWindow(item.schedule, scheduleNow) && !["draft", "archived", "inactive", "disabled", "hidden"].includes(collectionStatus[String(item.href || "").split("?")[0].replace("/", "")]))}
              />

              <FooterColumn
                title={site.footer.servicesTitle}
                links={site.footer.serviceLinks.filter((item) => item.visible !== false && isWithinPublicationWindow(item.schedule, scheduleNow))}
              />

              <div>
                <h4 className="font-black text-white">Contacto</h4>
                <div className="mt-4 space-y-3 text-sm text-white/72">
                  <p>{market.locationLabel}</p>
                  <a
                    className="block transition hover:text-white"
                    href={`https://wa.me/${normalizeWhatsAppPhone(site.footer.whatsappPhone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {site.footer.whatsappLabel}
                  </a>
                  <a
                    className="block transition hover:text-white"
                    href={`tel:${normalizePhoneForHref(site.footer.callPhone)}`}
                  >
                    {site.footer.callLabel}
                  </a>
                  <a
                    className="block transition hover:text-white"
                    href={site.footer.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {site.footer.instagramLabel}
                  </a>
                </div>
              </div>
            </div>

          </div>
        </footer></StorefrontComponentBoundary>
        <footer aria-label="Información legal y privacidad" className="border-t border-white/15 bg-[#173d2a] px-5 pb-5 text-white sm:px-8 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-4 border-t border-white/12 pt-4 text-xs text-white/58 sm:flex-row sm:items-center sm:justify-between">
              <p>{site.footer.copyright}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                <FooterLink href={site.footer.privacyHref}>{site.footer.privacyLabel}</FooterLink>
                <FooterLink href={site.footer.cookiesHref}>{site.footer.cookiesLabel}</FooterLink>
                <FooterLink href={site.footer.termsHref}>{site.footer.termsLabel}</FooterLink>
              </div>
            </div>
          </div>
        </footer>
      </div>

      <StorefrontComponentBoundary id="floating.sales" controls={market.componentControls} now={scheduleNow} enabled={market.sales.enabled}>
        <SalesChatWidget />
      </StorefrontComponentBoundary>
      <StorefrontComponentBoundary id="floating.support" controls={market.componentControls} now={scheduleNow}>
        <FloatingCustomerSupportV2 salesButtonVisible={market.sales.enabled && isComponentAllowed(market.componentControls, "floating.sales", scheduleNow)} salesPosition={market.sales.position} salesBottomOffset={market.sales.bottomOffset} position={market.support.position} bottomOffset={market.support.bottomOffset} buttonColor={market.support.buttonColor} buttonLabel={market.support.buttonLabel} />
      </StorefrontComponentBoundary>
      <StorefrontComponentBoundary id="floating.accessibility" controls={market.componentControls} now={scheduleNow}>
        <AccessibilityPanel />
      </StorefrontComponentBoundary>

      {!cookieConsent ? (
        <div className="fixed bottom-4 left-4 right-4 z-[120] mx-auto max-w-3xl rounded-2xl border border-[#ded9cd] bg-[#fffdf9] p-4 text-[#173126] shadow-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="font-black">Privacidad y cookies</p>
              <p className="mt-1 text-sm text-[#6d776f]">
                Herencia usa almacenamiento esencial para carrito, sesión y funcionamiento de la tienda.
                Si aceptas, también podremos medir visitas y uso de forma agregada para mejorar la tienda.
                Puedes aceptar o mantener solo lo esencial.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem("herencia_cookie_consent", "essential");
                  setCookieConsent("essential");
                }}
                className="rounded-full border border-[#ded9cd] px-4 py-2 text-sm font-black"
              >
                Solo esenciales
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem("herencia_cookie_consent", "accepted");
                  setCookieConsent("accepted");
                }}
                className="rounded-full bg-[#315b42] px-4 py-2 text-sm font-black text-white"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}


const GARDENING_PRODUCT_SUBMENU = [
  { label: "Ver todos los artículos", description: "Todo para el jardín y el huerto", href: "/productos?coleccion=jardineria" },
  { label: "Huerto urbano", description: "Kits de cultivo, semilleros y mesas", href: "/productos?coleccion=jardineria&categoria=huerto-urbano" },
  { label: "Herramientas de jardín", description: "Utensilios para plantar y cuidar", href: "/productos?coleccion=jardineria&categoria=herramientas" },
  { label: "Riego y agua", description: "Regaderas y sistemas de riego", href: "/productos?coleccion=jardineria&categoria=riego" },
  { label: "Fertilizantes y abonos", description: "Nutrición para tus plantas", href: "/productos?coleccion=jardineria&categoria=fertilizantes" },
  { label: "Accesorios de jardinería", description: "Complementos para cultivar", href: "/productos?coleccion=jardineria&categoria=accesorios-jardin" },
];

const GARDENING_PROTECTION_SUBMENU = [
  { label: "Fungicidas", description: "Tratamientos frente a hongos", href: "/productos?coleccion=jardineria&categoria=fungicidas" },
  { label: "Acaricidas", description: "Tratamientos frente a ácaros", href: "/productos?coleccion=jardineria&categoria=acaricidas" },
  { label: "Insecticidas", description: "Tratamientos frente a insectos", href: "/productos?coleccion=jardineria&categoria=insecticidas" },
  { label: "Otros tratamientos fitosanitarios", description: "Otras opciones de protección", href: "/productos?coleccion=jardineria&categoria=tratamientos-fitosanitarios" },
];

const GARDENING_SERVICE_SUBMENU = [
  { label: "Servicios de huerto urbano", description: "Instalación, siembra y mantenimiento", href: "/servicios#huerto-urbano" },
];

function isGardeningNavigationItem(item: { label?: string; href?: string }) {
  const label = String(item?.label || "").trim().toLowerCase();
  const href = String(item?.href || "").toLowerCase();
  return label === "jardinería" || label === "jardineria" || /[?&]coleccion=jardineria(?:&|$)/.test(href);
}

function GardeningNavMenu({ active }: { active: boolean }) {
  return (
    <div className="group relative shrink-0">
      <Link
        to="/productos?coleccion=jardineria"
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition ${
          active ? "bg-[#eef2eb] text-[#244a35]" : "text-[#526158] hover:bg-[#f3f0e9] hover:text-[#244a35]"
        }`}
        aria-haspopup="true"
      >
        Jardinería
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
      </Link>
      <div className="pointer-events-none absolute left-1/2 top-full z-[80] w-[610px] max-w-[95vw] -translate-x-1/2 pt-3 opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <div className="rounded-2xl border border-[#e4ded4] bg-[#fffdf9] p-4 shadow-[0_18px_55px_rgba(31,62,44,0.16)]">
          <div className="grid grid-cols-2 gap-4">
            <section aria-label="Artículos de jardinería">
              <p className="px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#315b42]">Artículos de jardinería</p>
              {GARDENING_PRODUCT_SUBMENU.map((item) => (
                <Link key={item.href} to={item.href} className="block rounded-xl px-3 py-2.5 transition hover:bg-[#eef2eb]">
                  <span className="block text-sm font-black text-[#244a35]">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-[#718076]">{item.description}</span>
                </Link>
              ))}
            </section>
            <div className="border-l border-[#eee8dd] pl-4">
              <section aria-label="Protección vegetal">
                <p className="px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#315b42]">Protección vegetal</p>
                {GARDENING_PROTECTION_SUBMENU.map((item) => (
                  <Link key={item.href} to={item.href} className="block rounded-xl px-3 py-2.5 transition hover:bg-[#eef2eb]">
                    <span className="block text-sm font-black text-[#244a35]">{item.label}</span>
                    <span className="mt-0.5 block text-xs text-[#718076]">{item.description}</span>
                  </Link>
                ))}
              </section>
              <section aria-label="Servicios de jardinería" className="mt-3 border-t border-[#eee8dd] pt-2">
                <p className="px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#315b42]">Servicios</p>
                {GARDENING_SERVICE_SUBMENU.map((item) => (
                  <Link key={item.href} to={item.href} className="block rounded-xl bg-[#edf4ee] px-3 py-2.5 transition hover:bg-[#dfece1]">
                    <span className="block text-sm font-black text-[#244a35]">{item.label}</span>
                    <span className="mt-0.5 block text-xs text-[#718076]">{item.description}</span>
                  </Link>
                ))}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GardeningMobileNavMenu({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition ${
          active ? "bg-[#eef2eb] text-[#244a35]" : "text-[#526158] hover:bg-[#f3f0e9] hover:text-[#244a35]"
        }`}
      >
        Jardinería
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Cerrar menú de jardinería"
            className="fixed inset-0 z-[70] cursor-default"
            onClick={() => setOpen(false)}
          />
          <div role="menu" className="fixed left-4 right-4 top-[170px] z-[80] max-h-[calc(100vh-190px)] overflow-y-auto rounded-2xl border border-[#e4ded4] bg-[#fffdf9] p-2 shadow-[0_18px_55px_rgba(31,62,44,0.18)]">
            <p className="px-4 pb-2 pt-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#315b42]">Artículos de jardinería</p>
            {GARDENING_PRODUCT_SUBMENU.map((item) => (
              <Link role="menuitem" key={item.href} to={item.href} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-2.5 hover:bg-[#eef2eb]">
                <span className="block text-sm font-black text-[#244a35]">{item.label}</span>
                <span className="mt-0.5 block text-xs text-[#718076]">{item.description}</span>
              </Link>
            ))}
            <p className="mt-2 border-t border-[#eee8dd] px-4 pb-2 pt-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#315b42]">Protección vegetal</p>
            {GARDENING_PROTECTION_SUBMENU.map((item) => (
              <Link role="menuitem" key={item.href} to={item.href} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-2.5 hover:bg-[#eef2eb]">
                <span className="block text-sm font-black text-[#244a35]">{item.label}</span>
                <span className="mt-0.5 block text-xs text-[#718076]">{item.description}</span>
              </Link>
            ))}
            <p className="mt-2 border-t border-[#eee8dd] px-4 pb-2 pt-3 text-[11px] font-black uppercase tracking-[0.16em] text-[#315b42]">Servicios</p>
            {GARDENING_SERVICE_SUBMENU.map((item) => (
              <Link role="menuitem" key={item.href} to={item.href} onClick={() => setOpen(false)} className="block rounded-xl bg-[#edf4ee] px-4 py-2.5 hover:bg-[#dfece1]">
                <span className="block text-sm font-black text-[#244a35]">{item.label}</span>
                <span className="mt-0.5 block text-xs text-[#718076]">{item.description}</span>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

const PLANT_SUBMENU = [
  { label: "Interior", href: "/productos?coleccion=plantas&categoria=plantas-interior" },
  { label: "Exterior", href: "/productos?coleccion=plantas&categoria=plantas-exterior" },
  { label: "Cactus y suculentas", href: "/productos?coleccion=plantas&categoria=cactus-suculentas" },
  { label: "Orquídeas", href: "/productos?coleccion=plantas&categoria=orquideas" },
  { label: "Exóticas", href: "/productos?coleccion=plantas&categoria=plantas-exoticas" },
];

function isPlantsNavigationItem(item: { label?: string; href?: string }) {
  const label = String(item?.label || "").trim().toLowerCase();
  const href = String(item?.href || "").toLowerCase();
  // Only the parent "Plantas" item owns the flyout. Category links such as
  // Interior/Exterior also contain coleccion=plantas and must not be rendered
  // as duplicate plant menus in the header.
  return label === "plantas" || /[?&]categoria=plantas(?:&|$)/.test(href);
}

function PlantsNavMenu({ active }: { active: boolean }) {
  return (
    <div className="group relative">
      <Link
        to="/productos?coleccion=plantas"
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition ${
          active ? "bg-[#eef2eb] text-[#244a35]" : "text-[#526158] hover:bg-[#f3f0e9] hover:text-[#244a35]"
        }`}
      >
        Plantas
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
      </Link>
      <div className="pointer-events-none absolute left-1/2 top-full z-[80] w-64 -translate-x-1/2 pt-3 opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <div className="overflow-hidden rounded-2xl border border-[#e4ded4] bg-[#fffdf9] p-2 shadow-[0_18px_55px_rgba(31,62,44,0.16)]">
          <Link
            to="/productos?coleccion=plantas"
            className="block rounded-xl px-4 py-3 text-sm font-black text-[#244a35] hover:bg-[#eef2eb]"
          >
            Ver todas las plantas
          </Link>
          <div className="my-1 border-t border-[#eee8dd]" />
          {PLANT_SUBMENU.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="block rounded-xl px-4 py-3 text-sm font-bold text-[#526158] transition hover:bg-[#f3f0e9] hover:text-[#244a35]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlantsMobileNavMenu({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition ${
          active ? "bg-[#eef2eb] text-[#244a35]" : "text-[#526158] hover:bg-[#f3f0e9] hover:text-[#244a35]"
        }`}
      >
        Plantas
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Cerrar menú de plantas"
            className="fixed inset-0 z-[70] cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="fixed left-4 right-4 top-[170px] z-[80] max-h-[calc(100vh-190px)] overflow-y-auto rounded-2xl border border-[#e4ded4] bg-[#fffdf9] p-2 shadow-[0_18px_55px_rgba(31,62,44,0.18)]"
          >
            <Link
              to="/productos?coleccion=plantas"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 text-sm font-black text-[#244a35] hover:bg-[#eef2eb]"
            >
              Ver todas las plantas
            </Link>
            <div className="my-1 border-t border-[#eee8dd]" />
            {PLANT_SUBMENU.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setOpen(false)}
                role="menuitem"
                className="block rounded-xl px-4 py-3 text-sm font-bold text-[#526158] transition hover:bg-[#f3f0e9] hover:text-[#244a35]"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function isPathActive(pathname: string, href: string) {
  const path = String(href || "/").split("?")[0].split("#")[0] || "/";
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

function MarketNavLink({
  href,
  label,
  active,
  icon,
  mobile = false,
}: {
  href: string;
  label: string;
  active: boolean;
  icon?: React.ReactNode;
  mobile?: boolean;
}) {
  const className = `inline-flex shrink-0 items-center gap-1.5 rounded-full font-bold transition ${
    mobile ? "px-3 py-2 text-sm" : "px-3 py-2 text-sm"
  } ${active ? "bg-[#eef2eb] text-[#244a35]" : "text-[#526158] hover:bg-[#f3f0e9] hover:text-[#244a35]"}`;

  if (isExternalHref(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={{ color: active ? "var(--market-nav-active, #244a35)" : "var(--market-nav-text, #526158)", backgroundColor: active ? "var(--market-nav-bg, #eef2eb)" : undefined }}>
        {icon}
        {label}
      </a>
    );
  }

  return (
    <Link to={href || "/"} className={className} style={{ color: active ? "var(--market-nav-active, #244a35)" : "var(--market-nav-text, #526158)", backgroundColor: active ? "var(--market-nav-bg, #eef2eb)" : undefined }}>
      {icon}
      {label}
    </Link>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; href: string }>;
}) {
  return (
    <div>
      <h4 className="font-black text-white" style={{ color: "var(--market-footer-heading, #ffffff)" }}>{title}</h4>
      <ul className="mt-4 space-y-2.5 text-sm text-white/72">
        {links.map((item, index) => (
          <li key={`${item.href}-${index}`}>
            <FooterLink href={item.href}>{item.label}</FooterLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const className = "transition hover:text-white";
  if (isExternalHref(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={href || "/"} className={className}>
      {children}
    </Link>
  );
}
