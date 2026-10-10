import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSupplierXml, normalizeSupplierColumnMap, mappedSupplierRows } from "./supplierFileSchema.js";
import { inspectSupplierFile, previewSupplierFile } from "./supplierFileImporter.js";

const id="provedor_uno";
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<products><product><id>printer123</id><name>Impresora USB</name><currency>EUR</currency><variants><variant><vid>VID-EU</vid><sku>PRN-EU</sku><cost>14.95</cost><options><color>Azul</color><plug>EU</plug></options></variant><variant><vid>VID-US</vid><sku>PRN-US</sku><cost>15.50</cost><options><color>Azul</color><plug>US</plug></options></variant></variants></product></products>';

test("XML nested variants retain true combinations without inventing a variant",()=>{
 const rows=parseSupplierXml(xml);
 assert.equal(rows.length,2);
 assert.equal(rows[0].product_id,"printer123");
 assert.equal(rows[0].product_name,"Impresora USB");
 assert.equal(rows[0].option_color,"Azul");
 assert.equal(rows[1].option_plug,"US");
 const preview=previewSupplierFile({format:"xml",content:xml,supplierId:id});
 assert.equal(preview.products.length,1);
 assert.equal(preview.products[0].variants.length,2);
 assert.deepEqual(preview.products[0].variants.map(v=>v.supplierSku),["PRN-EU","PRN-US"]);
 assert.deepEqual(preview.products[0].variants.map(v=>v.name),["Azul · EU","Azul · US"]);
 assert.deepEqual(preview.products[0].optionLabels,["color","plug"]);
});

test("XML rejects DTD, external entities, processing instructions and malformed documents",()=>{
 for(const input of [
  '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><products><product><id>&xxe;</id></product></products>',
  '<!doctype catalog><products></products>',
  '<products><?malicious test?></products>',
  '<products><product></products>',
  '<products><product></product>',
  '<evil><product><id>1</id></product></evil>',
 ]) assert.throws(()=>parseSupplierXml(input));
});
test("XML parses simple catalog/item with attributes and checks unsupported roots",()=>{
 const input='<catalog><item id="SKU-P1"><name>Maceta</name><sku>MAC01</sku><cost>3.30</cost><currency>EUR</currency></item></catalog>';
 const list=parseSupplierXml(input);
 assert.equal(list.length,1);
 assert.equal(list[0].product_id,"SKU-P1");
 assert.equal(previewSupplierFile({format:"xml",content:input,supplierId:id}).products[0].name,"Maceta");
});
test("CSV fields can map arbitrary supplier column names to safe canonical names and option labels",()=>{
 const csv="codigo;articulo;acabado;enchufe_suministro;precio_compra_real;moneda_local;fabricante_sku;vid_origen\n1;Impresora;Negro;EU Plug;8.00;EUR;PRN-B-EU;VID-EU\n1;Impresora;Negro;US Plug;9.00;EUR;PRN-B-US;VID-US";
 const columnMap={
   product_id:"codigo",product_name:"articulo",
   option_color:"acabado",option_plug:"enchufe_suministro",
   cost:"precio_compra_real",currency:"moneda_local",supplier_sku:"fabricante_sku",variant_id:"vid_origen",
 };
 const inspected=inspectSupplierFile({format:"csv",content:csv});
 assert.ok(inspected.columns.some(x=>x.key==="acabado"));
 assert.equal(inspected.rows,2);
 const result=previewSupplierFile({format:"csv",content:csv,supplierId:id,columnMap});
 assert.equal(result.products[0].name,"Impresora");
 assert.equal(result.products[0].minSupplierCost,8);
 assert.equal(result.products[0].variants[0].supplierVariantId,"VID-EU");
 assert.deepEqual(result.products[0].variants.map(v=>v.name),["Negro · EU Plug","Negro · US Plug"]);
});
test("mapping may not target payment/automation state, unknown columns or duplicate origins",()=>{
 const cols=["codigo","nombre","coste"];
 for(const unsafe of [
  {"__proto__.admin":"codigo"},{"fulfillment_mode":"coste"},
  {"auto_purchase_enabled":"codigo"},{"price":"coste"},
  {"option_foo":"missing"},
  {"product_name":"codigo","product_id":"codigo"},
 ]) assert.throws(()=>normalizeSupplierColumnMap(unsafe,cols));
 const good=normalizeSupplierColumnMap({product_id:"codigo",product_name:"nombre"},cols);
 assert.equal(Object.getPrototypeOf(good),null);
 assert.equal(mappedSupplierRows([{codigo:"A",nombre:"Ramo"}],good)[0].product_id,"A");
});
test("mapping does not silently overwrite conflicting columns",()=>{
 assert.throws(()=>mappedSupplierRows([{codigo:"A",product_id:"B"}],{product_id:"codigo"}),/ambiguo/);
 assert.throws(()=>normalizeSupplierColumnMap({product_id:"codigo"},["cosa"]),/no existe/);
});
test("XML and mapping preview/commit are restricted to admin-only and no real payments",()=>{
 const gateway=readFileSync(new URL("./neonGateway.js",import.meta.url),"utf8");
 const start=gateway.indexOf('if(path==="/api/admin/catalog/supplier-file/inspect"');
 const end=gateway.indexOf('if(path==="/api/admin/catalog/import-url/product"',start);
 assert.ok(start>0&&end>start);
 const section=gateway.slice(start,end);
 assert.match(section,/adminSession\(req\)/);
 assert.match(section,/inspectSupplierFile/);
 assert.match(section,/previewSupplierFile/);
 assert.doesNotMatch(section,/paymentIntents|createOrderV2|payBalance/);
});
