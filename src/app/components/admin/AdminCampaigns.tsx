import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { AdminElementControls, AdminScheduleFields, reorderItem } from "./AdminElementControls";
import { AdminPromoDesignFields } from "./AdminVisualStyleFields";
import type { MarketCampaign } from "../../lib/marketExperience";

const templates = [
  { id: "general", name: "Campaña personalizada", kicker: "Tropical Plants", title: "Nueva promoción", subtitle: "", buttonLabel: "Descubrir" },
  { id: "navidad", name: "Navidad", kicker: "ESPECIAL NAVIDAD", title: "Navidad con Tropical Plants", subtitle: "Regalos especiales para esta temporada.", buttonLabel: "Descubrir regalos" },
  { id: "sanvalentin", name: "San Valentín", kicker: "ESPECIAL SAN VALENTÍN", title: "Detalles con amor", subtitle: "Regalos para celebrar momentos especiales.", buttonLabel: "Ver regalos" },
  { id: "temporada", name: "Cambio de temporada", kicker: "NUEVA TEMPORADA", title: "Novedades de temporada", subtitle: "Descubre nuestra nueva selección.", buttonLabel: "Explorar novedades" },
] as const;

const fieldClass = "mt-1 block w-full rounded-xl border border-[#dce6dc] bg-white p-2.5 text-sm";
function CampaignField({ label, value, onChange, multiline = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block text-xs font-bold">
      {label}
      {multiline
        ? <textarea className={fieldClass} rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
        : <input className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
}

export function AdminCampaigns({
  campaigns,
  onChange,
}: {
  campaigns: MarketCampaign[];
  onChange: (campaigns: MarketCampaign[]) => void;
}) {
  const [template, setTemplate] = useState("general");
  const update = (index: number, patch: Partial<MarketCampaign>) =>
    onChange(campaigns.map((item, i) => i === index ? { ...item, ...patch } : item));

  const add = () => {
    const preset = templates.find((item) => item.id === template) || templates[0];
    const campaign: MarketCampaign = {
      id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID() : `campaign-${Date.now()}`,
      enabled: false,
      kicker: preset.kicker,
      title: preset.title,
      subtitle: preset.subtitle,
      href: "/productos",
      buttonLabel: preset.buttonLabel,
      imageUrl: "",
    };
    onChange([...campaigns, campaign]);
  };

  return (
    <section className="scroll-mt-6 rounded-2xl border border-[#dce6dc] bg-white p-5" id="market-editor-campanas">
      <div className="mb-4 flex items-start gap-3">
        <CalendarDays className="h-5 w-5 text-[#315b42]" />
        <div>
          <h4 className="font-black">Campañas y banners programables</h4>
          <p className="text-xs text-muted-foreground">Crea promociones ilimitadas, utiliza plantillas y decide las fechas en las que aparecerán. Las nuevas campañas comienzan apagadas.</p>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl bg-[#f3f7f1] p-3">
        <label className="min-w-[220px] flex-1 text-xs font-bold">
          Plantilla de campaña
          <select className={fieldClass} value={template} onChange={(event) => setTemplate(event.target.value)}>
            {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <button type="button" onClick={add} className="rounded-xl bg-[#315b42] px-4 py-3 text-sm font-black text-white">
          Crear campaña
        </button>
      </div>
      <div className="space-y-4">
        {campaigns.map((campaign, index) => (
          <div key={campaign.id} className="space-y-3 rounded-2xl border border-[#e1e8df] bg-[#fbfcf9] p-4">
            <div>
              <h5 className="font-black">{campaign.title}</h5>
              <p className="text-xs text-[#65766a]">{campaign.enabled === false ? "Borrador · OFF" : "Activa (sujeta a fechas y a la sección Promociones)"}</p>
            </div>
            <AdminElementControls label={campaign.title} visible={campaign.enabled !== false}
              onToggle={(enabled) => update(index, { enabled })}
              onMoveUp={() => onChange(reorderItem(campaigns, index, index - 1))}
              onMoveDown={() => onChange(reorderItem(campaigns, index, index + 1))}
              moveUpDisabled={index === 0}
              moveDownDisabled={index === campaigns.length - 1}
              onDuplicate={() => onChange([
                ...campaigns.slice(0, index + 1),
                { ...campaign, id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `campaign-${Date.now()}`, title: campaign.title + " copia", enabled: false },
                ...campaigns.slice(index + 1),
              ])}
              onRemove={() => onChange(campaigns.filter((_, i) => i !== index))}
            />
            <AdminScheduleFields label={campaign.title} value={campaign.schedule} onChange={(schedule) => update(index, { schedule })} />
            <div className="grid gap-3 lg:grid-cols-2">
              <CampaignField label="Texto pequeño" value={campaign.kicker} onChange={(kicker) => update(index, { kicker })} />
              <CampaignField label="Título" value={campaign.title} onChange={(title) => update(index, { title })} />
              <CampaignField label="Descripción" value={campaign.subtitle} onChange={(subtitle) => update(index, { subtitle })} multiline />
              <CampaignField label="Texto del botón" value={campaign.buttonLabel} onChange={(buttonLabel) => update(index, { buttonLabel })} />
              <CampaignField label="Enlace de destino" value={campaign.href} onChange={(href) => update(index, { href })} />
              <CampaignField label="Imagen · URL" value={campaign.imageUrl} onChange={(imageUrl) => update(index, { imageUrl })} />
            </div>
            {campaign.imageUrl && <img src={campaign.imageUrl} alt={`Vista previa de ${campaign.title}`} className="h-36 w-full rounded-xl object-cover" />}
            <AdminPromoDesignFields value={campaign.design} onChange={(design) => update(index, { design })} />
          </div>
        ))}
        {campaigns.length === 0 && <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Todavía no hay campañas adicionales. Dulce y Moda se administran por separado y no se eliminarán.</p>}
      </div>
    </section>
  );
}
