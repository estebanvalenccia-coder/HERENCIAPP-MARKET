import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, MessageCircle, Phone, ShoppingCart, Sparkles } from "lucide-react";
import { backendApi, backendStorage } from "../lib/backendStorage";
import {
  defaultSiteContent,
  normalizePhoneForHref,
  normalizeWhatsAppPhone,
  parseSiteContent,
  type SiteContent,
} from "../lib/siteContent";
import { getMarketExperience } from "../lib/marketExperience";

const ids = ["asesoria", "jardineria", "decoracion", "limpieza", "floral"];

export function Services() {
  const [site, setSite] = useState<SiteContent>(defaultSiteContent);
  const [sellableServices, setSellableServices] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    const refreshSite = () => {
      setSite(parseSiteContent(backendStorage.getItem("siteContent")));
    };

    const loadServices = async () => {
      try {
        const result = await backendApi.listCommerceProducts({ collection: "servicios" });
        if (!cancelled) {
          setSellableServices(
            Array.isArray(result.products)
              ? result.products.filter((item: any) => item.status === "active" || item.active === true)
              : []
          );
        }
      } catch {
        if (!cancelled) {
          try {
            const cached = JSON.parse(backendStorage.getItem("adminProducts") || "[]");
            setSellableServices(
              Array.isArray(cached)
                ? cached.filter((item: any) => Array.isArray(item.collections) && item.collections.includes("servicios") && (item.status === "active" || item.active !== false))
                : []
            );
          } catch {
            setSellableServices([]);
          }
        }
      }
    };

    refreshSite();
    void loadServices();

    const refreshServices = () => void loadServices();
    window.addEventListener("storage", refreshSite);
    window.addEventListener("backend-storage", refreshSite);
    window.addEventListener("commerce-products-changed", refreshServices);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", refreshSite);
      window.removeEventListener("backend-storage", refreshSite);
      window.removeEventListener("commerce-products-changed", refreshServices);
    };
  }, []);

  const market = getMarketExperience(site);
  const whatsapp = normalizeWhatsAppPhone(site.footer.whatsappPhone);
  const phone = normalizePhoneForHref(site.footer.callPhone);

  function addServiceToCart(service: any) {
    try {
      const cart = JSON.parse(backendStorage.getItem("cart") || "[]");
      const existing = cart.find((item: any) => String(item.id) === String(service.id));
      if (existing) existing.quantity = Number(existing.quantity || 1) + 1;
      else cart.push({ ...service, quantity: 1, trackInventory: false });
      void backendStorage.setItem("cart", JSON.stringify(cart));
      window.dispatchEvent(new Event("storage"));
    } catch {
      return;
    }
  }

  return (
    <div className="bg-[#fbfaf6] text-[#173126]">
      <section className="relative min-h-[440px] overflow-hidden">
        <img
          src={market.home.services[1]?.imageUrl || market.home.services[0]?.imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#102b20]/92 via-[#173d2a]/70 to-[#173d2a]/15" />
        <div className="relative mx-auto flex min-h-[440px] max-w-7xl items-center px-5 py-14 sm:px-8 lg:px-10">
          <div className="max-w-2xl text-white">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-white/70">
              SERVICIOS HERENCIA
            </p>
            <h1 className="mt-4 text-5xl font-medium leading-[1.02] sm:text-6xl">
              {site.servicesPage.title}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/86">
              {site.servicesPage.subtitle} · {market.locationLabel}.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Hola, quiero solicitar información sobre un servicio de Herencia.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#173d2a]"
              >
                <MessageCircle className="h-4 w-4" /> Solicitar información
              </a>
              <a
                href={`tel:${phone}`}
                className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/10 px-5 py-3 text-sm font-black text-white backdrop-blur"
              >
                <Phone className="h-4 w-4" /> Llamar
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
        <div className="text-center">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#718076]">
            A tu medida
          </p>
          <h2 className="mt-2 text-3xl font-medium sm:text-4xl">Nuestros servicios</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#6c786f]">
            Cada servicio puede solicitarse directamente y adaptarse al espacio, presupuesto y objetivo.
          </p>
        </div>

        <div className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {market.home.services.map((service, index) => (
            <article
              id={ids[index] || `servicio-${index + 1}`}
              key={service.title}
              className="scroll-mt-32 overflow-hidden rounded-[2rem] border border-[#e0dcd2] bg-white shadow-sm"
            >
              <div className="h-56 overflow-hidden">
                <img
                  src={service.imageUrl}
                  alt={service.title}
                  className="h-full w-full object-cover transition duration-500 hover:scale-105"
                />
              </div>
              <div className="p-6">
                <h3 className="text-2xl font-black leading-tight">{service.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#66736b]">{service.subtitle}</p>
                <a
                  href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, quiero información sobre ${service.title}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#315b42] px-5 py-3 text-sm font-black text-white"
                >
                  Consultar servicio <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </article>
          ))}

          <article className="flex min-h-[360px] flex-col justify-between rounded-[2rem] bg-[#173d2a] p-7 text-white">
            <div>
              <span className="grid h-12 w-12 place-items-center rounded-full bg-white/10">
                <Sparkles className="h-5 w-5 text-[#e7d7a8]" />
              </span>
              <h3 className="mt-5 text-3xl font-medium">¿Tienes otra idea?</h3>
              <p className="mt-3 text-sm leading-7 text-white/75">
                Cuéntanos qué quieres conseguir. Podemos preparar una propuesta personalizada y orientarte
                hacia el servicio o producto adecuado.
              </p>
            </div>
            <Link
              to="/contacto"
              className="mt-7 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#173d2a]"
            >
              Cuéntanos tu proyecto <ArrowRight className="h-4 w-4" />
            </Link>
          </article>
        </div>
      </section>

      {sellableServices.length > 0 && (
        <section className="border-t border-[#ded9cd] bg-white">
          <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#718076]">Contratación online</p>
                <h2 className="mt-2 text-3xl font-medium">Servicios con precio publicado</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6c786f]">
                  Estos servicios se crean desde Administración → Catálogo y pueden añadirse al carrito como cualquier otro artículo.
                </p>
              </div>
              <Link to="/productos?coleccion=servicios" className="inline-flex items-center gap-2 text-sm font-black text-[#315b42]">
                Ver todos <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {sellableServices.map((service) => (
                <article key={String(service.id)} className="overflow-hidden rounded-[2rem] border border-[#e0dcd2] bg-[#fbfaf6]">
                  <Link to={`/producto/${service.id}`} className="block h-52 overflow-hidden bg-[#efede6]">
                    {service.image ? <img src={service.image} alt={service.name} className="h-full w-full object-cover transition duration-500 hover:scale-105" /> : <div className="flex h-full items-center justify-center text-sm text-[#718076]">Sin imagen</div>}
                  </Link>
                  <div className="p-5">
                    <Link to={`/producto/${service.id}`} className="text-xl font-black">{service.name}</Link>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#6c786f]">{service.description}</p>
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <span className="text-xl font-black text-[#315b42]">€{Number(service.onSale && service.salePrice ? service.salePrice : service.price || 0).toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={() => addServiceToCart(service)}
                        className="inline-flex items-center gap-2 rounded-full bg-[#315b42] px-4 py-2.5 text-sm font-black text-white"
                      >
                        <ShoppingCart className="h-4 w-4" /> Contratar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="border-y border-[#ded9cd] bg-[#f4f1e8]">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <p className="font-black">1. Cuéntanos qué necesitas</p>
              <p className="mt-2 text-sm leading-6 text-[#6c786f]">
                Espacio, fecha, idea, fotografías y presupuesto aproximado si lo tienes.
              </p>
            </div>
            <div>
              <p className="font-black">2. Preparamos la propuesta</p>
              <p className="mt-2 text-sm leading-6 text-[#6c786f]">
                Definimos la solución, materiales, alcance y precio antes de empezar.
              </p>
            </div>
            <div>
              <p className="font-black">3. Lo hacemos realidad</p>
              <p className="mt-2 text-sm leading-6 text-[#6c786f]">
                Coordinamos el servicio y mantenemos una comunicación clara durante el proceso.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
