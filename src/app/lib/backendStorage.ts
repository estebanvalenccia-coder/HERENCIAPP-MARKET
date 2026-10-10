// Browser requests always use the same-origin Vercel proxy.
// Every endpoint below already starts with /api, so no API base prefix is needed.
const API_BASE = "";
let backendAvailable = true;
let lastBackendError: string | null = null;

type StoredValue = string | null;
type BackendStorageResult = {
  ok: boolean;
  synced: boolean;
  local: boolean;
  error?: string;
};

type BouquetPayload = {
  description: string;
  budget: number;
  style: string;
  color: string;
  size: string;
};

type BouquetResult = {
  proposal: any;
  image: string;
  imageGeneratedByAi: boolean;
  source?: string;
  warnings?: string[];
};

type ShippingAddressPayload = {
  address: string;
  city?: string;
  postalCode?: string;
  province?: string;
};

type ShippingCalculationResult = {
  ok: boolean;
  price: number;
  currency: string;
  distanceKm: number;
  distanceText: string;
  durationText: string;
  origin: string;
  destination: string;
  pricing?: {
    basePrice: number;
    stepKm: number;
    stepPrice: number;
  };
};

const cache = new Map<string, string>();

const remotelySyncedKeys = new Set([
  "chatboxSettings",
  "herenciaSettings",
  "customTheme",
  "menuIcons",
  "stripeSettings",
  "supabaseSettings",
  "shippingSettings",
  "aiSettings",
  "adminProducts",
  "adminSuppliers",
  "adminFlowerCosts",
  "bouquetCatalog",
  "adminLatestFlowerQuote",
  "tpvLayoutSettings",
  "posCustomers",
  "posFiscalSettings",
  "posCashSession",
  "heroBanner",
  "ctaBanner",
  "siteContent",
  "siteContentDraft",
  "siteContentHistory",
  "herencia_finance_sales",
  "herencia_finance_expenses",
  "herencia_finance_closures",
  "financeGoals",
  "businessSuiteSettings",
  "marketingContent",
  "communityContent",
  "storefrontPosts",
  "internationalDeliverySettings",
  "discountCodes",
  "__backendStorage_test__",
  "cart",
  "user",
]);

const fallbackBouquetImages = [
  "https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1591886960571-74d43a9d4166?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1562690868-60bbe7293e94?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1533616688419-b7a585564566?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1508610048659-a06b669e3321?q=80&w=1200&auto=format&fit=crop",
];

function shouldSyncWithBackend(key: string) {
  return remotelySyncedKeys.has(key);
}

function sanitizeForClient(_key: string, value: string) {
  return value;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error || "Error desconocido");
}

function readLocalStorage(key: string): StoredValue {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Puede fallar si el navegador bloquea localStorage. El backend sigue siendo la fuente principal.
  }
}

function removeLocalStorage(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Puede fallar si el navegador bloquea localStorage. El backend sigue siendo la fuente principal.
  }
}

async function generateBouquetImageInBrowser(_prompt: string) {
  throw new Error("La generación de imágenes IA se ejecuta únicamente en el backend seguro");
}

let preloadPromise: Promise<void> | null = null;
let lastBackendConsoleSignature = "";
let lastBackendConsoleAt = 0;

const emitChange = () => {
  window.dispatchEvent(new Event("backend-storage"));
  window.dispatchEvent(new Event("storage"));
};

const emitCommerceProductsChange = () => {
  window.dispatchEvent(new Event("commerce-products-changed"));
};

function emitBackendError(action: string, key: string, error: unknown) {
  const message = getErrorMessage(error);
  lastBackendError = message;
  backendAvailable = false;

  const signature = `${action}:${key}:${message}`;
  const now = Date.now();
  if (signature !== lastBackendConsoleSignature || now - lastBackendConsoleAt > 10000) {
    console.error(`[backendStorage] ${action} falló para ${key}:`, message);
    lastBackendConsoleSignature = signature;
    lastBackendConsoleAt = now;
  }

  window.dispatchEvent(
    new CustomEvent("backend-storage-error", {
      detail: {
        action,
        key,
        message,
        apiBase: API_BASE,
      },
    })
  );
}

async function readErrorResponse(response: Response) {
  const text = await response.text().catch(() => "");

  try {
    const json = JSON.parse(text);
    return json?.error || json?.message || text || `Error HTTP ${response.status}`;
  } catch {
    return text || `Error HTTP ${response.status}`;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    backendAvailable = false;
    lastBackendError = getErrorMessage(error);
    throw error;
  }

  if (!response.ok) {
    backendAvailable = false;
    lastBackendError = await readErrorResponse(response);
    if (response.status === 401 && path.startsWith("/api/neural")) {
      window.dispatchEvent(new CustomEvent("herencia:admin-session-expired"));
    }
    throw new Error(lastBackendError);
  }

  backendAvailable = true;
  lastBackendError = null;

  if (response.status === 204) return {} as T;

  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

async function syncStorageValue(key: string, value: string): Promise<BackendStorageResult> {
  if (!shouldSyncWithBackend(key)) {
    return { ok: true, synced: false, local: true };
  }

  try {
    await request<{ ok: boolean }>(`/api/storage/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    });

    return { ok: true, synced: true, local: true };
  } catch (error) {
    emitBackendError("guardar", key, error);
    return {
      ok: false,
      synced: false,
      local: true,
      error: getErrorMessage(error),
    };
  }
}

async function deleteStorageValue(key: string): Promise<BackendStorageResult> {
  if (!shouldSyncWithBackend(key)) {
    return { ok: true, synced: false, local: true };
  }

  try {
    await request<{ ok: boolean }>(`/api/storage/${encodeURIComponent(key)}`, {
      method: "DELETE",
    });

    return { ok: true, synced: true, local: true };
  } catch (error) {
    emitBackendError("eliminar", key, error);
    return {
      ok: false,
      synced: false,
      local: true,
      error: getErrorMessage(error),
    };
  }
}

export const backendApi = {
  baseUrl: API_BASE,
  get enabled() {
    // El backend siempre está disponible vía el proxy same-origin (/api/*),
    // no depende de una URL absoluta configurada en API_BASE.
    return true;
  },
  get available() {
    return backendAvailable;
  },
  get lastError() {
    return lastBackendError;
  },

  async health() {
    return request<{ ok: boolean; service?: string }>("/api/health");
  },

  async readiness() {
    return request<{
      ok: boolean;
      database: boolean;
      databaseProvider?: string;
      databasePrimary?: string;
      stripe?: boolean;
      stripeWebhook?: boolean;
      email?: boolean;
      r2Configured?: boolean;
      maps?: boolean;
      salesAi?: boolean;
      imageAi?: boolean;
      commerceCore?: boolean;
    }>("/api/ready");
  },


  async listCommerceCollections(params?: { includeArchived?: boolean }) {
    const search = new URLSearchParams();
    if (params?.includeArchived) search.set("includeArchived", "1");
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<{ collections: any[]; source?: string }>(`/api/commerce/collections${suffix}`);
  },

  async listCommerceProducts(params?: { collection?: string; includeArchived?: boolean; status?: string }) {
    const search = new URLSearchParams();
    if (params?.collection) search.set("collection", params.collection);
    if (params?.includeArchived) search.set("includeArchived", "1");
    if (params?.status) search.set("status", params.status);
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<{ products: any[]; source?: string }>(`/api/commerce/products${suffix}`);
  },

  async getCommerceProduct(id: string | number) {
    return request<{ product: any; source?: string }>(`/api/commerce/products/${encodeURIComponent(String(id))}`);
  },

  async bootstrapCommerceCatalog() {
    return request<{ ok: boolean; imported: number; products: any[]; source?: string; migrationRequired?: boolean }>("/api/admin/commerce/bootstrap", { method: "POST" });
  },

  async commerceHealth() {
    return request<{ ok: boolean; products: number; collections: number; source: string; migrationRequired?: boolean }>("/api/admin/commerce/health");
  },

  async createCommerceProduct(payload: any) {
    const result = await request<{ product: any; source?: string; migrationRequired?: boolean }>("/api/admin/commerce/products", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    emitCommerceProductsChange();
    return result;
  },

  async updateCommerceProduct(id: string | number, payload: any) {
    const result = await request<{ product: any; source?: string; migrationRequired?: boolean }>(`/api/admin/commerce/products/${encodeURIComponent(String(id))}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    emitCommerceProductsChange();
    return result;
  },

  async deleteCommerceProduct(id: string | number, permanent = false) {
    const result = await request<{ ok: boolean; source?: string; migrationRequired?: boolean }>(`/api/admin/commerce/products/${encodeURIComponent(String(id))}?permanent=${permanent ? "1" : "0"}`, {
      method: "DELETE",
    });
    emitCommerceProductsChange();
    return result;
  },

  async saveCommerceCollection(payload: any) {
    const result = await request<{ collections: any[]; source?: string; migrationRequired?: boolean }>("/api/admin/commerce/collections", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    window.dispatchEvent(new Event("commerce-collections-changed"));
    return result;
  },

  async setCommerceCollectionProducts(id: string, productIds: Array<string | number>) {
    const result = await request<{ products: any[]; source?: string }>(
      `/api/admin/commerce/collections/${encodeURIComponent(id)}/products`,
      {
        method: "PUT",
        body: JSON.stringify({ productIds: productIds.map(String) }),
      }
    );
    window.dispatchEvent(new Event("commerce-products-changed"));
    window.dispatchEvent(new Event("commerce-collections-changed"));
    return result;
  },

  async previewCatalogUrl(url: string, maxProducts = 60) {
    return request<{
      ok: boolean;
      sourceUrl: string;
      sourceHost: string;
      count: number;
      truncated?: boolean;
      variantsWarning?: string;
      requiresManual?: boolean;
      message?: string;
      products: any[];
      source?: string;
    }>("/api/admin/catalog/import-url/preview", {
      method: "POST",
      body: JSON.stringify({ url, maxProducts }),
    });
  },

  async listCjProductVariants(productId: string) {
    return request<{
      ok: boolean;
      productId: string;
      pid: string;
      variants: Array<{ vid: string; sku: string; name: string; option: string; priceUsd: number | null; image: string }>;
      total: number;
      truncated: boolean;
      currency: "USD";
      source: string;
    }>(`/api/admin/catalog/cj-variants?productId=${encodeURIComponent(productId)}`);
  },

  async preflightCjProduct(productId: string) {
    return request<{
      ok: boolean; simulationOnly: boolean; safe: boolean; readyForManualReview: boolean;
      checks: string[]; queueSimulation?: { status: string; blocker: string; estimatedCostEur: number; marginPercentBeforeVat: number | null; itemCount: number; persistido: false } | null; product: { id: string; name: string; salePriceEur: number };
      supplier: { name: string; sandbox: boolean };
      variant: { vid: string; sku: string };
      shipping: { method: string; destination: string };
      estimate: { supplierTotalUsd?: number; estimatedCostEur?: number; estimatedProfitEur?: number; recommendedMinimumPriceEur?: number; fxDate?: string; quotedAt?: string } | null;
      message: string;
    }>("/api/admin/supplier-fulfillments/cj-preflight", {
      method: "POST",
      body: JSON.stringify({ productId }),
    });
  },

  async getPrintfulShippingStatus() {
    return request<{
      provider: "printful"; configured: boolean; storeIdConfigured: boolean;
      capabilities: string[]; automaticOrders: false; reason: string;
    }>("/api/admin/suppliers/printful/status");
  },

  async quotePrintfulShipping(catalogVariantId: number, destination: string, postalCode: string) {
    return request<{
      ok: true; provider: "printful"; source: string; checkedAt: string;
      destination: string; postalCode: string; catalogVariantId: number;
      quantity: 1;
      methods: Array<{
        code: string; name: string; rateEur: number; currency: "EUR";
        minDeliveryDays: number | null; maxDeliveryDays: number | null;
        customsFeesPossible: boolean;
      }>;
      hasMoreMethods: boolean;
      supplierProductPriceVerified: false; supplierStockVerified: false;
      checkoutEnabled: false; automaticOrdersEnabled: false; message: string;
    }>("/api/admin/suppliers/printful/shipping-quote", {
      method: "POST",
      body: JSON.stringify({ catalogVariantId, destination, postalCode, quantity: 1 }),
    });
  },

  async quoteCjProductFreight(productId: string, vid: string, zip = "", destination = "ES") {
    return request<{
      ok: boolean; productId: string;
      variant: { vid: string; sku: string; name: string; option: string; priceUsd: number | null };
      origin: string; destination: string; currency: "USD"; rateType: string;
      checkoutEnabled: false; manualReviewRequired: true; destinationNotice: string;
      methods: Array<{ name: string; time: string; shippingUsd: number; taxesUsd: number | null; clearanceUsd: number | null; totalPostageUsd: number | null;
        profitability: { available: boolean; feasible?: boolean; costEur?: number; estimatedProfitEur?: number; estimatedMarginPercent?: number; recommendedMinimumPriceEur?: number; supplierTotalUsd?: number; reason?: string; caution?: string }
      }>;
      fx: { rate: number; date: string; checkedAt: string; provider: string } | null;
      pricingAssumptions: { vatRate: number; minMarginPercent: number; processingFeePercent: number; processingFixedEur: number; currencyBufferPercent: number };
      pricingWarning: string;
      warning: string;
    }>("/api/admin/catalog/cj-freight", {
      method: "POST",
      body: JSON.stringify({ productId, vid, zip, destination }),
    });
  },

  async getSupplierFileColumnMap(supplierId: string, format: "csv"|"json"|"xml") {
    return request<{
      ok:true;supplierId:string;format:string;exists:boolean;updatedAt:string|null;
      columnMap:Record<string,string>;
    }>(`/api/admin/catalog/supplier-file/mapping?supplierId=${encodeURIComponent(supplierId)}&format=${encodeURIComponent(format)}`);
  },

  async saveSupplierFileColumnMap(payload:{
    supplierId:string;format:"csv"|"json"|"xml";
    columns:string[];columnMap:Record<string,string>;
  }) {
    return request<{
      ok:true;supplierId:string;format:string;exists:boolean;updatedAt:string|null;
      columnMap:Record<string,string>;
    }>("/api/admin/catalog/supplier-file/mapping",{
      method:"PUT",body:JSON.stringify(payload),
    });
  },

  async inspectSupplierFileCatalog(payload: {
    format: "csv" | "json" | "xml"; content: string;
  }) {
    return request<{
      ok: true; format: string; rows: number;
      columns: Array<{key:string; example:string}>;
      targets: string[]; maximumOptions: number; readOnly:true;
    }>("/api/admin/catalog/supplier-file/inspect", {
      method: "POST",body:JSON.stringify(payload),
    });
  },

  async previewSupplierFileCatalog(payload: {
    supplierId: string; format: "csv" | "json" | "xml"; content: string; columnMap?: Record<string,string>;
  }) {
    return request<{
      ok: true; source: "supplier_file"; supplierId: string; format: string;
      rows: number; products: Array<{
        id: string; supplierId: string; supplierProductId: string;
        name: string; category: string; currency: string;
        minSupplierCost: number | null; variantCount: number;
        variants: Array<{name:string;supplierSku:string;supplierVariantId:string}>;
        optionLabels: string[]; warnings: string[];
      }>;
      warnings: string[]; writable: false; automaticOrdersEnabled: false;
      reconciliation: Array<{id:string;status:"new"|"unchanged"|"changes_detected"|"conflict";changedFields:string[];existingProductId:string|null;merchantChangesProtected:true;automaticUpdateEnabled:false}>;
      supplier: {id:string;name:string}; message: string;
    }>("/api/admin/catalog/supplier-file/preview", {
      method: "POST", body: JSON.stringify(payload),
    });
  },

  async commitSupplierFileCatalog(payload: {
    supplierId: string; format: "csv" | "json"; content: string;
  }) {
    const result=await request<{
      ok: true; source: "neon"; mode: "manual_drafts_only";
      created: number; skipped: number; failed: number;
      automaticOrdersEnabled: false;
      results: Array<{id:string;name:string;status:"created"|"skipped_existing"|"failed";variantCount?:number;message?:string}>;
    }>("/api/admin/catalog/supplier-file/commit", {
      method: "POST", body: JSON.stringify({...payload,confirmDrafts:true}),
    });
    emitCommerceProductsChange();
    return result;
  },

  async importCatalogUrlProduct(product: any) {
    const result = await request<{
      ok: boolean;
      skipped?: boolean;
      updated?: boolean;
      reason?: string;
      product?: any;
      copiedImages?: number;
      imageImportWarning?: string;
      missingFields?: string[];
      source?: string;
    }>("/api/admin/catalog/import-url/product", {
      method: "POST",
      body: JSON.stringify({ product }),
    });
    emitCommerceProductsChange();
    return result;
  },

  async saveCatalogUrlProductMedia(product: any) {
    const result = await request<{
      ok: boolean;
      copiedImages: number;
      media: Array<{ name: string; path: string; url: string; size?: number; createdAt?: string; sourceUrl?: string }>;
      source?: string;
    }>("/api/admin/catalog/import-url/media", {
      method: "POST",
      body: JSON.stringify({ product }),
    });
    window.dispatchEvent(new Event("media-library-changed"));
    return result;
  },

  async repairImportedCatalogDrafts(sourceHost = "", limit = 30) {
    const result = await request<{
      ok: boolean;
      candidates: number;
      repaired: number;
      errors: number;
      results: Array<{ id: string; name: string; ok: boolean; images?: number; error?: string }>;
      source?: string;
    }>("/api/admin/catalog/import-url/repair-drafts", {
      method: "POST",
      body: JSON.stringify({ sourceHost, limit }),
    });
    emitCommerceProductsChange();
    return result;
  },

  async preload() {
    if (!preloadPromise) {
      preloadPromise = request<{ data: Record<string, string> }>("/api/storage")
        .then(({ data }) => {
          Object.entries(data || {}).forEach(([key, value]) => cache.set(key, sanitizeForClient(key, value)));
        })
        .catch((error) => {
          emitBackendError("precargar", "app_storage", error);
          // La app puede abrir con copia local, pero el admin sigue tratando el backend como configurado.
        });
    }
    return preloadPromise;
  },

  async getSettings() {
    return request<{ settings: Record<string, any> }>("/api/settings/public");
  },

  async adminAuthConfig() {
    return request<{ totpRequired: boolean }>("/api/admin/auth-config");
  },

  async adminLogin(username: string, password: string, otp = "") {
    return request<{ ok: boolean }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password, otp }),
    });
  },

  async adminLogout() {
    return request<{ ok: boolean }>("/api/admin/logout", { method: "POST" });
  },

  async adminSession() {
    return request<{ authenticated: boolean }>("/api/admin/session");
  },

  async sendAdminSmokeEmail(email = "") {
    return request<{ ok: boolean; providerId?: string | null }>("/api/admin/smoke/email", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async siteMediaStatus() {
    return request<{
      provider: "cloudflare_r2" | "legacy_supabase";
      configured: boolean;
      account?: boolean;
      accessKey?: boolean;
      secretKey?: boolean;
      bucket?: boolean;
      publicUrl?: boolean;
      connection?: {
        ok?: boolean;
        configured?: boolean;
        bucket?: string;
        publicUrl?: string;
        error?: string;
        code?: string | null;
      };
    }>("/api/admin/media/status");
  },

  async listSiteMedia() {
    return request<{
      media: Array<{
        name: string;
        path: string;
        url: string;
        createdAt?: string | null;
        size?: number | null;
      }>;
    }>("/api/admin/media");
  },

  async uploadSiteMedia(payload: { dataUrl: string; filename?: string }) {
    return request<{
      media: {
        name: string;
        path: string;
        url: string;
        createdAt?: string | null;
        size?: number | null;
      };
    }>("/api/admin/media", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async uploadSiteMediaFile(file: File) {
    if (!file) throw new Error("Selecciona una imagen");
    if (file.size > 8 * 1024 * 1024) throw new Error("La imagen supera 8 MB");
    const mimeType = String(file.type || "").toLowerCase();
    const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
    if (mimeType && !allowed.has(mimeType)) {
      throw new Error("Formato no compatible. Usa JPG, PNG, WEBP, GIF o AVIF.");
    }

    let response: Response;
    try {
      response = await fetch("/api/admin/media", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": mimeType || "application/octet-stream",
          "X-Herencia-Filename": encodeURIComponent(file.name || "imagen"),
        },
        body: file,
      });
    } catch (error) {
      backendAvailable = false;
      lastBackendError = getErrorMessage(error);
      throw error;
    }

    if (!response.ok) {
      backendAvailable = false;
      lastBackendError = await readErrorResponse(response);
      throw new Error(lastBackendError);
    }

    backendAvailable = true;
    lastBackendError = null;
    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as {
      media: {
        name: string;
        path: string;
        url: string;
        createdAt?: string | null;
        size?: number | null;
      };
      source?: string;
    };
  },

  async deleteSiteMedia(path: string) {
    const result = await request<{ ok: boolean }>("/api/admin/media", {
      method: "DELETE",
      body: JSON.stringify({ path }),
    });
    window.dispatchEvent(new Event("media-library-changed"));
    return result;
  },

  async posBootstrap() {
    return request<{
      products: any[];
      customers: any[];
      fiscalSettings: Record<string, any>;
      stripeSettings: {
        enabled: boolean;
        publishableKey: string;
        secretConfigured: boolean;
      };
      cashSession: any | null;
    }>("/api/pos/bootstrap");
  },

  async getPosCashSession(registerId = "caja-01") {
    return request<{ session: any | null }>(`/api/pos/cash-session?registerId=${encodeURIComponent(registerId)}`);
  },

  async openPosCashSession(openingAmount: number, registerId = "caja-01") {
    return request<{ session: any }>("/api/pos/cash-session/open", {
      method: "POST",
      body: JSON.stringify({ openingAmount, registerId }),
    });
  },

  async addPosCashMovement(payload: { type: "in" | "out"; amount: number; note?: string; registerId?: string }) {
    return request<{ session: any }>("/api/pos/cash-session/movement", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async closePosCashSession(countedCash: number, registerId = "caja-01") {
    return request<{ session: any }>("/api/pos/cash-session/close", {
      method: "POST",
      body: JSON.stringify({ countedCash, registerId }),
    });
  },

  async posSelfTest() {
    return request<{
      ok: boolean;
      cardReady: boolean;
      stockReady: boolean;
      fiscalReady: boolean;
      tests: Array<{ name: string; ok: boolean; detail: string }>;
      ranAt?: string;
    }>("/api/pos/self-test");
  },

  async savePosCustomer(payload: any) {
    return request<{ customer: any; customers: any[] }>("/api/pos/customers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async savePosFiscalSettings(payload: any) {
    return request<{ settings: Record<string, any> }>("/api/pos/fiscal-settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async createPosMixedCardIntent(payload: any) {
    return request<{ clientSecret: string; paymentIntentId: string; cardAmount: number; totals: any }>("/api/pos/mixed-card-intent", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async createPosCardIntent(payload: any) {
    return request<{
      clientSecret: string;
      paymentIntentId: string;
      orderId: string;
      totals: { subtotal: number; tax: number; total: number };
    }>("/api/pos/card-intent", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async createPosRegister(payload: { name: string; id?: string }) {
    return request<{ register: any; operations: any }>("/api/pos/registers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async createInventoryLocation(name: string) {
    return request<{ location: any; operations: any }>("/api/admin/inventory/locations", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },

  async setInventoryLocationStock(payload: { productId: string; locationId: string; stock: number }) {
    return request<{ stock: number; operations: any }>("/api/admin/inventory/location-stock", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async transferInventory(payload: { productId: string; from: string; to: string; quantity: number }) {
    return request<{ transfer: any; operations: any }>("/api/admin/inventory/transfers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async createInventoryLot(payload: { productId: string; lotCode: string; quantity: number; expiresAt?: string; receivedAt?: string; locationId?: string }) {
    return request<{ lot: any; operations: any }>("/api/admin/inventory/lots", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateInventoryLot(id: string, payload: { remaining?: number; expiresAt?: string | null; locationId?: string }) {
    return request<{ lot: any; operations: any }>(`/api/admin/inventory/lots/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async getPosOperations() {
    return request<{ operations: any }>("/api/pos/operations");
  },

  async savePosOperations(payload: any) {
    return request<{ operations: any }>("/api/pos/operations", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async saveHeldPosSale(payload: any) {
    return request<{ heldSale: any; operations: any }>("/api/pos/held-sales", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async deleteHeldPosSale(id: string) {
    return request<{ ok: boolean; operations: any }>(`/api/pos/held-sales/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async createFloristOrder(payload: any) {
    return request<{ order: any; operations: any }>("/api/pos/florist-orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async createGiftCard(payload: { amount: number; code?: string }) {
    return request<{ card: any; operations: any }>("/api/pos/gift-cards", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateFloristOrder(id: string, payload: any) {
    return request<{ order: any; operations: any }>(`/api/pos/florist-orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async redeemGiftCard(payload: { code: string; amount: number }) {
    return request<{ card: any; operations: any }>("/api/pos/gift-cards/redeem", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async savePosSupplier(payload: any) {
    return request<{ supplier: any; operations: any }>("/api/pos/suppliers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listSupplierConnectorStatuses() {
    return request<{
      connectors: Array<{ supplierId: string; type: string; state: string; automaticOrders: boolean; reason: string }>;
    }>("/api/admin/suppliers/connector-status");
  },

  async testSupplierConnector(supplierId: string) {
    return request<{ ok: boolean; status: string; testedAt: string; capabilities: { orders: boolean } }>(
      `/api/admin/suppliers/${encodeURIComponent(supplierId)}/test-connector`,
      { method: "POST", body: "{}" }
    );
  },

  async listSupplierFulfillments() {
    return request<{
      fulfillments: any[];
      suppliers: any[];
      autopilotConnectorConfigured: boolean;
      cjConfigured?: boolean;
      cjLiveEnabled?: boolean;
    }>("/api/admin/supplier-fulfillments");
  },

  // Read-only CJ account order audit; this endpoint never creates or pays orders.
  async auditCjAccountOrders(orderId = "") {
    const suffix = orderId ? "?orderId=" + encodeURIComponent(orderId) : "";
    return request<{
      checkedAt: string;
      readOnly: true;
      purchaseEnabledByAudit: false;
      checkedStatuses: number;
      statusSummary: Array<{ status: string; total: number | null; scanned: number }>;
      failedStatuses: Array<{ status: string; message: string }>;
      cjOrders: Array<{
        cjOrderId: string; orderNumber: string; status: string; amountUsd: number | null;
        localOrderId: string | null; localFulfillmentId: string | null;
      }>;
      localQueue: Array<{
        orderId: string; fulfillmentId: string; status: string;
        estimatedCostEur: number; externalOrderId: string;
        cjDetectedInPages: boolean; cjOrderStatus: string | null;
      }>;
      incomplete: boolean;
      warning: string;
    }>("/api/admin/suppliers/cj/order-audit" + suffix);
  },

  async prepareSupplierFulfillments(orderId: string, force = false) {
    return request<{ fulfillments: any[] }>(
      `/api/admin/supplier-fulfillments/prepare/${encodeURIComponent(orderId)}`,
      {
        method: "POST",
        body: JSON.stringify({ force }),
      }
    );
  },

  // Two separate manual CJ actions. Creation uses payType=3 (unpaid);
  // only the second, explicitly confirmed action may debit CJ balance.
  async getCjManualApprovalPreview(id: string) {
    return request<{
      orderId: string; fulfillmentId: string; status: string; snapshot: string;
      sandbox: boolean; creationEnabled: boolean; paymentEnabled: boolean;
      merchantFunded: boolean; customerTotalEur: number | null;
      estimatedSupplierCostEur: number; estimatedSupplierTotalUsd: number;
      providerActualPaymentUsd: number; maxSupplierPaymentUsd: number;
      externalOrderId: string; canCreate: boolean; canPay: boolean;
      creationReason: string; paymentReason: string;
      createConfirmation: string; paymentConfirmation: string;
    }>(`/api/admin/supplier-fulfillments/${encodeURIComponent(id)}/cj-manual-preview`);
  },

  async createUnpaidCjOrder(id: string, payload: {
    snapshot: string; confirmation: string; approvedMaxUsd: number;
    acknowledgeMerchantPays: boolean;
  }) {
    return request<{ fulfillment: any; createdInCj: true; paidInCj: false }>(
      `/api/admin/supplier-fulfillments/${encodeURIComponent(id)}/cj-create-unpaid`,
      { method: "POST", body: JSON.stringify(payload) }
    );
  },

  async payApprovedCjOrder(id: string, payload: {
    snapshot: string; confirmation: string; approvedMaxUsd: number;
    acknowledgeMerchantPays: boolean;
  }) {
    return request<{ fulfillment: any; paidInCj: true; supplierDebitUsd: number }>(
      `/api/admin/supplier-fulfillments/${encodeURIComponent(id)}/cj-pay`,
      { method: "POST", body: JSON.stringify(payload) }
    );
  },

  async reconcileCjManualOrder(id: string) {
    return request<{ fulfillment: any; found: boolean; paid: boolean;
      safeToRetryCreate: false; cjStatus?: string; error?: string }>(
      `/api/admin/supplier-fulfillments/${encodeURIComponent(id)}/cj-reconcile`,
      { method: "POST", body: "{}" }
    );
  },

  async executeSupplierFulfillment(id: string, force = false) {
    return request<{ fulfillment: any; executed: boolean; manual: boolean }>(
      `/api/admin/supplier-fulfillments/${encodeURIComponent(id)}/execute`,
      {
        method: "POST",
        body: JSON.stringify({ force }),
      }
    );
  },

  async updateSupplierFulfillment(id: string, payload: any) {
    return request<{ fulfillment: any }>(
      `/api/admin/supplier-fulfillments/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    );
  },

  async testCjSupplierConnection() {
    return request<{
      configured: boolean;
      liveEnabled?: boolean;
      account?: { name?: string; email?: string };
      balance?: any;
      error?: string;
    }>("/api/admin/suppliers/cj/test", { method: "POST", body: JSON.stringify({}) });
  },

  async syncSupplierFulfillment(id: string) {
    return request<{ fulfillment: any }>(
      `/api/admin/supplier-fulfillments/${encodeURIComponent(id)}/sync`,
      { method: "POST", body: JSON.stringify({}) }
    );
  },

  async createSupplierDispute(id: string, payload: {
    expectType: 1 | 2;
    messageText?: string;
    imageUrl?: string[];
    videoUrl?: string[];
  }) {
    return request<{ supplierReturn: any }>(
      `/api/admin/supplier-fulfillments/${encodeURIComponent(id)}/dispute`,
      { method: "POST", body: JSON.stringify(payload) }
    );
  },

  async createPosPurchase(payload: any) {
    return request<{ purchase: any; inventory: any[]; operations: any }>("/api/pos/purchases", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async savePosStaff(payload: { name: string; role: "admin" | "manager" | "seller"; pin: string }) {
    return request<{ staff: any; operations: any }>("/api/pos/staff", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async unlockPosStaff(pin: string) {
    return request<{ staff: any }>("/api/pos/staff/unlock", {
      method: "POST",
      body: JSON.stringify({ pin }),
    });
  },

  async startPosStaffShift(staffId: string) {
    return request<{ shift: any; operations: any }>("/api/pos/staff-shifts/start", {
      method: "POST",
      body: JSON.stringify({ staffId }),
    });
  },

  async endPosStaffShift(staffId: string) {
    return request<{ shift: any; operations: any }>("/api/pos/staff-shifts/end", {
      method: "POST",
      body: JSON.stringify({ staffId }),
    });
  },

  async adjustPosLoyalty(payload: { customerId: string; delta: number }) {
    return request<{ loyalty: any; operations: any }>("/api/pos/loyalty/adjust", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async createPosQuote(payload: any) {
    return request<{ quote: any; operations: any }>("/api/pos/quotes", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updatePosQuote(id: string, payload: any) {
    return request<{ quote: any; operations: any }>(`/api/pos/quotes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async adjustPosInventory(payload: { productId: string; type: "count" | "waste" | "breakage" | "manual"; reason?: string; delta?: number; countedStock?: number; staff?: { id: string; name: string; role: string } }) {
    return request<{ adjustment: any; inventory: any[]; operations: any }>("/api/pos/inventory-adjustments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getPosReportSummary(params?: { from?: string; to?: string }) {
    const search = new URLSearchParams();
    if (params?.from) search.set("from", params.from);
    if (params?.to) search.set("to", params.to);
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<{ report: any }>(`/api/pos/reports/summary${suffix}`);
  },

  async listPosSales(limit = 50, query = "") {
    const search = new URLSearchParams({ limit: String(limit) });
    if (query.trim()) search.set("q", query.trim());
    return request<{ sales: any[] }>(`/api/pos/sales?${search.toString()}`);
  },

  async refundPartialPosSale(payload: {
    orderId: string;
    items: Array<{ id: string; quantity: number }>;
    reason?: string;
    staff?: { id: string; name: string; role: string };
  }) {
    return request<{ ok: boolean; order: any; inventory: any[]; refund: any; cashSession?: any; manualRefunds?: any[] }>("/api/pos/refund-partial", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async refundPosSale(payload: { orderId: string; reason?: string; staff?: { id: string; name: string; role: string } }) {
    return request<{ ok: boolean; order: any; inventory: any[]; refundNumber: string }>("/api/pos/refund", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async completePosSale(payload: any) {
    return request<{
      ok: boolean;
      order: any;
      inventory: any[];
      documentNumber: string;
      totals: {
        subtotal: number;
        tax: number;
        total: number;
        received: number;
        change: number;
      };
      cashSession?: any | null;
      idempotent?: boolean;
    }>("/api/pos/complete-sale", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async createPaymentIntent(payload: any) {
    return request<{ clientSecret?: string; paymentIntentId?: string | null; orderId: string; freeOrder?: boolean; totals?: { subtotal: number; discount?: number; shipping: number; total: number }; shippingQuote?: any }>("/api/stripe/create-payment-intent", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async confirmStripeOrder(payload: { orderId: string; paymentIntentId: string }) {
    return request<{ ok: boolean; order: any; emailResults?: any }>("/api/stripe/confirm-order", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async customerRegister(payload: { name: string; email: string; password: string; phone?: string; address?: string }) {
    return request<{ authenticated: boolean; user: any }>("/api/customer/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async customerLogin(payload: { email: string; password: string }) {
    return request<{ authenticated: boolean; user: any }>("/api/customer/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async customerSession() {
    return request<{ authenticated: boolean; user: any | null }>("/api/customer/session");
  },

  async communityInteractions() {
    return request<{ authenticated: boolean; likeCounts: Record<string, number>; liked: string[]; saved: string[] }>("/api/community/interactions");
  },

  async toggleCommunityLike(postId: string) {
    return request<{ liked: boolean; count: number }>(`/api/community/posts/${encodeURIComponent(postId)}/like`, { method: "POST" });
  },

  async toggleCommunitySave(postId: string) {
    return request<{ saved: boolean }>(`/api/community/posts/${encodeURIComponent(postId)}/save`, { method: "POST" });
  },

  async communityComments(postId = "") {
    return request<{ comments: any[] }>(`/api/community/comments${postId ? `?postId=${encodeURIComponent(postId)}` : ""}`);
  },

  async addCommunityComment(postId: string, body: string) {
    return request<{ comment: any }>(`/api/community/posts/${encodeURIComponent(postId)}/comments`, { method: "POST", body: JSON.stringify({ body }) });
  },

  async adminCommunityComments() {
    return request<{ comments: any[] }>("/api/admin/community/comments");
  },

  async moderateCommunityComment(id: string, status: "visible" | "hidden") {
    return request<{ comment: any }>(`/api/admin/community/comments/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) });
  },

  async deleteCommunityComment(id: string) {
    return request<{ ok: boolean }>(`/api/admin/community/comments/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  async customerLogout() {
    return request<{ ok: boolean }>("/api/customer/logout", { method: "POST", body: "{}" });
  },

  async customerPrivacyExport() {
    return request<any>("/api/customer/privacy/export");
  },

  async customerPrivacyDeleteAccount() {
    return request<{ ok: boolean; deletedAt: string; retained?: string }>("/api/customer/privacy/account", {
      method: "DELETE",
    });
  },

  async customerAccount() {
    return request<{ user: any; orders: any[]; loyalty: any; reminders: any[] }>("/api/customer/account");
  },

  async customerCreateReminder(payload: { title: string; date: string; leadDays?: number }) {
    return request<{ reminder: any }>("/api/customer/reminders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async customerDeleteReminder(id: string) {
    return request<{ ok: boolean }>(`/api/customer/reminders/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async customerUpdateProfile(payload: { name?: string; phone?: string; address?: string; addresses?: any[] }) {
    return request<{ user: any }>("/api/customer/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async customerWishlist() {
    return request<{ wishlist: string[] }>("/api/customer/wishlist");
  },

  async customerSaveWishlist(wishlist: string[]) {
    return request<{ wishlist: string[] }>("/api/customer/wishlist", {
      method: "PUT",
      body: JSON.stringify({ wishlist }),
    });
  },

  async customerClaimReferral(code: string) {
    return request<{ ok: boolean; referral: any; duplicate?: boolean }>("/api/customer/referral/claim", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  },

  async adminAuditLog(limit = 200) {
    return request<{ events: any[] }>(`/api/admin/audit-log?limit=${encodeURIComponent(String(limit))}`);
  },

  async clearAdminAuditLog() {
    return request<{ ok: boolean }>("/api/admin/audit-log", {
      method: "DELETE",
    });
  },

  async adminAutomations() {
    return request<{ rules: any; notifications: any[] }>("/api/admin/automations");
  },

  async saveAutomationRules(rules: any) {
    return request<{ rules: any }>("/api/admin/automations/rules", {
      method: "PUT",
      body: JSON.stringify(rules),
    });
  },

  async updateAutomationNotification(id: string, payload: { read?: boolean; resolved?: boolean }) {
    return request<{ notification: any }>(`/api/admin/automations/notifications/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  async createAdminBackup() {
    return request<any>("/api/admin/backup");
  },

  async restoreAdminBackup(backup: any) {
    return request<{ ok: boolean; restored: string[]; note?: string }>("/api/admin/backup/restore", {
      method: "POST",
      body: JSON.stringify({ backup }),
    });
  },

  async listAbandonedCarts(minMinutes = 30) {
    return request<{ carts: any[]; minMinutes: number }>(`/api/admin/abandoned-carts?minMinutes=${encodeURIComponent(String(minMinutes))}`);
  },

  async createOrder(payload: any) {
    return request<{ order: any }>("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async calculateShipping(payload: ShippingAddressPayload) {
    return request<ShippingCalculationResult>("/api/shipping/calculate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async deliveryAvailability(date: string) {
    return request<{
      ok: boolean;
      date: string;
      capacity: number;
      cutoffHour: number;
      slots: Array<{
        slot: string;
        used: number;
        capacity: number;
        remaining: number;
        available: boolean;
      }>;
    }>(`/api/shipping/availability?date=${encodeURIComponent(date)}`);
  },

  async joinProductWaitlist(payload: { productId: string; productName?: string; email: string }) {
    return request<{ ok: boolean; entry: any; duplicate?: boolean }>("/api/experience/waitlist", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listProductReviews(productId: string) {
    return request<{ reviews: any[] }>(`/api/experience/reviews/${encodeURIComponent(productId)}`);
  },

  async submitProductReview(payload: { productId: string; productName?: string; name: string; email: string; rating: number; comment: string }) {
    return request<{ ok: boolean; review: any }>("/api/experience/reviews", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async listProductQuestions(productId: string) {
    return request<{ questions: any[] }>(`/api/experience/questions/${encodeURIComponent(productId)}`);
  },

  async submitProductQuestion(payload: { productId: string; productName?: string; name: string; email: string; question: string }) {
    return request<{ ok: boolean; question: any }>("/api/experience/questions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async adminExperienceQuestions() {
    return request<{ questions: any[] }>("/api/admin/experience/questions");
  },

  async adminAnswerProductQuestion(id: string, answer: string) {
    return request<{ question: any }>(`/api/admin/experience/questions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ answer }),
    });
  },

  async adminExperienceWaitlist() {
    return request<{ entries: any[] }>("/api/admin/experience/waitlist");
  },

  async adminUpdateWaitlist(id: string, status: "waiting" | "contacted" | "notified") {
    return request<{ entry: any }>(`/api/admin/experience/waitlist/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  async adminExperienceReviews() {
    return request<{ reviews: any[] }>("/api/admin/experience/reviews");
  },

  async adminModerateReview(id: string, status: "pending" | "approved" | "rejected") {
    return request<{ review: any }>(`/api/admin/experience/reviews/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  async listOrders() {
    return request<{ orders: any[] }>("/api/orders");
  },

  async updateOrderStatus(orderId: string, status: string) {
    return request<{ order: any }>(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  async refundOnlineOrder(orderId: string, reason?: string) {
    return request<{
      ok: boolean;
      order: any;
      stripeRefundId?: string | null;
      stripeRefundStatus?: string | null;
      statusEmailResult?: any;
      idempotent?: boolean;
    }>(`/api/orders/${encodeURIComponent(orderId)}/refund`, {
      method: "POST",
      body: JSON.stringify({ reason: reason || "Reembolso solicitado desde Administración" }),
    });
  },

  async getHerenciaIaCustomerStatus(email: string) {
    return request<{ registered: boolean; totalPaid: number; plantSpend: number; isVip: boolean; vipMinimumPlantSpend: number }>("/api/herencia-ia/customer-status", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async neuralCustomerChatEvent(payload: {
    type: "conversation.message" | "conversation.unanswered" | "conversation.intent" | "web.demand_signal";
    conversationId?: string;
    text?: string;
    intent?: string;
    topic?: string;
    suggestion?: string;
    page?: string;
  }) {
    return request<{ accepted: boolean; provisional: boolean; reason?: string | null }>("/api/neural/customer-chat-event", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },


  async neuralSelfTest() {
    return request<any>("/api/neural/self-test");
  },

  async neuralSelfModel() {
    return request<any>("/api/neural/self-model");
  },

  async neuralDemand() {
    return request<any>("/api/neural/learning/demand");
  },

  async neuralPatterns() {
    return request<any>("/api/neural/learning/patterns");
  },

  async neuralConversationLearning() {
    return request<any>("/api/neural/learning/conversations");
  },

  async neuralConsolidateConversations() {
    return request<any>("/api/neural/learning/conversations/consolidate", { method: "POST", body: "{}" });
  },

  async neuralResources() {
    return request<any>("/api/neural/governance/resources");
  },

  async neuralScheduler() {
    return request<any>("/api/neural/scheduler");
  },

  async neuralReflect() {
    return request<any>("/api/neural/reflect", { method: "POST", body: "{}" });
  },

  async neuralConsolidatePatterns() {
    return request<any>("/api/neural/learning/consolidate", { method: "POST", body: "{}" });
  },

  async neuralMentorStatus() {
    return request<any>("/api/neural/mentor/status");
  },

  async neuralMentorCandidates(limit = 30) {
    return request<{ candidates: any[] }>(`/api/neural/mentor/candidates?limit=${encodeURIComponent(String(limit))}`);
  },

  async neuralMentorTeach(topic: string, force = false) {
    return request<any>("/api/neural/mentor/teach", {
      method: "POST",
      body: JSON.stringify({ topic, force }),
    });
  },

  async neuralMentorCycle() {
    return request<any>("/api/neural/mentor/cycle", { method: "POST", body: "{}" });
  },

  async neuralMentorApprove(id: string) {
    return request<any>(`/api/neural/mentor/candidates/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      body: JSON.stringify({ approvedBy: "admin" }),
    });
  },

  async neuralMentorReject(id: string, reason = "No aprobado") {
    return request<any>(`/api/neural/mentor/candidates/${encodeURIComponent(id)}/reject`, {
      method: "POST",
      body: JSON.stringify({ rejectedBy: "admin", reason }),
    });
  },

  async neuralProactiveStatus() {
    return request<any>("/api/neural/proactive/status");
  },

  async neuralLabMutate(payload: { parentId: string; hypothesis: string; mutation?: Record<string, any> }) {
    return request<any>("/api/neural/lab/mutate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async neuralLabEvaluate(experimentId: string, metrics: Record<string, any>) {
    return request<any>("/api/neural/lab/evaluate", {
      method: "POST",
      body: JSON.stringify({ experimentId, metrics }),
    });
  },

  async neuralLabPromote(experimentId: string) {
    return request<any>(`/api/neural/lab/${encodeURIComponent(experimentId)}/promote`, {
      method: "POST",
      body: JSON.stringify({ approvedBy: "admin" }),
    });
  },

  async neuralLabRetire(experimentId: string, reason = "not_selected") {
    return request<any>(`/api/neural/lab/${encodeURIComponent(experimentId)}/retire`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  async neuralBrief() {
    return request<any>("/api/neural/brief");
  },

  async neuralStatus() {
    return request<any>("/api/neural/status");
  },

  async neuralAgents() {
    return request<{ agents: any[] }>("/api/neural/agents");
  },

  async neuralGoals() {
    return request<{ goals: any[] }>("/api/neural/goals");
  },

  async neuralCreateGoal(text: string) {
    return request<any>("/api/neural/goals", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },

  async neuralUpdateGoal(id: string, patch: Record<string, any>) {
    return request<any>(`/api/neural/goals/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async neuralDeleteGoal(id: string) {
    return request<any>(`/api/neural/goals/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  async neuralTasks(status?: string) {
    return request<{ tasks: any[] }>(`/api/neural/tasks?limit=1000${status ? `&status=${encodeURIComponent(status)}` : ""}`);
  },

  async neuralCodeReviews() {
    return request<{ reviews: any[] }>("/api/neural/code/reviews");
  },

  async neuralCodeTask(id: string) {
    return request<{ task: any }>(`/api/neural/code/${encodeURIComponent(id)}`);
  },

  async neuralChat(text: string, conversationId = "admin:default") {
    return request<any>("/api/neural/chat", {
      method: "POST",
      body: JSON.stringify({ text, conversationId }),
    });
  },

  async neuralCode(text: string, conversationId = "admin:code") {
    return request<any>("/api/neural/code", {
      method: "POST",
      body: JSON.stringify({ text, conversationId }),
    });
  },
  async neuralCodeJob(jobId: string) {
    return request<any>("/api/neural/code/jobs/" + encodeURIComponent(jobId));
  },

  async neuralCommand(text: string) {
    return request<any>("/api/neural/command", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },

  async neuralActivity() {
    return request<{ events: any[]; integrity?: any }>("/api/neural/activity");
  },

  async neuralMemory(query = "") {
    return request<{ items: any[]; stats?: any }>(`/api/neural/memory/search?q=${encodeURIComponent(query)}`);
  },

  async neuralSignals() {
    return request<{ signals: any[] }>("/api/neural/signals");
  },

  async neuralTwin() {
    return request<any>("/api/neural/twin");
  },

  async neuralObserveNow() {
    return request<any>("/api/neural/twin/observe", { method: "POST", body: "{}" });
  },

  async neuralPermissions() {
    return request<any>("/api/neural/permissions");
  },

  async neuralSetPermission(capability: string, mode: "AUTO" | "ASK" | "BLOCK") {
    return request<any>(`/api/neural/permissions/${encodeURIComponent(capability)}`, {
      method: "PATCH",
      body: JSON.stringify({ mode }),
    });
  },

  async neuralEmergencyStop() {
    return request<any>("/api/neural/emergency-stop", { method: "POST", body: "{}" });
  },

  async neuralResume() {
    return request<any>("/api/neural/resume", { method: "POST", body: "{}" });
  },

  async neuralApproveTask(id: string) {
    return request<any>(`/api/neural/tasks/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      body: JSON.stringify({ approvedBy: "admin" }),
    });
  },

  async neuralApproveCodeTask(id: string) {
    return request<any>(`/api/neural/code/${encodeURIComponent(id)}/approve`, {
      method: "POST",
      body: JSON.stringify({ approvedBy: "admin" }),
    });
  },

  async neuralCodePreview(id: string) {
    return request<any>(`/api/neural/code/${encodeURIComponent(id)}/preview`);
  },

  async neuralRepairCodePreview(id: string) {
    return request<any>(`/api/neural/code/${encodeURIComponent(id)}/repair`, {
      method: "POST",
      body: JSON.stringify({ approvedBy: "admin" }),
    });
  },

  async neuralAcceptCodePreview(id: string) {
    return request<any>(`/api/neural/code/${encodeURIComponent(id)}/accept`, {
      method: "POST",
      body: JSON.stringify({ approvedBy: "admin" }),
    });
  },

  async neuralDiscardAllPendingCode() {
    return request<{ count: number; failed: number; results: any[] }>("/api/neural/code/discard-pending", {
      method: "POST",
      body: JSON.stringify({ rejectedBy: "admin" }),
    });
  },

  async neuralDiscardCodePreview(id: string) {
    return request<any>(`/api/neural/code/${encodeURIComponent(id)}/discard`, {
      method: "POST",
      body: JSON.stringify({ rejectedBy: "admin" }),
    });
  },

  async neuralRejectTask(id: string) {
    return request<any>(`/api/neural/tasks/${encodeURIComponent(id)}/reject`, {
      method: "POST",
      body: JSON.stringify({ rejectedBy: "admin" }),
    });
  },

  async neuralTraces() {
    return request<{ traces: any[] }>("/api/neural/traces");
  },

  async neuralTraceByAction(actionId: string) {
    return request<any>(`/api/neural/traces/action/${encodeURIComponent(actionId)}`);
  },

  async neuralResearchStatus() {
    return request<any>("/api/neural/research/status");
  },

  async neuralWebDrafts() {
    return request<{ drafts: any[] }>("/api/neural/web/drafts");
  },

  async neuralWebVersions() {
    return request<{ versions: any[] }>("/api/neural/web/versions");
  },

  async neuralCreateWebDraft(payload: { title?: string; operations: any[] }) {
    return request<any>("/api/neural/web/drafts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async neuralRequestPublish(draftId: string, reason?: string) {
    return request<any>(`/api/neural/web/drafts/${encodeURIComponent(draftId)}/request-publish`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  async neuralRequestRollback(versionId: string) {
    return request<any>(`/api/neural/web/versions/${encodeURIComponent(versionId)}/request-rollback`, {
      method: "POST",
      body: "{}",
    });
  },

  async neuralSendCellMessage(payload: { from: string; to: string; message: string; topic?: string; data?: any }) {
    return request<any>("/api/neural/cells/message", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async neuralLab() {
    return request<{ experiments: any[] }>("/api/neural/lab");
  },

  async neuralGraph() {
    return request<any>("/api/neural/graph");
  },

  async generateProductImage(payload: { prompt: string; references?: Array<{ image: string }>; outputType?: "photo" | "collage" }) {
    return request<{ image: string; model?: string }>("/api/admin/ai/product-image", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async generateCommerceDescription(payload: { name: string; category?: string; facts?: string; variants?: string[] }) {
    return request<{ description: string; reviewRequired: boolean }>("/api/admin/ai/product-description", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async generatePlantDescription(payload: { plantName: string; baseDescription?: string }) {
    return request<{ result: any }>("/api/ai/plant-description", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async generateBouquet(payload: BouquetPayload): Promise<BouquetResult> {
    const warnings: string[] = [];
    const localProposal = createLocalBouquetProposal(payload);

    try {
      const backendResult = await request<BouquetResult>("/api/ai/bouquet", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const proposal = {
        ...localProposal,
        ...(backendResult.proposal || {}),
        imagePrompt: backendResult.proposal?.imagePrompt || localProposal.imagePrompt,
      };

      warnings.push(...(backendResult.warnings || []));

      if (backendResult.imageGeneratedByAi && backendResult.image) {
        return {
          ...backendResult,
          proposal,
          warnings,
        };
      }

      try {
        const image = await generateBouquetImageInBrowser(proposal.imagePrompt || localProposal.imagePrompt);
        return {
          proposal,
          image,
          imageGeneratedByAi: true,
          source: "browser-gemini",
          warnings,
        };
      } catch (imageError) {
        warnings.push(getErrorMessage(imageError));
        return {
          proposal,
          image: backendResult.image || pickFallbackBouquetImage(payload),
          imageGeneratedByAi: false,
          source: backendResult.source || "catalog-fallback",
          warnings,
        };
      }
    } catch (backendError) {
      warnings.push(getErrorMessage(backendError));

      try {
        const image = await generateBouquetImageInBrowser(localProposal.imagePrompt);
        return {
          proposal: localProposal,
          image,
          imageGeneratedByAi: true,
          source: "browser-gemini-after-backend-error",
          warnings,
        };
      } catch (imageError) {
        warnings.push(getErrorMessage(imageError));
        return {
          proposal: localProposal,
          image: pickFallbackBouquetImage(payload),
          imageGeneratedByAi: false,
          source: "catalog-fallback-after-backend-error",
          warnings,
        };
      }
    }
  },
};

export const backendStorage = {
  getItem(key: string): StoredValue {
    return cache.get(key) ?? readLocalStorage(key);
  },

  setCachedItem(key: string, value: string) {
    const sanitized = sanitizeForClient(key, value);
    cache.set(key, sanitized);
    writeLocalStorage(key, sanitized);
  },

  async setItem(key: string, value: string): Promise<BackendStorageResult> {
    const sanitized = sanitizeForClient(key, value);
    cache.set(key, sanitized);
    writeLocalStorage(key, sanitized);
    emitChange();

    return syncStorageValue(key, sanitized);
  },

  async removeItem(key: string): Promise<BackendStorageResult> {
    cache.delete(key);
    removeLocalStorage(key);
    emitChange();

    return deleteStorageValue(key);
  },

  async refresh() {
    preloadPromise = null;
    await backendApi.preload();
    emitChange();
  },

  async verifyConnection() {
    await backendApi.health();
    await backendApi.preload();
    return { ok: backendApi.available, apiBase: API_BASE, lastError: lastBackendError };
  },
};
