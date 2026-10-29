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
import { isWithinPublicationWindow } from "../../lib/publicationSchedule.mjs";

type LegacyHomeSection = keyof MarketExperienceContent["home"]["sections"];
type LegacyLayoutSection = keyof MarketExperienceContent["layout"];
const homeKeys = new Set<string>([
  "hero", "delivery", "categoryStrip", "plantCta", "feed", "categoriesGrid",
  "services", "featured", "selection", "promotions", "creations3d", "trust", "bottomCta",
]);
const layoutKeys = new Set<string>([
  "announcement", "search", "account", "favorites", "cart", "deliverySelector", "footer",
]);

export function baseEnabled(market: MarketExperienceContent, id: StorefrontComponentKey) {
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

export function changeEnabled(market: MarketExperienceContent, id: StorefrontComponentKey, enabled: boolean): MarketExperienceContent {
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
  const [notice, setNotice] = useState("");
  const knownIds = useMemo(() => new Set(STOREFRONT_COMPONENT_REGISTRY.map((item) => item.id)), []);
  const unknownControls = Object.keys(market.componentControls || {}).filter((id) => !knownIds.has(id));

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
    if (target) { setNotice(""); target.scrollIntoView({ behavior: "smooth", block: "start" }); }
    else setNotice("Este componente se controla en el inventario universal. Su editor de contenido independiente todavía no está conectado a esta pantalla.");
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
      {unknownControls.length > 0 && (
        <p role="status" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
          {unknownControls.length} configuración(es) guardada(s) sin componente registrado: {unknownControls.join(", ")}. No se borrarán automáticamente.
        </p>
      )}
      {notice && <p role="status" className="mb-3 rounded-lg border border-[#cddfce] bg-[#f2f8f2] p-3 text-xs font-medium">{notice}</p>}
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
          const enabled = baseEnabled(market, item.id) && control.enabled !== false;
          const currentlyVisible = enabled && isComponentAllowed(market.componentControls, item.id);
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
              {enabled && !currentlyVisible && <p className="mb-2 text-xs font-bold text-amber-800">Programado: no visible en este momento</p>}
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


/**
 * One place to diagnose *configured* storefront visibility without overwriting
 * old settings. It edits the same MarketExperience draft as the visual builder.
 * Published state and conditional data availability cannot be inferred here.
 */
type VisibilityStatus = "shown" | "hidden" | "scheduled" | "no-device";
type VisibilityEntry = {
  id: string;
  name: string;
  area: string;
  editSection: string;
  status: VisibilityStatus;
  detail: string;
  checked: boolean;
  onToggle: (checked: boolean) => void;
};
const VISIBILITY_GROUPS: Record<string, string> = {
  header: "Cabecera y navegación",
  home: "Secciones de la portada",
  floating: "Asistentes y botones flotantes",
  footer: "Pie de página",
};
function visibilityState(
  enabled: boolean,
  schedule?: { startAt?: string; endAt?: string },
  device?: { desktop?: boolean; tablet?: boolean; mobile?: boolean },
  now = Date.now(),
): Pick<VisibilityEntry, "status" | "detail"> {
  if (!enabled) return { status: "hidden", detail: "Desactivado en Administración" };
  if (!isWithinPublicationWindow(schedule, now)) {
    const start = schedule?.startAt ? Date.parse(schedule.startAt) : NaN;
    const end = schedule?.endAt ? Date.parse(schedule.endAt) : NaN;
    return {
      status: "scheduled",
      detail: Number.isFinite(start) && start > now ? "Aún no ha empezado su programación"
        : Number.isFinite(end) && end < now ? "La programación ya terminó"
        : "Fuera de la programación vigente",
    };
  }
  if (device && device.desktop === false && device.tablet === false && device.mobile === false) {
    return { status: "no-device", detail: "Oculto en ordenador, tablet y móvil" };
  }
  return { status: "shown", detail: "Habilitado según la configuración" };
}

export function AdminVisibilityOverview({
  market,
  onChange,
}: {
  market: MarketExperienceContent;
  onChange: (next: MarketExperienceContent) => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const now = Date.now();
  const changeEntry = (id: StorefrontComponentKey, checked: boolean) => {
    onChange(changeEnabled(market, id, checked));
  };
  const entries: VisibilityEntry[] = STOREFRONT_COMPONENT_REGISTRY.map((component) => {
    const control = getComponentControl(market.componentControls, component.id);
    const enabled = baseEnabled(market, component.id) && control.enabled !== false;
    const state = visibilityState(enabled, control.schedule, control, now);
    return {
      id: component.id,
      name: component.name,
      area: VISIBILITY_GROUPS[component.location],
      editSection: component.editingSection,
      checked: enabled,
      ...state,
      onToggle: (checked: boolean) => changeEntry(component.id, checked),
    };
  });
  market.navigation.forEach((item, index) => {
    const state = visibilityState(item.visible !== false, item.schedule, undefined, now);
    entries.push({
      id: "menu-" + index, name: item.label || "Enlace del menú",
      area: "Enlaces configurados del menú", editSection: "navegacion",
      checked: item.visible !== false, ...state,
      onToggle: (checked) => onChange({
        ...market,
        navigation: market.navigation.map((row, i) => i === index ? {...row, visible: checked} : row),
      }),
    });
  });
  market.home.categories.forEach((item, index) => {
    const enabled = item.visible !== false && (
      market.home.sections.categoryStrip || market.home.sections.categoriesGrid
    );
    const state = visibilityState(enabled, item.schedule, undefined, now);
    entries.push({
      id: "category-" + index, name: item.title || "Categoría sin nombre",
      area: "Categorías administradas", editSection: "portada",
      checked: item.visible !== false, ...state,
      detail: !market.home.sections.categoryStrip && !market.home.sections.categoriesGrid
        ? "Las dos secciones contenedoras están desactivadas" : state.detail,
      onToggle: (checked) => onChange({
        ...market,
        home: {
          ...market.home,
          categories: market.home.categories.map((row, i) =>
            i === index ? {...row, visible: checked} : row),
        },
      }),
    });
  });
  market.home.services.forEach((item, index) => {
    const state = visibilityState(item.visible !== false && market.home.sections.services, item.schedule, undefined, now);
    entries.push({
      id: "service-" + index, name: item.title || "Servicio",
      area: "Servicios administrados", editSection: "servicios",
      checked: item.visible !== false, ...state,
      detail: !market.home.sections.services ? "La sección Servicios está desactivada" : state.detail,
      onToggle: (checked) => onChange({
        ...market,
        home: {
          ...market.home,
          services: market.home.services.map((row, i) => i === index ? {...row, visible: checked} : row),
        },
      }),
    });
  });
  const promotions = [
    { id: "promotion-dulce", name: "Dulce", index: -2, enabled: market.dulce.enabled !== false, schedule: market.dulce.schedule },
    { id: "promotion-moda", name: "Moda", index: -1, enabled: market.moda.enabled !== false, schedule: market.moda.schedule },
    ...market.home.campaigns.map((item, index) => ({
      id: "campaign-" + (item.id || index), name: item.title || "Campaña",
      index, enabled: item.enabled !== false, schedule: item.schedule,
    })),
  ];
  promotions.forEach((item) => {
    const state = visibilityState(item.enabled && market.home.sections.promotions, item.schedule, undefined, now);
    entries.push({
      id: item.id, name: item.name, area: "Promociones administradas", editSection: "promociones",
      checked: item.enabled, ...state,
      detail: !market.home.sections.promotions ? "La sección Promociones está desactivada" : state.detail,
      onToggle: (checked) => {
        if (item.index === -2) onChange({...market, dulce: {...market.dulce, enabled: checked}});
        else if (item.index === -1) onChange({...market, moda: {...market.moda, enabled: checked}});
        else onChange({
          ...market,
          home: {...market.home, campaigns: market.home.campaigns.map((row, i) =>
            i === item.index ? {...row, enabled: checked} : row)},
        });
      },
    });
  });
  const totals = {
    shown: entries.filter(item => item.status === "shown").length,
    hidden: entries.filter(item => item.status === "hidden" || item.status === "no-device").length,
    scheduled: entries.filter(item => item.status === "scheduled").length,
  };
  const matching = entries.filter((entry) =>
    (statusFilter === "all" || (statusFilter === "hidden" && (entry.status === "hidden" || entry.status === "no-device")) || entry.status === statusFilter)
    && (areaFilter === "all" || entry.area === areaFilter)
    && (entry.name + " " + entry.area + " " + entry.detail).toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es"))
  );
  const areas = [...new Set(entries.map(item => item.area))];
  const styleFor: Record<VisibilityStatus, { label: string; style: string }> = {
    shown: {label: "Habilitado", style: "bg-emerald-50 text-emerald-800 border-emerald-200"},
    hidden: {label: "Oculto", style: "bg-slate-100 text-slate-700 border-slate-200"},
    scheduled: {label: "Programado", style: "bg-amber-50 text-amber-800 border-amber-200"},
    "no-device": {label: "Oculto en dispositivos", style: "bg-slate-100 text-slate-700 border-slate-200"},
  };
  const editItem = (section: string) => {
    const destination = document.getElementById("market-editor-" + section) ||
      document.getElementById("market-editor-portada");
    destination?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section id="market-visibility-overview" className="rounded-2xl border-2 border-[#b7d0bc] bg-white p-5 shadow-sm" aria-label="Qué se ve en la tienda">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-xl font-black text-[#19442d]">Visibilidad de la tienda</h4>
          <p className="mt-1 text-sm text-[#5b705e]">Consulta lo habilitado, oculto y programado. Cambia cada apartado sin borrar su contenido.</p>
        </div>
        <span className="rounded-full bg-[#e8f2e9] px-3 py-1.5 text-xs font-bold text-[#244b34]">
          Resumen del editor actual
        </span>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-emerald-50 p-3 text-center">
          <strong className="block text-2xl text-emerald-800">{totals.shown}</strong><span className="text-xs text-emerald-900">Habilitados</span>
        </div>
        <div className="rounded-lg bg-slate-100 p-3 text-center">
          <strong className="block text-2xl text-slate-700">{totals.hidden}</strong><span className="text-xs text-slate-700">Ocultos</span>
        </div>
        <div className="rounded-lg bg-amber-50 p-3 text-center">
          <strong className="block text-2xl text-amber-800">{totals.scheduled}</strong><span className="text-xs text-amber-900">Programados</span>
        </div>
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_160px_220px]">
        <label className="block">
          <span className="sr-only">Buscar apartado</span>
          <input className="w-full rounded-lg border border-[#cfddd1] px-3 py-2 text-sm" placeholder="Buscar menú, banner, categoría..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <select aria-label="Filtrar por estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-[#cfddd1] px-3 py-2 text-sm">
          <option value="all">Todos los estados</option>
          <option value="shown">Habilitados</option>
          <option value="hidden">Ocultos</option>
          <option value="scheduled">Programados</option>
        </select>
        <select aria-label="Filtrar por sección" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} className="rounded-lg border border-[#cfddd1] px-3 py-2 text-sm">
          <option value="all">Todas las zonas</option>
          {areas.map((area) => <option key={area} value={area}>{area}</option>)}
        </select>
      </div>
      <p className="mb-3 text-xs text-[#5b705e]">{matching.length} de {entries.length} elementos</p>
      <div className="max-h-[570px] space-y-2 overflow-y-auto pr-1">
        {matching.map((item) => {
          const indicator = styleFor[item.status];
          return (
            <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[#e4eae3] p-3">
              <div className="min-w-[170px] flex-1">
                <p className="text-sm font-semibold text-[#244432]">{item.name}</p>
                <p className="text-xs text-[#64766a]">{item.area}</p>
                {item.status !== "shown" && <p className="text-xs text-[#7d6840]">{item.detail}</p>}
              </div>
              <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${indicator.style}`}>{indicator.label}</span>
              <label className="inline-flex items-center gap-2 rounded-lg border border-[#d5e2d5] px-2 py-1.5 text-xs font-semibold">
                <input type="checkbox" checked={item.checked} onChange={(e) => item.onToggle(e.target.checked)} aria-label={`Mostrar ${item.name}`}/>
                {item.checked ? "ON" : "OFF"}
              </label>
              <button type="button" onClick={() => editItem(item.editSection)} className="rounded-lg border border-[#d5e2d5] bg-white px-3 py-1.5 text-xs font-semibold text-[#315b42]">Editar</button>
            </div>
          );
        })}
        {matching.length === 0 && <p className="p-4 text-center text-sm text-[#64766a]">No hay elementos que coincidan con el filtro.</p>}
      </div>
      <p className="mt-4 rounded-lg bg-[#f2f7f1] p-3 text-xs text-[#45634d]">
        Estos estados proceden de la configuración que estás editando, no de una comprobación en vivo del sitio público. Guarda y publica para aplicar los cambios. Un elemento habilitado aún puede depender de que exista contenido, stock, una colección activa o un servicio disponible. Las restricciones de dispositivo y programación se pueden editar en el centro ON/OFF avanzado situado debajo.
      </p>
    </section>
  );
}
