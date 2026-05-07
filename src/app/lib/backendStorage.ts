const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const HAS_BACKEND = Boolean(API_BASE);

type StoredValue = string | null;
const cache = new Map<string, string>();

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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!HAS_BACKEND) {
    throw new Error("Backend no configurado. Define VITE_API_URL para activar la API.");
  }

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
}

export const backendApi = {
  baseUrl: API_BASE,
  enabled: HAS_BACKEND,

  async preload() {
    if (!HAS_BACKEND) {
      preloadPromise = Promise.resolve();
      return preloadPromise;
    }

    if (!preloadPromise) {
      preloadPromise = request<{ data: Record<string, string> }>("/api/storage")
        .then(({ data }) => {
          Object.entries(data || {}).forEach(([key, value]) => cache.set(key, sanitizeForClient(key, value)));
        })
        .catch((error) => {
          console.warn("No se pudo conectar con el backend. La tienda seguirá usando datos locales.", error);
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

    if (HAS_BACKEND) {
      fetch(`${API_BASE}/api/storage/${encodeURIComponent(key)}`, {
        credentials: "include",
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      }).catch((error) => console.warn(`No se pudo guardar ${key} en backend`, error));
    }

    emitChange();
  },

  removeItem(key: string) {
    cache.delete(key);
    removeLocalStorage(key);

    if (HAS_BACKEND) {
      fetch(`${API_BASE}/api/storage/${encodeURIComponent(key)}`, {
        credentials: "include",
        method: "DELETE",
      }).catch((error) => console.warn(`No se pudo eliminar ${key} del backend`, error));
    }

    emitChange();
  },

  async refresh() {
    preloadPromise = null;
    await backendApi.preload();
    emitChange();
  },
};
