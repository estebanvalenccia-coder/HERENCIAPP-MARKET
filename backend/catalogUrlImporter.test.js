import test from "node:test";
import assert from "node:assert/strict";
import {
  extractCatalogCandidates,
  guessCatalogTaxonomy,
  assertSafeExternalUrl,
  extractProductGalleryImages,
  productDetailsFromHtml,
  extractMarketplaceGalleryImages,
  normalizeSupplierHost,
  isSupplierChallengeName,
  supportsManualCatalogFallback,
  analyzeCatalogUrl,
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

test("no mezcla productos relacionados dentro de la galería real", () => {
  const html = [
    '<div class="woocommerce-product-gallery__image"><a href="/media/zanahoria-grande.jpg"><img src="/media/zanahoria.jpg" data-large_image="/media/zanahoria-grande.jpg"></a></div>',
    '<section class="related products"><img class="attachment-woocommerce_thumbnail" src="/media/lavanda.jpg"></section>',
  ].join("");

  const images = extractProductGalleryImages(html, "https://semillasbatlle.com/producto/zanahoria/");
  assert.deepEqual(images, ["https://semillasbatlle.com/media/zanahoria-grande.jpg"]);
  assert.equal(images.some((url) => url.includes("lavanda")), false);
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


test("extrae precio y moneda estructurados del proveedor", () => {
  const html = [
    '<script type="application/ld+json">',
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Maceta autorregable",
      image: ["https://proveedor.es/maceta.jpg"],
      offers: {
        "@type": "Offer",
        price: "8.95",
        priceCurrency: "EUR"
      }
    }),
    "</script>",
  ].join("");

  const product = productDetailsFromHtml(html, "https://proveedor.es/producto/maceta", {});
  assert.equal(product.name, "Maceta autorregable");
  assert.equal(product.supplierPrice, 8.95);
  assert.equal(product.supplierCurrency, "EUR");
});


test("normaliza subdominios regionales de AliExpress, Alibaba y 1688 sin afectar otros proveedores", () => {
  assert.equal(normalizeSupplierHost("es.aliexpress.com"), "aliexpress.com");
  assert.equal(normalizeSupplierHost("www.aliexpress.com"), "aliexpress.com");
  assert.equal(normalizeSupplierHost("spanish.alibaba.com"), "alibaba.com");
  assert.equal(normalizeSupplierHost("m.1688.com"), "1688.com");
  assert.equal(normalizeSupplierHost("semillasbatlle.com"), "semillasbatlle.com");
  assert.equal(normalizeSupplierHost("evilaliexpress.com"), "evilaliexpress.com");
});

test("no convierte errores de seguridad o de URL mal formada en importaciones manuales", () => {
  assert.equal(supportsManualCatalogFallback({ statusCode: 400 }), false);
  assert.equal(supportsManualCatalogFallback({ statusCode: 401 }), false);
  assert.equal(supportsManualCatalogFallback({ statusCode: 502 }), true);
  assert.equal(supportsManualCatalogFallback({ statusCode: 504 }), true);
  assert.equal(supportsManualCatalogFallback({ statusCode: 422 }), true);
});

test("un bucle de redirecciones de AliExpress ofrece borrador manual y no HTTP 502", async (t) => {
  const dns = await import("node:dns/promises");
  t.mock.method(dns.default, "lookup", async () => [{ address: "93.184.216.34", family: 4 }]);
  t.mock.method(globalThis, "fetch", async () =>
    new Response("", { status: 302, headers: { location: "https://www.aliexpress.com/item/1005000000000.html" } }));
  const result = await analyzeCatalogUrl("https://es.aliexpress.com/item/1005000000000.html", { maxProducts: 1 });
  assert.equal(result.ok, true);
  assert.equal(result.requiresManual, true);
  assert.equal(result.sourceHost, "aliexpress.com");
  assert.deepEqual(result.products, []);
  assert.match(result.message, /rediri|borrador/i);
});

test("un producto con JSON-LD en una web pública se importa automáticamente", async (t) => {
  const dns = await import("node:dns/promises");
  t.mock.method(dns.default, "lookup", async () => [{ address: "93.184.216.34", family: 4 }]);
  const html = '<html><script type="application/ld+json">' + JSON.stringify({
    "@type": "Product", name: "Maceta de prueba", image: ["https://cdn.example.com/maceta.jpg"],
    offers: { price: "8.90", priceCurrency: "EUR" }
  }) + '</script></html>';
  t.mock.method(globalThis, "fetch", async () =>
    new Response(html, { status: 200, headers: { "content-type": "text/html" } }));
  const result = await analyzeCatalogUrl("https://spanish.alibaba.com/product-detail/example.html", { maxProducts: 1 });
  assert.equal(result.requiresManual, undefined);
  assert.equal(result.sourceHost, "alibaba.com");
  assert.equal(result.products[0].name, "Maceta de prueba");
  assert.equal(result.products[0].supplierPrice, 8.9);
});

test("un enlace a una red privada sigue bloqueado", async () => {
  await assert.rejects(() => analyzeCatalogUrl("http://127.0.0.1/item/1234"), /redes privadas/i);
});

test("rechaza nombres de página de verificación aunque incluyan la marca del proveedor", () => {
  for (const name of ["Human verification", "Human verification - AliExpress", "Human machine check", "Just a moment...", "Checking your browser - Alibaba", "Access denied: captcha"]) {
    assert.equal(isSupplierChallengeName(name), true, name);
  }
  assert.equal(isSupplierChallengeName("Kit de riego con verificación de humedad"), false);
});

test("una verificación que incorpora JSON-LD falso no llega a importarse", async (t) => {
  const dns = await import("node:dns/promises");
  t.mock.method(dns.default, "lookup", async () => [{ address: "93.184.216.34", family: 4 }]);
  const html = '<html><head><title>Human verification - AliExpress</title></head><body>' +
    '<h1>Human machine check</h1><script type="application/ld+json">' +
    JSON.stringify({ "@type": "Product", name: "Producto falso", image: ["https://cdn.example.com/captcha.png"] }) +
    '</script></body></html>';
  t.mock.method(globalThis, "fetch", async () =>
    new Response(html, { status: 200, headers: { "content-type": "text/html" } }));
  const result = await analyzeCatalogUrl("https://es.aliexpress.com/item/1005000000000.html", { maxProducts: 1 });
  assert.equal(result.requiresManual, true);
  assert.equal(result.products.length, 0);
});

test("no considera una ficha sin imágenes como importación automática exitosa", async (t) => {
  const dns = await import("node:dns/promises");
  t.mock.method(dns.default, "lookup", async () => [{ address: "93.184.216.34", family: 4 }]);
  const html = '<html><script type="application/ld+json">' +
    JSON.stringify({ "@type": "Product", name: "Maceta sin foto", offers: { price: 8.9 } }) +
    '</script></html>';
  t.mock.method(globalThis, "fetch", async () =>
    new Response(html, { status: 200, headers: { "content-type": "text/html" } }));
  const result = await analyzeCatalogUrl("https://spanish.alibaba.com/product-detail/no-image.html", { maxProducts: 1 });
  assert.equal(result.requiresManual, true);
  assert.deepEqual(result.products, []);
  assert.match(result.message, /fotografías|imagen/i);
});

test("un sitio con script de captcha pero producto JSON-LD válido conserva importación", async (t) => {
  const dns = await import("node:dns/promises");
  t.mock.method(dns.default, "lookup", async () => [{ address: "93.184.216.34", family: 4 }]);
  const html = '<html><script>var captchaEnabled=true</script><script type="application/ld+json">' +
    JSON.stringify({ "@type": "Product", name: "Maceta con foto", image: ["https://cdn.example.com/maceta.jpg"] }) +
    '</script></html>';
  t.mock.method(globalThis, "fetch", async () =>
    new Response(html, { status: 200, headers: { "content-type": "text/html" } }));
  const result = await analyzeCatalogUrl("https://spanish.alibaba.com/product-detail/with-image.html", { maxProducts: 1 });
  assert.equal(result.requiresManual, undefined);
  assert.equal(result.products[0].name, "Maceta con foto");
});

test("extrae las fotografías reales de imagePathList en un AliExpress público", async (t) => {
  const dns = await import("node:dns/promises");
  t.mock.method(dns.default, "lookup", async () => [{ address: "93.184.216.34", family: 4 }]);
  const gallery = ["//ae01.alicdn.com/kf/base-1.jpg", "https://ae01.alicdn.com/kf/base-2.webp"];
  const html = '<html><h1>Base de plantas</h1><script>window.runParams={"imagePathList":' +
    JSON.stringify(gallery) + '}</script></html>';
  t.mock.method(globalThis, "fetch", async () =>
    new Response(html, { status: 200, headers: { "content-type": "text/html" } }));
  assert.equal(extractMarketplaceGalleryImages(html, "https://es.aliexpress.com/item/1005000000000.html").length, 2);
  const result = await analyzeCatalogUrl("https://es.aliexpress.com/item/1005000000000.html", { maxProducts: 1 });
  assert.equal(result.requiresManual, undefined);
  assert.equal(result.products[0].name, "Base de plantas");
  assert.equal(result.products[0].images.length, 2);
});

test("la galería embebida no acepta logos externos ni imágenes en otros dominios", () => {
  const html = '<script>window.runParams={"imagePathList":' +
    JSON.stringify(["https://not-marketplace.example/logo.jpg", "//ae01.alicdn.com/kf/garden.jpg"]) + '}</script>';
  const valid = extractMarketplaceGalleryImages(html, "https://www.aliexpress.com/item/1005000000000.html");
  assert.deepEqual(valid, ["https://ae01.alicdn.com/kf/garden.jpg"]);
  assert.deepEqual(extractMarketplaceGalleryImages(html, "https://semillasbatlle.com/producto/base"), []);
});
