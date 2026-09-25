import { useEffect, useMemo, useState } from "react";
import logo from "figma:asset/8c5f2b4f88c45fd4812e5bb91610bff5272333d7.png";
import ctaBackground from "figma:asset/d5382b123a27fa7c9d1abc7d1b3ca1c479f8df01.png";
import { backendStorage } from "../lib/backendStorage";
import {
  defaultSiteContent,
  ensureBuilderBlocks,
  readPreviewSiteContent,
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

  useEffect(() => {
    const loadContent = () => {
      setSite(readPreviewSiteContent(backendStorage.getItem("siteContent")));
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

  const blocks = useMemo(() => ensureBuilderBlocks(site), [site]);

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
