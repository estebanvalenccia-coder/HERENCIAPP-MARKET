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
