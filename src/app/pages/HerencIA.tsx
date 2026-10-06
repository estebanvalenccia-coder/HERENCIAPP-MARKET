import { Bot, ExternalLink, Sparkles } from "lucide-react";

export function HerencIA() {
  return (
    <div className="min-h-[calc(100vh-120px)] bg-[#eef4e8]">
      <div className="border-b border-[#dce8df] bg-white/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[#315b42] p-3 text-white"><Bot className="h-6 w-6" /></div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#173126]">Herenc(IA)</h1>
                <Sparkles className="h-4 w-4 text-[#315b42]" />
              </div>
              <p className="text-sm text-[#6d776f]">Tu asistente de Herencia dentro de Herencia Market</p>
            </div>
          </div>
          <a href="/herencia-ai/index.html" target="_blank" rel="noopener noreferrer" className="hidden items-center gap-2 rounded-full border border-[#dce8df] px-4 py-2 text-sm font-semibold text-[#315b42] sm:flex">
            <ExternalLink className="h-4 w-4" /> Abrir grande
          </a>
        </div>
      </div>
      <div className="mx-auto max-w-7xl p-2 sm:p-4">
        <iframe
          src="/herencia-ai/index.html"
          title="Herenc(IA)"
          className="h-[calc(100vh-190px)] min-h-[680px] w-full rounded-3xl border border-[#dce8df] bg-white shadow-sm"
          allow="microphone; camera; clipboard-write"
        />
      </div>
    </div>
  );
}
