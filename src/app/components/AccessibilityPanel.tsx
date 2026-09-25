import { useEffect, useState } from "react";
import { Accessibility, Minus, Plus, RotateCcw } from "lucide-react";

type AccessibilityPrefs = {
  fontScale: number;
  highContrast: boolean;
  reduceMotion: boolean;
};

const defaults: AccessibilityPrefs = {
  fontScale: 100,
  highContrast: false,
  reduceMotion: false,
};

function readPrefs(): AccessibilityPrefs {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem("herencia_accessibility") || "{}") };
  } catch {
    return defaults;
  }
}

export function AccessibilityPanel(){
  const [open,setOpen]=useState(false);
  const [prefs,setPrefs]=useState<AccessibilityPrefs>(readPrefs);

  useEffect(()=>{
    try{localStorage.setItem("herencia_accessibility",JSON.stringify(prefs));}catch{}
    const root=document.documentElement;
    root.style.fontSize=`${Math.max(85,Math.min(130,prefs.fontScale))}%`;
    root.dataset.herenciaContrast=prefs.highContrast?"high":"normal";
    root.dataset.herenciaMotion=prefs.reduceMotion?"reduced":"normal";
  },[prefs]);

  return <>
    <style>{`
      html[data-herencia-contrast="high"] body { filter: contrast(1.18); }
      html[data-herencia-contrast="high"] *:focus-visible { outline: 3px solid currentColor !important; outline-offset: 3px !important; }
      html[data-herencia-motion="reduced"] *, html[data-herencia-motion="reduced"] *::before, html[data-herencia-motion="reduced"] *::after {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
        scroll-behavior: auto !important;
      }
    `}</style>
    <div className="fixed bottom-24 left-4 z-[90]">
      <button aria-label="Opciones de accesibilidad" aria-expanded={open} onClick={()=>setOpen(!open)} className="grid h-12 w-12 place-items-center rounded-full border border-border bg-card shadow-xl"><Accessibility className="h-5 w-5 text-primary"/></button>
      {open&&<div className="absolute bottom-14 left-0 w-72 rounded-2xl border border-border bg-card p-4 shadow-2xl">
        <div className="flex items-center justify-between"><div><p className="font-bold">Accesibilidad</p><p className="text-xs text-muted-foreground">Ajustes guardados en este dispositivo.</p></div><button aria-label="Restaurar accesibilidad" onClick={()=>setPrefs(defaults)} className="p-2 text-muted-foreground"><RotateCcw className="h-4 w-4"/></button></div>
        <div className="mt-4 space-y-4">
          <div><p className="text-sm font-semibold">Tamaño del texto</p><div className="mt-2 flex items-center gap-2"><button aria-label="Reducir texto" onClick={()=>setPrefs({...prefs,fontScale:Math.max(85,prefs.fontScale-5)})} className="rounded-lg border border-border p-2"><Minus className="h-4 w-4"/></button><span className="flex-1 text-center font-bold">{prefs.fontScale}%</span><button aria-label="Aumentar texto" onClick={()=>setPrefs({...prefs,fontScale:Math.min(130,prefs.fontScale+5)})} className="rounded-lg border border-border p-2"><Plus className="h-4 w-4"/></button></div></div>
          <label className="flex items-center justify-between gap-3 text-sm font-semibold"><span>Contraste reforzado</span><input type="checkbox" checked={prefs.highContrast} onChange={(e)=>setPrefs({...prefs,highContrast:e.target.checked})}/></label>
          <label className="flex items-center justify-between gap-3 text-sm font-semibold"><span>Reducir animaciones</span><input type="checkbox" checked={prefs.reduceMotion} onChange={(e)=>setPrefs({...prefs,reduceMotion:e.target.checked})}/></label>
        </div>
      </div>}
    </div>
  </>;
}
