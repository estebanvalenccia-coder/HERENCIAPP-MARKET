import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("productos físicos usan entrega y servicios usan reserva sin envío", async () => {
  const cart = await read("src/app/pages/Cart.tsx");
  const checkout = await read("src/app/pages/Checkout.tsx");
  const server = await read("backend/server.js");

  assert.match(cart, /hasPhysicalItems\s*\?\s*shippingCost\s*:\s*0/);
  assert.match(cart, /No se aplican gastos de envío a los servicios/);
  assert.match(checkout, /onlyServices\s*\?\s*["']servicio["']\s*:\s*["']envio["']/);
  assert.match(checkout, /const shipping\s*=\s*hasPhysicalItems\s*\?\s*shippingCost\s*:\s*0/);
  assert.match(server, /solo ofrece entrega a domicilio/);
});

test("los términos usan EUR y no USD", async () => {
  const terms = await read("src/app/pages/Terms.tsx");
  assert.match(terms, /EUR|€|euros?/i);
  assert.doesNotMatch(terms, /USD/);
});

test("las rutas legales públicas siguen disponibles", async () => {
  const app = await read("src/app/routes.tsx");
  assert.match(app, /privacidad/);
  assert.match(app, /cookies/);
  assert.match(app, /terminos/);
});

test("la web pública no invita a visitar una tienda física", async () => {
  const content = await read("src/app/lib/siteContent.ts");
  assert.doesNotMatch(content, /Visítanos/);
});

test("el origen privado de reparto no está hardcodeado", async () => {
  const maps = await read("backend/fixMapsShipping.js");
  assert.match(maps, /process\.env\.STORE_ADDRESS/);
  assert.doesNotMatch(maps, /Riera de Cassoles/i);
});

test("pedidos no muestra confirmar en tienda", async () => {
  const orders = await read("src/app/components/admin/AdminOrders.tsx");
  assert.doesNotMatch(orders, /Confirmar en tienda/);
});

test("no quedan credenciales admin de desarrollo hardcodeadas", async () => {
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

test("la firma de sesión admin usa comparación timing-safe", async () => {
  const server = await read("backend/server.js");
  assert.match(server, /crypto\.timingSafeEqual\(receivedBuffer, expectedBuffer\)/);
  assert.match(server, /receivedBuffer\.length\s*!==\s*expectedBuffer\.length/);
  assert.doesNotMatch(server, /if\s*\(\s*signature\s*!==\s*sign\(payload\)\s*\)/);
});

test("2FA TOTP está cableado sin exponer el secreto", async () => {
  const server = await read("backend/server.js");
  assert.match(server, /ADMIN_TOTP_SECRET/);
  assert.match(server, /totpRequired/);
  assert.match(server, /verifyAdminTotp/);
  assert.doesNotMatch(server, /totpSecret\s*:/);
});

test("cabeceras de seguridad del frontend están configuradas", async () => {
  const config = JSON.parse(await read("vercel.json"));
  const serialized = JSON.stringify(config);
  assert.match(serialized, /Content-Security-Policy/);
  assert.match(serialized, /Strict-Transport-Security/);
  assert.match(serialized, /X-Content-Type-Options/);
});
