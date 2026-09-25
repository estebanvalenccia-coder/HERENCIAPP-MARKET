import { Link } from "react-router";
import { ArrowRight, Heart, Leaf, Truck, GraduationCap } from "lucide-react";
import type { BuilderBlock, SiteContent, SiteLink } from "../../lib/siteContent";
import { isExternalHref } from "../../lib/siteContent";
import { backendStorage } from "../../lib/backendStorage";
import { products as fallbackProducts } from "../../data/products";

function SmartLink({
  link,
  className,
  children,
  style,
}: {
  link?: SiteLink;
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const candidate = String(link?.href || "/").trim();
  const href = /^(\/|https?:\/\/|mailto:|tel:)/i.test(candidate) && !candidate.startsWith("//") ? candidate : "/";
  const label = link?.label || children;

  if (isExternalHref(href)) {
    return (
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel="noopener noreferrer"
        className={className}
        style={style}
      >
        {label}{link?.showIcon && <ArrowRight aria-hidden="true" className="h-4 w-4" />}
      </a>
    );
  }

  return (
    <Link to={href} className={className} style={style}>
      {label}{link?.showIcon && <ArrowRight aria-hidden="true" className="h-4 w-4" />}
    </Link>
  );
}

function buttonDestination(button: any): string | null {
  const value = String(button?.href || "").trim();
  switch (button?.action) {
    case "cart": return "/carrito";
    case "checkout": return "/checkout";
    case "product": return value ? `/producto/${encodeURIComponent(value)}` : null;
    case "category": return value ? `/productos?categoria=${encodeURIComponent(value)}` : null;
    case "service": return value.startsWith("/servicios") ? value : "/servicios";
    case "whatsapp": { const digits = value.replace(/\D/g, ""); return digits ? `https://wa.me/${digits}` : null; }
    case "email": return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? `mailto:${value}` : null;
    case "phone": { const phone = value.replace(/[^+\d]/g, ""); return phone ? `tel:${phone}` : null; }
    case "url": return /^https?:\/\/[^\s]+$/i.test(value) ? value : null;
    case "page": return value.startsWith("/") && !value.startsWith("//") ? value : null;
    default: return null;
  }
}

function customButtonStyle(button: any): React.CSSProperties {
  const color = (value: unknown, fallback: string) => /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
  const limit = (value: unknown, fallback: number, min: number, max: number) => Math.min(max, Math.max(min, Number(value) || fallback));
  return {
    backgroundColor: color(button.background, "#315f47"),
    color: color(button.color, "#ffffff"),
    "--button-hover-bg": color(button.hoverBackground, "#234c36"),
    fontSize: `${limit(button.fontSize, 14, 12, 32)}px`,
    fontFamily: ["Georgia, serif", "Arial, sans-serif", "Inter, system-ui, sans-serif"].includes(button.fontFamily) ? button.fontFamily : undefined,
    padding: `${limit(button.paddingY, 12, 4, 32)}px ${limit(button.paddingX, 20, 8, 64)}px`,
    borderRadius: `${limit(button.radius, 0, 0, 40)}px`,
  } as React.CSSProperties;
}

function sectionStyle(block: BuilderBlock): React.CSSProperties {
  const design = block.design;
  return {
    backgroundColor: design.backgroundColor || undefined,
    color: design.textColor || undefined,
    fontFamily: design.fontFamily && design.fontFamily !== "inherit" ? design.fontFamily : undefined,
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
    "--builder-tablet-columns": Math.max(1, Math.min(4, Number(block.design.columnsTablet ?? 2))),
    "--builder-mobile-columns": Math.max(1, Math.min(2, Number(block.design.columnsMobile ?? 1))),
  } as React.CSSProperties;
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
  onCommit,
}: {
  children: React.ReactNode;
  block: BuilderBlock;
  className?: string;
  onCommit?: (value: string) => void;
}) {
  const scale = Math.max(70, Math.min(180, Number(block.design.headingScale || 100))) / 100;
  return (
    <h2
      className={`font-serif font-black leading-tight ${className}`}
      contentEditable={Boolean(onCommit)}
      suppressContentEditableWarning
      spellCheck={Boolean(onCommit)}
      title={onCommit ? "Haz clic para editar el título" : undefined}
      onKeyDown={onCommit ? (event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } } : undefined}
      onBlur={onCommit ? (event) => { const next = event.currentTarget.textContent?.trim() || ""; if (next !== String(children || "").trim()) onCommit(next); } : undefined}
      style={{
        fontSize: `${2 * scale}rem`,
        fontFamily:
          block.design.fontFamily && block.design.fontFamily !== "inherit"
            ? block.design.fontFamily
            : undefined,
      }}
    >
      {children}
    </h2>
  );
}

function EditableParagraph({ value, className, onCommit }: { value: string; className: string; onCommit?: (value: string) => void }) {
  return <p className={className} contentEditable={Boolean(onCommit)} suppressContentEditableWarning spellCheck={Boolean(onCommit)} title={onCommit ? "Haz clic para editar este texto" : undefined} onBlur={onCommit ? (event) => { const next = event.currentTarget.textContent?.trim() || ""; if (next !== value.trim()) onCommit(next); } : undefined}>{value}</p>;
}

export function StorefrontBlock({
  block,
  site,
  heroFallback = "",
  ctaFallback = "",
  logoFallback = "",
  preview = false,
  onEditField,
}: {
  block: BuilderBlock;
  site: SiteContent;
  heroFallback?: string;
  ctaFallback?: string;
  logoFallback?: string;
  preview?: boolean;
  onEditField?: (key: string, value: string) => void;
}) {
  if (!block.visible) return null;
  const hiddenMobileClass = block.design.hiddenMobile ? "hidden sm:block" : "";

  if (block.type === "elements") {
    const elements = Array.isArray(block.data?.elements) ? block.data.elements : [];
    const clamp = (value: unknown, fallback: number, min: number, max: number) => Math.max(min, Math.min(max, Number(value) || fallback));
    return <section className={hiddenMobileClass} style={sectionStyle(block)}><div style={containerStyle(block)}>
      {elements.map((element: any, index: number) => {
        const type = String(element.type || "text");
        const url = String(element.url || "").trim();
        const safeImage = /^(https?:\/\/[^\s]+|\/(?!\/)[^\s]*|data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+)$/i.test(url);
        const color = /^#[0-9a-f]{6}$/i.test(String(element.color || "")) ? element.color : undefined;
        const style: React.CSSProperties = { marginBottom: clamp(element.marginBottom, 16, 0, 100), color, textAlign: ["left", "center", "right"].includes(element.align) ? element.align : "left", fontSize: clamp(element.fontSize, 20, 12, 72), fontWeight: element.bold ? 700 : undefined };
        const visibility = `builder-element ${element.desktop === false ? "builder-hide-desktop" : ""} ${element.tablet === false ? "builder-hide-tablet" : ""} ${element.mobile === false ? "builder-hide-mobile" : ""}`;
        let content: React.ReactNode;
        if (type === "separator") content = <hr className="border-slate-200" />;
        else if (type === "spacer") content = <div style={{ height: clamp(element.height, 32, 8, 200) }} />;
        else if (type === "image") content = safeImage ? <img src={url} alt={String(element.alt || "")} loading="lazy" className="w-full rounded-lg object-cover" style={{ height: clamp(element.height, 300, 80, 700) }} /> : null;
        else if (type === "title") content = <h2 className="font-serif leading-tight">{String(element.text || "")}</h2>;
        else if (type === "subtitle") content = <h3 className="font-semibold">{String(element.text || "")}</h3>;
        else if (type === "card") content = <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">{String(element.text || "")}</div>;
        else content = <p className="whitespace-pre-wrap">{String(element.text || "")}</p>;
        return <div key={element.id || index} className={visibility} style={style}>{content}</div>;
      })}
    </div></section>;
  }

  if (block.type === "buttons") {
    const buttons = Array.isArray(block.data?.buttons) ? block.data.buttons : [];
    return <section className={hiddenMobileClass} style={sectionStyle(block)}><div style={containerStyle(block)}>
      {block.data?.heading && <Heading block={block} onCommit={preview && onEditField ? (value) => onEditField("heading", value) : undefined}>{block.data.heading}</Heading>}
      <div className={`mt-5 flex flex-wrap gap-3 ${block.design.alignment === "center" ? "justify-center" : block.design.alignment === "right" ? "justify-end" : "justify-start"}`}>
        {buttons.filter((button: any) => button.visible !== false && button.label && buttonDestination(button)).map((button: any) => <SmartLink key={button.id} link={{ label: String(button.label), href: buttonDestination(button)!, showIcon: button.showIcon }} style={customButtonStyle(button)} className="builder-custom-button inline-flex items-center gap-2 border border-black/10 font-semibold transition" />)}
      </div>
    </div></section>;
  }

  if (block.type === "hero") {
    const image = block.data?.imageUrl || heroFallback;
    const heading = String(block.data?.heading || "").trim();
    const overlay = Math.max(0, Math.min(90, Number(block.design.overlay || 0))) / 100;
    return (
      <section
        className={`relative overflow-hidden ${hiddenMobileClass}`}
        style={{
          ...sectionStyle(block),
          minHeight: `${Math.max(360, Number(block.design.minHeight || (preview ? 460 : 650)))}px`,
        }}
      >
        {image && (
          <img
            src={image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              objectPosition: block.design.imagePosition || "center",
              transform: `scale(${Math.max(100, Number(block.design.imageZoom || 100)) / 100})`,
            }}
          />
        )}
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `rgba(0,0,0,${overlay})` }}
        />
        <div
          className={`relative flex flex-col justify-center ${alignClass(
            block.design.alignment
          )}`}
          style={{
            ...containerStyle(block),
            minHeight: `${Math.max(360, Number(block.design.minHeight || (preview ? 460 : 650)))}px`,
          }}
        >
          {block.data?.eyebrow && (
            <EditableParagraph className="mb-4 text-sm font-bold uppercase tracking-[0.22em] opacity-90" value={block.data.eyebrow} onCommit={preview && onEditField ? (value) => onEditField("eyebrow", value) : undefined} />
          )}
          {heading ? (
            <Heading block={block} className="max-w-4xl" onCommit={preview && onEditField ? (value) => onEditField("heading", value) : undefined}>
              {heading}
            </Heading>
          ) : block.data?.showLogo !== false ? (
            site.brand.logoUrl || logoFallback ? (
              <img
                src={site.brand.logoUrl || logoFallback}
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
            <EditableParagraph className="mt-5 max-w-2xl text-base leading-7 opacity-95 md:text-lg" value={block.data.description} onCommit={preview && onEditField ? (value) => onEditField("description", value) : undefined} />
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

  if (block.type === "services" || block.type === "products") {
    const services = [
      { title: site.servicesPage.gardeningHeading, description: site.servicesPage.gardeningDescription, image: site.categories[0]?.imageUrl, href: "/servicios?tipo=jardineria" },
      { title: site.servicesPage.coursesHeading, description: site.servicesPage.coursesDescription, image: site.categories[1]?.imageUrl, href: "/servicios?tipo=cursos" },
      { title: site.servicesPage.deliveryHeading, description: site.servicesPage.deliveryDescription, image: site.categories[2]?.imageUrl, href: "/servicios?tipo=entrega" },
      { title: site.servicesPage.advisoryHeading, description: site.servicesPage.advisoryDescription, image: site.categories[3]?.imageUrl, href: "/servicios?tipo=asesoria" },
    ];
    let catalog = fallbackProducts;
    try {
      const saved = backendStorage.getItem("adminProducts");
      if (saved) { const parsed = JSON.parse(saved); if (Array.isArray(parsed)) catalog = parsed; }
    } catch { /* Use the public catalog already bundled with the shop. */ }
    const items = block.type === "products" ? catalog.filter((product: any) => product.active !== false && (product.featured || catalog.length < 5)).slice(0, 4).map((product: any) => ({ title: product.name, description: Number(product.price || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" }), image: product.image, href: `/producto/${encodeURIComponent(String(product.id))}` })) : services;
    return <section className={hiddenMobileClass} style={sectionStyle(block)}><div style={containerStyle(block)}>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><Heading block={block} onCommit={preview && onEditField ? (value) => onEditField("heading", value) : undefined}>{block.data?.heading}</Heading>{block.data?.description && <EditableParagraph className="mt-2 text-sm opacity-70" value={block.data.description} onCommit={preview && onEditField ? (value) => onEditField("description", value) : undefined} />}</div>{block.data?.button?.label && <SmartLink link={block.data.button} className="rounded-xl border border-current px-4 py-2 text-sm font-semibold" />}</div>
      <div className="builder-grid grid" style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(6, Number(block.design.columns || 4)))}, minmax(0, 1fr))`, gap: `${Math.max(0, Number(block.design.gap || 24))}px` }}>
        {items.map((item, index) => <Link key={`${item.href}-${index}`} to={item.href} className="group overflow-hidden border border-black/5 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg" style={{ borderRadius: block.design.radius }}>
          {item.image ? <img src={item.image} alt="" className="h-44 w-full object-cover" /> : <div className="h-44 w-full bg-emerald-50" />}
          <div className="p-4"><h3 className="font-semibold text-slate-900">{item.title}</h3><p className="mt-1 line-clamp-2 text-sm text-slate-600">{item.description}</p></div>
        </Link>)}
      </div>
      {!items.length && <p className="rounded-xl bg-white p-6 text-sm text-slate-600">No hay productos destacados disponibles.</p>}
    </div></section>;
  }

  if (block.type === "features") {
    const icons = [Leaf, Truck, GraduationCap, Heart];
    const items = Array.isArray(block.data?.items) ? block.data.items : [];
    return (
      <section className={hiddenMobileClass} style={sectionStyle(block)}>
        <div style={containerStyle(block)}>
          <div
            className="builder-grid grid"
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
            <Heading block={block} onCommit={preview && onEditField ? (value) => onEditField("heading", value) : undefined}>{block.data?.heading || "Categorías"}</Heading>
            {block.data?.description && (
              <EditableParagraph className="mt-3 max-w-2xl opacity-70" value={block.data.description} onCommit={preview && onEditField ? (value) => onEditField("description", value) : undefined} />
            )}
          </div>
          <div
            className="builder-grid grid"
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
            style={{
              objectPosition: block.design.imagePosition || "center",
              transform: `scale(${Math.max(100, Number(block.design.imageZoom || 100)) / 100})`,
            }}
          />
        )}
        <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${overlay})` }} />
        <div
          className={`relative flex flex-col ${alignClass(block.design.alignment)}`}
          style={containerStyle(block)}
        >
          <Heading block={block} className="max-w-4xl" onCommit={preview && onEditField ? (value) => onEditField("title", value) : undefined}>
            {block.data?.title}
          </Heading>
          {block.data?.subtitle && (
            <EditableParagraph className="mt-4 max-w-2xl text-lg opacity-95" value={block.data.subtitle} onCommit={preview && onEditField ? (value) => onEditField("subtitle", value) : undefined} />
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
            <Heading block={block} onCommit={preview && onEditField ? (value) => onEditField("heading", value) : undefined}>{block.data?.heading}</Heading>
            <EditableParagraph className="mt-4 leading-7 opacity-75" value={block.data?.text || ""} onCommit={preview && onEditField ? (value) => onEditField("text", value) : undefined} />
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
                <img src={block.data.imageUrl} alt={block.data.imageAlt || ""} className="h-[380px] w-full" style={{ objectFit: ["cover", "contain", "fill"].includes(block.data.imageFit) ? block.data.imageFit : "cover", objectPosition: block.design.imagePosition || "center", transform: `scale(${Math.max(100, Number(block.design.imageZoom || 100)) / 100})` }} />
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
            <Heading block={block} onCommit={preview && onEditField ? (value) => onEditField("heading", value) : undefined}>{block.data?.heading}</Heading>
            {block.data?.description && <EditableParagraph className="mt-3 max-w-2xl opacity-70" value={block.data.description} onCommit={preview && onEditField ? (value) => onEditField("description", value) : undefined} />}
          </div>
          <div
            className="builder-grid grid"
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
            <Heading block={block} onCommit={preview && onEditField ? (value) => onEditField("heading", value) : undefined}>{block.data?.heading}</Heading>
            {block.data?.description && <EditableParagraph className="mt-3 max-w-2xl opacity-70" value={block.data.description} onCommit={preview && onEditField ? (value) => onEditField("description", value) : undefined} />}
          </div>
          <div
            className="builder-grid grid"
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
