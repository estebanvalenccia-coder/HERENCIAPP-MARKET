import { useEffect, useState } from "react";
import { loadStripe, Stripe, StripeElements } from "@stripe/stripe-js";
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
  const [elements, setElements] = useState<StripeElements | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [cardholderName, setCardholderName] = useState(customerName);
  const [email, setEmail] = useState(customerEmail);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const initStripe = async () => {
      try {
        const settings = backendStorage.getItem("stripeSettings");
        if (!settings) throw new Error("Stripe no está configurado en ajustes");

        const { publishableKey, enabled } = JSON.parse(settings);
        if (!enabled || !publishableKey) throw new Error("Stripe no está habilitado");

        const stripeInstance = await loadStripe(publishableKey);
        if (!stripeInstance) throw new Error("No se pudo cargar Stripe");

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

        const elementsInstance = stripeInstance.elements({
          clientSecret,
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#2f6b3f",
              colorText: "#1f2b1f",
              borderRadius: "12px",
            },
          },
        });

        const paymentElement = elementsInstance.create("payment", {
          layout: "accordion",
        });

        paymentElement.mount("#payment-element");
        setStripe(stripeInstance);
        setElements(elementsInstance);
      } catch (error: any) {
        console.error(error);
        setErrorMessage(error.message || "No se pudo iniciar Stripe");
        setShowError(true);
      } finally {
        setInitializing(false);
      }
    };

    initStripe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return toast.error("Stripe no está listo todavía");
    if (!cardholderName || !email) return toast.error("Completa nombre y email");

    setLoading(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/pedido-confirmado`,
          payment_method_data: {
            billing_details: {
              name: cardholderName,
              email,
            },
          },
        },
      });

      if (error) throw new Error(error.message);

      if (paymentIntent?.status === "succeeded") {
        backendStorage.setItem("cart", JSON.stringify([]));
        toast.success("Pago confirmado correctamente. Te enviaremos confirmación por email.");
        onSuccess();
        return;
      }

      toast.info("Pago pendiente de confirmación. No se marcará como pagado hasta que Stripe lo confirme.");
    } catch (error: any) {
      const errorMsg = error.message || "Error al procesar el pago";
      setErrorMessage(errorMsg);
      setShowError(true);
      toast.error("Error al procesar el pago");
      console.error("Error completo:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-6">
        <div className="bg-primary/10 p-2 rounded-lg"><CreditCard className="w-5 h-5 text-primary" /></div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Pago seguro con Stripe</h3>
          <p className="text-sm text-muted-foreground">Tarjeta y Bizum si está activado en Stripe</p>
        </div>
      </div>

      {showError && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
          <div className="flex items-start gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive mb-1">Error al procesar el pago</p>
              <p className="text-xs text-muted-foreground whitespace-pre-line">{errorMessage}</p>
            </div>
          </div>
          <div className="pt-3 border-t border-destructive/20">
            <div className="flex items-center gap-2 mb-2"><Wallet className="w-4 h-4 text-primary" /><p className="text-sm font-medium text-foreground">Puedes volver y elegir otro método</p></div>
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
          <label className="block text-sm font-medium text-foreground mb-2">Nombre</label>
          <input type="text" value={cardholderName} onChange={(e) => setCardholderName(e.target.value)} required className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Método de pago</label>
          <div id="payment-element" className="min-h-[80px]" />
          {initializing && <p className="text-sm text-muted-foreground mt-2">Cargando métodos de pago...</p>}
        </div>

        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="flex items-start gap-2">
            <Lock className="w-4 h-4 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Pago seguro</p>
              <p className="text-xs text-muted-foreground mt-1">Si eliges Bizum, Stripe abrirá el flujo del banco. El pedido solo se confirma cuando Stripe confirme el pago real.</p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-4">
            <span className="text-foreground font-medium">Total a pagar:</span>
            <span className="text-2xl font-bold text-primary">€{amount.toFixed(2)}</span>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={loading || initializing} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed">{loading ? "Procesando..." : `Pagar €${amount.toFixed(2)}`}</button>
            <button type="button" onClick={onCancel} disabled={loading} className="px-6 py-3 bg-muted text-foreground rounded-xl hover:bg-accent transition-colors disabled:opacity-50">Cancelar</button>
          </div>
        </div>
      </form>
    </div>
  );
}
