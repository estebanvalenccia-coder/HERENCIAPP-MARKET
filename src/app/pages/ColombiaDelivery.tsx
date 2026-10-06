import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Gift,
  Heart,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  Sparkles,
  Truck,
} from "lucide-react";
import { backendApi, backendStorage } from "../lib/backendStorage";
import { StripeCheckout } from "../components/StripeCheckout";
import {
  defaultColombiaDeliverySettings,
  parseColombiaDeliverySettings,
  type ColombiaDeliverySettings,
} from "../lib/internationalDelivery";
import { defaultSiteContent, parseSiteContent } from "../lib/siteContent";

function moneyEUR(value: unknown) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}
function moneyCOP(value: unknown) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value || 0));
}
function categoryOf(product: any) {
  const raw = String(product?.category || product?.collection || "").toLowerCase();
  if (raw.includes("orqu")) return "Orquídeas";
  if (raw.includes("flor") || raw.includes("ramo")) return "Ramos y flores";
  if (raw.includes("dulce") || raw.includes("chocolate")) return "Chocolates y detalles";
  if (raw.includes("peluche")) return "Peluches";
  if (raw.includes("regalo") || raw.includes("combo")) return "Combos regalo";
  return "Plantas";
}
function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

export function ColombiaDelivery() {
  const [settings, setSettings] = useState<ColombiaDeliverySettings>(defaultColombiaDeliverySettings);
  const [products, setProducts] = useState<any[]>([]);
  const [zoneId, setZoneId] = useState("cali");
  const [productId, setProductId] = useState("");
  const [category, setCategory] = useState("Todas");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [address, setAddress] = useState("");
  const [references, setReferences] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [deliveryComments, setDeliveryComments] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [occasion, setOccasion] = useState("Cumpleaños");
  const [surprise, setSurprise] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("09:00–13:00");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [showStripe, setShowStripe] = useState(false);

  useEffect(() => {
    const loadSettings = () => {
      const parsed = parseColombiaDeliverySettings(backendStorage.getItem("internationalDeliverySettings"));
      setSettings(parsed);
      const firstZone = parsed.zones.find((z) => z.enabled);
      if (firstZone) setZoneId((current) => parsed.zones.some((z) => z.id === current && z.enabled) ? current : firstZone.id);
    };
    loadSettings();
    window.addEventListener("backend-storage", loadSettings);
    window.addEventListener("storage", loadSettings);
    backendApi.listCommerceProducts()
      .then(({ products }) => setProducts(Array.isArray(products) ? products.filter((p:any) => p?.active !== false && !p?.deletedAt) : []))
      .catch(() => setProducts([]));
    return () => {
      window.removeEventListener("backend-storage", loadSettings);
      window.removeEventListener("storage", loadSettings);
    };
  }, []);

  const visibleProducts = useMemo(() => {
    const selected = new Set(settings.selectedProductIds.map(String));
    const base = settings.selectedProductIds.length
      ? products.filter((p) => selected.has(String(p.id)))
      : products.filter((p) => p?.featured || ["plantas", "flores", "regalos", "dulce"].includes(String(p?.category || "").toLowerCase()));
    return (base.length ? base : products)
      .filter((p) => settings.productOverrides[String(p.id)]?.enabled !== false)
      .slice(0, 24);
  }, [products, settings.selectedProductIds, settings.productOverrides]);

  const categories = useMemo(() => ["Todas", ...Array.from(new Set(visibleProducts.map(categoryOf)))], [visibleProducts]);
  const filteredProducts = useMemo(
    () => category === "Todas" ? visibleProducts : visibleProducts.filter((p) => categoryOf(p) === category),
    [visibleProducts, category]
  );

  useEffect(() => {
    if (!productId && visibleProducts[0]?.id) setProductId(String(visibleProducts[0].id));
  }, [visibleProducts, productId]);

  const zone = settings.zones.find((z) => z.id === zoneId && z.enabled) || settings.zones.find((z) => z.enabled);
  const product = visibleProducts.find((p) => String(p.id) === productId);
  const override = product ? settings.productOverrides[String(product.id)] : undefined;
  const baseEUR = Number(product?.onSale && product?.salePrice ? product.salePrice : product?.price || 0);
  const productCOP = Number(override?.priceCOP || Math.round(baseEUR * 4300 / 100) * 100);
  const totalCOP = productCOP + Number(zone?.feeCOP || 0);
  const totalEUR = baseEUR + Number(zone?.feeEUR || 0);

  const submit = () => {
    if (!product) return;
    if (!recipientName.trim() || !address.trim() || !neighborhood.trim() || (settings.recipientPhoneRequired && !recipientPhone.trim())) {
      window.alert("Completa destinatario, teléfono, dirección y barrio/vereda.");
      return;
    }
    if (settings.paymentEnabled && (!buyerName.trim() || !buyerEmail.trim())) {
      window.alert("Completa tu nombre y email para el pago.");
      return;
    }
    if (settings.paymentEnabled) {
      setShowStripe(true);
      return;
    }

    const site = parseSiteContent(backendStorage.getItem("siteContent"));
    const phone = String(site.floatingWhatsapp?.phone || site.footer?.whatsappPhone || defaultSiteContent.floatingWhatsapp.phone || "").replace(/\D/g, "");
    const lines = [
      "Hola Herencia 🌿 Quiero enviar un regalo en Colombia.",
      "",
      `🇨🇴 Zona: ${zone?.name || "Cali / Candelaria"}`,
      `🎁 Producto: ${product.name}`,
      `💰 Producto: ${moneyCOP(productCOP)} (≈ ${moneyEUR(baseEUR)})`,
      zone ? `🚚 Domicilio: ${moneyCOP(zone.feeCOP)} (≈ ${moneyEUR(zone.feeEUR)}) · ${zone.eta}` : "",
      `🧾 Total estimado: ${moneyCOP(totalCOP)} (≈ ${moneyEUR(totalEUR)})`,
      "",
      `👤 Destinatario: ${recipientName.trim()}`,
      `📞 Teléfono: ${recipientPhone.trim() || "No indicado"}`,
      `📍 Dirección: ${address.trim()}`,
      neighborhood.trim() ? `🏘️ Barrio / vereda: ${neighborhood.trim()}` : "",
      references.trim() ? `🗺️ Referencias: ${references.trim()}` : "",
      deliveryComments.trim() ? `📝 Comentarios de entrega: ${deliveryComments.trim()}` : "",
      giftMessage.trim() ? `💌 ${occasion}: ${giftMessage.trim()}` : "",
      surprise ? "🎀 Es una sorpresa: no mostrar precio al destinatario." : "",
      deliveryDate ? `📅 Fecha: ${deliveryDate} · ${deliveryTime}` : "",
      "",
      settings.paymentEnabled
        ? "Quiero continuar con el pago y confirmar el pedido."
        : "Por favor confirmen disponibilidad y total antes de preparar la entrega.",
    ].filter(Boolean);

    localStorage.setItem("herenciaInternationalDeliveryDraft", JSON.stringify({
      country: "Colombia",
      zone: zone?.name || "",
      zoneId: zone?.id || "",
      productId: String(product.id),
      productName: product.name,
      productCOP,
      deliveryFeeCOP: Number(zone?.feeCOP || 0),
      totalCOP,
      totalEUR,
      recipientName: recipientName.trim(),
      recipientPhone: recipientPhone.trim(),
      address: address.trim(),
      neighborhood: neighborhood.trim(),
      references: references.trim(),
      deliveryComments: deliveryComments.trim(),
      occasion,
      giftMessage: giftMessage.trim(),
      surprise,
      deliveryDate: deliveryDate || null,
      deliveryTime: deliveryDate ? deliveryTime : null,
      createdAt: new Date().toISOString(),
    }));

    const text = encodeURIComponent(lines.join("\n"));
    if (phone) window.open(`https://wa.me/${phone}?text=${text}`, "_blank", "noopener,noreferrer");
    else window.location.href = `mailto:?subject=${encodeURIComponent("Domicilio Herencia en Colombia")}&body=${text}`;
  };

  if (!settings.enabled) {
    return <div className="mx-auto max-w-3xl px-5 py-20 text-center"><h1 className="text-3xl font-semibold">Entregas en Colombia temporalmente no disponibles</h1></div>;
  }

  return (
    <div className="bg-[#fbfaf6] text-[#173126]">
      <section className="relative overflow-hidden bg-[#193628]">
        <img
          src={settings.heroImageUrl}
          alt="Herencia Colombia en Cali"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,36,26,.70)_0%,rgba(18,36,26,.42)_38%,rgba(18,36,26,.18)_68%,rgba(18,36,26,.28)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#f4d21f] via-[#184aa5] to-[#c9282d]" />

        <div className="relative mx-auto flex min-h-[510px] max-w-[1440px] items-center px-5 pb-28 pt-14 sm:px-8 lg:px-12">
          <div className="ml-auto w-full max-w-[820px] text-white lg:w-[64%]">
            <p className="inline-flex items-center gap-3 text-[13px] font-black uppercase tracking-[0.34em] text-white/95">
              <span className="text-xl leading-none">{settings.flag}</span>
              <span>{settings.heroKicker || "COLOMBIANÍSIMAS"}</span>
            </p>
            <h1 className="mt-4 max-w-[800px] font-serif text-5xl font-medium leading-[.98] tracking-[-.03em] sm:text-6xl lg:text-[72px]">
              {settings.headline}
            </h1>
            <p className="mt-6 max-w-[720px] text-lg leading-7 text-white/92">
              {settings.description}
            </p>
            <button
              onClick={() => document.getElementById("catalogo-colombia")?.scrollIntoView({ behavior:"smooth" })}
              className="mt-7 inline-flex items-center gap-3 rounded-full border border-white/35 bg-[#155438] px-7 py-4 text-base font-black text-white shadow-[0_16px_36px_rgba(0,0,0,.28)] transition hover:-translate-y-0.5 hover:bg-[#10452f]"
            >
              {settings.heroCtaLabel || "Enviar un regalo a Cali"} <ChevronRight className="h-5 w-5" />
            </button>

            <div className="mt-7 grid max-w-[760px] grid-cols-2 gap-x-5 gap-y-3 rounded-[24px] border border-white/10 bg-[#20150f]/50 px-5 py-4 text-sm font-semibold text-white/95 backdrop-blur-md sm:grid-cols-4">
              <span className="inline-flex items-center gap-2"><Gift className="h-5 w-5"/>Plantas y flores frescas</span>
              <span className="inline-flex items-center gap-2"><Truck className="h-5 w-5"/>Entrega el mismo día</span>
              <span className="inline-flex items-center gap-2"><PackageCheck className="h-5 w-5"/>Regalos personalizados</span>
              <span className="inline-flex items-center gap-2"><Heart className="h-5 w-5"/>Mensajes desde el corazón</span>
            </div>
          </div>
        </div>

        <div className="relative mx-auto -mt-[72px] max-w-[1440px] px-5 pb-3 sm:px-8 lg:px-12">
          <div className="grid gap-3 rounded-[26px] border border-[#e7dfd4] bg-[#fffdf9]/97 p-3 shadow-[0_20px_60px_rgba(45,39,28,.16)] backdrop-blur md:grid-cols-[245px_1fr]">
            <div className="flex items-center gap-4 rounded-[20px] px-4 py-3 text-[#183126]">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#52715d] text-white shadow-sm"><MapPin className="h-6 w-6"/></span>
              <div><p className="text-lg font-black">Entrega en Cali</p><p className="text-sm font-semibold text-[#52675a]">y alrededores</p></div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {settings.zones.filter((z)=>z.enabled).slice(0,4).map((z,index)=>(
                <button
                  key={z.id}
                  onClick={()=>{setZoneId(z.id);document.getElementById("catalogo-colombia")?.scrollIntoView({behavior:"smooth"});}}
                  className={`group flex min-h-[78px] items-center justify-between rounded-[18px] border px-5 py-3 text-left transition ${index===0?"border-[#6f9a7e] bg-[#f6faf6]":"border-[#e5ddd2] bg-[#fffdf9] hover:border-[#9ab29f]"}`}
                >
                  <div>
                    <p className="font-black text-[#2a302b]">{z.name}</p>
                    <p className="mt-0.5 text-sm font-semibold text-[#3d4e43]">{z.eta}</p>
                    <p className="mt-0.5 text-[11px] text-[#8b877f]">{z.note}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-[#3b493f] transition group-hover:translate-x-0.5"/>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="catalogo-colombia" className="mx-auto max-w-[1440px] px-5 pb-12 pt-8 sm:px-8 lg:px-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[#807d73]">Nuestras categorías en Cali</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-.02em] text-[#173126] sm:text-4xl">Regalos con esencia caleña</h2>
          </div>
          <button onClick={()=>setCategory("Todas")} className="hidden text-sm font-black text-[#22372c] sm:inline-flex">Ver todas las categorías <ChevronRight className="ml-1 h-4 w-4"/></button>
        </div>

        <div className="mt-6 flex gap-5 overflow-x-auto pb-4">
          {categories.filter((item)=>item!=="Todas").map((item)=>{
            const sample=visibleProducts.find((p)=>categoryOf(p)===item);
            const image=sample?.image || sample?.images?.[0]?.url || sample?.images?.[0];
            return (
              <button key={item} onClick={()=>setCategory(item)} className="group min-w-[92px] text-center">
                <span className={`mx-auto block h-[88px] w-[88px] overflow-hidden rounded-[30px] border bg-[#f0e7d9] shadow-sm transition group-hover:-translate-y-1 ${category===item?"border-[#315b42] ring-2 ring-[#315b42]/15":"border-[#eadfce]"}`}>
                  {image ? <img src={image} alt={item} className="h-full w-full object-cover"/> : <span className="grid h-full w-full place-items-center"><Gift className="h-7 w-7 text-[#6f7f73]"/></span>}
                </span>
                <span className="mt-2 block text-sm font-bold text-[#28352d]">{item}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-7 flex items-end justify-between gap-4">
          <div>
            <h3 className="font-serif text-3xl font-semibold tracking-[-.02em] text-[#173126]">Los más populares en Cali</h3>
            <p className="mt-1 text-sm text-[#6f796f]">{category==="Todas"?"Selección disponible para entrega en Colombia":category}</p>
          </div>
          {category!=="Todas" && <button onClick={()=>setCategory("Todas")} className="text-sm font-black text-[#22372c]">Ver todo <ChevronRight className="ml-1 inline h-4 w-4"/></button>}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {filteredProducts.map((item) => {
            const selected = String(item.id) === productId;
            const itemOverride = settings.productOverrides[String(item.id)];
            const itemEUR = Number(item.onSale && item.salePrice ? item.salePrice : item.price || 0);
            const itemCOP = Number(itemOverride?.priceCOP || Math.round(itemEUR * 4300 / 100) * 100);
            return (
              <button key={item.id} onClick={() => setProductId(String(item.id))} className={`group overflow-hidden rounded-[18px] border bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md ${selected ? "border-[#315b42] ring-2 ring-[#315b42]/15" : "border-[#e8e1d6]"}`}>
                <div className="relative aspect-[4/3] bg-[#f0ede6]">
                  <img src={item.image || item.images?.[0]?.url || item.images?.[0]} alt={item.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]" />
                  <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-[#314138] shadow"><Heart className="h-4 w-4"/></span>
                </div>
                <div className="p-4">
                  <p className="line-clamp-1 font-black text-[#28342d]">{itemOverride?.label || item.name}</p>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <div><p className="font-black text-[#173126]">{moneyCOP(itemCOP)}</p><p className="text-[11px] text-[#7d877f]">≈ {moneyEUR(itemEUR)}</p></div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-black ${selected?"bg-[#315b42] text-white":"bg-[#edf3ed] text-[#315b42]"}`}>{selected?"Elegido":"Elegir"}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {filteredProducts.length===0 && <div className="mt-6 rounded-3xl border border-dashed border-[#d9d1c5] bg-white p-10 text-center text-sm text-[#748077]">No hay productos publicados en esta categoría todavía.</div>}
      </section>

      <section className="border-y border-[#e3ded3] bg-[#f5f2eb]">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-10">
          <div className="grid gap-4 xl:grid-cols-5">
            <StepCard number="1" title="Producto y zona">
              {product ? (
                <div className="flex gap-3">
                  <img src={product.image || product.images?.[0]?.url || product.images?.[0]} alt="" className="h-20 w-20 rounded-2xl object-cover" />
                  <div><p className="font-black">{product.name}</p><p className="text-sm font-bold">{moneyCOP(productCOP)}</p><p className="text-xs text-[#718076]">{zone?.name}</p></div>
                </div>
              ) : <p className="text-sm text-[#718076]">Elige un producto.</p>}
            </StepCard>

            <StepCard number="2" title="Dirección y destinatario">
              <div className="grid gap-2">
                <input value={recipientName} onChange={(e)=>setRecipientName(e.target.value)} placeholder="Nombre del destinatario" className="rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5 text-sm" />
                <div className="relative"><Phone className="absolute left-3 top-3 h-4 w-4 text-[#829087]"/><input value={recipientPhone} onChange={(e)=>setRecipientPhone(e.target.value)} placeholder="Teléfono del destinatario" className="w-full rounded-xl border border-[#ddd7cb] bg-white py-2.5 pl-9 pr-3 text-sm" /></div>
                <input value={neighborhood} onChange={(e)=>setNeighborhood(e.target.value)} placeholder="Barrio / vereda / sector" className="rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5 text-sm" />
                <textarea value={address} onChange={(e)=>setAddress(e.target.value)} placeholder="Dirección completa: calle, carrera, número, apartamento/casa..." rows={3} className="rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5 text-sm" />
                <input value={references} onChange={(e)=>setReferences(e.target.value)} placeholder="Referencias: portería, torre, color de casa..." className="rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5 text-sm" />
                <textarea value={deliveryComments} onChange={(e)=>setDeliveryComments(e.target.value.slice(0,400))} placeholder="Comentarios para la entrega: llamar antes, dejar en portería, no tocar timbre..." rows={3} className="rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5 text-sm" />
                <p className="text-right text-[11px] text-[#829087]">{deliveryComments.length}/400</p>
              </div>
            </StepCard>

            <StepCard number="3" title="Mensaje para la tarjeta">
              <div className="flex flex-wrap gap-2">
                {["Cumpleaños","Amor","Agradecimiento"].map((item)=><button key={item} onClick={()=>setOccasion(item)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${occasion===item?"bg-[#315b42] text-white":"bg-white border border-[#ddd7cb]"}`}>{item}</button>)}
              </div>
              {settings.giftMessageEnabled && <textarea value={giftMessage} onChange={(e)=>setGiftMessage(e.target.value.slice(0,200))} placeholder="Escribe tu mensaje..." rows={5} className="mt-3 w-full rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5 text-sm" />}
              <div className="mt-2 flex justify-between text-[11px] text-[#829087]"><span>{giftMessage.length}/200</span></div>
              {settings.surpriseEnabled && <label className="mt-3 flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={surprise} onChange={(e)=>setSurprise(e.target.checked)}/> Es una sorpresa (no mostrar precio)</label>}
            </StepCard>

            <StepCard number="4" title="Fecha y hora de entrega">
              {settings.schedulingEnabled ? (
                <div className="space-y-3">
                  <label className="block text-xs font-bold"><CalendarDays className="mr-1 inline h-4 w-4"/>Elegir fecha<input type="date" min={todayIso()} value={deliveryDate} onChange={(e)=>setDeliveryDate(e.target.value)} className="mt-2 w-full rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5 text-sm" /></label>
                  <label className="block text-xs font-bold"><Clock3 className="mr-1 inline h-4 w-4"/>Franja horaria<select value={deliveryTime} onChange={(e)=>setDeliveryTime(e.target.value)} className="mt-2 w-full rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5 text-sm"><option>09:00–13:00</option><option>13:00–17:00</option><option>17:00–20:00</option></select></label>
                </div>
              ) : <p className="text-sm text-[#718076]">La fecha se confirmará por WhatsApp.</p>}
            </StepCard>

            <StepCard number="5" title="Pago y confirmación">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Producto</span><b>{moneyCOP(productCOP)}</b></div>
                <div className="flex justify-between"><span>Envío</span><b>{moneyCOP(zone?.feeCOP || 0)}</b></div>
                <div className="flex justify-between border-t border-[#ddd7cb] pt-2 text-base"><span className="font-black">Total</span><b>{moneyCOP(totalCOP)}</b></div>
                <p className="text-right text-xs text-[#718076]">≈ {moneyEUR(totalEUR)}</p>
              </div>
              {settings.paymentEnabled && (
                <div className="mt-4 grid gap-2">
                  <input value={buyerName} onChange={(e)=>setBuyerName(e.target.value)} placeholder="Tu nombre (quien compra)" className="rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5 text-sm" />
                  <input type="email" value={buyerEmail} onChange={(e)=>setBuyerEmail(e.target.value)} placeholder="Tu email para el recibo" className="rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5 text-sm" />
                  <input value={buyerPhone} onChange={(e)=>setBuyerPhone(e.target.value)} placeholder="Tu teléfono / WhatsApp (opcional)" className="rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5 text-sm" />
                </div>
              )}
              <button onClick={submit} disabled={!product} className="mt-4 w-full rounded-xl bg-[#315b42] px-4 py-3 font-black text-white disabled:opacity-50">
                {settings.paymentEnabled ? "Pagar en COP con Stripe" : "Confirmar por WhatsApp"}
              </button>
              <p className="mt-2 text-center text-[11px] text-[#829087]">{settings.paymentEnabled ? "El cobro llega a la misma cuenta Stripe de Herencia, presentado en COP." : "Confirmamos disponibilidad antes del cobro."}</p>
            </StepCard>
          </div>
        </div>
      </section>

      {showStripe && product && zone && (
        <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
          <StripeCheckout
            amount={totalCOP}
            currency="cop"
            items={[{
              id: String(product.id),
              name: product.name,
              price: productCOP,
              quantity: 1,
            }]}
            customerName={buyerName}
            customerEmail={buyerEmail}
            paymentMethod="tarjeta"
            deliveryMethod="envio"
            subtotal={productCOP}
            shipping={Number(zone.feeCOP || 0)}
            metadata={{
              checkoutMarket: "colombia",
              currency: "COP",
              deliveryZoneId: zone.id,
              recipientName: recipientName.trim(),
              recipientPhone: recipientPhone.trim(),
              phone: recipientPhone.trim(),
              buyerPhone: buyerPhone.trim(),
              neighborhood: neighborhood.trim(),
              deliveryInstructions: deliveryComments.trim(),
              giftMessage: giftMessage.trim(),
              occasion,
              surprise,
              requestedDate: deliveryDate || null,
              requestedTimeSlot: deliveryDate ? deliveryTime : null,
              shippingAddress: {
                address: address.trim(),
                neighborhood: neighborhood.trim(),
                city: zone.name,
                postalCode: "",
                province: "Valle del Cauca",
                references: references.trim(),
                deliveryComments: deliveryComments.trim(),
              },
            }}
            onCancel={() => setShowStripe(false)}
            onSuccess={({ orderId, paymentIntentId, status }) => {
              window.location.href = `/pedido-confirmado?orderId=${encodeURIComponent(orderId)}&paymentIntentId=${encodeURIComponent(paymentIntentId)}&status=${encodeURIComponent(status)}`;
            }}
          />
        </section>
      )}
    </div>
  );
}

function StepCard({ number, title, children }: { number:string; title:string; children:any }) {
  return (
    <div className="rounded-3xl border border-[#dfd9ce] bg-[#fbfaf6] p-5 shadow-sm">
      <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#315b42] text-xs font-black text-white">{number}</span><h3 className="font-black">{title}</h3></div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
