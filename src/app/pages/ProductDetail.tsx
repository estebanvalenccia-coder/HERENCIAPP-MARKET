import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowLeft, ShoppingCart, Heart, Leaf, Droplets, Sun, ThermometerSun, Sparkles, Ruler, PawPrint, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../lib/backendStorage";

export function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [aiDescription, setAiDescription] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState("");
  const [dedication, setDedication] = useState("");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewForm, setReviewForm] = useState({ name: "", email: "", rating: 5, comment: "" });
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);
  const scale = useTransform(scrollY, [0, 300], [1, 0.8]);

  useEffect(() => {
    const adminProducts = backendStorage.getItem("adminProducts");
    if (adminProducts) {
      try {
        const rows = JSON.parse(adminProducts);
        const found = rows.find((p: any) => String(p.id) === String(id));
        if (found) {
          setProduct(found);
          setSelectedVariant(Array.isArray(found.variants) && found.variants.length ? String(found.variants[0]?.name || found.variants[0]) : "");
          generateAIDescription(found.name, found.description || "");
        }
      } catch { setProduct(null); }
    }
    try { setFavorite(JSON.parse(backendStorage.getItem("wishlist") || "[]").map(String).includes(String(id))); } catch { setFavorite(false); }
    if (id) backendApi.listProductReviews(String(id)).then((r) => setReviews(r.reviews || [])).catch(() => setReviews([]));
  }, [id]);

  const generateAIDescription = async (plantName: string, baseDescription: string) => {
    setLoadingAI(true);
    try {
      const { result } = await backendApi.generatePlantDescription({ plantName, baseDescription });
      setAiDescription(JSON.stringify(result));
    } catch {
      const fallback = { description: `${plantName} aporta vida y frescura a cualquier espacio. ${baseDescription}`, care: { water: "Riego moderado, evitando encharcar.", light: "Luz adecuada según variedad; evita cambios bruscos.", temperature: "Mantener en una temperatura estable y sin corrientes extremas.", fertilizer: "Fertilizar en temporada de crecimiento siguiendo la dosis del fabricante." }, benefits: ["Aporta naturaleza al espacio", "Decoración viva y duradera", "Cuidados adaptables a distintos hogares"], tips: "Observa hojas y sustrato: la planta suele avisar antes de necesitar un cambio de cuidados." };
      setAiDescription(JSON.stringify(fallback));
    } finally { setLoadingAI(false); }
  };

  const variants = useMemo(() => Array.isArray(product?.variants) ? product.variants : [], [product]);
  const selected = variants.find((v: any) => String(v?.name || v) === selectedVariant);
  const effectivePrice = Number(selected?.price ?? (product?.onSale && product?.salePrice ? product.salePrice : product?.price || 0));
  const stock = Math.max(0, Math.floor(Number(selected?.stock ?? product?.stock ?? 0)));

  const toggleFavorite = async () => {
    let list: string[] = [];
    try { list = JSON.parse(backendStorage.getItem("wishlist") || "[]").map(String); } catch {}
    const key = String(product.id);
    const next = list.includes(key) ? list.filter((x) => x !== key) : [...list, key];
    setFavorite(next.includes(key));
    await backendStorage.setItem("wishlist", JSON.stringify(next));
    toast.success(next.includes(key) ? "Añadido a favoritos" : "Eliminado de favoritos");
  };

  const joinWaitlist = async () => {
    if (!waitlistEmail.trim()) return toast.error("Escribe tu email");
    try {
      await backendApi.joinProductWaitlist({ productId: String(product.id), productName: product.name, email: waitlistEmail.trim() });
      toast.success("Te avisaremos cuando vuelva a estar disponible");
      setWaitlistEmail("");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar el aviso");
    }
  };

  const submitReview = async () => {
    try {
      await backendApi.submitProductReview({
        productId: String(product.id),
        productName: product.name,
        name: reviewForm.name,
        email: reviewForm.email,
        rating: reviewForm.rating,
        comment: reviewForm.comment,
      });
      toast.success("Reseña enviada. Se publicará después de revisarla.");
      setReviewForm({ name: "", email: "", rating: 5, comment: "" });
    } catch (error: any) {
      toast.error(error?.message || "No se pudo enviar la reseña");
    }
  };

  const addToCart = () => {
    if (!product || stock <= 0) return toast.error("Producto agotado");
    const cart = JSON.parse(backendStorage.getItem("cart") || "[]");
    const lineKey = `${product.id}::${selectedVariant || "base"}::${dedication.trim()}`;
    const existingItem = cart.find((item: any) => item.lineKey === lineKey);
    if (Number(existingItem?.quantity || 0) + quantity > stock) return toast.error(`Solo quedan ${stock} unidades disponibles`);
    if (existingItem) existingItem.quantity += quantity;
    else cart.push({ ...product, price: effectivePrice, quantity, lineKey, selectedVariant: selectedVariant || undefined, personalization: dedication.trim() ? { dedication: dedication.trim() } : undefined });
    void backendStorage.setItem("cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("storage"));
    toast.success("Producto añadido al carrito");
  };

  if (!product) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Producto no encontrado o cargando…</p></div>;
  let aiData: any = null;
  try { aiData = aiDescription ? JSON.parse(aiDescription) : null; } catch {}

  const details = [
    product.size && { icon: Ruler, label: "Tamaño", value: product.size },
    product.difficulty && { icon: Leaf, label: "Dificultad", value: product.difficulty },
    (product.toxicity || product.petSafe !== undefined) && { icon: PawPrint, label: "Mascotas", value: product.petSafe ? "Apta para mascotas" : product.toxicity || "Consultar" },
    product.environment && { icon: PackageCheck, label: "Ubicación", value: product.environment },
  ].filter(Boolean) as any[];

  return <div className="min-h-screen bg-background">
    <motion.div style={{ opacity, scale }} className="sticky top-0 z-40 bg-card/80 backdrop-blur-lg border-b border-border"><div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-4"><button onClick={() => navigate("/productos")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" />Volver a productos</button></div></motion.div>
    <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-14">
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} className="relative"><div className="sticky top-24"><div className="aspect-square rounded-3xl overflow-hidden bg-muted shadow-2xl"><img src={product.image} alt={product.name} className="w-full h-full object-cover" /></div>{product.onSale && <div className="absolute top-6 right-6 px-4 py-2 bg-primary text-primary-foreground rounded-full font-bold shadow-lg">¡OFERTA!</div>}</div></motion.div>
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <div><h1 className="text-4xl md:text-5xl font-bold mb-3">{product.name}</h1><p className="text-muted-foreground text-lg">{product.description}</p></div>
          <div className="text-5xl font-bold text-primary">€{effectivePrice.toFixed(2)}</div>
          <div className="flex flex-wrap gap-2"><span className="px-4 py-2 bg-muted rounded-xl font-medium capitalize">{product.category?.replace("-", " ")}</span>{product.featured && <span className="px-4 py-2 bg-primary/10 text-primary rounded-xl font-medium flex items-center gap-2"><Sparkles className="w-4 h-4" />Destacado</span>}</div>
          {details.length > 0 && <div className="grid grid-cols-2 gap-3">{details.map((d) => <div key={d.label} className="rounded-xl border border-border p-3"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"><d.icon className="h-4 w-4" />{d.label}</div><p className="mt-1 font-semibold">{d.value}</p></div>)}</div>}
          {variants.length > 0 && <div><label className="block text-sm font-medium mb-2">Elige una variante</label><div className="flex flex-wrap gap-2">{variants.map((variant: any) => { const name=String(variant?.name || variant); return <button key={name} onClick={() => setSelectedVariant(name)} className={`rounded-xl border px-4 py-2 ${selectedVariant===name ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{name}{variant?.price ? ` · €${Number(variant.price).toFixed(2)}` : ""}</button>; })}</div></div>}
          {(product.allowDedication || product.personalizable || product.personalizable === undefined) && <div><label className="block text-sm font-medium mb-2">Dedicatoria (opcional)</label><textarea value={dedication} onChange={(e) => setDedication(e.target.value.slice(0, 280))} placeholder="Escribe el mensaje que acompañará al pedido…" className="w-full min-h-24 rounded-xl border border-border bg-background p-3" /><p className="text-xs text-muted-foreground text-right">{dedication.length}/280</p></div>}
          <div className="space-y-2"><label className="block text-sm font-medium">Cantidad</label><div className="flex items-center gap-4"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-12 h-12 rounded-xl bg-muted text-xl font-bold">−</button><span className="text-2xl font-bold w-16 text-center">{quantity}</span><button onClick={() => setQuantity(Math.min(stock || 1, quantity + 1))} className="w-12 h-12 rounded-xl bg-muted text-xl font-bold">+</button></div></div>
          <div className="flex gap-3"><button disabled={stock<=0} onClick={addToCart} className="flex-1 flex items-center justify-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-xl font-semibold text-lg disabled:opacity-50"><ShoppingCart className="w-6 h-6" />{stock<=0 ? "Agotado" : "Añadir al carrito"}</button><button onClick={() => void toggleFavorite()} className={`w-16 h-16 flex items-center justify-center rounded-xl ${favorite ? "bg-primary text-primary-foreground" : "bg-muted"}`}><Heart className={`w-6 h-6 ${favorite ? "fill-current" : ""}`} /></button></div>
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl text-sm">{stock > 0 ? `Disponible · ${stock} en stock` : "Temporalmente agotado"}</div>
          {stock <= 0 && <div className="rounded-2xl border border-border bg-card p-4"><p className="font-semibold">Avísame cuando vuelva</p><div className="mt-3 flex gap-2"><input type="email" value={waitlistEmail} onChange={(e)=>setWaitlistEmail(e.target.value)} placeholder="tu@email.com" className="flex-1 rounded-xl border border-border bg-background px-3 py-2" /><button onClick={() => void joinWaitlist()} className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground">Avisarme</button></div></div>}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-8">
        <div className="text-center"><h2 className="text-3xl md:text-4xl font-bold mb-3">Todo sobre tu planta</h2><p className="text-muted-foreground">Cuidados y recomendaciones para conservarla en las mejores condiciones.</p></div>
        {loadingAI ? <div className="text-center py-16"><span className="text-primary font-medium">Generando información con HerencIA…</span></div> : aiData && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-2xl p-7"><div className="flex items-center gap-3 mb-5"><Leaf className="w-6 h-6 text-primary" /><h3 className="text-2xl font-bold">Descripción</h3></div><p className="leading-relaxed">{aiData.description}</p>{Array.isArray(aiData.benefits) && <div className="mt-5 space-y-2">{aiData.benefits.map((b:string)=><p key={b} className="text-sm text-muted-foreground">• {b}</p>)}</div>}</div>
          <div className="grid gap-3">
            <Care icon={Droplets} title="Riego" text={product.water || aiData.care?.water} />
            <Care icon={Sun} title="Iluminación" text={product.light || aiData.care?.light} />
            <Care icon={ThermometerSun} title="Temperatura" text={product.temperature || aiData.care?.temperature} />
            <Care icon={Leaf} title="Fertilización" text={aiData.care?.fertilizer} />
          </div>
          {aiData.tips && <div className="lg:col-span-2 bg-primary/5 border border-primary/20 rounded-2xl p-7"><h3 className="font-bold text-xl mb-2">Consejos de HerencIA</h3><p>{aiData.tips}</p></div>}
        </div>}
      </motion.div>

      <section className="mt-14 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-2xl font-bold">Reseñas de clientes</h2>
          <p className="mt-1 text-sm text-muted-foreground">Las compras verificadas aparecen identificadas.</p>
          <div className="mt-5 space-y-4">
            {reviews.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay reseñas publicadas.</p> : reviews.map((review:any) => <div key={review.id} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{review.name}</p><span className="text-amber-500">{"★".repeat(Number(review.rating || 0))}{"☆".repeat(5-Number(review.rating || 0))}</span></div>{review.verifiedPurchase && <p className="mt-1 text-xs font-semibold text-primary">Compra verificada</p>}<p className="mt-2 text-sm text-muted-foreground">{review.comment}</p></div>)}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-2xl font-bold">Escribe una reseña</h2>
          <div className="mt-4 space-y-3">
            <input value={reviewForm.name} onChange={(e)=>setReviewForm({...reviewForm,name:e.target.value})} placeholder="Nombre" className="w-full rounded-xl border border-border bg-background p-3" />
            <input type="email" value={reviewForm.email} onChange={(e)=>setReviewForm({...reviewForm,email:e.target.value})} placeholder="Email usado en tu compra" className="w-full rounded-xl border border-border bg-background p-3" />
            <select value={reviewForm.rating} onChange={(e)=>setReviewForm({...reviewForm,rating:Number(e.target.value)})} className="w-full rounded-xl border border-border bg-background p-3"><option value={5}>5 estrellas</option><option value={4}>4 estrellas</option><option value={3}>3 estrellas</option><option value={2}>2 estrellas</option><option value={1}>1 estrella</option></select>
            <textarea value={reviewForm.comment} onChange={(e)=>setReviewForm({...reviewForm,comment:e.target.value})} placeholder="Cuéntanos tu experiencia…" className="min-h-28 w-full rounded-xl border border-border bg-background p-3" />
            <button onClick={() => void submitReview()} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Enviar reseña</button>
          </div>
        </div>
      </section>
    </div>
  </div>;
}

function Care({ icon: Icon, title, text }: { icon: any; title: string; text?: string }) {
  if (!text) return null;
  return <div className="bg-card border border-border rounded-2xl p-5"><div className="flex items-center gap-3 mb-2"><Icon className="w-5 h-5 text-primary" /><h4 className="font-bold">{title}</h4></div><p className="text-sm text-muted-foreground">{text}</p></div>;
}
