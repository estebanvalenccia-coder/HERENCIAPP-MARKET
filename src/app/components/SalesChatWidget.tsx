import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Flower2, Gift, ImageIcon, Leaf, Loader2, Send, ShoppingCart, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { backendStorage } from "../lib/backendStorage";
import { products, Product } from "../data/products";

type BouquetDraft = { description: string; budget: number; style: string; color: string; size: "S" | "M" | "L" | "XL"; readyToGenerate?: boolean };
type BouquetResult = { proposal: { name: string; description: string; recommendedFlowers: string[]; imagePrompt: string }; image: string; price: number; size: string; currency: string; disclaimer: string };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; productIds?: number[]; bouquetDraft?: BouquetDraft | null; bouquetResult?: BouquetResult | null };

const welcome: ChatMessage = { id: "welcome", role: "assistant", content: "✨ ¿Qué quieres crear o encontrar hoy? Cuéntame tu idea y te ayudo a convertirla en algo que puedas comprar en Herencia." };
const quickActions = [
  { label: "Crear un ramo", subtitle: "Diseñado para ti", icon: Flower2, prompt: "Quiero crear un ramo personalizado." },
  { label: "Encontrar una planta", subtitle: "Busca en Herencia", icon: Leaf, prompt: "Quiero encontrar una planta para comprar." },
  { label: "Buscar por foto", subtitle: "Enséñame qué buscas", icon: Camera, upload: true },
  { label: "Buscar un regalo", subtitle: "Según ocasión y presupuesto", icon: Gift, prompt: "Quiero encontrar un regalo." },
  { label: "Sorpréndeme", subtitle: "Crea una propuesta", icon: Sparkles, prompt: "Sorpréndeme con algo que pueda comprar en Herencia." },
];

function apiCatalog() { return products.map(({ id, name, category, price, description }) => ({ id, name, category, price, description })); }
function newId() { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), []);

  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [open, messages, loading]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const history = () => messages.filter((m) => m.id !== "welcome").slice(-10).map((m) => ({ role: m.role, content: m.content }));

  const send = async (forced?: string) => {
    const text = String(forced ?? input).trim();
    if (!text || loading) return;
    setMessages((prev) => [...prev, { id: newId(), role: "user", content: text }]);
    setInput(""); setLoading(true);
    try {
      const response = await fetch("/api/ai/sales-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history: history(), catalog: apiCatalog() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No se pudo responder.");
      setMessages((prev) => [...prev, { id: newId(), role: "assistant", content: data.reply, productIds: data.productIds || [], bouquetDraft: data.bouquet || null }]);
    } catch (error) {
      setMessages((prev) => [...prev, { id: newId(), role: "assistant", content: "No he podido conectar ahora mismo. Puedes seguir explorando Herencia y volver a intentarlo en unos segundos." }]);
      toast.error(error instanceof Error ? error.message : "Error en Herencia Sales");
    } finally { setLoading(false); }
  };

  const generateBouquet = async (draft: BouquetDraft) => {
    if (imageLoading) return; setImageLoading(true);
    try {
      const response = await fetch("/api/ai/sales-bouquet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No se pudo generar el ramo.");
      setMessages((prev) => [...prev, { id: newId(), role: "assistant", content: `He creado una propuesta visual para ti por ${Number(data.price).toFixed(2)} €.`, bouquetResult: data }]);
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo generar la imagen"); }
    finally { setImageLoading(false); }
  };

  const addProduct = (product: Product) => { addCartItem({ ...product, quantity: 1 }); toast.success(`${product.name} añadido al carrito`); };
  const addBouquet = (result: BouquetResult) => {
    addCartItem({ id: `sales-ai-${Date.now()}`, name: result.proposal.name || "Ramo personalizado Herencia", price: Number(result.price), quantity: 1, image: result.image, description: result.proposal.description, customBouquet: true, bouquetDetails: { source: "HERENCIA_SALES_AI", size: result.size, recommendedFlowers: result.proposal.recommendedFlowers, imagePrompt: result.proposal.imagePrompt } });
    toast.success("Ramo personalizado añadido al carrito");
  };

  const identifyImage = async (file?: File) => {
    if (!file || loading) return;
    if (file.size > 6 * 1024 * 1024) return void toast.error("La imagen debe pesar menos de 6 MB");
    if (![/^image\/(jpeg|png|webp)$/].some((rule) => rule.test(file.type))) return void toast.error("Usa una imagen JPG, PNG o WEBP");
    setLoading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = () => reject(new Error("No se pudo leer la imagen")); reader.readAsDataURL(file); });
      setMessages((prev) => [...prev, { id: newId(), role: "user", content: "📷 Quiero encontrar algo como lo de esta foto." }]);
      const response = await fetch("/api/ai/sales-identify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: dataUrl.split(",")[1] || "", mimeType: file.type, catalog: apiCatalog() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "No se pudo analizar la imagen");
      setMessages((prev) => [...prev, { id: newId(), role: "assistant", content: data.reply, productIds: data.productIds || [] }]);
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo analizar la imagen"); }
    finally { setLoading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  return <>
    {!open && <button type="button" onClick={() => setOpen(true)} className="fixed bottom-5 right-4 z-[90] flex items-center gap-3 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-2xl transition duration-200 hover:-translate-y-0.5 hover:shadow-xl sm:bottom-6 sm:right-6 sm:px-5" aria-label="Crear con Herencia">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-primary-foreground/15"><Sparkles className="h-5 w-5" /></span>
      <span className="pr-1 text-left"><span className="block text-xs font-medium opacity-80">¿Buscas algo especial?</span><span className="block text-sm font-bold">Crear con Herencia</span></span>
    </button>}

    {open && <>
      <button className="fixed inset-0 z-[94] bg-black/20 backdrop-blur-[1px] sm:bg-black/10" onClick={() => setOpen(false)} aria-label="Cerrar asistente" />
      <section role="dialog" aria-modal="true" aria-label="Crear con Herencia" className="fixed inset-x-0 bottom-0 z-[100] flex h-[92dvh] flex-col overflow-hidden rounded-t-[28px] border border-border bg-background shadow-2xl sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(720px,88vh)] sm:w-[430px] sm:rounded-[28px]">
        <header className="relative overflow-hidden bg-primary px-5 py-4 text-primary-foreground">
          <div className="absolute -right-8 -top-12 h-32 w-32 rounded-full bg-primary-foreground/10" />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-foreground/15"><Sparkles className="h-5 w-5" /></div><div><p className="font-bold leading-tight">Crear con Herencia</p><p className="mt-0.5 text-xs opacity-80">Diseña · encuentra · compra</p></div></div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2.5 transition hover:bg-primary-foreground/10" aria-label="Cerrar"><X className="h-5 w-5" /></button>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto bg-muted/20 p-4 sm:p-5">
          {messages.map((message) => <div key={message.id} className={message.role === "user" ? "ml-10" : "mr-4"}>
            <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === "user" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-border bg-card shadow-sm"}`}>{message.content}</div>
            {!!message.productIds?.length && <div className="mt-2 space-y-2">{message.productIds.map((id) => { const product = productMap.get(id); if (!product) return null; return <div key={id} className="flex gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm"><img src={product.image} alt={product.name} className="h-20 w-20 rounded-xl object-cover" /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{product.name}</p><p className="mt-1 text-sm font-bold text-primary">{product.price.toFixed(2)} €</p><div className="mt-2 flex gap-2"><a href={`/producto/${product.id}`} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted">Ver</a><button onClick={() => addProduct(product)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"><ShoppingCart className="h-3.5 w-3.5" /> Añadir</button></div></div></div>; })}</div>}
            {message.bouquetDraft?.readyToGenerate && <button onClick={() => generateBouquet(message.bouquetDraft!)} disabled={imageLoading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">{imageLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}{imageLoading ? "Creando tu propuesta..." : "✨ Ver cómo quedaría"}</button>}
            {message.bouquetResult && <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><img src={message.bouquetResult.image} alt={message.bouquetResult.proposal.name} className="aspect-square w-full object-cover" /><div className="p-4"><p className="font-bold">{message.bouquetResult.proposal.name}</p><p className="mt-1 text-sm text-muted-foreground">{message.bouquetResult.proposal.description}</p><div className="mt-3 flex items-end justify-between gap-3"><div><p className="text-xs text-muted-foreground">Precio</p><p className="text-xl font-black text-primary">{Number(message.bouquetResult.price).toFixed(2)} €</p></div><button onClick={() => addBouquet(message.bouquetResult!)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"><ShoppingCart className="h-4 w-4" /> Quiero este</button></div><p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{message.bouquetResult.disclaimer}</p></div></div>}
          </div>)}

          {messages.length === 1 && <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">¿Qué quieres hacer?</p><div className="grid grid-cols-2 gap-2">{quickActions.map(({ label, subtitle, icon: Icon, prompt, upload }) => <button key={label} type="button" onClick={() => upload ? fileRef.current?.click() : send(prompt)} className={`flex min-h-[92px] flex-col items-start justify-between rounded-2xl border border-border bg-card p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 ${label === "Sorpréndeme" ? "col-span-2 min-h-[72px] flex-row items-center" : ""}`}><Icon className="h-5 w-5 text-primary" /><span><span className="block text-sm font-semibold">{label}</span><span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">{subtitle}</span></span></button>)}</div></div>}
          {loading && <div className="mr-16 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Buscando la mejor opción…</div>}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border bg-card p-3 sm:p-4">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => identifyImage(e.target.files?.[0])} />
          <div className="mb-2 flex gap-2"><button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"><Camera className="h-4 w-4" /> Buscar por foto</button><a href="/crear-ramo" className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"><Flower2 className="h-4 w-4" /> Crear ramo</a></div>
          <div className="flex items-end gap-2"><textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={1} placeholder="Ej.: Quiero un ramo elegante por 50 €..." className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" /><button onClick={() => send()} disabled={!input.trim() || loading} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" aria-label="Enviar">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button></div>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">Creación personalizada y compras en Herencia Market.</p>
        </div>
      </section>
    </>}
  </>;
}
