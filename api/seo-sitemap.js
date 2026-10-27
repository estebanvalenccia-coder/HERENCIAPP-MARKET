const BASE = "https://www.herenciamarket.es";
const routes = ["/", "/productos", "/servicios", "/crear-ramo", "/nosotros", "/faq", "/contacto", "/politica-de-devoluciones", "/terminos", "/privacidad"];
const escapeXml = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  let urls = [...routes];
  try {
    const response = await fetch("https://herenciapp-market-production.up.railway.app/api/commerce/products?status=active", {
      signal: AbortSignal.timeout(12000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Products unavailable");
    const json = await response.json();
    if (!Array.isArray(json.products)) throw new Error("Invalid catalog");
    const active = json.products.filter(p => p && p.id != null && !p.deletedAt && p.active !== false &&
      String(p.status || "active") === "active" && !["servicios", "dulce", "moda"].includes(String(p.collection || "").toLowerCase()));
    urls.push(...active.map(p => "/producto/" + encodeURIComponent(String(p.id))));
  } catch (error) {
    console.error("Sitemap products temporarily unavailable", error?.message || error);
  }
  urls = [...new Set(urls)];
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(path => '  <url><loc>' + escapeXml(BASE + path) + '</loc></url>').join("\n") + '\n</urlset>';
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=1800");
  return res.status(200).send(xml);
}
