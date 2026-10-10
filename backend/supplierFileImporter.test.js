import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseSupplierCsv,parseSupplierJson,previewSupplierFile,draftForSupplierFile
} from "./supplierFileImporter.js";

const supplierId="local_eu_supplier";
const csv=[
 "product_id;product_name;variant_id;supplier_sku;option_color;option_plug;cost;currency;product_url;image_url",
 "P-001;Impresora mini;V-EU;CJ-N-EU;Negro;EU Plug;5,10;USD;https://supplier.example.com/item/1;https://supplier.example.com/image.jpg",
 "P-001;Impresora mini;V-US;CJ-N-US;Negro;US Plug;5,25;USD;https://supplier.example.com/item/1;https://supplier.example.com/image.jpg",
 "P-002;Maceta;V-02;POT-WH;Blanco;;2,00;USD;;"
].slice(0,3).join("\n");

test("CSV supports semicolon, decimal comma and authentic non-cartesian combinations",()=>{
 const rows=parseSupplierCsv(csv);
 assert.equal(rows.length,2);
 const preview=previewSupplierFile({format:"csv",content:csv,supplierId});
 assert.equal(preview.products.length,1);
 assert.equal(preview.products[0].name,"Impresora mini");
 assert.deepEqual(preview.products[0].optionLabels,["color","plug"]);
 assert.deepEqual(preview.products[0].variants.map(v=>v.name),["Negro · EU Plug","Negro · US Plug"]);
 assert.deepEqual(preview.products[0].variants.map(v=>v.supplierVariantId),["V-EU","V-US"]);
 assert.equal(preview.products[0].minSupplierCost,5.10);
 assert.equal(preview.products[0].currency,"USD");
 assert.equal(preview.products[0].sourceImageUrl,"https://supplier.example.com/image.jpg");
});
test("CSV supports quote escaping and embedded line breaks",()=>{
 const rows=parseSupplierCsv("product_id,name,description\nx,\"Maceta, \"\"Verde\"\"\",\"Con\nsalida\"");
 assert.equal(rows[0].name,'Maceta, "Verde"');
 assert.equal(rows[0].description,"Con\nsalida");
});
test("JSON nested variants use exact supplier IDs, SKU and dynamic option attributes",()=>{
 const original=JSON.stringify({products:[{
   product_id:"shirt-03", name:"Camiseta", currency:"EUR",category:"moda",
   variants:[
     {variant_id:"R-S",sku:"TEE-RED-S",cost:"7.50",options:{Color:"Rojo",Talla:"S"}},
     {variant_id:"B-M",sku:"TEE-BLUE-M",cost:"8.00",options:{Color:"Azul",Talla:"M"}},
   ]
 }]});
 const preview=previewSupplierFile({format:"json",content:original,supplierId});
 assert.equal(preview.products[0].variants.length,2);
 assert.deepEqual(preview.products[0].optionLabels,["color","talla"]);
 assert.deepEqual(preview.products[0].variants.map(v=>v.name),["Rojo · S","Azul · M"]);
 assert.equal(preview.products[0].sourceProductUrl,"");
 const draft=draftForSupplierFile(preview.products[0],{sourceHost:"example.com"});
 assert.equal(draft.status,"draft");
 assert.equal(draft.active,false);
 assert.equal(draft.price,0);
 assert.equal(draft.stock,0);
 assert.equal(draft.metadata.fulfillmentMode,"manual");
 assert.equal(draft.metadata.supplierOffersUnverified,true);
 assert.equal(draft.metadata.supplierCurrency,"EUR");
 assert.equal(draft.metadata.supplierVariantPrices.length,2);
 assert.equal(draft.variants[1].supplierSku,"TEE-BLUE-M");
 assert.equal(draft.variants[0].stock,0);
 assert.deepEqual(draft.images,[]);
});
test("cannot manufacture combinations or collapse duplicate SKUs/VIDs",()=>{
 const duplicate=csv.replace("V-US;CJ-N-US","V-EU;CJ-N-US");
 assert.throws(()=>previewSupplierFile({format:"csv",content:duplicate,supplierId}),/repite el identificador/);
 const dupSku=csv.replace("V-US;CJ-N-US","V-US;CJ-N-EU");
 assert.throws(()=>previewSupplierFile({format:"csv",content:dupSku,supplierId}),/repite el SKU/);
 const dupCombo=csv.replace("Negro;US Plug","Negro;EU Plug");
 assert.throws(()=>previewSupplierFile({format:"csv",content:dupCombo,supplierId}),/repite la combinación/);
});
test("reject malformed files, wrong delimiter counts, XML, oversized payloads",()=>{
 assert.throws(()=>parseSupplierCsv('sku,name\n1,"Unclosed'),/comillas sin cerrar/);
 assert.throws(()=>parseSupplierCsv("sku,name\n1,A,B"),/número de columnas/);
 assert.throws(()=>previewSupplierFile({format:"xml",content:"<products/>",supplierId}),/XML/);
 assert.throws(()=>previewSupplierFile({format:"csv",content:"A".repeat(513*1024),supplierId}),/512 KB/);
 assert.throws(()=>parseSupplierJson('{"products":{}}'),/array/);
 assert.throws(()=>parseSupplierJson("not-json"),/estructura/);
});
test("a supplier product has a stable deterministic ID but never changes a merchant's existing record",()=>{
 const a=previewSupplierFile({format:"csv",content:csv,supplierId});
 const b=previewSupplierFile({format:"csv",content:csv,supplierId});
 const c=previewSupplierFile({format:"csv",content:csv,supplierId:"different"});
 assert.equal(a.products[0].id,b.products[0].id);
 assert.notEqual(a.products[0].id,c.products[0].id);
 assert.equal(a.products[0].id.startsWith("supplierfile_"),true);
});
test("only explicit attributes, registered supplier ID and exact grouped names are accepted",()=>{
 const wrongName=csv.replace("P-001;Impresora mini;V-US","P-001;Otro artículo;V-US");
 assert.throws(()=>previewSupplierFile({format:"csv",content:wrongName,supplierId}),/contradictorios/);
 assert.throws(()=>previewSupplierFile({format:"csv",content:csv,supplierId:"../../db"}),/proveedor/);
 const csvNoOptions="product_id;name;variant_id;sku;cost;currency\n123;A;1;A1;2;EUR\n123;A;2;A2;2;EUR";
 assert.throws(()=>previewSupplierFile({format:"csv",content:csvNoOptions,supplierId}),/sin un nombre/);
 const csvBadPrice="product_id;name;sku;cost;currency\nX;A;SKU;2.100,00;EUR";
 assert.throws(()=>previewSupplierFile({format:"csv",content:csvBadPrice,supplierId}),/Coste/);
});
test("file preview/commit routes are admin-only and never alter automatic purchase flags",()=>{
 const gateway=readFileSync(new URL("./neonGateway.js",import.meta.url),"utf8");
 const begin=gateway.indexOf('if(path==="/api/admin/catalog/supplier-file/preview"');
 const end=gateway.indexOf('if(path==="/api/admin/catalog/import-url/product"',begin);
 assert.ok(begin>0&&end>begin);
 const body=gateway.slice(begin,end);
 assert.match(body,/adminSession\(req\)/);
 assert.match(body,/previewSupplierFile/);
 assert.match(body,/draftForSupplierFile/);
 assert.match(body,/skipped/);
 assert.doesNotMatch(body,/paymentIntents|createOrderV2|payBalance|CJ_LIVE_ORDER_CREATION_ENABLED/);
});
