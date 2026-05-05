import { useEffect, useState } from "react";
import { loadStripe, Stripe, StripeElements, StripeCardElement } from "@stripe/stripe-js";
import { CreditCard, Lock, AlertCircle, Wallet } from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../lib/backendStorage";

interface StripeCheckoutProps {
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
  customerName?: string;
  customerEmail?: string;
  deliveryMethod?: string;
  subtotal?: number;
  shipping?: number;
  metadata?: any;
}

export function StripeCheckout({
  amount,
  onSuccess,
  onCancel,
  customerName = "",
  customerEmail = "",
  deliveryMethod = "envio",
  subtotal = 0,
  shipping = 0,
  metadata = {},
}: StripeCheckoutProps) {
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [cardElement, setCardElement] = useState<StripeCardElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [cardholderName, setCardholderName] = useState(customerName);
  const [email, setEmail] = useState(customerEmail);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const initStripe = async () => {
      const settings = backendStorage.getItem("stripeSettings");
      if (!settings) return;

      const { publishableKey, enabled } = JSON.parse(settings);
      if (!enabled || !publishableKey) return;

      const stripeInstance = await loadStripe(publishableKey);
      setStripe(stripeInstance);

      if (stripeInstance) {
        const elementsInstance: StripeElements = stripeInstance.elements();
        const card = elementsInstance.create("card", {
          style: {
            base: {
              fontSize: "16px",
              color: "#1f2b1f",
              "::placeholder": { color: "#7fa88f" },
            },
            invalid: { color: "#e63946" },
          },
        });

        setCardElement(card);
        setTimeout(() => {
          const container = document.getElementById("card-element");
          if (container) card.mount("#card-element");
        }, 100);
      }
    };

    initStripe();

    return () => {
      cardElement?.unmount();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !cardElement) return toast.error("Stripe no está configurado correctamente");
    if (!cardholderName || !email) return toast.error("Completa nombre y email");

    setLoading(true);

    try {
      toast.info("Procesando pago con Stripe...", { duration: 2000 });

      const cart = JSON.parse(backendStorage.getItem("cart") || "[]");
      const { clientSecret } = await backendApi.createPaymentIntent({
        amount,
        customerEmail: email,
        customerName: cardholderName,
        deliveryMethod,
        subtotal,
        shipping,
        items: cart,
        currency: "eur",
        metadata,
      });

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: { name: cardholderName, email },
        },
      });

      if (stripeError) throw new Error(stripeError.message);

      if (paymentIntent?.status === "succeeded") {
        toast.success("Pago procesado correctamente. Pedido guardado en backend.");
        backendStorage.setItem("cart", JSON.stringify([]));
        onSuccess();
      }
    } catch (error: any) {
      const errorMsg = error.message || "Error al procesar el pago";
      setErrorMessage(errorMsg);
      setShowError(true);
      toast.error("Error al procesar el pago con tarjeta");
      console.error("Error completo:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!stripe) {
    return <div className="text-center py-8"><p className="text-muted-foreground">Cargando pasarela de pago...</p></div>;
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-6">
        <div className="bg-primary/10 p-2 rounded-lg"><CreditCard className="w-5 h-5 text-primary" /></div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Pago con Tarjeta</h3>
          <p className="text-sm text-muted-foreground">Procesado de forma segura con Stripe</p>
        </div>
      </div>

      {showError && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
          <div className="flex items-start gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive mb-1">Error al procesar el pago con tarjeta</p>
              <p className="text-xs text-muted-foreground whitespace-pre-line">{errorMessage}</p>
            </div>
          </div>
          <div className="pt-3 border-t border-destructive/20">
            <div className="flex items-center gap-2 mb-2"><Wallet className="w-4 h-4 text-primary" /><p className="text-sm font-medium text-foreground">Puedes volver y elegir Bizum</p></div>
            <button type="button" onClick={onCancel} className="mt-3 w-full py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm">Volver al resumen</button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Nombre en la tarjeta</label>
          <input type="text" value={cardholderName} onChange={(e) => setCardholderName(e.target.value)} required className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Información de tarjeta</label>
          <div id="card-element" className="w-full px-4 py-3 bg-background border border-border rounded-xl" />
        </div>

        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="flex items-start gap-2">
            <Lock className="w-4 h-4 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Pago seguro con Stripe</p>
              <p className="text-xs text-muted-foreground mt-1">Tus datos de tarjeta no pasan por Herencia Floristería.</p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-4">
            <span className="text-foreground font-medium">Total a pagar:</span>
            <span className="text-2xl font-bold text-primary">€{amount.toFixed(2)}</span>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed">{loading ? "Procesando..." : `Pagar €${amount.toFixed(2)}`}</button>
            <button type="button" onClick={onCancel} disabled={loading} className="px-6 py-3 bg-muted text-foreground rounded-xl hover:bg-accent transition-colors disabled:opacity-50">Cancelar</button>
          </div>
        </div>
      </form>
    </div>
  );
}
