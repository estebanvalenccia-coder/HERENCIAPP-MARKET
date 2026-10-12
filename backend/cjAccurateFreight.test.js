import test from "node:test";
import assert from "node:assert/strict";
import {buildCjAccurateFreightPayload,interpretCjAccurateFreightRates} from "./cjAccurateFreight.js";
const input={product:{pid:"PRODUCT1",productProEnSet:["COMMON"],productType:"0"},
 variant:{vid:"VID1",pid:"PRODUCT1",variantSku:"CJ-RED",variantWeight:1580,variantVolume:6000000,variantSellPrice:6.06},
 vid:"VID1",origin:"CN",destination:"ES",zip:"28001",quantity:1};
test("accurate CJ freight uses exact SKU, VID, genuine grams and cubic centimetres",()=>{
 const data=buildCjAccurateFreightPayload(input);
 assert.deepEqual(data.reqDTOS[0].productProp,["COMMON"]);
 assert.equal(data.reqDTOS[0].weight,1580);
 assert.equal(data.reqDTOS[0].volume,6000);
 assert.equal(data.reqDTOS[0].freightTrialSkuList[0].vid,"VID1");
 assert.equal(data.reqDTOS[0].freightTrialSkuList[0].sku,"CJ-RED");
 assert.equal(data.reqDTOS[0].zip,"28001");
});
test("never send fabricated or mismatched variant logistics to CJ freight tip",()=>{
 for(const variant of [
   {...input.variant,vid:"OTHER"},{...input.variant,pid:"OTHER"},
   {...input.variant,variantWeight:null},{...input.variant,variantVolume:0},
   {...input.variant,variantSellPrice:null},{...input.variant,variantSku:""},
 ]){
   assert.equal(buildCjAccurateFreightPayload({...input,variant}),null);
 }
 assert.equal(buildCjAccurateFreightPayload({...input,product:{...input.product,productProEnSet:[]}}),null);
});
test("shipping fallback counts ONLY official totalPostageFee as checkout cost",()=>{
 const result=interpretCjAccurateFreightRates([
   {option:{enName:"CJPacket"},arrivalTime:"7-15",wrapPostage:4.09,totalPostageFee:5.41},
   {option:{enName:"Preliminary"},wrapPostage:2.5,totalPostageFee:null},
   {option:{enName:"Unavailable"},wrapPostage:1,totalPostageFee:1,errorEn:"not available"},
 ]);
 assert.equal(result.length,2);
 assert.equal(result.find(x=>x.name==="CJPacket").totalPostageUsd,5.41);
 assert.equal(result.find(x=>x.name==="Preliminary").totalPostageUsd,null);
 assert.equal(result.some(x=>x.name==="Unavailable"),false);
});
