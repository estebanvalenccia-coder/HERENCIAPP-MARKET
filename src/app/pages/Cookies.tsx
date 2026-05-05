import { motion } from "motion/react";
import { Cookie } from "lucide-react";

export function Cookies() {
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
              <Cookie className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              Política de Cookies
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
            <h2 className="text-2xl font-bold mb-4">¿Qué son las Cookies?</h2>
            <p className="text-muted-foreground">
              Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando visitas nuestro sitio web.
              Nos ayudan a proporcionar una mejor experiencia de usuario, recordar tus preferencias y analizar cómo utilizas
              nuestro sitio.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Tipos de Cookies que Utilizamos</h2>

            <div className="space-y-6">
              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-3">1. Cookies Esenciales</h3>
                <p className="text-muted-foreground mb-2">
                  Necesarias para el funcionamiento básico del sitio web.
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm">
                  <li>Autenticación de usuarios</li>
                  <li>Carrito de compras</li>
                  <li>Preferencias de seguridad</li>
                </ul>
              </div>

              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-3">2. Cookies de Rendimiento</h3>
                <p className="text-muted-foreground mb-2">
                  Nos ayudan a entender cómo los visitantes interactúan con nuestro sitio.
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm">
                  <li>Análisis de tráfico web</li>
                  <li>Páginas más visitadas</li>
                  <li>Tiempo de permanencia</li>
                </ul>
              </div>

              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-3">3. Cookies Funcionales</h3>
                <p className="text-muted-foreground mb-2">
                  Permiten recordar tus preferencias y opciones.
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm">
                  <li>Idioma preferido</li>
                  <li>Región o ubicación</li>
                  <li>Configuración de tema (claro/oscuro)</li>
                </ul>
              </div>

              <div className="bg-card border border-border rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-3">4. Cookies de Marketing</h3>
                <p className="text-muted-foreground mb-2">
                  Utilizadas para mostrar anuncios relevantes.
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground text-sm">
                  <li>Personalización de ofertas</li>
                  <li>Seguimiento de campañas publicitarias</li>
                  <li>Remarketing</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Gestión de Cookies</h2>
            <p className="text-muted-foreground mb-4">
              Puedes controlar y gestionar las cookies de las siguientes maneras:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>A través de la configuración de tu navegador</li>
              <li>Usando nuestro panel de preferencias de cookies</li>
              <li>Eliminando cookies almacenadas en tu dispositivo</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Ten en cuenta que deshabilitar ciertas cookies puede afectar la funcionalidad del sitio web.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Cookies de Terceros</h2>
            <p className="text-muted-foreground">
              Algunos de nuestros socios de servicio pueden establecer cookies en tu dispositivo:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-4">
              <li>Google Analytics - para análisis web</li>
              <li>Procesadores de pago - para transacciones seguras</li>
              <li>Redes sociales - para compartir contenido</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mb-4">Contacto</h2>
            <p className="text-muted-foreground">
              Si tienes preguntas sobre nuestra política de cookies, contáctanos en:
            </p>
            <p className="text-muted-foreground mt-2">
              Email: cookies@herenciafloristeria.com<br />
              Teléfono: +1 234 567 8900
            </p>
          </section>
        </motion.div>
      </div>
    </div>
  );
}
