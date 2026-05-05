import { useState, useEffect } from "react";
import { User, Mail, Phone, MapPin, Package, Settings, LogOut, Bell } from "lucide-react";
import { motion } from "motion/react";
import { useNavigate, Link } from "react-router";
import { toast } from "sonner";
import { backendStorage } from "../lib/backendStorage";

export function Profile() {
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = backendStorage.getItem("user");
    if (!storedUser) {
      navigate("/login");
    } else {
      setUser(JSON.parse(storedUser));
      // Mock orders
      setOrders([
        {
          id: "ORD-001",
          date: "2026-04-08",
          total: 127.50,
          status: "Entregado",
          items: 3,
        },
        {
          id: "ORD-002",
          date: "2026-04-05",
          total: 85.00,
          status: "En camino",
          items: 2,
        },
        {
          id: "ORD-003",
          date: "2026-03-28",
          total: 220.00,
          status: "Entregado",
          items: 5,
        },
      ]);
    }
  }, [navigate]);

  const handleLogout = () => {
    backendStorage.removeItem("user");
    toast.success("Sesión cerrada");
    navigate("/login");
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border-b border-border">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-start sm:items-center gap-6"
          >
            <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center">
              <User className="w-10 h-10 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {user.name || "Usuario"}
              </h1>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Cerrar sesión
            </button>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
              <div>
                <h2 className="font-semibold text-foreground mb-4">Información Personal</h2>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">{user.email}</span>
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground">{user.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">No registrada</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="font-semibold text-foreground mb-3">Configuración</h3>
                <div className="space-y-2">
                  <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent rounded-xl transition-colors">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">Editar perfil</span>
                  </button>
                  <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent rounded-xl transition-colors">
                    <Bell className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">Notificaciones</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-card border border-border rounded-2xl p-6"
              >
                <Package className="w-8 h-8 text-primary mb-3" />
                <div className="text-3xl font-bold text-foreground mb-1">{orders.length}</div>
                <div className="text-sm text-muted-foreground">Pedidos totales</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-card border border-border rounded-2xl p-6"
              >
                <Package className="w-8 h-8 text-secondary mb-3" />
                <div className="text-3xl font-bold text-foreground mb-1">
                  {orders.filter(o => o.status === "En camino").length}
                </div>
                <div className="text-sm text-muted-foreground">En camino</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-card border border-border rounded-2xl p-6"
              >
                <Bell className="w-8 h-8 text-primary mb-3" />
                <div className="text-3xl font-bold text-foreground mb-1">2</div>
                <div className="text-sm text-muted-foreground">Notificaciones</div>
              </motion.div>
            </div>

            {/* Orders */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-xl font-bold text-foreground mb-6">Historial de Pedidos</h2>
              <div className="space-y-4">
                {orders.map((order, index) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-muted/30 rounded-xl"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-foreground">{order.id}</span>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            order.status === "Entregado"
                              ? "bg-primary/10 text-primary"
                              : "bg-secondary/10 text-secondary"
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{order.date}</span>
                        <span>{order.items} productos</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold text-foreground">
                        ${(order.total || 0).toFixed(2)}
                      </span>
                      <button className="px-4 py-2 bg-background border border-border rounded-lg hover:bg-accent transition-colors">
                        Ver detalles
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="text-xl font-bold text-foreground mb-6">Notificaciones Recientes</h2>
              <div className="space-y-3">
                <div className="flex gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                  <Bell className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground mb-1">Nueva oferta disponible</p>
                    <p className="text-sm text-muted-foreground">
                      20% de descuento en todas las orquídeas este fin de semana
                    </p>
                    <span className="text-xs text-muted-foreground">Hace 2 horas</span>
                  </div>
                </div>
                <div className="flex gap-3 p-4 bg-muted/30 rounded-xl">
                  <Package className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground mb-1">Pedido en camino</p>
                    <p className="text-sm text-muted-foreground">
                      Tu pedido ORD-002 llegará mañana
                    </p>
                    <span className="text-xs text-muted-foreground">Hace 1 día</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
