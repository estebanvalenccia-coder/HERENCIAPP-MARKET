import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { backendStorage } from "../lib/backendStorage";
import { products as fallbackProducts } from "../data/products";
import { defaultSiteContent, parseSiteContent, type SiteContent } from "../lib/siteContent";
import { getMarketExperience } from "../lib/marketExperience";

type Kind = "dulce" | "moda";

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesKind(product: any, kind: Kind) {
  const text = normalize([
    product?.name,
    product?.category,
    product?.description,
    product?.tags,
    product?.collection,
  ].filter(Boolean).join(" "));

  if (kind === "dulce") {
    return ["dulce", "postre", "tarta", "pastel", "desayuno", "reposteria", "brownie", "galleta"].some((term) =>
      text.includes(term)
    );
  }

  return ["moda", "camisa", "delantal", "guante", "ropa", "textil", "uniforme"].some((term) =>
    text.includes(term)
  );
}

function money(value: unknown) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function addToCart(product: any) {
  try {
    const cart = JSON.parse(backendStorage.getItem("cart") || "[]");
    const existing = cart.find((item: any) => String(item.id) === String(product.id));
    if (existing) existing.quantity = Number(existing.quantity || 1) + 1;
    else cart.push({ ...product, quantity: 1 });
    void backendStorage.setItem("cart", JSON.stringify(cart));
    window.dispatchEvent(new Event("storage"));
    toast.success(`${product.name} añadido al carrito`);
  } catch {
    toast.error("No se pudo añadir al carrito");
  }
}

function CollectionPage({ kind }: { kind: Kind }) {
  const [site, setSite] = useState<SiteContent>(defaultSiteContent);
  const [catalog, setCatalog] = useState<any[]>(fallbackProducts);

  useEffect(() => {
    const load = () => {
      setSite(parseSiteContent(backendStorage.getItem("siteContent")));
      try {
        const rows = JSON.parse(backendStorage.getItem("adminProducts") || "[]");
        setCatalog(Array.isArray(rows) && rows.length ? rows.filter((item: any) => item.active !== false) : fallbackProducts);
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
  const content = market[kind];
  const rows = useMemo(() => catalog.filter((product) => matchesKind(product, kind)), [catalog, kind]);

  const chips =
    kind === "dulce"
      ? ["Desayunos sorpresa", "Postres por encargo", "Decoración de ambientes"]
      : ["Camisas", "Delantales", "Guantes"];

  return (
    <div className="bg-[#fbfaf6] text-[#173126]">
      <section className="relative min-h-[420px] overflow-hidden">
        <img src={content.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className={`absolute inset-0 ${
          kind === "dulce"
            ? "bg-gradient-to-r from-[#6b3327]/88 via-[#774132]/62 to-transparent"
            : "bg-gradient-to-r from-[#173d2a]/90 via-[#173d2a]/58 to-transparent"
        }`} />
        <div className="relative mx-auto flex min-h-[420px] max-w-7xl items-center px-5 py-14 sm:px-8 lg:px-10">
          <div className="max-w-2xl text-white">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-white/72">{content.kicker}</p>
            <h1 className="mt-4 text-5xl font-medium sm:text-6xl">{content.pageTitle}</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/86">{content.pageSubtitle}</p>
            <div className="mt-7 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <span key={chip} className="rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold backdrop-blur">
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#718076]">Colección Herencia</p>
            <h2 className="mt-2 text-3xl font-medium">{content.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6c786f]">{content.subtitle}</p>
          </div>
          <Link to="/productos" className="inline-flex items-center gap-2 text-sm font-black text-[#315b42]">
            Ver toda la tienda <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {rows.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rows.map((product) => (
              <article key={product.id} className="overflow-hidden rounded-3xl border border-[#e1ddd3] bg-white shadow-sm">
                <Link to={`/producto/${product.id}`} className="block h-64 overflow-hidden bg-[#f0ede5]">
                  <img src={product.image} alt={product.name} className="h-full w-full object-cover transition duration-500 hover:scale-105" />
                </Link>
                <div className="p-5">
                  <Link to={`/producto/${product.id}`} className="text-lg font-black">{product.name}</Link>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#6c786f]">{product.description}</p>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <span className="text-lg font-black text-[#315b42]">{money(product.salePrice || product.price)}</span>
                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      className="inline-flex items-center gap-2 rounded-full bg-[#315b42] px-4 py-2.5 text-sm font-black text-white"
                    >
                      <ShoppingCart className="h-4 w-4" /> Añadir
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-[2rem] border border-[#dfdbd1] bg-white p-8 text-center">
            <h3 className="text-2xl font-medium">Esta colección se gestiona desde Administración</h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#6c786f]">
              Cuando añadas productos de {kind === "dulce" ? "Dulce" : "Moda"} desde el catálogo,
              aparecerán aquí automáticamente manteniendo esta misma estética.
            </p>
            <Link to="/contacto" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#315b42] px-5 py-3 text-sm font-black text-white">
              Consultar en Herencia <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

export function Sweet() {
  return <CollectionPage kind="dulce" />;
}

export function Fashion() {
  return <CollectionPage kind="moda" />;
}
