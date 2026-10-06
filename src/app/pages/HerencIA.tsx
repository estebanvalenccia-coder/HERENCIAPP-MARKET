import { useEffect, useState } from "react";
import { Bot, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { backendStorage } from "../lib/backendStorage";

type HerenciaSettings = {
  enabled?: boolean;
  url?: string;
  mode?: "integrated" | "external";
  useIntegrated?: boolean;
};

export function HerencIA() {
  const [settings, setSettings] = useState<HerenciaSettings>({ enabled: true, mode: "integrated", useIntegrated: true });
  const [groqOk, setGroqOk] = useState<boolean | null>(null);
  const [groqModel, setGroqModel] = useState("");

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
    return () => { active = false; };
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

  const external = settings.mode === "external" && settings.url;
  const src = external ? settings.url! : "/herencia-ai/index.html";

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
            {!external && (
              <div className="hidden rounded-full border border-[#dce8df] bg-white px-3 py-1.5 text-xs font-semibold sm:block">
                {groqOk === null ? (
                  <span className="flex items-center gap-1.5 text-[#6d776f]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Comprobando Groq</span>
                ) : groqOk ? (
                  <span className="text-emerald-700">● Groq conectado{groqModel ? ` · ${groqModel}` : ""}</span>
                ) : (
                  <span className="text-amber-700">● Groq no disponible</span>
                )}
              </div>
            )}
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
        {settings.mode === "external" && !settings.url ? (
          <div className="grid min-h-[680px] place-items-center rounded-3xl border border-[#dce8df] bg-white p-8 text-center">
            <div className="max-w-md">
              <Bot className="mx-auto h-10 w-10 text-[#315b42]" />
              <h2 className="mt-4 text-xl font-bold text-[#173126]">Falta la URL externa</h2>
              <p className="mt-2 text-sm text-[#6d776f]">Añádela en Administración o cambia a “App integrada”.</p>
            </div>
          </div>
        ) : (
          <iframe
            src={src}
            title="Herenc(IA)"
            className="h-[calc(100vh-190px)] min-h-[680px] w-full rounded-3xl border border-[#dce8df] bg-white shadow-sm"
            allow="microphone; camera; clipboard-write"
          />
        )}
      </div>
    </div>
  );
}
