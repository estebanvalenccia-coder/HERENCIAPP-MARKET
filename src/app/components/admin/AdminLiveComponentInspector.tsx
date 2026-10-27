import { Eye, EyeOff, MonitorSmartphone, MoveDown, MoveUp, SlidersHorizontal } from "lucide-react";
import type { SiteContent } from "../../lib/siteContent";
import { getMarketExperience, withMarketExperience, type MarketHomeSectionId } from "../../lib/marketExperience";
import { getComponentControl, STOREFRONT_COMPONENT_REGISTRY } from "../../lib/componentRegistry";
import { AdminScheduleFields, reorderItem } from "./AdminElementControls";
import { baseEnabled, changeEnabled } from "./AdminComponentRegistry";

export function AdminLiveComponentInspector({
  id, site, onChange, onOpenControls,
}: {
  id: string;
  site: SiteContent;
  onChange: (site: SiteContent) => void;
  onOpenControls: () => void;
}) {
  const definition = STOREFRONT_COMPONENT_REGISTRY.find((item) => item.id === id);
  if (!definition) {
    return <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
      El elemento todavía no está registrado. Debe incorporarse al sistema de componentes antes de permitir editarlo.
    </div>;
  }
  const market = getMarketExperience(site);
  const current = getComponentControl(market.componentControls, id);
  const enabled = baseEnabled(market, definition.id) && current.enabled !== false;
  const update = (patch: Record<string, unknown>) => {
    onChange(withMarketExperience(site, {
      ...market,
      componentControls: {
        ...market.componentControls,
        [id]: { ...current, ...patch },
      },
    }));
  };
  const homeKey = id.startsWith("home.") ? id.slice(5) as MarketHomeSectionId : null;
  const currentIndex = homeKey ? market.home.sectionOrder.indexOf(homeKey) : -1;
  const move = (delta: number) => {
    if (currentIndex < 0) return;
    onChange(withMarketExperience(site, {
      ...market,
      home: {
        ...market.home,
        sectionOrder: reorderItem(market.home.sectionOrder, currentIndex, currentIndex + delta),
      },
    }));
  };
  return (
    <div className="space-y-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-emerald-800">Elemento seleccionado en la tienda</p>
        <h3 className="mt-1 text-lg font-black text-emerald-950">{definition.name}</h3>
        <p className="text-xs text-emerald-800">{definition.description}</p>
      </div>
      <label className="flex items-center justify-between rounded-xl bg-white p-3 font-bold text-emerald-950">
        <span className="flex items-center gap-2">{enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} {enabled ? "ON · Visible" : "OFF · Oculto"}</span>
        <input type="checkbox" checked={enabled} onChange={(event) => onChange(withMarketExperience(site, changeEnabled(market, definition.id, event.target.checked)))} aria-label={`Mostrar ${definition.name}`} />
      </label>
      <div className="rounded-xl bg-white p-3">
        <p className="mb-2 flex items-center gap-2 text-xs font-black"><MonitorSmartphone className="h-4 w-4" /> Dispositivos</p>
        <div className="grid gap-2">
          {(["desktop", "tablet", "mobile"] as const).map((device) => (
            <label key={device} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={current[device] !== false} onChange={(event) => update({ [device]: event.target.checked })} />
              {device === "desktop" ? "Ordenador" : device === "tablet" ? "Tablet" : "Móvil"}
            </label>
          ))}
        </div>
      </div>
      <AdminScheduleFields label={definition.name} value={current.schedule} onChange={(schedule) => update({ schedule })} />
      {currentIndex >= 0 && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => move(-1)} disabled={currentIndex === 0} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-black disabled:opacity-40">
            <MoveUp className="h-4 w-4" /> Subir
          </button>
          <button type="button" onClick={() => move(1)} disabled={currentIndex === market.home.sectionOrder.length - 1} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-black disabled:opacity-40">
            <MoveDown className="h-4 w-4" /> Bajar
          </button>
        </div>
      )}
      <button type="button" onClick={onOpenControls} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#315b42] px-4 py-3 text-sm font-black text-white">
        <SlidersHorizontal className="h-4 w-4" /> Abrir configuración completa
      </button>
    </div>
  );
}
