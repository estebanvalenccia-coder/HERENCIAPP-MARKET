import test from "node:test";
import assert from "node:assert/strict";
import { canEditSite } from "./siteEditorPermissions.mjs";
import { validSiteUsername } from "./siteEditorAudit.js";

test("owner retains full administrator actions",()=>{
  const owner={authenticated:true,role:"owner"};
  for(const action of ["site:read","site:edit","site:publish","site:restore","site:audit","site:permissions"]) assert.equal(canEditSite(owner,action),true);
});
test("admin can publish unless owner explicitly revokes permissions",()=>{
  const admin={authenticated:true,role:"admin"};
  assert.equal(canEditSite(admin,"site:publish"),true);
  assert.equal(canEditSite(admin,"site:publish",{canPublish:false}),false);
  assert.equal(canEditSite(admin,"site:restore",{canRestore:false}),false);
  assert.equal(canEditSite(admin,"site:audit",{canViewAudit:false}),false);
  assert.equal(canEditSite(admin,"site:permissions"),false);
});
test("employee, disabled onboarding and anonymous users cannot publish",()=>{
  assert.equal(canEditSite({authenticated:true,role:"employee"},"site:publish"),false);
  assert.equal(canEditSite({authenticated:true,role:"employee"},"site:read"),true);
  assert.equal(canEditSite({authenticated:true,role:"admin",mustChangePassword:true},"site:publish"),false);
  assert.equal(canEditSite(null,"site:publish"),false);
  assert.equal(canEditSite({authenticated:false,role:"owner"},"site:publish"),false);
  assert.equal(canEditSite({authenticated:true,role:"owner"},"invalid-action"),false);
});
test("username validation cannot target arbitrary records",()=>{
  assert.equal(validSiteUsername("christian"),true);
  assert.equal(validSiteUsername("owner_1"),true);
  assert.equal(validSiteUsername("a"),false);
  assert.equal(validSiteUsername("admin';drop table"),false);
});
