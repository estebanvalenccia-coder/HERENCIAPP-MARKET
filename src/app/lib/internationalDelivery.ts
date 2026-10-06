export type ColombiaDeliveryZone = {
  id: string;
  name: string;
  enabled: boolean;
  feeEUR: number;
  feeCOP: number;
  eta: string;
  note: string;
};

export type ColombiaProductOverride = {
  enabled: boolean;
  priceCOP: number;
  label?: string;
  trackInventoryColombia?: boolean;
  stockColombia?: number;
};

export type ColombiaCategory = { id: string; name: string; enabled: boolean; imageUrl?: string; };

export type ColombiaDeliverySettings = {
  enabled: boolean;
  country: "Colombia";
  flag: string;
  regionLabel: string;
  headline: string;
  description: string;
  heroKicker: string;
  heroCtaLabel: string;
  heroImageUrl: string;
  giftMessageEnabled: boolean;
  recipientPhoneRequired: boolean;
  surpriseEnabled: boolean;
  schedulingEnabled: boolean;
  paymentEnabled: boolean;
  sameDayLabel: string;
  selectedProductIds: string[];
  productOrder: string[];
  categories: ColombiaCategory[];
  productOverrides: Record<string, ColombiaProductOverride>;
  zones: ColombiaDeliveryZone[];
};

export const COLOMBIA_DELIVERY_STORAGE_KEY = "internationalDeliverySettings";

export const defaultColombiaDeliverySettings: ColombiaDeliverySettings = {
  enabled: true,
  country: "Colombia",
  flag: "🇨🇴",
  regionLabel: "Cali, Candelaria, Palmira y alrededores",
  headline: "Cali, flores que hablan desde el corazón",
  description: "Envía plantas, flores y regalos a tus seres queridos en Cali, Candelaria, Palmira y alrededores. Tradición, color y vida en cada entrega.",
  heroKicker: "COLOMBIANÍSIMAS",
  heroCtaLabel: "Enviar un regalo a Cali",
  heroImageUrl: "https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1800&q=85",
  giftMessageEnabled: true,
  recipientPhoneRequired: true,
  surpriseEnabled: true,
  schedulingEnabled: true,
  paymentEnabled: true,
  sameDayLabel: "Entrega el mismo día (según disponibilidad)",
  selectedProductIds: [],
  productOrder: [],
  categories: [
    { id: "plantas", name: "Plantas", enabled: true },
    { id: "ramos", name: "Ramos", enabled: true },
    { id: "orquideas", name: "Orquídeas", enabled: true },
    { id: "regalos", name: "Regalos", enabled: true },
    { id: "dulce", name: "Dulce", enabled: true },
    { id: "moda", name: "Moda", enabled: true },
    { id: "decoracion", name: "Decoración", enabled: true },
    { id: "cestas", name: "Cestas", enabled: true },
    { id: "eventos", name: "Eventos", enabled: true },
    { id: "personalizados", name: "Personalizados", enabled: true },
  ],
  productOverrides: {},
  zones: [
    { id: "cali", name: "Cali (urbano)", enabled: true, feeEUR: 2.3, feeCOP: 9900, eta: "Hoy o mañana", note: "Cobertura urbana" },
    { id: "candelaria", name: "Candelaria", enabled: true, feeEUR: 3, feeCOP: 12900, eta: "1–2 días", note: "Candelaria y sectores cercanos" },
    { id: "palmira", name: "Palmira", enabled: true, feeEUR: 3.2, feeCOP: 13900, eta: "1–2 días", note: "Palmira urbana y sectores cercanos" },
    { id: "alrededores", name: "Alrededores", enabled: true, feeEUR: 3.5, feeCOP: 14900, eta: "2–3 días", note: "Jamundí, Yumbo y otras zonas bajo confirmación" },
  ],
};

export function parseColombiaDeliverySettings(raw: string | null): ColombiaDeliverySettings {
  if (!raw) return defaultColombiaDeliverySettings;
  try {
    const incoming = JSON.parse(raw) || {};
    const legacyHeadline = String(incoming.headline || "") === "Ahora también en Cali, Colombia";
    const legacyDescription = String(incoming.description || "") === "Envía plantas, flores y regalos a tus seres queridos en Cali, Candelaria y alrededores.";
    const legacyRegion = String(incoming.regionLabel || "") === "Cali, Candelaria y alrededores";

    const parsedZones = Array.isArray(incoming.zones) && incoming.zones.length
      ? incoming.zones.map((zone: any, index: number) => ({
          id: String(zone.id || `zone-${index + 1}`),
          name: String(zone.name || "Zona"),
          enabled: zone.enabled !== false,
          feeEUR: Math.max(0, Number(zone.feeEUR || 0)),
          feeCOP: Math.max(0, Number(zone.feeCOP || 0)),
          eta: String(zone.eta || "A confirmar"),
          note: String(zone.note || ""),
        }))
      : [...defaultColombiaDeliverySettings.zones];

    // Migra automáticamente la configuración antigua que ya estaba guardada
    // antes de añadir Palmira como zona independiente.
    if (!parsedZones.some((zone: ColombiaDeliveryZone) => zone.id === "palmira")) {
      const palmira = defaultColombiaDeliverySettings.zones.find((zone) => zone.id === "palmira");
      const surroundingsIndex = parsedZones.findIndex((zone: ColombiaDeliveryZone) => zone.id === "alrededores");
      if (palmira) parsedZones.splice(surroundingsIndex >= 0 ? surroundingsIndex : parsedZones.length, 0, { ...palmira });
    }

    return {
      ...defaultColombiaDeliverySettings,
      ...incoming,
      regionLabel: legacyRegion ? defaultColombiaDeliverySettings.regionLabel : String(incoming.regionLabel || defaultColombiaDeliverySettings.regionLabel),
      headline: legacyHeadline ? defaultColombiaDeliverySettings.headline : String(incoming.headline || defaultColombiaDeliverySettings.headline),
      description: legacyDescription ? defaultColombiaDeliverySettings.description : String(incoming.description || defaultColombiaDeliverySettings.description),
      heroKicker: String(incoming.heroKicker || defaultColombiaDeliverySettings.heroKicker),
      heroCtaLabel: String(incoming.heroCtaLabel || defaultColombiaDeliverySettings.heroCtaLabel),
      selectedProductIds: Array.isArray(incoming.selectedProductIds) ? incoming.selectedProductIds.map(String) : [],
      productOrder: Array.isArray(incoming.productOrder) ? incoming.productOrder.map(String) : [],
      categories: Array.isArray(incoming.categories) && incoming.categories.length ? incoming.categories.map((item:any,index:number)=>({ id:String(item.id || `categoria-${index+1}`), name:String(item.name || "Categoría"), enabled:item.enabled !== false, imageUrl:item.imageUrl ? String(item.imageUrl) : undefined })) : defaultColombiaDeliverySettings.categories.map(item=>({...item})),
      paymentEnabled: incoming.paymentEnabled === undefined ? true : Boolean(incoming.paymentEnabled),
      productOverrides: incoming.productOverrides && typeof incoming.productOverrides === "object"
        ? Object.fromEntries(Object.entries(incoming.productOverrides).map(([id, value]: any) => [
            String(id),
            {
              enabled: value?.enabled !== false,
              priceCOP: Math.max(0, Number(value?.priceCOP || 0)),
              label: value?.label ? String(value.label) : undefined,
              trackInventoryColombia: Boolean(value?.trackInventoryColombia),
              stockColombia: Math.max(0, Math.floor(Number(value?.stockColombia || 0))),
            },
          ]))
        : {},
      zones: parsedZones,
    };
  } catch {
    return defaultColombiaDeliverySettings;
  }
}
