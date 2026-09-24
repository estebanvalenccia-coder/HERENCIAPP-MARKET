import { Link } from "react-router";
import { ArrowRight, Heart, Leaf, Truck, GraduationCap } from "lucide-react";
import type { BuilderBlock, SiteContent, SiteLink } from "../../lib/siteContent";
import { isExternalHref } from "../../lib/siteContent";

function SmartLink({
  link,
  className,
  children,
}: {
  link?: SiteLink;
  className?: string;
  children?: React.ReactNode;
}) {
  const href = String(link?.href || "/").trim() || "/";
  const label = link?.label || children;

  if (isExternalHref(href)) {
    return (
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel="noopener noreferrer"
        className={className}
      >
        {label}
      </a>
    );
  }

  return (
    <Link to={href} className={className}>
      {label}
    </Link>
  );
}

function sectionStyle(block: BuilderBlock): React.CSSProperties {
  const design = block.design;
  return {
    backgroundColor: design.backgroundColor || undefined,
    color: design.textColor || undefined,
    paddingTop: `${Math.max(0, Number(design.paddingY || 0))}px`,
    paddingBottom: `${Math.max(0, Number(design.paddingY || 0))}px`,
  };
}

function containerStyle(block: BuilderBlock): React.CSSProperties {
  return {
    maxWidth: `${Math.max(320, Number(block.design.maxWidth || 1280))}px`,
    margin: "0 auto",
    paddingLeft: "1rem",
    paddingRight: "1rem",
  };
}

function alignClass(alignment: string) {
  if (alignment === "center") return "text-center items-center";
  if (alignment === "right") return "text-right items-end";
  return "text-left items-start";
}

function Heading({
  children,
  block,
  className = "",
}: {
  children: React.ReactNode;
  block: BuilderBlock;
  className?: string;
}) {
  const scale = Math.max(70, Math.min(180, Number(block.design.headingScale || 100))) / 100;
  return (
    <h2
      className={`font-serif font-black leading-tight ${className}`}
      style={{ fontSize: `calc(2rem * ${scale})` }}
    >
      {children}
    </h2>
  );
}

export function StorefrontBlock({
  block,
  site,
  heroFallback = "",
  ctaFallback = "",
  preview = false,
}: {
  block: BuilderBlock;
  site: SiteContent;
  heroFallback?: string;
  ctaFallback?: string;
  preview?: boolean;
}) {
  if (!block.visible) return null;
  const hiddenMobileClass = block.design.hiddenMobile ? "hidden sm:block" : "";

  if (block.type === "hero") {
    const image = block.data?.imageUrl || heroFallback;
    const heading = String(block.data?.heading || "").trim();
    const overlay = Math.max(0, Math.min(90, Number(block.design.overlay || 0))) / 100;
    return (
      <section
        className={`relative overflow-hidden ${hiddenMobileClass}`}
        style={{ ...sectionStyle(block), minHeight: preview ? 460 : "78vh" }}
      >
        {image && (
          <img
            src={image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: block.design.imagePosition || "center" }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `rgba(0,0,0,${overlay})` }}
        />
        <div
          className={`relative flex min-h-[460px] flex-col justify-center ${alignClass(
            block.design.alignment
          )}`}
          style={containerStyle(block)}
        >
          {block.data?.eyebrow && (
            <p className="mb-4 text-sm font-bold uppercase tracking-[0.22em] opacity-90">
              {block.data.eyebrow}
            </p>
          )}
          {heading ? (
            <Heading block={block} className="max-w-4xl">
              {heading}
            </Heading>
          ) : block.data?.showLogo !== false ? (
            site.brand.logoUrl ? (
              <img
                src={site.brand.logoUrl}
                alt={site.brand.logoAlt || site.brand.name}
                className="mb-5 max-h-40 w-auto max-w-[80%] object-contain"
              />
            ) : (
              <Heading block={block} className="max-w-4xl">
                {site.brand.name}
              </Heading>
            )
          ) : null}
          {block.data?.description && (
            <p className="mt-5 max-w-2xl text-base leading-7 opacity-95 md:text-lg">
              {block.data.description}
            </p>
          )}
          <div className="mt-7 flex flex-wrap gap-3">
            {block.data?.primaryButton?.label && (
              <SmartLink
                link={block.data.primaryButton}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-black text-slate-900 shadow-lg transition hover:-translate-y-0.5"
              />
            )}
            {block.data?.secondaryButton?.label && (
              <SmartLink
                link={block.data.secondaryButton}
                className="inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white/10 px-6 py-3 font-black text-white backdrop-blur transition hover:bg-white/20"
              />
            )}
          </div>
        </div>
      </section>
    );
  }

  if (block.type === "features") {
    const icons = [Leaf, Truck, GraduationCap, Heart];
    const items = Array.isArray(block.data?.items) ? block.data.items : [];
    return (
      <section className={hiddenMobileClass} style={sectionStyle(block)}>
        <div style={containerStyle(block)}>
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${Math.max(
                1,
                Math.min(6, Number(block.design.columns || 4))
              )}, minmax(0, 1fr))`,
              gap: `${Math.max(0, Number(block.design.gap || 24))}px`,
            }}
          >
            {items.map((item: any, index: number) => {
              const Icon = icons[index % icons.length];
              return (
                <div
                  key={index}
                  className={`flex flex-col ${alignClass(block.design.alignment)}`}
                >
                  <div
                    className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{ backgroundColor: `${block.design.accentColor}18`, color: block.design.accentColor }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-black">{item?.title}</h3>
                  <p className="mt-1 text-sm opacity-70">{item?.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (block.type === "categories") {
    const items = Array.isArray(block.data?.items) ? block.data.items : [];
    return (
      <section className={hiddenMobileClass} style={sectionStyle(block)}>
        <div style={containerStyle(block)}>
          <div className={`mb-8 flex flex-col ${alignClass(block.design.alignment)}`}>
            <Heading block={block}>{block.data?.heading || "Categorías"}</Heading>
            {block.data?.description && (
              <p className="mt-3 max-w-2xl opacity-70">{block.data.description}</p>
            )}
          </div>
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${Math.max(
                1,
                Math.min(6, Number(block.design.columns || 4))
              )}, minmax(0, 1fr))`,
              gap: `${Math.max(0, Number(block.design.gap || 24))}px`,
            }}
          >
            {items.map((item: any, index: number) => (
              <SmartLink
                key={index}
                link={{ label: "", href: item?.href || "/" }}
                className="group overflow-hidden border border-black/5 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div
                  className="overflow-hidden"
                  style={{ borderRadius: `${Math.max(0, Number(block.design.radius || 0))}px ${Math.max(
                    0,
                    Number(block.design.radius || 0)
                  )}px 0 0` }}
                >
                  <div className="h-48 bg-slate-100">
                    {item?.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item?.name || ""}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3 p-4 text-slate-900">
                    <span className="font-black">{item?.name}</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </SmartLink>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (block.type === "cta") {
    const image = block.data?.imageUrl || ctaFallback;
    const overlay = Math.max(0, Math.min(90, Number(block.design.overlay || 0))) / 100;
    return (
      <section className={`relative overflow-hidden ${hiddenMobileClass}`} style={sectionStyle(block)}>
        {image && (
          <img
            src={image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: block.design.imagePosition || "center" }}
          />
        )}
        <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${overlay})` }} />
        <div
          className={`relative flex flex-col ${alignClass(block.design.alignment)}`}
          style={containerStyle(block)}
        >
          <Heading block={block} className="max-w-4xl">
            {block.data?.title}
          </Heading>
          {block.data?.subtitle && (
            <p className="mt-4 max-w-2xl text-lg opacity-95">{block.data.subtitle}</p>
          )}
          {block.data?.button?.label && (
            <SmartLink
              link={block.data.button}
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-black text-slate-900 shadow-lg"
            />
          )}
        </div>
      </section>
    );
  }

  if (block.type === "textImage") {
    const imageFirst = block.data?.imageSide === "left";
    return (
      <section className={hiddenMobileClass} style={sectionStyle(block)}>
        <div
          className="grid items-center gap-8 md:grid-cols-2"
          style={containerStyle(block)}
        >
          <div className={imageFirst ? "md:order-2" : ""}>
            {block.data?.eyebrow && (
              <p className="mb-3 text-xs font-black uppercase tracking-[0.2em]" style={{ color: block.design.accentColor }}>
                {block.data.eyebrow}
              </p>
            )}
            <Heading block={block}>{block.data?.heading}</Heading>
            <p className="mt-4 leading-7 opacity-75">{block.data?.text}</p>
            {block.data?.button?.label && (
              <SmartLink
                link={block.data.button}
                className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 font-black text-white"
              >
                <span
                  className="rounded-xl px-5 py-3"
                  style={{ backgroundColor: block.design.accentColor }}
                >
                  {block.data.button.label}
                </span>
              </SmartLink>
            )}
          </div>
          <div className={imageFirst ? "md:order-1" : ""}>
            <div
              className="overflow-hidden bg-slate-100"
              style={{ borderRadius: `${Math.max(0, Number(block.design.radius || 0))}px` }}
            >
              {block.data?.imageUrl && (
                <img src={block.data.imageUrl} alt="" className="h-[380px] w-full object-cover" />
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (block.type === "gallery") {
    const images = Array.isArray(block.data?.images) ? block.data.images : [];
    return (
      <section className={hiddenMobileClass} style={sectionStyle(block)}>
        <div style={containerStyle(block)}>
          <div className={`mb-8 flex flex-col ${alignClass(block.design.alignment)}`}>
            <Heading block={block}>{block.data?.heading}</Heading>
            {block.data?.description && <p className="mt-3 max-w-2xl opacity-70">{block.data.description}</p>}
          </div>
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, Math.min(6, Number(block.design.columns || 3)))}, minmax(0, 1fr))`,
              gap: `${Math.max(0, Number(block.design.gap || 24))}px`,
            }}
          >
            {images.map((item: any, index: number) => (
              <div key={index} className="overflow-hidden bg-slate-100" style={{ borderRadius: `${block.design.radius}px` }}>
                {item?.url && <img src={item.url} alt={item?.alt || ""} className="h-64 w-full object-cover" />}
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (block.type === "testimonials") {
    const items = Array.isArray(block.data?.items) ? block.data.items : [];
    return (
      <section className={hiddenMobileClass} style={sectionStyle(block)}>
        <div style={containerStyle(block)}>
          <div className={`mb-8 flex flex-col ${alignClass(block.design.alignment)}`}>
            <Heading block={block}>{block.data?.heading}</Heading>
            {block.data?.description && <p className="mt-3 max-w-2xl opacity-70">{block.data.description}</p>}
          </div>
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, Math.min(4, Number(block.design.columns || 3)))}, minmax(0, 1fr))`,
              gap: `${Math.max(0, Number(block.design.gap || 24))}px`,
            }}
          >
            {items.map((item: any, index: number) => (
              <blockquote
                key={index}
                className="border border-black/5 bg-white p-6 text-slate-900 shadow-sm"
                style={{ borderRadius: `${block.design.radius}px` }}
              >
                <div className="mb-3 text-amber-500">
                  {"★".repeat(Math.max(1, Math.min(5, Number(item?.rating || 5))))}
                </div>
                <p className="leading-7">“{item?.text}”</p>
                <footer className="mt-4 font-black">— {item?.name}</footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return null;
}
