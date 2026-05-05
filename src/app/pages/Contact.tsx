import { motion } from "motion/react";
import { MapPin, Phone, MessageCircle, Clock, Mail } from "lucide-react";

export function Contact() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-muted/30 border-b border-border">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Contacto
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Estamos aquí para ayudarte. Visítanos, llámanos o escríbenos.
          </p>
        </div>
      </div>

      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Botones de Contacto */}
          <div className="space-y-6">
            <motion.a
              href="https://wa.me/34624239598"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="block bg-gradient-to-r from-green-500 to-green-600 text-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="p-4 bg-white/20 rounded-xl">
                  <MessageCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-1">WhatsApp</h3>
                  <p className="text-white/90 text-lg">+34 624 23 95 98</p>
                  <p className="text-white/70 text-sm mt-1">Haz clic para abrir chat</p>
                </div>
              </div>
            </motion.a>

            <motion.a
              href="tel:+34624239598"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="block bg-gradient-to-r from-primary to-secondary text-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="p-4 bg-white/20 rounded-xl">
                  <Phone className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-1">Teléfono</h3>
                  <p className="text-white/90 text-lg">+34 624 23 95 98</p>
                  <p className="text-white/70 text-sm mt-1">Haz clic para llamar</p>
                </div>
              </div>
            </motion.a>

            <motion.a
              href="https://maps.app.goo.gl/WLihx3aD1Xhqc9WT8"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="block bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="p-4 bg-white/20 rounded-xl">
                  <MapPin className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-1">Ubicación</h3>
                  <p className="text-white/90 text-lg">Cómo llegar</p>
                  <p className="text-white/70 text-sm mt-1">Ver en Google Maps</p>
                </div>
              </div>
            </motion.a>
          </div>

          {/* Información Adicional */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-card border border-border rounded-2xl p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Horario</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-foreground">
                  <span className="font-medium">Lunes - Viernes</span>
                  <span className="text-muted-foreground">9:00 - 20:00</span>
                </div>
                <div className="flex justify-between text-foreground">
                  <span className="font-medium">Sábado</span>
                  <span className="text-muted-foreground">9:00 - 14:00</span>
                </div>
                <div className="flex justify-between text-foreground">
                  <span className="font-medium">Domingo</span>
                  <span className="text-muted-foreground">Cerrado</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-card border border-border rounded-2xl p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Dirección</h3>
              </div>
              <p className="text-foreground leading-relaxed mb-4">
                Herencia Floristería
              </p>
              <a
                href="https://maps.app.goo.gl/WLihx3aD1Xhqc9WT8"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <MapPin className="w-4 h-4" />
                Ver en Google Maps
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-gradient-to-br from-primary/5 to-secondary/5 border border-border rounded-2xl p-8"
            >
              <h3 className="text-xl font-bold text-foreground mb-4">
                ¿Necesitas ayuda?
              </h3>
              <p className="text-muted-foreground mb-4">
                Nuestro equipo está disponible para ayudarte con:
              </p>
              <ul className="space-y-2 text-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Asesoramiento sobre plantas</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Pedidos especiales</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Servicios de jardinería</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Entregas a domicilio</span>
                </li>
              </ul>
            </motion.div>
          </div>
        </div>

        {/* Mapa */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 rounded-2xl overflow-hidden shadow-lg"
        >
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3037.5!2d-3.7!3d40.4!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDDCsDI0JzAwLjAiTiAzwrA0MicwMC4wIlc!5e0!3m2!1sen!2ses!4v1234567890"
            width="100%"
            height="450"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Ubicación de Herencia Floristería"
          />
        </motion.div>
      </div>
    </div>
  );
}
