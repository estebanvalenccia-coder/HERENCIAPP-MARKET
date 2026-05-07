import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Calculator,
  Euro,
  Flower2,
  Package,
  Plus,
  Save,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { backendStorage } from "../../lib/backendStorage";

type FlowerCost = {
  id: string;
  name: string;
  category: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  unit: string;
  supplier: string;
};

type BouquetLine = {
  flowerId: string;
  quantity: number;
};

const STORAGE_KEY = "adminFlowerCosts";
const LATEST_QUOTE_KEY = "adminLatestFlowerQuote";

const defaultFlowers: FlowerCost[] = [
  { id: "rosa-roja", name: "Rosa roja", category: "Flor principal", purchasePrice: 1.2, salePrice: 3.5, stock: 80, unit: "unidad", supplier: "Proveedor local" },
  { id: "tulipan-blanco", name: "Tulipán blanco", category: "Flor principal", purchasePrice: 1.4, salePrice: 3.8, stock: 45, unit: "unidad", supplier: "Holland Flowers" },
  { id: "eucalipto", name: "Eucalipto", category: "Verde decorativo", purchasePrice: 0.7, salePrice: 2.2, stock: 120, unit: "tallo", supplier: "Verdes Premium" },
  { id: "paniculata", name: "Paniculata", category: "Relleno", purchasePrice: 0.5, salePrice: 1.8, stock: 95, unit: "tallo", supplier: "Floralia" },
];

const emptyFlower = {
  name: "",
  category: "Flor principal",
  purchasePrice: 0,
  salePrice: 0,
  stock: 0,
  unit: "unidad",
  supplier: "",
};

const money = (value: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number.isFinite(value) ? value : 0);

const numberValue = (value: string) => Number(value.replace(",", ".")) || 0;

const slug = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function loadFlowers() {
  const saved = backendStorage.getItem(STORAGE_KEY);
  if (!saved) return defaultFlowers;

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length ? parsed : defaultFlowers;
  } catch {
    return defaultFlowers;
  }
}

export function AdminFlowerCosts() {
  const [flowers, setFlowers] = useState<FlowerCost[]>(loadFlowers);
  const [draftFlower, setDraftFlower] = useState(emptyFlower);
  const [bouquetLines, setBouquetLines] = useState<BouquetLine[]>([{ flowerId: "rosa-roja", quantity: 6 }]);
  const [laborCost, setLaborCost] = useState(8);
  const [packagingCost, setPackagingCost] = useState(4);
  const [deliveryCost, setDeliveryCost] = useState(0);
  const [targetMargin, setTargetMargin] = useState(55);
  const [occasion, setOccasion] = useState("Regalo especial");

  const quote = useMemo(() => {
    const lines = bouquetLines
      .map((line) => {
        const flower = flowers.find((item) => item.id === line.flowerId);
        if (!flower) return null;

        return {
          ...line,
          flower,
          cost: flower.purchasePrice * line.quantity,
          retail: flower.salePrice * line.quantity,
          hasStock: flower.stock >= line.quantity,
        };
      })
      .filter(Boolean) as Array<BouquetLine & { flower: FlowerCost; cost: number; retail: number; hasStock: boolean }>;

    const flowerCost = lines.reduce((sum, line) => sum + line.cost, 0);
    const flowerRetail = lines.reduce((sum, line) => sum + line.retail, 0);
    const serviceCost = laborCost + packagingCost + deliveryCost;
    const realCost = flowerCost + serviceCost;
    const recommendedByMargin = targetMargin >= 99 ? realCost : realCost / (1 - targetMargin / 100);
    const recommendedPrice = Math.max(recommendedByMargin, flowerRetail + serviceCost);
    const profit = recommendedPrice - realCost;
    const finalMargin = recommendedPrice > 0 ? (profit / recommendedPrice) * 100 : 0;
    const missingStock = lines.filter((line) => !line.hasStock);

    return { lines, flowerCost, flowerRetail, serviceCost, realCost, recommendedPrice, profit, finalMargin, missingStock };
  }, [bouquetLines, deliveryCost, flowers, laborCost, packagingCost, targetMargin]);

  const stats = useMemo(() => {
    const inventoryCost = flowers.reduce((sum, flower) => sum + flower.purchasePrice * flower.stock, 0);
    const inventoryRetail = flowers.reduce((sum, flower) => sum + flower.salePrice * flower.stock, 0);
    const lowStock = flowers.filter((flower) => flower.stock <= 10).length;
    const averageMargin = flowers.length
      ? flowers.reduce((sum, flower) => {
          const margin = flower.salePrice > 0 ? ((flower.salePrice - flower.purchasePrice) / flower.salePrice) * 100 : 0;
          return sum + margin;
        }, 0) / flowers.length
      : 0;

    return { inventoryCost, inventoryRetail, lowStock, averageMargin };
  }, [flowers]);

  const aiSummary = useMemo(() => {
    const names = quote.lines.map((line) => line.flower.name).join(", ") || "flores de temporada";
    const stockAdvice = quote.missingStock.length
      ? `Atención: falta stock suficiente de ${quote.missingStock.map((line) => line.flower.name).join(", ")}.`
      : "Stock suficiente para preparar este ramo.";

    return `Propuesta IA: ramo para ${occasion.toLowerCase()} con ${names}. Precio recomendado ${money(quote.recommendedPrice)}, margen estimado ${quote.finalMargin.toFixed(1)}%. ${stockAdvice}`;
  }, [occasion, quote.finalMargin, quote.lines, quote.missingStock, quote.recommendedPrice]);

  const saveFlowers = (nextFlowers = flowers) => {
    backendStorage.setItem(STORAGE_KEY, JSON.stringify(nextFlowers));
    toast.success("Costes de flores guardados");
  };

  const updateFlower = (id: string, key: keyof FlowerCost, value: string | number) => {
    setFlowers((current) => current.map((flower) => (flower.id === id ? { ...flower, [key]: value } : flower)));
  };

  const addFlower = () => {
    if (!draftFlower.name.trim()) {
      toast.error("Escribe el nombre de la flor");
      return;
    }

    const nextFlower: FlowerCost = {
      ...draftFlower,
      id: `${slug(draftFlower.name)}-${Date.now()}`,
    };
    const nextFlowers = [...flowers, nextFlower];
    setFlowers(nextFlowers);
    setDraftFlower(emptyFlower);
    saveFlowers(nextFlowers);
  };

  const removeFlower = (id: string) => {
    const nextFlowers = flowers.filter((flower) => flower.id !== id);
    setFlowers(nextFlowers);
    setBouquetLines((current) => current.filter((line) => line.flowerId !== id));
    saveFlowers(nextFlowers);
  };

  const addBouquetLine = () => {
    if (!flowers.length) return;
    setBouquetLines((current) => [...current, { flowerId: flowers[0].id, quantity: 1 }]);
  };

  const confirmSale = () => {
    if (quote.missingStock.length) {
      toast.error("No hay stock suficiente para confirmar este ramo");
      return;
    }

    const nextFlowers = flowers.map((flower) => {
      const used = quote.lines.find((line) => line.flowerId === flower.id);
      return used ? { ...flower, stock: flower.stock - used.quantity } : flower;
    });

    backendStorage.setItem(
      LATEST_QUOTE_KEY,
      JSON.stringify({ createdAt: new Date().toISOString(), occasion, quote })
    );
    setFlowers(nextFlowers);
    saveFlowers(nextFlowers);
    toast.success("Venta registrada y stock actualizado");
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border/50 bg-gradient-to-r from-rose-50 via-card to-emerald-50 p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              <Flower2 className="h-4 w-4" />
              Coste flores profesional
            </div>
            <h1 className="text-3xl font-bold text-foreground">Coste, stock y precio de ramos</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Controla el coste real de cada flor, calcula márgenes, prepara presupuestos y descuenta stock al confirmar una venta.
            </p>
          </div>
          <div className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg min-w-[230px]">
            <p className="text-sm opacity-80">Precio recomendado</p>
            <p className="text-3xl font-bold">{money(quote.recommendedPrice)}</p>
            <p className="mt-1 text-xs opacity-80">Margen {quote.finalMargin.toFixed(1)}%</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={<Package className="h-5 w-5" />} label="Coste inventario" value={money(stats.inventoryCost)} />
        <MetricCard icon={<Euro className="h-5 w-5" />} label="Venta potencial" value={money(stats.inventoryRetail)} />
        <MetricCard icon={<TrendingUp className="h-5 w-5" />} label="Margen medio" value={`${stats.averageMargin.toFixed(1)}%`} />
        <MetricCard icon={<AlertTriangle className="h-5 w-5" />} label="Stock bajo" value={`${stats.lowStock} referencias`} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.9fr)]">
        <div className="rounded-3xl border border-border/50 bg-card p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Tabla de costes</h2>
              <p className="text-sm text-muted-foreground">Compra, venta, margen, stock y proveedor por referencia.</p>
            </div>
            <button onClick={() => saveFlowers()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:bg-primary/90">
              <Save className="h-4 w-4" /> Guardar tabla
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border/50">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">Flor</th>
                  <th className="p-3 text-left">Categoría</th>
                  <th className="p-3 text-left">Compra</th>
                  <th className="p-3 text-left">Venta</th>
                  <th className="p-3 text-left">Margen</th>
                  <th className="p-3 text-left">Stock</th>
                  <th className="p-3 text-left">Unidad</th>
                  <th className="p-3 text-left">Proveedor</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {flowers.map((flower) => {
                  const margin = flower.salePrice > 0 ? ((flower.salePrice - flower.purchasePrice) / flower.salePrice) * 100 : 0;
                  const isLowStock = flower.stock <= 10;

                  return (
                    <tr key={flower.id} className="border-t border-border/50">
                      <td className="p-3"><input value={flower.name} onChange={(event) => updateFlower(flower.id, "name", event.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/40" /></td>
                      <td className="p-3"><input value={flower.category} onChange={(event) => updateFlower(flower.id, "category", event.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/40" /></td>
                      <td className="p-3"><input type="number" step="0.01" value={flower.purchasePrice} onChange={(event) => updateFlower(flower.id, "purchasePrice", numberValue(event.target.value))} className="w-24 rounded-xl border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/40" /></td>
                      <td className="p-3"><input type="number" step="0.01" value={flower.salePrice} onChange={(event) => updateFlower(flower.id, "salePrice", numberValue(event.target.value))} className="w-24 rounded-xl border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/40" /></td>
                      <td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${margin >= 55 ? "bg-emerald-100 text-emerald-700" : margin >= 35 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{margin.toFixed(1)}%</span></td>
                      <td className="p-3"><input type="number" value={flower.stock} onChange={(event) => updateFlower(flower.id, "stock", numberValue(event.target.value))} className={`w-20 rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-primary/40 ${isLowStock ? "border-amber-300 bg-amber-50" : "border-border bg-background"}`} /></td>
                      <td className="p-3"><input value={flower.unit} onChange={(event) => updateFlower(flower.id, "unit", event.target.value)} className="w-24 rounded-xl border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/40" /></td>
                      <td className="p-3"><input value={flower.supplier} onChange={(event) => updateFlower(flower.id, "supplier", event.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/40" /></td>
                      <td className="p-3 text-right"><button onClick={() => removeFlower(flower.id)} className="rounded-xl p-2 text-destructive transition hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-3 rounded-2xl bg-muted/40 p-4 md:grid-cols-7">
            <input value={draftFlower.name} onChange={(event) => setDraftFlower({ ...draftFlower, name: event.target.value })} placeholder="Nueva flor" className="rounded-xl border border-border bg-background px-3 py-2 md:col-span-2" />
            <input value={draftFlower.category} onChange={(event) => setDraftFlower({ ...draftFlower, category: event.target.value })} placeholder="Categoría" className="rounded-xl border border-border bg-background px-3 py-2" />
            <input type="number" step="0.01" value={draftFlower.purchasePrice} onChange={(event) => setDraftFlower({ ...draftFlower, purchasePrice: numberValue(event.target.value) })} placeholder="Compra" className="rounded-xl border border-border bg-background px-3 py-2" />
            <input type="number" step="0.01" value={draftFlower.salePrice} onChange={(event) => setDraftFlower({ ...draftFlower, salePrice: numberValue(event.target.value) })} placeholder="Venta" className="rounded-xl border border-border bg-background px-3 py-2" />
            <input type="number" value={draftFlower.stock} onChange={(event) => setDraftFlower({ ...draftFlower, stock: numberValue(event.target.value) })} placeholder="Stock" className="rounded-xl border border-border bg-background px-3 py-2" />
            <button onClick={addFlower} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 font-medium text-primary-foreground transition hover:bg-primary/90"><Plus className="h-4 w-4" /> Añadir</button>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-border/50 bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Presupuesto de ramo</h2>
            </div>

            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-medium text-foreground">Ocasión</span>
              <input value={occasion} onChange={(event) => setOccasion(event.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/40" />
            </label>

            <div className="space-y-3">
              {bouquetLines.map((line, index) => (
                <div key={`${line.flowerId}-${index}`} className="grid grid-cols-[1fr_86px_38px] gap-2">
                  <select value={line.flowerId} onChange={(event) => setBouquetLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, flowerId: event.target.value } : item))} className="rounded-xl border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/40">
                    {flowers.map((flower) => <option key={flower.id} value={flower.id}>{flower.name}</option>)}
                  </select>
                  <input type="number" min="1" value={line.quantity} onChange={(event) => setBouquetLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: numberValue(event.target.value) } : item))} className="rounded-xl border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary/40" />
                  <button onClick={() => setBouquetLines((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-xl text-destructive transition hover:bg-destructive/10"><Trash2 className="mx-auto h-4 w-4" /></button>
                </div>
              ))}
            </div>

            <button onClick={addBouquetLine} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/50 py-2 font-medium text-primary transition hover:bg-primary/5">
              <Plus className="h-4 w-4" /> Añadir flor al ramo
            </button>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <NumericField label="Mano de obra" value={laborCost} onChange={setLaborCost} />
              <NumericField label="Envoltorio" value={packagingCost} onChange={setPackagingCost} />
              <NumericField label="Envío" value={deliveryCost} onChange={setDeliveryCost} />
              <NumericField label="Margen objetivo %" value={targetMargin} onChange={setTargetMargin} />
            </div>

            <div className="mt-6 space-y-2 rounded-2xl bg-muted/40 p-4 text-sm">
              <QuoteRow label="Coste flores" value={money(quote.flowerCost)} />
              <QuoteRow label="Costes extra" value={money(quote.serviceCost)} />
              <QuoteRow label="Coste real" value={money(quote.realCost)} />
              <QuoteRow label="Beneficio" value={money(quote.profit)} />
              <QuoteRow label="Margen final" value={`${quote.finalMargin.toFixed(1)}%`} />
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-lg font-bold">
                <span>PVP recomendado</span>
                <span>{money(quote.recommendedPrice)}</span>
              </div>
            </div>

            {quote.missingStock.length > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Falta stock de: {quote.missingStock.map((line) => line.flower.name).join(", ")}.
              </div>
            )}

            <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
              <div className="mb-1 flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4" /> Sugerencia IA</div>
              <p className="leading-relaxed">{aiSummary}</p>
            </div>

            <button onClick={confirmSale} className="mt-5 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground transition hover:bg-primary/90">
              Confirmar venta y descontar stock
            </button>
          </div>

          <div className="rounded-3xl border border-border/50 bg-gradient-to-br from-primary/10 to-secondary/10 p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-2 font-bold text-foreground">
              <Bot className="h-5 w-5 text-primary" /> Preparado para IA visual
            </div>
            <p className="text-sm text-muted-foreground">
              Este apartado ya deja preparado el resumen del ramo para conectarlo después con generación de imagen IA o búsqueda automática de fotos.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-3 text-muted-foreground">{icon}<span className="text-sm font-medium">{label}</span></div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function NumericField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      {label}
      <input type="number" step="0.01" value={value} onChange={(event) => onChange(numberValue(event.target.value))} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary/40" />
    </label>
  );
}

function QuoteRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
