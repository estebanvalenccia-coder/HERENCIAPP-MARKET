/**
 * Public collection visibility is governed by the same switches as the Dulce
 * and Moda promotions. Content remains stored for editing in Administration.
 * Only internal storefront URLs are affected; external links stay untouched.
 */
export function isMarketDestinationEnabled(market, href) {
  const target = String(href || "").trim();
  if (!target.startsWith("/") || target.startsWith("//")) return true;

  const [rawPath, rawQuery = ""] = target.toLowerCase().split("?");
  const path = rawPath.split("#")[0].replace(/\/+$/, "") || "/";
  let kind = path === "/dulce" ? "dulce" : path === "/moda" ? "moda" : "";

  if (!kind && path === "/productos" && rawQuery) {
    const query = new URLSearchParams(rawQuery.split("#")[0]);
    const collection = query.get("coleccion") || query.get("collection");
    if (collection === "dulce" || collection === "moda") kind = collection;
  }

  return !kind || market?.[kind]?.enabled !== false;
}
