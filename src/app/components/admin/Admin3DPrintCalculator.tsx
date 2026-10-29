import { useMemo, useState } from "react";
import { Calculator, Copy, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const defaults = {
  grams: 150, spoolPrice: 15, spoolWeight: 1000, waste: 5,
  hours: 3, minutes: 40, watts: 100, electricityRate: 0.2,
  wearHourly: 0.15, laborMinutes: 15, laborHourly: 12,
  extras: 0.3, pieces: 1, markup: 100, feePercent: 0,
};
type Fields = typeof defaults;
const money = (value: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
const fieldLabels: Record<keyof Fields, string> = {
  grams: "Material por pieza (g)", spoolPrice: "Precio de la bobina (€)",
  spoolWeight: "Peso de la bobina (g)", waste: "Merma y purgas (%)",
  hours: "Horas de impresión", minutes: "Minutos de impresión",
  watts: "Consumo medio impresora (W)", electricityRate: "Electricidad (€/kWh)",
  wearHourly: "Desgaste máquina (€/h)", laborMinutes: "Trabajo manual (min)",
  laborHourly: "Tu tarifa (€/h)", extras: "Embalaje y otros (€)",
  pieces: "Número de piezas", markup: "Beneficio sobre costes (%)",
  feePercent: "Comisión plataforma (%)",
};
function Field({ name, value, onChange }: {name: keyof Fields; value: number; onChange: (value: number) => void}) {
  return <label className="block space-y-1 text-sm font-medium text-foreground">
    <span>{fieldLabels[name]}</span>
    <input type="number" min="0" step="any" value={value} onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground" />
  </label>;
}
export function Admin3DPrintCalculator() {
  const [fields, setFields] = useState<Fields>(defaults);
  const update = (name: keyof Fields, value: number) => setFields(current => ({ ...current, [name]: value }));
  const outcome = useMemo(() => {
    const time = fields.hours + fields.minutes / 60;
    const filament = fields.spoolWeight > 0 ? fields.grams * (1 + fields.waste / 100) * fields.spoolPrice / fields.spoolWeight : 0;
    const electricity = time * fields.watts / 1000 * fields.electricityRate;
    const wear = time * fields.wearHourly;
    const labor = fields.laborMinutes / 60 * fields.laborHourly;
    const cost = filament + electricity + wear + labor + fields.extras;
    const fee = Math.min(99.99, fields.feePercent) / 100;
    const price = cost * (1 + fields.markup / 100) / (1 - fee);
    const profit = price * (1 - fee) - cost;
    return { filament, electricity, wear, labor, cost, price, profit, feeAmount: price * fee };
  }, [fields]);
  const pieces = Math.max(1, Math.floor(fields.pieces || 1));
  const copy = async () => {
    const text = [
      "Tropical Plants · Presupuesto impresión 3D",
      `Unidades: ${pieces}`,
      `Material por pieza: ${fields.grams} g`,
      `Tiempo por pieza: ${fields.hours} h ${fields.minutes} min`,
      `Coste por pieza: ${money(outcome.cost)}`,
      `Precio sugerido por pieza: ${money(outcome.price)}`,
      `Beneficio estimado por pieza: ${money(outcome.profit)}`,
      `Precio total: ${money(outcome.price * pieces)}`,
    ].join("\n");
    try { await navigator.clipboard.writeText(text); toast.success("Presupuesto copiado"); }
    catch { toast.error("No se pudo copiar el presupuesto"); }
  };
  const group = (names: (keyof Fields)[]) => <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {names.map(name => <Field key={name} name={name} value={fields[name]} onChange={value => update(name, value)} />)}
  </div>;
  return <div className="mx-auto max-w-5xl space-y-6 pb-10">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-2xl font-bold"><Calculator className="h-6 w-6" /> Calculadora de impresiones 3D</h2>
        <p className="text-sm text-muted-foreground">Tropical Plants · Costes, electricidad, precios y rentabilidad por producto.</p></div>
      <button type="button" onClick={() => setFields(defaults)} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RotateCcw size={16} /> Restablecer</button>
    </div>
    <section className="rounded-xl border bg-card p-5 space-y-4"><h3 className="font-bold">Filamento e impresión</h3>
      {group(["grams", "spoolPrice", "spoolWeight", "waste", "hours", "minutes", "pieces"])}
    </section>
    <section className="rounded-xl border bg-card p-5 space-y-4"><h3 className="font-bold">Electricidad y fabricación</h3>
      {group(["watts", "electricityRate", "wearHourly", "laborMinutes", "laborHourly", "extras"])}
      <p className="text-xs text-muted-foreground">100 W es una referencia orientativa, no una medición de la Bambu Lab A1. Usa un medidor enchufable y el precio de energía de tu factura para mayor precisión.</p>
    </section>
    <section className="rounded-xl border bg-card p-5 space-y-4"><h3 className="font-bold">Venta y beneficio</h3>
      {group(["markup", "feePercent"])}
      <p className="text-xs text-muted-foreground">La comisión es porcentual y configurable. Si vendes en Etsy, añade las tarifas fijas y anuncios a «Otros» según corresponda. Los cálculos no sustituyen la contabilidad fiscal.</p>
    </section>
    <section className="rounded-xl border bg-card p-5 space-y-4" aria-live="polite">
      <h3 className="font-bold">Resultado por unidad</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-muted p-4"><p className="text-sm text-muted-foreground">Coste fabricación</p><p className="text-2xl font-bold">{money(outcome.cost)}</p></div>
        <div className="rounded-lg bg-muted p-4"><p className="text-sm text-muted-foreground">Precio recomendado</p><p className="text-2xl font-bold text-emerald-600">{money(outcome.price)}</p></div>
        <div className="rounded-lg bg-muted p-4"><p className="text-sm text-muted-foreground">Beneficio estimado</p><p className="text-2xl font-bold">{money(outcome.profit)}</p></div>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        {([["Filamento", outcome.filament], ["Electricidad", outcome.electricity], ["Desgaste", outcome.wear], ["Trabajo manual", outcome.labor], ["Embalaje y otros", fields.extras], ["Comisión estimada", outcome.feeAmount]] as const).map(([name, value]) =>
          <div key={name} className="flex justify-between border-b py-2"><span>{name}</span><strong>{money(value)}</strong></div>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-4">
        <span>Total para {pieces} pieza(s): <strong>{money(outcome.price * pieces)}</strong></span>
        <span>Beneficio total: <strong>{money(outcome.profit * pieces)}</strong></span>
      </div>
      <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground"><Copy size={16} /> Copiar presupuesto</button>
    </section>
  </div>;
}
