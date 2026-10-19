import { useEffect, useState } from "react";
import { RefreshCw, Link2, ShieldCheck } from "lucide-react";

const root = "/api/admin/integrations/aliexpress";
type Status = {
  appKeyConfigured: boolean;
  appSecretConfigured: boolean;
  encryptionReady: boolean;
  authorized: boolean;
  tokenError: string;
  accessExpiresAt: string | null;
  refreshExpiresAt: string | null;
  trackedCount: number;
  catalogSyncEnabled: boolean;
  automaticPurchasesEnabled: boolean;
  unpaidOrderCreationImplemented?:boolean;
  unpaidOrderCreationEnabled?:boolean;
  supplierPaymentImplemented?:boolean;
  message: string;
};
type AutomationHealth={unpaidOrderCreationEnabled:boolean;automaticUnpaidCreationEnabled:boolean;
  orderApiVerified:boolean;addressTransferApproved:boolean;supplierPaymentImplemented:boolean;eligibleQueueCandidates:number;note:string};
type FreightOption={service:string;shippingCostEur:number;estimatedDelivery:string};
type Product = { productId: string; name: string; status: string; variants: Array<{variantId:string; sku:string; price:number|null; currency:string; stock:number|null; available:boolean; properties:Array<{name:string;value:string}>}>; checkedAt:string; note:string };

async function request(path: string, options?: RequestInit) {
  const response = await fetch(root + path, { credentials: "include", cache: "no-store", ...options });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(json.error || json.message || "Error de comunicación con AliExpress"));
  return json;
}

export function AdminAliExpressPanel() {
  const [status, setStatus] = useState<Status|null>(null);
  const [health,setHealth]=useState<AutomationHealth|null>(null);
  const [freight,setFreight]=useState<FreightOption[]>([]);
  const [freightError,setFreightError]=useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [productId, setProductId] = useState("");
  const [product, setProduct] = useState<Product|null>(null);
  const [trackedIds, setTrackedIds] = useState<string[]>([]);
  const refresh = async () => {
    try {
      const [current, tracked, automation] = await Promise.all([request("/status"), request("/tracked"),request("/automation-health")]);
      setStatus(current as Status);
      setHealth(automation as AutomationHealth);
      setTrackedIds(Array.isArray(tracked.ids) ? tracked.ids : []);
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo verificar AliExpress"); }
  };
  useEffect(() => { void refresh(); }, []);
  const searchProduct = async () => {
    if (!/^\d{8,22}$/.test(productId.trim())) { setError("Introduce el ID numérico del producto AliExpress"); return; }
    setBusy(true); setError(""); setProduct(null);
    try { setProduct(await request("/product?product_id=" + encodeURIComponent(productId.trim())) as Product); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo consultar el producto"); }
    finally { setBusy(false); }
  };
  const quote = async (variant: Product["variants"][number])=>{
    if(!product)return;
    setFreight([]);setFreightError("");setBusy(true);
    try{
      const args="?productId="+encodeURIComponent(product.productId)+"&skuId="+encodeURIComponent(variant.sku||variant.variantId);
      const result=await request("/freight"+args);
      setFreight(Array.isArray(result.options)?result.options:[]);
      if(!result.options?.length)setFreightError("AliExpress no confirmó un transporte en EUR para esta variante y España.");
    }catch(err){setFreightError(err instanceof Error?err.message:"No fue posible cotizar AliExpress");}
    finally{setBusy(false);}
  };
  const addTracked = async () => {
    if (!product || trackedIds.includes(product.productId)) return;
    setBusy(true);
    try {
      await request("/tracked", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: [...trackedIds, product.productId] }),
      });
      await refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar el seguimiento"); }
    finally { setBusy(false); }
  };
  const refreshToken = async () => {
    setBusy(true);
    try { await request("/refresh", { method: "POST" }); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Error al renovar la autorización"); }
    finally { setBusy(false); }
  };

  return <section className="rounded-xl border border-border bg-card p-4 space-y-3" aria-label="Integración AliExpress">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="text-base font-bold">AliExpress · Dropshipping</h3>
        <p className="text-xs text-muted-foreground">Conexión oficial en producción. Consultas reales; ninguna compra o pago automático.</p>
      </div>
      <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCw size={15}/> Verificar</button>
    </div>
    <p className={"text-sm font-medium " + (status?.authorized ? "text-emerald-700" : "text-amber-700")}>
      {status ? (status.authorized ? "Cuenta autorizada" : "Pendiente de autorización OAuth") : "Consultando conexión…"}
      {status && " · Catálogo seguido: " + status.trackedCount + " artículos"}
    </p>
    {status && (!status.appKeyConfigured || !status.appSecretConfigured || !status.encryptionReady) &&
      <p className="text-sm text-amber-800">Comprueba las credenciales y la clave de cifrado del backend Railway.</p>}
    {health && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950 space-y-1">
      <p className="font-bold">Estado del motor de pedidos AliExpress</p>
      <p>Creación sin pagar: {health.unpaidOrderCreationEnabled?"Habilitada":"Desactivada"}. Motor programado: {health.automaticUnpaidCreationEnabled?"Habilitado":"Desactivado"}.</p>
      <p>Permiso API de compras: {health.orderApiVerified?"Confirmado por configuración":"Sin verificar"} · Transferencia de dirección: {health.addressTransferApproved?"Aprobada":"No aprobada"}.</p>
      <p>Pago automático al proveedor: NO implementado. Pedidos candidatos: {health.eligibleQueueCandidates}.</p>
      <p className="text-xs">{health.note}</p>
    </div>}
    {status?.tokenError && <p className="text-sm text-amber-800">{status.tokenError}</p>}
    {status?.authorized && <p className="text-xs text-muted-foreground">Acceso hasta {status.accessExpiresAt ? new Date(status.accessExpiresAt).toLocaleString("es-ES") : "sin confirmar"}. Renovación automática con el token vigente.</p>}
    <div className="flex flex-wrap gap-2">
      <a href={root + "/authorize"} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"><Link2 size={16}/> {status?.authorized ? "Volver a autorizar" : "Conectar mi cuenta AliExpress"}</a>
      {status?.authorized && <button type="button" disabled={busy} onClick={() => void refreshToken()} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Renovar token</button>}
    </div>
    {status?.authorized && <div className="space-y-2 rounded-lg border p-3">
      <label htmlFor="aliexpress-product-id" className="text-sm font-medium">Consultar un producto real por ID</label>
      <div className="flex flex-wrap gap-2">
        <input id="aliexpress-product-id" inputMode="numeric" value={productId} onChange={(event) => setProductId(event.target.value)} placeholder="ID de producto AliExpress" className="min-w-[170px] flex-1 rounded-lg border bg-background px-3 py-2 text-sm"/>
        <button type="button" disabled={busy} onClick={() => void searchProduct()} className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">Consultar</button>
      </div>
      {product && <div className="space-y-2 text-xs">
        <p className="font-semibold">{product.name} · {product.status}</p>
        <p>Variantes reales: {product.variants.length}</p>
        <div className="max-h-56 space-y-1 overflow-auto">
          {product.variants.slice(0, 30).map((variant, index) => <div key={variant.variantId + "-" + index} className="rounded border px-2 py-1">
            SKU: {variant.sku || "No reportado"} · {variant.properties.map((p) => p.name + ": " + p.value).join(", ") || variant.variantId}
            {" · "}{variant.price ?? "Precio sin confirmar"} {variant.currency} · {variant.stock == null ? "Stock desconocido" : variant.stock + " uds."}
            <button type="button" disabled={busy||!(variant.sku||variant.variantId)}
              onClick={()=>void quote(variant)} className="mt-1 rounded border px-2 py-1 text-xs disabled:opacity-50">
              Cotizar envío a España
            </button>
          </div>)}
        </div>
        {freight.length>0&&<p className="rounded border p-2">Envíos verificados: {freight.map(x=>x.service+" · "+x.shippingCostEur.toFixed(2)+" €").join(" | ")}</p>}
        {freightError&&<p role="alert" className="text-amber-800">{freightError}</p>}
        <button type="button" disabled={busy || trackedIds.includes(product.productId)} onClick={() => void addTracked()} className="rounded-lg border px-3 py-2 font-bold disabled:opacity-50">
          {trackedIds.includes(product.productId) ? "En seguimiento" : "Añadir a seguimiento automático"}
        </button>
        <p className="text-amber-800">{product.note}</p>
      </div>}
    </div>}
    {status?.authorized && !status.catalogSyncEnabled && <p className="text-xs text-amber-800">El seguimiento programado requiere ALIEXPRESS_CATALOG_SYNC_ENABLED=true en Railway.</p>}
    {error && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">{error}</p>}
    <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={16}/> El conector puede crear órdenes sin pagar solo cuando se autorice y verifique cada requisito. No puede pagar al proveedor automáticamente.</p>
  </section>;
}
