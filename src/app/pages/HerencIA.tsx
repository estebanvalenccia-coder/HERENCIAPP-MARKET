import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Crown, Leaf, Loader2, Send, ShoppingBag, Sparkles } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../lib/backendStorage";

type AccessState = {
  authenticated: boolean;
  email?: string;
  vip: boolean;
  unlimited: boolean;
  plantSpend: number;
  vipPlantSpend: number;
  dailyLimit: number;
  remaining: number | null;
};

type Product = {
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
  variants?: any[];
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  productIds?: string[];
};

const CHAT_KEY = "herencia_ia_native_messages_v2";

function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeProduct(p: any): Product {
  return {
    ...p,
    id: String(p?.id ?? ""),
    name: String(p?.name || "Producto"),
    description: String(p?.description || ""),
    category: String(p?.category || ""),
    type: String(p?.type || ""),
    collections: Array.isArray(p?.collections) ? p.collections.map(String) : [],
    price: Math.max(0, Number(p?.price || 0)),
    salePrice: p?.salePrice == null ? undefined : Math.max(0, Number(p.salePrice || 0)),
    onSale: Boolean(p?.onSale),
    image: String(p?.image || p?.imageUrl || ""),
    stock: Math.max(0, Number(p?.stock || 0)),
    trackInventory: p?.trackInventory !== false,
    active: p?.active !== false,
    status: String(p?.status || "active"),
    deletedAt: p?.deletedAt ? String(p.deletedAt) : undefined,
    variants: Array.isArray(p?.variants) ? p.variants : [],
  };
}

function price(p: Product) {
  return p.onSale && Number(p.salePrice || 0) > 0 ? Number(p.salePrice) : Number(p.price || 0);
}

export function HerencIA() {
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(true);
  const [access, setAccess] = useState<AccessState | null>(null);
  const [groq, setGroq] = useState<{ ok: boolean; model?: string } | null>(null);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const rows = JSON.parse(sessionStorage.getItem(CHAT_KEY) || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    try {
      const s = JSON.parse(backendStorage.getItem("herenciaSettings") || "{}");
      setEnabled(s.enabled !== false);
    } catch {}
  }, []);

  useEffect(() => {
    if (!messages.length) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: "Hola 🌿 Soy Herenc(IA). Cuéntame qué estás buscando y te ayudo a encontrar plantas, regalos y productos reales de Herencia Market.",
      }]);
    }
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-30))); } catch {}
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const refreshAccess = async () => {
    try {
      const r = await fetch("/api/herencia-ai/access", { credentials: "include" });
      const data = await r.json();
      if (r.ok) setAccess(data);
      return r.ok ? data : null;
    } catch {
      return null;
    }
  };

  useEffect(() => { void refreshAccess(); }, []);

  useEffect(() => {
    fetch("/api/herencia-ai/status", { credentials: "include" })
      .then(async r => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
      .then(({ ok, data }) => setGroq({ ok: ok && Boolean(data?.ok), model: data?.model }))
      .catch(() => setGroq({ ok: false }));
  }, []);

  useEffect(() => {
    let active = true;
    backendApi.listCommerceProducts()
      .then(result => {
        if (!active) return;
        const rows = Array.isArray(result.products) ? result.products : [];
        setCatalog(rows.map(normalizeProduct).filter(p => p.id && p.active !== false && !p.deletedAt && p.status !== "archived"));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const productMap = useMemo(() => new Map(catalog.map(p => [String(p.id), p])), [catalog]);

  const consume = async () => {
    const r = await fetch("/api/herencia-ai/consume", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "Límite diario alcanzado");
    setAccess(data);
  };

  const addToCart = async (product: Product, checkout = false) => {
    let cart: any[] = [];
    try {
      const current = JSON.parse(backendStorage.getItem("cart") || "[]");
      if (Array.isArray(current)) cart = current;
    } catch {}

    const lineKey = `${product.id}::herencia-ia`;
    const existing = cart.find(x => x.lineKey === lineKey);
    if (existing) existing.quantity = Number(existing.quantity || 0) + 1;
    else cart.push({ ...product, price: price(product), quantity: 1, lineKey, salesSource: "HERENCIA_IA" });

    const saved = await backendStorage.setItem("cart", JSON.stringify(cart));
    if (!saved.ok) return toast.error(saved.error || "No se pudo guardar el carrito");
    window.dispatchEvent(new Event("storage"));
    toast.success(checkout ? "Producto listo para comprar" : "Producto añadido al carrito");
    if (checkout) navigate("/checkout");
  };

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const currentAccess = access || await refreshAccess();
    if (currentAccess && !currentAccess.unlimited && Number(currentAccess.remaining || 0) <= 0) {
      toast.error("Has alcanzado tu límite diario");
      return;
    }

    const userMessage: Message = { id: id(), role: "user", content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      const r = await fetch("/api/ai/sales-chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-12).map(m => ({ role: m.role, content: m.content })),
          catalog: catalog.slice(0, 120),
          conversationId: "herencia-ia-native",
        }),
      });

      let data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const fallback = await fetch("/api/herencia-ai/chat", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, user: "herencia-ia-native" }),
        });
        data = await fallback.json().catch(() => ({}));
        if (!fallback.ok) throw new Error(data?.error || "No se pudo responder");
      }

      await consume();

      setMessages(prev => [...prev, {
        id: id(),
        role: "assistant",
        content: String(data?.reply || "Puedo ayudarte a encontrar algo de Herencia."),
        productIds: Array.isArray(data?.productIds) ? data.productIds.map(String) : undefined,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: id(),
        role: "assistant",
        content: "Ahora mismo tuve un problema de conexión. Tu mensaje no se ha descontado.",
      }]);
    } finally {
      setSending(false);
    }
  };

  if (!enabled) {
    return <div className="grid min-h-[70vh] place-items-center bg-[#edf3e7]"><p className="text-[#315b42]">Herenc(IA) está desactivada desde Administración.</p></div>;
  }

  return (
    <div
      className="min-h-[calc(100vh-120px)] px-3 py-4 sm:px-5 sm:py-6"
      style={{
        backgroundImage: "linear-gradient(135deg, rgba(232,241,226,.82), rgba(245,236,218,.76)), url('https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1800&q=88')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="mx-auto grid max-w-[1380px] gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <section className="flex min-h-[calc(100vh-165px)] flex-col overflow-hidden rounded-[2.3rem] border border-white/25 bg-[#17442f]/72 shadow-[0_30px_90px_rgba(17,49,33,.28)] backdrop-blur-2xl">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#123a27]/78 px-5 py-4 sm:px-7">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-white/10 text-[#efd8a0] shadow-lg">
                <Leaf className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#fff9ec]">Herenc(IA)</h1>
                  <Sparkles className="h-4 w-4 text-[#d8bd7a]" />
                </div>
                <p className="mt-1 text-sm text-white/65">Tu asesora de plantas, decoración y regalos</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80">
                {groq === null ? "Conectando…" : groq.ok ? `● Groq${groq.model ? ` · ${groq.model}` : ""}` : "● Sin conexión"}
              </span>
              <span className="rounded-full border border-[#d8bd7a]/20 bg-[#d8bd7a]/15 px-3 py-1.5 text-xs font-semibold text-[#f4dfaa]">
                {access?.unlimited ? "Uso ilimitado" : `${Math.max(0, Number(access?.remaining || 0))} mensajes`}
              </span>
            </div>
          </header>

          <div
            className="relative flex-1 overflow-y-auto px-4 py-6 sm:px-7"
            style={{
              backgroundImage: "linear-gradient(180deg, rgba(20,60,41,.24), rgba(247,238,216,.16)), url('https://images.unsplash.com/photo-1614594575810-9b3e3c99f8b2?auto=format&fit=crop&w=1800&q=86')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="mx-auto max-w-4xl space-y-5">
              {messages.map(message => {
                const products = (message.productIds || []).map(pid => productMap.get(pid)).filter(Boolean) as Product[];
                return (
                  <div key={message.id}>
                    <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[86%] rounded-[1.65rem] px-5 py-4 text-[15px] leading-7 shadow-xl backdrop-blur-xl sm:max-w-[72%] ${message.role === "user" ? "rounded-br-md border border-white/10 bg-[#2c6944]/92 text-white" : "rounded-bl-md border border-white/35 bg-[#fffaf0]/92 text-[#173126]"}`}>
                        {message.content}
                      </div>
                    </div>

                    {products.length > 0 && (
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {products.slice(0,3).map(product => (
                          <article key={product.id} className="overflow-hidden rounded-[1.6rem] border border-white/35 bg-[#fffaf0]/94 shadow-xl backdrop-blur-xl">
                            <div className="aspect-[4/3] bg-[#edf1e8]">
                              {product.image ? <img src={product.image} alt={product.name} className="h-full w-full object-cover" /> : null}
                            </div>
                            <div className="p-4">
                              <h3 className="font-bold text-[#173126]">{product.name}</h3>
                              <p className="mt-1 text-sm font-bold text-[#315b42]">{price(product).toFixed(2)} €</p>
                              <div className="mt-4 flex gap-2">
                                <button onClick={() => void addToCart(product)} className="flex-1 rounded-full border border-[#315b42]/15 bg-[#edf4e8] px-3 py-2 text-xs font-bold text-[#315b42]">Añadir</button>
                                <button onClick={() => void addToCart(product,true)} className="flex-1 rounded-full bg-[#315b42] px-3 py-2 text-xs font-bold text-white">Comprar</button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {sending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-[1.5rem] rounded-bl-md border border-white/35 bg-[#fffaf0]/92 px-4 py-3 text-sm text-[#315b42] shadow-lg backdrop-blur-xl">
                    <Loader2 className="h-4 w-4 animate-spin" /> Herenc(IA) está pensando…
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="border-t border-white/10 bg-[#123a27]/84 px-4 py-4 backdrop-blur-2xl sm:px-6">
            <form onSubmit={send} className="mx-auto flex max-w-4xl items-center gap-3">
              <div className="flex min-h-14 flex-1 items-center rounded-full border border-white/25 bg-[#fffaf0]/96 px-5 shadow-lg">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={sending || (!access?.unlimited && Number(access?.remaining || 0) <= 0)}
                  placeholder={!access?.unlimited && Number(access?.remaining || 0) <= 0 ? "Has alcanzado tu límite diario" : "Escribe tu pregunta aquí…"}
                  className="w-full bg-transparent text-[15px] text-[#173126] outline-none placeholder:text-[#879086]"
                />
              </div>
              <button type="submit" disabled={sending || !input.trim()} className="flex min-h-14 items-center gap-2 rounded-full bg-[#d6bb7a] px-5 font-bold text-[#173126] shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50">
                Enviar <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </section>

        <aside className="hidden min-h-[calc(100vh-165px)] flex-col gap-4 lg:flex">
          <div className="rounded-[2rem] border border-white/25 bg-[#183f2c]/78 p-5 text-white shadow-[0_24px_70px_rgba(17,49,33,.22)] backdrop-blur-2xl">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-3 text-[#f0d79d]"><Bot className="h-5 w-5" /></div>
              <div><h2 className="font-serif text-xl font-semibold">Tu acceso</h2><p className="text-xs text-white/55">{access?.authenticated ? "Cliente registrado" : "Visitante"}</p></div>
            </div>
            <div className="mt-5 rounded-2xl bg-white/10 p-4">
              <p className="text-3xl font-black text-[#f4e0af]">{access?.unlimited ? "∞" : Math.max(0, Number(access?.remaining || 0))}</p>
              <p className="mt-1 text-sm text-white/65">{access?.unlimited ? "mensajes sin límite" : `de ${Number(access?.dailyLimit || 0)} mensajes disponibles hoy`}</p>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#e0c585]/30 bg-[linear-gradient(145deg,rgba(117,88,32,.82),rgba(80,61,27,.74))] p-5 text-white shadow-xl backdrop-blur-2xl">
            <div className="flex items-center gap-2 text-[#f4dfaa]"><Crown className="h-5 w-5" /><strong>Acceso VIP</strong></div>
            <p className="mt-3 text-sm leading-6 text-white/70">Con {Number(access?.vipPlantSpend || 50).toFixed(0)} € o más en compras pagadas de plantas, Herenc(IA) pasa a uso ilimitado.</p>
            {access?.authenticated ? <p className="mt-3 text-xs font-semibold text-[#f4dfaa]">Llevas {Number(access.plantSpend || 0).toFixed(2)} € en plantas.</p> : null}
          </div>

          <div className="rounded-[2rem] border border-white/25 bg-[#183f2c]/78 p-5 text-white shadow-xl backdrop-blur-2xl">
            <div className="flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-[#f0d79d]" /><h3 className="font-serif text-lg font-semibold">Compra desde el chat</h3></div>
            <p className="mt-3 text-sm leading-6 text-white/65">Herenc(IA) recomienda productos reales y te lleva al carrito o directamente al checkout.</p>
          </div>

          <div className="relative min-h-[280px] flex-1 overflow-hidden rounded-[2rem] border border-white/25 bg-[url('https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=900&q=86')] bg-cover bg-center shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-t from-[#173b29]/75 via-transparent to-transparent" />
            <p className="absolute bottom-5 left-5 right-5 font-serif text-2xl leading-tight text-white">Más que plantas, un hogar con vida.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
