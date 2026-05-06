import { Package, ShoppingBag, Tag, ArrowUpRight, Clock, DollarSign } from "lucide-react";
import { motion } from "motion/react";
import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { backendApi, backendStorage } from "../../lib/backendStorage";

interface AdminDashboardHomeProps {
  onNavigate?: (section: string) => void;
}

function dayLabel(date: Date) {
  return date.toLocaleDateString("es-ES", { weekday: "short" });
}

function isPaidLike(status: string) {
  return ["paid", "confirmed", "preparing", "ready", "delivered", "completed"].includes(status);
}

export function AdminDashboardHome({ onNavigate }: AdminDashboardHomeProps = {}) {
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    productsOnSale: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    const products = JSON.parse(backendStorage.getItem("adminProducts") || "[]");
    const activeProducts = products.filter((p: any) => p.active !== false);
    const productsOnSale = products.filter((p: any) => p.onSale === true);

    backendApi.listOrders()
      .then(({ orders }) => {
        setOrders(orders);
        const paidOrders = orders.filter((order: any) => isPaidLike(order.status));
        const totalRevenue = paidOrders.reduce((sum: number, order: any) => sum + Number(order.total || 0), 0);
        const pendingOrders = orders.filter((order: any) => !isPaidLike(order.status) && order.status !== "cancelled").length;

        setStats({
          totalProducts: products.length,
          activeProducts: activeProducts.length,
          productsOnSale: productsOnSale.length,
          totalOrders: orders.length,
          pendingOrders,
          totalRevenue,
        });
      })
      .catch(() => {
        setStats({
          totalProducts: products.length,
          activeProducts: activeProducts.length,
          productsOnSale: productsOnSale.length,
          totalOrders: 0,
          pendingOrders: 0,
          totalRevenue: 0,
        });
      });
  }, []);

  const statsCards = [
    { label: "Total Productos", value: stats.totalProducts.toString(), icon: Package, color: "from-primary to-primary/80" },
    { label: "Productos Activos", value: stats.activeProducts.toString(), icon: ShoppingBag, color: "from-[#7fa88f] to-[#2d5f3f]" },
    { label: "Pedidos Pendientes", value: stats.pendingOrders.toString(), icon: Tag, color: "from-[#c4dfd0] to-[#7fa88f]" },
    { label: "Ingresos Pagados", value: `€${stats.totalRevenue.toFixed(2)}`, icon: DollarSign, color: "from-primary to-secondary" },
  ];

  const last7Days = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const dateKey = date.toISOString().slice(0, 10);
    const ventas = orders
      .filter((order) => isPaidLike(order.status))
      .filter((order) => new Date(order.date).toISOString().slice(0, 10) === dateKey)
      .reduce((sum, order) => sum + Number(order.total || 0), 0);
    return { name: dayLabel(date), ventas };
  });

  const categoryMap = new Map<string, number>();
  orders.forEach((order) => {
    (order.items || []).forEach((item: any) => {
      const category = item.category || item.type || "Productos";
      categoryMap.set(category, (categoryMap.get(category) || 0) + Number(item.quantity || 1));
    });
  });
  const categoryData = Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
  const safeCategoryData = categoryData.length ? categoryData : [{ name: "Sin ventas", value: 1 }];
  const COLORS = ["#2d5f3f", "#7fa88f", "#c4dfd0", "#f0f4ef", "#b7d7c2"];

  const recentActivity = orders.slice(0, 5).map((order) => ({
    action: `Pedido ${order.status === "paid" ? "pagado" : "recibido"} #${String(order.id).slice(0, 8)}`,
    time: new Date(order.date).toLocaleString("es-ES"),
    type: "order",
    total: Number(order.total || 0),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard real</h1>
          <p className="text-muted-foreground">Ventas, pedidos y productos conectados al backend</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-xl">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-sm text-foreground font-medium">{new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => (
          <motion.div key={index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }} className="bg-card border border-border rounded-2xl p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`bg-gradient-to-br ${stat.color} p-3 rounded-xl shadow-md`}><stat.icon className="w-6 h-6 text-white" /></div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-100 text-green-700"><ArrowUpRight className="w-3 h-3" /><span className="text-xs font-semibold">Real</span></div>
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">Ventas reales últimos 7 días</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={last7Days}>
              <defs><linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2d5f3f" stopOpacity={0.8}/><stop offset="95%" stopColor="#2d5f3f" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip formatter={(value: any) => [`€${Number(value).toFixed(2)}`, "Ventas"]} />
              <Area type="monotone" dataKey="ventas" stroke="#2d5f3f" fillOpacity={1} fill="url(#colorVentas)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">Productos vendidos</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={safeCategoryData} cx="50%" cy="50%" labelLine={false} outerRadius={80} fill="#8884d8" dataKey="value">
                {safeCategoryData.map((_entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Actividad reciente real</h2>
          <div className="space-y-4">
            {recentActivity.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay pedidos reales.</p> : recentActivity.map((activity, index) => (
              <motion.div key={index} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.06 }} className="flex items-center gap-4 p-3 bg-muted/50 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <div className="flex-1"><p className="text-sm font-medium text-foreground">{activity.action} · €{activity.total.toFixed(2)}</p><p className="text-xs text-muted-foreground">{activity.time}</p></div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-white">
          <h2 className="text-lg font-semibold mb-4">Acciones rápidas</h2>
          <div className="space-y-3">
            <button onClick={() => onNavigate?.("orders")} className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl transition-colors text-left font-medium">📦 Ver pedidos reales</button>
            <button onClick={() => onNavigate?.("add-product")} className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl transition-colors text-left font-medium">➕ Añadir producto</button>
            <button onClick={() => onNavigate?.("offers")} className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl transition-colors text-left font-medium">🏷️ Gestionar ofertas</button>
            <button onClick={() => onNavigate?.("settings")} className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl transition-colors text-left font-medium">⚙️ Configuración</button>
          </div>
        </div>
      </div>
    </div>
  );
}
