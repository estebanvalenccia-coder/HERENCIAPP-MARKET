import { useEffect, useMemo, useState } from "react";
import { Bot, ExternalLink, Loader2, Lock, Mail, Sparkles } from "lucide-react";
import { backendApi, backendStorage } from "../lib/backendStorage";
import {
  getHerenciaIaAccessMessage,
  getHerenciaIaDailyLimit,
  isHerenciaIaVip,
} from "../lib/herenciaIaAccess";

type HerenciaSettings = {
  enabled?: boolean;
  url?: string;
  mode?: "integrated" | "external";
  useIntegrated?: boolean;
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const usageKey = (identity: string) => `herencia-ia-usage:${todayKey()}:${identity || "visitor"}`;

function readUsage(identity: string) {
  try {
    return Math.max(0, Number(localStorage.getItem(usageKey(identity)) || 0));
  } catch {
    return 0;
  }
}

function writeUsage(identity: string, value: number) {
  try {
    localStorage.setItem(usageKey(identity), String(Math.max(0, value)));
  } catch {}
}

export function HerencIA() {
  const [settings, setSettings] = useState<HerenciaSettings>({
    enabled: true,
    mode: "integrated",
    useIntegrated: true,
  });
  const [groqOk, setGroqOk] = useState<boolean | null>(null);
  const [groqModel, setGroqModel] = useState("");
  const [email, setEmail] = useState("");
  const [registered, setRegistered] = useState(false);
  const [plantSpend, setPlantSpend] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [checkingCustomer, setCheckingCustomer] = useState(false);
  const [customerChecked, setCustomerChecked] = useState(false);
  const [usedMessages, setUsedMessages] = useState(0);
  const [accessStarted, setAccessStarted] = useState(false);

  useEffect(() => {
    const load = () => {
      try {
        const parsed = JSON.parse(backendStorage.getItem("herenciaSettings") || "{}");
        const useIntegrated = parsed.useIntegrated !== false && parsed.mode !== "external";
        setSettings({
          enabled: parsed.enabled !== false,
          url: String(parsed.url || ""),
          mode: useIntegrated ? "integrated" : "external",
          useIntegrated,
        });
      } catch {
        setSettings({ enabled: true, mode: "integrated", useIntegrated: true });
      }
    };
    load();

    try {
      setEmail(localStorage.getItem("herencia-ia-email") || "");
    } catch {}

    window.addEventListener("storage", load);
    window.addEventListener("backend-storage", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("backend-storage", load);
    };
  }, []);

  useEffect(() => {
    if (settings.mode !== "integrated") return;
    let active = true;
    setGroqOk(null);
    fetch("/api/herencia-ai/status", { credentials: "include" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "Estado no disponible");
        if (active) {
          setGroqOk(Boolean(data?.ok));
          setGroqModel(String(data?.model || ""));
        }
      })
      .catch(() => active && setGroqOk(false));
    return () => {
      active = false;
    };
  }, [settings.mode]);

  useEffect(() => {
    const normalized = normalizeEmail(email);
    setAccessStarted(false);

    if (!normalized) {
      setRegistered(false);
      setPlantSpend(0);
      setTotalPaid(0);
      setCustomerChecked(true);
      setCheckingCustomer(false);
      setUsedMessages(readUsage("visitor"));
      return;
    }

    let cancelled = false;
    setCheckingCustomer(true);
    setCustomerChecked(false);

    backendApi
      .getHerenciaIaCustomerStatus(normalized)
      .then((status) => {
        if (cancelled) return;
        const isRegistered = Boolean(status.registered);
        setRegistered(isRegistered);
        setPlantSpend(Number(status.plantSpend || 0));
        setTotalPaid(Number(status.totalPaid || 0));
        setCustomerChecked(true);
        setUsedMessages(readUsage(isRegistered ? normalized : "visitor"));
      })
      .catch(() => {
        if (cancelled) return;
        setRegistered(false);
        setPlantSpend(0);
        setTotalPaid(0);
        setCustomerChecked(true);
        setUsedMessages(readUsage("visitor"));
      })
      .finally(() => {
        if (!cancelled) setCheckingCustomer(false);
      });

    return () => {
      cancelled = true;
    };
  }, [email]);

  const normalizedEmail = normalizeEmail(email);
  const identity = registered && normalizedEmail ? normalizedEmail : "visitor";
  const vip = isHerenciaIaVip(plantSpend);
  const dailyLimit = getHerenciaIaDailyLimit(registered);
  const remainingMessages = vip ? Number.POSITIVE_INFINITY : Math.max(0, dailyLimit - usedMessages);
  const canOpenIa = !checkingCustomer && customerChecked && (vip || remainingMessages > 0);

  const accessMessage = useMemo(
    () =>
      checkingCustomer
        ? "Comprobando tu cuenta y tus compras pagadas..."
        : getHerenciaIaAccessMessage({
            email: normalizedEmail,
            registered,
            plantSpend,
            remainingMessages: vip ? 1 : remainingMessages,
          }),
    [checkingCustomer, normalizedEmail, registered, plantSpend, remainingMessages, vip]
  );

  useEffect(() => {
    const onUsage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "HERENCIA_IA_USAGE_CHANGED") return;
      const next = Math.max(0, Number(event.data?.used || readUsage(identity)));
      setUsedMessages(next);
    };
    window.addEventListener("message", onUsage);
    return () => window.removeEventListener("message", onUsage);
  }, [identity]);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    try {
      localStorage.setItem("herencia-ia-email", value);
    } catch {}
  };

  const startHerenciaIa = () => {
    if (!canOpenIa) return;

    try {
      localStorage.setItem("herencia-ia-active-identity", identity);
      localStorage.setItem("herencia-ia-active-email", registered ? normalizedEmail : "");
      localStorage.setItem("herencia-ia-daily-limit", String(dailyLimit));
      localStorage.setItem("herencia-ia-vip", vip ? "1" : "0");
    } catch {}

    // La app integrada cuenta mensajes reales. Para una URL externa, que no podemos
    // controlar desde otro dominio, cada apertura consume un uso.
    if (settings.mode === "external" && !vip) {
      const next = usedMessages + 1;
      writeUsage(identity, next);
      setUsedMessages(next);
    }

    setAccessStarted(true);
  };

  if (settings.enabled === false) {
    return (
      <div className="grid min-h-[70vh] place-items-center bg-[#eef4e8] px-6 text-center">
        <div className="max-w-md rounded-3xl border border-[#dce8df] bg-white p-8 shadow-sm">
          <Bot className="mx-auto h-10 w-10 text-[#315b42]" />
          <h1 className="mt-4 text-2xl font-bold text-[#173126]">Herenc(IA) está desactivada</h1>
          <p className="mt-2 text-sm text-[#6d776f]">Puedes activarla desde Administración.</p>
        </div>
      </div>
    );
  }

  const external = settings.mode === "external" && Boolean(settings.url);
  const src = external ? settings.url! : "/herencia-ai/index.html";

  if (settings.mode === "external" && !settings.url) {
    return (
      <div className="grid min-h-[70vh] place-items-center bg-[#eef4e8] px-6 text-center">
        <div className="max-w-md rounded-3xl border border-[#dce8df] bg-white p-8 shadow-sm">
          <Bot className="mx-auto h-10 w-10 text-[#315b42]" />
          <h2 className="mt-4 text-xl font-bold text-[#173126]">Falta la URL externa</h2>
          <p className="mt-2 text-sm text-[#6d776f]">Añádela en Administración o cambia a “App integrada”.</p>
        </div>
      </div>
    );
  }

  if (!accessStarted) {
    return (
      <div className="min-h-[calc(100vh-120px)] bg-[#eef4e8] px-4 py-8 sm:py-12">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_420px]">
          <section className="rounded-3xl border border-[#dce8df] bg-white p-7 shadow-sm sm:p-9">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#315b42]/10 px-4 py-2 text-sm font-semibold text-[#315b42]">
              <Sparkles className="h-4 w-4" /> Acceso controlado
            </div>
            <h1 className="mt-5 text-4xl font-black text-[#173126]">Herenc(IA)</h1>
            <p className="mt-3 max-w-2xl text-[#6d776f]">
              El uso está limitado para controlar el coste de la IA. Los visitantes tienen 2 mensajes al día,
              los clientes registrados 5 y quienes superen 50 € en compras pagadas de plantas pueden seguir usándola sin límite diario.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#f5f7f2] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6d776f]">Visitante</p>
                <p className="mt-1 text-3xl font-black text-[#173126]">2</p>
                <p className="text-xs text-[#6d776f]">mensajes / día</p>
              </div>
              <div className="rounded-2xl bg-[#f5f7f2] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6d776f]">Cliente registrado</p>
                <p className="mt-1 text-3xl font-black text-[#173126]">5</p>
                <p className="text-xs text-[#6d776f]">mensajes / día</p>
              </div>
              <div className="rounded-2xl bg-[#315b42] p-5 text-white">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/75">Cliente +50 € plantas</p>
                <p className="mt-1 text-2xl font-black">Sin límite</p>
                <p className="text-xs text-white/75">compras pagadas</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#dce8df] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[#315b42] p-3 text-white"><Bot className="h-6 w-6" /></div>
              <div>
                <h2 className="text-xl font-bold text-[#173126]">Entrar a Herenc(IA)</h2>
                <p className="text-sm text-[#6d776f]">Comprobación automática de cliente</p>
              </div>
            </div>

            <label className="mt-6 block">
              <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#173126]">
                <Mail className="h-4 w-4" /> Correo de cliente
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => handleEmailChange(event.target.value)}
                placeholder="cliente@email.com"
                className="w-full rounded-2xl border border-[#dce8df] bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#315b42]/25"
              />
              <p className="mt-2 text-xs text-[#6d776f]">
                Si el correo existe en Clientes, se aplican sus ventajas. Sin correo —o con un correo no registrado— entras como visitante.
              </p>
            </label>

            {normalizedEmail ? (
              <div className="mt-4 rounded-2xl bg-[#f5f7f2] p-4 text-sm">
                {checkingCustomer ? (
                  <p className="flex items-center gap-2 text-[#6d776f]"><Loader2 className="h-4 w-4 animate-spin" /> Comprobando cliente…</p>
                ) : (
                  <>
                    <p className="font-bold text-[#173126]">
                      {registered ? "✓ Cliente registrado" : "Correo no encontrado en Clientes"}
                    </p>
                    {registered ? (
                      <>
                        <p className="mt-1 text-[#6d776f]">Compras pagadas totales: {totalPaid.toFixed(2)} €</p>
                        <p className="text-[#6d776f]">Compras pagadas de plantas: {plantSpend.toFixed(2)} €</p>
                      </>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            <div className={`mt-4 rounded-2xl p-4 ${canOpenIa ? "bg-[#315b42]/10 text-[#315b42]" : "bg-amber-50 text-amber-900"}`}>
              <div className="flex items-center gap-2 font-bold">
                {!canOpenIa ? <Lock className="h-4 w-4" /> : null}
                {vip ? "Acceso VIP" : canOpenIa ? "Acceso disponible" : "Límite alcanzado"}
              </div>
              <p className="mt-1 text-sm">{accessMessage}</p>
              <p className="mt-2 text-sm font-semibold">
                {vip ? "Mensajes disponibles: sin límite diario" : `Te quedan ${remainingMessages} de ${dailyLimit} mensajes hoy.`}
              </p>
            </div>

            <button
              type="button"
              onClick={startHerenciaIa}
              disabled={!canOpenIa}
              className="mt-5 w-full rounded-2xl bg-[#315b42] px-5 py-4 font-bold text-white transition hover:bg-[#244735] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Abrir Herenc(IA)
            </button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-120px)] bg-[#eef4e8]">
      <div className="border-b border-[#dce8df] bg-white/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[#315b42] p-3 text-white"><Bot className="h-6 w-6" /></div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#173126]">Herenc(IA)</h1>
                <Sparkles className="h-4 w-4 text-[#315b42]" />
              </div>
              <p className="text-sm text-[#6d776f]">
                {external ? "Asistente externo conectado por URL" : "App integrada dentro de Herencia Market"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!external ? (
              <div className="hidden rounded-full border border-[#dce8df] bg-white px-3 py-1.5 text-xs font-semibold sm:block">
                {groqOk === null ? (
                  <span className="flex items-center gap-1.5 text-[#6d776f]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Comprobando Groq</span>
                ) : groqOk ? (
                  <span className="text-emerald-700">● Groq conectado{groqModel ? ` · ${groqModel}` : ""}</span>
                ) : (
                  <span className="text-amber-700">● Groq no disponible</span>
                )}
              </div>
            ) : null}

            <div className="rounded-full border border-[#dce8df] bg-white px-3 py-1.5 text-xs font-semibold text-[#315b42]">
              {vip ? "Uso ilimitado" : `${Math.max(0, dailyLimit - usedMessages)} mensajes restantes`}
            </div>

            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-2 rounded-full border border-[#dce8df] px-4 py-2 text-sm font-semibold text-[#315b42] sm:flex"
            >
              <ExternalLink className="h-4 w-4" /> Abrir grande
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-2 sm:p-4">
        <iframe
          src={src}
          title="Herenc(IA)"
          className="h-[calc(100vh-190px)] min-h-[680px] w-full rounded-3xl border border-[#dce8df] bg-white shadow-sm"
          allow="microphone; camera; clipboard-write"
        />
      </div>
    </div>
  );
}
