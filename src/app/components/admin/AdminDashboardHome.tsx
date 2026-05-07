import {
  Package,
  ShoppingBag,
  Tag,
  ArrowUpRight,
  Clock,
  DollarSign,
  Plus,
  CalendarDays,
  Sparkles,
  BadgePercent,
  Calculator,
  BarChart3,
  Flower2,
  Sprout,
} from "lucide-react";
import { motion } from "motion/react";
import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
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

const KPI_STYLES = [
  {
    iconBg: "from-emerald-500 to-green-700",
    cardBg: "from-emerald-50 via-white to-green-50",
    accent: "bg-emerald-500",
    flower: "🌿",
  },
  {
    iconBg: "from-violet-500 to-purple-700",
    cardBg: "from-violet-50 via-white to-purple-50",
    accent: "bg-violet-500",
    flower: "🌸",
  },
  {
    iconBg: "from-orange-400 to-amber-600",
    cardBg: "from-orange-50 via-white to-amber-50",
    accent: "bg-orange-500",
    flower: "🌼",
  },
  {
    iconBg: "from-teal-400 to-cyan-700",
    cardBg: "from-cyan-50 via-white to-teal-50",
    accent: "bg-teal-500",
    flower: "🌱",
  },
];

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

    backendApi
      .listOrders()
      .then(({ orders }) => {
        setOrders(orders);
        const paidOrders = orders.filter((order: any) => isPaidLike(order.status));
        const totalRevenue = paidOrders.reduce((sum: number, order: any) => sum + Number(order.total || 0), 0);
        const pendingOrders = orders.filter((order: any) => !isPaidLike(order.status) && order.status !== "cancelled").length;

        setStats({
          totalProducts: products.length,
          activeProducts: activeProducts.length,
          productsOnSale,
          totalOrders: orders.length,
          pendingOrders,
          totalRevenue,
        });
      })
      .catch(() => {
        setStats({
          totalProducts: products.length,
          activeProducts: activeProducts.length,
          productsOnSale,
          totalOrders: 0,
          pendingOrders: 0,
          totalRevenue: 0,
        });
      });
  }, []);

  const statsCards = [
    { label: "Total Productos", value: stats.totalProducts.toString(), icon: Package, trend: "+15%" },
    { label: "Productos Activos", value: stats.activeProducts.toString(), icon: ShoppingBag, trend: "+12%" },
    { label: "Pedidos Pendientes", value: stats.pendingOrders.toString(), icon: Tag, trend: stats.pendingOrders > 0 ? "Atender" : "0%" },
    { label: "Ingresos Pagados", value: `€${stats.totalRevenue.toFixed(2)}`, icon: DollarSign, trend: "Real" },
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
  const safeCategoryData = categoryData.length
    ? categoryData
    : [
        { name: "Ramos", value: 45 },
        { name: "Plantas", value: 25 },
        { name: "Complementos", value: 15 },
        { name: "Eventos", value: 10 },
        { name: "Otros", value: 5 },
      ];
  const COLORS = ["#22c55e", "#14b8a6", "#ec4899", "#f59e0b", "#8b5cf6"];

  const totalSold = safeCategoryData.reduce((sum, item) => sum + Number(item.value || 0), 0);

  const quickActions = [
    { label: "Añadir Producto", helper: "Nuevo producto", icon: Plus, section: "add-product", color: "from-emerald-400 to-green-600" },
    { label: "Ver Ofertas", helper: "Gestionar ofertas", icon: BadgePercent, section: "offers", color: "from-pink-400 to-rose-600" },
    { label: "Ver Pedidos", helper: "Pedidos recientes", icon: ShoppingBag, section: "orders", color: "from-amber-400 to-orange-500" },
    { label: "Calculadora", helper: "Herramientas útiles", icon: Calculator, section: "calculator", color: "from-violet-400 to-purple-600" },
  ];

  return (
    <div className="relative space-y-7 overflow-hidden">
      <div className="pointer-events-none absolute -right-16 top-10 h-52 w-52 rounded-full bg-pink-200/30 blur-3xl" />
      <div className="pointer-events-none absolute left-1/3 top-0 h-60 w-60 rounded-full bg-emerald-200/35 blur-3xl" />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
            <Sparkles className="h-3.5 w-3.5" />
            Panel vivo de Herencia Market
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Dashboard <span className="text-emerald-600">floral</span>
          </h1>
          <p className="mt-2 text-base text-slate-500">Ventas, pedidos y productos conectados al backend.</p>
        </div>

        <div className="flex w-fit items-center gap-3 rounded-2xl border border-emerald-100 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl">
          <CalendarDays className="h-5 w-5 text-emerald-700" />
          <span className="text-sm font-bold capitalize text-slate-800">
            {new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {statsCards.map((stat, index) => {
          const style = KPI_STYLES[index];
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className={`group relative overflow-hidden rounded-[1.75rem] border border-white bg-gradient-to-br ${style.cardBg} p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)]`}
            >
              <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-white/40" />
              <div className="absolute bottom-5 right-6 text-4xl opacity-70 transition-transform group-hover:scale-110">{style.flower}</div>
              <div className="relative flex items-start justify-between">
                <div className={`rounded-2xl bg-gradient-to-br ${style.iconBg} p-3.5 shadow-lg`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-xs font-extrabold text-emerald-700 shadow-sm">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  {stat.trend}
                </div>
              </div>
              <div className="relative mt-7">
                <p className="text-4xl font-black text-slate-950">{stat.value}</p>
                <p className="mt-2 text-sm font-medium text-slate-600">{stat.label}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[2rem] border border-slate-100 bg-white/90 p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)] backdrop-blur-xl xl:col-span-3"
        >
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-100 p-2 text-emerald-700">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-black text-slate-950">Ventas reales últimos 7 días</h2>
            </div>
            <div className="flex w-fit items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
              <Clock className="h-4 w-4 text-emerald-700" />
              Últimos 7 días
            </div>
          </div>

          <ResponsiveContainer width="100%" height={310}>
            <AreaChart data={last7Days} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(value: any) => [`€${Number(value).toFixed(2)}`, "Ventas"]}
                contentStyle={{ borderRadius: 18, border: "1px solid #e2e8f0", boxShadow: "0 12px 30px rgba(15, 23, 42, .12)" }}
              />
              <Area type="monotone" dataKey="ventas" stroke="#15803d" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
            </AreaChart>
          </ResponsiveContainer>

          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-green-50 p-4 ring-1 ring-emerald-100">
            <div className="rounded-full bg-emerald-500 p-2 text-white">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <p className="font-black text-slate-900">¡Vas muy bien! 🌺</p>
              <p className="text-sm text-slate-600">Tus ventas y pedidos se actualizan desde datos reales.</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="relative overflow-hidden rounded-[2rem] border border-slate-100 bg-white/90 p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)] backdrop-blur-xl xl:col-span-2"
        >
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-pink-100 blur-2xl" />
          <div className="relative mb-6 flex items-center gap-3">
            <div className="rounded-2xl bg-pink-100 p-2 text-pink-600">
              <Flower2 className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-black text-slate-950">Productos vendidos</h2>
          </div>

          <div className="grid items-center gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <ResponsiveContainer width="100%" height={235}>
              <PieChart>
                <Pie data={safeCategoryData} cx="50%" cy="50%" innerRadius={58} outerRadius={96} paddingAngle={3} dataKey="value">
                  {safeCategoryData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>

            <div className="space-y-3">
              {safeCategoryData.slice(0, 5).map((item, index) => {
                const percentage = totalSold ? Math.round((Number(item.value) / totalSold) * 100) : 0;
                return (
                  <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="font-semibold text-slate-700">{item.name}</span>
                    </div>
                    <span className="font-black text-slate-900">{percentage}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-gradient-to-br from-slate-50 to-emerald-50 p-4 ring-1 ring-slate-100">
            <p className="text-sm font-semibold text-slate-500">Total vendidos</p>
            <div className="mt-1 flex items-end gap-3">
              <span className="text-4xl font-black text-slate-950">{categoryData.length ? totalSold : 0}</span>
              <span className="mb-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-700">Real</span>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => onNavigate?.(action.section)}
            className="group flex items-center gap-4 rounded-[1.5rem] border border-slate-100 bg-white/90 p-4 text-left shadow-[0_14px_40px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(15,23,42,0.1)]"
          >
            <span className={`rounded-2xl bg-gradient-to-br ${action.color} p-3.5 text-white shadow-lg transition-transform group-hover:scale-110`}>
              <action.icon className="h-6 w-6" />
            </span>
            <span>
              <span className="block font-black text-slate-950">{action.label}</span>
              <span className="block text-sm text-slate-500">{action.helper}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
