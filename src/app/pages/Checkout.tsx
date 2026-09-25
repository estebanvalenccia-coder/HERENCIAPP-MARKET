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
  const [businessSuite, setBusinessSuite] = useState<any>({});
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
    requestedDate: "",
    requestedTimeSlot: "",
    deliveryInstructions: "",
  });

  useEffect(() => {
    try { setBusinessSuite(JSON.parse(backendStorage.getItem("businessSuiteSettings") || "{}")); } catch { setBusinessSuite({}); }
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

        const calculatedDistance = Number(result.distanceKm || 0);
        const maxDeliveryKm = Math.max(0, Number(businessSuite.maxDeliveryKm || 0));
        if (maxDeliveryKm > 0 && calculatedDistance > maxDeliveryKm) {
          throw new Error(`Esta dirección está fuera de nuestro radio de reparto de ${maxDeliveryKm} km`);
        }
        const cartSubtotal = cartItems.reduce((sum: number, item: any) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
        const freeShippingFrom = Math.max(0, Number(businessSuite.freeShippingFrom || 0));
        setShippingCost(freeShippingFrom > 0 && cartSubtotal >= freeShippingFrom ? 0 : Number(result.price || 0));
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
  }, [deliveryMethod, form.address, form.city, form.postalCode, form.province, businessSuite.freeShippingFrom, businessSuite.maxDeliveryKm]);

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
          requestedDate: form.requestedDate || null,
          requestedTimeSlot: form.requestedTimeSlot || null,
          deliveryInstructions: form.deliveryInstructions || null,
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
    <div className="bg-[#fbfaf6] text-[#173126]">
      <div className="border-b border-[#ded9cd] bg-[#f4f1e8]">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#718076]">HERENCIA MARKET</p>
          <h1 className="mt-2 text-4xl font-medium">Finaliza tu compra</h1>
          <p className="mt-2 text-sm text-[#66736b]">Datos de entrega, horario y pago en un solo paso.</p>
        </div>
      </div>
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 py-10 lg:grid-cols-2">
      <div className="rounded-[2rem] border border-[#dfdbd1] bg-white p-6 shadow-sm">
        <h2 className="mb-6 text-2xl font-black">Datos de entrega</h2>

        <div className="space-y-4">
          <input className="w-full rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-3 outline-none focus:border-[#315b42]" placeholder="Nombre completo" value={form.name} onChange={(e) => handleChange("name", e.target.value)} />
          <input className="w-full rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-3 outline-none focus:border-[#315b42]" placeholder="Correo electrónico" value={form.email} onChange={(e) => handleChange("email", e.target.value)} />
          <input className="w-full rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-3 outline-none focus:border-[#315b42]" placeholder="Teléfono" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} />

          {deliveryMethod === "envio" && (
            <>
              <input className="w-full rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-3 outline-none focus:border-[#315b42]" placeholder="Dirección" value={form.address} onChange={(e) => handleChange("address", e.target.value)} />
              <input className="w-full rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-3 outline-none focus:border-[#315b42]" placeholder="Ciudad" value={form.city} onChange={(e) => handleChange("city", e.target.value)} />
              <input className="w-full rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-3 outline-none focus:border-[#315b42]" placeholder="Código postal" value={form.postalCode} onChange={(e) => handleChange("postalCode", e.target.value)} />
              <input className="w-full rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-3 outline-none focus:border-[#315b42]" placeholder="Provincia" value={form.province} onChange={(e) => handleChange("province", e.target.value)} />

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm font-medium">Fecha deseada<input type="date" min={new Date().toISOString().slice(0,10)} value={form.requestedDate} onChange={(e)=>handleChange("requestedDate",e.target.value)} className="mt-2 w-full rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-3 outline-none focus:border-[#315b42]" /></label>
            <label className="text-sm font-medium">Franja horaria<select value={form.requestedTimeSlot} onChange={(e)=>handleChange("requestedTimeSlot",e.target.value)} className="mt-2 w-full rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-3 outline-none focus:border-[#315b42]"><option value="">Sin preferencia</option><option value="09:00-12:00">09:00–12:00</option><option value="12:00-15:00">12:00–15:00</option><option value="15:00-18:00">15:00–18:00</option><option value="18:00-21:00">18:00–21:00</option></select></label>
          </div>
          <textarea className="min-h-[90px] w-full rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-3 outline-none focus:border-[#315b42]" placeholder="Instrucciones de entrega: no llamar, dejar con portero, sorpresa…" value={form.deliveryInstructions} onChange={(e) => handleChange("deliveryInstructions", e.target.value)} />
          <textarea className="min-h-[120px] w-full rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-3 outline-none focus:border-[#315b42]" placeholder="Notas para el pedido" value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} />
        </div>
      </div>

      <div className="space-y-6">
        <div className="sticky top-28 h-fit rounded-[2rem] border border-[#dfdbd1] bg-white p-6 shadow-sm">
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
            <button onClick={handleSubmit} disabled={loading || shippingLoading || !cartItems.length} className="mt-6 w-full rounded-full bg-[#315b42] py-3.5 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
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
              requestedDate: form.requestedDate || null,
              requestedTimeSlot: form.requestedTimeSlot || null,
              deliveryInstructions: form.deliveryInstructions || null,
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
    </div>
  );
}
