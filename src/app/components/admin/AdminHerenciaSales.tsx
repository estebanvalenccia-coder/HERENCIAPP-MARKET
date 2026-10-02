import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  Boxes,
  Flower2,
  Gauge,
  ImageIcon,
  MessageCircle,
  PackageCheck,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  TestTube2,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

type SalesHealth = {
  ok: boolean;
  chat?: { configured?: boolean; model?: string };
  vision?: { configured?: boolean; textModel?: string; imageModel?: string };
  media?: { r2Configured?: boolean };
  limits?: { chatPerMinute?: number; imagePerMinute?: number; timeoutMs?: number };
  catalog?: { total?: number; active?: number; sellable?: number; outOfStock?: number };
  flowers?: { total?: number; active?: number };
};

type Analytics = {
  totals?: Record<string, number>;
  salesEvents?: Array<{ label: string; value: number; amount?: number }>;
};

const emptyHealth: SalesHealth = {
  ok: false,
  chat: {},
  vision: {},
  media: {},
  limits: {},
  catalog: {},
  flowers: {},
};

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string | number; detail: string; icon: any }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-black">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black ${ok ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-rose-500"}`} />
      {label}
    </span>
  );
}

export function AdminHerenciaSales({ onNavigate }: { onNavigate: (section: string) => void }) {
  const [health, setHealth] = useState<SalesHealth>(emptyHealth);
  const [analytics, setAnalytics] = useState<Analytics>({});
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [healthResponse, analyticsResponse] = await Promise.all([
        fetch("/api/admin/sales/health", { credentials: "include", headers: { Accept: "application/json" } }),
        fetch("/api/admin/analytics?days=30", { credentials: "include", headers: { Accept: "application/json" } }),
      ]);
      const healthJson = await healthResponse.json();
      const analyticsJson = await analyticsResponse.json();
      if (!healthResponse.ok) throw new Error(healthJson?.error || "No se pudo comprobar HERENCIA SALES");
      if (!analyticsResponse.ok) throw new Error(analyticsJson?.error || "No se pudo cargar el embudo");
      setHealth({ ...emptyHealth, ...healthJson });
      setAnalytics(analyticsJson || {});
    } catch (error: any) {
      toast.error(error?.message || "No se pudo cargar HERENCIA SALES");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = analytics.totals || {};
  const eventMap = useMemo(
    () => new Map((analytics.salesEvents || []).map((row) => [row.label, row])),
    [analytics.salesEvents]
  );
  const opens = Number(totals.sales_opens || eventMap.get("sales_open")?.value || 0);
  const purchases = Number(totals.sales_purchases || eventMap.get("sales_purchase")?.value || 0);
  const conversion = opens > 0 ? (purchases / opens) * 100 : 0;
  const revenue = Number(totals.sales_revenue || eventMap.get("sales_purchase")?.amount || 0);

  const runTest = async () => {
    setTesting(true);
    setTestResult("");
    try {
      const commerce = await backendApi.listCommerceProducts();
      const catalog = (Array.isArray(commerce.products) ? commerce.products : [])
        .filter((product: any) => product?.active !== false && !product?.deletedAt)
        .slice(0, 50)
        .map((product: any) => ({
          id: String(product.id),
          name: product.name,
          category: product.category,
          type: product.type,
          collections: product.collections,
          price: product.price,
          salePrice: product.salePrice,
          onSale: product.onSale,
          stock: product.stock,
          trackInventory: product.trackInventory,
          active: product.active,
          status: product.status,
          description: product.description,
          image: product.image,
          variants: product.variants,
        }));

      const response = await fetch("/api/ai/sales-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Prueba interna: recomienda un producto disponible del catálogo para comprar. Sé breve.",
          history: [],
          catalog,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "La prueba no respondió");
      setTestResult(`${data.reply || "Respuesta recibida"}${Array.isArray(data.productIds) && data.productIds.length ? ` · IDs: ${data.productIds.join(", ")}` : ""}`);
      toast.success("HERENCIA SALES respondió correctamente");
    } catch (error: any) {
      setTestResult(error?.message || "La prueba falló");
      toast.error(error?.message || "La prueba de HERENCIA SALES falló");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-gradient-to-r from-[#173d2a] via-[#244b36] to-[#315b42] p-6 text-white shadow-lg">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-white/65">
              <Sparkles className="h-4 w-4" /> Centro comercial IA
            </div>
            <h1 className="mt-2 text-3xl font-black">HERENCIA SALES</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/75">
              Estado real del vendedor digital: catálogo Commerce/Neon, stock, variantes, Groq, Gemini, imágenes, ramos y embudo de conversión.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill ok={Boolean(health.chat?.configured)} label="Groq" />
            <StatusPill ok={Boolean(health.vision?.configured)} label="Gemini" />
            <StatusPill ok={Boolean(health.media?.r2Configured)} label="R2" />
            <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/20 disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Productos vendibles" value={health.catalog?.sellable || 0} detail={`${health.catalog?.outOfStock || 0} agotados`} icon={PackageCheck} />
        <Metric label="Flores activas" value={health.flowers?.active || 0} detail="Catálogo del creador" icon={Flower2} />
        <Metric label="Compras atribuidas" value={purchases} detail={`Conversión ${conversion.toFixed(1)}%`} icon={ShoppingCart} />
        <Metric label="Ingresos atribuidos" value={`${revenue.toFixed(2)} €`} detail="Últimos 30 días" icon={TrendingUp} />
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-black">Embudo de HERENCIA SALES · 30 días</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Aperturas", totals.sales_opens || 0],
              ["Mensajes", totals.sales_messages || 0],
              ["Recomendaciones", totals.sales_recommendations || 0],
              ["Búsquedas por foto", totals.sales_photo_searches || 0],
              ["Ramos generados", totals.sales_bouquets || 0],
              ["Añadidos al carrito", totals.sales_add_to_cart || 0],
              ["Comprar ahora", totals.sales_buy_now || 0],
              ["Visualizaciones espacio", totals.space_previews || 0],
              ["Traspasos a floristería", totals.sales_handoffs || 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl bg-muted/45 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-black">{Number(value || 0)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-black">Motor y límites</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-muted/40 p-3"><b>Chat:</b> {health.chat?.model || "—"}</div>
            <div className="rounded-xl bg-muted/40 p-3"><b>Visión:</b> {health.vision?.textModel || "—"}</div>
            <div className="rounded-xl bg-muted/40 p-3"><b>Imagen:</b> {health.vision?.imageModel || "—"}</div>
            <div className="rounded-xl bg-muted/40 p-3"><b>Límite chat:</b> {health.limits?.chatPerMinute || 0}/min por visitante</div>
            <div className="rounded-xl bg-muted/40 p-3"><b>Límite IA visual:</b> {health.limits?.imagePerMinute || 0}/min por visitante</div>
            <div className="rounded-xl bg-muted/40 p-3"><b>Timeout:</b> {Math.round(Number(health.limits?.timeoutMs || 0) / 1000)} s</div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <TestTube2 className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-black">Prueba comercial real</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Ejecuta una consulta contra el mismo endpoint y el mismo catálogo Commerce que usa el cliente.
            </p>
          </div>
          <button onClick={() => void runTest()} disabled={testing || !health.chat?.configured} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-primary-foreground disabled:opacity-50">
            {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            {testing ? "Probando..." : "Probar HERENCIA SALES"}
          </button>
        </div>
        {testResult ? <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-4 text-sm">{testResult}</div> : null}
      </section>

      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-black">Gestión rápida</h2>
        <p className="mt-1 text-sm text-muted-foreground">Cada botón abre la fuente real que utiliza HERENCIA SALES.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button onClick={() => onNavigate("products")} className="flex items-center gap-3 rounded-2xl border border-border p-4 text-left hover:bg-muted/50"><Boxes className="h-5 w-5 text-primary" /><span><b>Productos</b><br/><span className="text-xs text-muted-foreground">Precio, stock y variantes</span></span></button>
          <button onClick={() => onNavigate("bouquet-catalog")} className="flex items-center gap-3 rounded-2xl border border-border p-4 text-left hover:bg-muted/50"><Flower2 className="h-5 w-5 text-primary" /><span><b>Flores del creador</b><br/><span className="text-xs text-muted-foreground">Flores y verdes permitidos</span></span></button>
          <button onClick={() => onNavigate("content")} className="flex items-center gap-3 rounded-2xl border border-border p-4 text-left hover:bg-muted/50"><MessageCircle className="h-5 w-5 text-primary" /><span><b>Textos y acciones</b><br/><span className="text-xs text-muted-foreground">Prompt y botones del chat</span></span></button>
          <button onClick={() => onNavigate("analytics")} className="flex items-center gap-3 rounded-2xl border border-border p-4 text-left hover:bg-muted/50"><ImageIcon className="h-5 w-5 text-primary" /><span><b>Analítica completa</b><br/><span className="text-xs text-muted-foreground">Visitas y procedencia</span></span></button>
        </div>
      </section>
    </div>
  );
}
