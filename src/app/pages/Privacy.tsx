import { motion } from "motion/react";
import { Shield } from "lucide-react";

export function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-muted/30 border-b border-border">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 mb-4"
          >
            <div className="bg-primary/10 p-3 rounded-xl">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              Política de Privacidad
            </h1>
          </motion.div>
          <p className="text-muted-foreground">
            Última actualización: 3 de octubre de 2026
          </p>
        </div>
      </div>

      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="prose prose-sm sm:prose-base max-w-none"
        >
          <div className="space-y-8 text-foreground">
            <section>
              <h2 className="text-2xl font-bold mb-4">1. Información que Recopilamos</h2>
              <p className="text-muted-foreground mb-4">
                En Herencia Floristería, recopilamos la siguiente información cuando utilizas nuestros servicios:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Información personal: nombre, correo electrónico, teléfono</li>
                <li>Dirección de entrega para pedidos</li>
                <li>Información de pago (procesada de forma segura)</li>
                <li>Historial de pedidos y preferencias</li>
                <li>Datos de navegación y cookies</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">2. Uso de la Información</h2>
              <p className="text-muted-foreground mb-4">
                Utilizamos tu información para:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Procesar y entregar tus pedidos</li>
                <li>Comunicarnos contigo sobre tus pedidos y servicios</li>
                <li>Mejorar nuestros productos y servicios</li>
                <li>Enviarte ofertas y promociones (con tu consentimiento)</li>
                <li>Cumplir con obligaciones legales</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">3. Protección de Datos</h2>
              <p className="text-muted-foreground">
                Aplicamos medidas técnicas y organizativas destinadas a proteger la información personal frente a
                accesos no autorizados, pérdida, alteración o divulgación. Las comunicaciones con la web se realizan
                mediante HTTPS y los datos de pago sensibles son tratados por el proveedor de pagos, no por el navegador de Herencia.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">4. Compartir Información</h2>
              <p className="text-muted-foreground mb-4">
                No vendemos ni alquilamos tu información personal a terceros. Podemos compartir información con:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Proveedores necesarios para prestar el servicio, como pagos, email, alojamiento, base de datos y reparto</li>
                <li>Proveedores de inteligencia artificial únicamente cuando una función solicitada lo requiera</li>
                <li>Autoridades u organismos cuando exista una obligación legal</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">5. Tus Derechos</h2>
              <p className="text-muted-foreground mb-4">
                Tienes derecho a:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Acceder a tu información personal</li>
                <li>Corregir datos inexactos</li>
                <li>Solicitar la eliminación de tus datos</li>
                <li>Oponerte al procesamiento de tus datos</li>
                <li>Retirar tu consentimiento en cualquier momento</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">6. Cookies</h2>
              <p className="text-muted-foreground">
                Utilizamos cookies para mejorar tu experiencia de navegación. Puedes gestionar las preferencias de
                cookies en la configuración de tu navegador. Para más información, consulta nuestra Política de Cookies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">7. Contacto</h2>
              <p className="text-muted-foreground">
                Si tienes preguntas sobre esta política de privacidad o deseas ejercer tus derechos, contáctanos en:
              </p>
              <p className="text-muted-foreground mt-2">
                Utiliza los canales publicados en la página de Contacto e indica que tu solicitud está relacionada con privacidad o protección de datos.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
