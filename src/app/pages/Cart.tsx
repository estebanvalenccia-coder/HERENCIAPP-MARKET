import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Clock3, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { backendStorage } from "../lib/backendStorage";

interface CartItem {
  id: number | string;
  name: string;
  price: number;
  unitPrice?: number;
  image: string;
  quantity: number;
  lineKey?: string;
  selectedVariant?: string;
  personalization?: { dedication?: string };
  stock?: number;
  trackInventory?: boolean;
  variants?: Array<{ name?: string; stock?: number } | string>;
  collection?: string;
  collections?: string[];
  type?: string;
  metadata?: Record<string, any>;
  serviceBooking?: boolean;
  serviceHours?: number;
  serviceMinHours?: number;
  serviceMaxHours?: number;
  serviceHourStep?: number;
}

const isServiceItem = (item: CartItem) =>
  item.serviceBooking === true ||
  item.type === "service" ||
  item.collection === "servicios" ||
  (Array.isArray(item.collections) && item.collections.includes("servicios"));

const serviceRules = (item: CartItem) => {
  const min = Math.max(1, Number(item.serviceMinHours ?? item.metadata?.serviceMinHours ?? 1));
  const max = Math.max(min, Number(item.serviceMaxHours ?? item.metadata?.serviceMaxHours ?? 3));
  const step = Math.max(1, Number(item.serviceHourStep ?? item.metadata?.serviceHourStep ?? 1));
  const rawHours = Number(item.serviceHours ?? (isServiceItem(item) ? item.quantity : 1) ?? min);
  const hours = Math.min(max, Math.max(min, Number.isFinite(rawHours) ? rawHours : min));
  return { min, max, step, hours };
};

const lineTotal = (item: CartItem) => {
  if (isServiceItem(item)) {
    const { hours } = serviceRules(item);
    return Number(item.unitPrice ?? item.price ?? 0) * hours;
  }
  return Number(item.price || 0) * Math.max(1, Number(item.quantity || 1));
};

export function Cart() {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("tarjeta");
  const [shippingCost, setShippingCost] = useState(5);
  const [coupon, setCoupon] = useState("");
  const [discount, setDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [couponBasis, setCouponBasis] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);

  const loadCart = () => {
    try {
      const rows = JSON.parse(backendStorage.getItem("cart") || "[]");
      setCartItems(Array.isArray(rows) ? rows : []);
    } catch {
      setCartItems([]);
    }
  };

  useEffect(() => {
    loadCart();
    try {
      const shippingSettings = JSON.parse(backendStorage.getItem("shippingSettings") || "{}");
      const cost = Number(shippingSettings.cost);
      if (Number.isFinite(cost) && cost >= 0) setShippingCost(cost);
    } catch {}

    window.addEventListener("storage", loadCart);
    window.addEventListener("backend-storage", loadCart);
    return () => {
      window.removeEventListener("storage", loadCart);
      window.removeEventListener("backend-storage", loadCart);
    };
  }, []);

  const saveCart = (items: CartItem[]) => {
    setCartItems(items);
    void backendStorage.setItem("cart", JSON.stringify(items));
    window.dispatchEvent(new Event("storage"));
  };

  const hasPhysicalItems = useMemo(() => cartItems.some((item) => !isServiceItem(item)), [cartItems]);
  const hasServices = useMemo(() => cartItems.some(isServiceItem), [cartItems]);
  const onlyServices = hasServices && !hasPhysicalItems;
  const subtotal = cartItems.reduce((sum, item) => sum + lineTotal(item), 0);
  const shipping = hasPhysicalItems ? shippingCost : 0;
  const cartSignature = JSON.stringify(cartItems.map((item) => ({
    id: item.id, selectedVariant: item.selectedVariant, quantity: item.quantity,
    serviceHours: item.serviceHours, serviceBooking: item.serviceBooking,
  })));
  const calculatedDiscount = couponBasis === cartSignature ? discount : 0;
  const total = Math.max(0, subtotal - calculatedDiscount + shipping);
  const itemKey = (item: CartItem) => item.lineKey || String(item.id);

  const updateQuantity = (key: string, delta: number) => {
    let blocked = false;
    const next = cartItems.map((item) => {
      if (itemKey(item) !== key) return item;
      if (isServiceItem(item)) return item;
      const quantity = Math.max(1, Number(item.quantity || 1) + delta);
      if (delta <= 0 || item.trackInventory === false) return { ...item, quantity };

      const variants = Array.isArray(item.variants) ? item.variants : [];
      const variant = item.selectedVariant
        ? variants.find((entry: any) => String(entry?.name || entry) === String(item.selectedVariant))
        : null;
      const stock = Math.max(0, Math.floor(Number((variant as any)?.stock ?? item.stock ?? 0)));
      if (quantity > stock) {
        blocked = true;
        return item;
      }
      return { ...item, quantity };
    });
    if (blocked) toast.error("No hay más unidades disponibles de este artículo");
    saveCart(next);
  };

  const updateServiceHours = (key: string, direction: -1 | 1) => {
    const next = cartItems.map((item) => {
      if (itemKey(item) !== key || !isServiceItem(item)) return item;
      const { min, max, step, hours } = serviceRules(item);
      const nextHours = Math.min(max, Math.max(min, hours + direction * step));
      return {
        ...item,
        quantity: 1,
        serviceBooking: true,
        serviceHours: nextHours,
        serviceMinHours: min,
        serviceMaxHours: max,
        serviceHourStep: step,
      };
    });
    saveCart(next);
  };

  const removeItem = (key: string) => {
    const removed = cartItems.find((item) => itemKey(item) === key);
    saveCart(cartItems.filter((item) => itemKey(item) !== key));
    toast.success(isServiceItem(removed as CartItem) ? "Servicio eliminado de la reserva" : "Producto eliminado");
  };

  const applyCoupon = async () => {
    const entered = coupon.trim().toUpperCase();
    if (!entered) return toast.error("Introduce un código promocional");
    const applyingTo = cartSignature;
    setCouponBusy(true);
    try {
      const response = await fetch("/api/coupons/preview", {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: entered, items: cartItems }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo validar el código");
      if (!Number.isFinite(Number(data.discount)) || Number(data.discount) <= 0) throw new Error("Este cupón no ofrece descuento");
      setDiscount(Number(data.discount));
      setCouponBasis(applyingTo);
      setAppliedCoupon(data.code || entered);
      toast.success("Cupón validado y aplicado");
    } catch (error) {
      setDiscount(0);
      setCouponBasis("");
      setAppliedCoupon("");
      toast.error(error instanceof Error ? error.message : "No se pudo validar el cupón");
    } finally { setCouponBusy(false); }
  };

  const goCheckout = () => {
    if (!cartItems.length) return toast.error("Tu carrito está vacío");
    navigate("/checkout", {
      state: {
        paymentMethod,
        shippingCost: shipping,
        discount: calculatedDiscount,
        coupon: calculatedDiscount > 0 ? appliedCoupon : "",
      },
    });
  };

  if (!cartItems.length) {
    return (
      <div className="grid min-h-[65vh] place-items-center bg-[#fbfaf6] px-5 text-[#173126]">
        <div className="max-w-lg text-center">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#eef2eb] text-[#315b42]">
            <ShoppingBag className="h-9 w-9" />
          </span>
          <h1 className="mt-6 text-4xl font-medium">Tu carrito está vacío</h1>
          <p className="mt-3 text-sm leading-6 text-[#6c786f]">
            Explora plantas, jardín, decoración, Dulce, Moda y servicios de Herencia.
          </p>
          <Link to="/productos" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#315b42] px-6 py-3 text-sm font-black text-white">
            Ver productos <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#fbfaf6] text-[#173126]">
      <div className="border-b border-[#ded9cd] bg-[#f4f1e8]">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#718076]">HERENCIA MARKET</p>
          <h1 className="mt-2 text-4xl font-medium sm:text-5xl">{onlyServices ? "Tu reserva" : "Tu carrito"}</h1>
          <p className="mt-2 text-sm text-[#66736b]">
            {onlyServices
              ? "Elige cuántas horas quieres reservar. La reserva mínima es de una hora."
              : hasServices
                ? "Revisa tus productos y las horas reservadas de tus servicios."
                : "Revisa tus productos antes de continuar con la entrega a domicilio."}
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_360px] lg:px-10">
        <section className="space-y-4">
          {cartItems.map((item) => {
            const service = isServiceItem(item);
            const rules = serviceRules(item);
            const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
            return (
              <article key={itemKey(item)} className="flex gap-4 rounded-3xl border border-[#dfdbd1] bg-white p-4 shadow-sm sm:p-5">
                <img src={item.image} alt={item.name} className="h-24 w-24 shrink-0 rounded-2xl object-cover sm:h-28 sm:w-28" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-black">{item.name}</h2>
                      {service ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#315b42]">
                          <Clock3 className="h-3.5 w-3.5" /> Servicio por horas
                        </p>
                      ) : item.selectedVariant ? (
                        <p className="mt-1 text-xs text-[#6c786f]">Variante: {item.selectedVariant}</p>
                      ) : null}
                      {!service && item.personalization?.dedication ? (
                        <p className="mt-1 text-xs text-[#6c786f]">Dedicatoria: “{item.personalization.dedication}”</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(itemKey(item))}
                      className="rounded-full p-2 text-[#7e7168] transition hover:bg-[#f4eee9] hover:text-rose-700"
                      aria-label={`Eliminar ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="mt-3 text-lg font-black text-[#315b42]">
                    €{unitPrice.toFixed(2)}{service ? <span className="ml-1 text-xs font-semibold text-[#718076]">/ hora</span> : null}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {service ? (
                      <div>
                        <p className="mb-2 text-xs font-bold text-[#6c786f]">Horas reservadas</p>
                        <div className="inline-flex items-center rounded-full border border-[#ded9cd] bg-[#fbfaf6] p-1">
                          <button
                            type="button"
                            onClick={() => updateServiceHours(itemKey(item), -1)}
                            disabled={rules.hours <= rules.min}
                            className="grid h-8 w-8 place-items-center rounded-full hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                            aria-label="Reducir horas"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-20 text-center text-sm font-black">
                            {rules.hours} {rules.hours === 1 ? "hora" : "horas"}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateServiceHours(itemKey(item), 1)}
                            disabled={rules.hours >= rules.max}
                            className="grid h-8 w-8 place-items-center rounded-full hover:bg-white disabled:cursor-not-allowed disabled:opacity-35"
                            aria-label="Aumentar horas"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-[#6c786f]">
                          Mínimo {rules.min} · máximo online {rules.max} {rules.max === 1 ? "hora" : "horas"}
                        </p>
                      </div>
                    ) : (
                      <div className="inline-flex items-center rounded-full border border-[#ded9cd] bg-[#fbfaf6] p-1">
                        <button type="button" onClick={() => updateQuantity(itemKey(item), -1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white" aria-label="Reducir cantidad">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-8 text-center text-sm font-black">{item.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(itemKey(item), 1)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-white" aria-label="Aumentar cantidad">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                    <span className="ml-auto font-black">€{lineTotal(item).toFixed(2)}</span>
                  </div>

                  {service && (
                    <p className="mt-3 rounded-xl bg-[#f4f1e8] p-3 text-xs leading-5 text-[#6c786f]">
                      Si necesitas más tiempo del reservado, las horas adicionales se abonarán posteriormente.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        <aside className="h-fit rounded-[2rem] border border-[#dfdbd1] bg-white p-6 shadow-sm lg:sticky lg:top-28">
          <h2 className="text-2xl font-black">Resumen</h2>

          {onlyServices ? (
            <div className="mt-5 rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-4">
              <p className="text-sm font-black">Reserva de servicios</p>
              <p className="mt-1 text-xs leading-5 text-[#6c786f]">
                Pagas ahora las horas que has seleccionado. No se aplican gastos de envío a los servicios.
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-4">
              <p className="text-sm font-black">{hasServices ? "Productos + servicios" : "Entrega a domicilio"}</p>
              <p className="mt-1 text-xs leading-5 text-[#6c786f]">
                {hasServices
                  ? "El envío se calcula únicamente para los productos físicos. Los servicios se cobran por las horas reservadas."
                  : "Herencia Market funciona exclusivamente con entrega. No disponemos de recogida en tienda."}
              </p>
            </div>
          )}

          <label className="mt-5 block text-sm font-black">Pago</label>
          <select
            className="mt-2 w-full rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-3 outline-none focus:border-[#315b42]"
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
          >
            <option value="tarjeta">Tarjeta</option>
            <option value="bizum">Bizum</option>
            <option value="transferencia">Transferencia</option>
            <option value="efectivo">Efectivo</option>
          </select>

          <div className="mt-5">
            <label className="text-sm font-black">Cupón</label>
            <div className="mt-2 flex gap-2">
              <input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Código promocional" className="min-w-0 flex-1 rounded-xl border border-[#ded9cd] px-3 py-2" />
              <button onClick={applyCoupon} disabled={couponBusy} className="rounded-xl bg-[#eef2eb] px-3 py-2 text-sm font-black text-[#315b42] disabled:opacity-50">{couponBusy ? "Validando..." : "Aplicar"}</button>
            </div>
          </div>

          <div className="mt-6 space-y-3 border-t border-[#e3ded4] pt-5 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-[#6c786f]">{onlyServices ? "Horas reservadas" : "Subtotal"}</span>
              <span className="font-black">€{subtotal.toFixed(2)}</span>
            </div>
            {calculatedDiscount > 0 ? (
              <div className="flex justify-between gap-4 text-emerald-700">
                <span>Descuento</span><span className="font-black">−€{calculatedDiscount.toFixed(2)}</span>
              </div>
            ) : null}
            {hasPhysicalItems && (
              <>
                <div className="flex justify-between gap-4">
                  <span className="text-[#6c786f]">Envío desde</span>
                  <span className="font-black">{shipping === 0 ? "Gratis" : `€${shipping.toFixed(2)}`}</span>
                </div>
                <p className="rounded-2xl bg-[#f4f1e8] p-3 text-xs leading-5 text-[#6c786f]">
                  El precio final del envío se calcula con tu dirección en el siguiente paso.
                </p>
              </>
            )}
            <div className="flex justify-between gap-4 border-t border-[#e3ded4] pt-4 text-lg">
              <span className="font-black">{onlyServices ? "Total de la reserva" : "Total estimado"}</span>
              <span className="font-black text-[#315b42]">€{total.toFixed(2)}</span>
            </div>
          </div>

          <button type="button" onClick={goCheckout} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#315b42] px-5 py-3.5 text-sm font-black text-white">
            {onlyServices ? "Continuar con la reserva" : "Continuar"} <ArrowRight className="h-4 w-4" />
          </button>
        </aside>
      </div>
    </div>
  );
}
