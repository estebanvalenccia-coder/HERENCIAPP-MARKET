import { useEffect, useRef, useState } from "react";
import { loadStripe, Stripe, StripeElements } from "@stripe/stripe-js";
import { CreditCard, Lock, AlertCircle, Wallet } from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../lib/backendStorage";

interface StripeCheckoutProps {
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
  paymentMethod?: string;
  customerName?: string;
  customerEmail?: string;
  deliveryMethod?: string;
  subtotal?: number;
  shipping?: number;
  metadata?: any;
}

const alternativePaymentBadges = [
  { label: "Klarna", className: "bg-pink-100 text-pink-950" },
  { label: "amazon pay", className: "bg-white text-foreground" },
  { label: " Pay", className: "bg-white text-foreground" },
  { label: "G Pay", className: "bg-white text-foreground" },
  { label: "link", className: "bg-white text-foreground" },
];

export function StripeCheckout({
  amount,
  onSuccess,
  onCancel,
  paymentMethod = "tarjeta",
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
  const mountedElement = useRef<any>(null);
  const orderIdRef = useRef<string>("");
  const paymentIntentIdRef = useRef<string>("");
  const isBizum = paymentMethod === "bizum";

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
        const paymentIntentResponse = await backendApi.createPaymentIntent({
          amount,
          customerEmail: email,
          customerName: cardholderName,
          deliveryMethod,
          subtotal,
          shipping,
          items: cart,
          currency: "eur",
          paymentMethod,
          metadata: {
            ...metadata,
            requestedPaymentMethod: paymentMethod,
          },
        });

        const { clientSecret, orderId, paymentIntentId } = paymentIntentResponse;
        orderIdRef.current = orderId || "";
        paymentIntentIdRef.current = paymentIntentId || "";

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

        const paymentElement = elementsInstance.create("payment", { layout: "accordion" });
        paymentElement.mount("#payment-element");
        mountedElement.current = paymentElement;

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

    return () => {
      try {
        mountedElement.current?.unmount?.();
      } catch {}
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowError(false);
    setErrorMessage("");

    if (!stripe || !elements) return toast.error("Stripe no está listo todavía");
    if (!cardholderName || !email) return toast.error("Completa nombre y email");

    setLoading(true);

    try {
      const submitResult = await elements.submit();
      if (submitResult.error) throw new Error(submitResult.error.message);

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
        redirect: "if_required",
      });

      if (error) throw new Error(error.message);

      if (!paymentIntent || paymentIntent.status === "succeeded" || paymentIntent.status === "processing") {
        const orderId = orderIdRef.current;
        const paymentIntentId = paymentIntent?.id || paymentIntentIdRef.current;

        if (orderId && paymentIntentId) {
          await backendApi.confirmStripeOrder({ orderId, paymentIntentId });
        }

        backendStorage.setItem("cart", JSON.stringify([]));
        toast.success("Pago confirmado. Te enviaremos la confirmación por email.");
        onSuccess();
        return;
      }

      if (paymentIntent.status === "requires_action") {
        toast.info("Completa la autorización en tu banco para confirmar el pago.");
        return;
      }

      throw new Error(`Stripe devolvió estado: ${paymentIntent.status}`);
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
          <p className="text-sm text-muted-foreground">{isBizum ? "Pago con Bizum" : "Tarjeta y pagos rápidos disponibles"}</p>
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
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-foreground">Método de pago</label>
            <div className="hidden sm:flex items-center gap-1 text-xs font-medium text-primary">
              <Lock className="w-3.5 h-3.5" />
              Pago seguro con Stripe
            </div>
          </div>
          <div id="payment-element" className="min-h-[80px]" />
          {initializing && <p className="text-sm text-muted-foreground mt-2">Cargando métodos de pago...</p>}
        </div>

        <div className="group pt-1">
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
            <div className="h-px bg-border flex-1" />
            <span>Más formas de pago</span>
            <div className="h-px bg-border flex-1" />
          </div>
          <div className="overflow-hidden rounded-xl border border-border/70 bg-muted/20 transition-all duration-300 max-h-10 group-hover:max-h-32 group-focus-within:max-h-32">
            <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto">
              {alternativePaymentBadges.map((badge) => (
                <div key={badge.label} className={`min-w-fit px-3 h-7 rounded-lg border border-border flex items-center justify-center text-xs font-bold shadow-sm ${badge.className}`}>
                  {badge.label}
                </div>
              ))}
            </div>
            <p className="px-3 pb-3 text-center text-xs text-muted-foreground">
              Disponibles según método elegido, dispositivo, navegador y configuración de Stripe.
            </p>
          </div>
        </div>

        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="flex items-start gap-2">
            <Lock className="w-4 h-4 text-primary mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Pago seguro</p>
              <p className="text-xs text-muted-foreground mt-1">{isBizum ? "Stripe abrirá el flujo de Bizum. El pedido solo se confirma cuando Stripe confirme el pago real." : "El pedido solo se confirma cuando Stripe confirme el pago real."}</p>
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
