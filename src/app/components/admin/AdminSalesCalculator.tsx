import { useMemo, useState } from "react";
import { Calculator, Euro, Percent, Sparkles, TrendingUp } from "lucide-react";

type IvaRate = 10 | 21;
type RoundMode = "none" | "psychological" | "half" | "euro";

const recargoByIva: Record<IvaRate, number> = {
  10: 1.4,
  21: 5.2,
};

const presets = [
  { label: "Flores y plantas", iva: 10 as IvaRate, recargo: 1.4, margen: 100 },
  { label: "Ramo premium", iva: 10 as IvaRate, recargo: 1.4, margen: 140 },
  { label: "Macetas/deco", iva: 21 as IvaRate, recargo: 5.2, margen: 80 },
  { label: "Oferta rápida", iva: 10 as IvaRate, recargo: 1.4, margen: 60 },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number.isFinite(value) ? value : 0);

function roundPrice(value: number, mode: RoundMode) {
  if (!Number.isFinite(value)) return 0;
  if (mode === "half") return Math.ceil(value * 2) / 2;
  if (mode === "euro") return Math.ceil(value);
  if (mode === "psychological") return Math.max(0, Math.ceil(value) - 0.01);
  return value;
}

export function AdminSalesCalculator() {
  const [base, setBase] = useState(10);
  const [iva, setIva] = useState<IvaRate>(10);
  const [recargo, setRecargo] = useState(recargoByIva[10]);
  const [margen, setMargen] = useState(100);
  const [roundMode, setRoundMode] = useState<RoundMode>("psychological");
  const [units, setUnits] = useState(1);

  const results = useMemo(() => {
    const costeUnitario = base * (1 + iva / 100 + recargo / 100);
    const precioSinIva = base * (1 + margen / 100);
    const pvpCalculado = precioSinIva * (1 + iva / 100);
    const pvpRedondeado = roundPrice(pvpCalculado, roundMode);
    const beneficioUnitario = pvpRedondeado - costeUnitario;
    const margenReal = pvpRedondeado > 0 ? (beneficioUnitario / pvpRedondeado) * 100 : 0;
    const multiplicador = base > 0 ? pvpRedondeado / base : 0;
    const totalCoste = costeUnitario * units;
    const totalVenta = pvpRedondeado * units;
    const totalBeneficio = beneficioUnitario * units;

    return {
      costeUnitario,
      precioSinIva,
      pvpCalculado,
      pvpRedondeado,
      beneficioUnitario,
      margenReal,
      multiplicador,
      totalCoste,
      totalVenta,
      totalBeneficio,
    };
  }, [base, iva, margen, recargo, roundMode, units]);

  const handleIvaChange = (value: IvaRate) => {
    setIva(value);
    setRecargo(recargoByIva[value]);
  };

  const applyPreset = (preset: (typeof presets)[number]) => {
    setIva(preset.iva);
    setRecargo(preset.recargo);
    setMargen(preset.margen);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/50 bg-gradient-to-r from-primary/10 via-card to-secondary/10 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Calculator className="h-4 w-4" />
              IVA, recargo, margen y redondeo pro
            </div>
            <h1 className="text-3xl font-bold text-foreground">Calculadora de venta</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Calcula el PVP ideal con coste real, beneficio, margen real, multiplicador y precio psicológico.
            </p>
          </div>
          <div className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg">
            <p className="text-sm opacity-80">PVP recomendado</p>
            <p className="text-3xl font-bold">{formatCurrency(results.pvpRedondeado)}</p>
            <p className="mt-1 text-xs opacity-80">Calculado: {formatCurrency(results.pvpCalculado)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="rounded-3xl border border-border/50 bg-card p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold text-foreground">Datos de cálculo</h2>

          <div className="mb-5 grid grid-cols-2 gap-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset)}
                className="rounded-2xl border border-border bg-background px-3 py-2 text-left text-sm font-medium transition hover:bg-accent"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">Precio base de compra (€)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={base}
                onChange={(event) => setBase(Number(event.target.value) || 0)}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-lg outline-none transition focus:ring-2 focus:ring-primary/50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">Unidades</span>
              <input
                type="number"
                min="1"
                step="1"
                value={units}
                onChange={(event) => setUnits(Math.max(1, Number(event.target.value) || 1))}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-lg outline-none transition focus:ring-2 focus:ring-primary/50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">Tipo de IVA</span>
              <select
                value={iva}
                onChange={(event) => handleIvaChange(Number(event.target.value) as IvaRate)}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-lg outline-none transition focus:ring-2 focus:ring-primary/50"
              >
                <option value={10}>10% · Plantas y flores</option>
                <option value={21}>21% · Macetas y decoración</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">Recargo de equivalencia (%)</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={recargo}
                onChange={(event) => setRecargo(Number(event.target.value) || 0)}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-lg outline-none transition focus:ring-2 focus:ring-primary/50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">Margen de ganancia sobre compra (%)</span>
              <input
                type="number"
                min="0"
                step="1"
                value={margen}
                onChange={(event) => setMargen(Number(event.target.value) || 0)}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-lg outline-none transition focus:ring-2 focus:ring-primary/50"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">Redondeo del precio</span>
              <select
                value={roundMode}
                onChange={(event) => setRoundMode(event.target.value as RoundMode)}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-lg outline-none transition focus:ring-2 focus:ring-primary/50"
              >
                <option value="psychological">Psicológico · termina en ,99</option>
                <option value="half">Redondear a 0,50€ superior</option>
                <option value="euro">Redondear al euro superior</option>
                <option value="none">Sin redondeo</option>
              </select>
            </label>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <ResultCard icon={<Euro className="h-5 w-5" />} title="Coste real unitario" value={formatCurrency(results.costeUnitario)} />
          <ResultCard icon={<Calculator className="h-5 w-5" />} title="Precio sin IVA" value={formatCurrency(results.precioSinIva)} />
          <ResultCard icon={<Sparkles className="h-5 w-5" />} title="PVP final" value={formatCurrency(results.pvpRedondeado)} featured />
          <ResultCard icon={<TrendingUp className="h-5 w-5" />} title="Beneficio unitario" value={formatCurrency(results.beneficioUnitario)} profit />
          <ResultCard icon={<Percent className="h-5 w-5" />} title="Margen real sobre venta" value={`${results.margenReal.toFixed(1)}%`} />
          <ResultCard icon={<TrendingUp className="h-5 w-5" />} title="Multiplicador" value={`x${results.multiplicador.toFixed(2)}`} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-border/50 bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Total coste lote</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{formatCurrency(results.totalCoste)}</p>
        </div>
        <div className="rounded-3xl border border-primary/30 bg-primary/10 p-6 shadow-sm">
          <p className="text-sm text-primary">Total venta lote</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{formatCurrency(results.totalVenta)}</p>
        </div>
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <p className="text-sm text-emerald-700">Beneficio lote</p>
          <p className="mt-2 text-3xl font-bold text-emerald-900">{formatCurrency(results.totalBeneficio)}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-border/50 bg-muted/30 p-6">
        <h2 className="mb-2 text-xl font-bold text-foreground">Fórmula utilizada</h2>
        <p className="text-muted-foreground">
          El recargo de equivalencia se suma al coste real. El PVP se calcula aplicando margen sobre compra, IVA de venta y el redondeo elegido. El margen real muestra el beneficio sobre el precio final de venta.
        </p>
      </div>
    </div>
  );
}

function ResultCard({
  title,
  value,
  icon,
  featured = false,
  profit = false,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  featured?: boolean;
  profit?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-6 shadow-sm ${
        featured
          ? "border-primary bg-primary text-primary-foreground"
          : profit
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-border/50 bg-card text-foreground"
      }`}
    >
      <div className="mb-3 flex items-center gap-2 opacity-80">
        {icon}
        <p className="text-sm font-medium">{title}</p>
      </div>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}
