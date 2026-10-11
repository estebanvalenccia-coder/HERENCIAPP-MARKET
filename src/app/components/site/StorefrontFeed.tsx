import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Image as ImageIcon } from "lucide-react";
import { Link } from "react-router";
import { backendStorage } from "../../lib/backendStorage";
import {
  parseStorefrontPosts,
  storefrontPostTypeLabel,
  visibleStorefrontPosts,
  type StorefrontPost,
} from "../../lib/storefrontPosts";

function PostLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (!href) return <div className={className}>{children}</div>;
  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} className={className} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

function Media({ post, className = "" }: { post: StorefrontPost; className?: string }) {
  const images = post.imageUrls.filter(Boolean);
  if (!images.length) {
    return (
      <div className={`grid place-items-center bg-[#eef0e9] text-[#79867d] ${className}`}>
        <ImageIcon className="h-8 w-8" />
      </div>
    );
  }

  if (post.layout === "carousel" && images.length > 1) {
    return (
      <div className={`flex snap-x snap-mandatory overflow-x-auto ${className}`}>
        {images.map((url, index) => (
          <img key={url + index} src={url} alt="" className="h-full min-w-full snap-center object-cover" />
        ))}
      </div>
    );
  }

  return <img src={images[0]} alt="" className={`object-cover ${className}`} />;
}

function StandardCard({ post }: { post: StorefrontPost }) {
  const story = post.layout === "story";
  return (
    <article className={`overflow-hidden rounded-[1.7rem] border border-[#e3ded4] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${story ? "min-h-[470px]" : ""}`}>
      <Media post={post} className={story ? "h-[330px] w-full" : "h-56 w-full"} />
      <div className="p-5">
        <span className="inline-flex rounded-full bg-[#edf4ee] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#315b42]">
          {post.label || storefrontPostTypeLabel(post.type)}
        </span>
        <h3 className="mt-3 text-xl font-black leading-tight text-[#173126]">{post.title}</h3>
        {post.description && <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#69766d]">{post.description}</p>}
        {post.ctaLabel && post.ctaHref && (
          <PostLink href={post.ctaHref} className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#315b42]">
            {post.ctaLabel} <ArrowRight className="h-4 w-4" />
          </PostLink>
        )}
      </div>
    </article>
  );
}

function Banner({ post }: { post: StorefrontPost }) {
  const image = post.imageUrls[0];
  return (
    <PostLink
      href={post.ctaHref}
      className="group relative block min-h-[290px] overflow-hidden rounded-[2rem] border border-[#ded9cd] bg-[#173126]"
    >
      {image ? (
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-r from-[#173126]/95 via-[#173126]/72 to-[#173126]/20" />
      <div className="relative flex min-h-[290px] max-w-2xl flex-col justify-center p-7 text-white sm:p-10">
        <span className="w-fit rounded-full border border-white/30 bg-white/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
          {post.label || storefrontPostTypeLabel(post.type)}
        </span>
        <h3 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">{post.title}</h3>
        {post.description && <p className="mt-3 max-w-xl text-sm leading-6 text-white/82 sm:text-base">{post.description}</p>}
        {post.ctaLabel && post.ctaHref && (
          <span className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#173126]">
            {post.ctaLabel} <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </PostLink>
  );
}

function Feature({ post }: { post: StorefrontPost }) {
  return (
    <article className="grid overflow-hidden rounded-[2rem] border border-[#e3ded4] bg-white shadow-sm lg:grid-cols-2">
      <Media post={post} className="h-[320px] w-full lg:h-full lg:min-h-[390px]" />
      <div className="flex flex-col justify-center p-7 sm:p-10">
        <span className="w-fit rounded-full bg-[#edf4ee] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#315b42]">
          {post.label || storefrontPostTypeLabel(post.type)}
        </span>
        <h3 className="mt-4 text-3xl font-black leading-tight text-[#173126] sm:text-4xl">{post.title}</h3>
        {post.description && <p className="mt-4 text-sm leading-7 text-[#69766d] sm:text-base">{post.description}</p>}
        {post.ctaLabel && post.ctaHref && (
          <PostLink href={post.ctaHref} className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-[#315b42] px-5 py-3 text-sm font-black text-white">
            {post.ctaLabel} <ArrowRight className="h-4 w-4" />
          </PostLink>
        )}
      </div>
    </article>
  );
}

export function StorefrontFeed() {
  const [posts, setPosts] = useState<StorefrontPost[]>([]);

  useEffect(() => {
    const load = () => setPosts(parseStorefrontPosts(backendStorage.getItem("storefrontPosts")));
    load();
    window.addEventListener("backend-storage", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("backend-storage", load);
      window.removeEventListener("storage", load);
    };
  }, []);

  const visible = useMemo(() => visibleStorefrontPosts(posts, "home"), [posts]);
  if (!visible.length) return null;

  const wide = visible.filter((post) => post.layout === "banner" || post.layout === "feature");
  const cards = visible.filter((post) => post.layout !== "banner" && post.layout !== "feature");

  return (
    <section className="border-y border-[#e5e1d8] bg-[#fffdf9]">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#6d7d72]">Actualidad Herencia</p>
            <h2 className="mt-2 text-3xl font-medium text-[#173126] sm:text-4xl">Descubre en Herencia</h2>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[#6c786f]">Ofertas, novedades, inspiración, campañas y selecciones destacadas publicadas directamente desde nuestro equipo.</p>
        </div>

        <div className="space-y-5">
          {wide.map((post) => post.layout === "banner" ? <Banner key={post.id} post={post} /> : <Feature key={post.id} post={post} />)}
        </div>

        {cards.length > 0 && (
          <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {cards.map((post) => <StandardCard key={post.id} post={post} />)}
          </div>
        )}
      </div>
    </section>
  );
}
