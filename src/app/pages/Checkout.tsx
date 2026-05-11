import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { StripeCheckout } from "../components/StripeCheckout";
import { backendApi, backendStorage } from "../lib/backendStorage";

export function Checkout() {
  const navigate = useNavigate();
  const location = useLocation();

  const paymentMethod = location.state?.paymentMethod || "tarjeta";
  const deliveryMethod = location.state?.deliveryMethod || "envio";
  const isStripePayment = ["tarjeta", "bizum", "alternativos"].includes(paymentMethod);

  const cartItems = useMemo(() => JSON.parse(backendStorage.getItem("cart") || "[]"), []);

  const [loading, setLoading] = useState(false);
  const [showStripe, setShowStripe] = useState(false);
  const [shippingCost, setShippingCost] = useState(5);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");
  const [shippingInfo, setShippingInfo] = useState<{
    distanceText?: string;
    durationText?: string;
    distanceKm?: number;
    destination?: string;
  } | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "Barcelona",
    postalCode: "",
    province: "Barcelona",
    notes: "",
  });

  useEffect(() => {
    const savedShipping = backendStorage.getItem("shippingSettings");

    if (savedShipping) {
      try {
        const settings = JSON.parse(savedShipping);
        const cost = Number(settings.cost);
        if (Number.isFinite(cost) && cost >= 0) setShippingCost(cost);
      } catch (error) {
        console.warn("No se pudo leer shippingSettings", error);
      }
    }
  }, []);

  useEffect(() => {
    if (deliveryMethod === "recoger" || deliveryMethod === "recogida") {
      setShippingCost(0);
      setShippingInfo(null);
      setShippingError("");
      return;
    }

    const hasMinimumAddress = form.address.trim().length >= 5 && form.postalCode.trim().length >= 4;

    if (!hasMinimumAddress) {
      setShippingInfo(null);
      setShippingError("");
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setShippingLoading(true);
        setShippingError("");

        const result = await backendApi.calculateShipping({
          address: form.address,
          city: form.city || "Barcelona",
          postalCode: form.postalCode,
          province: form.province || "Barcelona",
        });

        setShippingCost(Number(result.price || 0));
        setShippingInfo({
          distanceText: result.distanceText,
          durationText: result.durationText,
          distanceKm: result.distanceKm,
          destination: result.destination,
        });
      } catch (error: any) {
        console.error("No se pudo calcular el envío con Maps", error);
        setShippingInfo(null);
        setShippingError(error?.message || "No se pudo calcular el envío. Revisa la dirección.");
      } finally {
        setShippingLoading(false);
      }
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [deliveryMethod, form.address, form.city, form.postalCode, form.province]);

  const subtotal = cartItems.reduce((sum: number, item: any) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
  const shipping = deliveryMethod === "recoger" || deliveryMethod === "recogida" ? 0 : shippingCost;
  const total = subtotal + shipping;

  const handleChange = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const validateForm = () => {
    if (!cartItems.length) {
      toast.error("Tu carrito está vacío");
      navigate("/cart");
      return false;
    }

    if (!form.name || !form.email || !form.phone) {
      toast.error("Completa tus datos");
      return false;
    }

    if (deliveryMethod === "envio" && !form.address) {
      toast.error("Introduce tu dirección de envío");
      return false;
    }

    if (deliveryMethod === "envio" && shippingLoading) {
      toast.error("Espera un momento, estamos calculando el envío");
      return false;
    }

    if (deliveryMethod === "envio" && shippingError) {
      toast.error("Revisa la dirección de envío antes de continuar");
      return false;
    }

    return true;
  };

  const clearCart = async () => {
    const result = await backendStorage.setItem("cart", JSON.stringify([]));

    if (!result.ok) {
      console.warn("El pedido se guardó, pero no se pudo limpiar el carrito remoto:", result.error);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    if (isStripePayment) {
      setShowStripe(true);
      return;
    }

    try {
      setLoading(true);

      await backendApi.createOrder({
        customerName: form.name,
        customerEmail: form.email,
        paymentMethod,
        deliveryMethod,
        status: paymentMethod === "transferencia" ? "pending_transfer_review" : "pending_store_confirmation",
        subtotal,
        shipping,
        total,
        items: cartItems,
        metadata: {
          phone: form.phone,
          notes: form.notes,
          shippingDistance: shippingInfo,
          shippingAddress: {
            address: form.address,
            city: form.city,
            postalCode: form.postalCode,
            province: form.province,
          },
        },
      });

      await clearCart();
      toast.success("Pedido recibido. Queda pendiente de confirmación 🌿");
      navigate("/");
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "No se pudo procesar el pedido");
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

              <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm">
                {shippingLoading ? (
                  <p className="text-muted-foreground">Calculando envío con Google Maps...</p>
                ) : shippingError ? (
                  <p className="text-destructive">{shippingError}</p>
                ) : shippingInfo ? (
                  <div className="space-y-1">
                    <p className="font-semibold">Envío calculado: €{shippingCost.toFixed(2)}</p>
                    <p className="text-muted-foreground">
                      Distancia: {shippingInfo.distanceText || `${shippingInfo.distanceKm} km`}
                      {shippingInfo.durationText ? ` · Tiempo estimado: ${shippingInfo.durationText}` : ""}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Introduce dirección y código postal para calcular el envío automáticamente.</p>
                )}
              </div>
            </>
          )}

          <textarea className="w-full border rounded-xl p-3 min-h-[120px]" placeholder="Notas para el pedido" value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} />
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-card border border-border rounded-2xl p-6 h-fit sticky top-24">
          <h2 className="text-2xl font-bold mb-6">Resumen del pedido</h2>

          <div className="space-y-3 mb-6">
            {cartItems.length ? (
              cartItems.map((item: any) => (
                <div key={item.id} className="flex justify-between gap-3">
                  <span>{item.name} x{item.quantity}</span>
                  <span>€{(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No hay productos en el carrito.</p>
            )}
          </div>

          <div className="space-y-2 border-t pt-4">
            <div className="flex justify-between"><span>Subtotal</span><span>€{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between">
              <span>Envío</span>
              <span>{shippingLoading ? "Calculando..." : shipping === 0 ? "Gratis" : `€${shipping.toFixed(2)}`}</span>
            </div>
            {shippingInfo && !shippingLoading && (
              <div className="text-xs text-muted-foreground text-right">
                {shippingInfo.distanceText}{shippingInfo.durationText ? ` · ${shippingInfo.durationText}` : ""}
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2"><span>Total</span><span>€{total.toFixed(2)}</span></div>
          </div>

          {!showStripe && (
            <button onClick={handleSubmit} disabled={loading || shippingLoading || !cartItems.length} className="w-full mt-6 bg-primary text-primary-foreground py-3 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Procesando..." : shippingLoading ? "Calculando envío..." : isStripePayment ? "Continuar al pago seguro" : "Confirmar pedido"}
            </button>
          )}
        </div>

        {showStripe && (
          <StripeCheckout
            paymentMethod={paymentMethod}
            amount={total}
            customerName={form.name}
            customerEmail={form.email}
            deliveryMethod={deliveryMethod}
            subtotal={subtotal}
            shipping={shipping}
            metadata={{
              requestedPaymentMethod: paymentMethod,
              phone: form.phone,
              notes: form.notes,
              shippingDistance: shippingInfo,
              shippingAddress: {
                address: form.address,
                city: form.city,
                postalCode: form.postalCode,
                province: form.province,
              },
            }}
            onCancel={() => setShowStripe(false)}
            onSuccess={() => {
              toast.success("Pago realizado correctamente 🌿");
              navigate("/");
            }}
          />
        )}
      </div>
    </div>
  );
}
