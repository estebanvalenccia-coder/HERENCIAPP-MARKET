import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  ExternalLink,
  Link2,
  MousePointerClick,
  PackagePlus,
  Play,
  RefreshCw,
  Save,
  ShoppingBag,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

type SupplierMode = "manual" | "autopilot";

const money = (value: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value || 0));

function sourceHostFromProduct(product: any) {
  const metadata = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};
  if (metadata.sourceHost) return String(metadata.sourceHost).replace(/^www\./, "");
  try {
    return metadata.sourceProductUrl ? new URL(String(metadata.sourceProductUrl)).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

function fulfillmentBadge(status = "") {
  const normalized = String(status || "");
  if (["ordered", "shipped", "delivered"].includes(normalized)) return "✅ " + normalized;
  if (normalized === "autopilot_ready") return "🤖 listo";
  if (normalized === "manual_ready" || normalized === "manual_purchase_required") return "🖱️ manual";
  if (normalized === "connector_required") return "🔌 conector";
  if (normalized === "approval_required") return "🛡️ aprobación";
  if (normalized === "cost_required") return "💶 coste";
  if (normalized === "mapping_required") return "🔗 SKU/VID";
  if (normalized === "address_required") return "📍 dirección";
  if (normalized === "payment_required") return "💳 pago";
  if (normalized === "action_required") return "⚠️ revisar";
  return normalized || "pendiente";
}

export function AdminSuppliersPanel() {
  const [operations, setOperations] = useState<any>({ suppliers: [], purchases: [], supplierFulfillments: [] });
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [fulfillments, setFulfillments] = useState<any[]>([]);
  const [connectorReady, setConnectorReady] = useState(false);
  const [cjConfigured, setCjConfigured] = useState(false);
  const [cjLiveEnabled, setCjLiveEnabled] = useState(false);
  const [cjTesting, setCjTesting] = useState(false);
  const [cjBalance, setCjBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingProductId, setSavingProductId] = useState("");
  const [processingId, setProcessingId] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importingUrl, setImportingUrl] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const [form, setForm] = useState<any>({
    id: "",
    name: "",
    email: "",
    phone: "",
    category: "",
    sourceHost: "",
    fulfillmentMode: "manual" as SupplierMode,
    maxAutoOrderTotal: 80,
    minMarginPercent: 30,
    integrationType: "manual",
    cjSandbox: true,
    cjLogisticName: "CJPacket Ordinary",
    cjFromCountryCode: "CN",
    cjMaxPaymentUsd: 50,
    active: true,
  });
  const [purchase, setPurchase] = useState({ supplierId: "", reference: "", productId: "", quantity: 1, unitCost: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const [ops, catalog, onlineOrders, queue] = await Promise.all([
        backendApi.getPosOperations(),
        backendApi.listCommerceProducts({ includeArchived: true }),
        backendApi.listOrders(),
        backendApi.listSupplierFulfillments(),
      ]);
      setOperations(ops.operations || {});
      setProducts(Array.isArray(catalog.products) ? catalog.products : []);
      setOrders(Array.isArray(onlineOrders.orders) ? onlineOrders.orders : []);
      setFulfillments(Array.isArray(queue.fulfillments) ? queue.fulfillments : []);
      setConnectorReady(Boolean(queue.autopilotConnectorConfigured));
      setCjConfigured(Boolean(queue.cjConfigured));
      setCjLiveEnabled(Boolean(queue.cjLiveEnabled));
    } catch (error: any) {
      toast.error(error?.message || "No se pudo cargar Supplier Hub");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const suppliers = Array.isArray(operations.suppliers) ? operations.suppliers : [];
  const importedProducts = useMemo(
    () =>
      products.filter((product: any) => {
        const metadata = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};
        return Boolean(metadata.importedFromUrl || metadata.sourceProductUrl);
      }),
    [products]
  );

  const saveSupplier = async () => {
    if (!String(form.name || "").trim()) return toast.error("Escribe el nombre del proveedor");
    try {
      const result = await backendApi.savePosSupplier(form);
      setOperations(result.operations || operations);
      setForm({
        id: "",
        name: "",
        email: "",
        phone: "",
        category: "",
        sourceHost: "",
        fulfillmentMode: "manual",
        maxAutoOrderTotal: 80,
        minMarginPercent: 30,
        integrationType: "manual",
        cjSandbox: true,
        cjLogisticName: "CJPacket Ordinary",
        cjFromCountryCode: "CN",
        cjMaxPaymentUsd: 50,
        active: true,
      });
      toast.success("Proveedor guardado");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar el proveedor");
    }
  };

  const editSupplier = (supplier: any) => {
    setForm({
      id: supplier.id || "",
      name: supplier.name || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      category: supplier.category || "",
      sourceHost: supplier.sourceHost || "",
      fulfillmentMode: supplier.fulfillmentMode === "autopilot" ? "autopilot" : "manual",
      maxAutoOrderTotal: Number(supplier.maxAutoOrderTotal || 0),
      minMarginPercent: Number(supplier.minMarginPercent || 0),
      integrationType: ["cj","webhook","manual"].includes(String(supplier.integrationType || "")) ? supplier.integrationType : "manual",
      cjSandbox: supplier.cjSandbox !== false,
      cjLogisticName: supplier.cjLogisticName || "CJPacket Ordinary",
      cjFromCountryCode: supplier.cjFromCountryCode || "CN",
      cjMaxPaymentUsd: Number(supplier.cjMaxPaymentUsd || 0),
      active: supplier.active !== false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const createPurchase = async () => {
    if (!purchase.supplierId || !purchase.productId || purchase.quantity <= 0) {
      return toast.error("Selecciona proveedor, producto y cantidad");
    }
    try {
      const result = await backendApi.createPosPurchase({
        supplierId: purchase.supplierId,
        reference: purchase.reference,
        items: [{ id: purchase.productId, quantity: purchase.quantity, unitCost: purchase.unitCost }],
      });
      setOperations(result.operations || operations);
      setPurchase({ ...purchase, reference: "", productId: "", quantity: 1, unitCost: 0 });
      toast.success("Compra registrada y stock actualizado");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "No se pudo registrar la compra");
    }
  };

  const importProductByUrl = async () => {
    const url = String(importUrl || "").trim();
    if (!url) return toast.error("Pega la URL del producto");
    try {
      new URL(url);
    } catch {
      return toast.error("La URL no es válida");
    }

    setImportFeedback({ ok: true, message: "Consultando catálogo del proveedor…" });
    setImportingUrl(true);
    try {
      const preview = await backendApi.previewCatalogUrl(url, 1);
      const candidate = Array.isArray(preview.products) ? preview.products[0] : null;
      if (!candidate) {
        setImportFeedback({ ok: false, message: "El proveedor no devolvió un producto válido." });
        toast.error("No se pudo detectar el producto en esa URL");
        return;
      }

      setImportFeedback({ ok: true, message: "Producto encontrado: " + candidate.name + ". Guardando borrador…" });
      const result = await backendApi.importCatalogUrlProduct(candidate);
      const imported = result.product;
      if (!imported) {
        setImportFeedback({ ok: false, message: result.skipped ? "Este producto ya estaba importado." : "No se pudo guardar el borrador." });
        if (result.skipped) toast.info("Ese producto ya estaba importado");
        else toast.warning("La ficha fue analizada pero no se pudo crear el borrador");
        await load();
        return;
      }

      const sourceHost = String(candidate.sourceHost || "").replace(/^www\./, "");
      const matchedSupplier = suppliers.find((supplier: any) =>
        String(supplier?.sourceHost || "").replace(/^www\./, "").toLowerCase() === sourceHost.toLowerCase()
      );

      if (matchedSupplier) {
        const metadata = imported?.metadata && typeof imported.metadata === "object" ? imported.metadata : {};
        const sourceCurrency = String(candidate.supplierCurrency || metadata.supplierCurrency || "").toUpperCase();
        const detectedCost = (!sourceCurrency || sourceCurrency === "EUR")
          ? Number(metadata.supplierCost || candidate.supplierPrice || 0)
          : 0;
        await backendApi.updateCommerceProduct(imported.id, {
          metadata: {
            ...metadata,
            importedFromUrl: true,
            fulfillmentType: "dropship",
            supplierId: matchedSupplier.id,
            fulfillmentMode: matchedSupplier.fulfillmentMode === "autopilot" ? "autopilot" : "manual",
            supplierCost: detectedCost,
            supplierOriginalPrice: Number(candidate.supplierPrice || metadata.supplierOriginalPrice || 0),
            supplierCurrency: sourceCurrency,
            sourceHost: sourceHost || matchedSupplier.sourceHost || "",
            supplierAssignedAt: new Date().toISOString(),
          },
          trackInventory: false,
        });
      }

      setImportUrl("");
      setImportFeedback({ ok: true, message: "Borrador importado: " + candidate.name + ". Revisa precio y variantes antes de publicar." });
      toast.success(
        matchedSupplier
          ? "Producto importado y conectado automáticamente con " + matchedSupplier.name
          : "Producto importado como borrador. Ahora asígnale proveedor y coste."
      );
      await load();
    } catch (error: any) {
      setImportFeedback({ ok: false, message: String(error?.message || "No se pudo importar el producto desde esa URL") });
      toast.error(error?.message || "No se pudo importar el producto desde esa URL");
    } finally {
      setImportingUrl(false);
    }
  };

  const assignDropship = async (
    product: any,
    supplierId: string,
    mode: SupplierMode,
    supplierCost: number,
    supplierVariantId = "",
    supplierSku = ""
  ) => {
    if (!supplierId) return toast.error("Selecciona un proveedor");
    const supplier = suppliers.find((entry: any) => String(entry.id) === String(supplierId));
    if (!supplier) return toast.error("Proveedor no encontrado");

    setSavingProductId(String(product.id));
    try {
      const metadata = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};
      await backendApi.updateCommerceProduct(product.id, {
        metadata: {
          ...metadata,
          importedFromUrl: true,
          fulfillmentType: "dropship",
          supplierId: supplier.id,
          fulfillmentMode: mode,
          supplierCost: Math.max(0, Number(supplierCost || 0)),
          supplierVariantId: String(supplierVariantId || "").trim(),
          supplierSku: String(supplierSku || "").trim(),
          sourceHost: metadata.sourceHost || supplier.sourceHost || sourceHostFromProduct(product),
          supplierAssignedAt: new Date().toISOString(),
        },
        trackInventory: false,
      });
      toast.success(mode === "autopilot" ? "Producto conectado a Autopilot" : "Producto conectado en modo manual");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "No se pudo asignar el proveedor");
    } finally {
      setSavingProductId("");
    }
  };

  const syncPaidOrders = async () => {
    const candidates = orders.filter((order: any) =>
      ["paid", "confirmed", "preparing", "processing", "ready"].includes(String(order.status || ""))
    );
    if (!candidates.length) return toast.info("No hay pedidos pagados pendientes de preparar");

    let prepared = 0;
    let errors = 0;
    for (const order of candidates.slice(0, 100)) {
      try {
        const result = await backendApi.prepareSupplierFulfillments(String(order.id));
        prepared += Array.isArray(result.fulfillments) ? result.fulfillments.length : 0;
      } catch {
        errors += 1;
      }
    }
    await load();
    if (errors) toast.warning(`Cola actualizada: ${prepared} preparaciones y ${errors} pedidos con incidencia`);
    else toast.success(`Cola actualizada: ${prepared} preparaciones de proveedor`);
  };

  const executeFulfillment = async (fulfillment: any, force = false) => {
    setProcessingId(String(fulfillment.id));
    try {
      const result = await backendApi.executeSupplierFulfillment(String(fulfillment.id), force);
      const next = result.fulfillment;
      setFulfillments((current) => current.map((item) => String(item.id) === String(next.id) ? next : item));
      if (result.executed) toast.success("Pedido enviado al proveedor por Autopilot");
      else if (result.manual) toast.success("Compra manual preparada");
      else toast.warning(next.blocker || "El pedido necesita revisión");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo procesar el pedido del proveedor");
    } finally {
      setProcessingId("");
    }
  };

  const markOrdered = async (fulfillment: any) => {
    const externalOrderId = window.prompt("Número de pedido del proveedor (opcional)", fulfillment.externalOrderId || "") ?? "";
    try {
      const result = await backendApi.updateSupplierFulfillment(String(fulfillment.id), {
        status: "ordered",
        externalOrderId,
        blocker: "",
      });
      setFulfillments((current) => current.map((item) => String(item.id) === String(result.fulfillment.id) ? result.fulfillment : item));
      toast.success("Pedido de proveedor marcado como realizado");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo actualizar");
    }
  };

  const addTracking = async (fulfillment: any) => {
    const trackingNumber = window.prompt("Número de seguimiento", fulfillment.trackingNumber || "");
    if (trackingNumber == null) return;
    const trackingUrl = window.prompt("URL de seguimiento (opcional)", fulfillment.trackingUrl || "") ?? "";
    try {
      const result = await backendApi.updateSupplierFulfillment(String(fulfillment.id), {
        status: "shipped",
        trackingNumber,
        trackingUrl,
        blocker: "",
      });
      setFulfillments((current) => current.map((item) => String(item.id) === String(result.fulfillment.id) ? result.fulfillment : item));
      toast.success("Tracking guardado");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar el tracking");
    }
  };

  const testCjConnection = async () => {
    setCjTesting(true);
    try {
      const result = await backendApi.testCjSupplierConnection();
      setCjConfigured(Boolean(result.configured));
      setCjLiveEnabled(Boolean(result.liveEnabled));
      setCjBalance(result.balance || null);
      toast.success("CJ conectado correctamente");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo conectar con CJ");
    } finally {
      setCjTesting(false);
    }
  };

  const syncCjFulfillment = async (fulfillment: any) => {
    setProcessingId(String(fulfillment.id));
    try {
      const result = await backendApi.syncSupplierFulfillment(String(fulfillment.id));
      setFulfillments((current) => current.map((item) => String(item.id) === String(result.fulfillment.id) ? result.fulfillment : item));
      toast.success("Estado y tracking sincronizados con CJ");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo sincronizar CJ");
    } finally {
      setProcessingId("");
    }
  };

  const openCjDispute = async (fulfillment: any) => {
    const kind = window.prompt("Escribe 1 para REEMBOLSO o 2 para REENVÍO", "1");
    if (kind == null) return;
    const expectType = kind.trim() === "2" ? 2 : 1;
    const messageText = window.prompt(
      "Describe brevemente el motivo para CJ",
      expectType === 2 ? "El cliente solicita un reemplazo." : "El cliente solicita un reembolso."
    );
    if (messageText == null) return;
    setProcessingId(String(fulfillment.id));
    try {
      await backendApi.createSupplierDispute(String(fulfillment.id), {
        expectType: expectType as 1 | 2,
        messageText,
      });
      toast.success(expectType === 2 ? "Solicitud de reenvío abierta en CJ" : "Solicitud de reembolso abierta en CJ");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo abrir la devolución en CJ");
    } finally {
      setProcessingId("");
    }
  };

  const spent = useMemo(
    () => (operations.purchases || []).reduce((sum: number, item: any) => sum + Number(item.total || 0), 0),
    [operations]
  );

  const activeFulfillments = fulfillments.filter((item: any) => !["delivered", "cancelled"].includes(String(item.status || "")));
  const selectedProduct = products.find((product: any) => String(product.id) === String(purchase.productId));

  if (loading) {
    return <div className="rounded-3xl border border-border bg-card p-8 text-sm text-muted-foreground">Cargando Supplier Hub…</div>;
  }

  return <div className="space-y-6">
    <section className="rounded-3xl border border-border bg-card p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-primary">Supplier Hub</p>
          <h1 className="mt-2 text-3xl font-black">Proveedores · Manual + Autopilot</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Conecta productos importados por URL con su proveedor. Manual prepara todo para comprar tú;
            Autopilot ejecuta solo cuando existe un conector/API autorizado y respeta tus límites.
          </p>
        </div>
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${connectorReady ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          {connectorReady ? <><CheckCircle2 className="mr-2 inline h-4 w-4"/>Conector Autopilot listo</> : <><AlertTriangle className="mr-2 inline h-4 w-4"/>Autopilot preparado · falta conector</>}
        </div>
      </div>
    </section>

    <div className="grid gap-4 md:grid-cols-4">
      <Card icon={Building2} label="Proveedores" value={String(suppliers.length)} />
      <Card icon={Link2} label="Productos URL" value={String(importedProducts.length)} />
      <Card icon={Bot} label="Cola proveedor" value={String(activeFulfillments.length)} />
      <Card icon={PackagePlus} label="Compras acumuladas" value={money(spent)} />
    </div>

    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold uppercase tracking-wider text-primary">Importación rápida</p>
        <h2 className="text-xl font-bold">Pega la URL del producto</h2>
        <p className="text-sm text-muted-foreground">
          Herencia analiza la ficha, copia las imágenes disponibles a su biblioteca y crea un borrador. Si el dominio coincide con un proveedor registrado, lo enlaza automáticamente.
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-3 lg:flex-row">
        <input
          type="url"
          value={importUrl}
          onChange={(e) => setImportUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !importingUrl) void importProductByUrl();
          }}
          placeholder="https://www.aliexpress.com/item/... o URL de otro proveedor"
          className="min-w-0 flex-1 rounded-xl border border-border bg-background p-3"
        />
        <button
          disabled={importingUrl || !importUrl.trim()}
          onClick={() => void importProductByUrl()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importingUrl ? <RefreshCw className="h-4 w-4 animate-spin"/> : <Link2 className="h-4 w-4"/>}
          {importingUrl ? "Analizando…" : "Importar producto"}
        </button>
      </div>
      {importFeedback && <p role="status" className={`mt-3 rounded-xl border p-3 text-sm ${importFeedback.ok ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"}`}>{importFeedback.message}</p>}
      <p className="mt-3 text-xs text-muted-foreground">
        La importación queda en borrador para que revises precio, descripción, variantes e imágenes antes de publicar.
      </p>
    </section>

    <div className="grid gap-6 xl:grid-cols-2">
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-bold">{form.id ? "Editar proveedor" : "Nuevo proveedor"}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre · ej. AliExpress" className="rounded-xl border border-border bg-background p-3"/>
          <input value={form.sourceHost} onChange={(e) => setForm({ ...form, sourceHost: e.target.value })} placeholder="Dominio · aliexpress.com" className="rounded-xl border border-border bg-background p-3"/>
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded-xl border border-border bg-background p-3"/>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Teléfono" className="rounded-xl border border-border bg-background p-3"/>
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Categoría" className="rounded-xl border border-border bg-background p-3"/>
          <select value={form.fulfillmentMode} onChange={(e) => setForm({ ...form, fulfillmentMode: e.target.value as SupplierMode })} className="rounded-xl border border-border bg-background p-3">
            <option value="manual">🖱️ Manual / 1 clic</option>
            <option value="autopilot">🤖 Autopilot</option>
          </select>
          <select value={form.integrationType} onChange={(e) => setForm({ ...form, integrationType: e.target.value })} className="rounded-xl border border-border bg-background p-3">
            <option value="manual">Proveedor manual</option>
            <option value="cj">CJdropshipping API · gratis</option>
            <option value="webhook">Conector/API externo</option>
          </select>
          <label className="rounded-xl border border-border p-3 text-sm">
            <span className="block text-xs font-semibold text-muted-foreground">Máximo por pedido automático</span>
            <input type="number" min="0" step="0.01" value={form.maxAutoOrderTotal} onChange={(e) => setForm({ ...form, maxAutoOrderTotal: Math.max(0, Number(e.target.value || 0)) })} className="mt-1 w-full bg-transparent font-semibold outline-none"/>
          </label>
          <label className="rounded-xl border border-border p-3 text-sm">
            <span className="block text-xs font-semibold text-muted-foreground">Margen mínimo Autopilot</span>
            <div className="mt-1 flex items-center gap-1">
              <input type="number" min="0" max="95" step="1" value={form.minMarginPercent} onChange={(e) => setForm({ ...form, minMarginPercent: Math.max(0, Math.min(95, Number(e.target.value || 0))) })} className="w-full bg-transparent font-semibold outline-none"/>
              <span className="font-semibold">%</span>
            </div>
          </label>
          {form.integrationType === "cj" && <>
            <label className="rounded-xl border border-border p-3 text-sm">
              <span className="block text-xs font-semibold text-muted-foreground">Logística CJ</span>
              <input value={form.cjLogisticName} onChange={(e)=>setForm({...form,cjLogisticName:e.target.value})} className="mt-1 w-full bg-transparent font-semibold outline-none" placeholder="CJPacket Ordinary"/>
            </label>
            <label className="rounded-xl border border-border p-3 text-sm">
              <span className="block text-xs font-semibold text-muted-foreground">País de salida</span>
              <input value={form.cjFromCountryCode} onChange={(e)=>setForm({...form,cjFromCountryCode:e.target.value.toUpperCase().slice(0,2)})} className="mt-1 w-full bg-transparent font-semibold outline-none" placeholder="CN"/>
            </label>
            <label className="rounded-xl border border-border p-3 text-sm">
              <span className="block text-xs font-semibold text-muted-foreground">Máximo real CJ</span>
              <div className="mt-1 flex items-center gap-1"><span>$</span><input type="number" min="0" step="0.01" value={form.cjMaxPaymentUsd} onChange={(e)=>setForm({...form,cjMaxPaymentUsd:Math.max(0,Number(e.target.value||0))})} className="w-full bg-transparent font-semibold outline-none"/><span>USD</span></div>
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm font-semibold">
              <input type="checkbox" checked={form.cjSandbox !== false} onChange={(e)=>setForm({...form,cjSandbox:e.target.checked})}/>
              Modo pruebas CJ (no cobra)
            </label>
          </>}
          <label className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm font-semibold">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })}/>
            Proveedor activo
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => void saveSupplier()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground">
            <Save className="h-4 w-4"/>Guardar proveedor
          </button>
          {form.id && <button onClick={() => setForm({ id:"",name:"",email:"",phone:"",category:"",sourceHost:"",fulfillmentMode:"manual",maxAutoOrderTotal:80,minMarginPercent:30,integrationType:"manual",cjSandbox:true,cjLogisticName:"CJPacket Ordinary",cjFromCountryCode:"CN",cjMaxPaymentUsd:50,active:true })} className="rounded-xl border border-border px-4 py-3 font-semibold">Cancelar edición</button>}
        </div>
        {form.integrationType === "cj" && <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold">CJdropshipping Autopilot</p>
              <p className="text-xs text-muted-foreground">{cjConfigured ? "API Key detectada en el backend" : "Falta CJ_API_KEY en Railway"} · {cjLiveEnabled ? "pago real habilitado" : "pago real bloqueado por seguridad"}</p>
              {cjBalance && <p className="mt-1 text-xs font-semibold">Saldo CJ disponible: {String(cjBalance?.amount ?? cjBalance?.balance ?? "consultado")}</p>}
            </div>
            <button disabled={cjTesting} onClick={() => void testCjConnection()} className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${cjTesting ? "animate-spin" : ""}`}/>{cjTesting ? "Probando…" : "Probar conexión CJ"}
            </button>
          </div>
        </div>}
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-bold">Entrada de stock propio</h2>
        <p className="mt-1 text-sm text-muted-foreground">Solo para compras que llegan a tu almacén. Dropshipping no suma stock local.</p>
        <div className="mt-4 grid gap-3">
          <select value={purchase.supplierId} onChange={(e) => setPurchase({ ...purchase, supplierId: e.target.value })} className="rounded-xl border border-border bg-background p-3">
            <option value="">Proveedor</option>
            {suppliers.map((supplier: any) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
          <select value={purchase.productId} onChange={(e) => setPurchase({ ...purchase, productId: e.target.value })} className="rounded-xl border border-border bg-background p-3">
            <option value="">Producto</option>
            {products.filter((product:any)=>product.active!==false&&!product.deletedAt).map((product: any) => <option key={product.id} value={product.id}>{product.name} · stock {product.stock || 0}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" min="1" value={purchase.quantity} onChange={(e) => setPurchase({ ...purchase, quantity: Math.max(1, Number(e.target.value || 1)) })} placeholder="Cantidad" className="rounded-xl border border-border bg-background p-3"/>
            <input type="number" min="0" step="0.01" value={purchase.unitCost} onChange={(e) => setPurchase({ ...purchase, unitCost: Math.max(0, Number(e.target.value || 0)) })} placeholder="Coste unidad" className="rounded-xl border border-border bg-background p-3"/>
          </div>
          <input value={purchase.reference} onChange={(e) => setPurchase({ ...purchase, reference: e.target.value })} placeholder="Referencia / factura proveedor" className="rounded-xl border border-border bg-background p-3"/>
          {selectedProduct && <p className="text-sm text-muted-foreground">Después de esta entrada: <strong>{Number(selectedProduct.stock || 0) + purchase.quantity}</strong> uds. · Coste: <strong>{money(purchase.quantity * purchase.unitCost)}</strong></p>}
        </div>
        <button onClick={() => void createPurchase()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground">
          <ShoppingBag className="h-4 w-4"/>Registrar compra
        </button>
      </section>
    </div>

    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Productos importados por URL</h2>
          <p className="text-sm text-muted-foreground">Asigna proveedor, coste y modo. Al marcarlo dropshipping se desactiva el stock local.</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {!importedProducts.length ? <p className="text-sm text-muted-foreground">Aún no hay productos importados por URL.</p> :
          importedProducts.slice(0, 150).map((product: any) => <ImportedProductRow
            key={product.id}
            product={product}
            suppliers={suppliers}
            saving={savingProductId === String(product.id)}
            onSave={assignDropship}
          />)}
      </div>
    </section>

    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold">Cola de pedidos a proveedores</h2>
          <p className="text-sm text-muted-foreground">Los pedidos pagados se preparan automáticamente. También puedes reconstruir la cola para pedidos anteriores.</p>
        </div>
        <button onClick={() => void syncPaidOrders()} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 font-semibold">
          <RefreshCw className="h-4 w-4"/>Sincronizar pedidos pagados
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {!fulfillments.length ? <p className="text-sm text-muted-foreground">No hay compras de proveedor preparadas todavía.</p> :
          fulfillments.slice(0, 200).map((item: any) => {
            const canRunAuto = item.mode === "autopilot" && ["autopilot_ready","approval_required","connector_required","cost_required","mapping_required","address_required","payment_required","action_required"].includes(String(item.status || ""));
            const sourceUrl = item.items?.[0]?.sourceProductUrl || "";
            return <div key={item.id} className="rounded-2xl border border-border p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">Pedido #{String(item.orderId || "").slice(0, 8)}</p>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold">{item.mode === "autopilot" ? "🤖 AUTOPILOT" : "🖱️ MANUAL"}</span>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">{fulfillmentBadge(item.status)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.supplierName} · coste estimado <strong>{money(item.estimatedCost)}</strong></p>
                  <p className="mt-1 text-xs text-muted-foreground">{(item.items || []).map((line:any)=>`${line.name} ×${line.quantity}`).join(" · ")}</p>
                  {Number(item.estimatedCost || 0) > 0 && Number(item.revenue || 0) > 0 && <p className="mt-1 text-xs font-semibold text-muted-foreground">Venta: {money(item.revenue)} · coste: {money(item.estimatedCost)} · margen: {Number(item.grossMarginPercent || 0).toFixed(1)}%{Number(item.minMarginPercent || 0) > 0 ? ` · mínimo ${Number(item.minMarginPercent).toFixed(1)}%` : ""}</p>}
                  {item.blocker && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{item.blocker}</p>}
                  {item.trackingNumber && <p className="mt-2 text-sm">Tracking: <strong>{item.trackingNumber}</strong></p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {sourceUrl && <button onClick={() => window.open(sourceUrl, "_blank", "noopener,noreferrer")} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold"><ExternalLink className="h-4 w-4"/>Proveedor</button>}
                  {item.mode === "manual" && !["ordered","shipped","delivered"].includes(String(item.status || "")) && <button disabled={processingId===String(item.id)} onClick={() => void executeFulfillment(item)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><MousePointerClick className="h-4 w-4"/>Preparar compra</button>}
                  {canRunAuto && <button disabled={processingId===String(item.id)} onClick={() => void executeFulfillment(item)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Play className="h-4 w-4"/>Ejecutar Autopilot</button>}
                  {["manual_purchase_required","autopilot_ready","connector_required","approval_required","action_required","cost_required"].includes(String(item.status || "")) && <button onClick={() => void markOrdered(item)} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4"/>Marcar comprado</button>}
                  {["ordered","shipped"].includes(String(item.status || "")) && <button onClick={() => void addTracking(item)} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold"><Truck className="h-4 w-4"/>Tracking</button>}
                  {(item.provider === "cj" || suppliers.find((supplier:any)=>String(supplier.id)===String(item.supplierId))?.integrationType === "cj") && item.externalOrderId && <button disabled={processingId===String(item.id)} onClick={() => void syncCjFulfillment(item)} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold"><RefreshCw className="h-4 w-4"/>Sincronizar CJ</button>}
                  {(item.provider === "cj" || suppliers.find((supplier:any)=>String(supplier.id)===String(item.supplierId))?.integrationType === "cj") && ["ordered","shipped","delivered"].includes(String(item.status || "")) && <button disabled={processingId===String(item.id)} onClick={() => void openCjDispute(item)} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold">↩️ Devolución / reenvío</button>}
                </div>
              </div>
            </div>;
          })}
      </div>
    </section>

    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-xl font-bold">Proveedores registrados</h2>
      <div className="mt-4 space-y-2">
        {!suppliers.length ? <p className="text-sm text-muted-foreground">Aún no hay proveedores.</p> :
          suppliers.map((supplier: any) => <button key={supplier.id} onClick={() => editSupplier(supplier)} className="w-full rounded-xl border border-border p-4 text-left hover:bg-muted/40">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{supplier.name}</p>
                <p className="text-xs text-muted-foreground">{supplier.sourceHost || "Sin dominio"} · {supplier.category || "Sin categoría"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold">{supplier.fulfillmentMode === "autopilot" ? "🤖 Autopilot" : "🖱️ Manual"}</span>
                {supplier.fulfillmentMode === "autopilot" && <span className="rounded-full bg-muted px-2.5 py-1 text-xs"><ShieldCheck className="mr-1 inline h-3.5 w-3.5"/>máx. {money(supplier.maxAutoOrderTotal)}</span>}
                {supplier.fulfillmentMode === "autopilot" && Number(supplier.minMarginPercent || 0) > 0 && <span className="rounded-full bg-muted px-2.5 py-1 text-xs">margen mín. {Number(supplier.minMarginPercent).toFixed(0)}%</span>}
                {supplier.integrationType === "cj" && <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-800">CJ API {supplier.cjSandbox !== false ? "SANDBOX" : "REAL"}</span>}
              </div>
            </div>
          </button>)}
      </div>
    </section>
  </div>;
}

function ImportedProductRow({
  product,
  suppliers,
  saving,
  onSave,
}: {
  product: any;
  suppliers: any[];
  saving: boolean;
  onSave: (
    product: any,
    supplierId: string,
    mode: SupplierMode,
    supplierCost: number,
    supplierVariantId?: string,
    supplierSku?: string
  ) => Promise<void>;
}) {
  const metadata = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};
  const [supplierId, setSupplierId] = useState(String(metadata.supplierId || ""));
  const [mode, setMode] = useState<SupplierMode>(metadata.fulfillmentMode === "autopilot" ? "autopilot" : "manual");
  const [cost, setCost] = useState(Number(metadata.supplierCost || 0));
  const [supplierVariantId, setSupplierVariantId] = useState(String(metadata.supplierVariantId || metadata.cjVid || ""));
  const [supplierSku, setSupplierSku] = useState(String(metadata.supplierSku || metadata.cjSku || ""));
  const sourceUrl = String(metadata.sourceProductUrl || "");
  const sourceHost = sourceHostFromProduct(product);
  const supplierCurrency = String(metadata.supplierCurrency || "EUR").toUpperCase();
  const originalSupplierPrice = Number(metadata.supplierOriginalPrice || metadata.supplierCost || 0);
  const salePrice = Number(product.onSale && product.salePrice ? product.salePrice : product.price || 0);
  const grossMargin = salePrice > 0 && cost > 0 ? salePrice - cost : 0;
  const grossPercent = salePrice > 0 && cost > 0 ? (grossMargin / salePrice) * 100 : 0;

  const selectedSupplier = suppliers.find((supplier:any)=>String(supplier.id)===String(supplierId));
  return <div className="grid gap-3 rounded-2xl border border-border p-4 xl:grid-cols-[minmax(0,1.3fr)_200px_160px_150px_210px_auto] xl:items-center">
    <div className="min-w-0">
      <div className="flex items-center gap-3">
        {product.image ? <img src={product.image} alt="" className="h-14 w-14 rounded-xl object-cover"/> : <div className="grid h-14 w-14 place-items-center rounded-xl bg-muted">📦</div>}
        <div className="min-w-0">
          <p className="truncate font-semibold">{product.name}</p>
          <p className="truncate text-xs text-muted-foreground">{sourceHost || "Proveedor por URL"} · venta {money(salePrice)}</p>
          {originalSupplierPrice > 0 && <p className="truncate text-[11px] text-muted-foreground">Precio detectado: {originalSupplierPrice.toFixed(2)} {supplierCurrency}{supplierCurrency !== "EUR" ? " · revisa/conviértelo antes de Autopilot" : ""}</p>}
          {cost > 0 && salePrice > 0 && <p className={`text-xs font-semibold ${grossMargin > 0 ? "text-emerald-700" : "text-red-700"}`}>Margen bruto: {money(grossMargin)} · {grossPercent.toFixed(1)}%</p>}
        </div>
      </div>
    </div>
    <select value={supplierId} onChange={(e)=>setSupplierId(e.target.value)} className="rounded-xl border border-border bg-background p-3 text-sm">
      <option value="">Seleccionar proveedor</option>
      {suppliers.map((supplier:any)=><option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
    </select>
    <select value={mode} onChange={(e)=>setMode(e.target.value as SupplierMode)} className="rounded-xl border border-border bg-background p-3 text-sm">
      <option value="manual">🖱️ Manual</option>
      <option value="autopilot">🤖 Autopilot</option>
    </select>
    <label className="rounded-xl border border-border px-3 py-2">
      <span className="block text-[11px] font-semibold text-muted-foreground">Coste proveedor</span>
      <input type="number" min="0" step="0.01" value={cost} onChange={(e)=>setCost(Math.max(0,Number(e.target.value||0)))} className="w-full bg-transparent text-sm font-semibold outline-none"/>
    </label>
    <div className="space-y-2 rounded-xl border border-border px-3 py-2">
      <span className="block text-[11px] font-semibold text-muted-foreground">{selectedSupplier?.integrationType === "cj" ? "CJ VID o SKU" : "ID/SKU proveedor"}</span>
      <input value={supplierVariantId} onChange={(e)=>setSupplierVariantId(e.target.value)} placeholder="VID (preferido)" className="w-full bg-transparent text-xs font-semibold outline-none"/>
      <input value={supplierSku} onChange={(e)=>setSupplierSku(e.target.value)} placeholder="SKU proveedor" className="w-full bg-transparent text-xs outline-none"/>
    </div>
    <div className="flex gap-2">
      {sourceUrl && <button onClick={()=>window.open(sourceUrl,"_blank","noopener,noreferrer")} className="rounded-xl border border-border p-3" title="Abrir producto"><ExternalLink className="h-4 w-4"/></button>}
      <button disabled={saving} onClick={()=>void onSave(product,supplierId,mode,cost,supplierVariantId,supplierSku)} className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? "Guardando…" : "Conectar"}</button>
    </div>
  </div>;
}

function Card({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return <div className="rounded-2xl border border-border bg-card p-5">
    <Icon className="h-6 w-6 text-primary"/>
    <p className="mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-black">{value}</p>
  </div>;
}
