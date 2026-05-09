import { useMemo, useState } from "react";
import { Flower2, Minus, Plus, Send, ShoppingCart, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../lib/backendStorage";

const flowers = [
  { id: "rosa-roja", name: "Rosa Roja", price: 1.8, category: "Rosas" },
  { id: "rosa-blanca", name: "Rosa Blanca", price: 1.8, category: "Rosas" },
  { id: "rosa-rosa", name: "Rosa Rosa", price: 1.8, category: "Rosas" },
  { id: "tulipan", name: "Tulipán", price: 1.5, category: "Tulipanes" },
  { id: "lirio", name: "Lirio Blanco", price: 2.2, category: "Lirios" },
  { id: "girasol", name: "Girasol", price: 2.0, category: "Girasoles" },
  { id: "paniculata", name: "Paniculata", price: 0.6, category: "Verdes y relleno" },
  { id: "eucalipto", name: "Eucalipto", price: 1.2, category: "Verdes y relleno" },
];

const previewImage = "https://images.unsplash.com/photo-1561181286-d3fee7d55364?q=80&w=800&auto=format&fit=crop";
const finishPrices: Record<string, number> = { S: 8, M: 12, L: 18, XL: 25 };
const sizes = ["S", "M", "L", "XL"];
const styles = ["Romántico", "Elegante", "Colorido", "Natural", "Premium"];
const categories = ["Todas", ...Array.from(new Set(flowers.map((f) => f.category)))];

function descriptionFor(items: any[], style: string, size: string) {
  if (!items.length) return "Selecciona flores para crear tu ramo personalizado.";
  return `Ramo ${style.toLowerCase()} tamaño ${size}, compuesto por ${items.map((item) => `${item.quantity} ${item.name}`).join(", ")}. Preparado artesanalmente por Herencia Market.`;
}

export function BouquetBuilder() {
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [category, setCategory] = useState("Todas");
  const [style, setStyle] = useState("Romántico");
  const [size, setSize] = useState("M");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const filteredFlowers = category === "Todas" ? flowers : flowers.filter((flower) => flower.category === category);
  const selectedFlowers = useMemo(() => flowers.filter((flower) => selected[flower.id] > 0).map((flower) => ({ ...flower, quantity: selected[flower.id] })), [selected]);
  const flowersSubtotal = selectedFlowers.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const laborCost = finishPrices[size] || finishPrices.M;
  const total = Number((flowersSubtotal + laborCost).toFixed(2));
  const description = descriptionFor(selectedFlowers, style, size);

  const updateFlower = (id: string, delta: number) => setSelected((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) }));
  const hasFlowers = () => {
    if (selectedFlowers.length) return true;
    toast.error("Elige al menos una flor para crear tu ramo");
    return false;
  };

  const bouquet = () => ({
    id: Date.now(),
    name: `Ramo personalizado ${style}`,
    price: total,
    image: previewImage,
    quantity: 1,
    description,
    customBouquet: true,
    bouquetDetails: { style, size, flowers: selectedFlowers.map((item) => ({ name: item.name, quantity: item.quantity, unitPrice: item.price })) },
  });

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
      const item = bouquet();
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
            sellingTip: "Solicitud enviada desde la tablet FLORES. Revisar antes de publicar.",
          },
          image: { imageUrl: previewImage },
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredFlowers.map((flower) => <div key={flower.id} className="bg-background border border-border rounded-2xl p-4"><p className="text-xs text-muted-foreground mb-1">{flower.category}</p><h3 className="font-bold text-lg">{flower.name}</h3><p className="text-primary font-bold mt-1">{flower.price.toFixed(2)} € / unidad</p><div className="flex items-center gap-3 mt-4"><button onClick={() => updateFlower(flower.id, -1)} className="w-10 h-10 rounded-xl bg-muted hover:bg-accent flex items-center justify-center"><Minus className="w-4 h-4" /></button><span className="font-bold min-w-[24px] text-center">{selected[flower.id] || 0}</span><button onClick={() => updateFlower(flower.id, 1)} className="w-10 h-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center"><Plus className="w-4 h-4" /></button></div></div>)}
            </div>
          </main>

          <aside className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-5 h-fit sticky top-24">
              <h2 className="text-2xl font-bold mb-4">Resumen del ramo</h2>
              <div className="aspect-square rounded-2xl overflow-hidden bg-muted mb-5"><img src={previewImage} alt="Ramo personalizado" className="w-full h-full object-cover" /></div>
              <div className="space-y-3 max-h-64 overflow-auto pr-1">{selectedFlowers.length === 0 && <p className="text-sm text-muted-foreground">Aún no has elegido flores.</p>}{selectedFlowers.map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm"><span>{item.name} x{item.quantity}</span><span>{(item.price * item.quantity).toFixed(2)} €</span></div>)}</div>
              <div className="border-t border-border mt-5 pt-5 space-y-2"><div className="flex justify-between"><span>Flores</span><span>{flowersSubtotal.toFixed(2)} €</span></div><div className="flex justify-between"><span>Montaje {size}</span><span>{laborCost.toFixed(2)} €</span></div><div className="flex justify-between text-xl font-bold pt-2"><span>Total</span><span>{total.toFixed(2)} €</span></div></div>
              <p className="text-sm text-muted-foreground mt-4">{description}</p>
              {sent && <div className="mt-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-700 px-4 py-3 text-sm font-medium">Solicitud enviada al admin. Pulsa Actualizar FLORES en el panel.</div>}
              <button onClick={sendToAdmin} disabled={sending} className="w-full mt-6 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-4 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-60"><Send className="w-5 h-5" /> {sending ? "Enviando al panel..." : "Enviar solicitud a floristería"}</button>
              <button onClick={addToCart} className="w-full mt-3 flex items-center justify-center gap-2 bg-background border border-border py-4 rounded-xl font-bold hover:bg-muted transition-colors"><ShoppingCart className="w-5 h-5" /> Añadir al carrito</button>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
