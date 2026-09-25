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

function getBrowserGeminiApiKey() {
  return (
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.VITE_GOOGLE_API_KEY ||
    import.meta.env.VITE_GOOGLE_GENERATIVE_AI_API_KEY ||
    ""
  );
}

function normalizeBouquetText(value: unknown, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function localBouquetName(description: string, color: string) {
  const clean = normalizeBouquetText(description, `Ramo ${color || "Herencia"}`)
    .replace(/^quiero\s+/i, "")
    .trim();
  const base = clean.length > 42 ? `${clean.slice(0, 42)}...` : clean;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function pickFallbackBouquetImage(payload: Partial<BouquetPayload>) {
  const seed = `${payload.description || ""}-${payload.color || ""}-${payload.style || ""}`
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return fallbackBouquetImages[Math.abs(seed) % fallbackBouquetImages.length];
}

function createLocalBouquetProposal(payload: BouquetPayload) {
  const description = normalizeBouquetText(payload.description, "ramo elegante de flores frescas");
  const budget = Number(payload.budget || 49.9);
  const style = normalizeBouquetText(payload.style, "Elegante");
  const color = normalizeBouquetText(payload.color, "Mix");
  const size = normalizeBouquetText(payload.size, "M");

  const recommendedFlowers =
    color.toLowerCase() === "rojo"
      ? ["Rosa roja", "Eucalipto", "Paniculata", "Ruscus verde"]
      : color.toLowerCase() === "blanco"
        ? ["Rosa blanca", "Lirio blanco", "Paniculata", "Eucalipto"]
        : color.toLowerCase() === "amarillo"
          ? ["Girasol", "Rosa crema", "Solidago", "Eucalipto"]
          : ["Rosa", "Tulipán", "Paniculata", "Eucalipto"];

  return {
    name: localBouquetName(description, color),
    shortDescription: `Ramo ${style.toLowerCase()} tamaño ${size} desde ${budget.toFixed(2)} €`,
    description: `Ramo ${style.toLowerCase()} en tonos ${color.toLowerCase()}, pensado para Herencia Market. Una composición fresca, bonita y comercial para regalar en ocasiones especiales.`,
    recommendedFlowers,
    imagePrompt: `Fotografía profesional, realista y premium de ecommerce de UN RAMO COMPLETO de flores frescas, estilo ${style.toLowerCase()}, color principal ${color.toLowerCase()}, presupuesto ${budget.toFixed(2)} €, tamaño ${size}. Idea del cliente: ${description}. El ramo debe verse entero, centrado, con envoltorio elegante de floristería, composición abundante y bonita, luz cálida natural, fondo limpio, sin texto, sin logos, sin marcas de agua, sin personas, sin manos, sin jarrón si no se pide.`,
    sellingTip: "Ideal para vender como ramo premium personalizado.",
  };
}

async function generateBouquetImageInBrowser(prompt: string) {
  const apiKey = getBrowserGeminiApiKey();

  if (!apiKey) {
    throw new Error("Falta VITE_GEMINI_API_KEY en Vercel para generar imágenes IA en el navegador");
  }

  const models = [
    import.meta.env.VITE_GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image-preview",
    "gemini-2.5-flash-image",
  ].filter(Boolean);

  let lastError = "";

  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${prompt}\n\nGenera SOLO una imagen fotorealista cuadrada de producto para catálogo online. El ramo debe verse completo, bonito, vendible y profesional. Sin texto ni personas.`,
                },
              ],
            },
          ],
        }),
      }
    );

    const text = await response.text().catch(() => "");

    if (!response.ok) {
      lastError = text || `Gemini respondió ${response.status}`;
      continue;
    }

    const data = text ? JSON.parse(text) : {};
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part: any) => part.inlineData?.data || part.inline_data?.data);
    const inlineData = imagePart?.inlineData || imagePart?.inline_data;

    if (inlineData?.data) {
      return `data:${inlineData.mimeType || inlineData.mime_type || "image/png"};base64,${inlineData.data}`;
    }

    lastError = "Gemini respondió sin imagen";
  }

  throw new Error(lastError || "Gemini no devolvió imagen");
}

function isAiImage(image: string) {
  return image.startsWith("data:image/") || image.includes("generativelanguage") || image.includes("nananobanana");
}

let preloadPromise: Promise<void> | null = null;
let lastBackendConsoleSignature = "";
let lastBackendConsoleAt = 0;

const emitChange = () => {
  window.dispatchEvent(new Event("backend-storage"));
  window.dispatchEvent(new Event("storage"));
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

  async adminLogin(username: string, password: string) {
    return request<{ ok: boolean }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },

  async adminLogout() {
    return request<{ ok: boolean }>("/api/admin/logout", { method: "POST" });
  },

  async adminSession() {
    return request<{ authenticated: boolean }>("/api/admin/session");
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

  async deleteSiteMedia(path: string) {
    return request<{ ok: boolean }>("/api/admin/media", {
      method: "DELETE",
      body: JSON.stringify({ path }),
    });
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
    return request<{ clientSecret: string; paymentIntentId: string; orderId: string; totals?: { subtotal: number; shipping: number; total: number }; shippingQuote?: any }>("/api/stripe/create-payment-intent", {
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

  async getHerenciaIaCustomerStatus(email: string) {
    return request<{ totalPaid: number; isVip: boolean }>("/api/herencia-ia/customer-status", {
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
    return request<{ tasks: any[] }>(`/api/neural/tasks${status ? `?status=${encodeURIComponent(status)}` : ""}`);
  },

  async neuralChat(text: string, conversationId = "admin:default") {
    return request<any>("/api/neural/chat", {
      method: "POST",
      body: JSON.stringify({ text, conversationId }),
    });
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

      if (backendResult.imageGeneratedByAi && backendResult.image && isAiImage(backendResult.image)) {
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
