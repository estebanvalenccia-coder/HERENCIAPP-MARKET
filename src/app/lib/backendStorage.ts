const DEFAULT_API_BASE = "https://herenciapp-market-production.up.railway.app";

function normalizeApiBase(value?: string) {
  const rawValue = (value || DEFAULT_API_BASE).trim();
  const withoutTrailingSlash = rawValue.replace(/\/$/, "");

  if (/^https?:\/\//i.test(withoutTrailingSlash) || withoutTrailingSlash.startsWith("/")) {
    return withoutTrailingSlash;
  }

  return `https://${withoutTrailingSlash}`;
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL);
let backendAvailable = Boolean(API_BASE);
let lastBackendError: string | null = null;

type StoredValue = string | null;
type BackendStorageResult = {
  ok: boolean;
  synced: boolean;
  local: boolean;
  error?: string;
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
  "adminFlowerCosts",
  "adminLatestFlowerQuote",
  "heroBanner",
  "ctaBanner",
  "__backendStorage_test__",
  "cart",
  "user",
]);

function shouldSyncWithBackend(key: string) {
  return Boolean(API_BASE) && remotelySyncedKeys.has(key);
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

let preloadPromise: Promise<void> | null = null;

const emitChange = () => {
  window.dispatchEvent(new Event("backend-storage"));
  window.dispatchEvent(new Event("storage"));
};

function emitBackendError(action: string, key: string, error: unknown) {
  const message = getErrorMessage(error);
  lastBackendError = message;
  backendAvailable = false;

  console.error(`[backendStorage] ${action} falló para ${key}:`, message);

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
  if (!API_BASE) {
    throw new Error("Backend no configurado. Define VITE_API_URL o revisa DEFAULT_API_BASE.");
  }

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
    return Boolean(API_BASE) && backendAvailable;
  },
  get lastError() {
    return lastBackendError;
  },

  async health() {
    return request<{ ok: boolean; service?: string }>("/api/health");
  },

  async preload() {
    if (!API_BASE) {
      preloadPromise = Promise.resolve();
      return preloadPromise;
    }

    if (!preloadPromise) {
      preloadPromise = request<{ data: Record<string, string> }>("/api/storage")
        .then(({ data }) => {
          Object.entries(data || {}).forEach(([key, value]) => cache.set(key, sanitizeForClient(key, value)));
        })
        .catch((error) => {
          emitBackendError("precargar", "app_storage", error);
          // La app puede abrir con copia local, pero ya no se oculta el error.
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

  async createPaymentIntent(payload: any) {
    return request<{ clientSecret: string; paymentIntentId: string; orderId: string }>("/api/stripe/create-payment-intent", {
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

  async createOrder(payload: any) {
    return request<{ order: any }>("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload),
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

  async generatePlantDescription(payload: { plantName: string; baseDescription?: string }) {
    return request<{ result: any }>("/api/ai/plant-description", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async generateBouquet(payload: { description: string; budget: number; style: string; color: string; size: string }) {
    return request<{ proposal: any; image: string; imageGeneratedByAi: boolean }>("/api/ai/bouquet", {
      method: "POST",
      body: JSON.stringify(payload),
    });
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
    return { ok: backendApi.enabled, apiBase: API_BASE, lastError: lastBackendError };
  },
};
