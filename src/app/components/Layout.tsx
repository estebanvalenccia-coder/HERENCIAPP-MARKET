import { Outlet, Link, useLocation } from "react-router";
import {
  ShoppingCart, User, Leaf, Home, Briefcase, Settings, Bot,
  House, Sparkles, Flower, Flower2, LeafyGreen, Package, ShoppingBag,
  Scissors, Store, Building, Brain, Zap, Star
} from "lucide-react";
import { backendStorage } from "../lib/backendStorage";
import { defaultSiteContent, isExternalHref, normalizePhoneForHref, normalizeWhatsAppPhone, parseSiteContent, SiteContent } from "../lib/siteContent";
import { useState, useEffect } from "react";
import { Toaster } from "sonner";
import { ChatboxWidget } from "./ChatboxWidget";
import { WhatsAppButton } from "./WhatsAppButton";
import logo from "figma:asset/8c5f2b4f88c45fd4812e5bb91610bff5272333d7.png";

// Mapeo de iconos
const iconMap: Record<string, any> = {
  Home, House, Sparkles, Flower, Flower2, Leaf, LeafyGreen, Package,
  ShoppingBag, Briefcase, Scissors, Store, Building, Bot, Brain, Zap, Star
};

export function Layout() {
  const location = useLocation();
  const [cartCount, setCartCount] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [herenciaEnabled, setHerenciaEnabled] = useState(false);
  const [site, setSite] = useState<SiteContent>(defaultSiteContent);
  const [menuIcons, setMenuIcons] = useState({
    home: "Home",
    products: "Leaf",
    services: "Briefcase",
    herencia: "Bot",
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Simular contador del carrito
  useEffect(() => {
    const cart = JSON.parse(backendStorage.getItem("cart") || "[]");
    setCartCount(cart.length);
  }, [location]);

  // Cargar configuración de Herenc(IA) e iconos
  useEffect(() => {
    const loadSettings = () => {
      const herenciaSettings = backendStorage.getItem("herenciaSettings");
      if (herenciaSettings) {
        const parsed = JSON.parse(herenciaSettings);
        setHerenciaEnabled(parsed.enabled || false);
      }

      const savedIcons = backendStorage.getItem("menuIcons");
      if (savedIcons) {
        setMenuIcons(JSON.parse(savedIcons));
      }

      setSite(parseSiteContent(backendStorage.getItem("siteContent")));
    };

    loadSettings();
    window.addEventListener("storage", loadSettings);
    window.addEventListener("backend-storage", loadSettings);
    return () => {
      window.removeEventListener("storage", loadSettings);
      window.removeEventListener("backend-storage", loadSettings);
    };
  }, []);

  const isActive = (path: string) => location.pathname === path;

  // Obtener iconos dinámicamente
  const HomeIcon = iconMap[menuIcons.home] || Home;
  const ProductsIcon = iconMap[menuIcons.products] || Leaf;
  const ServicesIcon = iconMap[menuIcons.services] || Briefcase;
  const HerenciaIcon = iconMap[menuIcons.herencia] || Bot;

  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          isScrolled ? "bg-background/80 backdrop-blur-lg border-b border-border shadow-sm" : "bg-background"
        }`}
      >
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center group">
              <img
                src={site.brand.logoUrl || logo}
                alt={site.brand.logoAlt || site.brand.name}
                className="h-12 sm:h-14 w-auto group-hover:scale-105 transition-transform"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              <NavLink to={site.navigation.home.href} icon={HomeIcon} label={site.navigation.home.label} active={isActive(site.navigation.home.href)} />
              <NavLink to={site.navigation.products.href} icon={ProductsIcon} label={site.navigation.products.label} active={isActive(site.navigation.products.href)} />
              <NavLink to={site.navigation.services.href} icon={ServicesIcon} label={site.navigation.services.label} active={isActive(site.navigation.services.href)} />
              {herenciaEnabled && (
                <NavLink to={site.navigation.herencia.href} icon={HerenciaIcon} label={site.navigation.herencia.label} active={isActive(site.navigation.herencia.href)} />
              )}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <ActionLink href={site.headerActions.cartHref} className="relative p-2 rounded-lg hover:bg-accent transition-colors">
                <ShoppingCart className="w-5 h-5 text-foreground" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
                    {cartCount}
                  </span>
                )}
              </ActionLink>
              <ActionLink href={site.headerActions.profileHref} className="p-2 rounded-lg hover:bg-accent transition-colors">
                <User className="w-5 h-5 text-foreground" />
              </ActionLink>
            </div>
          </div>

          {/* Mobile Navigation */}
          <nav className="md:hidden flex items-center gap-1 pb-3 overflow-x-auto">
            <MobileNavLink to={site.navigation.home.href} icon={HomeIcon} label={site.navigation.home.label} active={isActive(site.navigation.home.href)} />
            <MobileNavLink to={site.navigation.products.href} icon={ProductsIcon} label={site.navigation.products.label} active={isActive(site.navigation.products.href)} />
            <MobileNavLink to={site.navigation.services.href} icon={ServicesIcon} label={site.navigation.services.label} active={isActive(site.navigation.services.href)} />
            {herenciaEnabled && (
              <MobileNavLink to={site.navigation.herencia.href} icon={HerenciaIcon} label={site.navigation.herencia.label} active={isActive(site.navigation.herencia.href)} />
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="min-h-[calc(100vh-4rem)]">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-muted border-t border-border mt-20">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="mb-4">
                <img src={site.brand.logoUrl || logo} alt={site.brand.logoAlt || site.brand.name} className="h-16 w-auto" />
              </div>
              <p className="text-sm text-muted-foreground">{site.footer.description}</p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-3">{site.footer.productsTitle}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {site.footer.productLinks.map((item, index) => (
                  <li key={index}><FooterLink href={item.href}>{item.label}</FooterLink></li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-3">{site.footer.servicesTitle}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {site.footer.serviceLinks.map((item, index) => (
                  <li key={index}><FooterLink href={item.href}>{item.label}</FooterLink></li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-3">{site.footer.contactTitle}</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href={`https://wa.me/${normalizeWhatsAppPhone(site.footer.whatsappPhone)}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                    <span>📱</span> {site.footer.whatsappLabel}
                  </a>
                </li>
                <li>
                  <a href={`tel:${normalizePhoneForHref(site.footer.callPhone)}`} className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                    <span>📞</span> {site.footer.callLabel}
                  </a>
                </li>
                <li>
                  <a href={site.footer.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                    <span>📷</span> {site.footer.instagramLabel}
                  </a>
                </li>
                <li>
                  <a href={site.footer.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                    <span>📍</span> {site.footer.mapsLabel}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border mt-8 pt-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {site.footer.copyright} {site.footer.developerLabel ? <>| <span className="font-semibold text-foreground">{site.footer.developerLabel}</span></> : null}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
                <FooterLink href={site.footer.privacyHref}>{site.footer.privacyLabel}</FooterLink>
                <span className="text-muted-foreground/30">•</span>
                <FooterLink href={site.footer.cookiesHref}>{site.footer.cookiesLabel}</FooterLink>
                <span className="text-muted-foreground/30">•</span>
                <FooterLink href={site.footer.termsHref}>{site.footer.termsLabel}</FooterLink>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
    <ChatboxWidget />
    <WhatsAppButton />
    </>
  );
}

function NavLink({ to, icon: Icon, label, active }: { to: string; icon: any; label: string; active: boolean }) {
  const className = `flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
    active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
  }`;
  if (isExternalHref(to)) {
    return <a href={to} className={className} target="_blank" rel="noopener noreferrer"><Icon className="w-4 h-4" /><span className="text-sm font-medium">{label}</span></a>;
  }
  return <Link to={to || "/"} className={className}><Icon className="w-4 h-4" /><span className="text-sm font-medium">{label}</span></Link>;
}

function MobileNavLink({ to, icon: Icon, label, active }: { to: string; icon: any; label: string; active: boolean }) {
  const className = `flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap text-sm ${
    active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
  }`;
  if (isExternalHref(to)) {
    return <a href={to} className={className} target="_blank" rel="noopener noreferrer"><Icon className="w-4 h-4" /><span>{label}</span></a>;
  }
  return <Link to={to || "/"} className={className}><Icon className="w-4 h-4" /><span>{label}</span></Link>;
}

function ActionLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  if (isExternalHref(href)) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
  }
  return <Link to={href || "/"} className={className}>{children}</Link>;
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const className = "hover:text-foreground transition-colors";
  if (isExternalHref(href)) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
  }
  return <Link to={href || "/"} className={className}>{children}</Link>;
}
