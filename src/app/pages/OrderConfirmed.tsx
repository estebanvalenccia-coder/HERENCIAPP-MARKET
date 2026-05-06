import { Link } from "react-router";
import { CheckCircle, Mail, ShoppingBag } from "lucide-react";

export function OrderConfirmed() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full bg-card border border-border rounded-3xl p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle className="w-9 h-9 text-primary" />
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-3">Pedido recibido correctamente</h1>
        <p className="text-muted-foreground leading-relaxed mb-6">
          Gracias por confiar en Herencia Floristería. Si el pago se ha confirmado, recibirás un email con el resumen del pedido. También te contactaremos si necesitamos confirmar algún detalle de entrega o recogida.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left mb-8">
          <div className="bg-muted/40 rounded-2xl p-4">
            <Mail className="w-5 h-5 text-primary mb-2" />
            <p className="font-semibold text-foreground">Revisa tu email</p>
            <p className="text-sm text-muted-foreground">Te enviaremos la confirmación y el resumen de compra.</p>
          </div>
          <div className="bg-muted/40 rounded-2xl p-4">
            <ShoppingBag className="w-5 h-5 text-primary mb-2" />
            <p className="font-semibold text-foreground">Prepararemos tu pedido</p>
            <p className="text-sm text-muted-foreground">Gestionaremos la entrega o recogida según lo elegido.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/productos" className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors">
            Seguir comprando
          </Link>
          <Link to="/" className="px-6 py-3 bg-muted text-foreground rounded-xl font-medium hover:bg-accent transition-colors">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
