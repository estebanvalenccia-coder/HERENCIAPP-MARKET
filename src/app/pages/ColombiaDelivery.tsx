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
    if (!recipientName.trim() || !address.trim() || (settings.recipientPhoneRequired && !recipientPhone.trim())) {
      window.alert("Completa los datos del destinatario y la dirección.");
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
      references.trim() ? `🗺️ Referencias: ${references.trim()}` : "",
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
      references: references.trim(),
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
      <section className="relative overflow-hidden">
        <img src={settings.heroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#102b20]/95 via-[#102b20]/72 to-[#102b20]/10" />
        <div className="relative mx-auto flex min-h-[520px] max-w-7xl items-center px-5 py-16 sm:px-8 lg:px-10">
          <div className="max-w-2xl text-white">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-white/75">{settings.flag} Herencia internacional</p>
            <h1 className="mt-4 text-5xl font-medium leading-tight sm:text-6xl">{settings.headline}</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/90">{settings.description}</p>
            <button onClick={() => document.getElementById("catalogo-colombia")?.scrollIntoView({ behavior:"smooth" })} className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#315b42] px-6 py-3.5 font-black text-white shadow-lg transition hover:bg-[#234832]">
              Enviar un regalo a Cali <ChevronRight className="h-4 w-4" />
            </button>
            <div className="mt-8 flex flex-wrap gap-5 text-sm font-bold text-white/85">
              <span className="inline-flex items-center gap-2"><Gift className="h-4 w-4"/>Plantas y regalos</span>
              <span className="inline-flex items-center gap-2"><Truck className="h-4 w-4"/>{settings.sameDayLabel}</span>
              <span className="inline-flex items-center gap-2"><Heart className="h-4 w-4"/>Mensajes personalizados</span>
            </div>
          </div>
        </div>
      </section>

      <section id="catalogo-colombia" className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr_310px]">
          <aside className="rounded-3xl border border-[#e4dfd4] bg-white p-5 shadow-sm">
            <p className="font-black">Explora por categoría</p>
            <div className="mt-4 space-y-1">
              {categories.map((item) => (
                <button key={item} onClick={() => setCategory(item)} className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold transition ${category === item ? "bg-[#eef3ec] text-[#315b42]" : "hover:bg-[#f6f3ec]"}`}>
                  {item}
                </button>
              ))}
            </div>
          </aside>

          <div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#718076]">Catálogo Colombia</p>
                <h2 className="mt-2 text-3xl font-medium">Regalos populares en Cali</h2>
              </div>
              <span className="text-sm font-bold text-[#6c786f]">{filteredProducts.length} opciones</span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((item) => {
                const selected = String(item.id) === productId;
                const itemOverride = settings.productOverrides[String(item.id)];
                const itemEUR = Number(item.onSale && item.salePrice ? item.salePrice : item.price || 0);
                const itemCOP = Number(itemOverride?.priceCOP || Math.round(itemEUR * 4300 / 100) * 100);
                return (
                  <button key={item.id} onClick={() => setProductId(String(item.id))} className={`overflow-hidden rounded-3xl border bg-white text-left shadow-sm transition ${selected ? "border-[#315b42] ring-2 ring-[#315b42]/20" : "border-[#e4dfd4] hover:-translate-y-1"}`}>
                    <div className="relative h-52 bg-[#f0ede6]">
                      <img src={item.image || item.images?.[0]?.url || item.images?.[0]} alt={item.name} className="h-full w-full object-cover" />
                      <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 shadow"><Heart className="h-4 w-4"/></span>
                    </div>
                    <div className="p-4">
                      <p className="font-black">{itemOverride?.label || item.name}</p>
                      <p className="mt-1 text-sm font-black">{moneyCOP(itemCOP)}</p>
                      <p className="text-xs text-[#718076]">≈ {moneyEUR(itemEUR)}</p>
                      <span className={`mt-4 inline-flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-black ${selected ? "bg-[#315b42] text-white" : "bg-[#eef3ec] text-[#315b42]"}`}>
                        {selected ? <><Check className="mr-1 h-4 w-4"/>Seleccionado</> : "Añadir al regalo"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="h-fit rounded-3xl border border-[#e0dbd0] bg-white p-5 shadow-sm lg:sticky lg:top-24">
            <p className="font-black">Zonas de entrega</p>
            <div className="mt-4 space-y-3">
              {settings.zones.filter((z) => z.enabled).map((z) => (
                <button key={z.id} onClick={() => setZoneId(z.id)} className={`w-full rounded-2xl border p-4 text-left transition ${zoneId === z.id ? "border-[#315b42] bg-[#f1f6f2]" : "border-[#e5e1d8]"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-black">{z.name}</span>
                    <span className="text-sm font-black">{moneyCOP(z.feeCOP)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#6c786f]">≈ {moneyEUR(z.feeEUR)} · {z.eta}</p>
                  <p className="mt-1 text-[11px] text-[#829087]">{z.note}</p>
                </button>
              ))}
            </div>
          </aside>
        </div>
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

            <StepCard number="2" title="Datos del destinatario">
              <div className="grid gap-2">
                <input value={recipientName} onChange={(e)=>setRecipientName(e.target.value)} placeholder="Nombre del destinatario" className="rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5 text-sm" />
                <div className="relative"><Phone className="absolute left-3 top-3 h-4 w-4 text-[#829087]"/><input value={recipientPhone} onChange={(e)=>setRecipientPhone(e.target.value)} placeholder="Teléfono (Colombia)" className="w-full rounded-xl border border-[#ddd7cb] bg-white py-2.5 pl-9 pr-3 text-sm" /></div>
                <textarea value={address} onChange={(e)=>setAddress(e.target.value)} placeholder="Dirección" rows={2} className="rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5 text-sm" />
                <input value={references} onChange={(e)=>setReferences(e.target.value)} placeholder="Referencias (opcional)" className="rounded-xl border border-[#ddd7cb] bg-white px-3 py-2.5 text-sm" />
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
              giftMessage: giftMessage.trim(),
              occasion,
              surprise,
              requestedDate: deliveryDate || null,
              requestedTimeSlot: deliveryDate ? deliveryTime : null,
              shippingAddress: {
                address: address.trim(),
                city: zone.name,
                postalCode: "",
                province: "Valle del Cauca",
                references: references.trim(),
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
