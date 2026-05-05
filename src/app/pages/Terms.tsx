import { motion } from "motion/react";
import { FileText } from "lucide-react";

export function Terms() {
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
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              Términos y Condiciones
            </h1>
          </motion.div>
          <p className="text-muted-foreground">
            Última actualización: 10 de abril de 2026
          </p>
        </div>
      </div>

      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-8 text-foreground"
        >
          <section>
            <h2 className="text-2xl font-bold mb-4">1. Aceptación de los Términos</h2>
            <p className="text-muted-foreground">
              Al acceder y utilizar el sitio web de Herencia Floristería, aceptas estar sujeto a estos términos y condiciones,
              todas las leyes y regulaciones aplicables. Si no estás de acuerdo con alguno de estos términos, se te prohíbe
              usar o acceder a este sitio.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">2. Uso del Sitio Web</h2>
            <p className="text-muted-foreground mb-4">
              Al utilizar nuestro sitio web, te comprometes a:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Proporcionar información veraz y actualizada</li>
              <li>Mantener la confidencialidad de tu cuenta</li>
              <li>No utilizar el sitio para fines ilegales o no autorizados</li>
              <li>No interferir con el funcionamiento del sitio</li>
              <li>Respetar los derechos de propiedad intelectual</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">3. Productos y Servicios</h2>
            <p className="text-muted-foreground mb-4">
              Nuestros productos y servicios están sujetos a las siguientes condiciones:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Todos los precios están en dólares estadounidenses y pueden cambiar sin previo aviso</li>
              <li>Las imágenes de productos son representativas y pueden variar ligeramente</li>
              <li>Nos reservamos el derecho de limitar cantidades de productos</li>
              <li>La disponibilidad de productos está sujeta a existencias</li>
              <li>Los productos perecederos (flores y plantas) tienen garantías específicas</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">4. Pedidos y Pagos</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">4.1 Procesamiento de Pedidos</h3>
                <p className="text-muted-foreground">
                  Todos los pedidos están sujetos a aceptación y disponibilidad. Nos reservamos el derecho de rechazar
                  cualquier pedido por cualquier motivo.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">4.2 Métodos de Pago</h3>
                <p className="text-muted-foreground">
                  Aceptamos tarjetas de crédito/débito, transferencias bancarias y efectivo en entrega. Todos los pagos
                  se procesan de forma segura.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">4.3 Confirmación</h3>
                <p className="text-muted-foreground">
                  Recibirás una confirmación por correo electrónico una vez que se procese tu pedido.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">5. Envío y Entrega</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Los tiempos de entrega son estimados y pueden variar</li>
              <li>Envío gratuito en pedidos superiores a $50</li>
              <li>Debes proporcionar una dirección de entrega válida</li>
              <li>No somos responsables de entregas fallidas por información incorrecta</li>
              <li>Productos perecederos requieren que alguien esté presente para recibir</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">6. Devoluciones y Reembolsos</h2>
            <p className="text-muted-foreground mb-4">
              Nuestra política de devoluciones:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Productos defectuosos: reemplazo gratuito dentro de 48 horas</li>
              <li>Flores y plantas frescas: garantía de frescura de 7 días</li>
              <li>Productos no perecederos: devolución dentro de 14 días</li>
              <li>Reembolsos procesados en 5-10 días hábiles</li>
              <li>Los gastos de envío no son reembolsables (excepto por productos defectuosos)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">7. Propiedad Intelectual</h2>
            <p className="text-muted-foreground">
              Todo el contenido de este sitio web, incluyendo texto, gráficos, logos, imágenes y software, es propiedad
              de Herencia Floristería y está protegido por las leyes de propiedad intelectual. No puedes reproducir,
              distribuir o modificar ningún contenido sin autorización escrita.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">8. Limitación de Responsabilidad</h2>
            <p className="text-muted-foreground">
              Herencia Floristería no será responsable de daños indirectos, incidentales, especiales o consecuentes que
              resulten del uso o la imposibilidad de usar nuestros productos o servicios. Nuestra responsabilidad total
              no excederá el monto pagado por el producto o servicio en cuestión.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">9. Modificaciones</h2>
            <p className="text-muted-foreground">
              Nos reservamos el derecho de modificar estos términos y condiciones en cualquier momento. Los cambios
              entrarán en vigor inmediatamente después de su publicación en el sitio web. Es tu responsabilidad revisar
              periódicamente estos términos.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">10. Ley Aplicable</h2>
            <p className="text-muted-foreground">
              Estos términos se rigen por las leyes aplicables del país/estado donde opera Herencia Floristería.
              Cualquier disputa será resuelta en los tribunales competentes de dicha jurisdicción.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">11. Contacto</h2>
            <p className="text-muted-foreground">
              Para preguntas sobre estos términos y condiciones, contáctanos:
            </p>
            <p className="text-muted-foreground mt-2">
              Email: legal@herenciafloristeria.com<br />
              Teléfono: +1 234 567 8900<br />
              Dirección: [Tu dirección física]
            </p>
          </section>
        </motion.div>
      </div>
    </div>
  );
}
