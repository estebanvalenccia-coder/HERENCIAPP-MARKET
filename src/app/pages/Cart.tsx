import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { backendStorage } from "../lib/backendStorage";

interface CartItem {
  id: number | string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  lineKey?: string;
  selectedVariant?: string;
  personalization?: { dedication?: string };
}

export function Cart() {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [deliveryMethod, setDeliveryMethod] = useState("envio");
  const [paymentMethod, setPaymentMethod] = useState("tarjeta");
  const [shippingCost, setShippingCost] = useState(5);

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

  const subtotal = cartItems.reduce(
    (sum, item) => sum + Number(item.price || 0) * Math.max(1, Number(item.quantity || 1)),
    0
  );
  const shipping = deliveryMethod === "recoger" ? 0 : shippingCost;
  const total = subtotal + shipping;
  const itemKey = (item: CartItem) => item.lineKey || String(item.id);

  const updateQuantity = (key: string, delta: number) => {
    saveCart(
      cartItems.map((item) =>
        itemKey(item) === key
          ? { ...item, quantity: Math.max(1, Number(item.quantity || 1) + delta) }
          : item
      )
    );
  };

  const removeItem = (key: string) => {
    saveCart(cartItems.filter((item) => itemKey(item) !== key));
    toast.success("Producto eliminado");
  };

  const goCheckout = () => {
    if (!cartItems.length) return toast.error("Tu carrito está vacío");
    navigate("/checkout", { state: { deliveryMethod, paymentMethod, shippingCost } });
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
            Explora plantas, jardín, decoración, Dulce, Moda y más productos de Herencia.
          </p>
          <Link
            to="/productos"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#315b42] px-6 py-3 text-sm font-black text-white"
          >
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
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#718076]">
            HERENCIA MARKET
          </p>
          <h1 className="mt-2 text-4xl font-medium sm:text-5xl">Tu carrito</h1>
          <p className="mt-2 text-sm text-[#66736b]">
            Revisa tus productos y elige cómo quieres recibir tu pedido.
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_360px] lg:px-10">
        <section className="space-y-4">
          {cartItems.map((item) => (
            <article
              key={itemKey(item)}
              className="flex gap-4 rounded-3xl border border-[#dfdbd1] bg-white p-4 shadow-sm sm:p-5"
            >
              <img
                src={item.image}
                alt={item.name}
                className="h-24 w-24 shrink-0 rounded-2xl object-cover sm:h-28 sm:w-28"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-black">{item.name}</h2>
                    {item.selectedVariant ? (
                      <p className="mt-1 text-xs text-[#6c786f]">Variante: {item.selectedVariant}</p>
                    ) : null}
                    {item.personalization?.dedication ? (
                      <p className="mt-1 text-xs text-[#6c786f]">
                        Dedicatoria: “{item.personalization.dedication}”
                      </p>
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
                  €{Number(item.price || 0).toFixed(2)}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center rounded-full border border-[#ded9cd] bg-[#fbfaf6] p-1">
                    <button
                      type="button"
                      onClick={() => updateQuantity(itemKey(item), -1)}
                      className="grid h-8 w-8 place-items-center rounded-full hover:bg-white"
                      aria-label="Reducir cantidad"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-8 text-center text-sm font-black">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(itemKey(item), 1)}
                      className="grid h-8 w-8 place-items-center rounded-full hover:bg-white"
                      aria-label="Aumentar cantidad"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="ml-auto font-black">
                    €{(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </section>

        <aside className="h-fit rounded-[2rem] border border-[#dfdbd1] bg-white p-6 shadow-sm lg:sticky lg:top-28">
          <h2 className="text-2xl font-black">Resumen</h2>

          <label className="mt-5 block text-sm font-black">Entrega</label>
          <select
            className="mt-2 w-full rounded-2xl border border-[#ded9cd] bg-[#fbfaf6] p-3 outline-none focus:border-[#315b42]"
            value={deliveryMethod}
            onChange={(event) => setDeliveryMethod(event.target.value)}
          >
            <option value="envio">Envío a domicilio</option>
            <option value="recoger">Recoger</option>
          </select>

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

          <div className="mt-6 space-y-3 border-t border-[#e3ded4] pt-5 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-[#6c786f]">Subtotal</span>
              <span className="font-black">€{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#6c786f]">Envío desde</span>
              <span className="font-black">{shipping === 0 ? "Gratis" : `€${shipping.toFixed(2)}`}</span>
            </div>
            {deliveryMethod === "envio" ? (
              <p className="rounded-2xl bg-[#f4f1e8] p-3 text-xs leading-5 text-[#6c786f]">
                El precio final del envío se calcula con tu dirección en el siguiente paso.
              </p>
            ) : null}
            <div className="flex justify-between gap-4 border-t border-[#e3ded4] pt-4 text-lg">
              <span className="font-black">Total estimado</span>
              <span className="font-black text-[#315b42]">€{total.toFixed(2)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={goCheckout}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#315b42] px-5 py-3.5 text-sm font-black text-white"
          >
            Continuar <ArrowRight className="h-4 w-4" />
          </button>
        </aside>
      </div>
    </div>
  );
}
