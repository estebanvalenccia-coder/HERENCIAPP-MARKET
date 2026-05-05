import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../lib/backendStorage";

export function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();

  const paymentMethod = location.state?.paymentMethod || "tarjeta";
  const deliveryMethod = location.state?.deliveryMethod || "envio";

  const cartItems = useMemo(() => {
    return JSON.parse(backendStorage.getItem("cart") || "[]");
  }, []);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
    province: "",
    notes: "",
  });

  const subtotal = cartItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
  const shipping = deliveryMethod === "recoger" ? 0 : 5;
  const total = subtotal + shipping;

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.phone) {
      toast.error("Completa tus datos");
      return;
    }

    if (deliveryMethod === "envio" && !form.address) {
      toast.error("Introduce tu dirección de envío");
      return;
    }

    try {
      setLoading(true);

      await backendApi.createOrder({
        customerName: form.name,
        customerEmail: form.email,
        paymentMethod,
        deliveryMethod,
        status: paymentMethod === "bizum" ? "pending_bizum_review" : "pending_manual_review",
        subtotal,
        shipping,
        total,
        items: cartItems,
        metadata: {
          phone: form.phone,
          notes: form.notes,
          shippingAddress: {
            address: form.address,
            city: form.city,
            postalCode: form.postalCode,
            province: form.province,
          },
        },
      });

      backendStorage.setItem("cart", JSON.stringify([]));

      toast.success("Pedido realizado correctamente 🌿");

      navigate("/");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo procesar el pedido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-card border border-border rounded-2xl p-6">
        <h1 className="text-3xl font-bold mb-6">Datos de entrega</h1>

        <div className="space-y-4">
          <input className="w-full border rounded-xl p-3" placeholder="Nombre completo" value={form.name} onChange={(e) => handleChange("name", e.target.value)} />
          <input className="w-full border rounded-xl p-3" placeholder="Correo electrónico" value={form.email} onChange={(e) => handleChange("email", e.target.value)} />
          <input className="w-full border rounded-xl p-3" placeholder="Teléfono" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} />

          {deliveryMethod === "envio" && (
            <>
              <input className="w-full border rounded-xl p-3" placeholder="Dirección" value={form.address} onChange={(e) => handleChange("address", e.target.value)} />
              <input className="w-full border rounded-xl p-3" placeholder="Ciudad" value={form.city} onChange={(e) => handleChange("city", e.target.value)} />
              <input className="w-full border rounded-xl p-3" placeholder="Código postal" value={form.postalCode} onChange={(e) => handleChange("postalCode", e.target.value)} />
              <input className="w-full border rounded-xl p-3" placeholder="Provincia" value={form.province} onChange={(e) => handleChange("province", e.target.value)} />
            </>
          )}

          <textarea className="w-full border rounded-xl p-3 min-h-[120px]" placeholder="Notas para el pedido" value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} />
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 h-fit sticky top-24">
        <h2 className="text-2xl font-bold mb-6">Resumen del pedido</h2>

        <div className="space-y-3 mb-6">
          {cartItems.map((item: any) => (
            <div key={item.id} className="flex justify-between gap-3">
              <span>{item.name} x{item.quantity}</span>
              <span>€{(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t pt-4">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>€{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Envío</span>
            <span>{shipping === 0 ? "Gratis" : `€${shipping.toFixed(2)}`}</span>
          </div>
          <div className="flex justify-between font-bold text-lg pt-2">
            <span>Total</span>
            <span>€{total.toFixed(2)}</span>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full mt-6 bg-primary text-primary-foreground py-3 rounded-xl font-medium"
        >
          {loading ? "Procesando..." : "Confirmar pedido"}
        </button>
      </div>
    </div>
  );
}
