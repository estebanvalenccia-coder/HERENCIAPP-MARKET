import test from "node:test";
import assert from "node:assert/strict";
import {parseUniversalSupplierBudget,validateUniversalSupplierBudget} from "./unifiedSupplierBudget.js";
test("universal supplier settings keep a shared merchant budget but NEVER authorize spending",()=>{
 const input={dailyMaxEur:100,perOrderMaxEur:20,minMarginPercent:25,
 providers:{cj:true,printful:true,aliexpress:true}};
 const policy=validateUniversalSupplierBudget(input);
 assert.equal(policy.dailyMaxEur,100);
 assert.equal(policy.paymentsEnabled,false);
 assert.equal(policy.autoPurchaseEnabled,false);
 assert.equal(policy.sharedLedgerActive,false);
 assert.deepEqual(parseUniversalSupplierBudget(JSON.stringify(policy)),policy);
});
test("universal budget denies unwanted payment activation and unsafe missing limits",()=>{
 const base={dailyMaxEur:100,perOrderMaxEur:20,minMarginPercent:25,
 providers:{cj:true,printful:false,aliexpress:false}};
 assert.throws(()=>validateUniversalSupplierBudget({...base,paymentsEnabled:true}));
 assert.throws(()=>validateUniversalSupplierBudget({...base,autoPurchaseEnabled:true}));
 assert.throws(()=>validateUniversalSupplierBudget({...base,sharedLedgerActive:true}));
 assert.throws(()=>validateUniversalSupplierBudget({...base,perOrderMaxEur:101}));
 assert.throws(()=>validateUniversalSupplierBudget({...base,perOrderMaxEur:null}));
 assert.throws(()=>validateUniversalSupplierBudget({...base,minMarginPercent:null}));
 assert.equal(parseUniversalSupplierBudget(null).dailyMaxEur,100);
});
