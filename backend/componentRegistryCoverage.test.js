import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const registry=readFileSync("src/app/lib/componentRegistry.ts","utf8");
const bindings=[
"src/app/components/Layout.tsx",
"src/app/pages/Home.tsx",
"src/app/pages/Products.tsx",
"src/app/pages/ProductDetail.tsx",
"src/app/pages/Services.tsx",
"src/app/pages/Contact.tsx",
].map(x=>readFileSync(x,"utf8")).join("\n");
const ids=[...registry.matchAll(/\{ id:"([^"]+)"/g)].map(x=>x[1]);

test("all registry IDs are unique",()=>{
  assert.equal(new Set(ids).size,ids.length);
});
test("each advertised configurable component has a real storefront visibility boundary",()=>{
  assert.ok(ids.length>=38,`Expected >=38 registered components; got ${ids.length}`);
  const missing=ids.filter(x=>!bindings.includes(`id="${x}"`));
  assert.deepEqual(missing,[],`These components have no corresponding storefront boundary: ${missing.join(", ")}`);
});
test("preview policies are present in every new page",()=>{
  for(const path of ["Products","ProductDetail","Services","Contact"]){
    const text=readFileSync(`src/app/pages/${path}.tsx`,"utf8");
    assert.match(text,/useAdminPreviewSite\(setSite\)/);
    assert.match(text,/isEmbeddedAdminPreview\(\)/);
  }
});
