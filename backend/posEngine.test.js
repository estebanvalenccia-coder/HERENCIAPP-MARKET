import test from "node:test";
import assert from "node:assert/strict";
import {
  calculatePosTotals,
  nextPosDocumentNumber,
  normalizePaymentMethod,
  paymentStatusForMethod,
  validateAndApplyStock,
} from "./posEngine.js";

const products = [
  { id: 1, name: "Ramo", price: 10, iva: 21, stock: 5, active: true, sku: "RAM-1", category: "Ramos" },
  { id: 2, name: "Rosa", price: 2.5, iva: 10, stock: 10, active: true, sku: "ROS-1", category: "Flores" },
];

test("venta ficticia descuenta stock y calcula totales", () => {
  const result = validateAndApplyStock(products, [
    { id: 1, quantity: 2 },
    { id: 2, quantity: 3 },
  ]);
  assert.equal(result.items.length, 2);
  assert.equal(result.updatedProducts[0].stock, 3);
  assert.equal(result.updatedProducts[1].stock, 7);
  assert.equal(result.totals.total, 27.5);
  assert.equal(result.totals.subtotal > 0, true);
  assert.equal(result.totals.tax > 0, true);
});


test("permite artículo manual sin descontar stock", () => {
  const result = validateAndApplyStock(products, [
    { id: "manual-test-1", name: "Artículo", price: 4, iva: 21, quantity: 1, manual: true },
  ]);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].manual, true);
  assert.equal(result.items[0].name, "Artículo");
  assert.equal(result.items[0].price, 4);
  assert.equal(result.totals.total, 4);
  assert.equal(result.updatedProducts[0].stock, 5);
  assert.equal(result.updatedProducts[1].stock, 10);
});

test("rechaza artículo manual con importe inválido", () => {
  assert.throws(
    () => validateAndApplyStock(products, [
      { id: "manual-test-2", name: "Artículo", price: 0, iva: 21, quantity: 1, manual: true },
    ]),
    /importe válido/
  );
});

test("no permite vender por encima del stock", () => {
  assert.throws(
    () => validateAndApplyStock(products, [{ id: 1, quantity: 6 }]),
    /Stock insuficiente/
  );
});

test("efectivo calcula cambio real", () => {
  const totals = calculatePosTotals([{ price: 12, iva: 21, quantity: 2 }], 30);
  assert.equal(totals.total, 24);
  assert.equal(totals.change, 6);
});

test("métodos de pago mapean a estados operativos", () => {
  assert.equal(normalizePaymentMethod("Efectivo"), "cash");
  assert.equal(normalizePaymentMethod("Tarjeta"), "card");
  assert.equal(paymentStatusForMethod("Efectivo"), "paid");
  assert.equal(paymentStatusForMethod("Tarjeta"), "payment_pending");
  assert.equal(paymentStatusForMethod("Bizum"), "pending_bizum_review");
  assert.equal(paymentStatusForMethod("Transferencia"), "pending_transfer_review");
});

test("numeración de ticket y factura", () => {
  assert.equal(nextPosDocumentNumber("ticket", 2026, 12), "TIC-2026-000012");
  assert.equal(nextPosDocumentNumber("invoice", 2026, 12), "FAC-2026-000012");
});
