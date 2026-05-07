import { useState, useEffect } from "react";
import { Bot, ExternalLink, Lock, Mail, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { backendApi, backendStorage } from "../lib/backendStorage";
import {
  getHerenciaIaAccessMessage,
  getHerenciaIaDailyLimit,
  HERENCIA_IA_ACCESS_RULES,
} from "../lib/herenciaIaAccess";

const todayKey = () => new Date().toISOString().slice(0, 10);

function getUsageKey(email: string) {
  const identity = email.trim().toLowerCase() || "visitor";
  return `herencia-ia-usage:${todayKey()}:${identity}`;
}

function readUsage(email: string) {
  return Number(localStorage.getItem(getUsageKey(email)) || 0);
}

function writeUsage(email: string, value: number) {
  localStorage.setItem(getUsageKey(email), String(value));
}

export function HerencIA() {
  const [iaUrl, setIaUrl] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const [totalPaid, setTotalPaid] = useState(0);
  const [usedMessages, setUsedMessages] = useState(0);
  const [accessStarted, setAccessStarted] = useState(false);
  const [checkingCustomer, setCheckingCustomer] = useState(false);
  const [automaticStatus, setAutomaticStatus] = useState(false);

  useEffect(() => {
    const settings = backendStorage.getItem("herenciaSettings");
    if (settings) {
      const parsed = JSON.parse(settings);
      setIaUrl(parsed.url || "");
      setIsEnabled(parsed.enabled || false);
    }

    const savedEmail = localStorage.getItem("herencia-ia-email") || "";
    setEmail(savedEmail);
    setUsedMessages(readUsage(savedEmail));
  }, []);

  useEffect(() => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setTotalPaid(0);
      setAutomaticStatus(false);
      return;
    }

    let cancelled = false;
    setCheckingCustomer(true);

    backendApi.getHerenciaIaCustomerStatus(normalizedEmail)
      .then(({ totalPaid }) => {
        if (cancelled) return;
        setTotalPaid(Number(totalPaid || 0));
        setAutomaticStatus(true);
      })
      .catch(() => {
        if (cancelled) return;
        setTotalPaid(0);
        setAutomaticStatus(false);
      })
      .finally(() => {
        if (!cancelled) setCheckingCustomer(false);
      });

    return () => {
      cancelled = true;
    };
  }, [email]);

  const dailyLimit = getHerenciaIaDailyLimit(email);
  const remainingMessages = Math.max(0, dailyLimit - usedMessages);
  const isVip = !email || totalPaid >= HERENCIA_IA_ACCESS_RULES.vipMinimumSpend;
  const canOpenIa = remainingMessages > 0 && isVip && !checkingCustomer;
  const accessMessage = checkingCustomer
    ? "Comprobando compras pagadas del cliente..."
    : getHerenciaIaAccessMessage({ email, totalPaid, remainingMessages });

  const handleEmailChange = (value: string) => {
    setEmail(value);
    localStorage.setItem("herencia-ia-email", value);
    setUsedMessages(readUsage(value));
  };

  const startHerenciaIa = () => {
    if (!canOpenIa) return;

    const nextUsage = usedMessages + 1;
    writeUsage(email, nextUsage);
    setUsedMessages(nextUsage);
    setAccessStarted(true);
  };

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

  if (!accessStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/10 px-4 py-12">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_420px]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-border bg-card p-8 shadow-xl"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              Acceso premium controlado
            </div>

            <h1 className="mb-4 text-4xl font-bold text-foreground">Herenc(IA)</h1>
            <p className="mb-8 max-w-2xl text-lg text-muted-foreground">
              Tu asistente de flores, plantas, ramos y regalos. Para proteger el servicio, cada visitante tiene mensajes limitados y los mejores clientes tienen acceso preferente.
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-muted/50 p-5">
                <p className="text-sm text-muted-foreground">Visitante</p>
                <p className="text-2xl font-bold text-foreground">2</p>
                <p className="text-xs text-muted-foreground">mensajes/día</p>
              </div>
              <div className="rounded-2xl bg-muted/50 p-5">
                <p className="text-sm text-muted-foreground">Cliente</p>
                <p className="text-2xl font-bold text-foreground">5</p>
                <p className="text-xs text-muted-foreground">mensajes/día</p>
              </div>
              <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
                <p className="text-sm opacity-80">VIP</p>
                <p className="text-2xl font-bold">+50 €</p>
                <p className="text-xs opacity-80">en compras pagadas</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-3xl border border-border bg-card p-6 shadow-xl"
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-2xl bg-primary p-3 text-primary-foreground">
                <Bot className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Entrar a Herenc(IA)</h2>
                <p className="text-sm text-muted-foreground">Control de uso diario</p>
              </div>
            </div>

            <label className="mb-4 block">
              <span className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                <Mail className="h-4 w-4" />
                Email de cliente opcional
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => handleEmailChange(event.target.value)}
                placeholder="cliente@email.com"
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 outline-none transition focus:ring-2 focus:ring-primary/50"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Si no escribes email, entras como visitante con 2 mensajes diarios.
              </p>
            </label>

            {email && (
              <div className="mb-4 rounded-2xl bg-muted/50 p-4">
                <p className="text-sm font-medium text-foreground">Estado del cliente</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {checkingCustomer
                    ? "Comprobando pedidos pagados..."
                    : automaticStatus
                      ? `Compras pagadas detectadas: ${totalPaid.toFixed(2)} €`
                      : "No se pudo comprobar automáticamente todavía. El acceso premium queda bloqueado por seguridad."}
                </p>
              </div>
            )}

            <div className={`mb-5 rounded-2xl p-4 ${canOpenIa ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
              <div className="mb-1 flex items-center gap-2 font-semibold">
                {!canOpenIa && <Lock className="h-4 w-4" />}
                {canOpenIa ? "Acceso disponible" : "Acceso limitado"}
              </div>
              <p className="text-sm">{accessMessage}</p>
              <p className="mt-2 text-sm font-medium">
                Te quedan {remainingMessages} de {dailyLimit} mensajes hoy.
              </p>
            </div>

            <button
              onClick={startHerenciaIa}
              disabled={!canOpenIa}
              className="w-full rounded-2xl bg-primary px-5 py-4 font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Abrir Herenc(IA)
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
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
                  Te quedan {Math.max(0, dailyLimit - usedMessages)} mensajes hoy
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
