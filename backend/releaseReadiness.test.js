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


test("las sesiones web usan cookies same-origin compatibles", async () => {
  const [server, gateway] = await Promise.all([
    read("backend/server.js"),
    read("backend/neonGateway.js"),
  ]);
  assert.match(server, /SameSite=Lax/);
  assert.doesNotMatch(server, /SameSite=\$\{\s*isProduction\s*\?\s*"None"/);
  assert.doesNotMatch(gateway, /SameSite=None/);
});


test("TPV y checkout leen el catálogo autoritativo", async () => {
  const server = await read("backend/server.js");
  assert.match(server, /async function loadAuthoritativeProducts/);
  assert.match(server, /async function loadPosBootstrap\(\)[\s\S]*loadAuthoritativeProducts\(\)/);
  assert.match(server, /app\.post\("\/api\/stripe\/create-payment-intent"[\s\S]*const catalog = await loadAuthoritativeProducts\(\)/);
});

test("el origen privado de reparto no se devuelve al navegador", async () => {
  const maps = await read("backend/fixMapsShipping.js");
  const quoteStart = maps.indexOf("export async function calculateShippingQuote");
  assert.ok(quoteStart >= 0);
  const quoteSource = maps.slice(quoteStart);
  assert.doesNotMatch(quoteSource, /origin:\s*result\.origin/);
});

test("inventario por ubicación no presenta una tienda física por defecto", async () => {
  const [server, admin] = await Promise.all([
    read("backend/server.js"),
    read("src/app/components/admin/AdminInventoryLocations.tsx"),
  ]);
  assert.match(server, /Almacén principal/);
  assert.match(admin, /Almacén principal/);
  assert.doesNotMatch(admin, /name:"Tienda"/);
});


test("el origen privado de reparto no está hardcodeado", async () => {
  const maps = await read("backend/fixMapsShipping.js");
  assert.doesNotMatch(maps, /Riera de Cassoles/i);
  assert.match(maps, /STORE_ADDRESS/);
});

test("Administración no muestra confirmar en tienda", async () => {
  const orders = await read("src/app/components/admin/AdminOrders.tsx");
  assert.doesNotMatch(orders, /Confirmar en tienda/i);
});


test("el admin soporta 2FA TOTP opcional sin exponer el secreto", async () => {
  const server = await read("backend/server.js");
  assert.match(server, /\/api\/admin\/auth-config/);
  assert.match(server, /ADMIN_TOTP_SECRET/);
  assert.match(server, /totpRequired/);
  assert.doesNotMatch(server, /res\.json\([^\n]*ADMIN_TOTP_SECRET/);
});


test("Vercel aplica cabeceras de seguridad al frontend", async () => {
  const vercel = JSON.parse(await read("vercel.json"));
  const headers = Array.isArray(vercel.headers) ? vercel.headers.flatMap((entry) => entry.headers || []) : [];
  const byKey = new Map(headers.map((entry) => [String(entry.key || "").toLowerCase(), String(entry.value || "")]));
  assert.equal(byKey.get("x-content-type-options"), "nosniff");
  assert.equal(byKey.get("x-frame-options"), "DENY");
  assert.match(byKey.get("content-security-policy") || "", /default-src 'self'/);
  assert.match(byKey.get("content-security-policy") || "", /js\.stripe\.com/);
});


test("el backend no contiene credenciales administrativas por defecto", async () => {
  const server = await read("backend/server.js");
  assert.doesNotMatch(server, /13101098/);
  assert.doesNotMatch(server, /dev-only-change-me/);
  assert.doesNotMatch(server, /ADMIN_USERNAME \|\| \(!isProduction/);
});


test("el email interno no se fuerza desde el código", async () => {
  const emailPatch = await read("backend/fixAdminEmail.js");
  assert.doesNotMatch(emailPatch, /process\.env\.ADMIN_ORDER_EMAIL\s*=\s*["']/);
  assert.doesNotMatch(emailPatch, /herenciafloristeria@gmail\.com/);
});
