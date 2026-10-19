import test from "node:test";
import assert from "node:assert/strict";
import {reserveUniversalBudget,settleUniversalBudget,readUniversalLedger,universalLedgerKey} from "./universalSupplierLedger.js";
const day="2026-10-19";
const policy={dailyMaxEur:100,perOrderMaxEur:80,providers:{cj:true,printful:true,aliexpress:true}};
const req=(orderId,provider,amountEur)=>({day,orderId,provider,amountEur,policy,paidOrderVerified:true,providerQuoteVerified:true,marginVerified:true});
test("one shared daily limit is enforced across all suppliers",()=>{
 const a=reserveUniversalBudget(null,req("order_000001","cj",60));
 const b=reserveUniversalBudget(a,req("order_000002","printful",40));
 assert.equal(readUniversalLedger(b,day).entries.length,2);
 assert.throws(()=>reserveUniversalBudget(b,req("order_000003","aliexpress",1)),/presupuesto diario/);
 assert.throws(()=>reserveUniversalBudget(b,req("order_000001","cj",1)),/reserva/);
});
test("unverified financial facts and disallowed providers are blocked",()=>{
 assert.throws(()=>reserveUniversalBudget(null,{...req("order_000001","cj",20),paidOrderVerified:false}));
 assert.throws(()=>reserveUniversalBudget(null,{...req("order_000001","cj",20),providerQuoteVerified:false}));
 assert.throws(()=>reserveUniversalBudget(null,{...req("order_000001","cj",20),marginVerified:false}));
 assert.throws(()=>reserveUniversalBudget(null,{...req("order_000001","cj",20),policy:{...policy,providers:{cj:false}}}));
 assert.throws(()=>reserveUniversalBudget(null,req("order_000001","cj",81)),/límite por pedido/);
});
test("uncertain remote actions remain reserved and cannot be retried or released",()=>{
 const first=reserveUniversalBudget(null,req("order_000001","cj",80));
 const uncertain=settleUniversalBudget(first,{day,orderId:"order_000001",status:"uncertain",remoteAttempted:true});
 assert.throws(()=>settleUniversalBudget(uncertain,{day,orderId:"order_000001",status:"released"}));
 assert.throws(()=>reserveUniversalBudget(uncertain,req("order_000001","cj",1)));
 assert.throws(()=>reserveUniversalBudget(uncertain,req("order_000002","printful",21)));
});
test("settlement requires positive provider evidence; release allowed only before remote attempt",()=>{
 const first=reserveUniversalBudget(null,req("order_000001","cj",40));
 assert.throws(()=>settleUniversalBudget(first,{day,orderId:"order_000001",status:"committed"}));
 assert.throws(()=>settleUniversalBudget(first,{day,orderId:"order_000001",status:"released",remoteAttempted:true}));
 const committed=settleUniversalBudget(first,{day,orderId:"order_000001",status:"committed",providerEvidence:true});
 assert.equal(readUniversalLedger(committed,day).entries[0].status,"committed");
 const released=settleUniversalBudget(first,{day,orderId:"order_000001",status:"released",remoteAttempted:false});
 assert.equal(readUniversalLedger(released,day).entries[0].status,"released");
 assert.equal(universalLedgerKey(day),"unifiedSupplierLedger:v1:"+day);
});
