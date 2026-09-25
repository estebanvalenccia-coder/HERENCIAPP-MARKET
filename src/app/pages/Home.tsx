import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  HeartHandshake,
  Leaf,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { products as fallbackProducts } from "../data/products";
import { backendStorage } from "../lib/backendStorage";
import { defaultSiteContent, parseSiteContent, type SiteContent } from "../lib/siteContent";
import { getMarketExperience } from "../lib/marketExperience";

const DEFAULT_HERO =
  "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=2000&q=88";

function money(value: unknown) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

export function Home() {
  const [site, setSite] = useState<SiteContent>(defaultSiteContent);
  const [catalog, setCatalog] = useState<any[]>(fallbackProducts);

  useEffect(() => {
    const load = () => {
      setSite(parseSiteContent(backendStorage.getItem("siteContent")));
      try {
        const saved = JSON.parse(backendStorage.getItem("adminProducts") || "[]");
        setCatalog(
          Array.isArray(saved) && saved.length
            ? saved.filter((item: any) => item.active !== false)
            : fallbackProducts
        );
      } catch {
        setCatalog(fallbackProducts);
      }
    };

    load();
    window.addEventListener("storage", load);
    window.addEventListener("backend-storage", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("backend-storage", load);
    };
  }, []);

  const market = getMarketExperience(site);

  const featured = useMemo(() => {
    const rows = [...catalog].sort(
      (a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured))
    );
    return rows.filter((item) => item?.image && Number(item?.price || item?.salePrice || 0) > 0).slice(0, 6);
  }, [catalog]);

  const addToCart = (product: any) => {
    try {
      const cart = JSON.parse(backendStorage.getItem("cart") || "[]");
      const existing = cart.find((item: any) => String(item.id) === String(product.id));
      if (existing) {
        existing.quantity = Number(existing.quantity || 1) + 1;
      } else {
        cart.push({ ...product, quantity: 1 });
      }
      void backendStorage.setItem("cart", JSON.stringify(cart));
      window.dispatchEvent(new Event("storage"));
      toast.success(`${product.name} añadido al carrito`);
    } catch {
      toast.error("No se pudo añadir el producto");
    }
  };

  const trustIcons = [ShieldCheck, Truck, HeartHandshake, Leaf];

  return (
    <div className="bg-[#fbfaf6] text-[#173126]">
      <section className="relative min-h-[620px] overflow-hidden">
        <img
          src={market.home.heroImageUrl || site.hero.imageUrl || DEFAULT_HERO}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#102b20]/90 via-[#173d2a]/62 to-transparent" />
        <div className="relative mx-auto flex min-h-[620px] max-w-7xl items-center px-5 py-16 sm:px-8 lg:px-10">
          <div className="max-w-2xl text-white">
            <p className="mb-5 text-xs font-black uppercase tracking-[0.28em] text-white/75">
              {market.home.kicker}
            </p>
            <h1 className="max-w-xl text-5xl font-medium leading-[0.98] sm:text-6xl lg:text-7xl">
              {market.home.title}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/88 sm:text-lg">
              {market.home.description}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={site.hero.primaryButton.href || "/productos"}
                className="inline-flex items-center gap-2 rounded-full bg-[#315b42] px-6 py-3.5 font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#234832]"
              >
                {site.hero.primaryButton.label || "Explorar tienda"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to={site.hero.secondaryButton.href || "/servicios"}
                className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/10 px-6 py-3.5 font-bold text-white backdrop-blur transition hover:bg-white/20"
              >
                {site.hero.secondaryButton.label || "Nuestros servicios"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#e5e1d8] bg-[#fffdf9]">
        <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 lg:px-10">
          <div className="grid grid-cols-4 gap-5 md:grid-cols-8">
            {market.home.categories.map((item) => (
              <Link key={item.title} to={item.href} className="group text-center">
                <div className="mx-auto h-20 w-20 overflow-hidden rounded-full border border-[#e3ddd2] bg-[#f2eee6] shadow-sm transition group-hover:-translate-y-1 group-hover:shadow-md">
                  <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                </div>
                <p className="mt-2 text-xs font-black leading-tight text-[#1f3b2d] sm:text-sm">
                  {item.title}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#6d7d72]">
              Nuestras categorías
            </p>
            <h2 className="mt-2 text-3xl font-medium sm:text-4xl">
              {market.home.categoriesTitle}
            </h2>
          </div>
          <Link to="/productos" className="inline-flex items-center gap-2 text-sm font-black text-[#315b42]">
            Ver toda la tienda <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {market.home.categories.slice(0, 8).map((item) => (
            <Link
              key={item.title}
              to={item.href}
              className="group overflow-hidden rounded-3xl border border-[#e5e1d8] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="h-44 overflow-hidden bg-[#efece4]">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-black">{item.title}</p>
                  <p className="mt-1 text-xs text-[#718076]">{item.subtitle}</p>
                </div>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f1efe8]">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-[#f4f1e8]">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#6d7d72]">
                Servicios
              </p>
              <h2 className="mt-2 text-3xl font-medium sm:text-4xl">{market.home.servicesTitle}</h2>
            </div>
            <Link to="/servicios" className="hidden items-center gap-2 text-sm font-black text-[#315b42] sm:inline-flex">
              Ver todos <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {market.home.services.map((service) => (
              <Link
                key={service.title}
                to={service.href}
                className="group overflow-hidden rounded-3xl border border-[#ded9cd] bg-[#fffdf9] shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="h-40 overflow-hidden">
                  <img
                    src={service.imageUrl}
                    alt=""
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-black leading-tight">{service.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#6c786f]">{service.subtitle}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#315b42]">
                    {service.ctaLabel} <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#6d7d72]">
              Selección Herencia
            </p>
            <h2 className="mt-2 text-3xl font-medium sm:text-4xl">{market.home.featuredTitle}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6c786f]">
              {market.home.featuredSubtitle}
            </p>
          </div>
          <Link to="/productos" className="inline-flex items-center gap-2 text-sm font-black text-[#315b42]">
            Ver todos <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {featured.map((product) => {
            const price = Number(product.salePrice || product.price || 0);
            return (
              <article
                key={product.id}
                className="overflow-hidden rounded-2xl border border-[#e5e1d8] bg-white shadow-sm"
              >
                <Link to={`/producto/${product.id}`} className="block h-40 overflow-hidden bg-[#f1eee7]">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full object-cover transition duration-500 hover:scale-105"
                  />
                </Link>
                <div className="p-3">
                  <Link to={`/producto/${product.id}`} className="line-clamp-2 min-h-10 text-sm font-black">
                    {product.name}
                  </Link>
                  <p className="mt-2 text-base font-black text-[#315b42]">{money(price)}</p>
                  <button
                    type="button"
                    onClick={() => addToCart(product)}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#315b42] px-3 py-2 text-xs font-black text-white transition hover:bg-[#234832]"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" /> Añadir
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 pb-14 sm:px-8 lg:grid-cols-2 lg:px-10">
        {[market.dulce, market.moda].map((promo, index) => (
          <Link
            key={promo.title}
            to={promo.href}
            className="group relative min-h-[300px] overflow-hidden rounded-[2rem] border border-[#ded9cd]"
          >
            <img
              src={promo.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
            />
            <div
              className={`absolute inset-0 ${
                index === 0
                  ? "bg-gradient-to-r from-[#6b3327]/80 via-[#7d4030]/52 to-transparent"
                  : "bg-gradient-to-r from-[#173d2a]/88 via-[#173d2a]/50 to-transparent"
              }`}
            />
            <div className="relative flex min-h-[300px] max-w-md flex-col justify-center p-8 text-white">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-white/75">{promo.kicker}</p>
              <h2 className="mt-3 text-4xl font-medium">{promo.title}</h2>
              <p className="mt-3 text-sm leading-6 text-white/88">{promo.subtitle}</p>
              <span className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-black text-[#193325]">
                {promo.buttonLabel} <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        ))}
      </section>

      <section className="border-y border-[#ded9cd] bg-[#f4f1e8]">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:px-10">
          {market.home.trust.map((item, index) => {
            const Icon = trustIcons[index % trustIcons.length];
            return (
              <div key={item.title} className="flex gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#315b42] shadow-sm">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-black">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-[#6c786f]">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#173d2a] px-7 py-10 text-white sm:px-10">
          <Sparkles className="absolute right-8 top-8 h-20 w-20 text-white/5" />
          <p className="text-xs font-black uppercase tracking-[0.24em] text-white/65">HERENCIA</p>
          <h2 className="mt-2 max-w-2xl text-3xl font-medium sm:text-4xl">
            {site.cta.title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78">{site.cta.subtitle}</p>
          <Link
            to={site.cta.button.href || "/productos"}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#173d2a]"
          >
            {site.cta.button.label || "Explorar Herencia"} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
