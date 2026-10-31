import test from "node:test";
import assert from "node:assert/strict";
import {verifyLocalPickup,localPickupSettings} from "./localPickupPolicy.js";

const settings = {localPickup:{enabled:true,label:"Metro Horta, Barcelona"}};
const own = {id:"maceta-1",type:"product",active:true};

test("local pickup requires admin activation",()=>{
  assert.throws(()=>verifyLocalPickup({shippingSettings:{},shippingChoice:{method:"local_pickup"},lines:[{id:"maceta-1"}],catalog:[own]}),/habilitada/);
});
test("valid own item has zero shipping",()=>{
  const result=verifyLocalPickup({shippingSettings:settings,shippingChoice:{method:"local_pickup"},lines:[{id:"maceta-1"}],catalog:[own]});
  assert.equal(result.price,0);
  assert.equal(result.label,"Metro Horta, Barcelona");
});
test("dropshipping and services cannot be collected",()=>{
  for(const p of [{...own,metadata:{provider:"cj"}},{...own,type:"service"},{...own,metadata:{provider:"printful"}}]){
    assert.throws(()=>verifyLocalPickup({shippingSettings:settings,shippingChoice:{method:"local_pickup"},lines:[{id:p.id}],catalog:[p]}),/productos propios/);
  }
});
test("unknown modes and items fail closed",()=>{
  assert.throws(()=>verifyLocalPickup({shippingSettings:settings,shippingChoice:{method:"other"},lines:[{id:"maceta-1"}],catalog:[own]}),/desconocido/);
  assert.throws(()=>verifyLocalPickup({shippingSettings:settings,shippingChoice:{method:"local_pickup"},lines:[{id:"fake"}],catalog:[own]}),/no disponible/);
});
test("normal delivery remains unchanged",()=>{
  assert.equal(verifyLocalPickup({shippingSettings:settings,shippingChoice:{method:"delivery"},lines:[{id:"maceta-1"}],catalog:[own]}),null);
  assert.equal(verifyLocalPickup({shippingSettings:settings,shippingChoice:{method:"sendcloud"},lines:[{id:"maceta-1"}],catalog:[own]}),null);
  assert.equal(verifyLocalPickup({shippingSettings:settings,shippingChoice:{method:"manual_shipping"},lines:[{id:"maceta-1"}],catalog:[own]}),null);
  assert.equal(localPickupSettings({}).enabled,false);
});
