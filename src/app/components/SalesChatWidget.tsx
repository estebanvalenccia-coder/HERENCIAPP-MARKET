import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Flower2,
  Gift,
  ImageIcon,
  Leaf,
  Loader2,
  MessageCircle,
  Send,
  ShoppingCart,
  Sparkles,
  X,
} from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../lib/backendStorage";
import { parseBouquetCatalog } from "../lib/bouquetCatalog";
import { defaultSiteContent, parseSiteContent, type SiteContent } from "../lib/siteContent";
import { getMarketExperience } from "../lib/marketExperience";
import { products as fallbackProducts } from "../data/products";

type SalesVariant = {
  id?: string;
  name: string;
  price?: number;
  stock?: number;
  image?: string;
};

type SalesProduct = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  type?: string;
  collections?: string[];
  price: number;
  salePrice?: number;
  onSale?: boolean;
  image?: string;
  stock?: number;
  trackInventory?: boolean;
  active?: boolean;
  status?: string;
  deletedAt?: string;
  variants?: SalesVariant[];
};

type BouquetDraft = {
  description: string;
  budget: number;
  style: string;
  color: string;
  size: "S" | "M" | "L" | "XL";
  readyToGenerate?: boolean;
};

type BouquetResult = {
  proposal: {
    name: string;
    description: string;
    recommendedFlowers: string[];
    imagePrompt: string;
  };
  image: string;
  price: number;
  size: string;
  currency: string;
  disclaimer: string;
};

type SpacePreviewResult = {
  image: string;
  productId: string;
  productName: string;
  productImage?: string;
  price: number;
  currency: string;
  disclaimer: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  productIds?: string[];
  bouquetDraft?: BouquetDraft | null;
  bouquetResult?: BouquetResult | null;
  spacePreview?: SpacePreviewResult | null;
};

const SALES_SESSION_KEY = "herencia_sales_messages_v2";
const SALES_CONVERSATION_KEY = "herencia_sales_conversation_id";
const fallbackBouquetImage =
  "https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=900&q=82";

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getConversationId() {
  try {
    const existing = sessionStorage.getItem(SALES_CONVERSATION_KEY);
    if (existing) return existing;
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : newId();
    sessionStorage.setItem(SALES_CONVERSATION_KEY, id);
    return id;
  } catch {
    return newId();
  }
}

function normalizeProduct(product: any): SalesProduct {
  return {
    ...product,
    id: String(product?.id ?? ""),
    name: String(product?.name || "Producto"),
    description: String(product?.description || ""),
    category: String(product?.category || ""),
    type: String(product?.type || ""),
    collections: Array.isArray(product?.collections) ? product.collections.map(String) : [],
    price: Math.max(0, Number(product?.price || 0)),
    salePrice: product?.salePrice == null ? undefined : Math.max(0, Number(product.salePrice || 0)),
    onSale: Boolean(product?.onSale),
    image: String(product?.image || product?.imageUrl || ""),
    stock: Math.max(0, Math.floor(Number(product?.stock || 0))),
    trackInventory: product?.trackInventory !== false,
    active: product?.active !== false,
    status: String(product?.status || "active"),
    deletedAt: product?.deletedAt ? String(product.deletedAt) : undefined,
    variants: Array.isArray(product?.variants)
      ? product.variants
          .map((variant: any) =>
            typeof variant === "string"
              ? { name: variant }
              : {
                  id: variant?.id ? String(variant.id) : undefined,
                  name: String(variant?.name || ""),
                  price: variant?.price == null ? undefined : Math.max(0, Number(variant.price || 0)),
                  stock: variant?.stock == null ? undefined : Math.max(0, Math.floor(Number(variant.stock || 0))),
                  image: variant?.image ? String(variant.image) : undefined,
                }
          )
          .filter((variant: SalesVariant) => variant.name)
      : [],
  };
}

function sellableCatalog(rows: any[]) {
  return rows
    .map(normalizeProduct)
    .filter((product) => product.id && product.name && product.active !== false && !product.deletedAt && product.status !== "archived");
}

function apiCatalog(products: SalesProduct[]) {
  return products.slice(0, 120).map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    type: product.type,
    collections: product.collections,
    price: product.price,
    salePrice: product.salePrice,
    onSale: product.onSale,
    stock: product.stock,
    trackInventory: product.trackInventory,
    active: product.active,
    status: product.status,
    description: product.description,
    image: product.image,
    variants: product.variants,
  }));
}

function loadPersistedMessages(): ChatMessage[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SALES_SESSION_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-40).map((message: any) => ({
      id: String(message?.id || newId()),
      role: message?.role === "user" ? "user" : "assistant",
      content: String(message?.content || ""),
      productIds: Array.isArray(message?.productIds) ? message.productIds.map(String) : undefined,
      bouquetDraft: message?.bouquetDraft || null,
    }));
  } catch {
    return [];
  }
}

function persistMessages(messages: ChatMessage[]) {
  try {
    const safe = messages.slice(-40).map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      productIds: message.productIds,
      bouquetDraft: message.bouquetDraft || null,
    }));
    sessionStorage.setItem(SALES_SESSION_KEY, JSON.stringify(safe));
  } catch {
    // El chat sigue funcionando aunque el navegador bloquee sessionStorage.
  }
}

function analyticsAllowed() {
  try {
    return localStorage.getItem("herencia_cookie_consent") === "accepted";
  } catch {
    return false;
  }
}

function trackSalesEvent(
  eventType: string,
  payload: { eventLabel?: string; productId?: string; amount?: number; metadata?: Record<string, any>; conversationId?: string } = {}
) {
  if (!analyticsAllowed()) return;
  try {
    void fetch("/api/analytics/visit", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        path: window.location.pathname + window.location.search,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
        language: navigator.language || "",
        sessionId: payload.conversationId || "",
        eventLabel: payload.eventLabel || "",
        productId: payload.productId || "",
        amount: Number(payload.amount || 0),
        metadata: payload.metadata || {},
      }),
    });
  } catch {
    // La analítica nunca debe impedir la venta.
  }
}

function productPrice(product: SalesProduct, variant?: SalesVariant | null) {
  const variantPrice = Number(variant?.price);
  if (Number.isFinite(variantPrice) && variantPrice > 0) return variantPrice;
  if (product.onSale && Number(product.salePrice || 0) > 0) return Number(product.salePrice);
  return Number(product.price || 0);
}

function productStock(product: SalesProduct, variant?: SalesVariant | null) {
  if (product.trackInventory === false) return Number.POSITIVE_INFINITY;
  const variantStock = variant?.stock;
  return Math.max(0, Math.floor(Number(variantStock ?? product.stock ?? 0)));
}

const iconByAction = {
  bouquet: Flower2,
  plant: Leaf,
  photo: Camera,
  gift: Gift,
  surprise: Sparkles,
} as const;

export function SalesChatWidget() {
  const navigate = useNavigate();
  const conversationId = useMemo(() => getConversationId(), []);
  const [open, setOpen] = useState(false);
  const [site, setSite] = useState<SiteContent>(defaultSiteContent);
  const [catalog, setCatalog] = useState<SalesProduct[]>(() => {
    try {
      const cached = JSON.parse(backendStorage.getItem("adminProducts") || "[]");
      if (Array.isArray(cached) && cached.length) return sellableCatalog(cached);
    } catch {}
    return sellableCatalog(fallbackProducts);
  });
  const [messages, setMessages] = useState<ChatMessage[]>(loadPersistedMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(false);
  const [spaceLoading, setSpaceLoading] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [spaceTargetProduct, setSpaceTargetProduct] = useState<SalesProduct | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const spaceFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadSite = () => setSite(parseSiteContent(backendStorage.getItem("siteContent")));
    loadSite();
    window.addEventListener("storage", loadSite);
    window.addEventListener("backend-storage", loadSite);
    return () => {
      window.removeEventListener("storage", loadSite);
      window.removeEventListener("backend-storage", loadSite);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadCatalog = async () => {
      try {
        setCatalogLoading(true);
        const result = await backendApi.listCommerceProducts();
        const next = sellableCatalog(Array.isArray(result.products) ? result.products : []);
        if (active && next.length) {
          setCatalog(next);
          return;
        }
      } catch (error) {
        console.warn("[HERENCIA SALES] catálogo Commerce no disponible:", error);
      } finally {
        if (active) setCatalogLoading(false);
      }

      try {
        const cached = JSON.parse(backendStorage.getItem("adminProducts") || "[]");
        const next = sellableCatalog(Array.isArray(cached) ? cached : []);
        if (active && next.length) setCatalog(next);
      } catch {}
    };

    void loadCatalog();
    const refresh = () => void loadCatalog();
    window.addEventListener("commerce-products-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("commerce-products-changed", refresh);
    };
  }, []);

  useEffect(() => {
    persistMessages(messages);
  }, [messages]);

  const market = useMemo(() => getMarketExperience(site), [site]);
  const sales = market.sales;

  useEffect(() => {
    setMessages((current) => {
      if (current.length) return current;
      return [{ id: "welcome", role: "assistant", content: sales.prompt }];
    });
  }, [sales.prompt]);

  const productMap = useMemo(
    () => new Map(catalog.map((product) => [String(product.id), product])),
    [catalog]
  );

  const spaceProducts = useMemo(
    () =>
      catalog
        .filter((product) =>
          product.type === "plant" ||
          product.collections?.includes("plantas") ||
          /planta|orqu|monstera|ficus|pothos|cactus/i.test(`${product.category} ${product.name}`)
        )
        .filter((product) => productStock(product) > 0)
        .slice(0, 10),
    [catalog]
  );

  if (!sales.enabled) return null;

  const currentVariant = (product: SalesProduct) => {
    const variants = product.variants || [];
    if (!variants.length) return null;
    return variants.find((variant) => variant.name === selectedVariants[product.id]) ||
      variants.find((variant) => productStock(product, variant) > 0) ||
      variants[0];
  };

  const history = () =>
    messages
      .filter((message) => message.id !== "welcome")
      .slice(-12)
      .map((message) => ({ role: message.role, content: message.content }));

  const goBack = () => {
    setInput("");
    if (messages.length > 1) {
      const next: ChatMessage[] = [{ id: "welcome", role: "assistant", content: sales.prompt }];
      setMessages(next);
      persistMessages(next);
      return;
    }
    setOpen(false);
  };

  const send = async (forced?: string) => {
    const text = String(forced ?? input).trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = { id: newId(), role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    trackSalesEvent("sales_message", { conversationId, eventLabel: text.slice(0, 120) });

    try {
      const response = await fetch("/api/ai/sales-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: history(),
          catalog: apiCatalog(catalog),
          conversationId,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No se pudo responder.");

      const ids = Array.isArray(data.productIds) ? data.productIds.map(String) : [];
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: data.reply,
          productIds: ids,
          bouquetDraft: data.bouquet || null,
        },
      ]);
      if (ids.length) {
        trackSalesEvent("sales_recommendation", {
          conversationId,
          eventLabel: data.intent || "recommendation",
          metadata: { productIds: ids },
        });
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content:
            "Ahora mismo la IA no puede responder, pero sigo conectado al catálogo real. Puedes usar las acciones rápidas, buscar por foto o abrir la tienda.",
        },
      ]);
      toast.error(error instanceof Error ? error.message : "Error en Herencia Sales");
    } finally {
      setLoading(false);
    }
  };

  const generateBouquet = async (draft: BouquetDraft) => {
    if (imageLoading) return;
    setImageLoading(true);

    try {
      const flowerCatalog = parseBouquetCatalog(backendStorage.getItem("bouquetCatalog"))
        .filter((flower) => flower.active)
        .map((flower) => ({
          id: flower.id,
          name: flower.name,
          category: flower.category,
          price: flower.price,
        }));

      const response = await fetch("/api/ai/sales-bouquet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, flowerCatalog, conversationId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No se pudo generar el ramo.");

      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: `He preparado una propuesta visual para ti por ${Number(data.price).toFixed(2)} €.`,
          bouquetResult: data,
        },
      ]);
      trackSalesEvent("sales_bouquet_generated", {
        conversationId,
        amount: Number(data.price || 0),
        eventLabel: data?.proposal?.name || "Ramo IA",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo generar la imagen");
    } finally {
      setImageLoading(false);
    }
  };

  const addProduct = async (product: SalesProduct, goCheckout = false) => {
    const variant = currentVariant(product);
    const available = productStock(product, variant);
    if (product.trackInventory !== false && available <= 0) {
      toast.error("Este producto está agotado");
      return false;
    }

    let cart: any[] = [];
    try {
      cart = JSON.parse(backendStorage.getItem("cart") || "[]");
      if (!Array.isArray(cart)) cart = [];
    } catch {
      cart = [];
    }

    const variantName = variant?.name || "";
    const lineKey = `${product.id}::${variantName || "base"}::herencia-sales`;
    const existing = cart.find((item: any) => item.lineKey === lineKey);
    const nextQuantity = Number(existing?.quantity || 0) + 1;

    if (product.trackInventory !== false && nextQuantity > available) {
      toast.error(`Solo quedan ${available} unidades`);
      return false;
    }

    const price = productPrice(product, variant);
    const cartItem = {
      ...product,
      id: product.id,
      price,
      quantity: 1,
      lineKey,
      selectedVariant: variantName || undefined,
      image: variant?.image || product.image,
      salesSource: "HERENCIA_SALES",
      salesConversationId: conversationId,
    };

    if (existing) existing.quantity = nextQuantity;
    else cart.push(cartItem);

    const result = await backendStorage.setItem("cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("storage"));
    if (!result.ok) {
      toast.error(result.error || "No se pudo sincronizar el carrito");
      return false;
    }

    trackSalesEvent(goCheckout ? "sales_buy_now" : "sales_add_to_cart", {
      conversationId,
      productId: product.id,
      amount: price,
      eventLabel: product.name,
      metadata: { variant: variantName || null },
    });

    toast.success(goCheckout ? "Producto listo para comprar" : `${product.name} añadido al carrito`);
    if (goCheckout) {
      setOpen(false);
      navigate("/checkout");
    }
    return true;
  };

  const addBouquet = async (result: BouquetResult, goCheckout = false) => {
    let cart: any[] = [];
    try {
      cart = JSON.parse(backendStorage.getItem("cart") || "[]");
      if (!Array.isArray(cart)) cart = [];
    } catch {
      cart = [];
    }

    const image = String(result.image || "");
    cart.push({
      id: `sales-ai-${Date.now()}`,
      name: result.proposal.name || "Ramo personalizado Herencia",
      price: Number(result.price),
      quantity: 1,
      image: image.startsWith("data:") ? fallbackBouquetImage : image || fallbackBouquetImage,
      description: result.proposal.description,
      customBouquet: true,
      trackInventory: false,
      salesSource: "HERENCIA_SALES",
      salesConversationId: conversationId,
      bouquetDetails: {
        source: "HERENCIA_SALES_AI",
        size: result.size,
        recommendedFlowers: result.proposal.recommendedFlowers,
        imagePrompt: result.proposal.imagePrompt,
      },
    });

    const saved = await backendStorage.setItem("cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("storage"));
    if (!saved.ok) return toast.error(saved.error || "No se pudo sincronizar el carrito");

    trackSalesEvent(goCheckout ? "sales_buy_now" : "sales_add_to_cart", {
      conversationId,
      amount: Number(result.price || 0),
      eventLabel: result.proposal.name || "Ramo IA",
      metadata: { customBouquet: true, size: result.size },
    });

    toast.success(goCheckout ? "Ramo listo para comprar" : "Ramo personalizado añadido al carrito");
    if (goCheckout) {
      setOpen(false);
      navigate("/checkout");
    }
  };

  const openSpacePicker = () => {
    if (!spaceProducts.length) {
      toast.info("Ahora mismo no hay plantas disponibles para visualizar");
      return;
    }
    setMessages((prev) => [
      ...prev,
      {
        id: newId(),
        role: "assistant",
        content:
          "📐 Elige una planta disponible y después sube o toma una foto de tu salón, habitación, terraza, oficina o jardín.",
        productIds: spaceProducts.map((product) => product.id),
      },
    ]);
    setOpen(true);
  };

  const chooseSpaceProduct = (product: SalesProduct) => {
    if (productStock(product, currentVariant(product)) <= 0) return toast.error("Esta planta está agotada");
    setSpaceTargetProduct(product);
    window.setTimeout(() => spaceFileRef.current?.click(), 0);
  };

  const generateSpacePreview = async (file?: File) => {
    const product = spaceTargetProduct;
    if (!file || !product || spaceLoading) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("La foto del espacio debe pesar menos de 8 MB");
      return;
    }

    setSpaceLoading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("No se pudo leer la foto del espacio"));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1] || "";

      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "user", content: `📷 Quiero ver ${product.name} colocado en este espacio.` },
      ]);

      const response = await fetch("/api/ai/sales-space-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: base64,
          mimeType: file.type || "image/jpeg",
          productId: product.id,
          catalog: apiCatalog(catalog),
          conversationId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No se pudo generar la visualización");

      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: `Así podría quedar ${product.name} en tu espacio. Puedes comprarla o probar otra planta.`,
          spacePreview: { ...data, productId: String(data.productId) },
        },
      ]);

      trackSalesEvent("space_preview", {
        conversationId,
        productId: product.id,
        amount: productPrice(product, currentVariant(product)),
        eventLabel: product.name,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo generar la visualización");
    } finally {
      setSpaceLoading(false);
      setSpaceTargetProduct(null);
      if (spaceFileRef.current) spaceFileRef.current.value = "";
    }
  };

  const identifyImage = async (file?: File) => {
    if (!file || loading) return;
    if (file.size > 6 * 1024 * 1024) {
      toast.error("La imagen debe pesar menos de 6 MB");
      return;
    }

    setLoading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
        reader.readAsDataURL(file);
      });

      const base64 = dataUrl.split(",")[1] || "";
      const response = await fetch("/api/ai/sales-identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: base64,
          mimeType: file.type || "image/jpeg",
          catalog: apiCatalog(catalog),
          conversationId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No se pudo analizar la imagen");

      const ids = Array.isArray(data.productIds) ? data.productIds.map(String) : [];
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "user", content: "📷 Quiero comprar una planta o producto como el de esta foto." },
        { id: newId(), role: "assistant", content: data.reply, productIds: ids },
      ]);

      trackSalesEvent("sales_photo_search", {
        conversationId,
        eventLabel: data.identifiedName || "Búsqueda visual",
        metadata: { productIds: ids, confidence: data.confidence || null },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo analizar la imagen");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handoffToFlorist = async () => {
    if (handoffLoading) return;
    setHandoffLoading(true);
    try {
      const summary = messages
        .filter((message) => message.id !== "welcome")
        .slice(-12)
        .map((message) => `${message.role === "user" ? "Cliente" : "HERENCIA SALES"}: ${message.content}`)
        .join("\n");

      await backendApi.createOrder({
        id: `sales-handoff-${Date.now()}`,
        customerName: "Consulta HERENCIA SALES",
        paymentMethod: "pendiente",
        deliveryMethod: "consulta-floristeria",
        status: "pending_store_confirmation",
        subtotal: 0,
        shipping: 0,
        total: 0,
        items: [],
        metadata: {
          source: "HERENCIA_SALES_HANDOFF",
          type: "sales_handoff",
          herenciaSales: true,
          conversationId,
          notes: summary || "El cliente solicita atención de la floristería desde HERENCIA SALES.",
          salesConversation: messages
            .filter((message) => message.id !== "welcome")
            .slice(-12)
            .map((message) => ({ role: message.role, content: message.content })),
        },
      });

      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: "He enviado la conversación a la floristería. El equipo podrá revisar lo que estabas buscando sin que tengas que repetirlo.",
        },
      ]);
      trackSalesEvent("sales_handoff", { conversationId, eventLabel: "Floristería" });
      toast.success("Consulta enviada a la floristería");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar la consulta");
    } finally {
      setHandoffLoading(false);
    }
  };

  const openSales = () => {
    setOpen(true);
    trackSalesEvent("sales_open", { conversationId, eventLabel: "HERENCIA SALES" });
  };

  return (
    <>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void identifyImage(event.target.files?.[0])} />
      <input ref={spaceFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void generateSpacePreview(event.target.files?.[0])} />

      {!open ? (
        <button
          type="button"
          onClick={openSales}
          className="fixed bottom-6 right-5 z-[90] inline-flex h-14 items-center gap-2 rounded-full border border-white/20 bg-[#173d2a] px-5 text-sm font-black text-white shadow-[0_16px_42px_rgba(23,61,42,.32)] transition hover:-translate-y-1 hover:bg-[#234e37] sm:right-7"
          aria-label="Abrir HERENCIA SALES"
          title={sales.buttonLabel}
        >
          <Sparkles className="h-5 w-5 text-[#e7d7a8]" />
          <span>{sales.buttonLabel}</span>
        </button>
      ) : null}

      {open ? (
        <section className="fixed bottom-4 right-3 z-[110] flex h-[min(760px,90vh)] w-[min(460px,calc(100vw-24px))] flex-col overflow-hidden rounded-[28px] border border-[#d9ddd6] bg-[#fffdf9] text-[#173126] shadow-[0_24px_70px_rgba(25,47,34,.28)] sm:right-5">
          <header className="border-b border-white/10 bg-[#173d2a] px-5 pb-5 pt-4 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <button type="button" onClick={goBack} className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/20" aria-label="Volver al inicio de HERENCIA SALES">
                  <ArrowLeft className="h-4 w-4" /> Atrás
                </button>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/65">
                  <Sparkles className="h-4 w-4 text-[#e7d7a8]" /> Asistente comercial
                </div>
                <p className="mt-2 text-xl font-black leading-tight">{sales.title}</p>
                <p className="mt-1 text-sm text-white/78">{sales.prompt}</p>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-white/55">
                  {catalogLoading ? "Sincronizando catálogo…" : `${catalog.length} productos reales conectados`}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 transition hover:bg-white/10" aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto bg-[#f7f4ed] p-4">
            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "ml-10" : "mr-4"}>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === "user" ? "bg-[#315b42] text-white" : "border border-[#e0ddd5] bg-white"}`}>
                  {message.content}
                </div>

                {!!message.productIds?.length ? (
                  <div className="mt-2 space-y-2">
                    {message.productIds.map((id) => {
                      const product = productMap.get(String(id));
                      if (!product) return null;
                      const variant = currentVariant(product);
                      const price = productPrice(product, variant);
                      const stock = productStock(product, variant);
                      const soldOut = product.trackInventory !== false && stock <= 0;
                      const variants = product.variants || [];

                      return (
                        <div key={product.id} className="rounded-2xl border border-[#e0ddd5] bg-white p-3 shadow-sm">
                          <div className="flex gap-3">
                            <img src={variant?.image || product.image || fallbackBouquetImage} alt={product.name} className="h-20 w-20 rounded-xl object-cover" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-black">{product.name}</p>
                              <div className="mt-1 flex items-center gap-2">
                                <p className="text-sm font-black text-[#315b42]">{price.toFixed(2)} €</p>
                                {product.onSale && Number(product.price) > price ? (
                                  <span className="text-xs text-[#8b938d] line-through">{Number(product.price).toFixed(2)} €</span>
                                ) : null}
                              </div>
                              <p className={`mt-1 text-[11px] font-bold ${soldOut ? "text-rose-600" : "text-[#6d776f]"}`}>
                                {product.trackInventory === false ? "Disponible" : soldOut ? "Agotado" : stock <= 5 ? `Solo ${stock} disponibles` : "En stock"}
                              </p>
                            </div>
                          </div>

                          {variants.length ? (
                            <select
                              value={variant?.name || ""}
                              onChange={(event) => setSelectedVariants((current) => ({ ...current, [product.id]: event.target.value }))}
                              className="mt-3 w-full rounded-xl border border-[#ded9cd] bg-[#fbfaf6] px-3 py-2 text-xs font-bold outline-none"
                            >
                              {variants.map((option) => (
                                <option key={option.id || option.name} value={option.name} disabled={product.trackInventory !== false && productStock(product, option) <= 0}>
                                  {option.name}
                                  {Number(option.price || 0) > 0 ? ` · ${Number(option.price).toFixed(2)} €` : ""}
                                  {product.trackInventory !== false && productStock(product, option) <= 0 ? " · agotado" : ""}
                                </option>
                              ))}
                            </select>
                          ) : null}

                          <div className="mt-3 flex flex-wrap gap-2">
                            <a href={`/producto/${product.id}`} className="rounded-lg border border-[#ded9cd] px-2.5 py-1.5 text-xs font-bold hover:bg-[#f5f1e9]">Ver</a>
                            <button type="button" onClick={() => void addProduct(product)} disabled={soldOut} className="flex items-center gap-1 rounded-lg bg-[#315b42] px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-40">
                              <ShoppingCart className="h-3.5 w-3.5" /> Añadir
                            </button>
                            <button type="button" onClick={() => void addProduct(product, true)} disabled={soldOut} className="rounded-lg bg-[#173d2a] px-2.5 py-1.5 text-xs font-black text-white disabled:opacity-40">
                              Comprar ahora
                            </button>
                            {spaceProducts.some((item) => item.id === product.id) ? (
                              <button type="button" onClick={() => chooseSpaceProduct(product)} disabled={spaceLoading || soldOut} className="flex items-center gap-1 rounded-lg border border-[#315b42]/30 bg-[#eef2eb] px-2.5 py-1.5 text-xs font-bold text-[#315b42] disabled:opacity-40">
                                <ImageIcon className="h-3.5 w-3.5" /> Ver en mi espacio
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {message.bouquetDraft?.readyToGenerate ? (
                  <button type="button" onClick={() => void generateBouquet(message.bouquetDraft!)} disabled={imageLoading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#315b42] px-4 py-3 text-sm font-black text-white disabled:opacity-60">
                    {imageLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                    {imageLoading ? "Creando propuesta..." : "Ver cómo quedaría"}
                  </button>
                ) : null}

                {message.spacePreview ? (
                  <div className="mt-2 overflow-hidden rounded-2xl border border-[#e0ddd5] bg-white shadow-sm">
                    <div className="relative">
                      <img src={message.spacePreview.image} alt={`${message.spacePreview.productName} en el espacio del cliente`} className="aspect-square w-full object-cover" />
                      <span className="absolute left-3 top-3 rounded-full bg-[#173d2a]/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white">Vista IA en tu espacio</span>
                    </div>
                    <div className="p-4">
                      <p className="font-black">{message.spacePreview.productName}</p>
                      <p className="mt-1 text-xl font-black text-[#315b42]">{Number(message.spacePreview.price).toFixed(2)} €</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => { const product = productMap.get(String(message.spacePreview!.productId)); if (product) void addProduct(product, true); }} className="flex items-center gap-2 rounded-xl bg-[#315b42] px-4 py-2.5 text-sm font-black text-white">
                          <ShoppingCart className="h-4 w-4" /> Comprar esta planta
                        </button>
                        <button type="button" onClick={openSpacePicker} className="flex items-center gap-2 rounded-xl border border-[#ded9cd] px-4 py-2.5 text-sm font-black">
                          <Sparkles className="h-4 w-4" /> Probar otra
                        </button>
                      </div>
                      <p className="mt-3 text-[11px] leading-relaxed text-[#6d776f]">{message.spacePreview.disclaimer}</p>
                    </div>
                  </div>
                ) : null}

                {message.bouquetResult ? (
                  <div className="mt-2 overflow-hidden rounded-2xl border border-[#e0ddd5] bg-white">
                    <img src={message.bouquetResult.image || fallbackBouquetImage} alt={message.bouquetResult.proposal.name} className="aspect-square w-full object-cover" />
                    <div className="p-4">
                      <p className="font-black">{message.bouquetResult.proposal.name}</p>
                      <p className="mt-1 text-sm text-[#6d776f]">{message.bouquetResult.proposal.description}</p>
                      {!!message.bouquetResult.proposal.recommendedFlowers?.length && (
                        <p className="mt-2 text-xs text-[#6d776f]">Composición: {message.bouquetResult.proposal.recommendedFlowers.join(", ")}</p>
                      )}
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <div><p className="text-xs text-[#6d776f]">Precio</p><p className="text-xl font-black text-[#315b42]">{Number(message.bouquetResult.price).toFixed(2)} €</p></div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => void addBouquet(message.bouquetResult!)} className="flex items-center gap-2 rounded-xl border border-[#315b42] px-3 py-2.5 text-sm font-black text-[#315b42]">
                            <ShoppingCart className="h-4 w-4" /> Añadir
                          </button>
                          <button type="button" onClick={() => void addBouquet(message.bouquetResult!, true)} className="rounded-xl bg-[#315b42] px-3 py-2.5 text-sm font-black text-white">Comprar ahora</button>
                        </div>
                      </div>
                      <p className="mt-3 text-[11px] leading-relaxed text-[#6d776f]">{message.bouquetResult.disclaimer}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}

            {messages.length <= 1 ? (
              <div className="space-y-2">
                {sales.quickActions.map((action) => {
                  const Icon = iconByAction[action.id] || Sparkles;
                  return (
                    <button key={action.id} type="button" onClick={() => { if (action.id === "photo") fileRef.current?.click(); else void send(action.prompt); }} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-[#dfdbd1] bg-white px-4 py-3 text-left text-sm font-black shadow-sm transition hover:border-[#315b42]/40 hover:bg-[#fdfbf6]">
                      <span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#eef2eb] text-[#315b42]"><Icon className="h-4 w-4" /></span>{action.label}</span><span className="text-[#879287]">›</span>
                    </button>
                  );
                })}
                <button type="button" onClick={openSpacePicker} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-[#315b42]/25 bg-[#eef2eb] px-4 py-3 text-left text-sm font-black shadow-sm transition hover:border-[#315b42]/50">
                  <span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#315b42]"><ImageIcon className="h-4 w-4" /></span>Ver una planta en mi espacio</span><span className="text-[#879287]">›</span>
                </button>
              </div>
            ) : null}

            {loading ? <div className="mr-16 flex items-center gap-2 rounded-2xl border border-[#e0ddd5] bg-white px-4 py-3 text-sm text-[#6d776f]"><Loader2 className="h-4 w-4 animate-spin" /> Buscando en el catálogo real…</div> : null}
            {spaceLoading ? <div className="mr-10 flex items-center gap-2 rounded-2xl border border-[#cfd9cf] bg-[#eef2eb] px-4 py-3 text-sm font-bold text-[#315b42]"><Loader2 className="h-4 w-4 animate-spin" /> Generando en tu espacio…</div> : null}
          </div>

          <div className="border-t border-[#dfdbd1] bg-[#fffdf9] p-3">
            <div className="mb-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-full border border-[#ded9cd] px-3 py-2 text-xs font-bold hover:bg-[#f5f1e9]"><Camera className="h-4 w-4" /> Buscar por foto</button>
              <button type="button" onClick={openSpacePicker} className="flex items-center gap-2 rounded-full border border-[#315b42]/30 bg-[#eef2eb] px-3 py-2 text-xs font-bold text-[#315b42]"><ImageIcon className="h-4 w-4" /> Ver en mi espacio</button>
              <a href="/crear-ramo" className="flex items-center gap-2 rounded-full border border-[#ded9cd] px-3 py-2 text-xs font-bold hover:bg-[#f5f1e9]"><Flower2 className="h-4 w-4" /> Creador manual</a>
              <button type="button" onClick={() => void handoffToFlorist()} disabled={handoffLoading} className="flex items-center gap-2 rounded-full border border-[#315b42]/30 px-3 py-2 text-xs font-bold text-[#315b42] disabled:opacity-50">
                {handoffLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Floristería
              </button>
            </div>
            <div className="flex items-end gap-2">
              <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={1} placeholder="Dime qué quieres comprar o crear…" className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-[#ded9cd] bg-white px-4 py-3 text-sm outline-none focus:border-[#315b42]" />
              <button type="button" onClick={() => void send()} disabled={!input.trim() || loading || !catalog.length} className="grid h-11 w-11 place-items-center rounded-full bg-[#315b42] text-white disabled:opacity-40" aria-label="Enviar">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-[#7a847d]">{sales.helperText}</p>
          </div>
        </section>
      ) : null}
    </>
  );
}
