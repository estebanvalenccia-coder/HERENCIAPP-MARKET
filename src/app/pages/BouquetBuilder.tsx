import { useEffect, useMemo, useRef, useState } from "react";
import { Flower2, Loader2, Minus, Plus, Send, ShoppingCart, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../lib/backendStorage";
import {
  BOUQUET_CATALOG_KEY,
  defaultBouquetCatalog,
  parseBouquetCatalog,
  type BouquetCatalogItem,
} from "../lib/bouquetCatalog";

const defaultPreviewImage = "https://images.unsplash.com/photo-1561181286-d3fee7d55364?q=80&w=800&auto=format&fit=crop";

function fallbackPreviewFor(items: Array<{ id: string; quantity: number; previewColor?: string; category?: string; name?: string }>, size: string) {
  if (!items.length) return defaultPreviewImage;

  const blooms = items
    .flatMap((item) =>
      Array.from({ length: Math.min(Math.max(item.quantity, 1), 8) }, (_, index) => ({
        id: item.id,
        index,
        previewColor: item.previewColor,
        category: item.category,
        name: item.name,
      }))
    )
    .slice(0, 30);

  const sizeScale = { S: 0.82, M: 1, L: 1.12, XL: 1.24 }[size] || 1;
  const petals = blooms.map((bloom, index) => {
    const angle = index * 2.399963229728653;
    const radius = (24 + Math.sqrt(index + 1) * 38) * sizeScale;
    const x = 400 + Math.cos(angle) * radius;
    const y = 290 + Math.sin(angle) * radius * 0.62;
    const color = bloom.previewColor || "#d7b6c7";
    const descriptor = `${bloom.name || ""} ${bloom.category || ""}`.toLowerCase();
    const isGreen = /verde|eucalipto|ruscus|hoja|follaje/.test(descriptor);
    const isFiller = /relleno|paniculata|gypsophila|limonium|statice|solidago/.test(descriptor);
    const isSunflower = /girasol/.test(descriptor);
    const core = isSunflower ? "#6f4b27" : isGreen ? "#567763" : "#d9bd83";
    const bloomRadius = isFiller ? 10 : isGreen ? 15 : 24;
    return `
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${bloomRadius}" fill="${color}" opacity="0.96"/>
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${Math.max(4, bloomRadius * 0.26)}" fill="${core}" opacity="0.9"/>
    `;
  }).join("");

  const stems = blooms.map((_, index) => {
    const angle = index * 2.399963229728653;
    const radius = (24 + Math.sqrt(index + 1) * 38) * sizeScale;
    const x = 400 + Math.cos(angle) * radius;
    const y = 290 + Math.sin(angle) * radius * 0.62;
    return `<line x1="${x.toFixed(1)}" y1="${(y + 14).toFixed(1)}" x2="400" y2="610" stroke="#52755f" stroke-width="7" stroke-linecap="round" opacity="0.7"/>`;
  }).join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
      <defs>
        <radialGradient id="bg" cx="50%" cy="38%" r="68%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#f1eee8"/>
        </radialGradient>
      </defs>
      <rect width="800" height="800" fill="url(#bg)"/>
      <ellipse cx="400" cy="680" rx="180" ry="36" fill="#d8d2c9" opacity="0.45"/>
      ${stems}
      <path d="M315 505 Q400 565 485 505 L455 690 Q400 725 345 690 Z" fill="#ece4d7" opacity="0.96"/>
      ${petals}
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
const finishPrices: Record<string, number> = { S: 8, M: 12, L: 18, XL: 25 };
const sizes = ["S", "M", "L", "XL"];
const styles = ["Romántico", "Elegante", "Colorido", "Natural", "Premium"];
function descriptionFor(items: any[], style: string, size: string) {
  if (!items.length) return "Selecciona flores para crear tu ramo personalizado.";
  return `Ramo ${style.toLowerCase()} tamaño ${size}, compuesto por ${items.map((item) => `${item.quantity} ${item.name}`).join(", ")}. Preparado artesanalmente por Herencia Market.`;
}

export function BouquetBuilder() {
  const [flowers, setFlowers] = useState<BouquetCatalogItem[]>(() =>
    parseBouquetCatalog(backendStorage.getItem(BOUQUET_CATALOG_KEY)).filter((item) => item.active)
  );
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [category, setCategory] = useState("Todas");
  const [style, setStyle] = useState("Romántico");
  const [size, setSize] = useState("M");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [previewImage, setPreviewImage] = useState(defaultPreviewImage);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [finalProposalImage, setFinalProposalImage] = useState("");
  const [finalGenerating, setFinalGenerating] = useState(false);
  const [customerComment, setCustomerComment] = useState("");
  const previewRequestRef = useRef(0);
  const previewCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const loadCatalog = () => {
      if (cancelled) return;
      const next = parseBouquetCatalog(backendStorage.getItem(BOUQUET_CATALOG_KEY)).filter((item) => item.active);
      setFlowers(next.length || backendStorage.getItem(BOUQUET_CATALOG_KEY) != null ? next : defaultBouquetCatalog.filter((item) => item.active));
      setSelected((current) => {
        const valid = new Set(next.map((item) => item.id));
        return Object.fromEntries(Object.entries(current).filter(([id]) => valid.has(id)));
      });
    };

    loadCatalog();
    void backendStorage.refresh().then(loadCatalog).catch(() => null);
    window.addEventListener("backend-storage", loadCatalog);
    window.addEventListener("storage", loadCatalog);

    return () => {
      cancelled = true;
      window.removeEventListener("backend-storage", loadCatalog);
      window.removeEventListener("storage", loadCatalog);
    };
  }, []);

  const categories = useMemo(
    () => ["Todas", ...Array.from(new Set(flowers.map((flower) => flower.category)))],
    [flowers]
  );
  const filteredFlowers = category === "Todas" ? flowers : flowers.filter((flower) => flower.category === category);
  const selectedFlowers = useMemo(() => flowers.filter((flower) => selected[flower.id] > 0).map((flower) => ({ ...flower, quantity: selected[flower.id] })), [selected]);
  const flowersSubtotal = selectedFlowers.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const laborCost = finishPrices[size] || finishPrices.M;
  const total = Number((flowersSubtotal + laborCost).toFixed(2));
  const description = descriptionFor(selectedFlowers, style, size);
  const previewKey = useMemo(
    () =>
      JSON.stringify({
        style,
        size,
        flowers: selectedFlowers.map((flower) => ({
          id: flower.id,
          quantity: flower.quantity,
          previewColor: flower.previewColor,
        })),
      }),
    [selectedFlowers, size, style]
  );

  useEffect(() => {
    setFinalProposalImage("");
    setSent(false);
  }, [previewKey]);

  useEffect(() => {
    const requestId = ++previewRequestRef.current;
    const fallback = fallbackPreviewFor(selectedFlowers, size);

    if (!selectedFlowers.length) {
      setPreviewImage(defaultPreviewImage);
      setPreviewLoading(false);
      setPreviewError("");
      return;
    }

    const cached = previewCacheRef.current.get(previewKey);
    if (cached) {
      setPreviewImage(cached);
      setPreviewLoading(false);
      setPreviewError("");
      return;
    }

    setPreviewImage(fallback);
    setPreviewLoading(true);
    setPreviewError("");

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/ai/sales-bouquet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            description: `Ramo compuesto exactamente por ${selectedFlowers
              .map((flower) => `${flower.quantity} x ${flower.name}`)
              .join(", ")}. No añadir otros tipos de flores.`,
            budget: total,
            style,
            color: "Respetar los colores naturales de las flores seleccionadas",
            size,
            exactFlowers: selectedFlowers.map((flower) => ({
              id: flower.id,
              name: flower.name,
              quantity: flower.quantity,
            })),
          }),
        });

        const data = await response.json();
        if (!response.ok || !data?.image) {
          throw new Error(data?.error || "No se pudo generar la imagen");
        }

        if (previewRequestRef.current !== requestId) return;
        previewCacheRef.current.set(previewKey, data.image);
        setPreviewImage(data.image);
      } catch (error) {
        if (controller.signal.aborted || previewRequestRef.current !== requestId) return;
        setPreviewImage(fallback);
        setPreviewError(
          error instanceof Error
            ? `Vista aproximada: ${error.message}`
            : "Vista aproximada: no se pudo generar la fotografía"
        );
      } finally {
        if (previewRequestRef.current === requestId) setPreviewLoading(false);
      }
    }, 700);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [previewKey, selectedFlowers, size, style, total]);

  const updateFlower = (id: string, delta: number) => setSelected((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) }));
  const hasFlowers = () => {
    if (selectedFlowers.length) return true;
    toast.error("Elige al menos una flor para crear tu ramo");
    return false;
  };

  const bouquet = (image = finalProposalImage || previewImage) => ({
    id: Date.now(),
    name: `Ramo personalizado ${style}`,
    price: total,
    image,
    quantity: 1,
    description,
    customBouquet: true,
    bouquetDetails: { style, size, flowers: selectedFlowers.map((item) => ({ name: item.name, quantity: item.quantity, unitPrice: item.price })) },
  });

  const generateFinalProposal = async () => {
    if (!hasFlowers()) return "";

    setFinalGenerating(true);
    try {
      const selectedSummary = selectedFlowers
        .map((flower) => `${flower.quantity} x ${flower.name}`)
        .join(", ");
      const response = await fetch("/api/ai/sales-bouquet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: `PROPUESTA FINAL. Genera el ramo completo usando exactamente todas estas flores y cantidades: ${selectedSummary}. No omitas variedades y no añadas otras flores.`,
          budget: total,
          style,
          color: "Respetar los colores naturales de todas las flores seleccionadas",
          size,
          exactFlowers: selectedFlowers.map((flower) => ({
            id: flower.id,
            name: flower.name,
            quantity: flower.quantity,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.image) {
        throw new Error(data?.error || "No se pudo generar la propuesta final");
      }
      setFinalProposalImage(data.image);
      setPreviewImage(data.image);
      setPreviewError("");
      toast.success("Propuesta final generada con todas las flores seleccionadas 🌸");
      return String(data.image);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo generar la propuesta final");
      return "";
    } finally {
      setFinalGenerating(false);
    }
  };

  const addToCart = () => {
    if (!hasFlowers()) return;
    const cart = JSON.parse(backendStorage.getItem("cart") || "[]");
    backendStorage.setItem("cart", JSON.stringify([...cart, bouquet()]));
    toast.success("Ramo personalizado añadido al carrito 🌸");
  };

  const sendToAdmin = async () => {
    if (!hasFlowers()) return;
    setSending(true);
    try {
      let proposalImage = finalProposalImage;
      if (!proposalImage) {
        proposalImage = await generateFinalProposal();
        if (!proposalImage) return;
      }

      const item = bouquet(proposalImage);
      const selectedSummary = selectedFlowers.map((flower) => `${flower.quantity} x ${flower.name}`).join(", ");
      await backendApi.createOrder({
        id: `flores-${Date.now()}`,
        customerName: "Tablet FLORES",
        paymentMethod: "pendiente",
        deliveryMethod: "consulta-floristeria",
        status: "pending",
        subtotal: Number(flowersSubtotal.toFixed(2)),
        shipping: 0,
        total,
        items: [item],
        metadata: {
          source: "FLORES_TABLET",
          type: "flower_admin_request",
          idea: description,
          customerComment: customerComment.trim() || null,
          selectedSummary,
          budget: total,
          style,
          size,
          colors: selectedFlowers.map((flower) => flower.name),
          flowers: selectedFlowers.map((flower) => ({ name: flower.name, quantity: flower.quantity, unitPrice: flower.price, category: flower.category })),
          proposal: {
            name: `Ramo personalizado ${style}`,
            shortDescription: `Solicitud FLORES ${size} - ${selectedSummary}`,
            description,
            recommendedFlowers: selectedFlowers.map((flower) => flower.name),
            sellingTip: customerComment.trim()
              ? `Comentario del cliente: ${customerComment.trim()}`
              : "Solicitud enviada desde la tablet FLORES. Revisar antes de publicar.",
          },
          image: { imageUrl: proposalImage },
        },
      });
      setSent(true);
      toast.success("Solicitud enviada al panel de administración 🌸");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar la solicitud");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-muted/20 to-background">
      <section className="max-w-7xl mx-auto px-4 py-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-semibold mb-4"><Sparkles className="w-4 h-4" /> Creador inteligente de ramos</div>
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4">Crea tu ramo personalizado</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">Elige flores, estilo y tamaño. Ves el precio en tiempo real y lo envías al panel de la floristería.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_360px] gap-6">
          <aside className="bg-card border border-border rounded-2xl p-5 h-fit sticky top-24">
            <h2 className="font-bold text-lg mb-4">Categorías</h2>
            <div className="space-y-2">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${category === item ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{item}</button>)}</div>
            <div className="border-t border-border mt-6 pt-6"><h3 className="font-bold mb-3">Estilo</h3><div className="grid gap-2">{styles.map((item) => <button key={item} onClick={() => setStyle(item)} className={`px-3 py-2 rounded-xl border text-sm ${style === item ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>{item}</button>)}</div></div>
            <div className="border-t border-border mt-6 pt-6"><h3 className="font-bold mb-3">Tamaño</h3><div className="grid grid-cols-2 gap-2">{sizes.map((item) => <button key={item} onClick={() => setSize(item)} className={`px-3 py-3 rounded-xl border ${size === item ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}><span className="block font-bold">{item}</span><span className="block text-xs opacity-80">+{finishPrices[item]}€</span></button>)}</div></div>
          </aside>

          <main className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between gap-4 mb-5"><div><h2 className="text-2xl font-bold">Listado de flores</h2><p className="text-muted-foreground text-sm">Selecciona unidades para montar tu ramo.</p></div><div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-muted rounded-xl text-sm"><Flower2 className="w-4 h-4" /> {selectedFlowers.length} tipos elegidos</div></div>
            {!flowers.length && (
              <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-muted-foreground">
                Ahora mismo no hay flores ni verdes publicados. El catálogo se gestiona desde Administración → Flores del creador.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredFlowers.map((flower) => <div key={flower.id} className="bg-background border border-border rounded-2xl p-4"><p className="text-xs text-muted-foreground mb-1">{flower.category}</p><h3 className="font-bold text-lg">{flower.name}</h3><p className="text-primary font-bold mt-1">{flower.price.toFixed(2)} € / unidad</p><div className="flex items-center gap-3 mt-4"><button onClick={() => updateFlower(flower.id, -1)} className="w-10 h-10 rounded-xl bg-muted hover:bg-accent flex items-center justify-center"><Minus className="w-4 h-4" /></button><span className="font-bold min-w-[24px] text-center">{selected[flower.id] || 0}</span><button onClick={() => updateFlower(flower.id, 1)} className="w-10 h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center"><Plus className="w-4 h-4" /></button></div></div>)}
            </div>
          </main>

          <aside className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-5 h-fit sticky top-24">
              <h2 className="text-2xl font-bold mb-4">Resumen del ramo</h2>
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted mb-5">
                <img src={previewImage} alt="Previsualización del ramo según las flores seleccionadas" className="w-full h-full object-cover" />
                {previewLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/55 backdrop-blur-[1px]">
                    <div className="flex items-center gap-2 rounded-full bg-card/95 border border-border px-4 py-2 text-sm font-semibold shadow-sm">
                      <Loader2 className="w-4 h-4 animate-spin" /> Actualizando ramo...
                    </div>
                  </div>
                )}
              </div>
              {previewError && <p className="mb-4 text-xs text-amber-700">{previewError}</p>}
              <div className="space-y-3 max-h-64 overflow-auto pr-1">{selectedFlowers.length === 0 && <p className="text-sm text-muted-foreground">Aún no has elegido flores.</p>}{selectedFlowers.map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm"><span>{item.name} x{item.quantity}</span><span>{(item.price * item.quantity).toFixed(2)} €</span></div>)}</div>
              <div className="border-t border-border mt-5 pt-5 space-y-2"><div className="flex justify-between"><span>Flores</span><span>{flowersSubtotal.toFixed(2)} €</span></div><div className="flex justify-between"><span>Montaje {size}</span><span>{laborCost.toFixed(2)} €</span></div><div className="flex justify-between text-xl font-bold pt-2"><span>Total</span><span>{total.toFixed(2)} €</span></div></div>
              <p className="text-sm text-muted-foreground mt-4">{description}</p>

              <div className="mt-5 rounded-2xl border border-border bg-muted/30 p-4">
                <h3 className="font-bold">Propuesta final</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cuando termines de elegir, genera una imagen definitiva usando todas las flores y cantidades seleccionadas.
                </p>
                <button
                  type="button"
                  onClick={() => void generateFinalProposal()}
                  disabled={finalGenerating || !selectedFlowers.length}
                  className="w-full mt-3 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {finalGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  {finalGenerating ? "Generando ramo final..." : finalProposalImage ? "Regenerar propuesta final" : "Generar propuesta final"}
                </button>
                {finalProposalImage && (
                  <p className="mt-2 text-xs font-medium text-green-700">
                    ✓ Propuesta final lista con la selección completa.
                  </p>
                )}
              </div>

              <label className="block mt-4">
                <span className="text-sm font-semibold">Comentario para la floristería (opcional)</span>
                <textarea
                  value={customerComment}
                  onChange={(event) => setCustomerComment(event.target.value)}
                  maxLength={600}
                  rows={3}
                  placeholder="Ej.: envolver en papel kraft, es para un cumpleaños, prefiero que quede más abierto..."
                  className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary"
                />
                <span className="mt-1 block text-right text-[11px] text-muted-foreground">
                  {customerComment.length}/600
                </span>
              </label>

              {sent && <div className="mt-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-700 px-4 py-3 text-sm font-medium">Propuesta enviada al panel con su composición, imagen final y comentario.</div>}
              <button onClick={sendToAdmin} disabled={sending || finalGenerating} className="w-full mt-6 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-60"><Send className="w-5 h-5" /> {sending ? "Enviando propuesta..." : "Enviar propuesta a floristería"}</button>
              <button onClick={addToCart} className="w-full mt-3 flex items-center justify-center gap-2 bg-background border border-border py-4 rounded-xl font-bold hover:bg-muted transition-colors"><ShoppingCart className="w-5 h-5" /> Añadir al carrito</button>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
