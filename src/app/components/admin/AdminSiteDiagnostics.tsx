import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList } from "lucide-react";
import type { SiteContent } from "../../lib/siteContent";
import type { MarketExperienceContent } from "../../lib/marketExperience";
import { validateSitePublication } from "../../lib/sitePublicationValidation.mjs";

/** Static configuration diagnostics. This does not fetch URLs or attest live availability. */
export function AdminSiteDiagnostics({
  site,
  market,
}: {
  site: SiteContent;
  market: MarketExperienceContent;
}) {
  const { errors, warnings } = useMemo(() => {
    const errors = validateSitePublication(site);
    const warnings: string[] = [];
    const seenLinks = new Map<string, string>();
    for (const item of market.navigation.filter((link) => link.visible !== false)) {
      const href = String(item.href || "").trim();
      if (!href) warnings.push(`Menú «${item.label}»: no tiene enlace`);
      else if (seenLinks.has(href)) warnings.push(`Menú: «${item.label}» y «${seenLinks.get(href)}» comparten destino ${href}`);
      else seenLinks.set(href, item.label);
    }
    market.home.categories.forEach((item) => {
      if (item.visible === false) return;
      if (!String(item.title || "").trim()) warnings.push("Hay una tarjeta de categoría sin título");
      if (!String(item.imageUrl || "").trim()) warnings.push(`Categoría «${item.title}»: sin imagen`);
      if (!String(item.href || "").trim()) warnings.push(`Categoría «${item.title}»: sin enlace`);
    });
    market.home.services.forEach((item) => {
      if (item.visible === false) return;
      if (!String(item.href || "").trim()) warnings.push(`Servicio «${item.title}»: sin destino`);
    });
    for (const promo of [market.dulce, market.moda]) {
      if (promo.enabled !== false && !String(promo.imageUrl || "").trim()) warnings.push(`Banner «${promo.title}»: sin imagen`);
    }
    for (const [id, control] of Object.entries(market.componentControls || {})) {
      if (control.mobile === false && control.tablet === false && control.desktop === false && control.enabled !== false) {
        warnings.push(`«${id}» está activado pero oculto en todos los dispositivos`);
      }
    }
    return { errors, warnings };
  }, [market, site]);

  return (
    <section className="rounded-2xl border border-[#dce6dc] bg-white p-5" aria-label="Diagnóstico de configuración de tienda">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <ClipboardList className="h-5 w-5 text-[#315b42]" />
        <div className="flex-1">
          <h4 className="font-black">Diagnóstico antes de publicar</h4>
          <p className="text-xs text-muted-foreground">Verificación local de enlaces y configuración; no comprueba si las webs externas responden.</p>
        </div>
        {errors.length === 0 && warnings.length === 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"><CheckCircle2 className="h-3.5 w-3.5" /> Sin incidencias detectadas</span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800"><AlertTriangle className="h-3.5 w-3.5" /> {errors.length} error(es) · {warnings.length} aviso(s)</span>
        )}
      </div>
      {errors.length > 0 && <ul className="space-y-1 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
        {errors.map((value, index) => <li key={index}>Bloquea publicación: {value}</li>)}
      </ul>}
      {warnings.length > 0 && <ul className="mt-2 space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        {warnings.map((value, index) => <li key={index}>Revisar: {value}</li>)}
      </ul>}
    </section>
  );
}
