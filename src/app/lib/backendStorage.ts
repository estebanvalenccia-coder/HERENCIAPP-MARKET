const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
let backendAvailable = Boolean(API_BASE);

type StoredValue = string | null;
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
  "heroBanner",
  "ctaBanner",
  "__backendStorage_test__",
  "cart",
  "user",
]);

function shouldSyncWithBackend(key: string) {
  return backendAvailable && remotelySyncedKeys.has(key);
}

function sanitizeForClient(_key: string, value: string) {
  return value;
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
    // No hacemos nada: puede fallar si el navegador bloquea localStorage.
  }
}

function removeLocalStorage(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // No hacemos nada: puede fallar si el navegador bloquea localStorage.
  }
}

let preloadPromise: Promise<void> | null = null;

const emitChange = () => {
  window.dispatchEvent(new Event("backend-storage"));
  window.dispatchEvent(new Event("storage"));
};

function disableBackendFallback() {
  backendAvailable = false;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!backendAvailable) {
    throw new Error("Backend no disponible. Se está usando almacenamiento local.");
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `Error HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    disableBackendFallback();
    throw error;
  }
}

export const backendApi = {
  baseUrl: API_BASE,
  get enabled() {
    return backendAvailable;
  },

  async preload() {
    if (!backendAvailable) {
      preloadPromise = Promise.resolve();
      return preloadPromise;
    }

    if (!preloadPromise) {
      preloadPromise = request<{ data: Record<string, string> }>("/api/storage")
        .then(({ data }) => {
          Object.entries(data || {}).forEach(([key, value]) => cache.set(key, sanitizeForClient(key, value)));
        })
        .catch(() => {
          disableBackendFallback();
          // Silencioso a propósito: si la API falla por CORS o está caída, la tienda sigue en modo local.
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
};

export const backendStorage = {
  getItem(key: string): StoredValue {
    return cache.get(key) ?? readLocalStorage(key);
  },

  setItem(key: string, value: string) {
    cache.set(key, sanitizeForClient(key, value));
    writeLocalStorage(key, value);

    if (shouldSyncWithBackend(key)) {
      fetch(`${API_BASE}/api/storage/${encodeURIComponent(key)}`, {
        credentials: "include",
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      }).catch(() => disableBackendFallback());
    }

    emitChange();
  },

  removeItem(key: string) {
    cache.delete(key);
    removeLocalStorage(key);

    if (shouldSyncWithBackend(key)) {
      fetch(`${API_BASE}/api/storage/${encodeURIComponent(key)}`, {
        credentials: "include",
        method: "DELETE",
      }).catch(() => disableBackendFallback());
    }

    emitChange();
  },

  async refresh() {
    preloadPromise = null;
    await backendApi.preload();
    emitChange();
  },
};
