import test from "node:test";
import assert from "node:assert/strict";
import {
  contentRevision,
  planSiteContentPublication,
  SitePublicationConflict,
} from "./siteContentPublication.js";

const base = JSON.stringify({
  hero: { primaryButton: { label: "Plantas", href: "/productos" } },
  footer: { privacyHref: "/privacidad", termsHref: "/terminos", cookiesHref: "/cookies" },
});
const updated = JSON.stringify({
  hero: { primaryButton: { label: "Regalos", href: "/productos?coleccion=regalos" } },
  footer: { privacyHref: "/privacidad", termsHref: "/terminos", cookiesHref: "/cookies" },
});

test("revision is deterministic, including for empty initial content", () => {
  assert.equal(contentRevision(base), contentRevision(base));
  assert.notEqual(contentRevision(base), contentRevision(updated));
  assert.equal(contentRevision(null), contentRevision(""));
});

test("publishing creates a limited restorable history and new revision", () => {
  const now = new Date("2026-10-27T12:00:00Z");
  const plan = planSiteContentPublication({
    before: base, expectedRaw: base, nextRaw: updated, historyRaw: "[]",
    actor: "administrador", now,
    auxiliary: { heroBanner: JSON.stringify({ imageUrl: "https://example.com/banner.png" }) },
  });
  assert.equal(plan.content, updated);
  assert.equal(plan.draft, updated);
  assert.equal(plan.revision, contentRevision(updated));
  assert.equal(plan.versionCount, 1);
  assert.equal(JSON.parse(plan.history)[0].content, base);
  assert.equal(plan.auxiliary.heroBanner, '{"imageUrl":"https://example.com/banner.png"}');
});

test("simultaneous stale publishers get a conflict without overwriting", () => {
  assert.throws(
    () => planSiteContentPublication({ before: updated, expectedRaw: base, nextRaw: updated }),
    SitePublicationConflict
  );
  assert.throws(
    () => planSiteContentPublication({ before: base, expectedRaw: null, nextRaw: updated }),
    /contenido publicado ha cambiado/
  );
});

test("validations protect sensitive settings and invalid links", () => {
  assert.throws(
    () => planSiteContentPublication({ before: base, expectedRaw: base, nextRaw: JSON.stringify({ hero: { primaryButton: { href: "javascript:alert(1)" } } }) }),
    /No se puede publicar/
  );
  assert.throws(
    () => planSiteContentPublication({ before: base, expectedRaw: base, nextRaw: updated, auxiliary: { apiKey: "secret" } }),
    /Configuración adicional no válida/
  );
  assert.throws(
    () => planSiteContentPublication({ before: base, expectedRaw: base, nextRaw: "not JSON" }),
    /JSON válido/
  );
});

test("first publication works without initial content", () => {
  const plan = planSiteContentPublication({ before: null, expectedRaw: null, nextRaw: base });
  assert.equal(plan.versionCount, 0);
  assert.equal(plan.history, "[]");
});

test("limits history count", () => {
  const versions = Array.from({length: 20}, (_, i) => ({
    id: String(i), at: "2026-10-27T12:00:00Z", label: "Old", content: updated,
  }));
  const plan = planSiteContentPublication({
    before: base, expectedRaw: base, nextRaw: updated, historyRaw: JSON.stringify(versions),
  });
  assert.equal(plan.versionCount, 12);
});
