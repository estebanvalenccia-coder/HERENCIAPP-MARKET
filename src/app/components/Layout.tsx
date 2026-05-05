import { Outlet, Link, useLocation } from "react-router";
import {
  ShoppingCart, User, Leaf, Home, Briefcase, Settings, Bot,
  House, Sparkles, Flower, Flower2, LeafyGreen, Package, ShoppingBag,
  Scissors, Store, Building, Brain, Zap, Star
} from "lucide-react";
import { backendStorage } from "../lib/backendStorage";
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
    };

    loadSettings();
    window.addEventListener("storage", loadSettings);
    return () => window.removeEventListener("storage", loadSettings);
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
                src={logo}
                alt="Herencia Floristería"
                className="h-12 sm:h-14 w-auto group-hover:scale-105 transition-transform"
              />
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              <NavLink to="/" icon={HomeIcon} label="Inicio" active={isActive("/")} />
              <NavLink to="/productos" icon={ProductsIcon} label="Productos" active={isActive("/productos")} />
              <NavLink to="/servicios" icon={ServicesIcon} label="Servicios" active={isActive("/servicios")} />
              {herenciaEnabled && (
                <NavLink to="/herencia" icon={HerenciaIcon} label="Herenc(IA)" active={isActive("/herencia")} />
              )}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Link
                to="/carrito"
                className="relative p-2 rounded-lg hover:bg-accent transition-colors"
              >
                <ShoppingCart className="w-5 h-5 text-foreground" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
                    {cartCount}
                  </span>
                )}
              </Link>
              <Link
                to="/perfil"
                className="p-2 rounded-lg hover:bg-accent transition-colors"
              >
                <User className="w-5 h-5 text-foreground" />
              </Link>
            </div>
          </div>

          {/* Mobile Navigation */}
          <nav className="md:hidden flex items-center gap-1 pb-3 overflow-x-auto">
            <MobileNavLink to="/" icon={HomeIcon} label="Inicio" active={isActive("/")} />
            <MobileNavLink to="/productos" icon={ProductsIcon} label="Productos" active={isActive("/productos")} />
            <MobileNavLink to="/servicios" icon={ServicesIcon} label="Servicios" active={isActive("/servicios")} />
            {herenciaEnabled && (
              <MobileNavLink to="/herencia" icon={HerenciaIcon} label="Herenc(IA)" active={isActive("/herencia")} />
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
                <img
                  src={logo}
                  alt="Herencia Floristería"
                  className="h-16 w-auto"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Flores, plantas y servicios de jardinería con elegancia natural.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-3">Productos</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link to="/productos?categoria=flores" className="hover:text-foreground transition-colors">
                    Flores
                  </Link>
                </li>
                <li>
                  <Link to="/productos?categoria=plantas-interior" className="hover:text-foreground transition-colors">
                    Plantas de interior
                  </Link>
                </li>
                <li>
                  <Link to="/productos?categoria=plantas-exterior" className="hover:text-foreground transition-colors">
                    Plantas de exterior
                  </Link>
                </li>
                <li>
                  <Link to="/productos?categoria=orquideas" className="hover:text-foreground transition-colors">
                    Orquídeas
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-3">Servicios</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link to="/servicios?tipo=jardineria" className="hover:text-foreground transition-colors">
                    Jardinería
                  </Link>
                </li>
                <li>
                  <Link to="/servicios?tipo=cursos" className="hover:text-foreground transition-colors">
                    Cursos
                  </Link>
                </li>
                <li>
                  <Link to="/servicios?tipo=entrega" className="hover:text-foreground transition-colors">
                    Entrega a domicilio
                  </Link>
                </li>
                <li>
                  <Link to="/servicios?tipo=asesoria" className="hover:text-foreground transition-colors">
                    Asesoría
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-3">Contacto</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="https://wa.me/34624239598" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                    <span>📱</span> WhatsApp: +34 624 23 95 98
                  </a>
                </li>
                <li>
                  <a href="tel:+34624239598" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                    <span>📞</span> Llamar
                  </a>
                </li>
                <li>
                  <a href="https://instagram.com/floristeriaherencia" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                    <span>📷</span> @floristeriaherencia
                  </a>
                </li>
                <li>
                  <a href="https://maps.app.goo.gl/WLihx3aD1Xhqc9WT8" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                    <span>📍</span> Cómo llegar
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border mt-8 pt-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                © 2026 Herencia Floristería. Todos los derechos reservados. | Desarrollado por <span className="font-semibold text-foreground">DEVB</span>
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
                <Link
                  to="/privacidad"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Política de Privacidad
                </Link>
                <span className="text-muted-foreground/30">•</span>
                <Link
                  to="/cookies"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Política de Cookies
                </Link>
                <span className="text-muted-foreground/30">•</span>
                <Link
                  to="/terminos"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Términos y Condiciones
                </Link>
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
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
        active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

function MobileNavLink({ to, icon: Icon, label, active }: { to: string; icon: any; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap text-sm ${
        active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </Link>
  );
}
