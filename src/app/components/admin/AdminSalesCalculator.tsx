import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";

type IvaRate = 10 | 21;

const recargoByIva: Record<IvaRate, number> = {
  10: 1.4,
  21: 5.2,
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value);

export function AdminSalesCalculator() {
  const [base, setBase] = useState(10);
  const [iva, setIva] = useState<IvaRate>(10);
  const [recargo, setRecargo] = useState(recargoByIva[10]);
  const [margen, setMargen] = useState(100);

  const results = useMemo(() => {
    const coste = base * (1 + iva / 100 + recargo / 100);
    const sinIva = base * (1 + margen / 100);
    const pvp = sinIva * (1 + iva / 100);
    const beneficio = pvp - coste;

    return { coste, sinIva, pvp, beneficio };
  }, [base, iva, recargo, margen]);

  const handleIvaChange = (value: IvaRate) => {
    setIva(value);
    setRecargo(recargoByIva[value]);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/50 bg-gradient-to-r from-primary/10 via-card to-secondary/10 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Calculator className="h-4 w-4" />
              IVA y recargo automático
            </div>
            <h1 className="text-3xl font-bold text-foreground">Calculadora de venta</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Calcula el precio de venta con IVA, recargo de equivalencia y beneficio de forma rápida y profesional.
            </p>
          </div>
          <div className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg">
            <p className="text-sm opacity-80">PVP final</p>
            <p className="text-3xl font-bold">{formatCurrency(results.pvp)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <section className="rounded-3xl border border-border/50 bg-card p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold text-foreground">Datos de cálculo</h2>

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
              <span className="mb-2 block text-sm font-medium text-foreground">Margen de ganancia (%)</span>
              <input
                type="number"
                min="0"
                step="1"
                value={margen}
                onChange={(event) => setMargen(Number(event.target.value) || 0)}
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-lg outline-none transition focus:ring-2 focus:ring-primary/50"
              />
            </label>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <ResultCard title="Coste real pagado" value={results.coste} />
          <ResultCard title="Precio sin IVA" value={results.sinIva} />
          <ResultCard title="PVP final" value={results.pvp} featured />
          <ResultCard title="Beneficio aproximado" value={results.beneficio} profit />
        </section>
      </div>

      <div className="rounded-3xl border border-border/50 bg-muted/30 p-6">
        <h2 className="mb-2 text-xl font-bold text-foreground">Fórmula utilizada</h2>
        <p className="text-muted-foreground">
          El recargo de equivalencia se incluye solo como coste. El precio de venta se calcula como base más margen, y después se añade el IVA.
        </p>
      </div>
    </div>
  );
}

function ResultCard({
  title,
  value,
  featured = false,
  profit = false,
}: {
  title: string;
  value: number;
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
      <p className={`mb-3 text-sm font-medium ${featured ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
        {title}
      </p>
      <p className="text-4xl font-bold tracking-tight">{formatCurrency(value)}</p>
    </div>
  );
}
