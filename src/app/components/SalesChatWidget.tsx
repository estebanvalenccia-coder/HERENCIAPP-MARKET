import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Flower2,
  Gift,
  ImageIcon,
  Leaf,
  Loader2,
  Send,
  ShoppingCart,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { backendStorage } from "../lib/backendStorage";
import { defaultSiteContent, parseSiteContent, type SiteContent } from "../lib/siteContent";
import { getMarketExperience } from "../lib/marketExperience";
import { products, type Product } from "../data/products";

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

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  productIds?: number[];
  bouquetDraft?: BouquetDraft | null;
  bouquetResult?: BouquetResult | null;
};

function apiCatalog() {
  return products.map(({ id, name, category, price, description }) => ({
    id,
    name,
    category,
    price,
    description,
  }));
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function addCartItem(item: any) {
  const cart = JSON.parse(backendStorage.getItem("cart") || "[]");
  const existing = cart.find((current: any) => String(current.id) === String(item.id));
  if (existing) existing.quantity = Number(existing.quantity || 1) + Number(item.quantity || 1);
  else cart.push(item);
  void backendStorage.setItem("cart", JSON.stringify(cart));
  window.dispatchEvent(new Event("storage"));
}

const iconByAction = {
  bouquet: Flower2,
  plant: Leaf,
  photo: Camera,
  gift: Gift,
  surprise: Sparkles,
} as const;

export function SalesChatWidget() {
  const [open, setOpen] = useState(false);
  const [site, setSite] = useState<SiteContent>(defaultSiteContent);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = () => setSite(parseSiteContent(backendStorage.getItem("siteContent")));
    load();
    window.addEventListener("storage", load);
    window.addEventListener("backend-storage", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("backend-storage", load);
    };
  }, []);

  const market = useMemo(() => getMarketExperience(site), [site]);
  const sales = market.sales;

  useEffect(() => {
    setMessages((current) => {
      if (current.length) return current;
      return [
        {
          id: "welcome",
          role: "assistant",
          content: sales.prompt,
        },
      ];
    });
  }, [sales.prompt]);

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    []
  );

  if (!sales.enabled) return null;

  const history = () =>
    messages
      .filter((message) => message.id !== "welcome")
      .slice(-10)
      .map((message) => ({ role: message.role, content: message.content }));

  const send = async (forced?: string) => {
    const text = String(forced ?? input).trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = { id: newId(), role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/sales-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: history(),
          catalog: apiCatalog(),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No se pudo responder.");

      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: data.reply,
          productIds: data.productIds || [],
          bouquetDraft: data.bouquet || null,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content:
            "Ahora mismo no puedo consultar el asistente comercial. Puedes seguir explorando la tienda mientras se restablece.",
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
      const response = await fetch("/api/ai/sales-bouquet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo generar la imagen");
    } finally {
      setImageLoading(false);
    }
  };

  const addProduct = (product: Product) => {
    addCartItem({ ...product, quantity: 1 });
    toast.success(`${product.name} añadido al carrito`);
  };

  const addBouquet = (result: BouquetResult) => {
    addCartItem({
      id: `sales-ai-${Date.now()}`,
      name: result.proposal.name || "Ramo personalizado Herencia",
      price: Number(result.price),
      quantity: 1,
      image:
        result.image ||
        "https://images.unsplash.com/photo-1561181286-d3fee7d55364?auto=format&fit=crop&w=900&q=82",
      description: result.proposal.description,
      customBouquet: true,
      bouquetDetails: {
        source: "HERENCIA_SALES_AI",
        size: result.size,
        recommendedFlowers: result.proposal.recommendedFlowers,
        imagePrompt: result.proposal.imagePrompt,
      },
    });
    toast.success("Ramo personalizado añadido al carrito");
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
          catalog: apiCatalog(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No se pudo analizar la imagen");

      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "user",
          content: "📷 Quiero comprar una planta o producto como el de esta foto.",
        },
        {
          id: newId(),
          role: "assistant",
          content: data.reply,
          productIds: data.productIds || [],
        },
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo analizar la imagen");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => void identifyImage(event.target.files?.[0])}
      />

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-5 z-[90] inline-flex h-14 items-center gap-2 rounded-full border border-white/20 bg-[#173d2a] px-5 text-sm font-black text-white shadow-[0_16px_42px_rgba(23,61,42,.32)] transition hover:-translate-y-1 hover:bg-[#234e37] sm:right-7"
          aria-label="Abrir HERENCIA SALES"
          title={sales.buttonLabel}
        >
          <Sparkles className="h-5 w-5 text-[#e7d7a8]" />
          <span>{sales.buttonLabel}</span>
        </button>
      ) : null}

      {open ? (
        <section className="fixed bottom-4 right-3 z-[110] flex h-[min(720px,88vh)] w-[min(430px,calc(100vw-24px))] flex-col overflow-hidden rounded-[28px] border border-[#d9ddd6] bg-[#fffdf9] text-[#173126] shadow-[0_24px_70px_rgba(25,47,34,.28)] sm:right-5">
          <header className="border-b border-white/10 bg-[#173d2a] px-5 pb-5 pt-4 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-white/65">
                  <Sparkles className="h-4 w-4 text-[#e7d7a8]" />
                  Asistente comercial
                </div>
                <p className="mt-2 text-xl font-black leading-tight">{sales.title}</p>
                <p className="mt-1 text-sm text-white/78">{sales.prompt}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 transition hover:bg-white/10"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto bg-[#f7f4ed] p-4">
            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "ml-10" : "mr-5"}>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "bg-[#315b42] text-white"
                      : "border border-[#e0ddd5] bg-white"
                  }`}
                >
                  {message.content}
                </div>

                {!!message.productIds?.length ? (
                  <div className="mt-2 space-y-2">
                    {message.productIds.map((id) => {
                      const product = productMap.get(id);
                      if (!product) return null;
                      return (
                        <div
                          key={id}
                          className="flex gap-3 rounded-2xl border border-[#e0ddd5] bg-white p-3 shadow-sm"
                        >
                          <img
                            src={product.image}
                            alt={product.name}
                            className="h-20 w-20 rounded-xl object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-black">{product.name}</p>
                            <p className="mt-1 text-sm font-black text-[#315b42]">
                              {product.price.toFixed(2)} €
                            </p>
                            <div className="mt-2 flex gap-2">
                              <a
                                href={`/producto/${product.id}`}
                                className="rounded-lg border border-[#ded9cd] px-2.5 py-1.5 text-xs font-bold hover:bg-[#f5f1e9]"
                              >
                                Ver
                              </a>
                              <button
                                type="button"
                                onClick={() => addProduct(product)}
                                className="flex items-center gap-1 rounded-lg bg-[#315b42] px-2.5 py-1.5 text-xs font-bold text-white"
                              >
                                <ShoppingCart className="h-3.5 w-3.5" /> Añadir
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {message.bouquetDraft?.readyToGenerate ? (
                  <button
                    type="button"
                    onClick={() => void generateBouquet(message.bouquetDraft!)}
                    disabled={imageLoading}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#315b42] px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                  >
                    {imageLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImageIcon className="h-4 w-4" />
                    )}
                    {imageLoading ? "Creando propuesta..." : "Ver cómo quedaría"}
                  </button>
                ) : null}

                {message.bouquetResult ? (
                  <div className="mt-2 overflow-hidden rounded-2xl border border-[#e0ddd5] bg-white">
                    <img
                      src={message.bouquetResult.image}
                      alt={message.bouquetResult.proposal.name}
                      className="aspect-square w-full object-cover"
                    />
                    <div className="p-4">
                      <p className="font-black">{message.bouquetResult.proposal.name}</p>
                      <p className="mt-1 text-sm text-[#6d776f]">
                        {message.bouquetResult.proposal.description}
                      </p>
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xs text-[#6d776f]">Precio</p>
                          <p className="text-xl font-black text-[#315b42]">
                            {Number(message.bouquetResult.price).toFixed(2)} €
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addBouquet(message.bouquetResult!)}
                          className="flex items-center gap-2 rounded-xl bg-[#315b42] px-4 py-3 text-sm font-black text-white"
                        >
                          <ShoppingCart className="h-4 w-4" /> Quiero este
                        </button>
                      </div>
                      <p className="mt-3 text-[11px] leading-relaxed text-[#6d776f]">
                        {message.bouquetResult.disclaimer}
                      </p>
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
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => {
                        if (action.id === "photo") fileRef.current?.click();
                        else void send(action.prompt);
                      }}
                      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-[#dfdbd1] bg-white px-4 py-3 text-left text-sm font-black shadow-sm transition hover:border-[#315b42]/40 hover:bg-[#fdfbf6]"
                    >
                      <span className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-[#eef2eb] text-[#315b42]">
                          <Icon className="h-4 w-4" />
                        </span>
                        {action.label}
                      </span>
                      <span className="text-[#879287]">›</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {loading ? (
              <div className="mr-16 flex items-center gap-2 rounded-2xl border border-[#e0ddd5] bg-white px-4 py-3 text-sm text-[#6d776f]">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando la mejor opción…
              </div>
            ) : null}
          </div>

          <div className="border-t border-[#dfdbd1] bg-[#fffdf9] p-3">
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 rounded-full border border-[#ded9cd] px-3 py-2 text-xs font-bold hover:bg-[#f5f1e9]"
              >
                <Camera className="h-4 w-4" /> Buscar por foto
              </button>
              <a
                href="/crear-ramo"
                className="flex items-center gap-2 rounded-full border border-[#ded9cd] px-3 py-2 text-xs font-bold hover:bg-[#f5f1e9]"
              >
                <Flower2 className="h-4 w-4" /> Creador manual
              </a>
            </div>
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder="Escribe aquí..."
                className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-[#ded9cd] bg-white px-4 py-3 text-sm outline-none focus:border-[#315b42]"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={!input.trim() || loading}
                className="grid h-11 w-11 place-items-center rounded-full bg-[#315b42] text-white disabled:opacity-40"
                aria-label="Enviar"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-[#7a847d]">{sales.helperText}</p>
          </div>
        </section>
      ) : null}
    </>
  );
}
