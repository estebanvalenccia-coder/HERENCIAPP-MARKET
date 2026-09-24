import { Link } from "react-router";
import { useEffect, useState } from "react";
import { Leaf, Truck, GraduationCap, Heart, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import logo from "figma:asset/8c5f2b4f88c45fd4812e5bb91610bff5272333d7.png";
import ctaBackground from "figma:asset/d5382b123a27fa7c9d1abc7d1b3ca1c479f8df01.png";
import { backendStorage } from "../lib/backendStorage";
import { defaultSiteContent, isExternalHref, parseSiteContent, SiteContent } from "../lib/siteContent";

const DEFAULT_HERO =
  "https://images.unsplash.com/photo-1760618511409-9d80f26e36f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1920";

function readBannerUrl(key: "heroBanner" | "ctaBanner") {
  try {
    const raw = backendStorage.getItem(key);
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return String(parsed?.imageUrl || "").trim();
  } catch {
    const raw = backendStorage.getItem(key);
    return String(raw || "").startsWith("data:image/") ? String(raw) : "";
  }
}

function SmartLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const target = String(href || "/").trim() || "/";
  if (isExternalHref(target)) {
    return (
      <a href={target} target={target.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return <Link to={target} className={className}>{children}</Link>;
}

export function Home() {
  const [site, setSite] = useState<SiteContent>(defaultSiteContent);
  const [legacyHero, setLegacyHero] = useState("");
  const [legacyCta, setLegacyCta] = useState("");

  useEffect(() => {
    const loadContent = () => {
      setSite(parseSiteContent(backendStorage.getItem("siteContent")));
      setLegacyHero(readBannerUrl("heroBanner"));
      setLegacyCta(readBannerUrl("ctaBanner"));
    };

    loadContent();
    window.addEventListener("storage", loadContent);
    window.addEventListener("backend-storage", loadContent);
    return () => {
      window.removeEventListener("storage", loadContent);
      window.removeEventListener("backend-storage", loadContent);
    };
  }, []);

  const featureIcons = [Leaf, Truck, GraduationCap, Heart];
  const heroImage = legacyHero || site.hero.imageUrl || DEFAULT_HERO;
  const ctaImage = legacyCta || site.cta.imageUrl || ctaBackground;
  const logoSrc = site.brand.logoUrl || logo;

  return (
    <div>
      <section className="relative h-[90vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImage} alt={site.brand.logoAlt || site.brand.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-transparent" />
        </div>

        <div className="relative mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="max-w-2xl">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-sm text-muted-foreground tracking-wide">{site.hero.eyebrow}</span>
            </div>
            <div className="mb-6">
              <img src={logoSrc} alt={site.brand.logoAlt || site.brand.name} className="h-32 md:h-40 w-auto" />
            </div>
            <p className="text-lg text-muted-foreground mb-8 max-w-lg">{site.hero.description}</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <SmartLink href={site.hero.primaryButton.href} className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all hover:scale-105">
                {site.hero.primaryButton.label}<ArrowRight className="w-4 h-4" />
              </SmartLink>
              <SmartLink href={site.hero.secondaryButton.href} className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-border bg-card text-foreground rounded-xl hover:bg-accent transition-all">
                {site.hero.secondaryButton.label}
              </SmartLink>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-muted/30">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {site.features.map((feature, index) => {
              const Icon = featureIcons[index] || Leaf;
              return (
                <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }} className="text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 text-primary rounded-2xl mb-4"><Icon className="w-6 h-6" /></div>
                  <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{site.categoriesHeading}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">{site.categoriesDescription}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {site.categories.map((category, index) => (
              <motion.div key={index} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }} whileHover={{ scale: 1.05 }}>
                <SmartLink href={category.href} className="group block">
                  <div className="relative h-64 rounded-2xl overflow-hidden mb-4">
                    <img src={category.imageUrl} alt={category.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4"><h3 className="text-white font-semibold text-lg">{category.name}</h3></div>
                  </div>
                </SmartLink>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0">
          <img src={ctaImage} alt="Fondo natural" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-primary/50 via-primary/40 to-primary/60" />
        </div>
        <div className="relative mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl text-center">
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-white" style={{ textShadow: "0 4px 8px rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.3), 2px 2px 0 rgba(45,95,63,0.8), 4px 4px 0 rgba(45,95,63,0.6)", letterSpacing: "-0.02em" }}>
              {site.cta.title}
            </h2>
            <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto text-white font-medium" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.3), 1px 1px 0 rgba(45,95,63,0.7)" }}>
              {site.cta.subtitle}
            </p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <SmartLink href={site.cta.button.href} className="inline-flex items-center gap-2 px-10 py-5 bg-white text-primary rounded-xl hover:bg-white/95 transition-all shadow-2xl font-semibold text-lg">
                {site.cta.button.label}<ArrowRight className="w-5 h-5" />
              </SmartLink>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
