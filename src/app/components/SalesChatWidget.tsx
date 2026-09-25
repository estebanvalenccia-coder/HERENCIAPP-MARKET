import { useMemo, useRef, useState } from "react";
import {
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
import { toast } from "sonner";
import { backendStorage } from "../lib/backendStorage";
import { products, Product } from "../data/products";

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

const welcome: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "🌿 Cuéntame qué quieres comprar o crear. Puedo diseñarte un ramo, encontrar una planta, buscar un regalo o localizar un producto a partir de una foto.",
};

const quickActions = [
  { label: "Crear un ramo", icon: Flower2, prompt: "Quiero crear un ramo personalizado." },
  { label: "Encontrar una planta", icon: Leaf, prompt: "Quiero encontrar una planta para comprar." },
  { label: "Buscar un regalo", icon: Gift, prompt: "Quiero encontrar un regalo." },
  { label: "Sorpréndeme", icon: Sparkles, prompt: "Sorpréndeme con algo que pueda comprar en Herencia." },
];

function apiCatalog() {
  return products.map(({ id, name, category, price, description }) => ({ id, name, category, price, description }));
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function addCartItem(item: any) {
  const cart = JSON.parse(backendStorage.getItem("cart") || "[]");
  backendStorage.setItem("cart", JSON.stringify([...cart, item]));
  window.dispatchEvent(new Event("storage"));
}

export function SalesChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([welcome]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), []);

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
          content: "Ahora mismo no puedo consultar el asistente comercial. Puedes seguir explorando la tienda mientras se restablece.",
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
      image: "https://images.unsplash.com/photo-1561181286-d3fee7d55364?q=80&w=800&auto=format&fit=crop",
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
        { id: newId(), role: "user", content: "📷 Quiero comprar una planta o producto como el de esta foto." },
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
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[90] flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl transition hover:scale-105"
          aria-label="Abrir asistente de compras Herencia"
          title="Crear o encontrar algo"
        >
          <Sparkles className="h-7 w-7" />
        </button>
      )}

      {open && (
        <section className="fixed bottom-4 right-4 z-[100] flex h-[min(720px,88vh)] w-[min(430px,calc(100vw-24px))] flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl">
          <header className="flex items-center justify-between border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-primary-foreground/15">
                <Flower2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold leading-tight">Herencia · Crea & Compra</p>
                <p className="text-xs opacity-80">Tu asistente comercial</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-primary-foreground/10" aria-label="Cerrar">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto bg-muted/20 p-4">
            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "ml-10" : "mr-5"}>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-card"}`}>
                  {message.content}
                </div>

                {!!message.productIds?.length && (
                  <div className="mt-2 space-y-2">
                    {message.productIds.map((id) => {
                      const product = productMap.get(id);
                      if (!product) return null;
                      return (
                        <div key={id} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
                          <img src={product.image} alt={product.name} className="h-20 w-20 rounded-xl object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{product.name}</p>
                            <p className="mt-1 text-sm font-bold text-primary">{product.price.toFixed(2)} €</p>
                            <div className="mt-2 flex gap-2">
                              <a href={`/producto/${product.id}`} className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted">Ver</a>
                              <button type="button" onClick={() => addProduct(product)} className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground">
                                <ShoppingCart className="h-3.5 w-3.5" /> Añadir
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {message.bouquetDraft?.readyToGenerate && (
                  <button
                    type="button"
                    onClick={() => generateBouquet(message.bouquetDraft!)}
                    disabled={imageLoading}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
                  >
                    {imageLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                    {imageLoading ? "Creando propuesta..." : "Ver cómo quedaría"}
                  </button>
                )}

                {message.bouquetResult && (
                  <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-card">
                    <img src={message.bouquetResult.image} alt={message.bouquetResult.proposal.name} className="aspect-square w-full object-cover" />
                    <div className="p-4">
                      <p className="font-bold">{message.bouquetResult.proposal.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{message.bouquetResult.proposal.description}</p>
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Precio</p>
                          <p className="text-xl font-black text-primary">{Number(message.bouquetResult.price).toFixed(2)} €</p>
                        </div>
                        <button type="button" onClick={() => addBouquet(message.bouquetResult!)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">
                          <ShoppingCart className="h-4 w-4" /> Quiero este
                        </button>
                      </div>
                      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{message.bouquetResult.disclaimer}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {messages.length === 1 && (
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map(({ label, icon: Icon, prompt }) => (
                  <button key={label} type="button" onClick={() => send(prompt)} className="flex min-h-20 flex-col items-start justify-between rounded-2xl border border-border bg-card p-3 text-left text-sm font-semibold hover:border-primary/50 hover:bg-primary/5">
                    <Icon className="h-5 w-5 text-primary" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="mr-16 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando la mejor opción…
              </div>
            )}
          </div>

          <div className="border-t border-border bg-card p-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => identifyImage(event.target.files?.[0])}
            />
            <div className="mb-2 flex gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
                <Camera className="h-4 w-4" /> Buscar por foto
              </button>
              <a href="/crear-ramo" className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
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
                    send();
                  }
                }}
                rows={1}
                placeholder="Ej.: Quiero un ramo elegante por 50 €..."
                className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              />
              <button type="button" onClick={() => send()} disabled={!input.trim() || loading} className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" aria-label="Enviar">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">Solo compras, personalización y productos de Herencia.</p>
          </div>
        </section>
      )}
    </>
  );
}
