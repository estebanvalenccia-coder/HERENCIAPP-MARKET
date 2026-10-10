import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { supplierFileProfileKey, readSupplierFileProfile, saveSupplierFileProfile } from "./supplierFileProfiles.js";

const input={supplierId:"escriv_01",format:"csv",
  columnMap:{product_id:"codigo_proveedor",product_name:"descripcion_cliente",
    cost:"precio_mayorista",option_color:"acabado",option_plug:"tipo_clavija"},
  columns:["codigo_proveedor","descripcion_cliente","precio_mayorista","acabado","tipo_clavija"]};
test("mapping profiles are keyed by supplier and format and can be reloaded",()=>{
 const raw=saveSupplierFileProfile(null,{...input,now:"2026-10-10T17:00:00Z"});
 const profile=readSupplierFileProfile(raw,input.supplierId,input.format);
 assert.equal(profile.exists,true);
 assert.equal(profile.columnMap.product_id,"codigo_proveedor");
 assert.equal(profile.columnMap.option_plug,"tipo_clavija");
 assert.equal(profile.updatedAt,"2026-10-10T17:00:00Z");
 assert.equal(readSupplierFileProfile(raw,input.supplierId,"xml").exists,false);
 assert.equal(readSupplierFileProfile(raw,"other_supplier","csv").exists,false);
});
test("updating a profile preserves other suppliers and formats",()=>{
 const a=saveSupplierFileProfile("",{...input});
 const b=saveSupplierFileProfile(a,{supplierId:"another",format:"xml",
   columns:["supplier_sku"],columnMap:{supplier_sku:"supplier_sku"}});
 assert.equal(readSupplierFileProfile(b,"escriv_01","csv").exists,true);
 assert.equal(readSupplierFileProfile(b,"another","xml").exists,true);
});
test("invalid stored profile fails closed, never triggers automatic purchases",()=>{
 for(const wrong of [
   {supplierId:"../../etc",format:"csv"},
   {supplierId:"sup",format:"html"},
 ]) assert.throws(()=>supplierFileProfileKey(wrong.supplierId,wrong.format));
 assert.throws(()=>saveSupplierFileProfile("",{...input,
   columnMap:{auto_purchase_enabled:"precio_mayorista"}}),/no admitido/);
 assert.throws(()=>saveSupplierFileProfile("",{...input,
   columnMap:{product_id:"missing"}}),/no existe/);
 assert.throws(()=>saveSupplierFileProfile("",{...input,
   columnMap:{product_id:"codigo_proveedor",supplier_sku:"codigo_proveedor"}}),/misma columna/);
 assert.deepEqual(readSupplierFileProfile('{"sup:csv":{"columnMap":{"payment":"x"}}}',"sup","csv"),
   {columnMap:{},updatedAt:null,exists:false});
});
test("the mapping endpoint is admin-only and uses Neon atomic storage",()=>{
 const gateway=readFileSync(new URL("./neonGateway.js",import.meta.url),"utf8");
 const section=gateway.slice(
   gateway.indexOf('if(path==="/api/admin/catalog/supplier-file/mapping"'),
   gateway.indexOf('if(path==="/api/admin/catalog/supplier-file/inspect"'),
 );
 assert.match(section,/adminSession\(req\)/);
 assert.match(section,/mutateNeonStorageValue\("supplierFileMappings"/);
 assert.match(section,/saveSupplierFileProfile/);
 assert.match(gateway,/"supplierFileMappings"/);
 assert.doesNotMatch(section,/createOrder|payBalance|paymentIntents/);
});
