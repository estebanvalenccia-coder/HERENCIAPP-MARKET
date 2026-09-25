import { useEffect, useState } from "react";
import { HeartHandshake, Leaf, MapPin, Sparkles } from "lucide-react";
import { backendStorage } from "../lib/backendStorage";
import { defaultSiteContent, parseSiteContent, type SiteContent } from "../lib/siteContent";
import { getMarketExperience } from "../lib/marketExperience";

const icons = [Leaf, Sparkles, HeartHandshake, MapPin];

export function About() {
  const [site, setSite] = useState<SiteContent>(defaultSiteContent);

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

  return (
    <div className="bg-[#fbfaf6] text-[#173126]">
      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 lg:grid-cols-2 lg:items-center lg:px-10 lg:py-16">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#718076]">
            {market.about.kicker}
          </p>
          <h1 className="mt-4 max-w-xl text-5xl font-medium leading-[1.02] sm:text-6xl">
            {market.about.title}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-[#66736b]">
            {market.about.description}
          </p>
        </div>
        <div className="overflow-hidden rounded-[2rem] border border-[#ded9cd] bg-[#f0ede5]">
          <img
            src={market.about.imageUrl}
            alt="Universo Herencia"
            className="h-[430px] w-full object-cover"
          />
        </div>
      </section>

      <section className="border-y border-[#ded9cd] bg-[#f4f1e8]">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-10">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {market.about.values.map((value, index) => {
              const Icon = icons[index % icons.length];
              return (
                <article key={value.title} className="rounded-3xl border border-[#dfdbd1] bg-[#fffdf9] p-6">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-[#eef2eb] text-[#315b42]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h2 className="mt-5 text-xl font-black">{value.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#6c786f]">{value.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
        <div className="rounded-[2rem] bg-[#173d2a] px-7 py-10 text-white sm:px-10">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-white/65">
            {market.locationLabel}
          </p>
          <h2 className="mt-3 text-3xl font-medium sm:text-4xl">
            Una marca para vivir la naturaleza de muchas maneras
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/78">
            Plantas y jardín conviven con decoración, servicios, detalles dulces, moda funcional
            y encargos personalizados. Esa amplitud es parte de la identidad de Herencia.
          </p>
        </div>
      </section>
    </div>
  );
}
