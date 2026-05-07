import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ShoppingBag, Trash2, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { backendStorage } from "../lib/backendStorage";

interface CartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
}

export function Cart() {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [deliveryMethod, setDeliveryMethod] = useState("envio");
  const [paymentMethod, setPaymentMethod] = useState("bizum");
  const [shippingCost, setShippingCost] = useState(5);

  useEffect(() => {
    loadCart();
    const shippingSettings = backendStorage.getItem("shippingSettings");
    if (shippingSettings) setShippingCost(JSON.parse(shippingSettings).cost || 5);
    window.addEventListener("storage", loadCart);
    return () => window.removeEventListener("storage", loadCart);
  }, []);

  const loadCart = () => setCartItems(JSON.parse(backendStorage.getItem("cart") || "[]"));
  const saveCart = (items: CartItem[]) => {
    setCartItems(items);
    backendStorage.setItem("cart", JSON.stringify(items));
  };

  const subtotal = cartItems.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);
  const shipping = deliveryMethod === "recoger" ? 0 : shippingCost;
  const total = subtotal + shipping;

  const updateQuantity = (id: number, delta: number) => {
    saveCart(cartItems.map((item) => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  };

  const removeItem = (id: number) => {
    saveCart(cartItems.filter((item) => item.id !== id));
    toast.success("Producto eliminado");
  };

  const goCheckout = () => {
    if (!cartItems.length) return toast.error("Tu carrito está vacío");
    navigate("/checkout", { state: { deliveryMethod, paymentMethod, shippingCost } });
  };

  if (!cartItems.length) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <ShoppingBag className="w-20 h-20 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Tu carrito está vacío</h2>
          <Link to="/productos" className="inline-flex px-6 py-3 bg-primary text-primary-foreground rounded-xl">Ver productos</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-4">
        <h1 className="text-3xl font-bold">Carrito</h1>
        {cartItems.map((item) => (
          <div key={item.id} className="bg-card border rounded-2xl p-4 flex gap-4">
            <img src={item.image} alt={item.name} className="w-24 h-24 object-cover rounded-xl" />
            <div className="flex-1">
              <div className="flex justify-between">
                <h3 className="font-semibold">{item.name}</h3>
                <button onClick={() => removeItem(item.id)}><Trash2 className="w-4 h-4" /></button>
              </div>
              <p className="text-primary font-bold">€{Number(item.price || 0).toFixed(2)}</p>
              <div className="flex items-center gap-3 mt-3">
                <button onClick={() => updateQuantity(item.id, -1)} className="p-2 bg-muted rounded-lg"><Minus className="w-4 h-4" /></button>
                <span>{item.quantity}</span>
                <button onClick={() => updateQuantity(item.id, 1)} className="p-2 bg-muted rounded-lg"><Plus className="w-4 h-4" /></button>
                <span className="ml-auto font-semibold">€{(Number(item.price || 0) * item.quantity).toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-2xl p-6 h-fit sticky top-24">
        <h2 className="text-xl font-bold mb-4">Resumen</h2>
        <label className="block mb-2 font-medium">Entrega</label>
        <select className="w-full border rounded-xl p-3 mb-4" value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value)}>
          <option value="envio">Envío a domicilio</option>
          <option value="recoger">Recoger en tienda</option>
        </select>
        <label className="block mb-2 font-medium">Pago</label>
        <select className="w-full border rounded-xl p-3 mb-2" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          <option value="bizum">Bizum</option>
          <option value="tarjeta">Tarjeta</option>
          <option value="alternativos">Pagos alternativos: Klarna, Amazon Pay, Apple Pay, Google Pay y Link</option>
          <option value="transferencia">Transferencia</option>
          <option value="efectivo">Efectivo</option>
        </select>
        {paymentMethod === "alternativos" && (
          <p className="text-xs text-muted-foreground mb-4">
            Stripe mostrará automáticamente los métodos disponibles según el dispositivo, país, moneda e importe.
          </p>
        )}
        {paymentMethod !== "alternativos" && <div className="mb-4" />}
        <div className="space-y-2 border-t pt-4">
          <div className="flex justify-between"><span>Subtotal</span><span>€{subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Envío</span><span>{shipping === 0 ? "Gratis" : `€${shipping.toFixed(2)}`}</span></div>
          <div className="flex justify-between font-bold text-lg"><span>Total</span><span>€{total.toFixed(2)}</span></div>
        </div>
        <button onClick={goCheckout} className="w-full mt-6 bg-primary text-primary-foreground py-3 rounded-xl font-medium">Continuar con datos de entrega</button>
      </div>
    </div>
  );
}
