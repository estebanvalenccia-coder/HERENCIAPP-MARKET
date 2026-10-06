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
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);

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
          className="absolute inset-0 h-full w-full object-cover object-[50%_42%]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,36,26,.12)_0%,rgba(18,36,26,.18)_28%,rgba(18,36,26,.58)_43%,rgba(18,36,26,.38)_72%,rgba(18,36,26,.16)_100%)]" />
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#f4d21f] via-[#184aa5] to-[#c9282d]" />

        <div className="relative mx-auto flex min-h-[590px] max-w-[1536px] items-center px-5 pb-28 pt-14 sm:px-8 lg:px-12">
          <div className="ml-auto w-full max-w-[920px] text-white lg:w-[64%]">
            <p className="inline-flex items-center gap-3 text-[13px] font-black uppercase tracking-[0.34em] text-white/95">
              <span className="text-xl leading-none">{settings.flag}</span>
              <span>{settings.heroKicker || "COLOMBIANÍSIMAS"}</span>
            </p>
            <h1 className="mt-4 max-w-[900px] font-serif text-5xl font-medium leading-[.98] tracking-[-.035em] sm:text-6xl lg:text-[76px]">
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

            <div className="mt-7 grid max-w-[820px] grid-cols-2 gap-x-5 gap-y-3 rounded-[24px] border border-white/10 bg-[#20150f]/50 px-5 py-4 text-sm font-semibold text-white/95 backdrop-blur-md sm:grid-cols-4">
              <span className="inline-flex items-center gap-2"><Gift className="h-5 w-5"/>Plantas y flores frescas</span>
              <span className="inline-flex items-center gap-2"><Truck className="h-5 w-5"/>Entrega el mismo día</span>
              <span className="inline-flex items-center gap-2"><PackageCheck className="h-5 w-5"/>Regalos personalizados</span>
              <span className="inline-flex items-center gap-2"><Heart className="h-5 w-5"/>Mensajes desde el corazón</span>
            </div>
          </div>
        </div>

        <div className="relative mx-auto -mt-[64px] max-w-[1536px] px-5 pb-3 sm:px-8 lg:px-12">
          <div className="grid gap-3 rounded-[26px] border border-[#e7dfd4] bg-[#fffdf9]/97 p-3 shadow-[0_20px_60px_rgba(45,39,28,.16)] backdrop-blur">
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

      <section id="catalogo-colombia" className="mx-auto max-w-[1536px] px-5 pb-12 pt-8 sm:px-8 lg:px-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[#807d73]">Nuestras categorías en Cali</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold tracking-[-.02em] text-[#173126] sm:text-4xl">Regalos con esencia caleña</h2>
          </div>
          <button onClick={()=>setCategory("Todas")} className="hidden text-sm font-black text-[#22372c] sm:inline-flex">Ver todas las categorías <ChevronRight className="ml-1 h-4 w-4"/></button>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-5 overflow-x-auto pb-4 sm:grid-cols-5 lg:grid-cols-10">
          {categories.filter((item)=>item!=="Todas").map((item)=>{
            const sample=visibleProducts.find((p)=>categoryOf(p)===item);
            const image=sample?.image || sample?.images?.[0]?.url || sample?.images?.[0];
            return (
              <button key={item} onClick={()=>setCategory(item)} className="group min-w-[92px] text-center">
                <span className={`mx-auto block h-[92px] w-[92px] overflow-hidden rounded-[30px] border bg-[#f0e7d9] shadow-sm transition group-hover:-translate-y-1 ${category===item?"border-[#315b42] ring-2 ring-[#315b42]/15":"border-[#eadfce]"}`}>
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
              <button key={item.id} onClick={() => { setProductId(String(item.id)); setCheckoutStep(1); setCheckoutOpen(true); }} className={`group overflow-hidden rounded-[18px] border bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md ${selected ? "border-[#315b42] ring-2 ring-[#315b42]/15" : "border-[#e8e1d6]"}`}>
                <div className="relative aspect-[4/3] bg-[#f0ede6]">
                  <img src={item.image || item.images?.[0]?.url || item.images?.[0]} alt={item.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]" />
                  <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-[#314138] shadow"><Heart className="h-4 w-4"/></span>
                </div>
                <div className="p-4">
                  <p className="line-clamp-1 font-black text-[#28342d]">{itemOverride?.label || item.name}</p>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <div><p className="font-black text-[#173126]">{moneyCOP(itemCOP)}</p><p className="text-[11px] text-[#7d877f]">≈ {moneyEUR(itemEUR)}</p></div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-black ${selected?"bg-[#315b42] text-white":"bg-[#edf3ed] text-[#315b42]"}`}>{"Comprar"}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {filteredProducts.length===0 && <div className="mt-6 rounded-3xl border border-dashed border-[#d9d1c5] bg-white p-10 text-center text-sm text-[#748077]">No hay productos publicados en esta categoría todavía.</div>}
      </section>

      {checkoutOpen && product && zone && !showStripe && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#10251b]/55 p-3 backdrop-blur-sm sm:p-6">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-[#fbfaf6] shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-[#e3ded3] bg-[#fbfaf6]/95 px-5 py-4 backdrop-blur sm:px-7">
              <div className="flex items-center justify-between gap-4">
                <div><p className="text-[11px] font-black uppercase tracking-[.18em] text-[#718076]">Tu regalo en Cali</p><h2 className="font-serif text-2xl font-semibold">Paso {checkoutStep} de 5</h2></div>
                <button onClick={()=>setCheckoutOpen(false)} className="rounded-full border border-[#ddd7cb] px-4 py-2 text-sm font-bold">Cerrar</button>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2">{[1,2,3,4,5].map(n=><span key={n} className={`h-1.5 rounded-full ${n<=checkoutStep?"bg-[#315b42]":"bg-[#dedbd3]"}`}/>)}</div>
            </div>
            <div className="p-5 sm:p-7">
              {checkoutStep===1 && <StepCard number="1" title="Producto y zona"><div className="flex gap-3"><img src={product.image || product.images?.[0]?.url || product.images?.[0]} alt="" className="h-24 w-24 rounded-2xl object-cover"/><div><p className="font-black">{product.name}</p><p className="mt-1 text-lg font-black">{moneyCOP(productCOP)}</p><p className="text-sm text-[#718076]">{zone.name} · envío {moneyCOP(zone.feeCOP)}</p></div></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{settings.zones.filter(z=>z.enabled).map(z=><button key={z.id} onClick={()=>setZoneId(z.id)} className={`rounded-xl border px-3 py-2 text-left text-sm font-bold ${zoneId===z.id?"border-[#315b42] bg-[#edf3ed]":"bg-white"}`}>{z.name}<span className="block text-xs font-normal text-[#718076]">{z.eta}</span></button>)}</div></StepCard>}
              {checkoutStep===2 && <StepCard number="2" title="Dirección y destinatario"><div className="grid gap-2"><input value={recipientName} onChange={e=>setRecipientName(e.target.value)} placeholder="Nombre del destinatario" className="rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5"/><input value={recipientPhone} onChange={e=>setRecipientPhone(e.target.value)} placeholder="Teléfono del destinatario" className="rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5"/><input value={neighborhood} onChange={e=>setNeighborhood(e.target.value)} placeholder="Barrio / vereda / sector" className="rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5"/><textarea value={address} onChange={e=>setAddress(e.target.value)} placeholder="Dirección completa" rows={3} className="rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5"/><input value={references} onChange={e=>setReferences(e.target.value)} placeholder="Referencias para encontrar la dirección" className="rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5"/><textarea value={deliveryComments} onChange={e=>setDeliveryComments(e.target.value.slice(0,400))} placeholder="Comentarios para la entrega" rows={3} className="rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5"/></div></StepCard>}
              {checkoutStep===3 && <StepCard number="3" title="Mensaje para la tarjeta"><div className="flex flex-wrap gap-2">{["Cumpleaños","Amor","Agradecimiento"].map(item=><button key={item} onClick={()=>setOccasion(item)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${occasion===item?"bg-[#315b42] text-white":"border bg-white"}`}>{item}</button>)}</div>{settings.giftMessageEnabled&&<textarea value={giftMessage} onChange={e=>setGiftMessage(e.target.value.slice(0,200))} placeholder="Escribe tu mensaje..." rows={5} className="mt-3 w-full rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5"/>}{settings.surpriseEnabled&&<label className="mt-3 flex gap-2 text-sm font-bold"><input type="checkbox" checked={surprise} onChange={e=>setSurprise(e.target.checked)}/> Es una sorpresa (no mostrar precio)</label>}</StepCard>}
              {checkoutStep===4 && <StepCard number="4" title="Fecha y hora de entrega">{settings.schedulingEnabled?<div className="grid gap-4"><label className="text-sm font-bold">Fecha<input type="date" min={todayIso()} value={deliveryDate} onChange={e=>setDeliveryDate(e.target.value)} className="mt-2 w-full rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5"/></label><label className="text-sm font-bold">Franja horaria<select value={deliveryTime} onChange={e=>setDeliveryTime(e.target.value)} className="mt-2 w-full rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5"><option>09:00–13:00</option><option>13:00–17:00</option><option>17:00–20:00</option></select></label></div>:<p>La fecha se confirmará por WhatsApp.</p>}</StepCard>}
              {checkoutStep===5 && <StepCard number="5" title="Pago y confirmación"><div className="space-y-2"><div className="flex justify-between"><span>Producto</span><b>{moneyCOP(productCOP)}</b></div><div className="flex justify-between"><span>Envío</span><b>{moneyCOP(zone.feeCOP)}</b></div><div className="flex justify-between border-t pt-2 text-lg"><b>Total</b><b>{moneyCOP(totalCOP)}</b></div><p className="text-right text-xs text-[#718076]">≈ {moneyEUR(totalEUR)}</p></div>{settings.paymentEnabled&&<div className="mt-4 grid gap-2"><input value={buyerName} onChange={e=>setBuyerName(e.target.value)} placeholder="Tu nombre" className="rounded-xl border bg-white px-3 py-2.5"/><input type="email" value={buyerEmail} onChange={e=>setBuyerEmail(e.target.value)} placeholder="Tu email para el recibo" className="rounded-xl border bg-white px-3 py-2.5"/><input value={buyerPhone} onChange={e=>setBuyerPhone(e.target.value)} placeholder="Tu teléfono / WhatsApp" className="rounded-xl border bg-white px-3 py-2.5"/></div>}</StepCard>}
              <div className="mt-5 flex items-center justify-between gap-3"><button onClick={()=>setCheckoutStep(s=>Math.max(1,s-1))} disabled={checkoutStep===1} className="rounded-xl border px-5 py-3 font-bold disabled:opacity-30">Atrás</button>{checkoutStep<5?<button onClick={()=>setCheckoutStep(s=>Math.min(5,s+1))} className="rounded-xl bg-[#315b42] px-6 py-3 font-black text-white">Continuar</button>:<button onClick={submit} className="rounded-xl bg-[#315b42] px-6 py-3 font-black text-white">{settings.paymentEnabled?"Pagar en COP con Stripe":"Confirmar pedido"}</button>}</div>
            </div>
          </div>
        </div>
      )}

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
