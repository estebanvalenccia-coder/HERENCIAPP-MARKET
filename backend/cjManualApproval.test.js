import test from "node:test";
import assert from "node:assert/strict";
import {
  cjConfirmation, cjManualOrderNumber, classifyCjOrderFunding,
  validateManualCjCreate, validateManualCjPayment, applyCjManualStage,
} from "./cjManualApproval.js";

const NOW = Date.parse("2026-10-09T12:00:00.000Z");
function fixtures() {
  const order = {
    id: "987de497-c30c-4ee7-8cdf-faf7355c8b3b",
    status: "paid", total: 50, payment_method: "stripe",
    metadata: { discount: 0, freeCouponOrder: false },
  };
  const supplier = {
    id: "supplier-cj", integrationType: "cj", active: true,
    cjSandbox: false, cjMaxPaymentUsd: 45, maxAutoOrderTotal: 80,
  };
  const record = {
    id: "26cdae3f-38a1-470b-b3b8-afd3f61a03d2",
    orderId: order.id, supplierId: supplier.id, provider: "cj",
    status: "approval_required", estimatedCost: 21.64, externalOrderId: "",
    shippingAddress: { name: "Cliente", address: "Calle 10", city: "Barcelona",
      province: "Barcelona", country: "ES", postalCode: "08032", phone: "600123456" },
    items: [{ productId: "item1", supplierVariantId: "VID1", supplierSku: "plant-green",
      cjPreferredLogisticCountry: "ES", cjPreferredLogisticName: "CJPacket",
      quantity: 1, salePrice: 50, supplierCost: 21.64,
      cjPricingEstimate: { available: true, feasible: true, checkedAt: "2026-10-09T11:40:00Z",
        vid: "VID1", destination: "ES", methodName: "CJPacket", salePriceEur: 50,
        supplierTotalUsd: 23.5, costEur: 21.64 } }],
  };
  return { order, record, supplier };
}

test("one paid CJ order can be reviewed for manual unpaid creation, with a capped USD estimate", () => {
  const setup=fixtures();
  const p=validateManualCjCreate({ ...setup, nowMs: NOW });
  assert.equal(p.estimatedPaymentUsd,23.5);
  assert.equal(p.estimatedCostEur,21.64);
  assert.equal(p.funding.funding,"customer_stripe");
  assert.equal(p.orderNumber,"HM-"+setup.order.id+"-26cdae3f");
  assert.equal(cjConfirmation("create",setup.order.id),"CREAR CJ 987de497");
  assert.equal(cjConfirmation("pay",setup.order.id),"PAGAR CJ 987de497");
});

test("100% coupon is store-funded, never proof of a Stripe charge", () => {
  const {order,supplier,record}=fixtures();
  order.total=0;
  order.payment_method="coupon";
  order.metadata={ freeCouponOrder:true,coupon:"TEST100",discount:50 };
  const p=validateManualCjCreate({order,supplier,record,nowMs:NOW});
  assert.equal(p.funding.freeCoupon,true);
  assert.equal(p.funding.storeFunded,true);
  assert.equal(p.funding.funding,"merchant_coupon");
});

test("zero customer amount without valid backend coupon must be rejected", () => {
  const {order,supplier,record}=fixtures();
  order.total=0;
  order.payment_method="coupon";
  assert.throws(()=>validateManualCjCreate({order,supplier,record,nowMs:NOW}),/promoción validada/);
});

test("CJ sandbox, stale quotes, wrong zip and variant mismatch block real creation", () => {
  const base=fixtures();
  assert.throws(()=>validateManualCjCreate({
    ...base,supplier:{...base.supplier,cjSandbox:true},nowMs:NOW
  }),/modo REAL/);
  assert.throws(()=>validateManualCjCreate({
    ...base,record:{...base.record,items:base.record.items.map(x=>({
      ...x,cjPricingEstimate:{...x.cjPricingEstimate,checkedAt:"2026-10-07T01:00:00Z"},
    }))},nowMs:NOW,
  }),/Cotización/);
  assert.throws(()=>validateManualCjCreate({
    ...base,record:{...base.record,shippingAddress:{...base.record.shippingAddress,postalCode:"wrong"}},nowMs:NOW,
  }),/código postal/);
  assert.throws(()=>validateManualCjCreate({
    ...base,record:{...base.record,items:base.record.items.map(x=>({...x,quantity:2}))},nowMs:NOW,
  }),/única unidad/);
});

test("CJ supplier budget blocks any unknown or excessive USD/EUR amounts", () => {
  const base=fixtures();
  assert.throws(()=>validateManualCjCreate({
    ...base,supplier:{...base.supplier,cjMaxPaymentUsd:20},nowMs:NOW,
  }),/supera el límite/);
  assert.throws(()=>validateManualCjCreate({
    ...base,supplier:{...base.supplier,maxAutoOrderTotal:0},nowMs:NOW,
  }),/presupuesto máximo/);
});

test("manual payment is distinct from unpaid creation and validates actual CJ price", () => {
  const base=fixtures();
  assert.throws(()=>validateManualCjPayment({
    record:base.record,supplier:base.supplier,approvedUsd:30
  }),/Primero crea/);
  const record={...base.record,status:"payment_required",externalOrderId:"CJ999",
    providerActualPayment:30,
    cjManualAuthorization:{approvedByAdminAt:"2026-10-09T12:00:00Z",funding:"merchant_coupon"},
  };
  const p=validateManualCjPayment({record,supplier:base.supplier,approvedUsd:35});
  assert.equal(p.amountUsd,30);
  assert.throws(()=>validateManualCjPayment({
    record,supplier:base.supplier,approvedUsd:20
  }),/supera tu autorización/);
  assert.throws(()=>validateManualCjPayment({
    record:{...record,status:"ordered"},supplier:base.supplier,approvedUsd:35
  }),/pendiente de pago/);
});

test("atomic claimed CJ creation cannot be repeated, and successful payment cannot replay", () => {
  const base=fixtures();
  const operations={supplierFulfillments:[base.record],suppliers:[base.supplier]};
  const claimed=applyCjManualStage(operations,base.record.id,["approval_required"],{
    status:"cj_creating",cjOperationId:"op1"
  });
  assert.equal(claimed.record.status,"cj_creating");
  assert.throws(()=>applyCjManualStage(claimed.operations,base.record.id,
    ["approval_required"],{status:"cj_creating"}),/cambió de estado/);
  const created=applyCjManualStage(claimed.operations,base.record.id,
    ["cj_creating"],{status:"payment_required",externalOrderId:"CJ999"});
  assert.equal(created.record.externalOrderId,"CJ999");
  assert.throws(()=>applyCjManualStage(created.operations,base.record.id,
    ["approval_required"],{status:"cj_creating"}),/cambió de estado/);
  const paying=applyCjManualStage(created.operations,base.record.id,
    ["payment_required"],{status:"cj_paying"});
  const paid=applyCjManualStage(paying.operations,base.record.id,
    ["cj_paying"],{status:"ordered"});
  assert.equal(paid.record.status,"ordered");
  assert.throws(()=>applyCjManualStage(paid.operations,base.record.id,
    ["payment_required"],{status:"cj_paying"}),/cambió de estado/);
});

test("creation/payment uncertain outcomes are never retried by status mutation", () => {
  const base=fixtures();
  for(const status of ["cj_creation_unknown","cj_payment_unknown","cj_creating","cj_paying"]) {
    const operations={supplierFulfillments:[{...base.record,status}]};
    assert.throws(()=>applyCjManualStage(operations,base.record.id,["approval_required"],{
      status:"cj_creating",
    }),/cambió de estado/);
  }
});
