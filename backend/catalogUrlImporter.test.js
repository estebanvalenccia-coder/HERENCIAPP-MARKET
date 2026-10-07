import test from "node:test";
import assert from "node:assert/strict";
import {
  extractCatalogCandidates,
  guessCatalogTaxonomy,
  assertSafeExternalUrl,
} from "./catalogUrlImporter.js";

test("detecta productos enlazados en una categoría de proveedor", () => {
  const html = [
    '<section class="products">',
    '<h2><a href="/productosbatlle/semillas/semillas-horticolas/zanahoria-amsterdam/">Zanahoria Amsterdam</a></h2>',
    '<h2><a href="/productosbatlle/semillas/semillas-horticolas/tomate-cherry/">Tomate Cherry</a></h2>',
    "</section>",
  ].join("");

  const products = extractCatalogCandidates(
    html,
    "https://semillasbatlle.com/productos-batlle/semillas/semillas-horticolas/"
  );

  assert.equal(products.length, 2);
  assert.equal(products[0].name, "Zanahoria Amsterdam");
  assert.match(products[0].productUrl, /zanahoria-amsterdam/);
});

test("clasifica automáticamente semillas y sustratos en colecciones existentes", () => {
  const seed = guessCatalogTaxonomy(
    "https://semillasbatlle.com/productosbatlle/semillas/semillas-horticolas/tomate/",
    "Tomate"
  );
  const substrate = guessCatalogTaxonomy("https://proveedor.es/sustrato-universal", "Sustrato universal 20 L");

  assert.equal(seed.collection, "semillas");
  assert.equal(seed.category, "semillas-huerto");
  assert.equal(seed.area, "Hortícolas");
  assert.equal(substrate.collection, "sustratos");
  assert.equal(substrate.category, "tierra-universal");
});

test("usa subcategorías válidas para semillas, sustratos y jardinería", () => {
  assert.equal(
    guessCatalogTaxonomy("https://proveedor.es/semillas/aromaticas/albahaca", "Albahaca").category,
    "semillas-aromaticas"
  );
  assert.equal(
    guessCatalogTaxonomy("https://proveedor.es/sustratos/humus", "Humus de lombriz").category,
    "abonos"
  );
  assert.equal(
    guessCatalogTaxonomy("https://proveedor.es/jardineria/riego", "Regadera 2 L").category,
    "riego"
  );
});

test("bloquea destinos locales para evitar SSRF", async () => {
  await assert.rejects(() => assertSafeExternalUrl("http://127.0.0.1/admin"), /redes privadas/i);
  await assert.rejects(() => assertSafeExternalUrl("http://localhost/internal"), /no está permitido/i);
});
