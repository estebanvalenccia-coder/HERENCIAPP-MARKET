import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Calculator,
  Euro,
  Flower2,
  Lock,
  LogOut,
  Package,
  Plus,
  Save,
  Sparkles,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { backendApi, backendStorage } from "../lib/backendStorage";

type FlowerItem = {
  id: string;
  name: string;
  type: string;
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

const STORAGE_KEY = "floristAdminInventory";
const QUOTE_KEY = "floristLatestQuote";

const defaultFlowers: FlowerItem[] = [
  {
    id: "rosa-roja",
    name: "Rosa roja",
    type: "Flor principal",
    purchasePrice: 1.2,
    salePrice: 3.5,
    stock: 80,
    unit: "unidad",
    supplier: "Proveedor local",
  },
  {
    id: "tulipan-blanco",
    name: "Tulipán blanco",
    type: "Flor principal",
    purchasePrice: 1.4,
    salePrice: 3.8,
    stock: 45,
    unit: "unidad",
    supplier: "Holland Flowers",
  },
  {
    id: "eucalipto",
    name: "Eucalipto",
    type: "Verde decorativo",
    purchasePrice: 0.7,
    salePrice: 2.2,
    stock: 120,
    unit: "tallo",
    supplier: "Verdes Premium",
  },
  {
    id: "paniculata",
    name: "Paniculata",
    type: "Relleno",
    purchasePrice: 0.5,
    salePrice: 1.8,
    stock: 95,
    unit: "tallo",
    supplier: "Floralia",
  },
];

const emptyFlower: FlowerItem = {
  id: "",
  name: "",
  type: "Flor principal",
  purchasePrice: 0,
  salePrice: 0,
  stock: 0,
  unit: "unidad",
  supplier: "",
};

const money = (value: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number.isFinite(value) ? value : 0);

const numberValue = (value: string) => Number(value.replace(",", ".")) || 0;

export function Admin() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [flowers, setFlowers] = useState<FlowerItem[]>(defaultFlowers);
  const [draftFlower, setDraftFlower] = useState<FlowerItem>(emptyFlower);
  const [bouquetLines, setBouquetLines] = useState<BouquetLine[]>([{ flowerId: "rosa-roja", quantity: 6 }]);
  const [laborCost, setLaborCost] = useState(8);
  const [packagingCost, setPackagingCost] = useState(4);
  const [extraMargin, setExtraMargin] = useState(25);
  const [chatboxUrl, setChatboxUrl] = useState("");
  const [chatboxEnabled, setChatboxEnabled] = useState(false);
  const [herenciaUrl, setHerenciaUrl] = useState("");
  const [herenciaEnabled, setHerenciaEnabled] = useState(false);

  useEffect(() => {
    backendApi.adminSession()
      .then(({ authenticated }) => setIsAuthenticated(authenticated))
      .catch(() => setIsAuthenticated(false));

    const savedInventory = backendStorage.getItem(STORAGE_KEY);
    if (savedInventory) {
      try {
        const parsed = JSON.parse(savedInventory);
        if (Array.isArray(parsed) && parsed.length) setFlowers(parsed);
      } catch {
        setFlowers(defaultFlowers);
      }
    }

    const savedChatbox = backendStorage.getItem("chatboxSettings");
    if (savedChatbox) {
      const settings = JSON.parse(savedChatbox);
      setChatboxUrl(settings.url || "");
      setChatboxEnabled(Boolean(settings.enabled));
    }

    const savedHerencia = backendStorage.getItem("herenciaSettings");
    if (savedHerencia) {
      const settings = JSON.parse(savedHerencia);
      setHerenciaUrl(settings.url || "");
      setHerenciaEnabled(Boolean(settings.enabled));
    }
  }, []);

  const quote = useMemo(() => {
    const lines = bouquetLines
      .map((line) => {
        const flower = flowers.find((item) => item.id === line.flowerId);
        if (!flower) return null;
        return {
          ...line,
          flower,
          cost: flower.purchasePrice * line.quantity,
          sale: flower.salePrice * line.quantity,
          hasStock: flower.stock >= line.quantity,
        };
      })
      .filter(Boolean) as Array<BouquetLine & { flower: FlowerItem; cost: number; sale: number; hasStock: boolean }>;

    const flowerCost = lines.reduce((sum, line) => sum + line.cost, 0);
    const baseSale = lines.reduce((sum, line) => sum + line.sale, 0);
    const operationalCost = laborCost + packagingCost;
    const subtotal = baseSale + operationalCost;
    const suggestedPrice = subtotal * (1 + extraMargin / 100);
    const totalCost = flowerCost + operationalCost;
    const profit = suggestedPrice - totalCost;
    const margin = suggestedPrice > 0 ? (profit / suggestedPrice) * 100 : 0;

    return { lines, flowerCost, baseSale, operationalCost, subtotal, suggestedPrice, totalCost, profit, margin };
  }, [bouquetLines, extraMargin, flowers, laborCost, packagingCost]);

  const stats = useMemo(() => {
    const inventoryValue = flowers.reduce((sum, item) => sum + item.purchasePrice * item.stock, 0);
    const potentialRevenue = flowers.reduce((sum, item) => sum + item.salePrice * item.stock, 0);
    const lowStock = flowers.filter((item) => item.stock <= 10).length;
    const averageMargin = flowers.length
      ? flowers.reduce((sum, item) => sum + ((item.salePrice - item.purchasePrice) / Math.max(item.salePrice, 1)) * 100, 0) / flowers.length
      : 0;
    return { inventoryValue, potentialRevenue, lowStock, averageMargin };
  }, [flowers]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await backendApi.adminLogin(username, password);
      await backendStorage.refresh();
      setIsAuthenticated(true);
      toast.success("Bienvenido al panel administrativo");
    } catch {
      toast.error("Usuario o contraseña incorrectos");
    }
  };

  const handleLogout = async () => {
    await backendApi.adminLogout().catch(() => null);
    setIsAuthenticated(false);
    setUsername("");
    setPassword("");
    toast.success("Sesión cerrada");
    navigate("/");
  };

  const saveInventory = (nextFlowers = flowers) => {
    backendStorage.setItem(STORAGE_KEY, JSON.stringify(nextFlowers));
    toast.success("Inventario guardado");
  };

  const saveIaSettings = () => {
    backendStorage.setItem("chatboxSettings", JSON.stringify({ url: chatboxUrl, enabled: chatboxEnabled }));
    backendStorage.setItem("herenciaSettings", JSON.stringify({ url: herenciaUrl, enabled: herenciaEnabled }));
    window.dispatchEvent(new Event("storage"));
    toast.success("Configuración de IA guardada");
  };

  const addFlower = () => {
    if (!draftFlower.name.trim()) {
      toast.error("Escribe el nombre de la flor");
      return;
    }

    const id = `${draftFlower.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const nextFlowers = [...flowers, { ...draftFlower, id }];
    setFlowers(nextFlowers);
    setDraftFlower(emptyFlower);
    saveInventory(nextFlowers);
  };

  const updateFlower = (id: string, key: keyof FlowerItem, value: string | number) => {
    setFlowers((current) => current.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  };

  const removeFlower = (id: string) => {
    const nextFlowers = flowers.filter((item) => item.id !== id);
    setFlowers(nextFlowers);
    setBouquetLines((current) => current.filter((line) => line.flowerId !== id));
    saveInventory(nextFlowers);
  };

  const addBouquetLine = () => {
    if (!flowers.length) return;
    setBouquetLines((current) => [...current, { flowerId: flowers[0].id, quantity: 1 }]);
  };

  const confirmQuote = () => {
    const hasMissingStock = quote.lines.some((line) => !line.hasStock);
    if (hasMissingStock) {
      toast.error("Hay flores sin stock suficiente");
      return;
    }

    const nextFlowers = flowers.map((flower) => {
      const used = quote.lines.find((line) => line.flowerId === flower.id);
      return used ? { ...flower, stock: flower.stock - used.quantity } : flower;
    });

    backendStorage.setItem(QUOTE_KEY, JSON.stringify({ createdAt: new Date().toISOString(), quote }));
    setFlowers(nextFlowers);
    saveInventory(nextFlowers);
    toast.success("Ramo vendido y stock actualizado");
  };

  const aiSuggestion = useMemo(() => {
    const main = quote.lines[0]?.flower.name || "flores de temporada";
    const complement = quote.lines[1]?.flower.name || "verde decorativo";
    return `Ramo elegante con ${main} y ${complement}, pensado para verse premium manteniendo un margen aproximado del ${quote.margin.toFixed(1)}%. Ideal para mostrar al cliente con una imagen IA realista en tonos suaves.`;
  }, [quote.lines, quote.margin]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-background to-emerald-50 px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <div className="bg-card border border-border rounded-3xl p-8 shadow-lg">
            <div className="flex items-center justify-center mb-8">
              <div className="bg-primary p-4 rounded-2xl">
                <Lock className="w-10 h-10 text-primary-foreground" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-center mb-2">Acceso Administrativo</h2>
            <p className="text-muted-foreground text-center mb-8">Inventario, precios, margen y ramos</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usuario" required className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" required className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary" />
              <button type="submit" className="w-full py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium">Iniciar sesión</button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-gradient-to-r from-rose-50 via-background to-emerald-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-primary flex items-center gap-2"><Flower2 className="w-4 h-4" /> Floristería IA</p>
              <h1 className="text-3xl font-bold text-foreground">Zona administrativa</h1>
              <p className="text-muted-foreground">Controla precios, stock, márgenes y presupuestos de ramos.</p>
            </div>
            <button onClick={handleLogout} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors">
              <LogOut className="w-4 h-4" /> Cerrar sesión
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard icon={<Package className="w-5 h-5" />} label="Valor inventario" value={money(stats.inventoryValue)} />
          <StatCard icon={<Euro className="w-5 h-5" />} label="Venta potencial" value={money(stats.potentialRevenue)} />
          <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Margen promedio" value={`${stats.averageMargin.toFixed(1)}%`} />
          <StatCard icon={<Flower2 className="w-5 h-5" />} label="Stock bajo" value={`${stats.lowStock} productos`} />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 bg-card border border-border rounded-3xl p-6 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold">Inventario y precios</h2>
                <p className="text-muted-foreground">Edita compra, venta, stock y proveedor de cada flor.</p>
              </div>
              <button onClick={() => saveInventory()} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors">
                <Save className="w-4 h-4" /> Guardar cambios
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="text-left p-3 rounded-l-xl">Flor</th>
                    <th className="text-left p-3">Tipo</th>
                    <th className="text-left p-3">Compra</th>
                    <th className="text-left p-3">Venta</th>
                    <th className="text-left p-3">Margen</th>
                    <th className="text-left p-3">Stock</th>
                    <th className="text-left p-3">Unidad</th>
                    <th className="text-left p-3">Proveedor</th>
                    <th className="p-3 rounded-r-xl"></th>
                  </tr>
                </thead>
                <tbody>
                  {flowers.map((flower) => {
                    const margin = flower.salePrice > 0 ? ((flower.salePrice - flower.purchasePrice) / flower.salePrice) * 100 : 0;
                    return (
                      <tr key={flower.id} className="border-b border-border/70">
                        <td className="p-3"><input value={flower.name} onChange={(e) => updateFlower(flower.id, "name", e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2" /></td>
                        <td className="p-3"><input value={flower.type} onChange={(e) => updateFlower(flower.id, "type", e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2" /></td>
                        <td className="p-3"><input type="number" step="0.01" value={flower.purchasePrice} onChange={(e) => updateFlower(flower.id, "purchasePrice", numberValue(e.target.value))} className="w-24 bg-background border border-border rounded-lg px-3 py-2" /></td>
                        <td className="p-3"><input type="number" step="0.01" value={flower.salePrice} onChange={(e) => updateFlower(flower.id, "salePrice", numberValue(e.target.value))} className="w-24 bg-background border border-border rounded-lg px-3 py-2" /></td>
                        <td className="p-3"><span className={`px-3 py-1 rounded-full text-xs font-semibold ${margin >= 45 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{margin.toFixed(1)}%</span></td>
                        <td className="p-3"><input type="number" value={flower.stock} onChange={(e) => updateFlower(flower.id, "stock", numberValue(e.target.value))} className="w-20 bg-background border border-border rounded-lg px-3 py-2" /></td>
                        <td className="p-3"><input value={flower.unit} onChange={(e) => updateFlower(flower.id, "unit", e.target.value)} className="w-24 bg-background border border-border rounded-lg px-3 py-2" /></td>
                        <td className="p-3"><input value={flower.supplier} onChange={(e) => updateFlower(flower.id, "supplier", e.target.value)} className="w-full bg-background border border-border rounded-lg px-3 py-2" /></td>
                        <td className="p-3 text-right"><button onClick={() => removeFlower(flower.id)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"><Trash2 className="w-4 h-4" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-6 gap-3 bg-muted/40 rounded-2xl p-4">
              <input value={draftFlower.name} onChange={(e) => setDraftFlower({ ...draftFlower, name: e.target.value })} placeholder="Nueva flor" className="md:col-span-2 bg-background border border-border rounded-xl px-3 py-2" />
              <input value={draftFlower.type} onChange={(e) => setDraftFlower({ ...draftFlower, type: e.target.value })} placeholder="Tipo" className="bg-background border border-border rounded-xl px-3 py-2" />
              <input type="number" step="0.01" value={draftFlower.purchasePrice} onChange={(e) => setDraftFlower({ ...draftFlower, purchasePrice: numberValue(e.target.value) })} placeholder="Compra" className="bg-background border border-border rounded-xl px-3 py-2" />
              <input type="number" step="0.01" value={draftFlower.salePrice} onChange={(e) => setDraftFlower({ ...draftFlower, salePrice: numberValue(e.target.value) })} placeholder="Venta" className="bg-background border border-border rounded-xl px-3 py-2" />
              <button onClick={addFlower} className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl px-3 py-2 hover:bg-primary/90"><Plus className="w-4 h-4" /> Añadir</button>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4"><Calculator className="w-5 h-5 text-primary" /><h2 className="text-xl font-bold">Calculadora de ramo</h2></div>
              <div className="space-y-3">
                {bouquetLines.map((line, index) => (
                  <div key={`${line.flowerId}-${index}`} className="grid grid-cols-[1fr_84px_36px] gap-2">
                    <select value={line.flowerId} onChange={(e) => setBouquetLines((current) => current.map((item, i) => (i === index ? { ...item, flowerId: e.target.value } : item)))} className="bg-background border border-border rounded-xl px-3 py-2">
                      {flowers.map((flower) => <option key={flower.id} value={flower.id}>{flower.name}</option>)}
                    </select>
                    <input type="number" min="1" value={line.quantity} onChange={(e) => setBouquetLines((current) => current.map((item, i) => (i === index ? { ...item, quantity: numberValue(e.target.value) } : item)))} className="bg-background border border-border rounded-xl px-3 py-2" />
                    <button onClick={() => setBouquetLines((current) => current.filter((_, i) => i !== index))} className="text-destructive hover:bg-destructive/10 rounded-xl"><Trash2 className="w-4 h-4 mx-auto" /></button>
                  </div>
                ))}
                <button onClick={addBouquetLine} className="w-full inline-flex items-center justify-center gap-2 border border-dashed border-primary/50 text-primary rounded-xl py-2 hover:bg-primary/5"><Plus className="w-4 h-4" /> Añadir flor al ramo</button>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-5">
                <Field label="Mano obra" value={laborCost} onChange={setLaborCost} />
                <Field label="Envoltorio" value={packagingCost} onChange={setPackagingCost} />
                <Field label="Margen %" value={extraMargin} onChange={setExtraMargin} />
              </div>

              <div className="mt-6 space-y-2 text-sm">
                <QuoteRow label="Coste flores" value={money(quote.flowerCost)} />
                <QuoteRow label="Costes extra" value={money(quote.operationalCost)} />
                <QuoteRow label="Coste total" value={money(quote.totalCost)} />
                <QuoteRow label="Beneficio" value={money(quote.profit)} />
                <QuoteRow label="Margen final" value={`${quote.margin.toFixed(1)}%`} />
                <div className="pt-3 mt-3 border-t border-border flex items-center justify-between text-lg font-bold">
                  <span>Precio recomendado</span><span>{money(quote.suggestedPrice)}</span>
                </div>
              </div>

              <div className="mt-5 p-4 rounded-2xl bg-emerald-50 text-emerald-900">
                <div className="flex items-center gap-2 font-semibold mb-1"><Sparkles className="w-4 h-4" /> Sugerencia IA</div>
                <p className="text-sm leading-relaxed">{aiSuggestion}</p>
              </div>

              <button onClick={confirmQuote} className="mt-5 w-full bg-primary text-primary-foreground rounded-xl py-3 hover:bg-primary/90 font-semibold">Confirmar venta y descontar stock</button>
            </div>

            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4"><Bot className="w-5 h-5 text-primary" /><h2 className="text-xl font-bold">IA conectada</h2></div>
              <div className="space-y-3">
                <input value={chatboxUrl} onChange={(e) => setChatboxUrl(e.target.value)} placeholder="URL Chatbox IA" className="w-full bg-background border border-border rounded-xl px-3 py-2" />
                <label className="flex items-center justify-between bg-muted/50 rounded-xl px-3 py-2 text-sm"><span>Activar chatbox</span><input type="checkbox" checked={chatboxEnabled} onChange={(e) => setChatboxEnabled(e.target.checked)} /></label>
                <input value={herenciaUrl} onChange={(e) => setHerenciaUrl(e.target.value)} placeholder="URL Herenc(IA)" className="w-full bg-background border border-border rounded-xl px-3 py-2" />
                <label className="flex items-center justify-between bg-muted/50 rounded-xl px-3 py-2 text-sm"><span>Activar Herenc(IA)</span><input type="checkbox" checked={herenciaEnabled} onChange={(e) => setHerenciaEnabled(e.target.checked)} /></label>
                <button onClick={saveIaSettings} className="w-full inline-flex items-center justify-center gap-2 bg-muted rounded-xl py-2 hover:bg-accent"><Save className="w-4 h-4" /> Guardar IA</button>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-3 text-muted-foreground mb-3">{icon}<span className="text-sm font-medium">{label}</span></div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="text-xs text-muted-foreground">
      {label}
      <input type="number" step="0.01" value={value} onChange={(e) => onChange(numberValue(e.target.value))} className="mt-1 w-full bg-background border border-border rounded-xl px-2 py-2 text-foreground" />
    </label>
  );
}

function QuoteRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{value}</span></div>;
}
