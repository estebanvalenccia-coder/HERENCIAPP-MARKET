import { useEffect, useState } from "react";
import { Bot, ExternalLink, Loader2, Lock, LogIn, Sparkles } from "lucide-react";
import { Link } from "react-router";
import { backendStorage } from "../lib/backendStorage";

type HerenciaSettings = {
  enabled?: boolean;
  url?: string;
  mode?: "integrated" | "external";
  useIntegrated?: boolean;
};

type AccessState = {
  ok?: boolean;
  authenticated: boolean;
  email?: string;
  role: "visitor" | "customer" | "vip";
  vip: boolean;
  unlimited: boolean;
  plantSpend: number;
  vipPlantSpend: number;
  dailyLimit: number;
  used: number;
  remaining: number | null;
};

export function HerencIA() {
  const [settings, setSettings] = useState<HerenciaSettings>({
    enabled: true,
    mode: "integrated",
    useIntegrated: true,
  });
  const [groqOk, setGroqOk] = useState<boolean | null>(null);
  const [groqModel, setGroqModel] = useState("");
  const [access, setAccess] = useState<AccessState | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
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
    window.addEventListener("storage", load);
    window.addEventListener("backend-storage", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("backend-storage", load);
    };
  }, []);

  const refreshAccess = async () => {
    setAccessLoading(true);
    try {
      const response = await fetch("/api/herencia-ai/access", { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No se pudo comprobar el acceso");
      setAccess(data);
    } catch {
      setAccess(null);
    } finally {
      setAccessLoading(false);
    }
  };

  useEffect(() => {
    void refreshAccess();
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "HERENCIA_IA_ACCESS") return;
      if (event.data?.access) setAccess(event.data.access);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
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

  const canOpen = Boolean(access?.unlimited || Number(access?.remaining || 0) > 0);

  if (!accessStarted) {
    return (
      <div className="min-h-[calc(100vh-120px)] bg-[#eef4e8] px-4 py-8 sm:py-12">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_420px]">
          <section className="rounded-3xl border border-[#dce8df] bg-white p-7 shadow-sm sm:p-9">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#315b42]/10 px-4 py-2 text-sm font-semibold text-[#315b42]">
              <Sparkles className="h-4 w-4" /> Acceso controlado desde el backend
            </div>
            <h1 className="mt-5 text-4xl font-black text-[#173126]">Herenc(IA)</h1>
            <p className="mt-3 max-w-2xl text-[#6d776f]">
              El contador se guarda en Herencia Market, no en el navegador. Así el límite no se reinicia al borrar la caché o recargar la página.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#f5f7f2] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6d776f]">Visitante</p>
                <p className="mt-1 text-3xl font-black text-[#173126]">{access?.authenticated ? "—" : access?.dailyLimit ?? 2}</p>
                <p className="text-xs text-[#6d776f]">mensajes / día</p>
              </div>
              <div className="rounded-2xl bg-[#f5f7f2] p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6d776f]">Cliente registrado</p>
                <p className="mt-1 text-3xl font-black text-[#173126]">{access?.authenticated && !access.vip ? access.dailyLimit : 5}</p>
                <p className="text-xs text-[#6d776f]">mensajes / día</p>
              </div>
              <div className="rounded-2xl bg-[#315b42] p-5 text-white">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/75">VIP en plantas</p>
                <p className="mt-1 text-2xl font-black">Sin límite</p>
                <p className="text-xs text-white/75">desde {Number(access?.vipPlantSpend || 50).toFixed(0)} € pagados</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#dce8df] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-[#315b42] p-3 text-white"><Bot className="h-6 w-6" /></div>
              <div>
                <h2 className="text-xl font-bold text-[#173126]">Tu acceso</h2>
                <p className="text-sm text-[#6d776f]">Cuenta y uso del día</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-[#f5f7f2] p-4">
              {accessLoading ? (
                <p className="flex items-center gap-2 text-sm text-[#6d776f]"><Loader2 className="h-4 w-4 animate-spin" /> Comprobando acceso…</p>
              ) : access ? (
                <>
                  <p className="font-bold text-[#173126]">
                    {access.vip ? "👑 Cliente VIP" : access.authenticated ? "✓ Cliente registrado" : "Visitante"}
                  </p>
                  {access.authenticated && access.email ? (
                    <p className="mt-1 text-sm text-[#6d776f]">{access.email}</p>
                  ) : null}
                  {access.authenticated ? (
                    <p className="mt-2 text-sm text-[#6d776f]">
                      Compras pagadas de plantas: {Number(access.plantSpend || 0).toFixed(2)} €
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-[#6d776f]">
                      Inicia sesión con tu cuenta de cliente para recibir el límite de cliente y detectar automáticamente el acceso VIP.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-amber-800">No se pudo comprobar el acceso. Recarga la página en unos segundos.</p>
              )}
            </div>

            {access && !access.authenticated ? (
              <Link
                to="/login"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#315b42] px-5 py-3 font-bold text-[#315b42]"
              >
                <LogIn className="h-4 w-4" /> Iniciar sesión o registrarme
              </Link>
            ) : null}

            <div className={`mt-4 rounded-2xl p-4 ${canOpen ? "bg-[#315b42]/10 text-[#315b42]" : "bg-amber-50 text-amber-900"}`}>
              <div className="flex items-center gap-2 font-bold">
                {!canOpen ? <Lock className="h-4 w-4" /> : null}
                {access?.vip ? "Acceso ilimitado" : canOpen ? "Acceso disponible" : "Límite alcanzado"}
              </div>
              <p className="mt-2 text-sm font-semibold">
                {access?.unlimited
                  ? "Mensajes disponibles: sin límite diario"
                  : `Te quedan ${Math.max(0, Number(access?.remaining || 0))} de ${Number(access?.dailyLimit || 0)} mensajes hoy.`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAccessStarted(true)}
              disabled={accessLoading || !canOpen}
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
    <div className="min-h-[calc(100vh-120px)] bg-[radial-gradient(circle_at_top_left,_#eff5e9,_#e5efdf_45%,_#f4ede0)]">
      <div className="border-b border-[#dce8df] bg-white/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[#315b42] p-3 text-white"><Bot className="h-6 w-6" /></div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#173126]">Herenc(IA)</h1>
                <Sparkles className="h-4 w-4 text-[#315b42]" />
              </div>
              <p className="text-sm text-[#6d776f]">{external ? "Asistente externo conectado por URL" : "App integrada dentro de Herencia Market"}</p>
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
              {access?.unlimited ? "Uso ilimitado" : `${Math.max(0, Number(access?.remaining || 0))} mensajes restantes`}
            </div>

            <a href={src} target="_blank" rel="noopener noreferrer" className="hidden items-center gap-2 rounded-full border border-[#dce8df] px-4 py-2 text-sm font-semibold text-[#315b42] sm:flex">
              <ExternalLink className="h-4 w-4" /> Abrir grande
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-2 sm:p-4">
        <iframe
          src={src}
          title="Herenc(IA)"
          className="h-[calc(100vh-190px)] min-h-[680px] w-full rounded-[2rem] border-0 bg-transparent shadow-none"
          allow="microphone; camera; clipboard-write"
        />
      </div>
    </div>
  );
}
