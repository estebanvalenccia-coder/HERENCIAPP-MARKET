import { motion, AnimatePresence } from "motion/react";
import { MessageCircle, X } from "lucide-react";
import { useState } from "react";

export function WhatsAppButton() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <div className="fixed bottom-6 right-6 z-50">
        <motion.a
          href="https://wa.me/34624239598"
          target="_blank"
          rel="noopener noreferrer"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="relative flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-full shadow-2xl shadow-green-500/30 hover:shadow-green-500/60 transition-all"
          aria-label="Contactar por WhatsApp"
          style={{
            filter: 'drop-shadow(0 10px 20px rgba(34, 197, 94, 0.4))'
          }}
        >
          <MessageCircle className="w-8 h-8" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse" />
        </motion.a>

        {/* Botón de cerrar */}
        <motion.button
          onClick={() => setIsVisible(false)}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="absolute -top-2 -left-2 w-7 h-7 bg-gray-800 hover:bg-gray-900 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
          aria-label="Cerrar botón de WhatsApp"
        >
          <X className="w-4 h-4" />
        </motion.button>
      </div>
    </AnimatePresence>
  );
}
