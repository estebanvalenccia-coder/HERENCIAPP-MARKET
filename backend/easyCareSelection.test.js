import test from "node:test";
import assert from "node:assert/strict";
import {selectEasyCareProducts} from "../src/app/lib/easyCareSelection.js";
const drafts=[
 {name:"Zamioculca",scientificName:"Zamioculcas zamiifolia",difficulty:"Muy fácil"},
 {name:"Monstera adansonii",scientificName:"Monstera adansonii",difficulty:"Media"}
];
function product(name,props={}){return {id:name,name,price:19,image:"https://example.org/plant.jpg",stock:5,trackInventory:true,active:true,...props}}
test("only catalogue products explicitly identified as easy are shown",()=>{
 const catalog=[product("Zamioculca"),product("Monstera adansonii"),product("Jardinería", {category:"jardineria"})];
 assert.deepEqual(selectEasyCareProducts(catalog,drafts).map(x=>x.name),["Zamioculca"]);
});
test("an explicit medium difficulty overrides an easy name and stock blocks unavailable products",()=>{
 const catalog=[product("Zamioculca",{difficulty:"Media"}),product("Zamioculca",{id:"2",stock:0})];
 assert.equal(selectEasyCareProducts(catalog,drafts).length,0);
});
test("maximum four entries with actual price, image and inventory",()=>{
 const catalog=Array.from({length:8},(_,i)=>product("Planta "+i,{id:String(i),difficulty:"Fácil"}));
 catalog.push(product("Sin imagen",{id:"invalid",image:"",difficulty:"Fácil"}));
 assert.equal(selectEasyCareProducts(catalog,drafts).length,4);
});
test("no invented catalogue products when none match",()=>{
 assert.deepEqual(selectEasyCareProducts([],drafts),[]);
 assert.deepEqual(selectEasyCareProducts([product("Inventado")],drafts),[]);
});
