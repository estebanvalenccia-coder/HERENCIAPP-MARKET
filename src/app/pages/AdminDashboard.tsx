import { useState, useEffect } from "react";
import {
  LayoutDashboard, Package, Plus, Tag, ShoppingBag,
  Image as ImageIcon, Settings, Lock, LogOut,
  Search, Bell, Menu, X, Calculator, Flower2, Sparkles
} from "lucide-react";
import { backendApi, backendStorage } from "../lib/backendStorage";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { AdminProducts } from "../components/admin/AdminProducts";
import { AdminAddProduct } from "../components/admin/AdminAddProduct";
import { AdminOffers } from "../components/admin/AdminOffers";
import { AdminContent } from "../components/admin/AdminContent";
import { AdminSettings } from "../components/admin/AdminSettings";
import { AdminDashboardHome } from "../components/admin/AdminDashboardHome";
import { AdminOrders } from "../components/admin/AdminOrders";
import { AdminSalesCalculator } from "../components/admin/AdminSalesCalculator";
import { AdminFlowerCosts } from "../components/admin/AdminFlowerCosts";
import { AdminAIBouquetDesigner } from "../components/admin/AdminAIBouquetDesigner";

type AdminSection = "dashboard" | "products" | "add-product" | "ai-bouquet-designer" | "offers" | "orders" | "calculator" | "flower-costs" | "content" | "settings";

export function AdminDashboard() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(() => !backendApi.enabled && backendStorage.getItem("adminLocalSession") === "true");
  const [isCheckingSession, setIsCheckingSession] = useState(backendApi.enabled);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [currentSection, setCurrentSection] = useState<AdminSection>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!backendApi.enabled) {
      setIsAuthenticated(backendStorage.getItem("adminLocalSession") === "true");
      setIsCheckingSession(false);
      return;
    }

    backendApi.adminSession()
      .then(({ authenticated }) => {
        backendStorage.removeItem("adminLocalSession");
        setIsAuthenticated(Boolean(authenticated));
      })
      .catch(() => {
        backendStorage.removeItem("adminLocalSession");
        setIsAuthenticated(false);
      })
      .finally(() => setIsCheckingSession(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!backendApi.enabled) {
      backendStorage.setItem("adminLocalSession", "true");
      setIsAuthenticated(true);
      toast.success("Bienvenido al panel local");
      return;
    }

    try {
      await backendApi.adminLogin(username, password);
      const session = await backendApi.adminSession();

      if (!session.authenticated) {
        toast.error("Sesión no confirmada. Revisa cookies del backend en Railway.");
        setIsAuthenticated(false);
        return;
      }

      backendStorage.removeItem("adminLocalSession");
      await backendStorage.refresh();
      setIsAuthenticated(true);
      toast.success("Bienvenido");
    } catch {
      toast.error("Usuario o contraseña incorrectos");
    }
  };

  const handleLogout = async () => {
    await backendApi.adminLogout().catch(() => null);
    backendStorage.removeItem("adminLocalSession");
    setIsAuthenticated(false);
    setUsername("");
    setPassword("");
    toast.success("Sesión cerrada");
    navigate("/");
  };

  const menuItems = [
    { id: "dashboard" as AdminSection, label: "Dashboard", icon: LayoutDashboard },
    { id: "products" as AdminSection, label: "Productos", icon: Package },
    { id: "add-product" as AdminSection, label: "Añadir Producto", icon: Plus },
    { id: "ai-bouquet-designer" as AdminSection, label: "Diseñador IA de Ramos", icon: Sparkles, badge: "NUEVO" },
    { id: "offers" as AdminSection, label: "Ofertas", icon: Tag },
    { id: "orders" as AdminSection, label: "Pedidos", icon: ShoppingBag },
    { id: "calculator" as AdminSection, label: "Calculadora", icon: Calculator },
    { id: "flower-costs" as AdminSection, label: "Coste flores", icon: Flower2 },
    { id: "content" as AdminSection, label: "Contenido", icon: ImageIcon },
    { id: "settings" as AdminSection, label: "Configuración", icon: Settings },
  ];

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando panel...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 px-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/10 rounded-full blur-3xl" />
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center justify-center mb-8">
              <div className="bg-gradient-to-br from-primary to-secondary p-5 rounded-2xl shadow-lg">
                <Lock className="w-10 h-10 text-white" />
              </div>
            </div>

            <h2 className="text-3xl font-bold text-foreground text-center mb-2">Bienvenido</h2>
            <p className="text-muted-foreground text-center mb-8">Panel de Administración - Herencia Floristería</p>

            {!backendApi.enabled && (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Backend no conectado. Puedes entrar en modo local para editar contenido guardado en este navegador.
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Usuario</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={backendApi.enabled ? "Ingresa tu usuario" : "Modo local"} required={backendApi.enabled} className="w-full px-4 py-3 bg-background/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all" />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Contraseña</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={backendApi.enabled ? "Ingresa tu contraseña" : "Modo local"} required={backendApi.enabled} className="w-full px-4 py-3 bg-background/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all" />
              </div>

              <button type="submit" className="w-full py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all font-medium">
                {backendApi.enabled ? "Iniciar Sesión" : "Entrar al Panel"}
              </button>
            </form>

            <div className="mt-6 text-center"><p className="text-xs text-muted-foreground">Acceso restringido solo para administradores</p></div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-card to-muted/30 border-r border-border/50 shadow-xl transform transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center justify-between">
              <div><h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Admin Panel</h1><p className="text-xs text-muted-foreground mt-1">Herencia Floristería</p></div>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 hover:bg-accent rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
          </div>

          <div className="p-6 border-b border-border/50">
            <div className="flex items-center gap-3"><div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-lg"><span className="text-white font-bold text-lg">D</span></div><div><p className="font-semibold text-foreground">Daniel</p><p className="text-xs text-muted-foreground">Administrador</p></div></div>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 mb-2">Menú Principal</p>
            {menuItems.map((item) => (
              <motion.button key={item.id} onClick={() => { setCurrentSection(item.id); setSidebarOpen(false); }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${currentSection === item.id ? "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/20" : "text-foreground hover:bg-muted/50"}`}>
                <item.icon className="w-5 h-5" />
                <span className="font-medium text-left flex-1">{item.label}</span>
                {"badge" in item && item.badge && <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${currentSection === item.id ? "bg-white/20 text-white" : "bg-primary/10 text-primary"}`}>{item.badge}</span>}
                {currentSection === item.id && <motion.div layoutId="activeSection" className="w-1.5 h-1.5 bg-white rounded-full" initial={false} />}
              </motion.button>
            ))}
          </nav>

          <div className="p-4 border-t border-border/50 bg-gradient-to-r from-destructive/5 to-transparent"><button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-destructive hover:bg-destructive/10 rounded-xl transition-colors"><LogOut className="w-5 h-5" /><span className="font-medium">Cerrar Sesión</span></button></div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="bg-card/80 backdrop-blur-lg border-b border-border/50 sticky top-0 z-40 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-accent rounded-lg transition-colors"><Menu className="w-5 h-5" /></button>
                <div><div className="flex items-center gap-3"><h2 className="text-xl font-bold text-foreground">{menuItems.find(item => item.id === currentSection)?.label || "Dashboard"}</h2><span className="hidden sm:inline-flex px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">v1.0</span></div><p className="text-sm text-muted-foreground">Gestiona tu floristería desde aquí</p></div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden md:flex relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input type="text" placeholder="Buscar..." className="pl-10 pr-4 py-2 bg-muted/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm w-64" /></div>
                <button className="relative p-2 hover:bg-accent rounded-lg transition-colors"><Bell className="w-5 h-5 text-foreground" /><span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse" /></button>
                <button onClick={() => navigate("/")} className="hidden sm:flex items-center gap-2 px-4 py-2 bg-muted hover:bg-accent rounded-lg transition-colors text-sm font-medium">Ver Sitio</button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {currentSection === "dashboard" && <AdminDashboardHome onNavigate={setCurrentSection} />}
          {currentSection === "products" && <AdminProducts onAddNew={() => setCurrentSection("add-product")} />}
          {currentSection === "add-product" && <AdminAddProduct onBack={() => setCurrentSection("products")} />}
          {currentSection === "ai-bouquet-designer" && <AdminAIBouquetDesigner />}
          {currentSection === "offers" && <AdminOffers />}
          {currentSection === "orders" && <AdminOrders />}
          {currentSection === "calculator" && <AdminSalesCalculator />}
          {currentSection === "flower-costs" && <AdminFlowerCosts />}
          {currentSection === "content" && <AdminContent />}
          {currentSection === "settings" && <AdminSettings />}
        </main>
      </div>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
    </div>
  );
}
