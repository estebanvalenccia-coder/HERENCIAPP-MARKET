import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Building2,
  ClipboardCopy,
  ExternalLink,
  Link2,
  PackagePlus,
  RefreshCw,
  Save,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { backendApi } from "../../lib/backendStorage";

type SupplierForm = {
  id: string;
  name: string;
  email: string;
  phone: string;
  category: string;
  sourceHost: string;
  fulfillmentMode: "manual" | "autopilot";
  maxAutoOrderTotal: number;
  active: boolean;
};

const emptySupplier = (): SupplierForm => ({
  id: "",
  name: "",
  email: "",
  phone: "",
  category: "",
  sourceHost: "",
  fulfillmentMode: "manual",
  maxAutoOrderTotal: 0,
  active: true,
});

const money = (value: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value || 0));

const statusLabel: Record<string, string> = {
  manual_ready: "Manual listo",
  manual_purchase_required: "Compra manual pendiente",
  autopilot_ready: "Autopilot listo",
  connector_required: "Falta conector",
  supplier_required: "Falta proveedor",
  supplier_disabled: "Proveedor desactivado",
  cost_required: "Falta coste",
  approval_required: "Requiere aprobación",
  action_required: "Revisión necesaria",
  ordered: "Comprado",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export function AdminSuppliersPanel() {
  const [operations, setOperations] = useState<any>({ suppliers: [], purchases: [] });
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [fulfillments, setFulfillments] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [connectorConfigured, setConnectorConfigured] = useState(false);
  const [form, setForm] = useState<SupplierForm>(emptySupplier());
  const [purchase, setPurchase] = useState({ supplierId: "", reference: "", productId: "", quantity: 1, unitCost: 0 });
  const [productDrafts, setProductDrafts] = useState<Record<string, any>>({});
  const [fulfillmentEdits, setFulfillmentEdits] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [opsResult, catalogResult, fulfillmentResult, ordersResult] = await Promise.allSettled([
        backendApi.getPosOperations(),
        backendApi.listCommerceProducts({ includeArchived: true }),
        backendApi.getSupplierFulfillments(),
        backendApi.listOrders(),
      ]);

      if (opsResult.status === "fulfilled") setOperations(opsResult.value.operations || {});
      if (catalogResult.status === "fulfilled") {
        const products = Array.isArray(catalogResult.value.products) ? catalogResult.value.products : [];
        setCatalogProducts(products);
        const drafts: Record<string, any> = {};
        products.forEach((product: any) => {
          const metadata = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};
          drafts[String(product.id)] = {
            supplierId: String(metadata.supplierId || ""),
            supplierCost: Number(metadata.supplierCost || metadata.supplierUnitCost || 0),
            fulfillmentMode: metadata.fulfillmentMode === "autopilot" ? "autopilot" : "manual",
          };
        });
        setProductDrafts(drafts);
      }
      if (fulfillmentResult.status === "fulfilled") {
        setFulfillments(fulfillmentResult.value.fulfillments || []);
        setConnectorConfigured(Boolean(fulfillmentResult.value.autopilotConnectorConfigured));
      }
      if (ordersResult.status === "fulfilled") setOrders(ordersResult.value.orders || []);

      const rejected = [opsResult, catalogResult, fulfillmentResult, ordersResult].find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;
      if (rejected) toast.warning(rejected.reason?.message || "Algunos datos no se pudieron cargar");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo cargar Proveedores");
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
      catalogProducts.filter((product: any) => {
        const metadata = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};
        return Boolean(metadata.importedFromUrl || metadata.sourceProductUrl);
      }),
    [catalogProducts]
  );

  const dropshipProducts = useMemo(
    () =>
      importedProducts.filter((product: any) => {
        const metadata = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};
        return metadata.fulfillmentType === "dropship";
      }),
    [importedProducts]
  );

  const selectedProduct = catalogProducts.find((product: any) => String(product.id) === String(purchase.productId));

  const saveSupplier = async () => {
    if (!form.name.trim()) return toast.error("Escribe el nombre del proveedor");
    if (form.fulfillmentMode === "autopilot" && !form.sourceHost.trim()) {
      return toast.error("Autopilot necesita el dominio del proveedor, por ejemplo aliexpress.com");
    }
    setBusyId("supplier-form");
    try {
      const result = await backendApi.savePosSupplier(form);
      setOperations(result.operations || operations);
      setForm(emptySupplier());
      toast.success("Proveedor guardado");
      await refreshFulfillments();
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar el proveedor");
    } finally {
      setBusyId("");
    }
  };

  const editSupplier = (supplier: any) => {
    setForm({
      id: String(supplier.id || ""),
      name: String(supplier.name || ""),
      email: String(supplier.email || ""),
      phone: String(supplier.phone || ""),
      category: String(supplier.category || ""),
      sourceHost: String(supplier.sourceHost || ""),
      fulfillmentMode: supplier.fulfillmentMode === "autopilot" ? "autopilot" : "manual",
      maxAutoOrderTotal: Number(supplier.maxAutoOrderTotal || 0),
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
    } catch (error: any) {
      toast.error(error?.message || "No se pudo registrar la compra");
    }
  };

  const saveDropshipProduct = async (product: any, enabled = true) => {
    const id = String(product.id);
    const draft = productDrafts[id] || {};
    if (enabled && !draft.supplierId) return toast.error("Asigna un proveedor");
    const supplier = suppliers.find((item: any) => String(item.id) === String(draft.supplierId));
    const metadata = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};

    setBusyId("product:" + id);
    try {
      await backendApi.updateCommerceProduct(id, {
        trackInventory: enabled ? false : true,
        metadata: {
          ...metadata,
          fulfillmentType: enabled ? "dropship" : "stock",
          supplierId: enabled ? String(draft.supplierId || "") : "",
          supplierCost: enabled ? Math.max(0, Number(draft.supplierCost || 0)) : 0,
          fulfillmentMode: enabled ? (draft.fulfillmentMode === "autopilot" ? "autopilot" : "manual") : "manual",
          supplierSourceHost: enabled ? String(supplier?.sourceHost || metadata.sourceHost || "") : "",
          dropshipConfiguredAt: enabled ? new Date().toISOString() : null,
        },
      });
      toast.success(enabled ? "Dropshipping configurado" : "Producto vuelto a stock propio");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar la configuración");
    } finally {
      setBusyId("");
    }
  };

  const refreshFulfillments = async () => {
    const result = await backendApi.getSupplierFulfillments();
    setFulfillments(result.fulfillments || []);
    setConnectorConfigured(Boolean(result.autopilotConnectorConfigured));
  };

  const scanPaidOrders = async () => {
    const eligible = orders
      .filter((order: any) => ["paid", "confirmed", "preparing", "processing", "ready"].includes(String(order.status || "")))
      .slice(0, 100);
    if (!eligible.length) return toast.info("No hay pedidos pagados o en preparación para revisar");

    setScanning(true);
    let detected = 0;
    let errors = 0;
    try {
      for (const order of eligible) {
        try {
          const result = await backendApi.prepareSupplierFulfillments(String(order.id));
          detected += Number(result.fulfillments?.length || 0);
        } catch {
          errors += 1;
        }
      }
      await refreshFulfillments();
      if (errors) toast.warning("Revisión terminada con " + errors + " pedidos que requieren atención");
      else toast.success("Cola actualizada · " + detected + " preparaciones detectadas");
    } finally {
      setScanning(false);
    }
  };

  const executeFulfillment = async (fulfillment: any, force = false) => {
    setBusyId("fulfillment:" + fulfillment.id);
    try {
      const result = await backendApi.executeSupplierFulfillment(String(fulfillment.id), force);
      await refreshFulfillments();
      if (result.executed) toast.success("Pedido enviado al conector del proveedor");
      else if (result.manual) toast.success("Compra manual preparada");
      else toast.warning(result.fulfillment?.blocker || "Autopilot requiere una acción");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo procesar el pedido");
    } finally {
      setBusyId("");
    }
  };

  const saveFulfillment = async (fulfillment: any) => {
    const edit = fulfillmentEdits[String(fulfillment.id)] || {};
    setBusyId("fulfillment:" + fulfillment.id);
    try {
      await backendApi.updateSupplierFulfillment(String(fulfillment.id), {
        status: edit.status || fulfillment.status,
        externalOrderId: edit.externalOrderId ?? fulfillment.externalOrderId ?? "",
        trackingNumber: edit.trackingNumber ?? fulfillment.trackingNumber ?? "",
        trackingUrl: edit.trackingUrl ?? fulfillment.trackingUrl ?? "",
      });
      await refreshFulfillments();
      toast.success("Seguimiento actualizado");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo actualizar");
    } finally {
      setBusyId("");
    }
  };

  const copyShipping = async (fulfillment: any) => {
    const address = fulfillment.shippingAddress || {};
    const text = [
      fulfillment.customerName,
      address.phone,
      address.address,
      address.address2,
      [address.postalCode, address.city].filter(Boolean).join(" "),
      address.province,
      address.country,
      address.notes,
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Datos de envío copiados");
    } catch {
      toast.error("No se pudieron copiar los datos");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-primary">Supplier Hub</p>
            <h1 className="mt-2 text-3xl font-black">Proveedores · Manual + Autopilot</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Importa productos por URL, asigna proveedor y coste, y deja que Herencia prepare cada pedido después del pago.
            </p>
          </div>
          <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${connectorConfigured ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-900"}`}>
            <div className="flex items-center gap-2">
              {connectorConfigured ? <ShieldCheck className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              {connectorConfigured ? "Conector Autopilot conectado" : "Autopilot preparado · falta API/conector autorizado"}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <Card icon={Building2} label="Proveedores" value={String(suppliers.length)} />
        <Card icon={Link2} label="Productos externos" value={String(importedProducts.length)} />
        <Card icon={Bot} label="Dropshipping activos" value={String(dropshipProducts.length)} />
        <Card icon={Truck} label="Cola proveedor" value={String(fulfillments.length)} />
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
          <div>
            <h2 className="text-xl font-bold">{form.id ? "Editar proveedor" : "Nuevo proveedor"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              El dominio permite que Herencia relacione automáticamente los productos importados con el proveedor correcto.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre · AliExpress, mayorista..." className="rounded-xl border border-border bg-background p-3" />
              <input value={form.sourceHost} onChange={(e) => setForm({ ...form, sourceHost: e.target.value })} placeholder="Dominio · aliexpress.com" className="rounded-xl border border-border bg-background p-3" />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded-xl border border-border bg-background p-3" />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Teléfono" className="rounded-xl border border-border bg-background p-3" />
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Categoría" className="rounded-xl border border-border bg-background p-3" />
              <input type="number" min="0" step="0.01" value={form.maxAutoOrderTotal} onChange={(e) => setForm({ ...form, maxAutoOrderTotal: Math.max(0, Number(e.target.value || 0)) })} placeholder="Máximo Autopilot por pedido" className="rounded-xl border border-border bg-background p-3" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => setForm({ ...form, fulfillmentMode: "manual" })}
                className={`rounded-2xl border p-4 text-left ${form.fulfillmentMode === "manual" ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <ShoppingBag className="h-5 w-5" />
                <p className="mt-2 font-bold">Manual / 1 clic</p>
                <p className="text-xs text-muted-foreground">Herencia prepara datos, enlace, coste y dirección; tú confirmas la compra.</p>
              </button>
              <button
                onClick={() => setForm({ ...form, fulfillmentMode: "autopilot" })}
                className={`rounded-2xl border p-4 text-left ${form.fulfillmentMode === "autopilot" ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <Zap className="h-5 w-5" />
                <p className="mt-2 font-bold">Autopilot</p>
                <p className="text-xs text-muted-foreground">Compra automática solo mediante conector/API autorizado y dentro de tus límites.</p>
              </button>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Proveedor activo
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button disabled={busyId === "supplier-form"} onClick={() => void saveSupplier()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-50">
                <Save className="h-4 w-4" /> {form.id ? "Guardar cambios" : "Crear proveedor"}
              </button>
              {form.id && <button onClick={() => setForm(emptySupplier())} className="rounded-xl border border-border px-4 py-3 font-semibold">Cancelar edición</button>}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-bold">Proveedores registrados</h2>
            {!suppliers.length ? <p className="text-sm text-muted-foreground">Aún no hay proveedores.</p> : suppliers.map((supplier: any) => (
              <button key={supplier.id} onClick={() => editSupplier(supplier)} className="w-full rounded-2xl border border-border p-4 text-left transition hover:border-primary/40">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{supplier.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{supplier.sourceHost || "Sin dominio"} · {supplier.category || "Sin categoría"}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${supplier.fulfillmentMode === "autopilot" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                    {supplier.fulfillmentMode === "autopilot" ? "AUTOPILOT" : "MANUAL"}
                  </span>
                </div>
                {supplier.fulfillmentMode === "autopilot" && <p className="mt-2 text-xs text-muted-foreground">Límite: {Number(supplier.maxAutoOrderTotal || 0) > 0 ? money(supplier.maxAutoOrderTotal) : "sin límite configurado"}</p>}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-primary">Productos importados</p>
            <h2 className="mt-1 text-2xl font-black">Asignación dropshipping</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Los productos traídos por URL aparecen aquí. Asigna proveedor, coste real y modo de compra.
            </p>
          </div>
          <div className="text-sm text-muted-foreground">{importedProducts.length} productos externos</div>
        </div>

        <div className="mt-5 space-y-3">
          {!importedProducts.length && <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Importa un producto por URL y aparecerá automáticamente aquí.</p>}
          {importedProducts.map((product: any) => {
            const id = String(product.id);
            const metadata = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};
            const draft = productDrafts[id] || {};
            const enabled = metadata.fulfillmentType === "dropship";
            return (
              <div key={id} className="grid gap-4 rounded-2xl border border-border p-4 xl:grid-cols-[1.4fr_.8fr_.55fr_.65fr_auto] xl:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  {product.image ? <img src={product.image} alt="" className="h-14 w-14 rounded-xl border border-border object-cover" /> : <div className="h-14 w-14 rounded-xl bg-muted" />}
                  <div className="min-w-0">
                    <p className="truncate font-bold">{product.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{metadata.sourceHost || metadata.sourceProductUrl || "Proveedor externo"}</p>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                      {enabled ? "DROPSHIPPING" : "SIN CONFIGURAR"}
                    </span>
                  </div>
                </div>
                <select value={draft.supplierId || ""} onChange={(e) => setProductDrafts((current) => ({ ...current, [id]: { ...draft, supplierId: e.target.value } }))} className="rounded-xl border border-border bg-background p-3">
                  <option value="">Proveedor</option>
                  {suppliers.filter((supplier: any) => supplier.active !== false).map((supplier: any) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
                <input type="number" min="0" step="0.01" value={draft.supplierCost ?? 0} onChange={(e) => setProductDrafts((current) => ({ ...current, [id]: { ...draft, supplierCost: Math.max(0, Number(e.target.value || 0)) } }))} className="rounded-xl border border-border bg-background p-3" placeholder="Coste €" />
                <select value={draft.fulfillmentMode || "manual"} onChange={(e) => setProductDrafts((current) => ({ ...current, [id]: { ...draft, fulfillmentMode: e.target.value } }))} className="rounded-xl border border-border bg-background p-3">
                  <option value="manual">Manual / 1 clic</option>
                  <option value="autopilot">Autopilot</option>
                </select>
                <div className="flex gap-2">
                  <button disabled={busyId === "product:" + id} onClick={() => void saveDropshipProduct(product, true)} className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">Guardar</button>
                  {enabled && <button disabled={busyId === "product:" + id} onClick={() => void saveDropshipProduct(product, false)} className="rounded-xl border border-border px-3 py-3 text-xs font-bold">Stock propio</button>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-primary">Fulfillment</p>
            <h2 className="mt-1 text-2xl font-black">Cola de pedidos a proveedores</h2>
            <p className="mt-1 text-sm text-muted-foreground">Se crea automáticamente cuando un pedido dropshipping queda pagado o confirmado.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={scanning} onClick={() => void scanPaidOrders()} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-bold disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} /> Detectar pedidos pendientes
            </button>
            <button onClick={() => void refreshFulfillments()} className="rounded-xl border border-border px-4 py-3 text-sm font-bold">Actualizar</button>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {!fulfillments.length && <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">No hay pedidos dropshipping en la cola.</p>}
          {fulfillments.map((fulfillment: any) => {
            const firstUrl = fulfillment.items?.find((item: any) => item.sourceProductUrl)?.sourceProductUrl || "";
            const edit = fulfillmentEdits[String(fulfillment.id)] || {};
            const isBusy = busyId === "fulfillment:" + fulfillment.id;
            const warning = ["connector_required", "supplier_required", "supplier_disabled", "cost_required", "approval_required", "action_required"].includes(fulfillment.status);
            return (
              <article key={fulfillment.id} className="rounded-2xl border border-border p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black">Pedido #{String(fulfillment.orderId || "").slice(0, 8)}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${fulfillment.mode === "autopilot" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                        {fulfillment.mode === "autopilot" ? "AUTOPILOT" : "MANUAL"}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${warning ? "bg-amber-100 text-amber-900" : "bg-blue-100 text-blue-800"}`}>
                        {statusLabel[fulfillment.status] || fulfillment.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold">{fulfillment.supplierName}</p>
                    <p className="text-xs text-muted-foreground">{(fulfillment.items || []).map((item: any) => item.name + " ×" + item.quantity).join(" · ")}</p>
                    <p className="mt-2 text-sm">Coste proveedor estimado: <strong>{money(fulfillment.estimatedCost)}</strong></p>
                    {fulfillment.blocker && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">{fulfillment.blocker}</p>}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => void copyShipping(fulfillment)} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-bold">
                      <ClipboardCopy className="h-4 w-4" /> Copiar envío
                    </button>
                    {firstUrl && <a href={firstUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-bold">
                      <ExternalLink className="h-4 w-4" /> Abrir proveedor
                    </a>}
                    {!["ordered", "shipped", "delivered", "cancelled"].includes(fulfillment.status) && (
                      <button disabled={isBusy} onClick={() => void executeFulfillment(fulfillment, fulfillment.status === "approval_required")} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
                        {fulfillment.mode === "autopilot" ? <Zap className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
                        {fulfillment.status === "approval_required" ? "Aprobar y ejecutar" : fulfillment.mode === "autopilot" ? "Ejecutar Autopilot" : "Preparar compra"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 rounded-2xl bg-muted/30 p-4 md:grid-cols-2 xl:grid-cols-4">
                  <input value={edit.externalOrderId ?? fulfillment.externalOrderId ?? ""} onChange={(e) => setFulfillmentEdits((current) => ({ ...current, [fulfillment.id]: { ...edit, externalOrderId: e.target.value } }))} placeholder="ID pedido proveedor" className="rounded-xl border border-border bg-background p-3 text-sm" />
                  <input value={edit.trackingNumber ?? fulfillment.trackingNumber ?? ""} onChange={(e) => setFulfillmentEdits((current) => ({ ...current, [fulfillment.id]: { ...edit, trackingNumber: e.target.value } }))} placeholder="Tracking" className="rounded-xl border border-border bg-background p-3 text-sm" />
                  <input value={edit.trackingUrl ?? fulfillment.trackingUrl ?? ""} onChange={(e) => setFulfillmentEdits((current) => ({ ...current, [fulfillment.id]: { ...edit, trackingUrl: e.target.value } }))} placeholder="URL seguimiento" className="rounded-xl border border-border bg-background p-3 text-sm" />
                  <div className="flex gap-2">
                    <select value={edit.status ?? fulfillment.status} onChange={(e) => setFulfillmentEdits((current) => ({ ...current, [fulfillment.id]: { ...edit, status: e.target.value } }))} className="min-w-0 flex-1 rounded-xl border border-border bg-background p-3 text-sm">
                      <option value={fulfillment.status}>{statusLabel[fulfillment.status] || fulfillment.status}</option>
                      <option value="ordered">Comprado</option>
                      <option value="shipped">Enviado</option>
                      <option value="delivered">Entregado</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                    <button disabled={isBusy} onClick={() => void saveFulfillment(fulfillment)} className="rounded-xl border border-border px-3 font-bold disabled:opacity-50"><Save className="h-4 w-4" /></button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-xs text-muted-foreground md:grid-cols-2">
                  <div>
                    <p className="font-bold text-foreground">{fulfillment.customerName || "Cliente"}</p>
                    <p>{fulfillment.customerEmail || ""}</p>
                  </div>
                  <div>
                    <p>{fulfillment.shippingAddress?.address || "Dirección no disponible"}</p>
                    <p>{[fulfillment.shippingAddress?.postalCode, fulfillment.shippingAddress?.city, fulfillment.shippingAddress?.province].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-bold">Compra / entrada de stock propio</h2>
        <p className="mt-1 text-sm text-muted-foreground">Se mantiene separado de dropshipping para productos que sí recibes físicamente en Herencia.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select value={purchase.supplierId} onChange={(e) => setPurchase({ ...purchase, supplierId: e.target.value })} className="rounded-xl border border-border bg-background p-3">
            <option value="">Proveedor</option>
            {suppliers.map((supplier: any) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
          <select value={purchase.productId} onChange={(e) => setPurchase({ ...purchase, productId: e.target.value })} className="rounded-xl border border-border bg-background p-3">
            <option value="">Producto</option>
            {catalogProducts.map((product: any) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
          <input type="number" min="1" value={purchase.quantity} onChange={(e) => setPurchase({ ...purchase, quantity: Math.max(1, Number(e.target.value || 1)) })} placeholder="Cantidad" className="rounded-xl border border-border bg-background p-3" />
          <input type="number" min="0" step="0.01" value={purchase.unitCost} onChange={(e) => setPurchase({ ...purchase, unitCost: Math.max(0, Number(e.target.value || 0)) })} placeholder="Coste unidad" className="rounded-xl border border-border bg-background p-3" />
          <input value={purchase.reference} onChange={(e) => setPurchase({ ...purchase, reference: e.target.value })} placeholder="Referencia / factura" className="rounded-xl border border-border bg-background p-3 md:col-span-2" />
          <button onClick={() => void createPurchase()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground">
            <PackagePlus className="h-4 w-4" /> Registrar entrada
          </button>
          {selectedProduct && <div className="rounded-xl border border-border p-3 text-sm text-muted-foreground">Stock actual: <strong className="text-foreground">{Number(selectedProduct.stock || 0)}</strong> · Entrada: <strong className="text-foreground">{money(purchase.quantity * purchase.unitCost)}</strong></div>}
        </div>
      </section>

      {loading && <div className="fixed bottom-5 right-5 rounded-full border border-border bg-card px-4 py-2 text-sm font-bold shadow-lg">Actualizando Supplier Hub…</div>}
    </div>
  );
}

function Card({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <Icon className="h-6 w-6 text-primary" />
      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
