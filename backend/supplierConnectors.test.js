import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import {
  SUPPLIER_INTEGRATIONS,
  normalizeSupplierIntegrationType,
  supplierIntegrationType,
  normalizeSupplierConnectorKey,
  resolveSupplierWebhookConnector,
  connectorVerificationFingerprint,
  supplierConnectorReadiness,
} from "./supplierConnectors.js";

const env = {
  SUPPLIER_CONNECTOR_VIVERO_NORTE_URL: "https://suppliers.example.net/herencia/orders",
  SUPPLIER_CONNECTOR_VIVERO_NORTE_TOKEN: "test-secret-strong-random-token",
  SUPPLIER_CONNECTOR_OTRO_URL: "https://other.example.com/fulfill",
  SUPPLIER_CONNECTOR_OTRO_TOKEN: "different-test-token",
  SUPPLIER_AUTOPILOT_WEBHOOK_URL: "https://legacy.example.com/orders",
  SUPPLIER_AUTOPILOT_WEBHOOK_TOKEN: "old-global-test-token",
  CJ_API_KEY: "configured-but-not-shared",
};

test("new providers are not tied to CJ or DSers and default safely to manual", () => {
  assert.deepEqual(Object.keys(SUPPLIER_INTEGRATIONS).sort(), ["api","cj","csv","manual","webhook"]);
  assert.equal(normalizeSupplierIntegrationType("CSV"), "csv");
  assert.equal(normalizeSupplierIntegrationType("unknown"), "manual");
  assert.equal(supplierIntegrationType({ sourceHost: "viverolocal.es" }), "manual");
  assert.equal(supplierIntegrationType({ sourceHost: "cjdropshipping.com" }), "cj");
  assert.equal(supplierIntegrationType({ integrationType: "api", sourceHost: "aliexpress.com" }), "api");
});

test("provider connector keys are strictly controlled and URLs cannot come from suppliers", () => {
  assert.equal(normalizeSupplierConnectorKey("vivero_norte"), "VIVERO_NORTE");
  assert.equal(normalizeSupplierConnectorKey("../../etc"), "");
  assert.equal(normalizeSupplierConnectorKey(""), "");
  assert.equal(resolveSupplierWebhookConnector({
    integrationType: "webhook", connectorKey: "VIVERO_NORTE",
    webhookUrl: "https://evil.example.org", apiToken: "forged",
  }, env).url, env.SUPPLIER_CONNECTOR_VIVERO_NORTE_URL);
  assert.equal(resolveSupplierWebhookConnector({ integrationType: "webhook", connectorKey: "OTRO" }, env).token, env.SUPPLIER_CONNECTOR_OTRO_TOKEN);
  assert.equal(resolveSupplierWebhookConnector({ integrationType: "manual", connectorKey: "VIVERO_NORTE" }, env).configured, false);
});

test("non-HTTPS or internal endpoints cannot be used as provider automation", () => {
  for (const url of ["http://suppliers.example.net/orders", "https://127.0.0.1/test", "https://localhost/test", "https://internal.local/test", "https://user:pass@api.example.net/test", "https://[::1]/test"]) {
    const bad = { ...env, SUPPLIER_CONNECTOR_VIVERO_NORTE_URL: url };
    assert.equal(resolveSupplierWebhookConnector({ integrationType: "webhook", connectorKey: "VIVERO_NORTE" }, bad).configured, false, url);
  }
});

test("manual CSV and unknown external API never become connected by naming a provider", () => {
  for (const type of ["manual", "csv", "api"]) {
    const status = supplierConnectorReadiness({ integrationType: type, connectorKey: "VIVERO_NORTE" }, env, crypto.createHash);
    assert.equal(status.automaticOrders, false, type);
  }
  assert.equal(supplierConnectorReadiness({ integrationType: "cj" }, env, crypto.createHash).automaticOrders, false);
});

test("new webhook requires successful non-order verification against exact env config", () => {
  const supplier = { integrationType: "webhook", connectorKey: "VIVERO_NORTE" };
  assert.equal(supplierConnectorReadiness(supplier, env, crypto.createHash).state, "test_required");
  const connector = resolveSupplierWebhookConnector(supplier, env);
  const verified = { ...supplier, connectorVerifiedAt: "2026-10-09T13:00:00Z",
    connectorVerifiedFingerprint: connectorVerificationFingerprint(connector, crypto.createHash) };
  assert.equal(supplierConnectorReadiness(verified, env, crypto.createHash).state, "ready");
  assert.equal(supplierConnectorReadiness(verified, env, crypto.createHash).automaticOrders, true);
  assert.equal(supplierConnectorReadiness(verified, { ...env, SUPPLIER_CONNECTOR_VIVERO_NORTE_TOKEN: "rotated-token" }, crypto.createHash).automaticOrders, false);
  assert.equal(supplierConnectorReadiness({ ...verified, connectorKey: "OTRO" }, env, crypto.createHash).automaticOrders, false);
});

test("legacy global webhook remains supported only for explicit legacy webhook records", () => {
  const legacy = { integrationType: "webhook" };
  assert.equal(resolveSupplierWebhookConnector(legacy, env).legacy, true);
  assert.equal(supplierConnectorReadiness(legacy, env, crypto.createHash).automaticOrders, true);
  assert.equal(supplierConnectorReadiness({ integrationType: "manual" }, env, crypto.createHash).automaticOrders, false);
});

test("admin and backend have a verification handshake and independently scoped tokens", () => {
  const code = readFileSync(new URL("./server.js", import.meta.url), "utf8");
  const admin = readFileSync(new URL("../src/app/components/admin/AdminSuppliersPanel.tsx", import.meta.url), "utf8");
  assert.match(code, /supplier\.connector\.test/);
  assert.match(code, /connectorVerificationFingerprint/);
  assert.match(code, /supplierConnectorAuthorized\(req, connector\.token\)/);
  assert.match(code, /connectorKey: integrationType === "webhook"/);
  assert.match(admin, /Probar conector/);
  assert.match(admin, /API personalizada/);
  assert.match(admin, /CSV \/ archivos/);
});
