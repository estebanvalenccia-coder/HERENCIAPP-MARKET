import test from "node:test";
import assert from "node:assert/strict";
import { splitSupplierOptions, deriveVariantOptionGroups, chooseExistingVariant } from "./productVariantOptions.js";

const variants=[
 {name:"Rosa · EU Plug",optionValues:["Rosa","EU Plug"],sku:"CJ-PINK-EU"},
 {name:"Rosa · US Plug",optionValues:["Rosa","US Plug"],sku:"CJ-PINK-US"},
 {name:"Azul · EU Plug",optionValues:["Azul","EU Plug"],sku:"CJ-BLUE-EU"},
];
test("Real CJ option combinations yield color and plug groups",()=>{
 const groups=deriveVariantOptionGroups(variants);
 assert.deepEqual(groups.map(g=>g.label),["Color","Enchufe"]);
 assert.deepEqual(groups.map(g=>g.values),[["Rosa","Azul"],["EU Plug","US Plug"]]);
 assert.equal(chooseExistingVariant(variants,variants[0].name,1,"US Plug")?.sku,"CJ-PINK-US");
 assert.equal(chooseExistingVariant(variants,variants[1].name,0,"Azul")?.sku,"CJ-BLUE-EU");
 assert.equal(variants.length,3,"no synthetic Azul/US SKU is created");
});
test("Merchant labels override guesses and simple variants keep a selector",()=>{
 assert.equal(deriveVariantOptionGroups(variants,["Acabado","Enchufe"])[0].label,"Acabado");
 assert.deepEqual(deriveVariantOptionGroups([{name:"Pequeño"},{name:"Grande"}]).map(x=>x.values),[["Pequeño","Grande"]]);
 assert.deepEqual(splitSupplierOptions("Pink-EU Plug"),["Pink","EU Plug"]);
 assert.equal(chooseExistingVariant(variants,"no-existe",0,"Azul")?.sku,"CJ-BLUE-EU");
});
test("Malformed/inconsistent combinations never generate misleading groups",()=>{
 assert.deepEqual(deriveVariantOptionGroups([{name:"Rosa | EU"},{name:"Azul"}]),[]);
 assert.equal(chooseExistingVariant(variants,variants[0].name,1,"AU Plug"),null);
});
