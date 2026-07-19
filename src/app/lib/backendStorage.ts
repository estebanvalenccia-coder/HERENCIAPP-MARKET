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
  "adminFlowerCosts",
  "adminLatestFlowerQuote",
  "tpvLayoutSettings",
  "heroBanner",
  "ctaBanner",
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
    return Boolean(API_BASE);
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

  async calculateShipping(payload: ShippingAddressPayload) {
    return request<ShippingCalculationResult>("/api/shipping/calculate", {
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
