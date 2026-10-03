import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("la tienda pública solo ofrece entrega a domicilio", async () => {
  const [cart, checkout, confirmed] = await Promise.all([
    read("src/app/pages/Cart.tsx"),
    read("src/app/pages/Checkout.tsx"),
    read("src/app/pages/OrderConfirmed.tsx"),
  ]);

  assert.doesNotMatch(cart, /option value=["']recoger["']/i);
  assert.match(checkout, /const deliveryMethod = ["']envio["']/);
  assert.doesNotMatch(confirmed, /entrega o recogida/i);
});

test("los textos legales usan euros", async () => {
  const terms = await read("src/app/pages/Terms.tsx");
  assert.doesNotMatch(terms, /dólares estadounidenses/i);
  assert.match(terms, /euros/i);
});

test("las páginas legales siguen registradas", async () => {
  const routes = await read("src/app/routes.tsx");
  assert.match(routes, /path:["']privacidad["']/);
  assert.match(routes, /path:["']cookies["']/);
  assert.match(routes, /path:["']terminos["']/);
});

test("el contacto público no invita a visitar un local", async () => {
  const content = await read("src/app/lib/siteContent.ts");
  assert.doesNotMatch(content, /Visítanos/i);
});


test("la tienda pública no usa catálogo de demostración", async () => {
  const files = await Promise.all([
    read("src/app/pages/Home.tsx"),
    read("src/app/pages/Products.tsx"),
    read("src/app/pages/ProductDetail.tsx"),
    read("src/app/pages/MarketCollections.tsx"),
    read("src/app/components/SalesChatWidget.tsx"),
  ]);
  for (const source of files) {
    assert.doesNotMatch(source, /fallbackProducts/);
    assert.doesNotMatch(source, /\.\.\/data\/products/);
  }
});

test("no se publican testimonios ficticios por defecto", async () => {
  const site = await read("src/app/lib/siteContent.ts");
  assert.doesNotMatch(site, /Cliente 1/);
  assert.doesNotMatch(site, /Una experiencia excelente/);
});

test("las páginas legales no contienen datos de plantilla", async () => {
  const [terms, privacy, cookies] = await Promise.all([
    read("src/app/pages/Terms.tsx"),
    read("src/app/pages/Privacy.tsx"),
    read("src/app/pages/Cookies.tsx"),
  ]);
  const joined = [terms, privacy, cookies].join("\n");
  assert.doesNotMatch(joined, /\+1 234 567 8900/);
  assert.doesNotMatch(joined, /\[Tu dirección física\]/);
  assert.doesNotMatch(joined, /Google Analytics - para análisis web/);
  assert.doesNotMatch(terms, /\$50/);
});
