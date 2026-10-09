import test from "node:test";
import assert from "node:assert/strict";
import {
  DSERS_PRODUCT_HEADERS,
  createDsersProductCsv,
  dsersRowsForProducts,
  isAliExpressProduct,
} from "../src/app/lib/dsersCsv.js";

const aliexpress = (id, sku, extra = {}) => ({
  id, sku, name: "Maceta",
  status: "draft",
  metadata: {
    importedFromUrl: true,
    sourceHost: "es.aliexpress.com",
    sourceProductUrl: "https://es.aliexpress.com/item/1005000000000.html",
    ...extra.metadata,
  },
  ...extra,
});

test("DSers headers match the merchant's actual import_products.xlsx template", () => {
  assert.deepEqual(DSERS_PRODUCT_HEADERS, [
    "product_id",
    "SKU（your product SKU）",
    "Supplier_url（Optional）",
    "SKU（Supplier SKU）（Optional）",
  ]);
});

test("export uses merchant product ID and exact store SKU without inventing supplier mapping", () => {
  const result = createDsersProductCsv([aliexpress("1791547528465", "HM-1791547528465")]);
  assert.equal(result.exported, 1);
  assert.equal(result.rows[0][0], "1791547528465");
  assert.equal(result.rows[0][1], "HM-1791547528465");
  assert.equal(result.rows[0][2], "https://es.aliexpress.com/item/1005000000000.html");
  assert.equal(result.rows[0][3], "");
  assert.ok(result.csv.startsWith("\uFEFFproduct_id,SKU（your product SKU）"));
  assert.ok(result.csv.endsWith("\r\n"));
});

test("an AliExpress draft with a missing SKU is not exported or silently assigned one", () => {
  const result = createDsersProductCsv([aliexpress("178", "")]);
  assert.equal(result.exported, 0);
  assert.match(result.skipped[0].reason, /Falta SKU/);
});

test("CJdropshipping, other vendors, archived products and malformed URL are excluded or unmapped", () => {
  const mixed = [
    aliexpress("1", "HM-1"),
    { id: "2", sku: "CJ-2", metadata: { sourceHost: "cjdropshipping.com", sourceProductUrl: "https://cjdropshipping.com/product-p-123.html" } },
    { id: "3", sku: "SEEDS-3", metadata: { sourceHost: "semillasbatlle.com" } },
    aliexpress("4", "HM-4", { status: "archived" }),
    aliexpress("5", "HM-5", { metadata: { sourceProductUrl: "https://aliexpress.com.evil.test/a" } }),
  ];
  const result = createDsersProductCsv(mixed);
  assert.deepEqual(result.rows.map(row => row[0]), ["1", "5"]);
  assert.equal(result.rows[1][2], "");
  assert.equal(isAliExpressProduct(mixed[1]), false);
});

test("variants export with their own store SKUs, not a single recycled supplier SKU", () => {
  const product = aliexpress("multi", "PARENT", {
    variants: [
      { sku: "VAR-S", supplierSku: "ALI-S" },
      { sku: "VAR-M" },
      { sku: "" },
    ],
    metadata: { supplierSku: "DO-NOT-REUSE" },
  });
  const result = createDsersProductCsv([product]);
  assert.equal(result.exported, 2);
  assert.deepEqual(result.rows.map(row => row[1]), ["VAR-S", "VAR-M"]);
  assert.deepEqual(result.rows.map(row => row[3]), ["ALI-S", ""]);
  assert.equal(result.skipped.length, 1);
});

test("duplicate or formula-like SKUs never produce ambiguous or dangerous CSV", () => {
  const result = dsersRowsForProducts([
    aliexpress("1", "DUP"),
    aliexpress("2", "dup"),
    aliexpress("3", "=HYPERLINK(\"https://evil.test\")"),
  ]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.skipped.length, 2);
  assert.match(result.skipped[0].reason, /duplicado/);
});
