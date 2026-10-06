import { useEffect, useMemo, useState } from "react";
import { Gift, MapPin, MessageCircle, PackageCheck, Phone, Truck } from "lucide-react";
import { backendApi, backendStorage } from "../lib/backendStorage";
import {
  defaultColombiaDeliverySettings,
  parseColombiaDeliverySettings,
  type ColombiaDeliverySettings,
} from "../lib/internationalDelivery";
import { defaultSiteContent, parseSiteContent } from "../lib/siteContent";

function money(value: unknown) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

export function ColombiaDelivery() {
  const [settings, setSettings] = useState<ColombiaDeliverySettings>(defaultColombiaDeliverySettings);
  const [products, setProducts] = useState<any[]>([]);
  const [zoneId, setZoneId] = useState("cali");
  const [productId, setProductId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [address, setAddress] = useState("");
  const [giftMessage, setGiftMessage] = useState("");

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
    return (base.length ? base : products).slice(0, 12);
  }, [products, settings.selectedProductIds]);

  useEffect(() => {
    if (!productId && visibleProducts[0]?.id) setProductId(String(visibleProducts[0].id));
  }, [visibleProducts, productId]);

  const zone = settings.zones.find((z) => z.id === zoneId && z.enabled) || settings.zones.find((z) => z.enabled);
  const product = visibleProducts.find((p) => String(p.id) === productId);

  const submit = () => {
    if (!product) return;
    if (!recipientName.trim() || !address.trim() || (settings.recipientPhoneRequired && !recipientPhone.trim())) {
      window.alert("Completa los datos del destinatario y la dirección.");
      return;
    }

    const site = parseSiteContent(backendStorage.getItem("siteContent"));
    const phone = String(site.floatingWhatsapp?.phone || site.footer?.whatsappPhone || defaultSiteContent.floatingWhatsapp.phone || "").replace(/\D/g, "");
    const lines = [
      "Hola Herencia 🌿 Quiero solicitar un domicilio en Colombia.",
      "",
      `🇨🇴 Zona: ${zone?.name || "Cali / Candelaria"}`,
      `🎁 Producto: ${product.name}`,
      `💶 Precio producto: ${money(product.onSale && product.salePrice ? product.salePrice : product.price)}`,
      zone ? `🚚 Domicilio estimado: ${money(zone.feeEUR)} · ${zone.eta}` : "",
      "",
      `👤 Destinatario: ${recipientName.trim()}`,
      `📞 Teléfono: ${recipientPhone.trim() || "No indicado"}`,
      `📍 Dirección: ${address.trim()}`,
      giftMessage.trim() ? `💌 Mensaje: ${giftMessage.trim()}` : "",
      "",
      "Por favor confírmenme disponibilidad y total antes de preparar la entrega.",
    ].filter(Boolean);

    localStorage.setItem("herenciaInternationalDeliveryDraft", JSON.stringify({
      country: "Colombia",
      zone: zone?.name || "",
      zoneId: zone?.id || "",
      productId: String(product.id),
      productName: product.name,
      recipientName: recipientName.trim(),
      recipientPhone: recipientPhone.trim(),
      address: address.trim(),
      giftMessage: giftMessage.trim(),
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
        <div className="absolute inset-0 bg-gradient-to-r from-[#102b20]/95 via-[#102b20]/75 to-[#102b20]/10" />
        <div className="relative mx-auto flex min-h-[520px] max-w-7xl items-center px-5 py-16 sm:px-8 lg:px-10">
          <div className="max-w-2xl text-white">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-white/75">{settings.flag} Herencia internacional</p>
            <h1 className="mt-4 text-5xl font-medium leading-tight sm:text-6xl">{settings.headline}</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/90">{settings.description}</p>
            <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-white/15 px-5 py-3 font-bold backdrop-blur">
              <MapPin className="h-5 w-5" /> {settings.regionLabel}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-10">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            [Gift, "1. Elige el regalo", "Plantas, flores, detalles y productos disponibles."],
            [MapPin, "2. Indica dónde", "Cali, Candelaria o una zona cercana."],
            [MessageCircle, "3. Personaliza", "Añade destinatario y un mensaje de regalo."],
            [Truck, "4. Entrega local", "Herencia confirma disponibilidad y coordina el domicilio."],
          ].map(([Icon, title, text]: any) => (
            <div key={title} className="rounded-3xl border border-[#e4dfd4] bg-white p-5 shadow-sm">
              <Icon className="h-7 w-7 text-[#315b42]" />
              <h2 className="mt-4 font-black">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#6c786f]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:px-10">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_.7fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#718076]">Catálogo Colombia</p>
            <h2 className="mt-2 text-3xl font-medium">Elige qué quieres enviar</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleProducts.map((item) => {
                const selected = String(item.id) === productId;
                return (
                  <button key={item.id} onClick={() => setProductId(String(item.id))} className={`overflow-hidden rounded-3xl border bg-white text-left shadow-sm transition ${selected ? "border-[#315b42] ring-2 ring-[#315b42]/20" : "border-[#e4dfd4] hover:-translate-y-1"}`}>
                    <div className="h-52 bg-[#f0ede6]"><img src={item.image || item.images?.[0]?.url || item.images?.[0]} alt={item.name} className="h-full w-full object-cover" /></div>
                    <div className="p-4">
                      <p className="font-black">{item.name}</p>
                      <p className="mt-1 text-sm text-[#657169]">{money(item.onSale && item.salePrice ? item.salePrice : item.price)}</p>
                      {selected && <span className="mt-3 inline-flex rounded-full bg-[#eaf2ec] px-3 py-1 text-xs font-bold text-[#315b42]">Seleccionado</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-fit rounded-[30px] border border-[#ddd7ca] bg-white p-6 shadow-lg lg:sticky lg:top-24">
            <div className="flex items-center gap-3"><PackageCheck className="h-7 w-7 text-[#315b42]" /><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#718076]">Preparar domicilio</p><h2 className="text-2xl font-semibold">Datos de entrega</h2></div></div>

            <label className="mt-6 block text-sm font-bold">Zona</label>
            <div className="mt-2 space-y-2">
              {settings.zones.filter((z) => z.enabled).map((z) => (
                <button key={z.id} onClick={() => setZoneId(z.id)} className={`w-full rounded-2xl border p-4 text-left ${zoneId === z.id ? "border-[#315b42] bg-[#f1f6f2]" : "border-[#e5e1d8]"}`}>
                  <div className="flex items-center justify-between gap-3"><span className="font-black">{z.name}</span><span className="text-sm font-bold">{money(z.feeEUR)}</span></div>
                  <p className="mt-1 text-xs text-[#6c786f]">{z.eta} · {z.note}</p>
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-4">
              <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Nombre del destinatario" className="rounded-2xl border border-[#ded8cd] px-4 py-3 outline-none focus:border-[#315b42]" />
              <div className="relative"><Phone className="absolute left-4 top-3.5 h-4 w-4 text-[#718076]" /><input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="Teléfono en Colombia" className="w-full rounded-2xl border border-[#ded8cd] py-3 pl-11 pr-4 outline-none focus:border-[#315b42]" /></div>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dirección de entrega y referencias" rows={3} className="rounded-2xl border border-[#ded8cd] px-4 py-3 outline-none focus:border-[#315b42]" />
              {settings.giftMessageEnabled && <textarea value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} placeholder="Mensaje para la tarjeta (opcional)" rows={3} className="rounded-2xl border border-[#ded8cd] px-4 py-3 outline-none focus:border-[#315b42]" />}
            </div>

            <button onClick={submit} disabled={!product} className="mt-6 w-full rounded-2xl bg-[#315b42] px-5 py-4 font-black text-white transition hover:bg-[#234832] disabled:opacity-50">
              Solicitar domicilio en Colombia
            </button>
            <p className="mt-3 text-center text-xs leading-5 text-[#718076]">La disponibilidad y el total se confirman antes de preparar la entrega.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
