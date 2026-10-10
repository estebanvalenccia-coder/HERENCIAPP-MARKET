import test from "node:test";
import assert from "node:assert/strict";
process.env.PREVIEW_SANDBOX_DATABASE_URL="postgres://demo:demo@postgres.railway.internal:5432/demo";
const {namespaceFromHost}=await import("../previewSandboxStorage.js");
const {handleSandboxApi}=await import("../previewSandboxRoutes.js");
test("preview namespaces only accept dedicated Railway preview domains",()=>{
 const one="neural-preview-"+"a".repeat(32)+"-production.up.railway.app";
 const two="neural-preview-"+"b".repeat(32)+"-production.up.railway.app";
 assert.equal(namespaceFromHost(one),"a".repeat(32));
 assert.notEqual(namespaceFromHost(one),namespaceFromHost(two));
 for(const invalid of ["www.herenciamarket.es","neural-preview-foo-production.up.railway.app","127.0.0.1"])
  assert.throws(()=>namespaceFromHost(invalid),/Unknown preview host/);
});
test("sandbox refuses real checkout and other unsupported mutations",async()=>{
 for(const path of ["/api/checkout","/api/admin/payments","/api/neural/code"]){
  await assert.rejects(handleSandboxApi({method:"POST",url:path},"a".repeat(32)),/No disponible/);
 }
});
test("sandbox session is explicitly demo-only",async()=>{
 const session=await handleSandboxApi({method:"GET",url:"/api/admin/session"},"a".repeat(32));
 assert.equal(session.sandbox,true);
 assert.equal(session.authenticated,true);
 const mode=await handleSandboxApi({method:"GET",url:"/api/preview/mode"},"a".repeat(32));
 assert.equal(mode.productionAccess,false);
});
