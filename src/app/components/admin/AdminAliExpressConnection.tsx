import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Link2, RefreshCw, Search, ShieldCheck } from "lucide-react";

type AliStatus = {
  provider: string;
  appKeyConfigured: boolean;
  appSecretConfigured: boolean;
  encryptionReady: boolean;
  authorized: boolean;
  accessExpiresAt: string | null;
  refreshExpiresAt: string | null;
  trackedCount: number;
  catalogSyncEnabled: boolean;
  automaticPurchasesEnabled: boolean;
  message: string;
  tokenError?: string;
};
type AliProduct = {
  productId: string;
  name: string;
  images?: string[];
  variants?: Array<{ variantId: string; sku: string; price: number | null; currency: string; stock: number | null; properties?: Array<{ name: string; value: string }> }>;
  checkedAt: string;
  note?: string;
};
const ROOT = "/api/admin/integrations/aliexpress";

async function requestJson(path: string, init?: RequestInit) {
  const response = await fetch(ROOT + path, { credentials: "same-origin", cache: "no-store", ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(data.error || data.message || "AliExpress no responde"));
  return data;
}

export function AdminAliExpressConnection() {
  const [status, setStatus] = useState<AliStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [productId, setProductId] = useState("");
  const [product, setProduct] = useState<AliProduct | null>(null);
  const [tracked, setTracked] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await requestJson("/status");
      setStatus(data);
      setError("");
      if (data.authorized) {
        const collection = await requestJson("/tracked");
        setTracked(Array.isArray(collection.ids) ? collection.ids : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error consultando AliExpress");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const queryProduct = async () => {
    if (!/^\d{8,22}$/.test(productId.trim())) {
      setError("Escribe el identificador numérico del producto de AliExpress.");
      return;
    }
    setWorking(true); setError(""); setProduct(null);
    try {
      const result = await requestJson("/product?product_id=" + encodeURIComponent(productId.trim()));
      setProduct(result);
      setInfo("Producto consultado mediante API; no se ha publicado ni comprado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo consultar el producto");
    } finally { setWorking(false); }
  };

  const trackProduct = async () => {
    if (!product) return;
    setWorking(true); setError("");
    try {
      const next = Array.from(new Set([...tracked, product.productId]));
      const result = await requestJson("/tracked", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: next }),
      });
      setTracked(result.ids || next);
      setInfo("Producto añadido al seguimiento automático. Los precios públicos y los pedidos no cambian.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo añadir al seguimiento");
    } finally { setWorking(false); }
  };

  const revokeTracking = async (id: string) => {
    setWorking(true); setError("");
    try {
      const result = await requestJson("/tracked", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: tracked.filter((item) => item !== id) }),
      });
      setTracked(result.ids || []);
      setInfo("Producto retirado del seguimiento.");
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo actualizar el seguimiento"); }
    finally { setWorking(false); }
  };

  const marker = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("aliexpress");
  return <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4" aria-label="Conexión AliExpress Dropshipping">
    <div className="flex flex-wrap justify-between items-center gap-3">
      <div>
        <h3 className="font-bold text-lg">AliExpress · API de Dropshipping</h3>
        <p className="text-sm text-muted-foreground">Conexión OAuth, catálogo oficial y seguimiento automático de solo lectura.</p>
      </div>
      <button type="button" disabled={loading} onClick={() => void refresh()} className="rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-50 flex items-center gap-2">
        <RefreshCw className="h-4 w-4" />{loading ? "Comprobando..." : "Actualizar estado"}
      </button>
    </div>
    {marker && <p className="rounded-lg border border-border px-3 py-2 text-sm" role="status">
      Resultado de autorización: <strong>{marker === "connected" ? "Cuenta vinculada correctamente" : marker === "invalid_state" ? "No se validó la sesión. Inicia de nuevo la conexión desde el panel." : marker === "token_failed" ? "AliExpress no ha aceptado el intercambio del código; revisa los permisos y vuelve a intentarlo." : marker}</strong>
    </p>}
    {error && <p role="alert" className="flex items-center gap-2 rounded-lg border border-red-300 p-3 text-sm font-medium text-red-700"><AlertTriangle className="w-4 h-4" />{error}</p>}
    {info && <p role="status" className="rounded-lg border border-emerald-300 p-3 text-sm text-emerald-800">{info}</p>}
    {status && <div className="flex flex-wrap gap-3 text-sm">
      <span className="flex items-center gap-1"><ShieldCheck className="h-4 w-4" />Credenciales {status.appKeyConfigured && status.appSecretConfigured && status.encryptionReady ? "configuradas" : "incompletas"}</span>
      <span className="flex items-center gap-1">{status.authorized ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}{status.authorized ? "Cuenta autorizada" : "Falta autorizar cuenta"}</span>
      <span>Seguimiento: {status.trackedCount || 0} productos</span>
      <span>Actualización automática: {status.catalogSyncEnabled ? "habilitada" : "desactivada"}</span>
    </div>}
    {!status?.authorized && <div className="space-y-2">
      <a href={ROOT + "/authorize"} className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 font-bold text-white hover:bg-emerald-900">
        <Link2 className="h-4 w-4" /> Conectar mi cuenta de AliExpress
      </a>
      <p className="text-xs text-muted-foreground">Debes estar autenticado como administrador. Nunca pegues aquí el App Secret ni códigos OAuth.</p>
    </div>}
    {status?.authorized && <>
      <div className="space-y-2">
        <label htmlFor="ali-product-id" className="block text-sm font-semibold">Consultar producto por ID</label>
        <div className="flex flex-wrap items-center gap-2">
          <input id="ali-product-id" value={productId} onChange={(e) => setProductId(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="100500..." inputMode="numeric" maxLength={22} />
          <button type="button" disabled={working} onClick={() => void queryProduct()} className="inline-flex gap-2 items-center rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"><Search className="h-4 w-4" />Consultar</button>
        </div>
      </div>
      {product && <div className="rounded-lg border border-border bg-background p-3 space-y-2 text-sm">
        <p className="font-bold">{product.name || "Producto sin nombre verificado"}</p>
        <p>ID: {product.productId} · Variantes obtenidas: {product.variants?.length ?? 0} · Revisado: {new Date(product.checkedAt).toLocaleString("es-ES")}</p>
        {product.variants?.slice(0, 6).map((variant, index) => <p key={index}>SKU: {variant.sku || "sin dato"} · Precio: {variant.price == null ? "sin dato" : variant.price + " " + variant.currency} · Stock: {variant.stock == null ? "sin verificar" : variant.stock}</p>)}
        <p className="text-xs text-muted-foreground">{product.note}</p>
        <button type="button" disabled={working || tracked.includes(product.productId)} onClick={() => void trackProduct()} className="rounded-lg border border-border px-3 py-2 font-semibold disabled:opacity-50">
          {tracked.includes(product.productId) ? "Producto en seguimiento" : "Seguir automáticamente"}
        </button>
      </div>}
      {tracked.length > 0 && <div className="space-y-2">
        <p className="font-semibold text-sm">Productos seguidos</p>
        <div className="flex flex-wrap gap-2">{tracked.map((id) => <button key={id} type="button" disabled={working} onClick={() => void revokeTracking(id)} className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-50" title="Dejar de seguir">{id} ×</button>)}</div>
      </div>}
    </>}
    <p className="text-xs font-medium text-amber-800">Seguridad: esta integración todavía no compra, paga, publica productos ni modifica existencias públicas. Primero se verifican variantes, gastos de envío, impuestos y márgenes.</p>
  </section>;
}
