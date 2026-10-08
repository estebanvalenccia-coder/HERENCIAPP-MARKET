import test from "node:test";
import assert from "node:assert/strict";
import { parseShippingSettings, validateShippingSettings, shippingQuoteForCart } from "./shippingPolicy.js";

const plant = { id:"plant-1", category:"Plantas", price:20, quantity:1, type:"product" };
const soil = { id:"soil-1", category:"Tierra y sustratos", price:20, quantity:1, type:"product" };
const service = { id:"service-1", category:"Servicios", price:30, quantity:2, type:"service" };
const base = { advancedEnabled:true, enabled:true, mode:"fixed", basePrice:8, blockKm:3, blockPrice:1, minimum:0, maximum:100 };
const calculate = (extra, lines=[plant], km=6) => shippingQuoteForCart({settings:{...base,...extra},lines,distanceKm:km,legacyPrice:4.9});

test("old configuration preserves existing shipping cost", () => {
  assert.equal(shippingQuoteForCart({settings:{cost:5},lines:[plant],distanceKm:6,legacyPrice:4.9}),4.9);
});
test("disabled shipping fees never imply a cancelled delivery", () => {
  assert.equal(calculate({enabled:false}),0);
});
test("fixed rate charges once for a cart",()=> assert.equal(calculate({}),8));
test("distance blocks calculate by 3 km",()=> assert.equal(calculate({mode:"distance",basePrice:2,blockPrice:1.5},[plant],7),6.5));
test("custom tiers have distance bounds",()=>{
  assert.equal(calculate({mode:"tiers",tiers:[{maxKm:3,price:4},{maxKm:10,price:7}]},[plant],6),7);
  assert.throws(()=>calculate({mode:"tiers",tiers:[{maxKm:3,price:4}]},[plant],6),/fuera de los tramos/);
});
test("free shipping can apply to all products above threshold",()=>{
  assert.equal(calculate({free:{enabled:true,scope:"all",threshold:20,categories:[],products:[]}}),0);
  assert.equal(calculate({free:{enabled:true,scope:"all",threshold:25,categories:[],products:[]}}),8);
});
test("selective categories only discount eligible proportion of mixed cart",()=>{
  const free = {enabled:true,scope:"categories",threshold:10,categories:["plantas"],products:[]};
  assert.equal(calculate({free},[plant,soil]),4);
});
test("selected product shipping fee is waived without affecting others",()=>{
  const free = {enabled:true,scope:"products",threshold:1,categories:[],products:["plant-1"]};
  assert.equal(calculate({free},[plant,soil]),4);
});
test("per product override takes precedence over category",()=>{
  assert.equal(calculate({categories:{plantas:{freeShipping:true}},products:{"plant-1":{freeShipping:false}}}),8);
  assert.equal(calculate({products:{"plant-1":{freeShipping:true}}}),0);
});
test("services never add a shipping fee",()=>{
  assert.equal(calculate({},[service]),0);
  assert.equal(calculate({},[plant,service]),8);
});
test("minimum and maximum fee caps work",()=>{
  assert.equal(calculate({basePrice:50,maximum:9}),9);
  assert.equal(calculate({basePrice:2,minimum:5}),5);
});
test("invalid prices and unordered tiers are rejected",()=>{
  assert.throws(()=>validateShippingSettings({...base,basePrice:-1}),/inválido/);
  assert.throws(()=>validateShippingSettings({...base,mode:"tiers",tiers:[{maxKm:5,price:1},{maxKm:4,price:2}]}),/ordenados/);
});
test("category names retain exact spanish key values until normalized",()=>{
  assert.equal(parseShippingSettings({free:{scope:"categories"}}).free.scope,"categories");
});
