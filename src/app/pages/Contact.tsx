import { FormEvent, useEffect, useState } from "react";
import { Instagram, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import { backendStorage } from "../lib/backendStorage";
import {
  defaultSiteContent,
  normalizePhoneForHref,
  normalizeWhatsAppPhone,
  parseSiteContent,
  type SiteContent,
} from "../lib/siteContent";
import { getMarketExperience } from "../lib/marketExperience";

export function Contact() {
  const [site, setSite] = useState<SiteContent>(defaultSiteContent);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = () => setSite(parseSiteContent(backendStorage.getItem("siteContent")));
    load();
    window.addEventListener("storage", load);
    window.addEventListener("backend-storage", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("backend-storage", load);
    };
  }, []);

  const market = getMarketExperience(site);
  const whatsapp = normalizeWhatsAppPhone(site.footer.whatsappPhone);
  const phone = normalizePhoneForHref(site.footer.callPhone);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = [
      "Hola, contacto desde la web de Herencia.",
      name.trim() ? `Nombre: ${name.trim()}` : "",
      message.trim() ? `Mensaje: ${message.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="bg-[#fbfaf6] text-[#173126]">
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:px-10 lg:py-16">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#718076]">
            CONTACTO
          </p>
          <h1 className="mt-4 text-5xl font-medium sm:text-6xl">
            {site.contactPage.title}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-[#66736b]">
            {site.contactPage.subtitle} · {market.locationLabel}.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-3xl border border-[#dfdbd1] bg-white p-5 transition hover:-translate-y-1 hover:shadow-md"
            >
              <MessageCircle className="h-6 w-6 text-[#315b42]" />
              <p className="mt-4 font-black">WhatsApp</p>
              <p className="mt-1 text-sm text-[#6c786f]">{site.footer.whatsappLabel}</p>
            </a>
            <a
              href={`tel:${phone}`}
              className="rounded-3xl border border-[#dfdbd1] bg-white p-5 transition hover:-translate-y-1 hover:shadow-md"
            >
              <Phone className="h-6 w-6 text-[#315b42]" />
              <p className="mt-4 font-black">Teléfono</p>
              <p className="mt-1 text-sm text-[#6c786f]">{site.footer.callLabel}</p>
            </a>
            <a
              href={site.footer.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-3xl border border-[#dfdbd1] bg-white p-5 transition hover:-translate-y-1 hover:shadow-md"
            >
              <Instagram className="h-6 w-6 text-[#315b42]" />
              <p className="mt-4 font-black">Instagram</p>
              <p className="mt-1 text-sm text-[#6c786f]">{site.footer.instagramLabel}</p>
            </a>
            <div className="rounded-3xl border border-[#dfdbd1] bg-white p-5">
              <MapPin className="h-6 w-6 text-[#315b42]" />
              <p className="mt-4 font-black">Ubicación</p>
              <p className="mt-1 text-sm text-[#6c786f]">{market.locationLabel}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-[#dfdbd1] bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#718076]">
            ESCRÍBENOS
          </p>
          <h2 className="mt-2 text-3xl font-medium">{site.contactPage.helpTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-[#6c786f]">
{site.contactPage.helpIntro}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-black">Nombre</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Tu nombre"
                className="w-full rounded-2xl border border-[#dfdbd1] bg-[#fbfaf6] px-4 py-3 outline-none focus:border-[#315b42]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black">Mensaje</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Cuéntanos qué producto, servicio o proyecto buscas..."
                rows={7}
                required
                className="w-full resize-none rounded-2xl border border-[#dfdbd1] bg-[#fbfaf6] px-4 py-3 outline-none focus:border-[#315b42]"
              />
            </label>

            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-[#315b42] px-6 py-3.5 text-sm font-black text-white"
            >
              <Send className="h-4 w-4" /> Continuar por WhatsApp
            </button>
          </form>
        </div>
      </section>

      <section className="border-y border-[#ded9cd] bg-[#f4f1e8]">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
          <h2 className="text-2xl font-medium">Horario de atención</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {site.contactPage.hours.map((row) => (
              <div key={row.label} className="rounded-2xl border border-[#dfdbd1] bg-white p-4">
                <p className="text-sm font-black">{row.label}</p>
                <p className="mt-1 text-sm text-[#6c786f]">{row.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
