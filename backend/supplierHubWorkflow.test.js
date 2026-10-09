import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ownR2MediaPathFromUrl } from "./r2Media.js";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("R2 accepts only an existing-media-shaped path on the exact configured HTTPS origin", () => {
  const base = "https://media.herenciamarket.es";
  assert.equal(ownR2MediaPathFromUrl("https://media.herenciamarket.es/builder/123-abc-planta.webp", base), "builder/123-abc-planta.webp");
  assert.equal(ownR2MediaPathFromUrl("https://media.herenciamarket.es/builder/123-abc-planta.webp?auth=1", base), "");
  assert.equal(ownR2MediaPathFromUrl("http://media.herenciamarket.es/builder/123-abc-planta.webp", base), "");
  assert.equal(ownR2MediaPathFromUrl("https://media.herenciamarket.es.evil.test/builder/123-abc-planta.webp", base), "");
  assert.equal(ownR2MediaPathFromUrl("https://media.herenciamarket.es/builder/%2E%2E%2Fsecret", base), "");
  assert.equal(ownR2MediaPathFromUrl("https://media.herenciamarket.es/other/123.webp", base), "");
});

test("browser-assisted import uploads photos using the authenticated media endpoint", () => {
  const uploader = read("src/app/components/admin/SupplierImportImages.tsx");
  assert.match(uploader, /backendApi\.uploadSiteMediaFile\(file\)/);
  assert.match(uploader, /onPaste=\{paste\}/);
  assert.match(uploader, /onDrop=\{drop\}/);
  assert.match(uploader, /Cada fotografía puede ocupar como máximo 8 MB/);
});

test("both supplier import views attach uploaded images before saving drafts", () => {
  const suppliers = read("src/app/components/admin/AdminSuppliersPanel.tsx");
  const bulk = read("src/app/components/admin/AdminBulkProductImport.tsx");
  assert.match(suppliers, /SupplierImportImages images=\{manualUploadedImages\}/);
  assert.match(suppliers, /\.\.\.manualUploadedImages/);
  assert.match(bulk, /SupplierImportImages images=\{sourceManualUploadedImages\}/);
  assert.match(bulk, /\.\.\.sourceManualUploadedImages/);
});

test("supplier list is collapsed by default and supports persistent hide, unlink and archive", () => {
  const panel = read("src/app/components/admin/AdminSuppliersPanel.tsx");
  assert.match(panel, /useState\(false\).*showImportedProducts|showImportedProducts, setShowImportedProducts\] = useState\(false\)/);
  assert.match(panel, /supplierHubHidden/);
  assert.match(panel, /"hide" \| "show" \| "unlink" \| "archive"/);
  assert.match(panel, /backendApi\.deleteCommerceProduct\(product\.id, false\)/);
  assert.match(panel, /supplierId: null/);
});

test("marketplace imports reuse verified R2 media and preserve safe external image downloads", () => {
  const importer = read("backend/catalogUrlImporter.js");
  assert.match(importer, /verifiedExistingR2Media\(unique\[index\]\)/);
  assert.match(importer, /safeFetch\(unique\[index\],/);
  assert.match(importer, /MAX_IMAGE_BYTES/);
});
