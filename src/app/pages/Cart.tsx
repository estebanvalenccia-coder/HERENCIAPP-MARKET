import { useState, useEffect } from "react";
import { Trash2, Plus, Minus, ShoppingBag, CreditCard, Banknote, Smartphone, Truck, Store, Wallet } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { toast } from "sonner";
import { StripeCheckout } from "../components/StripeCheckout";
import { backendApi, backendStorage } from "../lib/backendStorage";

interface CartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
}

export function Cart() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("tarjeta");
  const [deliveryMethod, setDeliveryMethod] = useState("envio"); // "envio" o "recoger"
  const [showStripeCheckout, setShowStripeCheckout] = useState(false);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [shippingCost, setShippingCost] = useState(5);

  useEffect(() => {
    loadCart();

    // Verificar si Stripe está habilitado
    const stripeSettings = backendStorage.getItem("stripeSettings");
    if (stripeSettings) {
      const { enabled, publishableKey } = JSON.parse(stripeSettings);
      setStripeEnabled(enabled && publishableKey);
    }

    // Cargar precio de envío configurado
    const shippingSettings = backendStorage.getItem("shippingSettings");
    if (shippingSettings) {
      const { cost } = JSON.parse(shippingSettings);
      setShippingCost(cost || 5);
    }

    window.addEventListener("storage", loadCart);
    return () => window.removeEventListener("storage", loadCart);
  }, []);

  const loadCart = () => {
    const cart = JSON.parse(backendStorage.getItem("cart") || "[]");
    setCartItems(cart);
  };

  const updateQuantity = (id: number, delta: number) => {
    const updatedCart = cartItems.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    });
    setCartItems(updatedCart);
    backendStorage.setItem("cart", JSON.stringify(updatedCart));
  };

  const removeItem = (id: number) => {
    const updatedCart = cartItems.filter(item => item.id !== id);
    setCartItems(updatedCart);
    backendStorage.setItem("cart", JSON.stringify(updatedCart));
    toast.success("Producto eliminado del carrito");
  };

  const clearCart = () => {
    setCartItems([]);
    backendStorage.setItem("cart", JSON.stringify([]));
    toast.success("Carrito vaciado");
  };

  const handleCheckout = async () => {
    console.log("🛒 Procesando pedido:", {
      paymentMethod,
      deliveryMethod,
      total,
      stripeEnabled
    });

    if (paymentMethod === "tarjeta" && stripeEnabled) {
      console.log("💳 Abriendo checkout de Stripe");
      setShowStripeCheckout(true);
    } else if (paymentMethod === "bizum") {
      console.log("📱 Método de pago: Bizum");
      // Confirmar que el usuario ha enviado el Bizum
      const confirmed = window.confirm(
        `¿Has enviado €${total.toFixed(2)} por Bizum al número +34 631 18 92 44?\n\n` +
        `Si ya lo enviaste, presiona OK para confirmar tu pedido.\n` +
        `Si aún no lo has enviado, presiona Cancelar y envía el Bizum primero.`
      );
      if (confirmed) {
        console.log("✅ Pedido confirmado con Bizum");
        await backendApi.createOrder({
          paymentMethod: "bizum",
          deliveryMethod,
          status: "pending_bizum_review",
          subtotal,
          shipping,
          total,
          items: cartItems,
        });
        toast.success("Pedido guardado en backend. Recibirás confirmación cuando se verifique el Bizum.");
        clearCart();
      } else {
        console.log("❌ Usuario canceló la confirmación de Bizum");
      }
    } else {
      console.log(`💰 Método de pago: ${paymentMethod}`);
      await backendApi.createOrder({
        paymentMethod,
        deliveryMethod,
        status: "pending_manual_review",
        subtotal,
        shipping,
        total,
        items: cartItems,
      });
      toast.success(`Pedido guardado en backend con ${paymentMethod}. ¡Gracias por tu compra!`);
      clearCart();
    }
  };

  const handleStripeSuccess = () => {
    setShowStripeCheckout(false);
    clearCart();
  };

  const handleStripeCancel = () => {
    setShowStripeCheckout(false);
  };

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  const shipping = deliveryMethod === "recoger" ? 0 : shippingCost;
  const total = subtotal + shipping;

  if (cartItems.length === 0) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <ShoppingBag className="w-20 h-20 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Tu carrito está vacío</h2>
          <p className="text-muted-foreground mb-6">Añade productos para comenzar tu compra</p>
          <Link
            to="/productos"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
          >
            Ver productos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-muted/30 border-b border-border">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Carrito de Compras
          </h1>
          <p className="text-muted-foreground">
            {cartItems.length} {cartItems.length === 1 ? "producto" : "productos"} en tu carrito
          </p>
        </div>
      </div>

      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-card border border-border rounded-2xl p-4 sm:p-6 flex gap-4"
              >
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-foreground">{item.name}</h3>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-lg font-bold text-primary mb-4">
                    €{(item.price || 0).toFixed(2)}
                  </p>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="p-2 bg-muted hover:bg-accent rounded-lg transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="p-2 bg-muted hover:bg-accent rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <span className="ml-auto font-semibold text-foreground">
                      €{((item.price || 0) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}

            <button
              onClick={clearCart}
              className="w-full py-3 text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
            >
              Vaciar carrito
            </button>
          </div>

          {/* Summary */}
          <div className="lg:col-span-1">
            {showStripeCheckout ? (
              <div className="sticky top-24">
                <StripeCheckout
                  amount={total}
                  onSuccess={handleStripeSuccess}
                  onCancel={handleStripeCancel}
                />
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl p-6 sticky top-24 max-h-[calc(100vh-6rem)] overflow-y-auto">
                <h2 className="text-xl font-bold text-foreground mb-6">Resumen del pedido</h2>

                <div className="mb-6">
                <h3 className="font-semibold text-foreground mb-3">Método de entrega</h3>
                <div className="space-y-2">
                  <DeliveryOption
                    icon={Truck}
                    label="Envío a domicilio"
                    sublabel={`€${shippingCost.toFixed(2)}`}
                    value="envio"
                    selected={deliveryMethod === "envio"}
                    onSelect={() => setDeliveryMethod("envio")}
                  />
                  <DeliveryOption
                    icon={Store}
                    label="Recoger en tienda"
                    sublabel="¡Gratis!"
                    value="recoger"
                    selected={deliveryMethod === "recoger"}
                    onSelect={() => setDeliveryMethod("recoger")}
                  />
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-foreground">
                  <span>Subtotal</span>
                  <span>€{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-foreground">
                  <span>Envío</span>
                  <span>{shipping === 0 ? "¡Gratis!" : `€${shipping.toFixed(2)}`}</span>
                </div>
                <div className="border-t border-border pt-3 flex justify-between font-bold text-lg text-foreground">
                  <span>Total</span>
                  <span className="text-primary">€{total.toFixed(2)}</span>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-semibold text-foreground mb-3">Método de pago</h3>
                <div className="space-y-2">
                  <PaymentOption
                    icon={CreditCard}
                    label={stripeEnabled ? "Tarjeta (Stripe)" : "Tarjeta"}
                    value="tarjeta"
                    selected={paymentMethod === "tarjeta"}
                    onSelect={() => setPaymentMethod("tarjeta")}
                  />
                  <PaymentOption
                    icon={Wallet}
                    label="Bizum"
                    sublabel="+34 631 18 92 44"
                    value="bizum"
                    selected={paymentMethod === "bizum"}
                    onSelect={() => setPaymentMethod("bizum")}
                  />
                  <PaymentOption
                    icon={Smartphone}
                    label="Transferencia"
                    value="transferencia"
                    selected={paymentMethod === "transferencia"}
                    onSelect={() => setPaymentMethod("transferencia")}
                  />
                  <PaymentOption
                    icon={Banknote}
                    label="Efectivo"
                    value="efectivo"
                    selected={paymentMethod === "efectivo"}
                    onSelect={() => setPaymentMethod("efectivo")}
                  />
                </div>
              </div>

              {paymentMethod === "bizum" && (
                <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                  <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-primary" />
                    Instrucciones de Pago Bizum
                  </p>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>1. Abre tu app de banca móvil</p>
                    <p>2. Selecciona Bizum → Enviar dinero</p>
                    <div className="my-3 p-3 bg-background rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Número de teléfono:</p>
                      <p className="font-mono text-base text-primary font-bold">+34 631 18 92 44</p>
                    </div>
                    <p>3. Importe: <span className="font-bold text-foreground text-base">€{total.toFixed(2)}</span></p>
                    <p>4. Concepto: <span className="italic">Pedido Herencia Floristería</span></p>
                    <div className="pt-3 mt-3 border-t border-primary/20">
                      <p className="text-xs text-foreground">
                        ✅ Una vez enviado el Bizum, haz clic en "Procesar pedido"
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleCheckout}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium"
              >
                Procesar pedido
              </button>

              <Link
                to="/productos"
                className="block w-full py-3 text-center text-primary hover:bg-primary/10 rounded-xl transition-colors mt-2"
              >
                Seguir comprando
              </Link>
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DeliveryOption({ icon: Icon, label, sublabel, value, selected, onSelect }: any) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-accent"
      }`}
    >
      <Icon className={`w-5 h-5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
      <div className="flex-1 text-left">
        <span className={`font-medium block ${selected ? "text-primary" : "text-foreground"}`}>
          {label}
        </span>
        <span className="text-xs text-muted-foreground">{sublabel}</span>
      </div>
      {selected && (
        <div className="ml-auto w-5 h-5 bg-primary rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-primary-foreground rounded-full" />
        </div>
      )}
    </button>
  );
}

function PaymentOption({ icon: Icon, label, sublabel, value, selected, onSelect }: any) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-accent"
      }`}
    >
      <Icon className={`w-5 h-5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
      <div className="flex-1 text-left">
        <span className={`font-medium block ${selected ? "text-primary" : "text-foreground"}`}>
          {label}
        </span>
        {sublabel && (
          <span className="text-xs text-muted-foreground font-mono">{sublabel}</span>
        )}
      </div>
      {selected && (
        <div className="ml-auto w-5 h-5 bg-primary rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-primary-foreground rounded-full" />
        </div>
      )}
    </button>
  );
}
