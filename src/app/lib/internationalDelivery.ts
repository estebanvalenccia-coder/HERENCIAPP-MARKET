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
};

export type ColombiaDeliverySettings = {
  enabled: boolean;
  country: "Colombia";
  flag: string;
  regionLabel: string;
  headline: string;
  description: string;
  heroImageUrl: string;
  giftMessageEnabled: boolean;
  recipientPhoneRequired: boolean;
  surpriseEnabled: boolean;
  schedulingEnabled: boolean;
  paymentEnabled: boolean;
  sameDayLabel: string;
  selectedProductIds: string[];
  productOverrides: Record<string, ColombiaProductOverride>;
  zones: ColombiaDeliveryZone[];
};

export const COLOMBIA_DELIVERY_STORAGE_KEY = "internationalDeliverySettings";

export const defaultColombiaDeliverySettings: ColombiaDeliverySettings = {
  enabled: true,
  country: "Colombia",
  flag: "🇨🇴",
  regionLabel: "Cali, Candelaria y alrededores",
  headline: "Ahora también en Cali, Colombia",
  description: "Envía plantas, flores y regalos a tus seres queridos en Cali, Candelaria y alrededores.",
  heroImageUrl: "https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1800&q=85",
  giftMessageEnabled: true,
  recipientPhoneRequired: true,
  surpriseEnabled: true,
  schedulingEnabled: true,
  paymentEnabled: false,
  sameDayLabel: "Entrega el mismo día (según disponibilidad)",
  selectedProductIds: [],
  productOverrides: {},
  zones: [
    { id: "cali", name: "Cali (urbano)", enabled: true, feeEUR: 2.3, feeCOP: 9900, eta: "Hoy o mañana", note: "Cobertura urbana" },
    { id: "candelaria", name: "Candelaria", enabled: true, feeEUR: 3, feeCOP: 12900, eta: "1–2 días", note: "Candelaria y sectores cercanos" },
    { id: "alrededores", name: "Alrededores", enabled: true, feeEUR: 3.5, feeCOP: 14900, eta: "2–3 días", note: "Palmira, Jamundí, Yumbo y otras zonas bajo confirmación" },
  ],
};

export function parseColombiaDeliverySettings(raw: string | null): ColombiaDeliverySettings {
  if (!raw) return defaultColombiaDeliverySettings;
  try {
    const incoming = JSON.parse(raw) || {};
    return {
      ...defaultColombiaDeliverySettings,
      ...incoming,
      selectedProductIds: Array.isArray(incoming.selectedProductIds) ? incoming.selectedProductIds.map(String) : [],
      productOverrides: incoming.productOverrides && typeof incoming.productOverrides === "object"
        ? Object.fromEntries(Object.entries(incoming.productOverrides).map(([id, value]: any) => [
            String(id),
            {
              enabled: value?.enabled !== false,
              priceCOP: Math.max(0, Number(value?.priceCOP || 0)),
              label: value?.label ? String(value.label) : undefined,
            },
          ]))
        : {},
      zones: Array.isArray(incoming.zones) && incoming.zones.length
        ? incoming.zones.map((zone: any, index: number) => ({
            id: String(zone.id || `zone-${index + 1}`),
            name: String(zone.name || "Zona"),
            enabled: zone.enabled !== false,
            feeEUR: Math.max(0, Number(zone.feeEUR || 0)),
            feeCOP: Math.max(0, Number(zone.feeCOP || 0)),
            eta: String(zone.eta || "A confirmar"),
            note: String(zone.note || ""),
          }))
        : defaultColombiaDeliverySettings.zones,
    };
  } catch {
    return defaultColombiaDeliverySettings;
  }
}
