import { Package, ShoppingBag, Tag, TrendingUp, ArrowUpRight, Clock, DollarSign, Users } from "lucide-react";
import { motion } from "motion/react";
import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { backendApi, backendStorage } from "../../lib/backendStorage";

interface AdminDashboardHomeProps {
  onNavigate?: (section: string) => void;
}

export function AdminDashboardHome({ onNavigate }: AdminDashboardHomeProps = {}) {
  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    productsOnSale: 0,
    totalOrders: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    const products = JSON.parse(backendStorage.getItem("adminProducts") || "[]");
    const activeProducts = products.filter((p: any) => p.active !== false);
    const productsOnSale = products.filter((p: any) => p.onSale === true);

    backendApi.listOrders()
      .then(({ orders }) => {
        const totalRevenue = orders.reduce((sum: number, order: any) => sum + Number(order.total || 0), 0);
        setStats({
          totalProducts: products.length,
          activeProducts: activeProducts.length,
          productsOnSale: productsOnSale.length,
          totalOrders: orders.length,
          totalRevenue,
        });
      })
      .catch(() => {
        setStats({
          totalProducts: products.length,
          activeProducts: activeProducts.length,
          productsOnSale: productsOnSale.length,
          totalOrders: 0,
          totalRevenue: 0,
        });
      });
  }, []);

  const statsCards = [
    {
      label: "Total Productos",
      value: stats.totalProducts.toString(),
      icon: Package,
      color: "from-primary to-primary/80",
      change: "+12%",
      changePositive: true
    },
    {
      label: "Productos Activos",
      value: stats.activeProducts.toString(),
      icon: ShoppingBag,
      color: "from-[#7fa88f] to-[#2d5f3f]",
      change: "+8%",
      changePositive: true
    },
    {
      label: "En Oferta",
      value: stats.productsOnSale.toString(),
      icon: Tag,
      color: "from-[#c4dfd0] to-[#7fa88f]",
      change: "-3%",
      changePositive: false
    },
    {
      label: "Ingresos Totales",
      value: `€${stats.totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: "from-primary to-secondary",
      change: "+23%",
      changePositive: true
    },
  ];

  const salesData = [
    { name: "Lun", ventas: 120 },
    { name: "Mar", ventas: 190 },
    { name: "Mié", ventas: 150 },
    { name: "Jue", ventas: 280 },
    { name: "Vie", ventas: 320 },
    { name: "Sáb", ventas: 450 },
    { name: "Dom", ventas: 380 },
  ];

  const categoryData = [
    { name: "Flores", value: 35 },
    { name: "Plantas", value: 25 },
    { name: "Orquídeas", value: 20 },
    { name: "Accesorios", value: 20 },
  ];

  const COLORS = ["#2d5f3f", "#7fa88f", "#c4dfd0", "#fdfcfa"];

  const recentActivity = [
    { action: "Nuevo pedido #1234", time: "Hace 5 minutos", type: "order" },
    { action: "Producto agregado: Rosa Premium", time: "Hace 2 horas", type: "product" },
    { action: "Oferta activada: Orquídeas", time: "Hace 4 horas", type: "offer" },
    { action: "Pedido completado #1230", time: "Hace 6 horas", type: "order" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Bienvenido de nuevo, Daniel 👋</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-xl">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-sm text-foreground font-medium">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-card border border-border rounded-2xl p-6 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`bg-gradient-to-br ${stat.color} p-3 rounded-xl shadow-md`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
                stat.changePositive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}>
                <ArrowUpRight className={`w-3 h-3 ${!stat.changePositive && "rotate-90"}`} />
                <span className="text-xs font-semibold">{stat.change}</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground mb-1">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">Ventas de la Semana</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={salesData}>
              <defs>
                <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2d5f3f" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#2d5f3f" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '12px'
                }}
              />
              <Area
                type="monotone"
                dataKey="ventas"
                stroke="#2d5f3f"
                fillOpacity={1}
                fill="url(#colorVentas)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category Distribution */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-6">Distribución por Categoría</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Actividad Reciente</h2>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-4 p-3 bg-muted/50 rounded-xl"
              >
                <div className={`w-2 h-2 rounded-full ${
                  activity.type === "order" ? "bg-primary" :
                  activity.type === "product" ? "bg-secondary" : "bg-accent"
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-white">
          <h2 className="text-lg font-semibold mb-4">Acciones Rápidas</h2>
          <div className="space-y-3">
            <button
              onClick={() => onNavigate?.("add-product")}
              className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl transition-colors text-left font-medium"
            >
              ➕ Añadir Nuevo Producto
            </button>
            <button
              onClick={() => onNavigate?.("orders")}
              className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl transition-colors text-left font-medium"
            >
              📦 Ver Pedidos Pendientes
            </button>
            <button
              onClick={() => onNavigate?.("offers")}
              className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl transition-colors text-left font-medium"
            >
              🏷️ Gestionar Ofertas
            </button>
            <button
              onClick={() => onNavigate?.("settings")}
              className="w-full px-4 py-3 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-xl transition-colors text-left font-medium"
            >
              ⚙️ Configuración General
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
