import { Link } from "react-router";
import { ChevronDown } from "lucide-react";
import type { SiteLink } from "../lib/siteContent";
import { isWithinPublicationWindow } from "../lib/publicationSchedule.mjs";

export function MarketNavigationMenu({
  item,
  mobile = false,
  active = false,
  now,
}: {
  item: SiteLink;
  mobile?: boolean;
  active?: boolean;
  now: number;
}) {
  const links = (item.children || []).filter((child) =>
    child.visible !== false &&
    (mobile ? child.showMobile !== false : child.showDesktop !== false) &&
    isWithinPublicationWindow(child.schedule, now)
  );
  const baseClass = `inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition ${active ? "bg-[#eef2eb] text-[#244a35]" : "text-[#526158] hover:bg-[#f3f0e9] hover:text-[#244a35]"}`;
  if (links.length === 0) return <Link to={item.href} className={baseClass}>{item.label}</Link>;

  if (mobile) {
    return (
      <details className="relative shrink-0">
        <summary className={`list-none cursor-pointer ${baseClass}`} aria-label={`Abrir menú ${item.label}`}>
          {item.label} <ChevronDown className="h-3.5 w-3.5" />
        </summary>
        <div className="fixed left-4 right-4 top-[148px] z-[85] max-h-[calc(100vh-166px)] overflow-y-auto rounded-2xl border border-[#e4ded4] bg-[#fffdf9] p-2 shadow-xl">
          <Link to={item.href} className="block rounded-xl bg-[#edf4ee] px-3 py-2.5 text-sm font-black text-[#244a35]">Ver todos · {item.label}</Link>
          {links.map((link, index) => (
            <Link key={`${link.href}-${index}`} to={link.href} className="mt-1 block rounded-xl px-3 py-2.5 text-sm font-semibold text-[#244a35] hover:bg-[#eef2eb]">
              {link.label}
              {link.description ? <span className="block text-xs font-normal text-[#718076]">{link.description}</span> : null}
            </Link>
          ))}
        </div>
      </details>
    );
  }

  return (
    <div className="group relative shrink-0">
      <Link to={item.href} className={baseClass} aria-haspopup="true">
        {item.label} <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
      </Link>
      <div className="pointer-events-none absolute left-1/2 top-full z-[85] w-[400px] max-w-[90vw] -translate-x-1/2 pt-3 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-[#e4ded4] bg-[#fffdf9] p-3 shadow-[0_18px_55px_rgba(31,62,44,0.16)]">
          <div className="grid gap-1 sm:grid-cols-2">
            {links.map((link, index) => (
              <Link key={`${link.href}-${index}`} to={link.href} className="block rounded-xl px-3 py-2.5 transition hover:bg-[#eef2eb]">
                <span className="block text-sm font-black text-[#244a35]">{link.label}</span>
                {link.description ? <span className="mt-0.5 block text-xs text-[#718076]">{link.description}</span> : null}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
