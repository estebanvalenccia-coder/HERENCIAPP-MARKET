import { useEffect, useState } from "react";
import { ExternalLink, Heart, Instagram, MessageCircle, Sparkles, Users } from "lucide-react";
import { backendStorage } from "../lib/backendStorage";

const updates = [
  {
    title: "Lo nuevo en Herencia",
    description: "Descubre plantas, colecciones, ideas y novedades seleccionadas por Herencia.",
    image: "https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=1200&q=84",
  },
  {
    title: "Consejos para tu rincón verde",
    description: "Ideas breves para cuidar mejor tus plantas y crear espacios con más vida.",
    image: "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=1200&q=84",
  },
  {
    title: "Detrás de Herencia",
    description: "Procesos, inspiración y pequeñas historias que forman parte de nuestro día a día.",
    image: "https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=1200&q=84",
  },
];

export function Community() {
  const [community, setCommunity] = useState<any>({ posts: [], instagramUrl: "", whatsappUrl: "" });

  useEffect(() => {
    const load = () => {
      try {
        const parsed = JSON.parse(backendStorage.getItem("communityContent") || "{}");
        setCommunity({ posts: Array.isArray(parsed.posts) ? parsed.posts : [], instagramUrl: parsed.instagramUrl || "", whatsappUrl: parsed.whatsappUrl || "" });
      } catch {}
    };
    load();
    window.addEventListener("backend-storage", load);
    return () => window.removeEventListener("backend-storage", load);
  }, []);

  const publishedPosts = community.posts.filter((post: any) => post?.published);
  const visibleUpdates = publishedPosts.length ? publishedPosts.map((post: any) => ({ title: post.title, description: post.text, image: post.imageUrl })) : updates;

  return (
    <div className="bg-[#fbfaf6] text-[#173126]">
      <section className="border-b border-[#e8e2d8] bg-[#f4f0e7]">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10 lg:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d8d2c5] bg-white/70 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#315b42]">
              <Sparkles className="h-4 w-4" /> Comunidad Herencia
            </div>
            <h1 className="mt-6 text-4xl font-medium tracking-tight sm:text-5xl lg:text-6xl">Un lugar para compartir lo que nos inspira.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#657169] sm:text-lg">
              Novedades, ideas y contenido de Herencia en un espacio tranquilo. La conversación continúa en nuestras redes y canales sociales.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-10">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#718076]">Hoy en Herencia</p>
            <h2 className="mt-2 text-3xl font-medium">Novedades</h2>
          </div>
          <span className="hidden text-sm text-[#718076] sm:block">Contenido seleccionado por Herencia</span>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {visibleUpdates.map((item: any) => (
            <article key={item.title} className="overflow-hidden rounded-[28px] border border-[#e4ded2] bg-white shadow-[0_12px_36px_rgba(39,61,45,0.06)]">
              <img src={item.image} alt="" className="aspect-[4/3] w-full object-cover" />
              <div className="p-6">
                <h3 className="text-xl font-medium">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#6d776f]">{item.description}</p>
                <div className="mt-5 flex items-center gap-4 text-sm text-[#718076]">
                  <span className="inline-flex items-center gap-1.5"><Heart className="h-4 w-4" /> Próximamente</span>
                  <span className="inline-flex items-center gap-1.5"><MessageCircle className="h-4 w-4" /> Comunidad</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 lg:px-10">
        <div className="grid gap-5 lg:grid-cols-2">
          <a href={community.instagramUrl || "https://www.instagram.com/"} target="_blank" rel="noopener noreferrer" className="group rounded-[28px] border border-[#e4ded2] bg-white p-7 transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f1ede4]"><Instagram className="h-6 w-6" /></div>
              <ExternalLink className="h-5 w-5 text-[#718076]" />
            </div>
            <h2 className="mt-8 text-2xl font-medium">Instagram</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-[#6d776f]">Historias, inspiración, nuevos productos y el día a día visual de Herencia.</p>
            <span className="mt-6 inline-flex text-sm font-black text-[#315b42]">Abrir Instagram</span>
          </a>

          <a href={community.whatsappUrl || "https://wa.me/"} target="_blank" rel="noopener noreferrer" className="group rounded-[28px] border border-[#e4ded2] bg-[#173d2a] p-7 text-white transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><Users className="h-6 w-6" /></div>
              <ExternalLink className="h-5 w-5 text-white/60" />
            </div>
            <h2 className="mt-8 text-2xl font-medium">Comunidad y WhatsApp</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-white/70">Un acceso preparado para conectar la comunidad con los canales de Herencia sin convertir la tienda en una red social pesada.</p>
            <span className="mt-6 inline-flex text-sm font-black text-white">Conectar con Herencia</span>
          </a>
        </div>

        <div className="mt-8 rounded-[28px] border border-dashed border-[#d8d2c5] bg-[#f7f4ed] p-6 text-sm leading-6 text-[#657169]">
          <strong className="text-[#173126]">Siguiente etapa:</strong> corazones, guardados y comentarios vinculados a cuentas de Herencia. Se activarán cuando exista la capa de persistencia y permisos necesaria para que las interacciones sean reales y privadas.
        </div>
      </section>
    </div>
  );
}
