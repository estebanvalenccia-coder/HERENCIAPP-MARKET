import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Crown, Heart, Leaf, Loader2, Paperclip, Send, ShoppingBag, Sparkles, UserRound } from "lucide-react";
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
      className="relative min-h-[calc(100vh-120px)] overflow-hidden px-3 py-6 sm:px-5 lg:py-[60px]"
      style={{
        backgroundImage: "linear-gradient(90deg, rgba(46,64,31,.05), rgba(145,84,26,.02)), url('https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=2560&q=100')",
        backgroundSize: "cover",
        backgroundPosition: "center 58%",
              backgroundBlendMode: "normal",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,247,226,.04),transparent_42%,rgba(255,235,190,.03))]" />
      <div className="relative mx-auto grid max-w-[1200px] gap-[18px] lg:grid-cols-[minmax(0,1fr)_308px]">
        <section className="flex min-h-[808px] flex-col overflow-hidden rounded-[28px] border border-[#f2dfad]/70 bg-[rgba(238,226,197,.18)] shadow-[0_26px_70px_rgba(18,38,24,.28)] backdrop-blur-[16px]">
          <header className="flex min-h-[86px] flex-wrap items-center justify-between gap-4 border-b border-white/15 bg-[rgba(22,62,40,.78)] px-6 py-4 backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <div className="grid h-[56px] w-[56px] place-items-center rounded-full border border-[#d8bd7a]/35 bg-[#1c5b3a]/80 text-[#efd8a0] shadow-lg">
                <Leaf className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-serif text-[27px] font-semibold tracking-tight text-[#fff9ec]">Herenc(IA)</h1>
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
            className="relative flex-1 overflow-y-auto px-6 py-5 before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(90deg,rgba(255,248,220,.12),rgba(83,96,61,.08),rgba(255,229,177,.10))]"
            style={{
              background: "linear-gradient(180deg, rgba(230,222,195,.28), rgba(216,203,171,.24))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.20)",
            }}
          >
            <div className="relative z-10 mx-auto max-w-[790px] space-y-4">
              {messages.map(message => {
                const products = (message.productIds || []).map(pid => productMap.get(pid)).filter(Boolean) as Product[];
                return (
                  <div key={message.id}>
                    <div className={`flex items-end gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      {message.role === "assistant" && (
                        <div className="mb-1 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#d9c99f] bg-[#fffaf0] text-[#315b42] shadow-md"><Leaf className="h-4 w-4" /></div>
                      )}
                      <div className={`max-w-[86%] rounded-[22px] px-5 py-3.5 text-[15px] leading-6 shadow-xl backdrop-blur-xl sm:max-w-[66%] ${message.role === "user" ? "rounded-br-md border border-white/10 bg-[#2c6944]/92 text-white" : "rounded-bl-md border border-[#ead9b6]/75 bg-[#fffaf0]/92 text-[#173126]"}`}>
                        {message.content}
                        <div className={`mt-1 text-right text-[10px] ${message.role === "user" ? "text-white/45" : "text-[#6d786f]/55"}`}>
                          ahora
                        </div>
                      </div>
                      {message.role === "user" && (
                        
                      )}
                    </div>

                    {products.length > 0 && (
                      <div className="ml-[48px] mt-3 grid max-w-[720px] grid-cols-1 gap-3 md:grid-cols-3">
                        {products.slice(0,3).map(product => (
                          <article key={product.id} className="relative overflow-hidden rounded-[14px] border border-[#ead9b6]/80 bg-[#fffaf0]/96 shadow-[0_14px_32px_rgba(31,48,34,.18)] backdrop-blur-xl">
                            <button type="button" aria-label="Guardar favorito" className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-[#fffaf0]/90 text-[#315b42] shadow"><Heart className="h-4 w-4" /></button><div className="aspect-[1.08/0.78] bg-[#edf1e8]">
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

          <div className="border-t border-white/20 bg-[rgba(242,229,202,.26)] px-5 py-3.5 backdrop-blur-xl">
            <form onSubmit={send} className="mx-auto flex max-w-[820px] items-center gap-3">
              <div className="flex min-h-[50px] flex-1 items-center rounded-full border border-[#ead9b6]/75 bg-[#fffaf0]/96 px-5 shadow-lg">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={sending || (!access?.unlimited && Number(access?.remaining || 0) <= 0)}
                  placeholder={!access?.unlimited && Number(access?.remaining || 0) <= 0 ? "Has alcanzado tu límite diario" : "Escribe tu pregunta aquí…"}
                  className="w-full bg-transparent text-[15px] text-[#173126] outline-none placeholder:text-[#879086]"
                />
              </div>
              <button type="submit" disabled={sending || !input.trim()} className="grid h-[50px] w-[50px] place-items-center rounded-full bg-[#0f5735] p-0 font-bold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50">
                <Send className="h-5 w-5" />
              </button>
            </form>
          </div>
        </section>

        <aside className="hidden min-h-[calc(100vh-165px)] flex-col gap-3 lg:flex">
          <div className="rounded-[26px] border border-[#f0d99d]/40 bg-[#123a27]/80 p-5 text-white shadow-[0_24px_70px_rgba(17,49,33,.26)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-3 text-[#f0d79d]"><UserRound className="h-5 w-5" /></div>
              <div><h2 className="font-serif text-xl font-semibold">Tu acceso</h2><p className="text-xs text-white/55">{access?.authenticated ? "Cliente registrado" : "Visitante"}</p></div>
            </div>
            <div className="mt-5 rounded-2xl bg-white/10 p-4">
              <p className="text-3xl font-black text-[#f4e0af]">{access?.unlimited ? "∞" : Math.max(0, Number(access?.remaining || 0))}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-[#f1dfb4] transition-all"
                  style={{ width: access?.unlimited ? "100%" : `${Math.max(0, Math.min(100, (Number(access?.remaining || 0) / Math.max(1, Number(access?.dailyLimit || 1))) * 100))}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-white/65">{access?.unlimited ? "mensajes sin límite" : `de ${Number(access?.dailyLimit || 0)} mensajes disponibles hoy`}</p>
            </div>
            {!access?.authenticated && (
              <button onClick={() => navigate("/login")} className="mt-4 w-full rounded-full bg-[#fff1cf] px-4 py-2.5 text-sm font-bold text-[#173126]">
                Inicia sesión para más mensajes →
              </button>
            )}
          </div>

          <div className="rounded-[26px] border border-[#e0c585]/30 bg-[linear-gradient(145deg,rgba(151,103,24,.90),rgba(106,67,15,.86))] p-5 text-white shadow-xl backdrop-blur-2xl">
            <div className="flex items-center gap-2 text-[#f4dfaa]"><Crown className="h-5 w-5" /><strong>Acceso VIP</strong></div>
            <p className="mt-3 text-sm leading-6 text-white/70">Con {Number(access?.vipPlantSpend || 50).toFixed(0)} € o más en compras pagadas de plantas, Herenc(IA) pasa a uso ilimitado.</p>
            {access?.authenticated ? <p className="mt-3 text-xs font-semibold text-[#f4dfaa]">Llevas {Number(access.plantSpend || 0).toFixed(2)} € en plantas.</p> : null}\n            <button type="button" className="mt-4 w-full rounded-full bg-[#fff1cf] px-4 py-2.5 text-sm font-bold text-[#493313]">Ver mis beneficios VIP →</button>
          </div>

          <div className="rounded-[26px] border border-[#f0d99d]/35 bg-[#123a27]/82 p-5 text-white shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-[#f0d79d]" /><h3 className="font-serif text-lg font-semibold">Compra desde el chat</h3></div>
            <p className="mt-3 text-sm leading-6 text-white/65">Herenc(IA) recomienda productos reales y te lleva al carrito o directamente al checkout.</p>
          </div>

          <div className="relative min-h-[205px] flex-1 overflow-hidden rounded-[26px] border border-white/25 bg-[url('https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=92')] bg-cover bg-center shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-t from-[#173b29]/75 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-5 right-5"><p className="font-serif text-[23px] leading-[1.05] text-white">Más que plantas, un hogar con vida.</p><button type="button" onClick={() => navigate("/")} className="mt-3 rounded-full bg-[#fff1cf] px-4 py-2 text-xs font-bold text-[#173126]">Descubrir Herencia →</button></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
