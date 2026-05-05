import { Link } from "react-router";
import { Home, Leaf } from "lucide-react";
import { motion } from "motion/react";
import logo from "figma:asset/8c5f2b4f88c45fd4812e5bb91610bff5272333d7.png";

export function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center justify-center mb-6">
          <img
            src={logo}
            alt="Herencia Floristería"
            className="h-24 w-auto opacity-50"
          />
        </div>
        <h1 className="text-6xl font-bold text-foreground mb-4">404</h1>
        <h2 className="text-2xl font-bold text-foreground mb-4">Página no encontrada</h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Lo sentimos, la página que buscas no existe o ha sido movida.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
        >
          <Home className="w-4 h-4" />
          Volver al inicio
        </Link>
      </motion.div>
    </div>
  );
}
