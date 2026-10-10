import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowLeft, ShoppingCart, Heart, Leaf, Droplets, Sun, ThermometerSun, Sparkles, Ruler, PawPrint, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { backendApi, backendStorage } from "../lib/backendStorage";
import { defaultSiteContent, parseSiteContent, type SiteContent } from "../lib/siteContent";
import { getCommerceCollection, isPlantCareProduct, primaryCollectionOf } from "../lib/commerceCatalog";
import { deriveVariantOptionGroups, chooseExistingVariant, splitSupplierOptions } from "../lib/productVariantOptions";

export function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [site, setSite] = useState<SiteContent>(defaultSiteContent);
  const [quantity, setQuantity] = useState(1);
  const [serviceHours, setServiceHours] = useState(1);
  const [favorite, setFavorite] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState("");
  const [selectedImage, setSelectedImage] = useState("");
  const [dedication, setDedication] = useState("");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewForm, setReviewForm] = useState({ name: "", email: "", rating: 5, comment: "" });
  const [questions, setQuestions] = useState<any[]>([]);
  const [questionForm, setQuestionForm] = useState({ name: "", email: "", question: "" });
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const { scrollY } = useScroll();
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);
  const scale = useTransform(scrollY, [0, 300], [1, 0.8]);

  useEffect(() => {
    const hydrate = () => setSite(parseSiteContent(backendStorage.getItem("siteContent")));
    hydrate();
    window.addEventListener("storage", hydrate);
    window.addEventListener("backend-storage", hydrate);
    return () => {
      window.removeEventListener("storage", hydrate);
      window.removeEventListener("backend-storage", hydrate);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      try {
        const [detail, catalog] = await Promise.all([
          id ? backendApi.getCommerceProduct(String(id)) : Promise.resolve({ product: null } as any),
          backendApi.listCommerceProducts(),
        ]);
        if (cancelled) return;

        const rows = Array.isArray(catalog.products)
          ? catalog.products.filter((item: any) => item.status === "active" || item.active === true)
          : [];
        setAllProducts(rows);

        const found = detail.product || rows.find((item: any) => String(item.id) === String(id));
        setProduct(found || null);
        if (found) {
          setSelectedVariant(
            Array.isArray(found.variants) && found.variants.length
              ? String(found.variants[0]?.name || found.variants[0])
              : ""
          );
        }
      } catch {
        try {
          const parsed = JSON.parse(backendStorage.getItem("adminProducts") || "[]");
          const rows = Array.isArray(parsed)
            ? parsed.filter((item: any) => (item.status === "active" || item.active !== false) && !item.deletedAt)
            : [];
          if (cancelled) return;
          setAllProducts(rows);
          const found = rows.find((item: any) => String(item.id) === String(id));
          setProduct(found || null);
        } catch {
          setAllProducts([]);
          setProduct(null);
        }
      }

      try {
        setFavorite(JSON.parse(backendStorage.getItem("wishlist") || "[]").map(String).includes(String(id)));
      } catch {
        setFavorite(false);
      }

      backendApi.customerWishlist().then((result)=>setFavorite((result.wishlist||[]).map(String).includes(String(id)))).catch(()=>{});
      if (id) backendApi.listProductReviews(String(id)).then((result) => setReviews(result.reviews || [])).catch(() => setReviews([]));
      if (id) backendApi.listProductQuestions(String(id)).then((result) => setQuestions(result.questions || [])).catch(() => setQuestions([]));
    }

    void loadProduct();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!product) return;
    const previousTitle = document.title;
    document.title = `${product.seoTitle || product.name} | Herencia`;

    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    const created = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      meta.setAttribute("data-herencia-seo", "true");
      document.head.appendChild(meta);
    }
    const previousDescription = meta.content;
    meta.content = String(product.seoDescription || product.description || "").slice(0, 170);

    let ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement | null;
    if (!ogTitle) {
      ogTitle = document.createElement("meta");
      ogTitle.setAttribute("property", "og:title");
      ogTitle.setAttribute("data-herencia-seo", "true");
      document.head.appendChild(ogTitle);
    }
    ogTitle.content = String(product.seoTitle || product.name);

    let ogDescription = document.querySelector('meta[property="og:description"]') as HTMLMetaElement | null;
    if (!ogDescription) {
      ogDescription = document.createElement("meta");
      ogDescription.setAttribute("property", "og:description");
      ogDescription.setAttribute("data-herencia-seo", "true");
      document.head.appendChild(ogDescription);
    }
    ogDescription.content = String(product.seoDescription || product.description || "").slice(0, 170);

    return () => {
      document.title = previousTitle;
      if (created) meta?.remove();
      else if (meta) meta.content = previousDescription;
      document.querySelectorAll('meta[data-herencia-seo="true"][property]').forEach((node) => node.remove());
    };
  }, [product]);

  const variants = useMemo(() => Array.isArray(product?.variants) ? product.variants : [], [product]);
  const selected = variants.find((v: any) => String(v?.name || v) === selectedVariant);
  const optionLabels = Array.isArray(product?.metadata?.variantOptionLabels) ? product.metadata.variantOptionLabels : [];
  const variantOptionGroups = useMemo(() => deriveVariantOptionGroups(variants, optionLabels), [variants, product?.metadata?.variantOptionLabels]);
  const selectedOptionValues = Array.isArray(selected?.optionValues) && selected.optionValues.length
    ? selected.optionValues : splitSupplierOptions(selected?.name || selectedVariant);
  const changeVariantOption = (index: number, value: string) => {
    const next = chooseExistingVariant(variants, selectedVariant, index, value);
    if (!next) return;
    setSelectedVariant(String(next.name || next));
    if (next.image) setSelectedImage(String(next.image));
    setQuantity(1);
  };
  // Every authentic CJ VID is eligible for read-only checkout verification.
  // Never disable a valid alternative merely because it is not the default.
  const cjPendingVariantQuote = Boolean(
    String(product?.metadata?.sourceHost || "").toLowerCase().includes("cjdropshipping.com") &&
    variants.length > 0 &&
    (!selected || !String(selected?.supplierVariantId || "").trim() ||
      !String(selected?.supplierSku || "").trim())
  );
  const galleryImages = useMemo(() => {
    const urls = [
      selected?.image,
      product?.image,
      ...(Array.isArray(product?.images)
        ? product.images.map((image: any) => typeof image === "string" ? image : image?.url)
        : []),
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    return Array.from(new Set(urls));
  }, [product, selected]);
  const effectivePrice = Number(selected?.price ?? (product?.onSale && product?.salePrice ? product.salePrice : product?.price || 0));
  const trackInventory = product?.trackInventory !== false;
  const stock = trackInventory
    ? Math.max(0, Math.floor(Number(selected?.stock ?? product?.stock ?? 0)))
    : Number.POSITIVE_INFINITY;
  const collectionId = product ? primaryCollectionOf(product) : "plantas";
  const collection = getCommerceCollection(collectionId);
  const plantLike = product ? isPlantCareProduct(product) : false;
  const serviceProduct = collectionId === "servicios";
  const serviceMinHours = serviceProduct
    ? Math.max(1, Number(product?.serviceMinHours ?? product?.metadata?.serviceMinHours ?? 1))
    : 1;
  const serviceMaxHours = serviceProduct
    ? Math.max(serviceMinHours, Number(product?.serviceMaxHours ?? product?.metadata?.serviceMaxHours ?? 3))
    : 1;
  const serviceHourStep = serviceProduct
    ? Math.max(1, Number(product?.serviceHourStep ?? product?.metadata?.serviceHourStep ?? 1))
    : 1;
  const serviceHourOptions = serviceProduct
    ? Array.from(
        { length: Math.floor((serviceMaxHours - serviceMinHours) / serviceHourStep) + 1 },
        (_, index) => serviceMinHours + index * serviceHourStep
      ).filter((hours) => hours <= serviceMaxHours)
    : [];
  const detailConfig = site.productDetailPage;

  useEffect(() => {
    if (!serviceProduct) return;
    setServiceHours((current) => {
      const clamped = Math.min(serviceMaxHours, Math.max(serviceMinHours, current));
      return clamped < serviceMinHours ? serviceMinHours : clamped;
    });
  }, [serviceProduct, serviceMinHours, serviceMaxHours]);

  useEffect(() => {
    if (!galleryImages.length) {
      setSelectedImage("");
      return;
    }
    if (selected?.image) {
      setSelectedImage(String(selected.image));
      return;
    }
    setSelectedImage((current) =>
      current && galleryImages.includes(current) ? current : galleryImages[0]
    );
  }, [product?.id, selectedVariant, selected?.image, galleryImages]);
  const relatedProducts = useMemo(() => {
    if (!product) return [];
    const manualIds = Array.isArray(product.relatedProductIds)
      ? product.relatedProductIds.map(String)
      : Array.isArray(product.metadata?.relatedProductIds)
        ? product.metadata.relatedProductIds.map(String)
        : [];

    if (manualIds.length) {
      const byId = new Map(
        allProducts
          .filter((item: any) => item && (item.status === "active" || item.active !== false) && !item.deletedAt)
          .map((item: any) => [String(item.id), item])
      );
      return manualIds.map((id: string) => byId.get(id)).filter(Boolean).slice(0, 8);
    }

    return allProducts
      .filter(
        (item: any) =>
          (item.status === "active" || item.active !== false) &&
          !item.deletedAt &&
          String(item.id) !== String(product.id) &&
          (primaryCollectionOf(item) === collectionId || item.featured)
      )
      .slice(0, 4);
  }, [product, allProducts, collectionId]);

  useEffect(() => {
    if (!product) return;
    const id = "herencia-product-jsonld";
    document.getElementById(id)?.remove();
    const script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context":"https://schema.org","@type":"Product",
      name: product.name,
      description: product.seoDescription || product.description || "",
      image: galleryImages,
      sku: selected?.sku || product.sku || undefined,
      brand: product.vendor ? {"@type":"Brand",name:product.vendor} : undefined,
      offers: {"@type":"Offer",priceCurrency:"EUR",price:effectivePrice,availability:(!trackInventory||stock>0)?"https://schema.org/InStock":"https://schema.org/OutOfStock",url:window.location.href}
    });
    document.head.appendChild(script);
    return () => document.getElementById(id)?.remove();
  }, [product, selectedVariant, effectivePrice, stock, trackInventory, galleryImages]);

  const toggleFavorite = async () => {
    let list: string[] = [];
    try { list = JSON.parse(backendStorage.getItem("wishlist") || "[]").map(String); } catch {}
    const key = String(product.id);
    const next = list.includes(key) ? list.filter((x) => x !== key) : [...list, key];
    setFavorite(next.includes(key));
    await backendStorage.setItem("wishlist", JSON.stringify(next));
    backendApi.customerSaveWishlist(next).catch(()=>null);
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

  const submitQuestion = async () => {
    try {
      await backendApi.submitProductQuestion({
        productId: String(product.id),
        productName: product.name,
        name: questionForm.name,
        email: questionForm.email,
        question: questionForm.question,
      });
      setQuestionForm({ name: "", email: "", question: "" });
      toast.success("Pregunta enviada. La publicaremos cuando tenga respuesta.");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo enviar la pregunta");
    }
  };

  const addToCart = () => {
    if (!product) return;
    if (cjPendingVariantQuote) return toast.error("Selecciona una variante CJ que tenga SKU y VID válidos.");
    if (trackInventory && stock <= 0) return toast.error("Producto agotado");
    const cart = JSON.parse(backendStorage.getItem("cart") || "[]");

    if (serviceProduct) {
      const hours = Math.min(serviceMaxHours, Math.max(serviceMinHours, serviceHours));
      const lineKey = `${product.id}::service::${selectedVariant || "base"}`;
      const existingItem = cart.find((item: any) => item.lineKey === lineKey);
      const serviceLine = {
        ...product,
        price: effectivePrice,
        unitPrice: effectivePrice,
        quantity: 1,
        serviceHours: hours,
        serviceMinHours,
        serviceMaxHours,
        serviceHourStep,
        serviceBooking: true,
        trackInventory: false,
        lineKey,
        selectedVariant: selectedVariant || undefined,
      };
      if (existingItem) Object.assign(existingItem, serviceLine);
      else cart.push(serviceLine);
      void backendStorage.setItem("cart", JSON.stringify(cart));
      window.dispatchEvent(new Event("storage"));
      toast.success(`Reserva añadida: ${hours} ${hours === 1 ? "hora" : "horas"}`);
      return;
    }

    const lineKey = `${product.id}::${selectedVariant || "base"}::${dedication.trim()}`;
    const existingItem = cart.find((item: any) => item.lineKey === lineKey);
    if (trackInventory && Number(existingItem?.quantity || 0) + quantity > stock) {
      return toast.error(`Solo quedan ${stock} unidades disponibles`);
    }
    if (existingItem) existingItem.quantity += quantity;
    else cart.push({ ...product, price: effectivePrice, quantity, lineKey, selectedVariant: selectedVariant || undefined, personalization: dedication.trim() ? { dedication: dedication.trim() } : undefined });
    void backendStorage.setItem("cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("storage"));
    toast.success("Producto añadido al carrito");
  };

  if (!product) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Producto no encontrado o cargando…</p></div>;
  const persistedPlantProfile =
    plantLike && product.plantProfile && typeof product.plantProfile === "object"
      ? product.plantProfile
      : plantLike && product.metadata?.plantProfile && typeof product.metadata.plantProfile === "object"
        ? product.metadata.plantProfile
        : null;
  const hasManualCare = Boolean(product.water || product.light || product.temperature);
  const aiData: any = persistedPlantProfile || (
    plantLike && hasManualCare
      ? {
          description: product.description || "",
          care: {
            water: product.water || "",
            light: product.light || "",
            temperature: product.temperature || "",
            fertilizer: "",
          },
          benefits: [],
          tips: "",
        }
      : null
  );

  const details = [
    plantLike && (product.scientificName || aiData?.scientificName) && { icon: Leaf, label: "Nombre científico", value: product.scientificName || aiData?.scientificName },
    plantLike && product.size && { icon: Ruler, label: "Tamaño", value: product.size },
    plantLike && product.difficulty && { icon: Leaf, label: "Dificultad", value: product.difficulty },
    plantLike && (product.toxicity || product.petSafe !== undefined) && { icon: PawPrint, label: "Mascotas", value: product.petSafe ? "Apta para mascotas" : product.toxicity || "Consultar" },
    plantLike && product.environment && { icon: PackageCheck, label: "Ubicación", value: product.environment },
    !plantLike && product.material && { icon: PackageCheck, label: "Material", value: product.material },
    !plantLike && product.color && { icon: Sparkles, label: "Color", value: product.color },
    !plantLike && product.dimensions && { icon: Ruler, label: "Dimensiones", value: product.dimensions },
    !plantLike && product.weight && { icon: PackageCheck, label: "Peso", value: product.weight },
    collectionId === "dulce" && product.flavor && { icon: Sparkles, label: "Sabor", value: product.flavor },
    collectionId === "dulce" && product.portions && { icon: PackageCheck, label: "Porciones", value: product.portions },
    collectionId === "dulce" && product.allergens && { icon: PackageCheck, label: "Alérgenos", value: product.allergens },
    serviceProduct && product.durationMinutes && { icon: PackageCheck, label: "Duración", value: `${product.durationMinutes} min` },
    serviceProduct && product.serviceArea && { icon: PackageCheck, label: "Zona", value: product.serviceArea },
    serviceProduct && product.leadTimeDays !== null && product.leadTimeDays !== undefined && { icon: PackageCheck, label: "Antelación", value: `${product.leadTimeDays} días` },
  ].filter(Boolean) as any[];

  return <div className="min-h-screen bg-background">
    <motion.div style={{ opacity, scale }} className="sticky top-0 z-40 bg-card/80 backdrop-blur-lg border-b border-border"><div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-4"><button onClick={() => navigate("/productos")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" />Volver a productos</button></div></motion.div>
    <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-14">
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} className="relative">
          <div className="sticky top-24">
            <div
              className="relative aspect-square overflow-hidden bg-muted shadow-2xl"
              style={{ borderRadius: `${Math.max(0, Math.min(48, Number(detailConfig.galleryRadius ?? 24)))}px` }}
            >
              {selectedImage ? (
                <img src={selectedImage} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">Sin imagen</div>
              )}
              {product.onSale && <div className="absolute right-6 top-6 rounded-full bg-primary px-4 py-2 font-bold text-primary-foreground shadow-lg">¡OFERTA!</div>}
            </div>

            {plantLike && galleryImages.length > 0 && (
              <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">🌿 Cada ejemplar es único.</span>{" "}
                  Las imágenes son orientativas. Seleccionaremos para ti uno de nuestros mejores ejemplares,
                  lo más parecido posible al mostrado.
                </p>
              </div>
            )}

            {detailConfig.showGalleryThumbnails !== false && galleryImages.length > 1 && (
              <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5">
                {galleryImages.map((imageUrl, index) => (
                  <button
                    key={imageUrl}
                    type="button"
                    onClick={() => setSelectedImage(imageUrl)}
                    className={`aspect-square overflow-hidden rounded-xl border bg-muted transition ${
                      selectedImage === imageUrl ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/50"
                    }`}
                    aria-label={`Ver imagen ${index + 1}`}
                  >
                    <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold mb-3">{product.name}</h1>
            {detailConfig.showDescription !== false && <p className="text-muted-foreground text-lg">{product.description}</p>}
          </div>
          <div className="text-5xl font-bold text-primary">
            €{effectivePrice.toFixed(2)}
            {serviceProduct && <span className="ml-2 text-lg font-semibold text-muted-foreground">/ hora</span>}
          </div>
          <div className="flex flex-wrap gap-2"><span className="px-4 py-2 bg-muted rounded-xl font-medium">{collection.name}</span>{product.featured && <span className="px-4 py-2 bg-primary/10 text-primary rounded-xl font-medium flex items-center gap-2"><Sparkles className="w-4 h-4" />Destacado</span>}</div>
          {detailConfig.showDetails !== false && details.length > 0 && <div className="grid grid-cols-2 gap-3">{details.map((d) => <div key={d.label} className="rounded-xl border border-border p-3"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"><d.icon className="h-4 w-4" />{d.label}</div><p className="mt-1 font-semibold">{d.value}</p></div>)}</div>}
          {detailConfig.showVariants !== false && variants.length > 0 && (variantOptionGroups.length > 0 ? (
            <div className="space-y-4">
              {variantOptionGroups.map((group,index)=>(
                <div key={index}>
                  <p className="mb-2 text-sm font-bold">{group.label}: <span className="font-normal">{selectedOptionValues[index] || "Selecciona"}</span></p>
                  <div className="flex flex-wrap gap-2">
                    {group.values.map(value=>{
                      const exists=variants.some((v:any)=>{
                        const options=Array.isArray(v.optionValues)&&v.optionValues.length?v.optionValues:splitSupplierOptions(v.name||v);
                        return options[index]===value;
                      });
                      return <button type="button" key={value} disabled={!exists}
                        aria-pressed={selectedOptionValues[index]===value}
                        onClick={()=>changeVariantOption(index,value)}
                        className={`rounded-xl border px-4 py-2 text-sm font-semibold ${selectedOptionValues[index]===value?"border-primary bg-primary/10 text-primary":"border-border"}`}>{value}</button>;
                    })}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Solo se pueden elegir combinaciones existentes. El transporte y los costes CJ se verifican antes del cobro.</p>
            </div>
          ) : <div><label className="mb-2 block text-sm font-medium">Elige una variante</label><div className="flex flex-wrap gap-2">{variants.map((variant:any)=>{
            const name=String(variant?.name||variant);
            return <button key={name} type="button" onClick={()=>{setSelectedVariant(name);if(variant?.image)setSelectedImage(String(variant.image));}} className={`rounded-xl border px-4 py-2 ${selectedVariant===name?"border-primary bg-primary/10 text-primary":"border-border"}`}>{name}</button>;
          })}</div></div>)}
          {cjPendingVariantQuote && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Esta opción no tiene un SKU/VID CJ válido. Revisa el producto en Administración.</p>}
          {detailConfig.showDedication !== false && (product.allowDedication || product.personalizable || product.personalizable === undefined) && <div><label className="block text-sm font-medium mb-2">Dedicatoria (opcional)</label><textarea value={dedication} onChange={(e) => setDedication(e.target.value.slice(0, 280))} placeholder="Escribe el mensaje que acompañará al pedido…" className="w-full min-h-24 rounded-xl border border-border bg-background p-3" /><p className="text-xs text-muted-foreground text-right">{dedication.length}/280</p></div>}
          {serviceProduct ? (
            <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div>
                <label className="block text-sm font-bold">¿Cuántas horas quieres reservar?</label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Mínimo {serviceMinHours} {serviceMinHours === 1 ? "hora" : "horas"}. El precio lo configuras tú desde Administración.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {serviceHourOptions.map((hours) => (
                  <button
                    key={hours}
                    type="button"
                    onClick={() => setServiceHours(hours)}
                    className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                      serviceHours === hours
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:border-primary/50"
                    }`}
                  >
                    {hours} {hours === 1 ? "hora" : "horas"} · €{(effectivePrice * hours).toFixed(2)}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-xl bg-background px-4 py-3">
                <span className="text-sm font-semibold">Total de la reserva</span>
                <span className="text-xl font-black text-primary">€{(effectivePrice * serviceHours).toFixed(2)}</span>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Si el servicio requiere más tiempo del reservado, las horas adicionales se abonarán posteriormente.
              </p>
            </div>
          ) : detailConfig.showQuantity !== false ? (
            <div className="space-y-2"><label className="block text-sm font-medium">Cantidad</label><div className="flex items-center gap-4"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-12 h-12 rounded-xl bg-muted text-xl font-bold">−</button><span className="text-2xl font-bold w-16 text-center">{quantity}</span><button onClick={() => setQuantity(trackInventory ? Math.min(Number.isFinite(stock) ? stock : 99, quantity + 1) : Math.min(99, quantity + 1))} className="w-12 h-12 rounded-xl bg-muted text-xl font-bold">+</button></div></div>
          ) : null}
          <div className="flex gap-3"><button disabled={cjPendingVariantQuote || (trackInventory && stock<=0)} onClick={addToCart} className="flex-1 flex items-center justify-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-xl font-semibold text-lg disabled:opacity-50"><ShoppingCart className="w-6 h-6" />{trackInventory && stock<=0 ? "Agotado" : serviceProduct ? `Reservar y pagar ${serviceHours} ${serviceHours === 1 ? "hora" : "horas"}` : "Añadir al carrito"}</button>{detailConfig.showFavorite !== false && <button onClick={() => void toggleFavorite()} className={`w-16 h-16 flex items-center justify-center rounded-xl ${favorite ? "bg-primary text-primary-foreground" : "bg-muted"}`}><Heart className={`w-6 h-6 ${favorite ? "fill-current" : ""}`} /></button>}</div>
          {detailConfig.showStock !== false && <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl text-sm">{trackInventory ? (stock > 0 ? `Disponible · ${stock} en stock` : "Temporalmente agotado") : serviceProduct ? "Disponible para contratación" : "Disponible"}</div>}
          {detailConfig.showCare !== false && plantLike && aiData && <Link to={`/cuidados/${product.id}`} className="flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 font-semibold text-primary hover:bg-primary/10"><Leaf className="h-5 w-5"/>Ver pasaporte y QR de cuidados</Link>}
          {detailConfig.showWaitlist !== false && trackInventory && stock <= 0 && <div className="rounded-2xl border border-border bg-card p-4"><p className="font-semibold">Avísame cuando vuelva</p><div className="mt-3 flex gap-2"><input type="email" value={waitlistEmail} onChange={(e)=>setWaitlistEmail(e.target.value)} placeholder="tu@email.com" className="flex-1 rounded-xl border border-border bg-background px-3 py-2" /><button onClick={() => void joinWaitlist()} className="rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground">Avisarme</button></div></div>}
        </motion.div>
      </div>

      {plantLike && aiData ? (
        detailConfig.showCare !== false ? (
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-8">
          <div className="text-center"><h2 className="text-3xl md:text-4xl font-bold mb-3">Todo sobre tu planta</h2><p className="text-muted-foreground">Cuidados y recomendaciones para conservarla en las mejores condiciones.</p></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-2xl p-7"><div className="flex items-center gap-3 mb-5"><Leaf className="w-6 h-6 text-primary" /><h3 className="text-2xl font-bold">Descripción</h3></div><p className="leading-relaxed">{aiData.description}</p>{Array.isArray(aiData.benefits) && <div className="mt-5 space-y-2">{aiData.benefits.map((b:string)=><p key={b} className="text-sm text-muted-foreground">• {b}</p>)}</div>}</div>
            <div className="grid gap-3">
              <Care icon={Droplets} title="Riego" text={product.water || aiData.care?.water} />
              <Care icon={Sun} title="Iluminación" text={product.light || aiData.care?.light} />
              <Care icon={ThermometerSun} title="Temperatura" text={product.temperature || aiData.care?.temperature} />
              <Care icon={Leaf} title="Fertilización" text={aiData.care?.fertilizer} />
            </div>
            {aiData.tips && <div className="lg:col-span-2 bg-primary/5 border border-primary/20 rounded-2xl p-7"><h3 className="font-bold text-xl mb-2">Consejos de HerencIA</h3><p>{aiData.tips}</p></div>}
          </div>
        </motion.div>
        ) : null
      ) : (
        detailConfig.showDetails !== false ? (
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-3xl border border-border bg-card p-7">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">{collection.name}</p>
          <h2 className="mt-2 text-3xl font-bold">Información del artículo</h2>
          <p className="mt-4 max-w-3xl leading-7 text-muted-foreground">{product.description}</p>
          {serviceProduct && product.bookingRequired && <div className="mt-5 rounded-xl bg-primary/5 p-4 text-sm font-semibold text-primary">La reserva se confirma pagando las horas seleccionadas. La fecha y los detalles del servicio se coordinan en el checkout.</div>}
          {collectionId === "dulce" && product.requiresRefrigeration && <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm font-semibold text-blue-800">Conservar refrigerado.</div>}
        </motion.div>
        ) : null
      )}

      {detailConfig.showRelated !== false && (
        <section className="mt-14">
          <div className="mb-5"><h2 className="text-3xl font-bold">{detailConfig.relatedTitle}</h2><p className="mt-1 text-muted-foreground">{detailConfig.relatedSubtitle}</p></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {relatedProducts.map((p:any)=><Link key={p.id} to={`/producto/${p.id}`} className="overflow-hidden rounded-2xl border border-border bg-card transition hover:shadow-lg"><img src={p.image} alt={p.name} className="h-44 w-full object-cover"/><div className="p-4"><p className="font-semibold line-clamp-1">{p.name}</p><p className="mt-1 font-bold text-primary">€{Number(p.salePrice||p.price||0).toFixed(2)}</p></div></Link>)}
          </div>
        </section>
      )}

      {detailConfig.showReviews !== false && (
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
      )}

      {detailConfig.showQuestions !== false && (
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-2xl font-bold">Preguntas sobre este producto</h2>
          <div className="mt-5 space-y-3">{questions.length===0?<p className="text-sm text-muted-foreground">Todavía no hay preguntas respondidas.</p>:questions.map((q:any)=><div key={q.id} className="rounded-xl border border-border p-4"><p className="font-semibold">P: {q.question}</p><p className="mt-2 text-sm text-muted-foreground"><strong className="text-foreground">Herencia:</strong> {q.answer}</p></div>)}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-2xl font-bold">Pregunta a Herencia</h2>
          <div className="mt-4 space-y-3"><input value={questionForm.name} onChange={(e)=>setQuestionForm({...questionForm,name:e.target.value})} placeholder="Nombre" className="w-full rounded-xl border border-border p-3"/><input type="email" value={questionForm.email} onChange={(e)=>setQuestionForm({...questionForm,email:e.target.value})} placeholder="Email" className="w-full rounded-xl border border-border p-3"/><textarea value={questionForm.question} onChange={(e)=>setQuestionForm({...questionForm,question:e.target.value})} placeholder="¿Qué quieres saber?" className="min-h-28 w-full rounded-xl border border-border p-3"/><button onClick={()=>void submitQuestion()} className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Enviar pregunta</button></div>
        </div>
      </section>
      )}
    </div>
  </div>;
}

function Care({ icon: Icon, title, text }: { icon: any; title: string; text?: string }) {
  if (!text) return null;
  return <div className="bg-card border border-border rounded-2xl p-5"><div className="flex items-center gap-3 mb-2"><Icon className="w-5 h-5 text-primary" /><h4 className="font-bold">{title}</h4></div><p className="text-sm text-muted-foreground">{text}</p></div>;
}
