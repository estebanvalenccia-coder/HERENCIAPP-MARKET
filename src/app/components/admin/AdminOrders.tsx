import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Package, Eye, Truck, CheckCircle, Clock, Search, Filter, Download, Phone, MapPin, Mail, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  items: any[];
  total: number;
  paymentMethod: string;
  deliveryMethod?: string;
  status: string;
  date: string;
  metadata?: any;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  payment_pending: { label: "Pago pendiente", color: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
  pending: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock },
  pending_bizum_review: { label: "Revisar Bizum", color: "bg-purple-100 text-purple-800 border-purple-200", icon: Clock },
  pending_manual_review: { label: "Revisión manual", color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock },
  pending_transfer_review: { label: "Revisar transferencia", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Clock },
  pending_store_confirmation: { label: "Confirmar en tienda", color: "bg-orange-100 text-orange-800 border-orange-200", icon: Clock },
  paid: { label: "Pagado", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
  confirmed: { label: "Confirmado", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle },
  preparing: { label: "Preparando", color: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: Package },
  ready: { label: "Listo", color: "bg-teal-100 text-teal-800 border-teal-200", icon: CheckCircle },
  processing: { label: "En proceso", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Truck },
  delivered: { label: "Entregado", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
  completed: { label: "Completado", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
  cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800 border-red-200", icon: Package },
};

function getStatus(order: Order) {
  return statusConfig[order.status] || statusConfig.pending;
}

function getPhone(order: Order) {
  return order.metadata?.phone || "No indicado";
}

function getAddress(order: Order) {
  const address = order.metadata?.shippingAddress || {};
  if (order.deliveryMethod === "recoger") return "Recogida en tienda";
  return [address.address, `${address.postalCode || ""} ${address.city || ""}`.trim(), address.province]
    .filter(Boolean)
    .join(" · ") || "Dirección no indicada";
}

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const loadOrders = () => {
    backendApi.listOrders()
      .then(({ orders }) => setOrders(orders))
      .catch((error) => {
        console.error("No se pudieron cargar los pedidos", error);
        toast.error("No se pudieron cargar los pedidos desde backend");
      });
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await backendApi.updateOrderStatus(orderId, newStatus);
      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status: newStatus } : order));
      toast.success("Estado del pedido actualizado");
    } catch (error) {
      console.error("No se pudo actualizar el pedido", error);
      toast.error("No se pudo actualizar el pedido");
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesFilter = filter === "all" || order.status === filter;
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      order.id.toLowerCase().includes(q) ||
      order.customerName.toLowerCase().includes(q) ||
      order.customerEmail.toLowerCase().includes(q) ||
      getPhone(order).toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const orderStats = {
    total: orders.length,
    pending: orders.filter((o) => ["pending", "payment_pending", "pending_bizum_review", "pending_manual_review", "pending_transfer_review", "pending_store_confirmation"].includes(o.status)).length,
    paid: orders.filter((o) => ["paid", "confirmed", "preparing", "ready"].includes(o.status)).length,
    completed: orders.filter((o) => ["completed", "delivered"].includes(o.status)).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Pedidos reales</h2>
          <p className="text-muted-foreground">Aquí aparecen las compras reales para preparar y entregar</p>
        </div>
        <button onClick={loadOrders} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors">
          <Download className="w-4 h-4" />
          Actualizar pedidos
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4"><p className="text-2xl font-bold">{orderStats.total}</p><p className="text-sm text-muted-foreground">Total</p></div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4"><p className="text-2xl font-bold text-yellow-700">{orderStats.pending}</p><p className="text-sm text-yellow-700">Pendientes</p></div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4"><p className="text-2xl font-bold text-green-700">{orderStats.paid}</p><p className="text-sm text-green-700">Pagados/confirmados</p></div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4"><p className="text-2xl font-bold text-blue-700">{orderStats.completed}</p><p className="text-sm text-blue-700">Entregados</p></div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por ID, nombre, email o teléfono..." className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="all">Todos</option>
              <option value="payment_pending">Pago pendiente</option>
              <option value="pending_bizum_review">Revisar Bizum</option>
              <option value="pending_manual_review">Revisión manual</option>
              <option value="paid">Pagados</option>
              <option value="confirmed">Confirmados</option>
              <option value="preparing">Preparando</option>
              <option value="ready">Listos</option>
              <option value="delivered">Entregados</option>
              <option value="cancelled">Cancelados</option>
            </select>
          </div>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">No hay pedidos</p>
          <p className="text-muted-foreground">Cuando alguien compre, aparecerá aquí con sus datos de preparación.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order, index) => {
            const status = getStatus(order);
            const StatusIcon = status.icon;
            const expanded = expandedOrder === order.id;
            return (
              <motion.div key={order.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <h3 className="font-semibold text-foreground text-lg">Pedido #{order.id.slice(0, 8)}</h3>
                      <span className={`flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-medium ${status.color}`}><StatusIcon className="w-3 h-3" />{status.label}</span>
                      <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">{order.deliveryMethod === "recoger" ? "Recogida" : "Envío"}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /><span>{order.customerName} · {order.customerEmail}</span></div>
                      <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /><span>{getPhone(order)}</span></div>
                      <div className="flex items-center gap-2 md:col-span-2"><MapPin className="w-4 h-4 text-muted-foreground" /><span>{getAddress(order)}</span></div>
                      <div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-muted-foreground" /><span className="capitalize">{order.paymentMethod}</span></div>
                      <div><span className="text-muted-foreground">Fecha: </span>{new Date(order.date).toLocaleString("es-ES")}</div>
                    </div>

                    <div className="mt-3 text-sm">
                      <span className="text-muted-foreground">Productos: </span>
                      <span className="font-medium">{order.items.map((item) => `${item.name} x${item.quantity}`).join(", ")}</span>
                    </div>

                    {expanded && (
                      <div className="mt-4 rounded-xl bg-muted/50 p-4 text-sm space-y-2">
                        <p className="font-semibold">Detalle para preparar</p>
                        {order.items.map((item, i) => <div key={i} className="flex justify-between border-b border-border/50 pb-2"><span>{item.name} x{item.quantity}</span><span>€{Number((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span></div>)}
                        <p><strong>Notas:</strong> {order.metadata?.notes || "Sin notas"}</p>
                        <p><strong>Dirección completa:</strong> {getAddress(order)}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-start lg:items-end gap-3">
                    <div className="text-right"><p className="text-sm text-muted-foreground mb-1">Total</p><p className="text-2xl font-bold text-primary">€{Number(order.total || 0).toFixed(2)}</p></div>
                    <div className="flex gap-2">
                      <select value={order.status} onChange={(e) => updateOrderStatus(order.id, e.target.value)} className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                        <option value="pending_bizum_review">Revisar Bizum</option>
                        <option value="pending_transfer_review">Revisar transferencia</option>
                        <option value="pending_store_confirmation">Confirmar tienda</option>
                        <option value="paid">Pagado</option>
                        <option value="confirmed">Confirmado</option>
                        <option value="preparing">Preparando</option>
                        <option value="ready">Listo</option>
                        <option value="delivered">Entregado</option>
                        <option value="cancelled">Cancelado</option>
                      </select>
                      <button onClick={() => setExpandedOrder(expanded ? null : order.id)} className="p-2 bg-muted hover:bg-accent rounded-lg transition-colors"><Eye className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
