import { useMemo, useState } from "react";
import { Search, Settings2 } from "lucide-react";
import {
  STOREFRONT_COMPONENT_REGISTRY,
  getComponentControl,
  isComponentAllowed,
  type StorefrontComponentDefinition,
  type StorefrontComponentKey,
} from "../../lib/componentRegistry";
import type { MarketExperienceContent } from "../../lib/marketExperience";
import { AdminScheduleFields } from "./AdminElementControls";

type LegacyHomeSection = keyof MarketExperienceContent["home"]["sections"];
type LegacyLayoutSection = keyof MarketExperienceContent["layout"];
const homeKeys = new Set<string>([
  "hero", "delivery", "categoryStrip", "plantCta", "feed", "categoriesGrid",
  "services", "featured", "promotions", "trust", "bottomCta",
]);
const layoutKeys = new Set<string>([
  "announcement", "search", "account", "favorites", "cart", "deliverySelector", "footer",
]);

function baseEnabled(market: MarketExperienceContent, id: StorefrontComponentKey) {
  if (id.startsWith("home.")) {
    const key = id.slice("home.".length);
    if (homeKeys.has(key)) return market.home.sections[key as LegacyHomeSection];
  }
  if (id.startsWith("header.")) {
    const key = id.slice("header.".length);
    if (layoutKeys.has(key)) return market.layout[key as LegacyLayoutSection];
  }
  if (id === "footer.main") return market.layout.footer;
  if (id === "floating.sales") return market.sales.enabled;
  return true;
}

function changeEnabled(market: MarketExperienceContent, id: StorefrontComponentKey, enabled: boolean): MarketExperienceContent {
  const controls = {
    ...market.componentControls,
    [id]: { ...getComponentControl(market.componentControls, id), enabled },
  };
  if (id.startsWith("home.")) {
    const key = id.slice("home.".length);
    if (homeKeys.has(key)) return {
      ...market,
      componentControls: controls,
      home: { ...market.home, sections: { ...market.home.sections, [key]: enabled } },
    };
  }
  if (id.startsWith("header.")) {
    const key = id.slice("header.".length);
    if (layoutKeys.has(key)) return {
      ...market,
      componentControls: controls,
      layout: { ...market.layout, [key]: enabled },
    };
  }
  if (id === "footer.main") return {
    ...market, componentControls: controls, layout: { ...market.layout, footer: enabled },
  };
  if (id === "floating.sales") return {
    ...market, componentControls: controls, sales: { ...market.sales, enabled },
  };
  return { ...market, componentControls: controls };
}

const groupNames: Record<string, string> = {
  header: "Cabecera", home: "Portada", floating: "Botones flotantes", footer: "Pie de página",
};

export function AdminComponentRegistry({
  market,
  onChange,
}: {
  market: MarketExperienceContent;
  onChange: (next: MarketExperienceContent) => void;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");

  const visible = useMemo(
    () => STOREFRONT_COMPONENT_REGISTRY.filter((item) =>
      (group === "all" || item.location === group) &&
      (item.name.toLocaleLowerCase("es-ES").includes(query.toLocaleLowerCase("es-ES")) ||
        item.description.toLocaleLowerCase("es-ES").includes(query.toLocaleLowerCase("es-ES")))
    ), [query, group]
  );
  const updateControl = (id: StorefrontComponentKey, patch: Record<string, unknown>) => {
    onChange({
      ...market,
      componentControls: {
        ...market.componentControls,
        [id]: { ...getComponentControl(market.componentControls, id), ...patch },
      },
    });
  };
  const scrollToEditor = (item: StorefrontComponentDefinition) => {
    const target = document.getElementById(`market-editor-${item.editingSection}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="rounded-2xl border border-[#cddfce] bg-white p-5" aria-label="Inventario de componentes configurables">
      <div className="mb-4 flex items-center gap-3">
        <Settings2 className="h-5 w-5 text-[#315b42]" />
        <div>
          <h4 className="text-lg font-black">Centro universal ON/OFF · {STOREFRONT_COMPONENT_REGISTRY.length} componentes</h4>
          <p className="text-xs text-muted-foreground">Controles compatibles con móvil, tablet, ordenador y publicación programada. Los cambios se publican al guardar el contenido.</p>
        </div>
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_190px]">
        <label className="relative">
          <span className="sr-only">Buscar componentes</span>
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar botón, banner, sección..." className="w-full rounded-xl border border-[#dce6dc] py-2 pl-9 pr-3 text-sm" />
        </label>
        <select value={group} onChange={(event) => setGroup(event.target.value)} aria-label="Filtrar por ubicación" className="rounded-xl border border-[#dce6dc] px-3 py-2 text-sm">
          <option value="all">Todas las zonas</option>
          <option value="header">Cabecera</option>
          <option value="home">Portada</option>
          <option value="floating">Botones flotantes</option>
          <option value="footer">Pie de página</option>
        </select>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((item) => {
          const control = getComponentControl(market.componentControls, item.id);
          const enabled = baseEnabled(market, item.id) && isComponentAllowed(market.componentControls, item.id);
          return (
            <div key={item.id} className="rounded-xl border border-[#e1e7df] bg-[#fbfcfa] p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="font-black">{item.name}</p>
                  <p className="text-[11px] text-[#607365]">{groupNames[item.location]} · {item.description}</p>
                </div>
                <label className="flex shrink-0 items-center gap-1 text-xs font-bold">
                  <input type="checkbox" aria-label={`Mostrar ${item.name}`} checked={enabled} onChange={(event) => onChange(changeEnabled(market, item.id, event.target.checked))} />
                  {enabled ? "ON" : "OFF"}
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                {(["desktop", "tablet", "mobile"] as const).map((device) => (
                  <label key={device} className="flex items-center gap-1">
                    <input type="checkbox" checked={control[device] !== false} onChange={(event) => updateControl(item.id, { [device]: event.target.checked })} />
                    {device === "desktop" ? "Ordenador" : device === "tablet" ? "Tablet" : "Móvil"}
                  </label>
                ))}
              </div>
              <div className="mt-3">
                <AdminScheduleFields label={item.name} value={control.schedule} onChange={(schedule) => updateControl(item.id, { schedule })} />
              </div>
              <button type="button" onClick={() => scrollToEditor(item)} className="mt-2 rounded-lg border border-[#cbd9ce] bg-white px-3 py-1.5 text-xs font-bold text-[#315b42]">
                Ir a configuración
              </button>
            </div>
          );
        })}
      </div>
      {visible.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No hay componentes con ese filtro.</p>}
      <p className="mt-4 text-xs text-[#607365]">Para administrar nuevos componentes, los desarrolladores deben registrarlos aquí y envolver su renderizado con el control de visibilidad. Un componente sin integración no puede controlarse automáticamente.</p>
    </section>
  );
}
