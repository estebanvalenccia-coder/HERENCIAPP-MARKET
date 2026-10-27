import test from "node:test";
import assert from "node:assert/strict";
import { isSafeStorefrontHref, validateSitePublication } from "../src/app/lib/sitePublicationValidation.mjs";

test("allows conventional internal and external navigation", () => {
  for (const href of ["", "/", "/productos?coleccion=plantas", "#contacto", "?buscar=maceta",
    "https://herenciamarket.es", "http://localhost:3000/", "mailto:info@example.com", "tel:+34999999999", "sms:+34123456789"]) {
    assert.equal(isSafeStorefrontHref(href), true, href);
  }
});

test("rejects scripting schemes, protocol-relative and control characters", () => {
  for (const href of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,hello",
    "vbscript:msgbox(1)", "file:///etc/passwd", "//evil.example", "\u0001javascript:alert(1)", "https://safe\nunsafe"]) {
    assert.equal(isSafeStorefrontHref(href), false, JSON.stringify(href));
  }
});

test("validates nested menu links and scheduled component controls", () => {
  const config = {
    navigation: {},
    hero: { primaryButton: { href: "/productos" } },
    footer: { productLinks: [{ label: "Seguro", href: "/productos" }] },
    marketExperience: {
      navigation: [{ label: "Plantas", href: "/productos", children: [{ label: "Fraudulento", href: "javascript:evil()" }] }],
      componentControls: { "home.hero": { schedule: { startAt: "2026-10-27T11:00" } } },
    },
  };
  const errors = validateSitePublication(config);
  assert.ok(errors.some((value) => value.includes("Menú principal.1.subenlace.1")));
  assert.ok(errors.some((value) => value.includes("Componente home.hero")));
  assert.equal(validateSitePublication({ marketExperience: { navigation: [{ label: "Inicio", href: "/" }] } }).length, 0);
});

test("requires legal links when publishing configured footer", () => {
  const problems = validateSitePublication({ footer: {
    privacyHref: "", cookiesHref: "/cookies", termsHref: "/terminos",
  } });
  assert.ok(problems.some((message) => message.includes("Footer.privacyHref")));
  assert.equal(validateSitePublication({ footer: {
    privacyHref: "/privacidad", cookiesHref: "/cookies", termsHref: "/terminos",
  } }).length, 0);
});
