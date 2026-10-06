import { useEffect, useState } from "react";
import { Bookmark, ExternalLink, Heart, Instagram, Sparkles, Users, X } from "lucide-react";
import { backendApi, backendStorage } from "../lib/backendStorage";
import { useNavigate } from "react-router";
import { toast } from "sonner";

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
  const navigate = useNavigate();
  const [interactions, setInteractions] = useState<any>({ authenticated: false, likeCounts: {}, liked: [], saved: [] });
  const [community, setCommunity] = useState<any>({ posts: [], stories: [], instagramUrl: "", whatsappUrl: "" });
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [seenStories, setSeenStories] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem("herencia_seen_stories") || "[]"); } catch { return []; } });

  useEffect(() => {
    const load = () => {
      try {
        const parsed = JSON.parse(backendStorage.getItem("communityContent") || "{}");
        setCommunity({ posts: Array.isArray(parsed.posts) ? parsed.posts : [], stories: Array.isArray(parsed.stories) ? parsed.stories : [], instagramUrl: parsed.instagramUrl || "", whatsappUrl: parsed.whatsappUrl || "" });
      } catch {}
    };
    load();
    window.addEventListener("backend-storage", load);
    return () => window.removeEventListener("backend-storage", load);
  }, []);

  useEffect(() => {
    backendApi.communityInteractions().then(setInteractions).catch(() => null);
  }, []);

  const toggle = async (postId: string, kind: "like" | "save") => {
    if (!interactions.authenticated) {
      toast("Inicia sesión para participar en Comunidad");
      navigate("/login");
      return;
    }
    try {
      if (kind === "like") {
        const result = await backendApi.toggleCommunityLike(postId);
        setInteractions((current: any) => ({
          ...current,
          liked: result.liked ? [...new Set([...current.liked, postId])] : current.liked.filter((id: string) => id !== postId),
          likeCounts: { ...current.likeCounts, [postId]: result.count },
        }));
      } else {
        const result = await backendApi.toggleCommunitySave(postId);
        setInteractions((current: any) => ({
          ...current,
          saved: result.saved ? [...new Set([...current.saved, postId])] : current.saved.filter((id: string) => id !== postId),
        }));
      }
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar la interacción");
    }
  };

  const activeStories = community.stories.filter((story: any) => {
    if (!story?.published) return false;
    if (!story.expiresAt) return true;
    return new Date(story.expiresAt).getTime() > Date.now();
  });
  const openStory = (index: number) => {
    const story = activeStories[index];
    if (!story) return;
    setActiveStoryIndex(index);
    setSeenStories((current) => {
      const next = [...new Set([...current, story.id])];
      localStorage.setItem("herencia_seen_stories", JSON.stringify(next));
      return next;
    });
  };
  const activeStory = activeStoryIndex == null ? null : activeStories[activeStoryIndex];

  useEffect(() => {
    if (!activeStory) return;
    const timer = window.setTimeout(() => {
      if (activeStoryIndex != null && activeStoryIndex < activeStories.length - 1) openStory(activeStoryIndex + 1);
      else setActiveStoryIndex(null);
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [activeStoryIndex, activeStories.length]);

  const publishedPosts = community.posts.filter((post: any) => post?.published);
  const visibleUpdates = publishedPosts.length ? publishedPosts.map((post: any) => ({ id: post.id, title: post.title, description: post.text, image: post.imageUrl })) : updates.map((post, index) => ({ ...post, id: `demo-${index}` }));

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


      {activeStories.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 pt-8 sm:px-8 lg:px-10">
          <div className="flex gap-5 overflow-x-auto pb-3">
            {activeStories.map((story: any, index: number) => (
              <button key={story.id} type="button" onClick={() => openStory(index)} className="w-20 shrink-0 text-center">
                <span className={`mx-auto block h-[74px] w-[74px] rounded-full border-[3px] p-[3px] shadow-sm transition ${seenStories.includes(story.id) ? "border-[#a8b0aa]" : "border-[#2f6b45]"}`}>
                  <span className="block h-full w-full overflow-hidden rounded-full bg-[#e9e5db]">
                    {story.mediaUrl ? <img src={story.mediaUrl} alt={story.title || "Historia"} className="h-full w-full object-cover"/> : <span className="grid h-full place-items-center text-xs font-bold text-[#315b42]">H</span>}
                  </span>
                </span>
                <span className="mt-2 block truncate text-xs font-semibold text-[#315b42]">{story.title || "Historia"}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {activeStory && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true">
          <div className="relative w-full max-w-md overflow-hidden rounded-[30px] bg-[#14271d] text-white shadow-2xl">
            <button type="button" onClick={() => setActiveStoryIndex(null)} className="absolute right-4 top-4 z-10 rounded-full bg-black/35 p-2 backdrop-blur" aria-label="Cerrar historia"><X className="h-5 w-5"/></button>
            <div className="absolute left-4 right-14 top-5 z-10 flex gap-1">
              {activeStories.map((_: any, index: number) => <span key={index} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25"><span className={`block h-full rounded-full bg-[#78a987] ${index <= (activeStoryIndex ?? 0) ? "w-full" : "w-0"}`}/></span>)}
            </div>
            {activeStory.mediaUrl && <img src={activeStory.mediaUrl} alt="" className="max-h-[72vh] min-h-[420px] w-full object-cover"/>}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-6 pt-24">
              <h3 className="text-2xl font-semibold">{activeStory.title}</h3>
              {activeStory.text && <p className="mt-2 text-sm leading-6 text-white/85">{activeStory.text}</p>}
              <div className="mt-4 flex items-center justify-between gap-3">
                <button type="button" disabled={(activeStoryIndex ?? 0) <= 0} onClick={() => openStory((activeStoryIndex ?? 0) - 1)} className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold disabled:opacity-30">Anterior</button>
                <button type="button" disabled={(activeStoryIndex ?? 0) >= activeStories.length - 1} onClick={() => openStory((activeStoryIndex ?? 0) + 1)} className="rounded-full bg-white/15 px-4 py-2 text-sm font-bold disabled:opacity-30">Siguiente</button>
              </div>
              {activeStory.linkUrl && <a href={activeStory.linkUrl} className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold text-[#173126]">Ver más</a>}
            </div>
          </div>
        </div>
      )}

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
                <div className="mt-5 flex items-center justify-between gap-4 text-sm text-[#718076]">
                  <button type="button" onClick={() => toggle(item.id, "like")} className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition hover:bg-[#f4f0e7] ${interactions.liked.includes(item.id) ? "text-rose-600" : ""}`} aria-label="Me gusta">
                    <Heart className={`h-4 w-4 ${interactions.liked.includes(item.id) ? "fill-current" : ""}`} />
                    {interactions.likeCounts[item.id] || 0}
                  </button>
                  <button type="button" onClick={() => toggle(item.id, "save")} className={`rounded-full p-2 transition hover:bg-[#f4f0e7] ${interactions.saved.includes(item.id) ? "text-[#173126]" : ""}`} aria-label="Guardar publicación">
                    <Bookmark className={`h-4 w-4 ${interactions.saved.includes(item.id) ? "fill-current" : ""}`} />
                  </button>
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

        <div className="mt-8 rounded-[28px] border border-[#d8d2c5] bg-[#f7f4ed] p-6 text-sm leading-6 text-[#657169]">
          <strong className="text-[#173126]">Participa con tu cuenta Herencia:</strong> los corazones y publicaciones guardadas quedan asociados a tu usuario. Puedes crear la cuenta con email o continuar con Google desde el acceso de clientes.
        </div>
      </section>
    </div>
  );
}
