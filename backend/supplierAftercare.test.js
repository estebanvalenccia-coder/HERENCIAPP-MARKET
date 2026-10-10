import test from "node:test";
import assert from "node:assert/strict";
import {
 createAftercareCase,transitionAftercareCase,readSupplierAftercare,supplierAftercareInstructions
} from "./supplierAftercare.js";
const first={orderId:"order-345",supplierId:"supplier-22",reason:"damaged",note:"Caja dañada"};
test("a real supplier aftercare reason produces private manual case with deterministic id",()=>{
 const saved=createAftercareCase("[]",first,"2026-10-10T11:00:00Z");
 assert.equal(saved.created,true);
 assert.equal(saved.case.status,"open");
 assert.equal(saved.case.automatedRefund,false);
 assert.equal(saved.case.automatedPurchases,false);
 assert.equal(readSupplierAftercare(saved.serialized).length,1);
 assert.match(saved.case.id,/^scase_[0-9a-f]{32}$/);
});
test("replayed requests are idempotent even if note differs",()=>{
 const firstInsert=createAftercareCase("[]",first);
 const second=createAftercareCase(firstInsert.serialized,{...first,note:"another"});
 assert.equal(second.created,false);
 assert.equal(second.case.id,firstInsert.case.id);
 assert.equal(readSupplierAftercare(second.serialized).length,1);
});
test("transitions require exact revision and supported status changes",()=>{
 const created=createAftercareCase("[]",first);
 const transitioned=transitionAftercareCase(created.serialized,{
  caseId:created.case.id,expectedRevision:1,toStatus:"in_review"
 });
 assert.equal(transitioned.case.revision,2);
 assert.equal(transitioned.case.events.length,2);
 assert.throws(()=>transitionAftercareCase(transitioned.serialized,{
  caseId:created.case.id,expectedRevision:1,toStatus:"resolved"
 }),/actualizado/);
 assert.throws(()=>transitionAftercareCase(transitioned.serialized,{
  caseId:created.case.id,expectedRevision:2,toStatus:"open"
 }),/no permitido/);
});
test("refund request instructions never perform refunds",()=>{
 const data=createAftercareCase("[]",{orderId:"o",supplierId:"s",reason:"refund_request"});
 const message=supplierAftercareInstructions(data.case);
 assert.equal(message.automaticRefund,false);
 assert.equal(message.automaticShipment,false);
 assert.ok(message.steps.some(s=>s.includes("autorizado")));
 assert.throws(()=>createAftercareCase("[]",{orderId:"o",supplierId:"s",reason:"refund_money_now"}));
});
