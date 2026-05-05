import { useState, useEffect } from "react";
import { Bot, ExternalLink } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { backendStorage } from "../lib/backendStorage";

export function HerencIA() {
  const [iaUrl, setIaUrl] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    const settings = backendStorage.getItem("herenciaSettings");
    if (settings) {
      const parsed = JSON.parse(settings);
      setIaUrl(parsed.url || "");
      setIsEnabled(parsed.enabled || false);
    }
  }, []);

  if (!isEnabled || !iaUrl) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 text-primary rounded-3xl mb-6">
            <Bot className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Herenc(IA) no está configurado
          </h2>
          <p className="text-muted-foreground mb-8">
            El asistente de inteligencia artificial aún no ha sido configurado. Por favor, contacta al administrador.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
          >
            Volver al inicio
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border-b border-border">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="bg-primary p-3 rounded-xl">
                <Bot className="w-8 h-8 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  Herenc(IA)
                </h1>
                <p className="text-sm text-muted-foreground">
                  Asistente de Inteligencia Artificial
                </p>
              </div>
            </div>
            <a
              href={iaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-xl hover:bg-accent transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir en nueva pestaña
            </a>
          </motion.div>
        </div>
      </div>

      {/* IA Iframe */}
      <div className="flex-1 overflow-hidden bg-background">
        <iframe
          src={iaUrl}
          className="w-full h-full border-0"
          title="Herenc(IA) - Asistente de Inteligencia Artificial"
          allow="microphone; camera; clipboard-write"
        />
      </div>
    </div>
  );
}
