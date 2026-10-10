import test from "node:test";
import assert from "node:assert/strict";
import {
  hasVerifiedCjQuote,
  preserveSupplierFulfillment,
  mergePreparedSupplierFulfillments,
} from "./cjSupplierQueue.js";

function row({ id = "f1", cost = 0, status = "cost_required", quoted = false, ...extra } = {}) {
  return {
    id, dedupeKey: "order1::cj", orderId: "order1", status, estimatedCost: cost,
    createdAt: "2026-10-08T20:00:00Z", shippingAddress:{postalCode:"08032"},
    items: [{
      productId: "plant-1", quantity: 1, supplierCost: cost, salePrice:50,
      supplierVariantId:"CJ-VID", supplierSku:"CJ-SKU", selectedVariant:"Green EU",
      cjPreferredLogisticName:"CJPacket",
      cjPricingEstimate: quoted ? { available: true, checkedAt: new Date().toISOString(),
        vid:"CJ-VID",sku:"CJ-SKU",selectedVariant:"Green EU",
        destination:"ES",postalCode:"08032",methodName:"CJPacket",
        supplierTotalUsd:25, salePriceEur:50, costEur:cost } : null,
    }],
    ...extra,
  };
}

test("a newly verified CJ quote repairs a pending zero-cost row without forcing a refresh", () => {
  const old = row();
  const priced = row({ id: "new", cost: 21.64, quoted: true, status: "approval_required" });
  assert.equal(hasVerifiedCjQuote(old), false);
  assert.equal(hasVerifiedCjQuote(priced), true);
  assert.equal(preserveSupplierFulfillment(old, priced), false);
  const result = mergePreparedSupplierFulfillments(
    { suppliers: [{ id: "cj" }], supplierFulfillments: [old] }, [priced]
  );
  assert.equal(result.supplierFulfillments.length, 1);
  assert.equal(result.supplierFulfillments[0].estimatedCost, 21.64);
  assert.equal(result.supplierFulfillments[0].id, "f1");
  assert.equal(result.supplierFulfillments[0].createdAt, old.createdAt);
  assert.equal(result.suppliers.length, 1);
});

test("repeated preparation is idempotent and cannot reset a verified quote to zero", () => {
  const priced = row({ cost: 21.64, quoted: true, status: "approval_required" });
  const stale = row({ cost: 0, quoted: false });
  const first = mergePreparedSupplierFulfillments({ supplierFulfillments: [priced] }, [stale]);
  const second = mergePreparedSupplierFulfillments(first, [stale]);
  assert.equal(second.supplierFulfillments.length, 1);
  assert.equal(second.supplierFulfillments[0].estimatedCost, 21.64);
});

test("explicit resync cannot replace orders already submitted to CJ or approved for manual purchasing", () => {
  const priced = row({ cost: 21.64, quoted: true });
  for (const protectedRow of [
    row({ status: "ordered", externalOrderId: "CJ-900" }),
    row({ status: "shipped" }),
    row({ status: "manual_purchase_required" }),
    row({ status: "payment_required" }),
    row({ status: "approval_required", approvedAt: "2026-10-08T22:00:00Z" }),
  ]) {
    const result = mergePreparedSupplierFulfillments(
      { supplierFulfillments: [protectedRow] }, [priced], { force: true }
    );
    assert.deepEqual(result.supplierFulfillments[0], protectedRow);
  }
});

test("supplier queue reconciles separate orders without losing existing rows and metadata", () => {
  const old = row({ status: "approval_required", cost: 21.64, quoted: true });
  const other = { ...row({ id: "f2", cost: 10, quoted: true }), dedupeKey: "order2::cj", orderId: "order2" };
  const result = mergePreparedSupplierFulfillments(
    { supplierFulfillments: [old], suppliers: [{ id: "cj" }], staff: [{ id: 1 }] },
    [other], { force: true }
  );
  assert.equal(result.supplierFulfillments.length, 2);
  assert.equal(new Set(result.supplierFulfillments.map(r => r.dedupeKey)).size, 2);
  assert.equal(result.staff.length, 1);
  assert.equal(result.suppliers.length, 1);
});

test("a refreshed record still requires admin review and does not buy anything", () => {
  const old = row();
  const proposed = row({ cost: 21.64, quoted: true, status: "approval_required", blocker: "Revisión manual" });
  const result = mergePreparedSupplierFulfillments({ supplierFulfillments: [old] }, [proposed]);
  assert.equal(result.supplierFulfillments[0].status, "approval_required");
  assert.equal(result.supplierFulfillments[0].externalOrderId, undefined);
});

test("stale or wrong destination quotes do not remain marked as verified",()=>{
 const priced=row({cost:21.64,quoted:true});
 const stale={...priced,items:priced.items.map(item=>({...item,
   cjPricingEstimate:{...item.cjPricingEstimate,checkedAt:"2026-01-01T00:00:00Z"}}))};
 assert.equal(hasVerifiedCjQuote(stale),false);
 assert.equal(preserveSupplierFulfillment(stale,row({cost:0})),false);
 const wrongZip={...priced,items:priced.items.map(item=>({...item,
   cjPricingEstimate:{...item.cjPricingEstimate,postalCode:"28001"}}))};
 assert.equal(hasVerifiedCjQuote(wrongZip),false);
});
test("new exact variant quote safely replaces an unapproved pending row",()=>{
 const old=row({cost:21.64,quoted:true,status:"approval_required"});
 const next=row({cost:22.22,quoted:true,status:"approval_required",items:[
   {...old.items[0],supplierCost:22.22,selectedVariant:"Blue US",supplierVariantId:"CJ-VID-B",
    supplierSku:"CJ-SKU-B",cjPricingEstimate:{...old.items[0].cjPricingEstimate,costEur:22.22,
      selectedVariant:"Blue US",vid:"CJ-VID-B",sku:"CJ-SKU-B"}}
 ]});
 assert.equal(preserveSupplierFulfillment(old,next),false);
 const result=mergePreparedSupplierFulfillments({supplierFulfillments:[old]},[next]);
 assert.equal(result.supplierFulfillments.length,1);
 assert.equal(result.supplierFulfillments[0].items[0].supplierVariantId,"CJ-VID-B");
 assert.equal(result.supplierFulfillments[0].id,old.id);
});
