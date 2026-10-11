import test from "node:test";
import assert from "node:assert/strict";
import {buildCjLiveMandate,validateCjLiveMandate,cjLiveMandatePermits,
 CJ_LIVE_MANDATE_CONFIRMATION} from "./cjLiveAutopilotMandate.js";
const policy={configured:true,mode:"simulation",perOrderMaxEur:20,dailyMaxEur:60,
 minMarginPercent:30,allowedSupplierIds:["cj-1"],country:"ES",quantity:1};
const suppliers=[{id:"cj-1",integrationType:"cj",active:true,cjSandbox:false}];
const env={CJ_LIVE_AUTOPILOT_ENABLED:"true",CJ_LIVE_ORDER_CREATION_ENABLED:"true",
 CJ_LIVE_PAYMENT_ENABLED:"true"};
const requested={confirmation:CJ_LIVE_MANDATE_CONFIRMATION,acknowledgeRealSupplierDebits:true,
 perOrderMaxEur:20,dailyMaxEur:60,minMarginPercent:30,allowedSupplierIds:["cj-1"]};
const now="2026-10-11T19:15:00Z";
const options={policy,suppliers,supervisedProof:true,env,now};

test("explicit merchant mandate can only authorize exact policy, verified provider and 30 days",()=>{
 const s=buildCjLiveMandate(requested,options);
 const mandate=validateCjLiveMandate(s,{policy,suppliers,nowMs:Date.parse(now)});
 assert.equal(mandate.valid,true);
 assert.equal(mandate.country,"ES");
 assert.equal(mandate.quantity,1);
 assert.equal(mandate.allowCoupons,false);
 assert.equal(cjLiveMandatePermits({mandate,record:{id:"x",status:"approval_required",supplierId:"cj-1",provider:"cj"},
    supplier:suppliers[0],amountEur:19.99}),true);
 assert.equal(cjLiveMandatePermits({mandate,record:{id:"x",status:"approval_required",supplierId:"cj-1",provider:"cj"},
    supplier:suppliers[0],amountEur:20.01}),false);
 assert.equal(validateCjLiveMandate(s,{policy,suppliers,nowMs:Date.parse(now)+31*86400_000}),null);
 assert.equal(validateCjLiveMandate(s,{policy:{...policy,dailyMaxEur:200},suppliers,nowMs:Date.parse(now)}),null);
 assert.equal(validateCjLiveMandate(s,{policy,suppliers:[{...suppliers[0],cjSandbox:true}],nowMs:Date.parse(now)}),null);
});
test("a generic request to enable everything is not permission to debit without exact budget",()=>{
 const request={...requested,confirmation:"todo activado"};
 assert.throws(()=>buildCjLiveMandate(request,options),/confirmar/);
 assert.throws(()=>buildCjLiveMandate({...requested,dailyMaxEur:100},options),/no coinciden/);
 assert.throws(()=>buildCjLiveMandate(requested,{...options,supervisedProof:false}),/supervisado/);
 assert.throws(()=>buildCjLiveMandate(requested,{...options,env:{...env,CJ_LIVE_PAYMENT_ENABLED:"false"}}),/Railway/);
 assert.throws(()=>buildCjLiveMandate(requested,{...options,suppliers:[{...suppliers[0],cjSandbox:true}]}),/Proveedor/);
 assert.throws(()=>buildCjLiveMandate({...requested,acknowledgeRealSupplierDebits:false},options),/confirmar/);
});
test("paid and closed CJ orders cannot be reconsidered for buying",()=>{
 const mandate=validateCjLiveMandate(buildCjLiveMandate(requested,options),{
   policy,suppliers,nowMs:Date.parse(now)});
 for(const status of ["ordered","shipped","delivered","closed","refunded","cj_payment_unknown"]){
   assert.equal(cjLiveMandatePermits({mandate,record:{id:"1",status,supplierId:"cj-1",provider:"cj"},
     supplier:suppliers[0],amountEur:5}),false);
 }
});
