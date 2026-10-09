import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  ExternalLink,
  EyeOff,
  Eye,
  Trash2,
  Unlink2,
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
import { SupplierImportImages } from "./SupplierImportImages";

type SupplierMode = "manual" | "autopilot";

function normalizedSupplierDomain(value: string) {
  const host = String(value || "").toLowerCase().trim().replace(/^www\./, "");
  if (host === "aliexpress.com" || host.endsWith(".aliexpress.com")) return "aliexpress.com";
  if (host === "alibaba.com" || host.endsWith(".alibaba.com")) return "alibaba.com";
  if (host === "1688.com" || host.endsWith(".1688.com")) return "1688.com";
  return host;
}

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

function suspiciousImportedProduct(product: any) {
  const name = String(product?.name || "").trim().toLowerCase();
  const description = String(product?.description || "").slice(0, 500).toLowerCase();
  const host = sourceHostFromProduct(product).toLowerCase();
  return /^(human verification|human machine check|just a moment|access denied|captcha)$/.test(name) ||
    (/human machine check|verify you are human/.test(description) && /cjdropshipping\.com$/.test(host));
}

function fulfillmentBadge(status = "") {
  const normalized = String(status || "");
  if (["ordered", "shipped", "delivered"].includes(normalized)) return "✅ " + normalized;
  if (normalized === "autopilot_ready") return "🤖 listo";
  if (normalized === "manual_ready" || normalized === "manual_purchase_required") return "🖱️ manual";
  if (normalized === "connector_required") return "🔌 conector";
  if (normalized === "approval_required") return "🛡️ aprobación";
  if (normalized === "cj_creating" || normalized === "cj_paying") return "⏳ operación CJ";
  if (normalized === "cj_creation_unknown" || normalized === "cj_payment_unknown") return "⚠️ conciliar CJ";
  if (normalized === "cost_required") return "💶 coste";
  if (normalized === "mapping_required") return "🔗 SKU/VID";
  if (normalized === "address_required") return "📍 dirección";
  if (normalized === "payment_required") return "💳 pago";
  if (normalized === "action_required") return "⚠️ revisar";
  return normalized || "pendiente";
}

export function AdminSuppliersPanel({ onOpenProduct }: { onOpenProduct: (productId: string) => void }) {
  const [operations, setOperations] = useState<any>({ suppliers: [], purchases: [], supplierFulfillments: [] });
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [fulfillments, setFulfillments] = useState<any[]>([]);
  const [connectorReady, setConnectorReady] = useState(false);
  const [cjConfigured, setCjConfigured] = useState(false);
  const [cjLiveEnabled, setCjLiveEnabled] = useState(false);
  const [cjTesting, setCjTesting] = useState(false);
  const [cjBalance, setCjBalance] = useState<any>(null);
  const [cjOrderAudit, setCjOrderAudit] = useState<any>(null);
  const [cjOrderAuditLoading, setCjOrderAuditLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingProductId, setSavingProductId] = useState("");
  const [processingId, setProcessingId] = useState("");
  const [syncingPaidOrders, setSyncingPaidOrders] = useState(false);
  const [cjApprovalPreview, setCjApprovalPreview] = useState<Awaited<ReturnType<typeof backendApi.getCjManualApprovalPreview>> | null>(null);
  const [cjApprovalAction, setCjApprovalAction] = useState<"create" | "pay" | null>(null);
  const [cjApprovalConfirmation, setCjApprovalConfirmation] = useState("");
  const [cjApprovalMaxUsd, setCjApprovalMaxUsd] = useState("");
  const [cjMerchantPaysAcknowledged, setCjMerchantPaysAcknowledged] = useState(false);
  const [cjApprovalSubmitting, setCjApprovalSubmitting] = useState(false);
  const [cjApprovalLoadingId, setCjApprovalLoadingId] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importingUrl, setImportingUrl] = useState(false);
  const [manualImport, setManualImport] = useState<{ url: string; sourceHost: string; reason: string } | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualCost, setManualCost] = useState("");
  const [manualCurrency, setManualCurrency] = useState("EUR");
  const [manualImageUrl, setManualImageUrl] = useState("");
  const [manualUploadedImages, setManualUploadedImages] = useState<string[]>([]);
  const [manualUploading, setManualUploading] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [savedImport, setSavedImport] = useState<{ id: string; name: string; status: string; outcome: string } | null>(null);
  const [importSearch, setImportSearch] = useState("");
  const [showImportedProducts, setShowImportedProducts] = useState(false);
  const [importTab, setImportTab] = useState<"pending" | "connected" | "hidden">("pending");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedImportIds, setSelectedImportIds] = useState<string[]>([]);
  const [bulkImportBusy, setBulkImportBusy] = useState(false);
  const [onlyCjImports, setOnlyCjImports] = useState(false);
  const [showSuspectImports, setShowSuspectImports] = useState(false);
  const [existingSearch, setExistingSearch] = useState("");
  const [existingProductId, setExistingProductId] = useState("");
  const [existingProductUrl, setExistingProductUrl] = useState("");
  const [linkingExisting, setLinkingExisting] = useState(false);

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
  const importedProducts = useMemo(() =>
    products.filter((product: any) => {
      const metadata = product?.metadata && typeof product.metadata === "object" ? product.metadata : product;
      return String(product?.status || "") !== "archived" &&
        Boolean(metadata.importedFromUrl || metadata.sourceProductUrl);
    }), [products]
  );
  const suspectImports = importedProducts.filter(suspiciousImportedProduct);
  const importState = (product: any): "pending" | "connected" | "hidden" => {
    const metadata = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};
    if (metadata.supplierHubHidden) return "hidden";
    return metadata.supplierId ? "connected" : "pending";
  };
  const importCounts = {
    pending: importedProducts.filter(product => !suspiciousImportedProduct(product) && importState(product) === "pending").length,
    connected: importedProducts.filter(product => !suspiciousImportedProduct(product) && importState(product) === "connected").length,
    hidden: importedProducts.filter(product => !suspiciousImportedProduct(product) && importState(product) === "hidden").length,
  };
  const availableSourceHosts = [...new Set(importedProducts.map(sourceHostFromProduct).filter(Boolean))].sort();
  const visibleImports = useMemo(() => {
    const searchText = importSearch.trim().toLocaleLowerCase("es");
    return importedProducts.filter((product: any) => {
      if (suspiciousImportedProduct(product)) return false;
      if (importState(product) !== importTab) return false;
      const host = sourceHostFromProduct(product).toLowerCase();
      if (sourceFilter !== "all" && host !== sourceFilter) return false;
      if (onlyCjImports && !host.endsWith("cjdropshipping.com")) return false;
      if (!searchText) return true;
      const metadata = product.metadata && typeof product.metadata === "object" ? product.metadata : product;
      return [product.name, product.sku, metadata.sourceProductUrl, metadata.supplierProductId, metadata.supplierSku]
        .some((part) => String(part || "").toLocaleLowerCase("es").includes(searchText));
    }).sort((first: any, second: any) =>
      String(first.name || "").localeCompare(String(second.name || ""), "es"));
  }, [importedProducts, importSearch, onlyCjImports, importTab, sourceFilter]);

  const existingMatches = products.filter((product: any) => {
    if (String(product.status || "") === "archived") return false;
    const query = existingSearch.toLocaleLowerCase("es").trim();
    return !query || String(product.name || "").toLocaleLowerCase("es").includes(query) ||
      String(product.sku || "").toLocaleLowerCase("es").includes(query);
  }).slice(0, 100);
  const selectedExistingProduct = products.find((product: any) => String(product.id) === existingProductId);

  // Reconnect an existing Commerce/Neon product: only supplier metadata and inventory mode change.
  // Never re-import the article or overwrite the seller's price, publication, images or description.
  const linkExistingProduct = async () => {
    const product = products.find((item: any) => String(item.id) === existingProductId);
    if (!product) return toast.error("Elige primero un producto de tu catálogo");
    if (String(product.status || "") === "archived") return toast.error("No se puede vincular un producto de la papelera");
    let parsed: URL;
    try { parsed = new URL(existingProductUrl.trim()); }
    catch { return toast.error("Pega la URL real del producto en CJdropshipping"); }
    if (parsed.protocol !== "https:") return toast.error("La URL del proveedor debe ser HTTPS");
    const sourceHost = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const supplier = suppliers.find((entry: any) =>
      String(entry.sourceHost || "").toLowerCase().replace(/^www\./, "") === sourceHost
    );
    if (!supplier) return toast.error("No hay un proveedor registrado para este dominio. Revisa la URL.");
    const cjMatch = parsed.pathname.match(/-p-([0-9a-f]{8}-[0-9a-f-]{27,})\.html$/i);
    if (supplier.integrationType === "cj" && !cjMatch) {
      return toast.error("La URL CJ debe contener su identificador de producto (-p-...html)");
    }
    const metadata = product.metadata && typeof product.metadata === "object" ? product.metadata : {};
    setLinkingExisting(true);
    try {
      const saved = await backendApi.updateCommerceProduct(product.id, {
        metadata: {
          ...metadata,
          importedFromUrl: true,
          fulfillmentType: "dropship",
          supplierId: supplier.id,
          fulfillmentMode: supplier.fulfillmentMode === "autopilot" ? "autopilot" : "manual",
          sourceProductUrl: parsed.toString(),
          sourceCatalogUrl: metadata.sourceCatalogUrl || parsed.toString(),
          sourceHost,
          ...(cjMatch ? { supplierProductId: cjMatch[1] } : {}),
          supplierCost: Math.max(0, Number(metadata.supplierCost || 0)),
          supplierCurrency: metadata.supplierCurrency || (cjMatch ? "USD" : "EUR"),
          supplierAssignedAt: new Date().toISOString(),
        },
        trackInventory: false,
      });
      const updated = saved.product;
      if (!updated || !updated.metadata?.sourceProductUrl) {
        throw new Error("El producto se ha guardado, pero la vinculación no pudo verificarse. Recarga Proveedores.");
      }
      toast.success("Producto existente vinculado a " + supplier.name + " sin cambiar su precio, fotos ni publicación");
      setExistingProductId("");
      setExistingProductUrl("");
      setExistingSearch("");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "No se pudo vincular el artículo existente");
    } finally {
      setLinkingExisting(false);
    }
  };

  const saveSupplier = async () => {
    if (!String(form.name || "").trim()) return toast.error("Escribe el nombre del proveedor");
    const aliExpressHost = normalizedSupplierDomain(String(form.sourceHost || "")) === "aliexpress.com";
    const cannotAutopilot = form.integrationType === "manual" || aliExpressHost;
    if (form.fulfillmentMode === "autopilot" && cannotAutopilot) {
      return toast.error("AliExpress y los proveedores manuales no tienen un conector de pedidos autorizado. Usa el modo Manual.");
    }
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

  const saveImportedCandidate = async (candidate: any, wasManual = false) => {
    setSavedImport(null);
    const result = await backendApi.importCatalogUrlProduct(candidate);
    const imported = result.product;
    if (!result.ok || !imported?.id) {
      throw new Error("El servidor no confirmó dónde se ha guardado el artículo.");
    }

    // Existing products must not be re-linked or presented as newly created.
    const existing = Boolean(result.skipped);
    if (!existing) {
      const sourceHost = normalizedSupplierDomain(String(candidate.sourceHost || ""));
      const matchedSupplier = suppliers.find((supplier: any) =>
        normalizedSupplierDomain(String(supplier?.sourceHost || "")) === sourceHost
      );
      if (matchedSupplier) {
        const metadata = imported?.metadata && typeof imported.metadata === "object" ? imported.metadata : {};
        const sourceCurrency = String(candidate.supplierCurrency || metadata.supplierCurrency || "").toUpperCase();
        const detectedCost = (!sourceCurrency || sourceCurrency === "EUR")
          ? Number(metadata.supplierCost || candidate.supplierPrice || 0)
          : 0;
        // A supplier record alone is NOT a working AliExpress/Alibaba connector.
        const supportsAutomaticOrders = matchedSupplier.integrationType === "cj" &&
          matchedSupplier.fulfillmentMode === "autopilot" && !wasManual;
        await backendApi.updateCommerceProduct(imported.id, {
          metadata: {
            ...metadata,
            importedFromUrl: true,
            manuallyReviewedImport: wasManual,
            fulfillmentType: "dropship",
            supplierId: matchedSupplier.id,
            fulfillmentMode: supportsAutomaticOrders ? "autopilot" : "manual",
            supplierCost: detectedCost,
            supplierOriginalPrice: Number(candidate.supplierPrice || metadata.supplierOriginalPrice || 0),
            supplierCurrency: sourceCurrency,
            sourceHost: sourceHost || matchedSupplier.sourceHost || "",
            supplierAssignedAt: new Date().toISOString(),
          },
          trackInventory: false,
        });
      }
    }

    // Verify the persisted item before saying "saved" to the merchant.
    const confirmation = await backendApi.getCommerceProduct(imported.id);
    const confirmedProduct = confirmation.product;
    if (!confirmedProduct || String(confirmedProduct.id) !== String(imported.id)) {
      throw new Error("La importación respondió, pero no pudimos encontrar el borrador guardado en el catálogo.");
    }

    const inTrash = confirmedProduct.status === "archived" || Boolean(confirmedProduct.deletedAt);
    const outcome = inTrash ? "archived" : existing ? "existing" : result.updated ? "updated" : "created";
    setSavedImport({
      id: String(confirmedProduct.id),
      name: String(confirmedProduct.name || candidate.name || "Producto"),
      status: String(confirmedProduct.status || "draft"),
      outcome,
    });
    setImportSearch(String(confirmedProduct.name || candidate.name || ""));
    setOnlyCjImports(false);
    setShowImportedProducts(false);
    setSelectedImportIds([]);
    const missing = Array.isArray(result.missingFields) ? result.missingFields : [];
    const labels: Record<string, string> = { images: "fotografías", description: "descripción", supplierPrice: "coste del proveedor" };
    const prefix = inTrash ? "El producto ya existe en la Papelera."
      : existing ? "Este enlace ya tenía un producto guardado."
      : result.updated ? "Borrador existente actualizado." : "Borrador creado en Productos → Ver productos.";
    setImportFeedback({
      ok: !inTrash,
      message: prefix + (missing.length ? " Pendiente: " + missing.map((field) => labels[field] || field).join(", ") + "." : "") +
        " No se enviará automáticamente ningún pedido a AliExpress.",
    });
    if (result.imageImportWarning) toast.warning(result.imageImportWarning);
    toast.info(inTrash ? "El artículo está en Papelera; revísalo antes de volver a importar." : prefix);
    if (!existing && !inTrash) {
      setImportUrl("");
      setManualImport(null);
      setManualName("");
      setManualCost("");
      setManualImageUrl("");
      setManualUploadedImages([]);
    }
    try {
      const refreshed = await backendApi.listCommerceProducts({ includeArchived: true });
      setProducts(Array.isArray(refreshed.products) ? refreshed.products : []);
    } catch {
      // The confirmed product still remains accessible via the card above.
    }
    return confirmedProduct;
  };

  const importProductByUrl = async () => {
    const url = String(importUrl || "").trim();
    if (!url) return toast.error("Pega la URL del producto");
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Unsupported protocol");
    } catch {
      return toast.error("La URL debe empezar por https:// o http://");
    }

    setImportFeedback({ ok: true, message: "Consultando catálogo del proveedor…" });
    setSavedImport(null);
    setImportingUrl(true);
    setManualImport(null);
    setManualName("");
    setManualImageUrl("");
    setManualUploadedImages([]);
    setManualCost("");
    try {
      const preview = await backendApi.previewCatalogUrl(url, 1);
      if (preview.requiresManual) {
        setManualImport({
          url: preview.sourceUrl || url,
          sourceHost: normalizedSupplierDomain(preview.sourceHost || new URL(url).hostname),
          reason: preview.message || "El proveedor no permite importar automáticamente la ficha.",
        });
        setImportFeedback({ ok: false, message: "La ficha no se pudo importar por completo. Se requiere revisión manual; no se publicará ni se comprará automáticamente." });
        return;
      }
      const candidate = Array.isArray(preview.products) ? preview.products[0] : null;
      if (!candidate) {
        setImportFeedback({ ok: false, message: "El proveedor no devolvió un producto válido." });
        toast.error("No se pudo detectar el producto en esa URL");
        return;
      }
      const automaticImages = Array.isArray(candidate.images) && candidate.images.length > 0
        ? candidate.images : candidate.image ? [candidate.image] : [];
      if (!automaticImages.length) {
        setManualImport({
          url: candidate.productUrl || url,
          sourceHost: normalizedSupplierDomain(candidate.sourceHost || new URL(url).hostname),
          reason: "La página no proporcionó ninguna fotografía válida. Completa y verifica el borrador manualmente.",
        });
        setManualName(String(candidate.name || ""));
        setImportFeedback({ ok: false, message: "No se ha guardado una importación incompleta. Revisa nombre, coste e imagen." });
        return;
      }
      setImportFeedback({ ok: true, message: "Producto encontrado: " + candidate.name + ". Guardando borrador…" });
      try {
        await saveImportedCandidate(candidate, false);
      } catch (saveError: any) {
        const message = String(saveError?.message || "");
        if (!/copiar ninguna imagen|copiar las imágenes|cloudflare r2/i.test(message)) throw saveError;
        setManualImport({
          url: candidate.productUrl || url,
          sourceHost: normalizedSupplierDomain(candidate.sourceHost || new URL(url).hostname),
          reason: "Detectamos el producto, pero el proveedor impidió guardar sus fotografías en la biblioteca. Puedes completar un borrador manual.",
        });
        setManualName(String(candidate.name || ""));
        setImportFeedback({ ok: false, message: "Las imágenes no se pudieron guardar. Revisa el borrador manual antes de publicarlo." });
      }
    } catch (error: any) {
      const message = String(error?.message || "No se pudo importar el producto desde esa URL");
      setImportFeedback({ ok: false, message });
      toast.error(message);
    } finally {
      setImportingUrl(false);
    }
  };

  const saveManualImport = async () => {
    if (!manualImport || !manualName.trim()) return toast.error("Escribe el nombre del producto");
    if (/^(human verification|human machine check|verify you are human|just a moment|access denied|security verification|captcha)(?:\b|[\s.:|—-])/i.test(manualName.trim())) {
      return toast.error("Esa es una página de verificación del proveedor, no un producto");
    }
    const amount = Number(manualCost);
    if (manualCost.trim() && (!Number.isFinite(amount) || amount < 0)) return toast.error("Revisa el coste del proveedor");
    if (manualImageUrl.trim()) {
      try {
        const media = new URL(manualImageUrl.trim());
        if (!["http:", "https:"].includes(media.protocol)) throw new Error("protocol");
      } catch { return toast.error("La URL de la imagen no es válida"); }
    }
    if (manualUploading) return toast.warning("Espera a que las fotografías terminen de guardarse.");
    setImportingUrl(true);
    try {
      await saveImportedCandidate({
        name: manualName.trim(),
        productUrl: manualImport.url,
        sourceCatalogUrl: manualImport.url,
        sourceHost: manualImport.sourceHost,
        supplierPrice: Number.isFinite(amount) && amount > 0 ? amount : 0,
        supplierCurrency: manualCurrency,
        description: "",
        images: [...new Set([...manualUploadedImages, ...(manualImageUrl.trim() ? [manualImageUrl.trim()] : [])])],
        manualImport: true,
      }, true);
    } catch (error: any) {
      setImportFeedback({ ok: false, message: String(error?.message || "No se pudo guardar el borrador manual") });
      toast.error(error?.message || "No se pudo guardar el borrador manual");
    } finally {
      setImportingUrl(false);
    }
  };

  const updateSupplierHubItems = async (ids: string[], action: "hide" | "show" | "unlink" | "archive") => {
    if (bulkImportBusy || !ids.length) return;
    const items = importedProducts.filter((product: any) => ids.includes(String(product.id)) && !suspiciousImportedProduct(product));
    if (!items.length) return toast.error("No hay productos seleccionados.");
    const warnings: Record<typeof action, string> = {
      hide: "Ocultar en Proveedores NO elimina ni despublica los productos.",
      show: "Volverán a mostrarse en Proveedores.",
      unlink: "Se quitará la asociación de proveedor para futuras operaciones. Los pedidos existentes requieren revisión por separado.",
      archive: "ENVIAR A PAPELERA también retira estos productos del catálogo de venta. Los pedidos históricos se conservarán.",
    };
    if (!window.confirm(`${action === "archive" ? "ATENCIÓN: " : ""}${items.length} productos. ${warnings[action]} ¿Continuar?`)) return;
    setBulkImportBusy(true);
    let completed = 0;
    let errors = 0;
    try {
      for (const product of items) {
        try {
          if (action === "archive") {
            await backendApi.deleteCommerceProduct(product.id, false);
          } else {
            const metadata = product.metadata && typeof product.metadata === "object" ? product.metadata : {};
            const patch = action === "unlink"
              ? { ...metadata, supplierId: null, fulfillmentMode: "manual", supplierVariantId: "", supplierSku: "", supplierAssignedAt: null }
              : { ...metadata, supplierHubHidden: action === "hide" };
            await backendApi.updateCommerceProduct(product.id, { metadata: patch });
          }
          completed += 1;
        } catch { errors += 1; }
      }
      setSelectedImportIds([]);
      await load();
      if (errors) toast.warning(`${completed} actualizados; ${errors} errores. Revisa la selección antes de reintentar.`);
      else toast.success(`${completed} productos actualizados. ${action === "hide" ? "Siguen disponibles en Productos." : ""}`);
    } finally {
      setBulkImportBusy(false);
    }
  };

  const assignDropship = async (
    product: any,
    supplierId: string,
    mode: SupplierMode,
    supplierCost: number,
    supplierVariantId = "",
    supplierSku = "",
    cjPreferredLogisticName = "",
    cjProfitabilityQuote: any = null
  ) => {
    if (!supplierId) return toast.error("Selecciona un proveedor");
    const supplier = suppliers.find((entry: any) => String(entry.id) === String(supplierId));
    if (!supplier) return toast.error("Proveedor no encontrado");
    const isAliExpress = normalizedSupplierDomain(sourceHostFromProduct(product)) === "aliexpress.com" ||
      normalizedSupplierDomain(String(supplier.sourceHost || "")) === "aliexpress.com";
    if (mode === "autopilot" && (isAliExpress || !["cj", "webhook"].includes(String(supplier.integrationType || "")))) {
      return toast.error("No hay integración de pedidos automática para este proveedor. Conecta el producto en modo Manual.");
    }

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
          cjPreferredLogisticName: String(cjPreferredLogisticName || "").trim().slice(0, 120),
          cjPreferredLogisticCountry: cjPreferredLogisticName ? "ES" : "",
          cjPreferredLogisticUpdatedAt: cjPreferredLogisticName ? new Date().toISOString() : "",
          // Advisory quote only. Neither the quotation nor its presence authorizes payment.
          cjPricingEstimate: cjProfitabilityQuote?.available &&
            cjProfitabilityQuote?.methodName === cjPreferredLogisticName &&
            cjProfitabilityQuote?.vid === String(supplierVariantId || "").trim()
            ? cjProfitabilityQuote
            : (metadata.cjPricingEstimate?.vid === String(supplierVariantId || "").trim() &&
               metadata.cjPricingEstimate?.methodName === cjPreferredLogisticName
                ? metadata.cjPricingEstimate : null),
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
    if (syncingPaidOrders) return;
    const candidates = orders.filter((order: any) =>
      ["paid", "confirmed", "preparing", "processing", "ready"].includes(String(order.status || ""))
    );
    if (!candidates.length) return toast.info("No hay pedidos pagados pendientes de preparar");
    setSyncingPaidOrders(true);
    try {
      let prepared = 0;
      let errors = 0;
      for (const order of candidates.slice(0, 100)) {
        try {
          const result = await backendApi.prepareSupplierFulfillments(String(order.id), true);
          prepared += Array.isArray(result.fulfillments) ? result.fulfillments.length : 0;
        } catch {
          errors += 1;
        }
      }
      await load();
      if (errors) toast.warning(`Cola actualizada: ${prepared} preparaciones y ${errors} pedidos con incidencia`);
      else toast.success(`Cola actualizada: ${prepared} preparaciones de proveedor`);
    } finally {
      setSyncingPaidOrders(false);
    }
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

  const openCjApproval = async (fulfillment: any, action: "create" | "pay") => {
    if (cjApprovalLoadingId) return;
    setCjApprovalLoadingId(String(fulfillment.id));
    try {
      const preview = await backendApi.getCjManualApprovalPreview(String(fulfillment.id));
      setCjApprovalPreview(preview);
      setCjApprovalAction(action);
      setCjApprovalConfirmation("");
      setCjMerchantPaysAcknowledged(false);
      const amount = action === "create" ? preview.estimatedSupplierTotalUsd : preview.providerActualPaymentUsd;
      setCjApprovalMaxUsd(Number(amount || 0).toFixed(2));
    } catch (error: any) {
      toast.error(error?.message || "No se pudo preparar la autorización CJ");
    } finally {
      setCjApprovalLoadingId("");
    }
  };

  const submitCjApproval = async () => {
    if (!cjApprovalPreview || !cjApprovalAction || cjApprovalSubmitting) return;
    setCjApprovalSubmitting(true);
    try {
      const request = {
        snapshot: cjApprovalPreview.snapshot,
        confirmation: cjApprovalConfirmation,
        approvedMaxUsd: Number(cjApprovalMaxUsd),
        acknowledgeMerchantPays: cjMerchantPaysAcknowledged,
      };
      const result = cjApprovalAction === "create"
        ? await backendApi.createUnpaidCjOrder(cjApprovalPreview.fulfillmentId, request)
        : await backendApi.payApprovedCjOrder(cjApprovalPreview.fulfillmentId, request);
      setFulfillments((list) => list.map((item) =>
        String(item.id) === String(result.fulfillment.id) ? result.fulfillment : item));
      toast.success(cjApprovalAction === "create"
        ? "Pedido creado en CJ SIN pagar. Revisa el importe antes de autorizar el pago."
        : "Pago confirmado por CJ. Estado de proveedor actualizado.");
      setCjApprovalAction(null);
      setCjApprovalPreview(null);
      await load();
    } catch (error: any) {
      toast.error(error?.message || "CJ requiere revisar este pedido");
      // A timeout may mean CJ received the action. Refresh from the server;
      // never automatically repeat an ambiguous create or balance payment.
      await load();
    } finally {
      setCjApprovalSubmitting(false);
    }
  };

  const reconcileCjOrder = async (fulfillment: any) => {
    if (processingId) return;
    setProcessingId(String(fulfillment.id));
    try {
      const result = await backendApi.reconcileCjManualOrder(String(fulfillment.id));
      if (result.found && result.fulfillment) {
        setFulfillments((current) => current.map((item) =>
          String(item.id) === String(result.fulfillment.id) ? result.fulfillment : item));
        if (result.error) toast.warning(result.error);
        else toast.success(result.paid
          ? "CJ ha confirmado que el pedido está pagado."
          : "Pedido localizado en CJ. Sigue pendiente de autorización de pago.");
      } else {
        toast.warning(result.error || "No hay coincidencia confirmada en CJ. No vuelvas a crear el pedido.");
      }
      await load();
    } catch (error: any) {
      toast.error(error?.message || "CJ no ha permitido conciliar este pedido");
      await load();
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

  const checkCjAccountOrders = async () => {
    if (cjOrderAuditLoading) return;
    setCjOrderAuditLoading(true);
    try {
      const audit = await backendApi.auditCjAccountOrders();
      setCjOrderAudit(audit);
      if (audit.failedStatuses?.length) {
        toast.warning("Consulta CJ parcial: algunos estados no se pudieron comprobar");
      } else {
        toast.success("Pedidos CJ consultados sin realizar ninguna compra");
      }
    } catch (error: any) {
      toast.error(error?.message || "CJ no ha respondido a la consulta de pedidos");
    } finally {
      setCjOrderAuditLoading(false);
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
          onChange={(e) => { setImportUrl(e.target.value); setManualImport(null); setManualName(""); setManualCost(""); setManualImageUrl(""); }}
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
      {manualImport && (
        <div className="mt-4 space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Este proveedor no permite leer su ficha automáticamente</p>
          <p>{manualImport.reason}</p>
          <p>Guardaremos un borrador privado: no se publica, no se compra ni se sincroniza con el proveedor hasta que lo revises.</p>
          <a href={manualImport.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline"><ExternalLink className="h-4 w-4"/>Abrir ficha original del proveedor</a>
          <div className="grid gap-3 md:grid-cols-2">
            <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Nombre del producto (obligatorio)" aria-label="Nombre del producto" className="rounded-lg border border-amber-200 bg-white p-3" />
            <input value={manualCost} onChange={(e) => setManualCost(e.target.value)} type="number" min="0" step="0.01" placeholder="Coste del proveedor (opcional)" aria-label="Coste del proveedor" className="rounded-lg border border-amber-200 bg-white p-3" />
            <select value={manualCurrency} onChange={(e) => setManualCurrency(e.target.value)} aria-label="Moneda del proveedor" className="rounded-lg border border-amber-200 bg-white p-3">
              <option value="EUR">EUR — Euro</option><option value="USD">USD — Dólar</option><option value="CNY">CNY — Yuan</option><option value="GBP">GBP — Libra</option>
            </select>
            <input value={manualImageUrl} onChange={(e) => setManualImageUrl(e.target.value)} type="url" placeholder="URL de imagen (opcional)" aria-label="URL de imagen" className="rounded-lg border border-amber-200 bg-white p-3" />
          </div>
          {manualImageUrl.trim() && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-white p-2">
              <img src={manualImageUrl.trim()} alt="Vista previa de la imagen indicada" referrerPolicy="no-referrer" className="h-20 w-20 rounded-md object-contain" />
              <span className="text-xs">Verifica que aparece la foto real del producto y no un CAPTCHA ni un logotipo.</span>
            </div>
          )}
          <SupplierImportImages images={manualUploadedImages} onChange={setManualUploadedImages} onBusyChange={setManualUploading} disabled={importingUrl}/>
          <button type="button" disabled={importingUrl || manualUploading || !manualName.trim()} onClick={() => void saveManualImport()} className="rounded-lg bg-amber-900 px-4 py-3 font-semibold text-white disabled:opacity-50">{importingUrl ? "Guardando…" : manualUploading ? "Copiando fotos…" : (manualUploadedImages.length || manualImageUrl.trim()) ? "Guardar borrador con fotos" : "Guardar borrador SIN fotos"}</button>
          <p className="text-xs font-semibold">Si dejas la imagen vacía, el borrador quedará SIN FOTO. Abre la ficha original, haz clic derecho sobre la fotografía → «Copiar dirección de imagen» y pega esa URL arriba. Herencia intentará copiarla a la biblioteca. Si la foto está protegida, súbela manualmente después. No habilita la compra automática.</p>
        </div>
      )}
      {importFeedback && <p role="status" className={`mt-3 rounded-xl border p-3 text-sm ${importFeedback.ok ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"}`}>{importFeedback.message}</p>}
      {savedImport && (
        <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-4" role="status">
          <p className="font-bold text-foreground">
            {savedImport.outcome === "archived" ? "Producto localizado en la Papelera" :
              savedImport.outcome === "existing" ? "Producto ya existente, localizado" :
              savedImport.outcome === "updated" ? "Borrador actualizado y verificado" : "Borrador guardado y verificado"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{savedImport.name} · ID: {savedImport.id} · Estado: {savedImport.status}</p>
          <button type="button" onClick={() => onOpenProduct(savedImport.id)}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">
            <PackagePlus className="h-4 w-4" />{savedImport.outcome === "archived" ? "Abrir en Papelera" : "Ver y editar este producto"}
          </button>
        </div>
      )}
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
      <h2 className="text-xl font-bold">Vincular un producto que ya existe</h2>
      <p className="mt-1 text-sm text-muted-foreground">Recupera la conexión con CJdropshipping sin duplicar el artículo ni cambiar su precio, fotografías o estado publicado.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-semibold">Buscar artículo del catálogo</label>
          <input value={existingSearch} onChange={(event) => { setExistingSearch(event.target.value); setExistingProductId(""); }} placeholder="Por ejemplo: Garden irrigation controller" className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"/>
          <select value={existingProductId} onChange={(event) => {
            const id = event.target.value;
            setExistingProductId(id);
            const current = products.find((item: any) => String(item.id) === id);
            setExistingProductUrl(String(current?.metadata?.sourceProductUrl || ""));
          }} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
            <option value="">Selecciona el producto existente</option>
            {existingMatches.map((item: any) => <option key={item.id} value={String(item.id)}>{item.name} · {money(Number(item.price || 0))}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold">URL original del producto en CJdropshipping</label>
          <input type="url" value={existingProductUrl} onChange={(event) => setExistingProductUrl(event.target.value)} placeholder="https://www.cjdropshipping.com/product/..." className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"/>
          <p className="text-xs text-muted-foreground">Solo vincula productos de proveedores ya registrados. El precio de CJ, los envíos y las variantes se revisan después.</p>
        </div>
      </div>
      {selectedExistingProduct && <div className="mt-3 flex items-center gap-3 rounded-xl bg-muted/50 p-3 text-sm">
        {selectedExistingProduct.image && <img src={selectedExistingProduct.image} alt="" className="h-12 w-12 rounded-lg object-cover"/>}
        <div>
          <p className="font-semibold">{selectedExistingProduct.name}</p>
          <p className="text-xs text-muted-foreground">Precio actual: {money(Number(selectedExistingProduct.price || 0))} · {selectedExistingProduct.status === "active" ? "Publicado" : "Borrador"} · Se mantendrá sin cambios</p>
        </div>
      </div>}
      <button disabled={linkingExisting || !existingProductId || !existingProductUrl.trim()} onClick={() => void linkExistingProduct()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
        <Link2 className="h-4 w-4"/>{linkingExisting ? "Vinculando…" : "Vincular producto existente"}
      </button>
    </section>

    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Productos vinculados a proveedores</h2>
          <p className="text-sm text-muted-foreground">Oculta, vincula, desvincula o envía a papelera sin mezclar los proveedores. La lista empieza cerrada para no saturar el panel.</p>
          <p className="mt-1 text-xs text-muted-foreground">Pendientes: {importCounts.pending} · Conectados: {importCounts.connected} · Ocultos: {importCounts.hidden} · Sospechosos: {suspectImports.length}</p>
        </div>
        <button type="button" onClick={() => { setShowImportedProducts(v => !v); setSelectedImportIds([]); }}
          className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold">
          {showImportedProducts ? "Ocultar lista de productos" : "Mostrar y gestionar productos"}
        </button>
      </div>
      {showImportedProducts && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar productos por estado de proveedor">
            {([
              ["pending", "Pendientes", importCounts.pending],
              ["connected", "Conectados", importCounts.connected],
              ["hidden", "Ocultos", importCounts.hidden],
            ] as const).map(([tab, label, count]) => (
              <button type="button" key={tab}
                onClick={() => { setImportTab(tab); setSelectedImportIds([]); }}
                aria-pressed={importTab === tab}
                className={`rounded-xl px-3 py-2 text-sm font-bold ${importTab === tab ? "bg-primary text-primary-foreground" : "border border-border bg-background"}`}>
                {label} ({count})
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-muted/20 p-3">
            <input value={importSearch} onChange={event => setImportSearch(event.target.value)}
              placeholder="Buscar producto, SKU o URL" aria-label="Buscar productos importados"
              className="min-w-[160px] flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm"/>
            <select value={sourceFilter} onChange={event => { setSourceFilter(event.target.value); setSelectedImportIds([]); }}
              aria-label="Filtrar proveedor por dominio" className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
              <option value="all">Todos los proveedores</option>
              {availableSourceHosts.map(host => <option key={host} value={host.toLowerCase()}>{host}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyCjImports} onChange={event => setOnlyCjImports(event.target.checked)}/>
              Solo CJdropshipping
            </label>
            <span className="self-center text-xs text-muted-foreground">{visibleImports.length} resultados</span>
          </div>
          {suspectImports.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {suspectImports.length} importaciones sospechosas (páginas de verificación) excluidas. No se borran sin tu permiso.
              <button type="button" className="ml-2 font-bold underline" onClick={() => setShowSuspectImports(v => !v)}>
                {showSuspectImports ? "Ocultar" : "Ver nombres"}
              </button>
              {showSuspectImports && <p className="mt-2 text-xs">{suspectImports.map(item => item.name).slice(0, 20).join(" · ")}</p>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" disabled={bulkImportBusy || !visibleImports.length}
                checked={visibleImports.length > 0 && visibleImports.every(product => selectedImportIds.includes(String(product.id)))}
                onChange={event => setSelectedImportIds(event.target.checked ? visibleImports.map(product => String(product.id)) : [])}/>
              Seleccionar visibles ({selectedImportIds.length})
            </label>
            {selectedImportIds.length > 0 && (
              <>
                <button type="button" disabled={bulkImportBusy} onClick={() => void updateSupplierHubItems(selectedImportIds, "hide")}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-bold"><EyeOff className="h-4 w-4"/>Ocultar</button>
                <button type="button" disabled={bulkImportBusy} onClick={() => void updateSupplierHubItems(selectedImportIds, "show")}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-bold"><Eye className="h-4 w-4"/>Mostrar</button>
                <button type="button" disabled={bulkImportBusy} onClick={() => void updateSupplierHubItems(selectedImportIds, "unlink")}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-bold"><Unlink2 className="h-4 w-4"/>Desvincular</button>
                <button type="button" disabled={bulkImportBusy} onClick={() => void updateSupplierHubItems(selectedImportIds, "archive")}
                  className="inline-flex items-center gap-1 rounded-lg border border-destructive/50 px-3 py-2 text-xs font-bold text-destructive"><Trash2 className="h-4 w-4"/>Papelera</button>
              </>
            )}
          </div>
          <div className="space-y-3">
            {visibleImports.length === 0 ? <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">No hay productos en este filtro. Puedes cambiar de pestaña o proveedor.</p> :
              visibleImports.slice(0, 50).map((product: any) => (
                <div key={product.id} className="flex items-start gap-2">
                  <input type="checkbox" className="mt-5 h-4 w-4 shrink-0"
                    checked={selectedImportIds.includes(String(product.id))}
                    onChange={event => setSelectedImportIds(current => event.target.checked ? [...new Set([...current, String(product.id)])] : current.filter(id => id !== String(product.id)))}/>
                  <div className="min-w-0 flex-1">
                    <ImportedProductRow product={product} suppliers={suppliers}
                      saving={bulkImportBusy || savingProductId === String(product.id)}
                      onSave={assignDropship}/>
                    <div className="mt-1 flex flex-wrap gap-2 px-2">
                      <button type="button" disabled={bulkImportBusy} className="text-xs underline"
                        onClick={() => void updateSupplierHubItems([String(product.id)], importTab === "hidden" ? "show" : "hide")}>
                        {importTab === "hidden" ? "Mostrar en Proveedores" : "Ocultar de esta lista"}
                      </button>
                      <button type="button" className="text-xs underline" onClick={() => onOpenProduct(String(product.id))}>Editar en catálogo</button>
                    </div>
                  </div>
                </div>
              ))}
            {visibleImports.length > 50 && <p className="text-xs text-muted-foreground">Mostrando 50 de {visibleImports.length}. Usa el buscador o filtra por proveedor.</p>}
          </div>
        </div>
      )}
    </section>

    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold">Pedidos CJ: comprobar cuenta real</h2>
          <p className="mt-1 text-sm text-muted-foreground">Consulta los estados de CJ mediante su API. Solo lectura: no se crean, confirman ni pagan pedidos. La búsqueda puede tardar unos segundos por los límites de CJ.</p>
        </div>
        <button type="button" disabled={cjOrderAuditLoading || !cjConfigured} onClick={() => void checkCjAccountOrders()}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 font-semibold disabled:opacity-50">
          <RefreshCw className={"h-4 w-4" + (cjOrderAuditLoading ? " animate-spin" : "")}/>
          {cjOrderAuditLoading ? "Consultando CJ…" : "Comprobar pedidos en CJ"}
        </button>
      </div>
      {cjOrderAudit && <div className="mt-4 space-y-3 text-sm">
        <p className="font-semibold">Última consulta: {new Date(cjOrderAudit.checkedAt).toLocaleString("es-ES")} · {cjOrderAudit.checkedStatuses}/7 estados consultados</p>
        <div className="flex flex-wrap gap-2">
          {(cjOrderAudit.statusSummary || []).map((entry: any) =>
            <span key={entry.status} className="rounded-lg bg-muted px-3 py-2 text-xs font-semibold">{entry.status}: {entry.total == null ? "sin recuento" : entry.total}</span>)}
        </div>
        {(cjOrderAudit.failedStatuses || []).length > 0 &&
          <p className="rounded-lg bg-amber-50 p-3 font-semibold text-amber-800">Consulta incompleta: {(cjOrderAudit.failedStatuses || []).map((x: any) => x.status).join(", ")}. No interpretes los resultados como ausencia de pedidos.</p>}
        {cjOrderAudit.incomplete && <p className="rounded-lg bg-amber-50 p-3 text-amber-900">{cjOrderAudit.warning}</p>}
        {(cjOrderAudit.cjOrders || []).length > 0
          ? <div className="space-y-2">{cjOrderAudit.cjOrders.map((entry: any) =>
              <div key={entry.cjOrderId || entry.orderNumber} className="rounded-lg border border-border p-3">
                <p className="font-semibold">CJ {entry.cjOrderId || "sin ID"} · {entry.status}</p>
                <p className="text-xs">Referencia: {entry.orderNumber || "No disponible"} · {entry.amountUsd == null ? "Importe sin confirmar" : "$" + Number(entry.amountUsd).toFixed(2) + " USD"}</p>
                <p className="text-xs">{entry.localOrderId ? "Pedido Herencia #" + String(entry.localOrderId).slice(0, 8) : "Sin vínculo confirmado en la cola de Herencia"}</p>
              </div>)}</div>
          : <p className="text-sm text-muted-foreground">No se observaron pedidos Herencia en las páginas consultadas de CJ. Esto no demuestra que no existan pedidos antiguos.</p>}
        <div className="space-y-1">
          <p className="font-semibold">Comparación con la cola de Herencia</p>
          {(cjOrderAudit.localQueue || []).slice(0, 30).map((entry: any) =>
            <p key={entry.fulfillmentId} className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
              Pedido #{String(entry.orderId).slice(0, 8)} · {entry.status} · {money(entry.estimatedCostEur)} estimados ·
              {entry.cjDetectedInPages ? " encontrado en CJ (" + entry.cjOrderStatus + ")" : " sin coincidencia en las páginas consultadas"}
            </p>)}
        </div>
      </div>}
    </section>

    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold">Cola de pedidos a proveedores</h2>
          <p className="text-sm text-muted-foreground">Los pedidos pagados y gratuitos se preparan para revisión. Sincronizar actualiza presupuestos pendientes sin volver a comprar pedidos enviados.</p>
        </div>
        <button disabled={syncingPaidOrders} onClick={() => void syncPaidOrders()} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 font-semibold disabled:opacity-50">
          <RefreshCw className={"h-4 w-4" + (syncingPaidOrders ? " animate-spin" : "")}/>{syncingPaidOrders ? "Actualizando cola…" : "Sincronizar pedidos pagados"}
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {!fulfillments.length ? <p className="text-sm text-muted-foreground">No hay compras de proveedor preparadas todavía.</p> :
          fulfillments.slice(0, 200).map((item: any) => {
            const canRunAuto = item.mode === "autopilot" && ["autopilot_ready","approval_required","connector_required","cost_required","mapping_required","address_required","payment_required","action_required"].includes(String(item.status || ""));
            const sourceUrl = item.items?.[0]?.sourceProductUrl || "";
            const isCjFulfillment = item.provider === "cj" ||
              suppliers.some((supplier: any) => String(supplier.id) === String(item.supplierId) && supplier.integrationType === "cj");
            const estimate = item.items?.[0]?.cjPricingEstimate;
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
                  {isCjFulfillment ? <div className="mt-1 space-y-1 text-xs">
                    <p className="font-semibold">CJ: {item.items?.[0]?.cjPreferredLogisticName || "Transportista pendiente"} · {item.items?.[0]?.supplierVariantId ? "VID vinculado" : "VID pendiente"}</p>
                    {estimate?.available ? <p className={"font-semibold " + (estimate.feasible ? "text-emerald-700" : "text-red-700")}>Rentabilidad estimada (IVA y comisiones): {money(estimate.estimatedProfitEur)} € · margen {Number(estimate.estimatedMarginPercent).toFixed(1)}% · cotización {String(estimate.checkedAt || "").slice(0,10)}</p>
                    : <p className="font-semibold text-amber-800">Falta cotización CJ reciente con gastos de envío e IVA.</p>}
                  </div> : Number(item.estimatedCost || 0) > 0 && Number(item.revenue || 0) > 0 && <p className="mt-1 text-xs font-semibold text-muted-foreground">Venta: {money(item.revenue)} · coste: {money(item.estimatedCost)} · margen: {Number(item.grossMarginPercent || 0).toFixed(1)}%</p>}
                  {item.blocker && <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{item.blocker}</p>}
                  {item.trackingNumber && <p className="mt-2 text-sm">Tracking: <strong>{item.trackingNumber}</strong></p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {sourceUrl && <button onClick={() => window.open(sourceUrl, "_blank", "noopener,noreferrer")} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold"><ExternalLink className="h-4 w-4"/>Proveedor</button>}
                  {item.mode === "manual" && !["ordered","shipped","delivered"].includes(String(item.status || "")) && <button disabled={processingId===String(item.id)} onClick={() => void executeFulfillment(item)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><MousePointerClick className="h-4 w-4"/>Preparar compra</button>}
                  {isCjFulfillment && !["ordered","shipped","delivered","closed","cancelled","canceled"].includes(String(item.status || "")) &&
                    <button type="button" disabled={cjApprovalLoadingId === String(item.id)}
                      onClick={() => void openCjApproval(item, item.status === "payment_required" ? "pay" : "create")}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-50">
                      <ShieldCheck className="h-4 w-4"/>
                      {cjApprovalLoadingId === String(item.id) ? "Comprobando CJ…" :
                        item.status === "payment_required" ? "Revisar y autorizar pago CJ" :
                        ["cj_creation_unknown", "cj_payment_unknown", "cj_creating", "cj_paying"].includes(String(item.status)) ? "Revisar bloqueo CJ" :
                        "Revisar aprobación CJ"}
                    </button>}
                  {isCjFulfillment && ["cj_creation_unknown","cj_payment_unknown","payment_required"].includes(String(item.status || "")) &&
                    <button type="button" disabled={processingId === String(item.id)} onClick={() => void reconcileCjOrder(item)}
                      className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50">
                      <RefreshCw className="h-4 w-4"/>{processingId === String(item.id) ? "Consultando CJ…" : "Conciliar con CJ (sin comprar)"}
                    </button>}
                  {canRunAuto && !isCjFulfillment && <button disabled={processingId===String(item.id)} onClick={() => void executeFulfillment(item)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Play className="h-4 w-4"/>{isCjFulfillment ? "Revisar CJ (sin comprar)" : "Ejecutar Autopilot"}</button>}
                  {!isCjFulfillment && ["manual_purchase_required","autopilot_ready","connector_required","approval_required","action_required","cost_required"].includes(String(item.status || "")) && <button onClick={() => void markOrdered(item)} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4"/>Marcar comprado</button>}
                  {!isCjFulfillment && ["ordered","shipped"].includes(String(item.status || "")) && <button onClick={() => void addTracking(item)} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold"><Truck className="h-4 w-4"/>Tracking</button>}
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

    {cjApprovalPreview && cjApprovalAction && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="cj-manual-dialog-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h3 id="cj-manual-dialog-title" className="text-xl font-bold">
            {cjApprovalAction === "create" ? "Crear pedido CJ SIN pagar" : "Autorizar pago real al proveedor CJ"}
          </h3>
          <button type="button" disabled={cjApprovalSubmitting} onClick={() => { setCjApprovalAction(null); setCjApprovalPreview(null); }}
            className="rounded-lg border px-3 py-2 text-sm font-semibold">Cerrar</button>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">Pedido Herencia #{String(cjApprovalPreview.orderId).slice(0, 8)}. Son dos decisiones distintas: primero crear en CJ sin pagar, después autorizar el pago.</p>
        <div className="space-y-2 rounded-xl border border-border p-4 text-sm">
          <p><strong>Cliente pagó:</strong> {cjApprovalPreview.customerTotalEur == null ? "No verificado" : money(cjApprovalPreview.customerTotalEur)}</p>
          <p><strong>Coste proveedor estimado:</strong> {money(cjApprovalPreview.estimatedSupplierCostEur)}</p>
          <p><strong>CJ presupuestado:</strong> {"$"}{Number(cjApprovalPreview.estimatedSupplierTotalUsd).toFixed(2)} USD</p>
          {cjApprovalAction === "pay" && <p><strong>Importe real CJ a pagar:</strong> {"$"}{Number(cjApprovalPreview.providerActualPaymentUsd).toFixed(2)} USD</p>}
          <p><strong>Límite configurado:</strong> {"$"}{Number(cjApprovalPreview.maxSupplierPaymentUsd).toFixed(2)} USD</p>
          <p><strong>Modo proveedor:</strong> {cjApprovalPreview.sandbox ? "SANDBOX: compras bloqueadas" : "REAL"}</p>
          {cjApprovalPreview.externalOrderId && <p><strong>Pedido CJ:</strong> {cjApprovalPreview.externalOrderId}</p>}
        </div>
        {cjApprovalPreview.merchantFunded && <label className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          <input type="checkbox" checked={cjMerchantPaysAcknowledged} onChange={(event) => setCjMerchantPaysAcknowledged(event.target.checked)}
            className="mt-1 h-4 w-4" />
          Acepto expresamente que Herencia asume el coste de este pedido con descuento o cupón, aunque el cliente haya pagado 0,00 €.
        </label>}
        <label className="mt-4 block text-sm font-semibold">
          Límite máximo que autorizas para esta operación (USD)
          <input type="number" min="0.01" step="0.01" max={cjApprovalPreview.maxSupplierPaymentUsd}
            value={cjApprovalMaxUsd} onChange={(event) => setCjApprovalMaxUsd(event.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-base" />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Escribe exactamente <code className="rounded bg-muted px-1">{cjApprovalAction === "create" ? cjApprovalPreview.createConfirmation : cjApprovalPreview.paymentConfirmation}</code>
          <input type="text" autoComplete="off" value={cjApprovalConfirmation} onChange={(event) => setCjApprovalConfirmation(event.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-base" placeholder="Confirmación de administrador" />
        </label>
        {((cjApprovalAction === "create" && !cjApprovalPreview.canCreate) || (cjApprovalAction === "pay" && !cjApprovalPreview.canPay)) &&
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            {cjApprovalAction === "create" ? cjApprovalPreview.creationReason : cjApprovalPreview.paymentReason}
            {" "}No se enviará ninguna compra ni pago mientras esté bloqueado.
          </p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" disabled={cjApprovalSubmitting} onClick={() => { setCjApprovalAction(null); setCjApprovalPreview(null); }}
            className="rounded-xl border border-border px-4 py-2 font-semibold">Cancelar</button>
          <button type="button" disabled={
            cjApprovalSubmitting ||
            (cjApprovalAction === "create" ? !cjApprovalPreview.canCreate : !cjApprovalPreview.canPay) ||
            cjApprovalConfirmation !== (cjApprovalAction === "create" ? cjApprovalPreview.createConfirmation : cjApprovalPreview.paymentConfirmation) ||
            (cjApprovalPreview.merchantFunded && !cjMerchantPaysAcknowledged) ||
            !(Number(cjApprovalMaxUsd) > 0) ||
            Number(cjApprovalMaxUsd) > cjApprovalPreview.maxSupplierPaymentUsd ||
            Number(cjApprovalMaxUsd) < (cjApprovalAction === "create" ? cjApprovalPreview.estimatedSupplierTotalUsd : cjApprovalPreview.providerActualPaymentUsd)
          } onClick={() => void submitCjApproval()}
            className="rounded-xl bg-emerald-800 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {cjApprovalSubmitting ? "Confirmando…" : cjApprovalAction === "create" ? "Confirmar creación SIN pagar" : "Confirmar PAGO real en CJ"}
          </button>
        </div>
      </div>
    </div>}
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
    supplierSku?: string,
    cjPreferredLogisticName?: string,
    cjProfitabilityQuote?: any
  ) => Promise<void>;
}) {
  const metadata = product?.metadata && typeof product.metadata === "object" ? product.metadata : {};
  const [supplierId, setSupplierId] = useState(String(metadata.supplierId || ""));
  const [mode, setMode] = useState<SupplierMode>(metadata.fulfillmentMode === "autopilot" ? "autopilot" : "manual");
  const [cost, setCost] = useState(Number(metadata.supplierCost || 0));
  const [supplierVariantId, setSupplierVariantId] = useState(String(metadata.supplierVariantId || metadata.cjVid || ""));
  const [supplierSku, setSupplierSku] = useState(String(metadata.supplierSku || metadata.cjSku || ""));
  const [cjVariants, setCjVariants] = useState<Array<{ vid: string; sku: string; name: string; option: string; priceUsd: number | null; image: string }>>([]);
  const [cjLoading, setCjLoading] = useState(false);
  const [cjLookupError, setCjLookupError] = useState("");
  const [cjLookupComplete, setCjLookupComplete] = useState(false);
  const [freightQuote, setFreightQuote] = useState<any>(null);
  const [freightLoading, setFreightLoading] = useState(false);
  const [freightError, setFreightError] = useState("");
  const [preflight, setPreflight] = useState<any>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [selectedFreightName, setSelectedFreightName] = useState(String(metadata.cjPreferredLogisticName || ""));
  const sourceUrl = String(metadata.sourceProductUrl || "");
  const sourceHost = sourceHostFromProduct(product);
  const supplierCurrency = String(metadata.supplierCurrency || "EUR").toUpperCase();
  const originalSupplierPrice = Number(metadata.supplierOriginalPrice || metadata.supplierCost || 0);
  const salePrice = Number(product.onSale && product.salePrice ? product.salePrice : product.price || 0);
  const grossMargin = salePrice > 0 && cost > 0 ? salePrice - cost : 0;
  const grossPercent = salePrice > 0 && cost > 0 ? (grossMargin / salePrice) * 100 : 0;

  const selectedSupplier = suppliers.find((supplier:any)=>String(supplier.id)===String(supplierId));
  const isCjSupplier = selectedSupplier?.integrationType === "cj";
  const isCjProduct = sourceHost.toLowerCase().endsWith("cjdropshipping.com");
  const selectedCjVariant = cjVariants.find((variant) => variant.vid === supplierVariantId);
  const chosenFreight = freightQuote?.methods?.find((item: any) => item.name === selectedFreightName);
  const profitability = chosenFreight?.profitability;
  const quoteForSave = profitability?.available && freightQuote?.fx?.rate
    ? {
        ...profitability, methodName: selectedFreightName,
        vid: supplierVariantId, fx: freightQuote.fx,
        checkedAt: new Date().toISOString(), destination: "ES", origin: "CN", quantity: 1,
      }
    : null;

  const runCjPreflight = async () => {
    setPreflightLoading(true);
    setPreflight(null);
    try {
      setPreflight(await backendApi.preflightCjProduct(String(product.id)));
    } catch (error: any) {
      toast.error(error?.message || "No se pudo completar la simulación segura CJ");
    } finally {
      setPreflightLoading(false);
    }
  };

  const quoteShippingToSpain = async () => {
    if (!String(supplierVariantId || "").trim()) return toast.error("Selecciona primero una variante CJ con VID válido");
    setFreightLoading(true);
    setFreightError("");
    setFreightQuote(null);
    try {
      const result = await backendApi.quoteCjProductFreight(String(product.id), String(supplierVariantId).trim());
      setFreightQuote(result);
      if (!result.methods?.length) setFreightError("CJ no ofrece una tarifa para España desde CN. No actives este artículo para envío automático.");
    } catch (error: any) {
      setFreightError(String(error?.message || "CJ no pudo calcular el transporte"));
    } finally {
      setFreightLoading(false);
    }
  };

  const lookupCjVariants = async () => {
    setFreightQuote(null);
    setFreightError("");
    setCjLoading(true);
    setCjLookupError("");
    setCjLookupComplete(false);
    try {
      const result = await backendApi.listCjProductVariants(String(product.id));
      setCjVariants(Array.isArray(result.variants) ? result.variants : []);
      setCjLookupComplete(true);
      if (!result.variants?.length) {
        setCjLookupError("CJ no devolvió variantes disponibles para este producto. Comprueba su disponibilidad en CJ.");
      }
      if (result.truncated) toast.warning("CJ tiene más de 200 variantes: solo se muestran las primeras 200.");
    } catch (error: any) {
      setCjVariants([]);
      setCjLookupError(String(error?.message || "No se pudieron obtener las variantes de CJ"));
    } finally {
      setCjLoading(false);
    }
  };

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
      <option value="autopilot" disabled={normalizedSupplierDomain(sourceHost) === "aliexpress.com" || !["cj", "webhook"].includes(String(selectedSupplier?.integrationType || ""))}>🤖 Autopilot (conector real)</option>
    </select>
    <label className="rounded-xl border border-border px-3 py-2">
      <span className="block text-[11px] font-semibold text-muted-foreground">Coste proveedor (€)</span>
      <input type="number" min="0" step="0.01" value={cost} onChange={(e)=>setCost(Math.max(0,Number(e.target.value||0)))} className="w-full bg-transparent text-sm font-semibold outline-none"/>
    </label>
    <div className="space-y-2 rounded-xl border border-border px-3 py-2">
      <span className="block text-[11px] font-semibold text-muted-foreground">{selectedSupplier?.integrationType === "cj" ? "CJ VID o SKU" : "ID/SKU proveedor"}</span>
      <input value={supplierVariantId} onChange={(e)=>setSupplierVariantId(e.target.value)} placeholder="VID (preferido)" className="w-full bg-transparent text-xs font-semibold outline-none"/>
      <input value={supplierSku} onChange={(e)=>setSupplierSku(e.target.value)} placeholder="SKU proveedor" className="w-full bg-transparent text-xs outline-none"/>
    </div>
    <div className="flex gap-2">
      {sourceUrl && <button onClick={()=>window.open(sourceUrl,"_blank","noopener,noreferrer")} className="rounded-xl border border-border p-3" title="Abrir producto"><ExternalLink className="h-4 w-4"/></button>}
      <button disabled={saving} onClick={()=>void onSave(product,supplierId,mode,cost,supplierVariantId,supplierSku,String(metadata.cjPreferredLogisticName || ""))} className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? "Guardando…" : "Conectar"}</button>
    </div>
    {normalizedSupplierDomain(sourceHost) === "aliexpress.com" && <p className="text-xs font-semibold text-amber-700 xl:col-span-6">AliExpress: enlace guardado para preparación MANUAL. Aún no hay conexión DSers/API para crear, pagar o rastrear pedidos automáticamente.</p>}
    {(isCjSupplier || isCjProduct) && <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 px-3 py-3 text-sm xl:col-span-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold text-emerald-900">Variantes reales de CJdropshipping</p>
          <p className="text-xs text-muted-foreground">Consulta de solo lectura: nunca crea un pedido ni cobra nada.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={cjLoading} onClick={() => void lookupCjVariants()}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-background px-3 py-2 text-xs font-bold disabled:opacity-50">
            <RefreshCw className={"h-4 w-4" + (cjLoading ? " animate-spin" : "")}/>
            {cjLoading ? "Consultando CJ…" : "Consultar variantes CJ"}
          </button>
          <button type="button" disabled={freightLoading || !supplierVariantId.trim()} onClick={() => void quoteShippingToSpain()}
            title={!supplierVariantId.trim() ? "Primero selecciona la variante CJ" : "Consultar tarifas de envío a España sin crear pedidos"}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
            <Truck className="h-4 w-4"/>
            {freightLoading ? "Calculando envío…" : "Consultar envío a España"}
          </button>
          <button type="button" disabled={preflightLoading} onClick={() => void runCjPreflight()}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold disabled:opacity-50">
            <ShieldCheck className="h-4 w-4"/>
            {preflightLoading ? "Comprobando…" : "Simular preparación sin comprar"}
          </button>
        </div>
      </div>
      {preflight && <div className={"rounded-xl border p-3 text-sm " + (preflight.readyForManualReview ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50")}>
        <p className="font-bold">{preflight.readyForManualReview ? "Previsión apta para revisión manual" : "Simulación bloqueada: hay requisitos pendientes"}</p>
        <p className="mt-1 text-xs">{preflight.message}</p>
        {Array.isArray(preflight.checks) && preflight.checks.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
          {preflight.checks.map((issue: string, i: number) => <li key={i}>{issue}</li>)}
        </ul>}
        {preflight.estimate?.estimatedCostEur != null && <p className="mt-2 text-xs font-semibold">Coste estimado: {money(preflight.estimate.estimatedCostEur)} € · Resultado estimado: {money(preflight.estimate.estimatedProfitEur)} €</p>}
        {preflight.queueSimulation && <div className="mt-2 rounded-lg border border-border bg-background/70 p-2 text-xs">
          <p className="font-bold">Prueba del motor real de preparación: {fulfillmentBadge(preflight.queueSimulation.status)}</p>
          <p>Artículos procesados: {preflight.queueSimulation.itemCount} · Coste estimado: {money(preflight.queueSimulation.estimatedCostEur)} €</p>
          {preflight.queueSimulation.blocker && <p className="font-medium">{preflight.queueSimulation.blocker}</p>}
          <p className="mt-1 text-muted-foreground">No se ha creado ningún pedido ni registro en la cola real.</p>
        </div>}
        <p className="mt-1 text-xs font-semibold">La simulación no envía órdenes, datos personales ni pagos a CJ.</p>
      </div>}
      {cjLookupError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-semibold text-amber-900">{cjLookupError}</p>}
      {cjVariants.length > 0 && <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <select aria-label="Seleccionar variante real de CJ" value={cjVariants.some((entry) => entry.vid === supplierVariantId) ? supplierVariantId : ""}
          onChange={(event) => {
            const variant = cjVariants.find((entry) => entry.vid === event.target.value);
            setSupplierVariantId(variant?.vid || "");
            setSupplierSku(variant?.sku || "");
            setFreightQuote(null);
            setSelectedFreightName("");
            setFreightError("");
          }} className="min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
          <option value="">Selecciona la variante exacta que venderás</option>
          {cjVariants.map((variant) => <option key={variant.vid} value={variant.vid}>
            {(variant.option || variant.name || variant.sku || variant.vid).slice(0, 90)} · {variant.priceUsd == null ? "Precio CJ no disponible" : "$" + variant.priceUsd.toFixed(2) + " USD"} · {variant.sku || "sin SKU"}
          </option>)}
        </select>
        <span className="text-xs text-muted-foreground">{cjVariants.length} variantes consultadas</span>
      </div>}
      {metadata.cjPreferredLogisticName && <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-xs font-semibold text-emerald-900">Transportista preferido guardado para España: {String(metadata.cjPreferredLogisticName)}. No se aplicará automáticamente a pedidos reales hasta validar el flujo de cumplimiento.</p>}
      {selectedCjVariant && <div className="rounded-lg bg-background/80 px-3 py-2 text-xs">
        <p className="font-semibold">Variante seleccionada: {selectedCjVariant.option || selectedCjVariant.name}</p>
        <p className="mt-1 break-all">VID: {selectedCjVariant.vid} · SKU: {selectedCjVariant.sku || "No disponible"}</p>
        <p className="mt-1 font-semibold">Precio de CJ: {selectedCjVariant.priceUsd == null ? "Sin dato" : "$" + selectedCjVariant.priceUsd.toFixed(2) + " USD"} (sin transporte)</p>
        <p className="mt-1 text-muted-foreground">Pulsa «Conectar» para guardar esta selección. Tu precio público no se modifica.</p>
      </div>}
      {(freightQuote || freightError) && <div className="space-y-3 rounded-xl border border-border bg-background/80 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold">Calcular transporte CJ a España</p>
            <p className="text-xs text-muted-foreground">Una unidad · salida de China (CN) · destino España (ES). No crea pedidos ni realiza pagos.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedFreightName && <button type="button" disabled={saving || !supplierId || !supplierVariantId}
              onClick={() => void onSave(product, supplierId, mode, cost, supplierVariantId, supplierSku, selectedFreightName, quoteForSave)}
              className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar transportista preferido"}
            </button>}
            <span className="text-xs font-semibold text-emerald-800">Cotización de solo lectura</span>
          </div>
        </div>
        {freightError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-900">{freightError}</p>}
        {freightQuote && freightQuote.methods?.length > 0 && <div className="space-y-2">
          <p className="text-xs font-semibold">Opciones de CJ (estimación en USD, no incluye automáticamente impuestos no declarados):</p>
          {freightQuote.methods.slice(0, 12).map((method: any, index: number) => <button type="button" key={method.name + "-" + index}
            aria-pressed={selectedFreightName === method.name}
            onClick={() => setSelectedFreightName(method.name)}
            className={"flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-left text-xs transition-colors " + (selectedFreightName === method.name ? "border-emerald-700 bg-emerald-50 ring-1 ring-emerald-700" : "border-border bg-background hover:border-emerald-400")}>
            <div>
              <p className="font-semibold">{method.name}</p>
              {method.time && <p className="text-muted-foreground">Plazo orientativo: {method.time} días</p>}
              {(method.taxesUsd != null || method.clearanceUsd != null) && <p className="text-muted-foreground">Impuestos CJ: {method.taxesUsd == null ? "sin dato" : "$" + method.taxesUsd.toFixed(2)} · despacho: {method.clearanceUsd == null ? "sin dato" : "$" + method.clearanceUsd.toFixed(2)}</p>}
            </div>
            <div className="text-right">
              <p className="font-semibold">Envío: ${method.shippingUsd.toFixed(2)} USD</p>
              {method.totalPostageUsd != null && <p>Franqueo total CJ: ${method.totalPostageUsd.toFixed(2)} USD</p>}
              {freightQuote.variant?.priceUsd != null && <p>Artículo + franqueo: ${(freightQuote.variant.priceUsd + (method.totalPostageUsd ?? method.shippingUsd)).toFixed(2)} USD*</p>}
              {method.profitability?.available && <p className={"font-bold " + (method.profitability.feasible ? "text-emerald-700" : "text-red-700")}>
                Resultado estimado: {Number(method.profitability.estimatedProfitEur).toFixed(2)} €
              </p>}
            </div>
          </button>)}
          {freightQuote.methods.length > 12 && <p className="text-xs text-muted-foreground">Mostrando las primeras 12 tarifas de {freightQuote.methods.length}.</p>}
          {selectedFreightName && <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm">
            <p className="font-bold text-emerald-900">Transportista elegido para comparar: {selectedFreightName}</p>
            <p className="mt-1 text-xs text-emerald-900">Puedes guardar esta preferencia y la cotización estimada. Ninguna compra se enviará automáticamente.</p>
            {freightQuote.fx?.rate ? <p className="mt-2 text-xs font-medium">Cambio USD/EUR: {Number(freightQuote.fx.rate).toFixed(5)} (fecha {freightQuote.fx.date}).</p>
              : <p className="mt-2 text-xs font-semibold text-amber-900">Tipo de cambio no disponible: no se puede estimar un margen fiable.</p>}
            {profitability?.available && <div className="mt-2 rounded-lg border border-emerald-300 bg-background p-3 text-sm">
              <p>Coste estimado proveedor y transporte: <strong>{money(profitability.costEur)} €</strong>.</p>
              <p>Resultado estimado: <strong className={profitability.feasible ? "text-emerald-800" : "text-red-700"}>{money(profitability.estimatedProfitEur)} €</strong> · margen {Number(profitability.estimatedMarginPercent).toFixed(1)}%.</p>
              {!profitability.feasible && <p className="mt-1 font-bold text-red-700">Margen insuficiente. Precio orientativo para un margen del 30%: {money(profitability.recommendedMinimumPriceEur)} €. Tu precio de venta no cambia.</p>}
              <p className="mt-1 text-xs text-muted-foreground">Hipótesis: IVA, comisión de pago aproximada y reserva del 3% por cambio de divisa; el importe final puede variar.</p>
            </div>}
            <button type="button" disabled={saving || !supplierId || !supplierVariantId}
              onClick={() => void onSave(product, supplierId, mode, cost, supplierVariantId, supplierSku, selectedFreightName, quoteForSave)}
              className="mt-2 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
              {saving ? "Guardando…" : "Guardar transportista preferido"}
            </button>
            {(() => {
              const option = freightQuote.methods.find((entry: any) => entry.name === selectedFreightName);
              if (!option || freightQuote.variant?.priceUsd == null) return null;
              const shipping = option.totalPostageUsd ?? option.shippingUsd;
              return <p className="mt-1 font-semibold">Artículo + franqueo CJ: ${(freightQuote.variant.priceUsd + shipping).toFixed(2)} USD, antes de conversión e impuestos adicionales.</p>;
            })()}
          </div>}
          <p className="text-xs text-amber-900">*Suma orientativa antes de conversión a EUR, IVA, posibles impuestos adicionales y comisiones. El coste final puede variar por código postal o disponibilidad de la ruta. No cambies el coste registrado sin confirmar el importe real.</p>
        </div>}
      </div>}
      {cjLookupComplete && cjVariants.length > 1 && <p className="text-xs font-semibold text-amber-800">CJ ofrece varias variantes. Si la ficha pública no tiene opciones para el cliente, debes vender solo la variante seleccionada; todavía no hay asignación automática individual para varias opciones.</p>}
      <p className="text-xs text-muted-foreground">El precio consultado está en USD. El campo «Coste proveedor» debe introducirse en EUR tras verificar conversión y gastos; el transporte final depende del destino. No actives pedidos reales sin confirmar ambos costes.</p>
    </div>}
  </div>;
}

function Card({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return <div className="rounded-2xl border border-border bg-card p-5">
    <Icon className="h-6 w-6 text-primary"/>
    <p className="mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-black">{value}</p>
  </div>;
}
