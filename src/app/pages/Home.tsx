import { useEffect, useMemo, useState } from "react";
import logo from "figma:asset/8c5f2b4f88c45fd4812e5bb91610bff5272333d7.png";
import ctaBackground from "figma:asset/d5382b123a27fa7c9d1abc7d1b3ca1c479f8df01.png";
import { backendStorage } from "../lib/backendStorage";
import {
  defaultSiteContent,
  ensureBuilderBlocks,
  parseSiteContent,
  SiteContent,
} from "../lib/siteContent";
import { StorefrontBlock } from "../components/site/StorefrontBlock";

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

export function Home() {
  const [site, setSite] = useState<SiteContent>(defaultSiteContent);
  const [legacyHero, setLegacyHero] = useState("");
  const [legacyCta, setLegacyCta] = useState("");
  const [marketing, setMarketing] = useState<any>({});

  useEffect(() => {
    const loadContent = () => {
      setSite(parseSiteContent(backendStorage.getItem("siteContent")));
      setLegacyHero(readBannerUrl("heroBanner"));
      setLegacyCta(readBannerUrl("ctaBanner"));
      try { setMarketing(JSON.parse(backendStorage.getItem("marketingContent") || "{}")); } catch { setMarketing({}); }
    };

    loadContent();
    window.addEventListener("storage", loadContent);
    window.addEventListener("backend-storage", loadContent);
    return () => {
      window.removeEventListener("storage", loadContent);
      window.removeEventListener("backend-storage", loadContent);
    };
  }, []);

  const blocks = useMemo(() => {
    const base = ensureBuilderBlocks(site);
    if (!marketing?.abTest?.enabled) return base;
    let bucket = "A";
    try {
      const existing = localStorage.getItem("herencia_ab_bucket");
      if (existing === "A" || existing === "B") bucket = existing;
      else {
        const allocationB = Math.max(0, Math.min(100, Number(marketing.abTest.allocationB || 50)));
        bucket = Math.random() * 100 < allocationB ? "B" : "A";
        localStorage.setItem("herencia_ab_bucket", bucket);
      }
    } catch {}
    const variant = bucket === "B" ? marketing.abTest.variantB : marketing.abTest.variantA;
    return base.map((block) => block.type !== "hero" ? block : ({
      ...block,
      data: {
        ...block.data,
        eyebrow: variant?.eyebrow || block.data?.eyebrow,
        description: variant?.description || block.data?.description,
        primaryButton: {
          ...(block.data?.primaryButton || {}),
          label: variant?.primaryLabel || block.data?.primaryButton?.label,
        },
      },
    }));
  }, [site, marketing]);

  return (
    <div className="builder-page-container">
      {blocks.map((block) => (
        <StorefrontBlock
          key={block.id}
          block={block}
          site={site}
          heroFallback={legacyHero || DEFAULT_HERO}
          ctaFallback={legacyCta || ctaBackground}
          logoFallback={logo}
        />
      ))}
    </div>
  );
}
