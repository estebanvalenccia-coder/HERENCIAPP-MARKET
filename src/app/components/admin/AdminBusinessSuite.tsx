import { useEffect, useMemo, useState } from "react";
import { BarChart3, Calendar, Gift, Globe, Save, Shield, Store, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { backendStorage } from "../../lib/backendStorage";

type SuiteSettings = {
  loyaltyEnabled: boolean;
  referralsEnabled: boolean;
  giftCardsEnabled: boolean;
  subscriptionsEnabled: boolean;
  scheduledOrdersEnabled: boolean;
  reviewsEnabled: boolean;
  waitlistEnabled: boolean;
  customerLevelsEnabled: boolean;
  pushEnabled: boolean;
  whatsappEnabled: boolean;
  maintenanceMode: boolean;
  lowStockThreshold: number;
  freeShippingFrom: number;
  pointsPerEuro: number;
  referralReward: number;
  maxDeliveryKm: number;
};

const defaults: SuiteSettings = {
  loyaltyEnabled: true,
  referralsEnabled: true,
  giftCardsEnabled: true,
  subscriptionsEnabled: false,
  scheduledOrdersEnabled: true,
  reviewsEnabled: true,
  waitlistEnabled: true,
  customerLevelsEnabled: true,
  pushEnabled: false,
  whatsappEnabled: false,
  maintenanceMode: false,
  lowStockThreshold: 3,
  freeShippingFrom: 75,
  pointsPerEuro: 1,
  referralReward: 5,
  maxDeliveryKm: 18,
};

const modules = [
  { group: "Clientes", icon: Users, items: ["CRM y segmentos", "Favoritos y listas", "Puntos y niveles", "Referidos", "Recordatorios de fechas", "Reseñas verificadas"] },
  { group: "Marketing", icon: Zap, items: ["Cupones avanzados", "Promociones automáticas", "Campañas estacionales", "Carritos abandonados", "SEO y contenidos", "A/B testing"] },
  { group: "Operaciones", icon: Store, items: ["Inventario multiubicación", "Proveedores y compras", "Mermas y conteos", "Pedidos programados", "Reparto y capacidad", "Tareas internas"] },
  { group: "Finanzas", icon: BarChart3, items: ["Margen real", "Gastos internos", "Caja y arqueo", "Facturas proveedor", "Informes", "Rentabilidad por canal"] },
  { group: "Experiencia", icon: Gift, items: ["Tarjetas regalo", "Suscripciones", "Variantes y extras", "Personalización", "Venta cruzada", "Pasaporte QR de planta"] },
  { group: "Plataforma", icon: Shield, items: ["Permisos granulares", "Auditoría", "Papelera y versiones", "Estado de integraciones", "PWA y push", "Privacidad/RGPD"] },
];

export function AdminBusinessSuite() {
  const [settings, setSettings] = useState<SuiteSettings>(defaults);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    try {
      const raw = backendStorage.getItem("businessSuiteSettings");
      if (raw) setSettings({ ...defaults, ...JSON.parse(raw) });
    } catch {
      setSettings(defaults);
    }
  }, []);

  const visibleModules = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return modules;
    return modules
      .map((section) => ({ ...section, items: section.items.filter((item) => item.toLowerCase().includes(q) || section.group.toLowerCase().includes(q)) }))
      .filter((section) => section.items.length);
  }, [filter]);

  const save = async () => {
    const result = await backendStorage.setItem("businessSuiteSettings", JSON.stringify(settings));
    if (!result.ok) return toast.error(result.error || "No se pudo guardar");
    toast.success("Centro de Negocio guardado");
  };

  const toggle = (key: keyof SuiteSettings) =>
    setSettings((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-6 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-primary"><Globe className="h-5 w-5" /><span className="text-sm font-bold uppercase tracking-wider">Herencia Business OS</span></div>
            <h2 className="text-3xl font-black text-foreground">Centro de Negocio</h2>
            <p className="mt-2 max-w-3xl text-muted-foreground">Unifica ecommerce, TPV, CRM, inventario, marketing y operaciones. Los ajustes de esta pantalla quedan persistidos en el backend de configuración de Herencia.</p>
          </div>
          <button onClick={save} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground hover:bg-primary/90"><Save className="h-4 w-4" />Guardar configuración</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Módulos organizados" value="36+" detail="en 6 áreas de negocio" />
        <Metric label="Stock bajo" value={String(settings.lowStockThreshold)} detail="umbral configurable" />
        <Metric label="Envío gratis" value={settings.freeShippingFrom ? `€${settings.freeShippingFrom}` : "No"} detail="importe mínimo" />
        <Metric label="Radio reparto" value={`${settings.maxDeliveryKm} km`} detail="límite operativo" />
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /><h3 className="text-xl font-bold">Funciones comerciales</h3></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Toggle label="Programa de puntos" value={settings.loyaltyEnabled} onClick={() => toggle("loyaltyEnabled")} />
          <Toggle label="Referidos" value={settings.referralsEnabled} onClick={() => toggle("referralsEnabled")} />
          <Toggle label="Tarjetas regalo" value={settings.giftCardsEnabled} onClick={() => toggle("giftCardsEnabled")} />
          <Toggle label="Suscripciones" value={settings.subscriptionsEnabled} onClick={() => toggle("subscriptionsEnabled")} />
          <Toggle label="Pedidos programados" value={settings.scheduledOrdersEnabled} onClick={() => toggle("scheduledOrdersEnabled")} />
          <Toggle label="Reseñas verificadas" value={settings.reviewsEnabled} onClick={() => toggle("reviewsEnabled")} />
          <Toggle label="Lista de espera" value={settings.waitlistEnabled} onClick={() => toggle("waitlistEnabled")} />
          <Toggle label="Niveles Semilla/Brote/Jardín" value={settings.customerLevelsEnabled} onClick={() => toggle("customerLevelsEnabled")} />
          <Toggle label="Notificaciones push" value={settings.pushEnabled} onClick={() => toggle("pushEnabled")} />
          <Toggle label="WhatsApp automático" value={settings.whatsappEnabled} onClick={() => toggle("whatsappEnabled")} />
          <Toggle label="Modo mantenimiento" value={settings.maintenanceMode} onClick={() => toggle("maintenanceMode")} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" /><h3 className="text-xl font-bold">Reglas operativas</h3></div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <NumberField label="Avisar stock ≤" value={settings.lowStockThreshold} onChange={(v) => setSettings({ ...settings, lowStockThreshold: v })} />
          <NumberField label="Envío gratis desde €" value={settings.freeShippingFrom} onChange={(v) => setSettings({ ...settings, freeShippingFrom: v })} />
          <NumberField label="Puntos por €" value={settings.pointsPerEuro} onChange={(v) => setSettings({ ...settings, pointsPerEuro: v })} />
          <NumberField label="Premio referido €" value={settings.referralReward} onChange={(v) => setSettings({ ...settings, referralReward: v })} />
          <NumberField label="Radio máximo km" value={settings.maxDeliveryKm} onChange={(v) => setSettings({ ...settings, maxDeliveryKm: v })} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="text-xl font-bold">Mapa funcional de Herencia</h3><p className="text-sm text-muted-foreground">Sirve como centro de control y hoja de ruta del sistema.</p></div>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar función…" className="rounded-xl border border-border bg-background px-4 py-2 text-sm" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {visibleModules.map((section) => (
            <div key={section.group} className="rounded-2xl border border-border bg-background p-5">
              <div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-2"><section.icon className="h-5 w-5 text-primary" /></div><h4 className="font-bold">{section.group}</h4></div>
              <div className="space-y-2">{section.items.map((item) => <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{item}</div>)}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-2xl border border-border bg-card p-5"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-black text-foreground">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}

function Toggle({ label, value, onClick }: { label: string; value: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex items-center justify-between rounded-xl border border-border bg-background p-4 text-left"><span className="text-sm font-semibold">{label}</span><span className={`relative h-6 w-11 rounded-full transition-colors ${value ? "bg-primary" : "bg-muted-foreground/30"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} /></span></button>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="text-sm font-semibold text-foreground">{label}<input type="number" min="0" step="1" value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value || 0)))} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 font-normal" /></label>;
}
