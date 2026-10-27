import { buildGoogleShoppingFeed } from "../backend/googleShoppingFeed.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }
  try {
    const response = await fetch("https://herenciapp-market-production.up.railway.app/api/commerce/products?status=active", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Catalog API returned " + response.status);
    const data = await response.json();
    if (!Array.isArray(data.products)) throw new Error("Missing products list");
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=900");
    return res.status(200).send(buildGoogleShoppingFeed(data.products));
  } catch (error) {
    console.error("Merchant feed unavailable:", error);
    return res.status(503).type("text/plain").send("Catálogo temporalmente no disponible");
  }
}
