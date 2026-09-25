import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { Bot, Heart, Search, ShoppingCart, Sparkles, User } from "lucide-react";
import { Toaster } from "sonner";
import { backendStorage } from "../lib/backendStorage";
import {
  defaultSiteContent,
  isExternalHref,
  normalizePhoneForHref,
  normalizeWhatsAppPhone,
  parseSiteContent,
  type SiteContent,
} from "../lib/siteContent";
import { getMarketExperience } from "../lib/marketExperience";
import { SalesChatWidget } from "./SalesChatWidget";
import { WhatsAppButton } from "./WhatsAppButton";
import { AccessibilityPanel } from "./AccessibilityPanel";
import logo from "figma:asset/8c5f2b4f88c45fd4812e5bb91610bff5272333d7.png";

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [site, setSite] = useState<SiteContent>(defaultSiteContent);
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [search, setSearch] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [herenciaEnabled, setHerenciaEnabled] = useState(false);
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
    if (location.pathname !== "/productos") return;
    const params = new URLSearchParams(location.search);
    setSearch(params.get("buscar") || "");
  }, [location.pathname, location.search]);

  const market = useMemo(() => getMarketExperience(site), [site]);

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

        <div className="bg-[#173d2a] px-4 py-2 text-center text-[11px] font-bold tracking-wide text-white/90 sm:text-xs">
          {market.announcement}
        </div>

        <header
          className={`z-50 border-b border-[#e8e2d8] bg-[#fffdf9]/95 transition-all duration-300 ${
            site.builder?.headerStyle?.sticky !== false ? "sticky top-0" : "relative"
          } ${isScrolled ? "shadow-[0_10px_30px_rgba(39,61,45,0.08)] backdrop-blur-xl" : ""}`}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex min-h-[76px] items-center gap-5">
              <Link to="/" className="shrink-0">
                <img
                  src={site.brand.logoUrl || logo}
                  alt={site.brand.logoAlt || site.brand.name}
                  className="h-14 w-auto object-contain sm:h-16"
                />
              </Link>

              <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
                {market.navigation.map((item) => (
                  <MarketNavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    active={isPathActive(location.pathname, item.href)}
                  />
                ))}
                {herenciaEnabled ? (
                  <MarketNavLink
                    href={site.navigation.herencia.href || "/herencia"}
                    label={site.navigation.herencia.label || "Herenc(IA)"}
                    active={isPathActive(location.pathname, site.navigation.herencia.href || "/herencia")}
                    icon={<Bot className="h-3.5 w-3.5" />}
                  />
                ) : null}
              </nav>

              <div className="ml-auto flex items-center gap-1.5">
                <form onSubmit={submitSearch} className="relative hidden w-[270px] xl:block">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718076]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar plantas, productos, servicios..."
                    className="h-11 w-full rounded-full border border-[#ded9cd] bg-white pl-10 pr-4 text-sm outline-none transition focus:border-[#315b42] focus:ring-2 focus:ring-[#315b42]/10"
                  />
                </form>

                <button
                  type="button"
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
                </button>

                <Link
                  to={site.headerActions.profileHref || "/perfil"}
                  className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-[#f0eee7]"
                  aria-label="Mi cuenta"
                >
                  <User className="h-5 w-5" />
                </Link>

                <Link
                  to="/perfil"
                  className="relative hidden h-10 w-10 place-items-center rounded-full transition hover:bg-[#f0eee7] sm:grid"
                  aria-label="Favoritos"
                >
                  <Heart className="h-5 w-5" />
                  {wishlistCount > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#c9836b] px-1 text-[9px] font-black text-white">
                      {wishlistCount}
                    </span>
                  ) : null}
                </Link>

                <Link
                  to={site.headerActions.cartHref || "/carrito"}
                  className="relative grid h-10 w-10 place-items-center rounded-full transition hover:bg-[#f0eee7]"
                  aria-label="Carrito"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {cartCount > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#315b42] px-1 text-[9px] font-black text-white">
                      {cartCount}
                    </span>
                  ) : null}
                </Link>
              </div>
            </div>

            <nav className="flex gap-1 overflow-x-auto border-t border-[#eee9df] py-2 lg:hidden">
              {market.navigation.map((item) => (
                <MarketNavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  active={isPathActive(location.pathname, item.href)}
                  mobile
                />
              ))}
              {herenciaEnabled ? (
                <MarketNavLink
                  href={site.navigation.herencia.href || "/herencia"}
                  label={site.navigation.herencia.label || "Herenc(IA)"}
                  active={isPathActive(location.pathname, site.navigation.herencia.href || "/herencia")}
                  mobile
                />
              ) : null}
            </nav>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="min-h-[60vh]">
          <Outlet />
        </main>

        <footer className="border-t border-[#d9ddd6] bg-[#173d2a] text-white">
          <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-10">
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
                title="Tienda"
                links={[
                  { label: "Todos los productos", href: "/productos" },
                  { label: "Plantas y jardín", href: "/productos?categoria=plantas-interior" },
                  { label: "Semillas", href: "/productos?categoria=semillas" },
                  { label: "Dulce", href: "/dulce" },
                  { label: "Moda", href: "/moda" },
                ]}
              />

              <FooterColumn
                title="Servicios"
                links={market.home.services.slice(0, 5).map((item) => ({
                  label: item.title,
                  href: item.href,
                }))}
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

            <div className="mt-10 flex flex-col gap-4 border-t border-white/12 pt-6 text-xs text-white/58 sm:flex-row sm:items-center sm:justify-between">
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

      <SalesChatWidget />
      <WhatsAppButton />
      <AccessibilityPanel />

      {!cookieConsent ? (
        <div className="fixed bottom-4 left-4 right-4 z-[120] mx-auto max-w-3xl rounded-2xl border border-[#ded9cd] bg-[#fffdf9] p-4 text-[#173126] shadow-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <p className="font-black">Privacidad y cookies</p>
              <p className="mt-1 text-sm text-[#6d776f]">
                Herencia usa almacenamiento esencial para carrito, sesión y funcionamiento de la tienda.
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
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {icon}
        {label}
      </a>
    );
  }

  return (
    <Link to={href || "/"} className={className}>
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
      <h4 className="font-black text-white">{title}</h4>
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
