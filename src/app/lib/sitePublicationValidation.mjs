import { isValidPublicationWindow } from "./publicationSchedule.mjs";

/** Restrict links published by administrative editors to safe navigational schemes. */
export function isSafeStorefrontHref(href) {
  if (typeof href !== "string") return false;
  const url = href.trim();
  if (!url) return true; // Optional/disabled buttons may have no destination.
  if (/[^\S\r\n]*[\u0000-\u001f]/.test(url)) return false;
  if (url.startsWith("//") || url.startsWith("\\\\")) return false;
  const scheme = url.match(/^([a-z][a-z\d+.-]*):/i);
  if (scheme) return ["http", "https", "mailto", "tel", "sms"].includes(scheme[1].toLowerCase());
  return url.startsWith("/") || url.startsWith("#") || url.startsWith("?") || !url.includes(":");
}

export function validateSitePublication(site) {
  const problems = [];
  const checkHref = (path, entry) => {
    const href = typeof entry === "string" ? entry : entry?.href;
    if (href !== undefined && !isSafeStorefrontHref(href)) {
      problems.push(`${path}: destino no permitido`);
    }
    if (entry && typeof entry === "object" && !isValidPublicationWindow(entry.schedule)) {
      problems.push(`${path}: fechas de publicación inválidas o sin zona horaria`);
    }
    if (entry && typeof entry === "object" && Array.isArray(entry.children)) {
      entry.children.forEach((child, index) => checkHref(`${path}.subenlace.${index + 1}`, child));
    }
  };
  const checkArray = (path, items) => {
    if (Array.isArray(items)) items.forEach((item, index) => checkHref(`${path}.${index + 1}`, item));
  };
  const nav = site?.navigation || {};
  for (const [key, value] of Object.entries(nav)) checkHref(`Navegación.${key}`, value);
  const header = site?.headerActions || {};
  checkHref("Cuenta", header.profileHref);
  checkHref("Carrito", header.cartHref);
  checkHref("Portada.botonPrincipal", site?.hero?.primaryButton);
  checkHref("Portada.botonSecundario", site?.hero?.secondaryButton);
  checkHref("BannerInferior.boton", site?.cta?.button);
  checkArray("Footer.productos", site?.footer?.productLinks);
  checkArray("Footer.servicios", site?.footer?.serviceLinks);

  const market = site?.marketExperience || {};
  checkArray("Menú principal", market.navigation);
  checkArray("Categorías", market.home?.categories);
  checkArray("Servicios", market.home?.services);
  checkArray("Beneficios", market.home?.trust);
  checkHref("Banner Dulce", market.dulce);
  checkHref("Banner Moda", market.moda);

  const controls = market.componentControls || {};
  for (const [key, control] of Object.entries(controls)) {
    if (!isValidPublicationWindow(control?.schedule)) {
      problems.push(`Componente ${key}: fechas de publicación inválidas o sin zona horaria`);
    }
  }
  return problems;
}
