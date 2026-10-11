import { useEffect, useState } from "react";
import { backendApi } from "../../lib/backendStorage";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";

export function AdminCustomerInterest() {
  const [data, setData] = useState<Array<{ productId: string; name: string; count: number; outOfStock: boolean }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await backendApi.getCustomerInterest();
        setData(result || []);
      } catch (e: any) {
        toast.error(e?.message || "Error cargando interés de clientes");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) return <p>Cargando datos de interés…</p>;
  if (!data.length) return <p>No hay datos de interés de clientes.</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Productos más añadidos a favoritos</h2>
      <table className="w-full table-auto border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Producto</th>
            <th className="p-2 text-left">Favoritos</th>
            <th className="p-2 text-left">Estado</th>
            <th className="p-2 text-left">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.productId} className="border-b">
              <td className="p-2">{item.name}</td>
              <td className="p-2 font-bold">{item.count}</td>
              <td className="p-2">
                {item.outOfStock ? (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800 text-xs">Sin stock</span>
                ) : (
                  <span className="rounded-full bg-green-100 px-2 py-1 text-green-800 text-xs">En stock</span>
                )}
              </td>
              <td className="p-2">
                <Link to={`/producto/${item.productId}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                  Ver detalle
                </Link>
                <button onClick={() => {
                  // quick add to cart from admin view
                  const cart = JSON.parse(localStorage.getItem("cart") || "[]");
                  cart.push({ id: item.productId, quantity: 1, lineKey: `${item.productId}::base` });
                  localStorage.setItem("cart", JSON.stringify(cart));
                  window.dispatchEvent(new Event("storage"));
                  toast.success("Producto añadido al carrito");
                }} className="ml-4 inline-flex items-center gap-1 text-green-600 hover:underline">
                  <ShoppingCart className="h-4 w-4" /> Añadir al carrito
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
