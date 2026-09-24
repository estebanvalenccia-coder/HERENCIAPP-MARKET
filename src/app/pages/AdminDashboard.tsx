import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Package,
  Plus,
  Tag,
  ShoppingBag,
  Image as ImageIcon,
  Settings,
  Lock,
  LogOut,
  Search,
  Bell,
  Menu,
  X,
  Calculator,
  Flower2,
  Sparkles,
  DollarSign,
  Layers3,
  CreditCard,
  Brain,
} from "lucide-react";
import { backendApi, backendStorage } from "../lib/backendStorage";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { AdminProducts } from "../components/admin/AdminProducts";
import { AdminAddProduct } from "../components/admin/AdminAddProduct";
import { AdminBulkProductImport } from "../components/admin/AdminBulkProductImport";
import { AdminOffers } from "../components/admin/AdminOffers";
import { AdminContent } from "../components/admin/AdminContent";
import { AdminSettings } from "../components/admin/AdminSettings";
import { AdminDashboardHome } from "../components/admin/AdminDashboardHome";
import { AdminOrders } from "../components/admin/AdminOrders";
import { AdminSalesCalculator } from "../components/admin/AdminSalesCalculator";
import { AdminFlowerCosts } from "../components/admin/AdminFlowerCosts";
import { AdminAIBouquetDesigner } from "../components/admin/AdminAIBouquetDesigner";
import { AdminFinance } from "../components/admin/AdminFinance";
import { AdminPOS } from "../components/admin/AdminPOS";
import { AdminHerenciaNeural } from "../components/admin/AdminHerenciaNeural";

type AdminSection =
  | "dashboard"
  | "products"
  | "add-product"
  | "bulk-product-import"
  | "pos"
  | "ai-bouquet-designer"
  | "offers"
  | "orders"
  | "finance"
  | "calculator"
  | "flower-costs"
  | "content"
  | "settings"
  | "neural";

type AdminOrderAlert = {
  eventId: string;
  kind: string;
  id: string;
  customerName: string;
  customerEmail?: string;
  total: number;
  status: string;
  items: any[];
  date: string;
  read: boolean;
};

export function AdminDashboard() {
  const navigate = useNavigate();

  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [currentSection, setCurrentSection] =
    useState<AdminSection>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [productsMenuOpen, setProductsMenuOpen] = useState(true);
  const [orderAlerts, setOrderAlerts] = useState<AdminOrderAlert[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const seenOrderEventsRef = useRef(new Set<string>());

  const unreadOrderAlerts = orderAlerts.filter((alert) => !alert.read).length;

  const markOrderAlertsRead = () => {
    setOrderAlerts((current) =>
      current.map((alert) => (alert.read ? alert : { ...alert, read: true }))
    );
  };

  const openOrders = () => {
    markOrderAlertsRead();
    setNotificationsOpen(false);
    setCurrentSection("orders");
    setSidebarOpen(false);
  };

  useEffect(() => {
    if (!backendApi.enabled) {
      setIsAuthenticated(false);
      setIsCheckingSession(false);
      return;
    }

    backendApi
      .adminSession()
      .then(({ authenticated }) => {
        setIsAuthenticated(Boolean(authenticated));
      })
      .catch(() => {
        setIsAuthenticated(false);
      })
      .finally(() => setIsCheckingSession(false));
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !backendApi.enabled) {
      setRealtimeConnected(false);
      return;
    }

    let cancelled = false;
    let eventSource: EventSource | null = null;
    let fallbackTimer: number | undefined;
    const knownOrderIds = new Set<string>();

    const showOrderAlert = (payload: any) => {
      if (!payload?.id) return;

      const eventKey =
        payload.eventId ||
        `${payload.id}:${payload.kind || "order"}:${payload.status || ""}`;

      if (seenOrderEventsRef.current.has(eventKey)) return;
      seenOrderEventsRef.current.add(eventKey);
      knownOrderIds.add(String(payload.id));

      const alert: AdminOrderAlert = {
        eventId: eventKey,
        kind: String(payload.kind || "order_created"),
        id: String(payload.id),
        customerName: String(payload.customerName || "Cliente"),
        customerEmail: payload.customerEmail ? String(payload.customerEmail) : "",
        total: Number(payload.total || 0),
        status: String(payload.status || "pending"),
        items: Array.isArray(payload.items) ? payload.items : [],
        date: String(payload.date || new Date().toISOString()),
        read: false,
      };

      setOrderAlerts((current) => [alert, ...current].slice(0, 20));
      setOrdersRefreshKey((value) => value + 1);
      window.dispatchEvent(new Event("backend-storage"));

      toast.success(
        alert.kind === "order_paid" ? "💳 Nueva venta pagada" : "🛍️ Nuevo pedido recibido",
        {
          description: `${alert.customerName} · €${alert.total.toFixed(2)}`,
          duration: 12000,
          action: {
            label: "Ver pedido",
            onClick: () => {
              setOrderAlerts((current) =>
                current.map((item) => ({ ...item, read: true }))
              );
              setNotificationsOpen(false);
              setCurrentSection("orders");
            },
          },
        }
      );
    };

    const syncOrdersFallback = async (seedOnly = false) => {
      try {
        const { orders } = await backendApi.listOrders();
        const rows = Array.isArray(orders) ? orders : [];

        if (seedOnly) {
          rows.forEach((order: any) => knownOrderIds.add(String(order.id)));
          return;
        }

        const newOrders = rows
          .filter((order: any) => order?.id && !knownOrderIds.has(String(order.id)))
          .reverse();

        for (const order of newOrders) {
          showOrderAlert({
            ...order,
            eventId: `fallback:${order.id}`,
            kind: ["paid", "confirmed", "preparing", "ready", "delivered", "completed"].includes(order.status)
              ? "order_paid"
              : "order_created",
          });
        }
      } catch {
        // EventSource se reconecta solo. El polling es únicamente un respaldo.
      }
    };

    void syncOrdersFallback(true);

    try {
      eventSource = new EventSource("/api/admin/order-events", {
        withCredentials: true,
      });

      eventSource.addEventListener("ready", () => {
        if (!cancelled) setRealtimeConnected(true);
      });

      eventSource.addEventListener("order", (event) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse((event as MessageEvent).data);
          showOrderAlert(payload);
        } catch (error) {
          console.error("No se pudo leer la notificación de pedido", error);
        }
      });

      eventSource.onerror = () => {
        if (!cancelled) setRealtimeConnected(false);
      };
    } catch {
      setRealtimeConnected(false);
    }

    fallbackTimer = window.setInterval(() => {
      void syncOrdersFallback(false);
    }, 15000);

    return () => {
      cancelled = true;
      setRealtimeConnected(false);
      eventSource?.close();
      if (fallbackTimer) window.clearInterval(fallbackTimer);
    };
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!backendApi.enabled) {
      toast.error("Backend no disponible. Configura VITE_API_URL y vuelve a intentar.");
      return;
    }

    try {
      await backendApi.adminLogin(username, password);
      const session = await backendApi.adminSession();

      if (!session.authenticated) {
        toast.error(
          "Sesión no confirmada. Revisa cookies del backend en Railway."
        );
        setIsAuthenticated(false);
        return;
      }

      await backendStorage.refresh();
      setIsAuthenticated(true);
      toast.success("Bienvenido");
    } catch {
      toast.error("Usuario o contraseña incorrectos");
    }
  };

  const handleLogout = async () => {
    await backendApi.adminLogout().catch(() => null);
    setIsAuthenticated(false);
    setUsername("");
    setPassword("");
    toast.success("Sesión cerrada");
    navigate("/");
  };

  const menuItems = [
    { id: "dashboard" as AdminSection, label: "Dashboard", icon: LayoutDashboard },
    { id: "neural" as AdminSection, label: "HERENCIA Neural", icon: Brain, badge: "NEURAL" },
    {
      id: "pos" as AdminSection,
      label: "TPV / Caja",
      icon: CreditCard,
      badge: "CAJA",
    },
    {
      id: "ai-bouquet-designer" as AdminSection,
      label: "Diseñador IA de Ramos",
      icon: Sparkles,
      badge: "NUEVO",
    },
    { id: "offers" as AdminSection, label: "Ofertas", icon: Tag },
    {
      id: "orders" as AdminSection,
      label: "Pedidos",
      icon: ShoppingBag,
      badge: unreadOrderAlerts > 0 ? String(unreadOrderAlerts) : undefined,
    },
    {
      id: "finance" as AdminSection,
      label: "Finanzas",
      icon: DollarSign,
      badge: "PRO",
    },
    { id: "calculator" as AdminSection, label: "Calculadora", icon: Calculator },
    { id: "flower-costs" as AdminSection, label: "Coste flores", icon: Flower2 },
    { id: "content" as AdminSection, label: "Contenido", icon: ImageIcon },
    { id: "settings" as AdminSection, label: "Configuración", icon: Settings },
  ];

  const productMenuItems = [
    { id: "products" as AdminSection, label: "Ver productos", icon: Package },
    { id: "add-product" as AdminSection, label: "Añadir uno", icon: Plus },
    {
      id: "bulk-product-import" as AdminSection,
      label: "Importación masiva IA",
      icon: Layers3,
      badge: "PRO",
    },
  ];

  const sectionLabel =
    [...productMenuItems, ...menuItems].find((item) => item.id === currentSection)
      ?.label || "Dashboard";

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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center justify-center mb-8">
              <div className="bg-gradient-to-br from-primary to-secondary p-5 rounded-2xl shadow-lg">
                <Lock className="w-10 h-10 text-white" />
              </div>
            </div>

            <h2 className="text-3xl font-bold text-foreground text-center mb-2">
              Bienvenido
            </h2>

            <p className="text-muted-foreground text-center mb-8">
              Panel de Administración - Herencia Floristería
            </p>

            {!backendApi.enabled && (
              <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                Backend no disponible. El acceso admin está desactivado hasta configurar VITE_API_URL.
              </div>
            )}

            {backendApi.enabled && (
              <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                Conectado al backend. Ingresa tus credenciales.
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Usuario
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ingresa tu usuario"
                    required
                    disabled={!backendApi.enabled}
                    className="w-full px-4 py-3 bg-background/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingresa tu contraseña"
                    required
                    disabled={!backendApi.enabled}
                    className="w-full px-4 py-3 bg-background/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </>

              <button
                type="submit"
                disabled={!backendApi.enabled}
                className="w-full py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all font-medium"
              >
                {backendApi.enabled ? "Iniciar Sesión" : "Backend no disponible"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground">
                Acceso restringido solo para administradores
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-card to-muted/30 border-r border-border/50 shadow-xl transform transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Admin Panel
                </h1>
                <p className="text-xs text-muted-foreground mt-1">
                  Herencia Floristería
                </p>
              </div>

              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">D</span>
              </div>

              <div>
                <p className="font-semibold text-foreground">Daniel</p>
                <p className="text-xs text-muted-foreground">Administrador</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 mb-2">
              Menú Principal
            </p>

            <div className="rounded-2xl border border-border/50 bg-background/40 overflow-hidden">
              <button
                type="button"
                onClick={() => setProductsMenuOpen((open) => !open)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-all ${
                  productMenuItems.some((item) => item.id === currentSection)
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted/50"
                }`}
              >
                <Package className="w-5 h-5" />
                <span className="font-medium text-left flex-1">Productos</span>
                <ChevronIcon open={productsMenuOpen} />
              </button>

              {productsMenuOpen && (
                <div className="px-2 pb-2 space-y-1">
                  {productMenuItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentSection(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all ${
                        currentSection === item.id
                          ? "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/20"
                          : "text-foreground hover:bg-muted/60"
                      }`}
                    >
                      <item.icon className="w-4 h-4" />
                      <span className="font-medium text-left flex-1">{item.label}</span>
                      {"badge" in item && item.badge && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            currentSection === item.id
                              ? "bg-white/20 text-white"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {menuItems.map((item) => (
              <motion.button
                key={item.id}
                onClick={() => {
                  if (item.id === "orders") {
                    markOrderAlertsRead();
                    setNotificationsOpen(false);
                  }
                  setCurrentSection(item.id);
                  setSidebarOpen(false);
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  currentSection === item.id
                    ? "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/20"
                    : "text-foreground hover:bg-muted/50"
                }`}
              >
                <item.icon className="w-5 h-5" />

                <span className="font-medium text-left flex-1">
                  {item.label}
                </span>

                {"badge" in item && item.badge && (
                  <span
                    className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                      currentSection === item.id
                        ? "bg-white/20 text-white"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                {currentSection === item.id && (
                  <motion.div
                    layoutId="activeSection"
                    className="w-1.5 h-1.5 bg-white rounded-full"
                    initial={false}
                  />
                )}
              </motion.button>
            ))}
          </nav>

          <div className="p-4 border-t border-border/50 bg-gradient-to-r from-destructive/5 to-transparent">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="bg-card/80 backdrop-blur-lg border-b border-border/50 sticky top-0 z-40 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 hover:bg-accent rounded-lg transition-colors"
                >
                  <Menu className="w-5 h-5" />
                </button>

                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-foreground">
                      {sectionLabel}
                    </h2>

                    <span className="hidden sm:inline-flex px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                      v1.1-caja
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Gestiona tu floristería desde aquí
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden md:flex relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

                  <input
                    type="text"
                    placeholder="Buscar..."
                    className="pl-10 pr-4 py-2 bg-muted/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm w-64"
                  />
                </div>

                <div className="relative">
                  <button
                    onClick={() => {
                      setNotificationsOpen((open) => !open);
                      markOrderAlertsRead();
                    }}
                    className="relative p-2 hover:bg-accent rounded-lg transition-colors"
                    title={
                      realtimeConnected
                        ? "Notificaciones de ventas en tiempo real activas"
                        : "Reconectando notificaciones de ventas"
                    }
                  >
                    <Bell className="w-5 h-5 text-foreground" />
                    {unreadOrderAlerts > 0 ? (
                      <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold shadow">
                        {unreadOrderAlerts > 99 ? "99+" : unreadOrderAlerts}
                      </span>
                    ) : (
                      <span
                        className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                          realtimeConnected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                        }`}
                      />
                    )}
                  </button>

                  {notificationsOpen && (
                    <div className="absolute right-0 mt-3 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl z-50">
                      <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <div>
                          <p className="font-bold text-foreground">Ventas y pedidos</p>
                          <p className="text-xs text-muted-foreground">
                            {realtimeConnected ? "Conectado en tiempo real" : "Reconectando…"}
                          </p>
                        </div>
                        <button
                          onClick={openOrders}
                          className="text-xs font-bold text-primary hover:underline"
                        >
                          Ver todos
                        </button>
                      </div>

                      <div className="max-h-96 overflow-y-auto">
                        {orderAlerts.length === 0 ? (
                          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                            No hay ventas nuevas en esta sesión.
                          </div>
                        ) : (
                          orderAlerts.slice(0, 8).map((alert) => (
                            <button
                              key={alert.eventId}
                              onClick={openOrders}
                              className="w-full border-b border-border/60 px-4 py-3 text-left hover:bg-muted/50 last:border-b-0"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-semibold text-foreground truncate">
                                    {alert.kind === "order_paid" ? "Venta pagada" : "Nuevo pedido"} · {alert.customerName}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground truncate">
                                    {alert.items.length
                                      ? alert.items
                                          .slice(0, 2)
                                          .map((item: any) => `${item.name || "Producto"} x${item.quantity || 1}`)
                                          .join(", ")
                                      : alert.customerEmail || "Sin detalle de productos"}
                                  </p>
                                  <p className="mt-1 text-[11px] text-muted-foreground">
                                    {new Date(alert.date).toLocaleString("es-ES")}
                                  </p>
                                </div>
                                <span className="font-black text-primary whitespace-nowrap">
                                  €{alert.total.toFixed(2)}
                                </span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => navigate("/")}
                  className="hidden sm:flex items-center gap-2 px-4 py-2 bg-muted hover:bg-accent rounded-lg transition-colors text-sm font-medium"
                >
                  Ver Sitio
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {currentSection === "dashboard" && (
            <AdminDashboardHome onNavigate={(section) => setCurrentSection(section as AdminSection)} />
          )}

          {currentSection === "products" && (
            <AdminProducts onAddNew={() => setCurrentSection("add-product")} />
          )}

          {currentSection === "add-product" && (
            <AdminAddProduct onBack={() => setCurrentSection("products")} />
          )}

          {currentSection === "bulk-product-import" && (
            <AdminBulkProductImport onBack={() => setCurrentSection("products")} />
          )}

          {currentSection === "pos" && <AdminPOS />}

          {currentSection === "neural" && <AdminHerenciaNeural />}

          {currentSection === "ai-bouquet-designer" && (
            <AdminAIBouquetDesigner />
          )}

          {currentSection === "offers" && <AdminOffers />}

          {currentSection === "orders" && <AdminOrders key={ordersRefreshKey} />}

          {currentSection === "finance" && <AdminFinance />}

          {currentSection === "calculator" && <AdminSalesCalculator />}

          {currentSection === "flower-costs" && <AdminFlowerCosts />}

          {currentSection === "content" && <AdminContent />}

          {currentSection === "settings" && <AdminSettings />}
        </main>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}
