import test from "node:test";
import assert from "node:assert/strict";
import {isNeuralPreviewService,previewApiPolicy} from "../previewAccess.js";

const preview={RAILWAY_SERVICE_NAME:"neural-preview-"+ "a".repeat(32)};
const production={RAILWAY_SERVICE_NAME:"HERENCIAPP-FRONTEND"};
test("only dedicated Railway neural preview services enter safe demo mode",()=>{
 assert.equal(isNeuralPreviewService(preview),true);
 assert.equal(isNeuralPreviewService(production),false);
 assert.equal(isNeuralPreviewService({RAILWAY_SERVICE_NAME:"neural-preview-foo"}),false);
 // Missing branch metadata must not disable the protection.
 assert.equal(previewApiPolicy("POST","/api/admin/login",preview),"blocked");
});
test("preview exposes safe local demo endpoints without production credentials",()=>{
 assert.equal(previewApiPolicy("GET","/api/preview/mode",preview),"mode");
 assert.equal(previewApiPolicy("GET","/api/admin/session",preview),"session");
 assert.equal(previewApiPolicy("GET","/api/admin/auth-config",preview),"auth-config");
});
test("preview rejects ALL mutation methods including login, payments and admin edits",()=>{
 for(const method of ["POST","PUT","PATCH","DELETE"]){
  for(const pathname of ["/api/admin/login","/api/admin/commerce/products","/api/storage/siteContent","/api/checkout","/api/neural/code"]){
   assert.equal(previewApiPolicy(method,pathname,preview),"blocked",method+" "+pathname);
  }
 }
});
test("preview only forwards public GET APIs, not admin private or Neural data",()=>{
 for(const pathname of ["/api/storage","/api/storage/siteContent","/api/commerce/products","/api/settings/public"]){
  assert.equal(previewApiPolicy("GET",pathname,preview),"public",pathname);
 }
 for(const pathname of ["/api/admin/orders","/api/neural/tasks","/api/storage/adminSuppliers","/api/storage/aiSettings"]){
  assert.equal(previewApiPolicy("GET",pathname,preview),"blocked",pathname);
 }
});
test("main production service keeps existing authentication and API functionality",()=>{
 for(const method of ["GET","POST","PUT"]){
  assert.equal(previewApiPolicy(method,"/api/admin/login",production),"normal");
 }
});
