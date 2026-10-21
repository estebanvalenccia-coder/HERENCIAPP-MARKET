import test from "node:test";
import assert from "node:assert/strict";
import {buildShopifyDraftCatalog, mapHerenciaCartToShopifyLines, renderShopifyCsv} from "./shopifyMigration.js";

const gid = "gid://shopify/ProductVariant/123456789";
const product = {id:"p1",slug:"planta-p1",name:'Planta, "verde"',
  description:"Línea uno\nLínea dos",type:"plant",price:"23.5",
  status:"active",track_inventory:true,stock:5};

test("drafts are unpublished, unsellable and CSV is correctly escaped", () => {
  const {rows,report} = buildShopifyDraftCatalog({
    products:[product],
    images:[{product_id:"p1",url:"https://cdn.example.com/planta.jpg",alt_text:"Planta"}],
    relations:[{product_id:"p1",collection_id:"plantas"}],
  });
  assert.equal(report.productCount,1);
  assert.equal(rows[0]["Status"],"draft");
  assert.equal(rows[0]["Published on online store"],"false");
  assert.equal(rows[0]["Inventory quantity"],"0");
  assert.equal(rows[0]["Tags"],"herencia-market, plantas");
  assert.match(renderShopifyCsv(rows), /"Planta, ""verde"""/);
});
test("multiple variants, gallery images, non-shipping services", () => {
  const {rows,report} = buildShopifyDraftCatalog({
    products:[{...product,id:"s",slug:"servicio-s",type:"service"}],
    variants:[{product_id:"s",name:"1 hora",price:30},{product_id:"s",name:"2 horas",price:60}],
    images:[{product_id:"s",url:"https://cdn.example.com/a.jpg"},
            {product_id:"s",url:"https://cdn.example.com/b.jpg"}],
  });
  assert.equal(report.variantCount,2);
  assert.equal(rows.length,3);
  assert.equal(rows[0]["Requires shipping"],"false");
  assert.equal(rows[1]["Option1 value"],"2 horas");
  assert.equal(rows[2]["Product image URL"],"https://cdn.example.com/b.jpg");
});
test("duplicate handles and option labels fail closed", () => {
  assert.throws(() => buildShopifyDraftCatalog({products:[product,{...product,id:"p2"}]}), /duplicado/);
  assert.throws(() => buildShopifyDraftCatalog({products:[product],variants:[
    {product_id:"p1",name:"M"},{product_id:"p1",name:"M"}]}),/duplicada/);
});
test("only mapped GIDs are used; dedication and AI attribution preserved", () => {
  const lines=mapHerenciaCartToShopifyLines([{
    id:"p1",quantity:2,personalization:{dedication:"Te quiero"},salesSource:"HERENCIA_SALES"
  }],{p1:{default:gid}});
  assert.deepEqual(lines,[{merchandiseId:gid,quantity:2,attributes:[
    {key:"herencia_product_id",value:"p1"},
    {key:"Dedicatoria",value:"Te quiero"},
    {key:"Origen",value:"HERENCIA_SALES"}
  ]}]);
});
test("missing variant link and fractional quantities fail closed", () => {
  assert.throws(() => mapHerenciaCartToShopifyLines([{id:"p1",selectedVariant:"M",quantity:1}],
    {p1:{default:gid}}),/vincular/);
  assert.throws(() => mapHerenciaCartToShopifyLines([{id:"p1",quantity:1}],{}),/vincular/);
  assert.throws(() => mapHerenciaCartToShopifyLines([{id:"p1",quantity:2.5}],
    {p1:{default:gid}}),/cantidad/);
});
test("service hours map to quantity, without trusting its price", () => {
  const line=mapHerenciaCartToShopifyLines([{id:"s",type:"service",quantity:1,serviceHours:3}],
    {s:{default:gid}})[0];
  assert.equal(line.quantity,3);
  assert.deepEqual(line.attributes[1],{key:"Unidad de servicio",value:"hora"});
});
