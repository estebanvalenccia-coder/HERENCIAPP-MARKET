import assert from "node:assert/strict";
import test from "node:test";
import { isMarketDestinationEnabled } from "../src/app/lib/marketCollectionVisibility.mjs";

const market = { dulce: { enabled: false }, moda: { enabled: true } };

test("desactivar Dulce oculta navegación, banners y enlaces a su colección", () => {
  for (const href of [
    "/dulce", "/dulce/", "/dulce?promo=1", "/productos?coleccion=dulce",
    "/productos?categoria=tartas&coleccion=dulce", "/productos?collection=dulce",
  ]) {
    assert.equal(isMarketDestinationEnabled(market, href), false, href);
  }
});

test("otras secciones siguen visibles mientras Dulce está desactivado", () => {
  for (const href of ["/", "/moda", "/productos?coleccion=plantas", "/servicios", "/contacto"]) {
    assert.equal(isMarketDestinationEnabled(market, href), true, href);
  }
});

test("la visibilidad de Moda es independiente y reversible", () => {
  assert.equal(isMarketDestinationEnabled({ dulce: { enabled: true }, moda: { enabled: false } }, "/moda"), false);
  assert.equal(isMarketDestinationEnabled({ dulce: { enabled: true }, moda: { enabled: false } }, "/dulce"), true);
  assert.equal(isMarketDestinationEnabled({ dulce: { enabled: true }, moda: { enabled: true } }, "/moda"), true);
});

test("se conserva el comportamiento anterior cuando el ajuste no está guardado", () => {
  assert.equal(isMarketDestinationEnabled({}, "/dulce"), true);
  assert.equal(isMarketDestinationEnabled({}, "/moda"), true);
});

test("no se ocultan enlaces externos ni se aplican coincidencias parciales", () => {
  assert.equal(isMarketDestinationEnabled(market, "https://example.com/dulce"), true);
  assert.equal(isMarketDestinationEnabled(market, "//example.com/dulce"), true);
  assert.equal(isMarketDestinationEnabled(market, "/dulceria"), true);
  assert.equal(isMarketDestinationEnabled(market, "/productos?coleccion=dulces"), true);
});
