export type ColombiaDeliveryZone = {
  id: string;
  name: string;
  enabled: boolean;
  feeEUR: number;
  eta: string;
  note: string;
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
  selectedProductIds: string[];
  zones: ColombiaDeliveryZone[];
};

export const COLOMBIA_DELIVERY_STORAGE_KEY = "internationalDeliverySettings";

export const defaultColombiaDeliverySettings: ColombiaDeliverySettings = {
  enabled: true,
  country: "Colombia",
  flag: "🇨🇴",
  regionLabel: "Cali, Candelaria y alrededores",
  headline: "Envía plantas y regalos en Cali, Colombia",
  description: "Compra desde España y sorprende a alguien en Cali, Candelaria y zonas cercanas con una entrega local preparada por Herencia.",
  heroImageUrl: "https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1800&q=85",
  giftMessageEnabled: true,
  recipientPhoneRequired: true,
  selectedProductIds: [],
  zones: [
    { id: "cali", name: "Cali", enabled: true, feeEUR: 9.9, eta: "Hoy o mañana, según disponibilidad", note: "Cobertura urbana" },
    { id: "candelaria", name: "Candelaria", enabled: true, feeEUR: 12.9, eta: "1–2 días", note: "Candelaria y sectores cercanos" },
    { id: "alrededores", name: "Alrededores", enabled: true, feeEUR: 16.9, eta: "A confirmar", note: "Palmira, Jamundí, Yumbo y otras zonas bajo confirmación" },
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
      zones: Array.isArray(incoming.zones) && incoming.zones.length
        ? incoming.zones.map((zone: any, index: number) => ({
            id: String(zone.id || `zone-${index + 1}`),
            name: String(zone.name || "Zona"),
            enabled: zone.enabled !== false,
            feeEUR: Math.max(0, Number(zone.feeEUR || 0)),
            eta: String(zone.eta || "A confirmar"),
            note: String(zone.note || ""),
          }))
        : defaultColombiaDeliverySettings.zones,
    };
  } catch {
    return defaultColombiaDeliverySettings;
  }
}
