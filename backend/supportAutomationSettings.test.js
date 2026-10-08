import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_SUPPORT_AUTOMATION_SETTINGS,parseSupportAutomationSettings,validateSupportAutomationPatch} from "./supportAutomationSettings.js";
import {isPrivateSupportStorageKey} from "./supportStorageSecurity.js";

test("support automation defaults to AI first with verified orders enabled",()=>{
  assert.deepEqual(parseSupportAutomationSettings(null),DEFAULT_SUPPORT_AUTOMATION_SETTINGS);
  assert.deepEqual(parseSupportAutomationSettings("{"),DEFAULT_SUPPORT_AUTOMATION_SETTINGS);
});
test("only boolean allowlisted admin settings can be stored",()=>{
  assert.deepEqual(validateSupportAutomationPatch({assistantEnabled:false}),{assistantEnabled:false});
  assert.deepEqual(validateSupportAutomationPatch({orderLookupEnabled:false}),{orderLookupEnabled:false});
  for(const change of [{},{assistantEnabled:"false"},{orderLookupEnabled:null},{enableRefundWithoutApproval:true},[],null]){
    assert.throws(()=>validateSupportAutomationPatch(change));
  }
});
test("support automation settings are private and never accessible as general site storage",()=>{
  assert.equal(isPrivateSupportStorageKey("customerSupportAutomationSettings"),true);
  assert.equal(isPrivateSupportStorageKey("siteContent"),false);
});
