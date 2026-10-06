import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Eye, EyeOff, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { backendStorage } from "../../lib/backendStorage";

export type CommunityPost = {
  id: string;
  title: string;
  text: string;
  imageUrl: string;
  published: boolean;
  createdAt: string;
};

export type CommunityStory = {
  id: string;
  title: string;
  mediaUrl: string;
  text: string;
  linkUrl: string;
  published: boolean;
  expiresAt: string;
};

export type CommunityContent = {
  instagramUrl: string;
  whatsappUrl: string;
  posts: CommunityPost[];
  stories: CommunityStory[];
};

export const defaultCommunityContent: CommunityContent = {
  instagramUrl: "",
  whatsappUrl: "",
  posts: [],
  stories: [],
};

function readCommunity(): CommunityContent {
  try {
    const parsed = JSON.parse(backendStorage.getItem("communityContent") || "null");
    return {
      ...defaultCommunityContent,
      ...(parsed && typeof parsed === "object" ? parsed : {}),
      posts: Array.isArray(parsed?.posts) ? parsed.posts : [],
      stories: Array.isArray(parsed?.stories) ? parsed.stories : [],
    };
  } catch {
    return defaultCommunityContent;
  }
}

export function AdminCommunity() {
  const [content, setContent] = useState<CommunityContent>(readCommunity);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const sync = () => setContent(readCommunity());
    window.addEventListener("backend-storage", sync);
    return () => window.removeEventListener("backend-storage", sync);
  }, []);

  const publishedCount = useMemo(() => content.posts.filter((post) => post.published).length, [content.posts]);

  const addStory = () => {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setContent((current) => ({
      ...current,
      stories: [{
        id: crypto.randomUUID(),
        title: "Nueva historia",
        mediaUrl: "",
        text: "",
        linkUrl: "",
        published: false,
        expiresAt: expires.toISOString().slice(0, 16),
      }, ...current.stories],
    }));
  };

  const patchStory = (id: string, patch: Partial<CommunityStory>) => setContent((current) => ({
    ...current,
    stories: current.stories.map((story) => story.id === id ? { ...story, ...patch } : story),
  }));

  const removeStory = (id: string) => setContent((current) => ({
    ...current,
    stories: current.stories.filter((story) => story.id !== id),
  }));

  const addPost = () => {
    setContent((current) => ({
      ...current,
      posts: [{
        id: crypto.randomUUID(),
        title: "Nueva novedad",
        text: "",
        imageUrl: "",
        published: false,
        createdAt: new Date().toISOString(),
      }, ...current.posts],
    }));
  };

  const patchPost = (id: string, patch: Partial<CommunityPost>) => {
    setContent((current) => ({ ...current, posts: current.posts.map((post) => post.id === id ? { ...post, ...patch } : post) }));
  };

  const removePost = (id: string) => {
    setContent((current) => ({ ...current, posts: current.posts.filter((post) => post.id !== id) }));
  };

  const save = async () => {
    try {
      setSaving(true);
      const result = await backendStorage.setItem("communityContent", JSON.stringify(content));
      if (!result.ok) throw new Error(result.error || "No se pudo sincronizar");
      toast.success("Comunidad publicada");
    } catch (error: any) {
      toast.error(error?.message || "No se pudo guardar Comunidad");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Comunidad Herencia</p>
            <h3 className="mt-2 text-2xl font-bold">Novedades y canales</h3>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Publica contenido que aparecerá en /comunidad. Los borradores se quedan ocultos hasta que los actives.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={addPost} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-muted"><Plus className="h-4 w-4"/>Nueva</button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"><Save className="h-4 w-4"/>{saving ? "Guardando…" : "Guardar"}</button>
          </div>
        </div>
        <div className="mt-5 flex gap-3 text-xs text-muted-foreground"><span>{content.posts.length} publicaciones</span><span>·</span><span>{publishedCount} visibles</span></div>
      </div>

      <div className="grid gap-4 rounded-3xl border border-border bg-card p-6 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">Instagram
          <input value={content.instagramUrl} onChange={(e)=>setContent({...content,instagramUrl:e.target.value})} placeholder="https://instagram.com/..." className="w-full rounded-xl border bg-background px-4 py-3 font-normal"/>
        </label>
        <label className="space-y-2 text-sm font-medium">WhatsApp / Comunidad
          <input value={content.whatsappUrl} onChange={(e)=>setContent({...content,whatsappUrl:e.target.value})} placeholder="https://chat.whatsapp.com/..." className="w-full rounded-xl border bg-background px-4 py-3 font-normal"/>
        </label>
      </div>


      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Historias</p>
            <h3 className="mt-1 text-xl font-bold">Historias de Herencia</h3>
            <p className="mt-1 text-sm text-muted-foreground">Las historias publicadas aparecen con marco verde y desaparecen al caducar.</p>
          </div>
          <button onClick={addStory} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-muted"><Plus className="h-4 w-4"/>Nueva historia</button>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {content.stories.map((story) => (
            <article key={story.id} className="rounded-2xl border p-4">
              <div className="flex gap-4">
                <div className={`h-20 w-20 shrink-0 overflow-hidden rounded-full border-4 p-1 ${story.published ? "border-emerald-600" : "border-muted"}`}>
                  <div className="h-full w-full overflow-hidden rounded-full bg-muted">
                    {story.mediaUrl ? <img src={story.mediaUrl} alt="" className="h-full w-full object-cover"/> : <div className="grid h-full place-items-center text-[10px] text-muted-foreground">Historia</div>}
                  </div>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <input value={story.title} onChange={(e)=>patchStory(story.id,{title:e.target.value})} className="w-full rounded-lg border bg-background px-3 py-2 font-semibold" placeholder="Título"/>
                  <input value={story.mediaUrl} onChange={(e)=>patchStory(story.id,{mediaUrl:e.target.value})} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="URL de foto o vídeo"/>
                  <textarea value={story.text} onChange={(e)=>patchStory(story.id,{text:e.target.value})} className="min-h-16 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Texto opcional"/>
                  <input value={story.linkUrl} onChange={(e)=>patchStory(story.id,{linkUrl:e.target.value})} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Enlace opcional"/>
                  <label className="block text-xs text-muted-foreground">Caduca
                    <input type="datetime-local" value={story.expiresAt?.slice(0,16) || ""} onChange={(e)=>patchStory(story.id,{expiresAt:e.target.value})} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"/>
                  </label>
                  <div className="flex justify-end gap-2">
                    <button onClick={()=>patchStory(story.id,{published:!story.published})} className={`rounded-lg px-3 py-2 text-xs font-bold ${story.published?"bg-emerald-50 text-emerald-700":"bg-muted text-muted-foreground"}`}>{story.published?"Publicada":"Borrador"}</button>
                    <button onClick={()=>removeStory(story.id)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4"/></button>
                  </div>
                </div>
              </div>
            </article>
          ))}
          {!content.stories.length && <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground lg:col-span-2">No hay historias. Crea una y publícala cuando esté lista.</div>}
        </div>
      </section>

      <div className="space-y-4">
        {content.posts.map((post) => (
          <article key={post.id} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="grid gap-5 lg:grid-cols-[180px_1fr]">
              <div className="aspect-square overflow-hidden rounded-2xl bg-muted">
                {post.imageUrl ? <img src={post.imageUrl} alt="" className="h-full w-full object-cover"/> : <div className="grid h-full place-items-center px-4 text-center text-xs text-muted-foreground">Añade una URL de imagen</div>}
              </div>
              <div className="space-y-3">
                <input value={post.title} onChange={(e)=>patchPost(post.id,{title:e.target.value})} className="w-full rounded-xl border bg-background px-4 py-3 font-semibold" placeholder="Título"/>
                <textarea value={post.text} onChange={(e)=>patchPost(post.id,{text:e.target.value})} className="min-h-24 w-full rounded-xl border bg-background px-4 py-3 text-sm" placeholder="Escribe la novedad…"/>
                <input value={post.imageUrl} onChange={(e)=>patchPost(post.id,{imageUrl:e.target.value})} className="w-full rounded-xl border bg-background px-4 py-3 text-sm" placeholder="URL de imagen"/>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarClock className="h-4 w-4"/>{new Date(post.createdAt).toLocaleString("es-ES")}</div>
                  <div className="flex gap-2">
                    <button onClick={()=>patchPost(post.id,{published:!post.published})} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${post.published?"bg-emerald-50 text-emerald-700":"bg-muted text-muted-foreground"}`}>{post.published?<Eye className="h-4 w-4"/>:<EyeOff className="h-4 w-4"/>}{post.published?"Publicada":"Borrador"}</button>
                    <button onClick={()=>removePost(post.id)} className="rounded-xl p-2 text-destructive hover:bg-destructive/10" aria-label="Eliminar"><Trash2 className="h-4 w-4"/></button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
        {!content.posts.length && <div className="rounded-3xl border border-dashed p-10 text-center text-sm text-muted-foreground">Todavía no hay novedades. Pulsa “Nueva” para crear la primera.</div>}
      </div>
    </div>
  );
}
