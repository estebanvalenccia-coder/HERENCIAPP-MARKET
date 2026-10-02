import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Eye,
  Globe2,
  MapPin,
  MonitorSmartphone,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type MetricRow = { label: string; value: number };
type DailyRow = { day: string; pageviews: number; visitors: number };

type AnalyticsSummary = {
  days: number;
  totals: {
    pageviews: number;
    visitors: number;
    visitors_today: number;
    space_previews: number;
  };
  daily: DailyRow[];
  pages: MetricRow[];
  locations: MetricRow[];
  sources: MetricRow[];
  devices: MetricRow[];
  browsers: MetricRow[];
  generatedAt?: string;
};

const emptySummary: AnalyticsSummary = {
  days: 30,
  totals: { pageviews: 0, visitors: 0, visitors_today: 0, space_previews: 0 },
  daily: [],
  pages: [],
  locations: [],
  sources: [],
  devices: [],
  browsers: [],
};

export function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<AnalyticsSummary>(emptySummary);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/analytics?days=${days}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(data?.error || "No se pudo cargar la analítica");
      setSummary({
        ...emptySummary,
        ...data,
        totals: { ...emptySummary.totals, ...(data.totals || {}) },
      });
    } catch (error: any) {
      toast.error(error?.message || "No se pudo cargar la analítica de visitas");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxDaily = useMemo(
    () => Math.max(1, ...summary.daily.map((row) => Number(row.pageviews || 0))),
    [summary.daily]
  );

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 bg-gradient-to-r from-[#173d2a] to-[#315b42] px-6 py-6 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/65">
              <BarChart3 className="h-4 w-4" />
              Analítica de Herencia Market
            </div>
            <h2 className="mt-2 text-2xl font-black">Visitas y procedencia</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/75">
              Visitantes, páginas vistas, ubicación aproximada, origen del tráfico y uso de “Ver en mi espacio”.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white outline-none"
            >
              <option value={7} className="text-slate-900">Últimos 7 días</option>
              <option value={30} className="text-slate-900">Últimos 30 días</option>
              <option value={90} className="text-slate-900">Últimos 90 días</option>
              <option value={365} className="text-slate-900">Último año</option>
            </select>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-[#173d2a] disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Users} label="Visitantes únicos" value={summary.totals.visitors} helper={`Últimos ${days} días`} />
          <MetricCard icon={Eye} label="Páginas vistas" value={summary.totals.pageviews} helper="Navegación total medida" />
          <MetricCard icon={Globe2} label="Visitantes hoy" value={summary.totals.visitors_today} helper="Usuarios únicos de hoy" />
          <MetricCard icon={Sparkles} label="Pruebas en el espacio" value={summary.totals.space_previews} helper="Visualizaciones IA generadas" />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-5">
            <h3 className="font-black text-foreground">Evolución diaria</h3>
            <p className="text-sm text-muted-foreground">Páginas vistas y visitantes únicos por día.</p>
          </div>
          {!summary.daily.length ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {summary.daily.map((row) => {
                const width = Math.max(3, Math.round((Number(row.pageviews || 0) / maxDaily) * 100));
                return (
                  <div key={row.day} className="grid grid-cols-[88px_1fr_auto] items-center gap-3 text-sm">
                    <span className="font-bold text-muted-foreground">{formatDay(row.day)}</span>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                    </div>
                    <span className="min-w-24 text-right font-black">
                      {row.pageviews} <span className="font-medium text-muted-foreground">/ {row.visitors}</span>
                    </span>
                  </div>
                );
              })}
              <p className="pt-2 text-xs text-muted-foreground">Formato: páginas vistas / visitantes únicos.</p>
            </div>
          )}
        </div>

        <RankList
          icon={MapPin}
          title="Desde dónde nos visitan"
          subtitle="Ciudad/región/país aproximados cuando el proveedor los facilita."
          rows={summary.locations}
          empty="Todavía no hay datos de ubicación."
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        <RankList icon={Eye} title="Páginas más vistas" subtitle="Qué partes de la tienda atraen más tráfico." rows={summary.pages} />
        <RankList icon={Globe2} title="Origen del tráfico" subtitle="Google, redes, enlaces o acceso directo." rows={summary.sources} />
        <RankList icon={MonitorSmartphone} title="Dispositivos" subtitle="Móvil, ordenador o tablet." rows={summary.devices} />
        <RankList icon={BarChart3} title="Navegadores" subtitle="Safari, Chrome, Edge y otros." rows={summary.browsers} />
      </section>

      <div className="rounded-2xl border border-border bg-muted/35 px-4 py-3 text-xs leading-5 text-muted-foreground">
        La analítica del escaparate se registra cuando el visitante acepta analítica/cookies. La ubicación es aproximada
        y depende de los encabezados disponibles; no se guarda la IP en este panel.
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: any;
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="text-3xl font-black tracking-tight">{Number(value || 0).toLocaleString("es-ES")}</p>
      <p className="mt-1 text-sm font-black">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function RankList({
  icon: Icon,
  title,
  subtitle,
  rows,
  empty = "Todavía no hay datos suficientes.",
}: {
  icon: any;
  title: string;
  subtitle: string;
  rows: MetricRow[];
  empty?: string;
}) {
  const max = Math.max(1, ...rows.map((row) => Number(row.value || 0)));
  return (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-black">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {!rows.length ? (
        <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-3">
          {rows.slice(0, 10).map((row, index) => (
            <div key={`${row.label}-${index}`}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate font-bold" title={row.label}>{row.label}</span>
                <span className="shrink-0 font-black">{Number(row.value || 0).toLocaleString("es-ES")}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(4, Math.round((Number(row.value || 0) / max) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl bg-muted/40 p-8 text-center text-sm text-muted-foreground">
      Aún no hay visitas registradas para este periodo.
    </div>
  );
}

function formatDay(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" }).format(date);
}
