import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Package, Eye, Truck, CheckCircle, Clock, Search, Filter, Download } from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  items: any[];
  total: number;
  paymentMethod: string;
  status: "pending" | "processing" | "completed" | "cancelled";
  date: string;
}

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    backendApi.listOrders()
      .then(({ orders }) => setOrders(orders))
      .catch((error) => {
        console.error("No se pudieron cargar los pedidos", error);
        toast.error("No se pudieron cargar los pedidos desde backend");
      });
  }, []);

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
    processing: "bg-blue-100 text-blue-700 border-blue-200",
    completed: "bg-green-100 text-green-700 border-green-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
  };

  const statusIcons = {
    pending: Clock,
    processing: Truck,
    completed: CheckCircle,
    cancelled: Package,
  };

  const statusLabels = {
    pending: "Pendiente",
    processing: "En Proceso",
    completed: "Completado",
    cancelled: "Cancelado",
  };

  const updateOrderStatus = async (orderId: string, newStatus: Order["status"]) => {
    try {
      await backendApi.updateOrderStatus(orderId, newStatus);
      const updated = orders.map(order =>
        order.id === orderId ? { ...order, status: newStatus } : order
      );
      setOrders(updated);
      toast.success("Estado del pedido actualizado en backend");
    } catch (error) {
      console.error("No se pudo actualizar el pedido", error);
      toast.error("No se pudo actualizar el pedido");
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesFilter = filter === "all" || order.status === filter;
    const matchesSearch =
      searchQuery === "" ||
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerEmail.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const orderStats = {
    total: orders.length,
    pending: orders.filter(o => o.status === "pending").length,
    processing: orders.filter(o => o.status === "processing").length,
    completed: orders.filter(o => o.status === "completed").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Gestión de Pedidos</h2>
          <p className="text-muted-foreground">{orders.length} pedidos totales</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors">
          <Download className="w-4 h-4" />
          Exportar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-bold text-foreground">{orderStats.total}</p>
          <p className="text-sm text-muted-foreground">Total</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-yellow-700">{orderStats.pending}</p>
          <p className="text-sm text-yellow-600">Pendientes</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-blue-700">{orderStats.processing}</p>
          <p className="text-sm text-blue-600">En Proceso</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-2xl font-bold text-green-700">{orderStats.completed}</p>
          <p className="text-sm text-green-600">Completados</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por ID, nombre o email..."
              className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Todos</option>
              <option value="pending">Pendientes</option>
              <option value="processing">En Proceso</option>
              <option value="completed">Completados</option>
              <option value="cancelled">Cancelados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">No hay pedidos</p>
          <p className="text-muted-foreground">
            {searchQuery || filter !== "all" ? "No se encontraron pedidos con los filtros aplicados" : "Aún no has recibido ningún pedido"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order, index) => {
            const StatusIcon = statusIcons[order.status];
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-card border border-border rounded-2xl p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Order Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-semibold text-foreground text-lg">
                        Pedido #{order.id}
                      </h3>
                      <span className={`flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-medium ${statusColors[order.status]}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusLabels[order.status]}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Cliente: </span>
                        <span className="text-foreground font-medium">{order.customerName}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email: </span>
                        <span className="text-foreground">{order.customerEmail}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Fecha: </span>
                        <span className="text-foreground">
                          {new Date(order.date).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Método de pago: </span>
                        <span className="text-foreground capitalize">{order.paymentMethod}</span>
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className="text-muted-foreground text-sm">Items: </span>
                      <span className="text-foreground text-sm">
                        {order.items.map(item => `${item.name} (x${item.quantity})`).join(", ")}
                      </span>
                    </div>
                  </div>

                  {/* Total & Actions */}
                  <div className="flex flex-col items-start lg:items-end gap-3">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground mb-1">Total</p>
                      <p className="text-2xl font-bold text-primary">${(order.total || 0).toFixed(2)}</p>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value as Order["status"])}
                        className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="pending">Pendiente</option>
                        <option value="processing">En Proceso</option>
                        <option value="completed">Completado</option>
                        <option value="cancelled">Cancelado</option>
                      </select>
                      <button className="p-2 bg-muted hover:bg-accent rounded-lg transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
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
