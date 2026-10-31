import test from "node:test";
import assert from "node:assert/strict";
import {isLivePlant,isCarrierEligibleProduct,cartShippingGroup,merchantShippingQuote} from "./catalogShippingRules.js";
const plant={id:"p",type:"plant",category:"plantas-interior",name:"Monstera"};
const pot={id:"g",type:"decor",category:"macetas-3d",name:"Maceta blanca",metadata:{weight:"500 g",dimensions:"20 x 20 x 15 cm"}};
const mixedPot={id:"pg",type:"decor",category:"macetas-3d",name:"Planta de Ají con maceta"};
const settings={manualDelivery:{enabled:true,acceptsLivePlants:true,carrierName:"Transportista autorizado",rates:{plants:6.9,mixed:9.9,goods:4.5}}};
test("Plants in decorative pots count as living plants",()=>{
 assert.equal(isLivePlant(mixedPot),true);
 assert.equal(isLivePlant(pot),false);
 assert.equal(isCarrierEligibleProduct(mixedPot),false);
 assert.equal(isCarrierEligibleProduct(pot),true);
 assert.equal(isCarrierEligibleProduct({...pot,metadata:{provider:"CJ"}}),false);
 assert.equal(isCarrierEligibleProduct({...pot,category:"insecticidas"}),false);
});
test("A mixed cart has one explicit merchant-managed rate without trusting cart prices",()=>{
 const q=merchantShippingQuote({settings,lines:[{id:"p",quantity:1,price:0},{id:"g",quantity:2,price:0}],catalog:[plant,pot],toZip:"28001"});
 assert.deepEqual([q.service,q.price,q.currency,q.requiresMerchantBooking],["mixed",9.9,"EUR",true]);
 assert.equal(cartShippingGroup({lines:[{id:"pg",quantity:1}],catalog:[mixedPot]}).group,"plants");
 assert.equal(merchantShippingQuote({settings,lines:[{id:"p",quantity:1}],catalog:[plant],toZip:"08032"}).price,6.9);
 assert.equal(merchantShippingQuote({settings,lines:[{id:"g",quantity:1}],catalog:[pot],toZip:"08032"}).price,4.5);
});
test("No plant shipping without carrier confirmation, destination, or configured method",()=>{
 const args={settings,lines:[{id:"p",quantity:1}],catalog:[plant],toZip:"28001"};
 assert.equal(merchantShippingQuote({...args,settings:{manualDelivery:{...settings.manualDelivery,acceptsLivePlants:false}}}),null);
 assert.equal(merchantShippingQuote({...args,settings:{}}),null);
 for(const zip of ["35001","07001","51001","00000","abc"])assert.equal(merchantShippingQuote({...args,toZip:zip}),null);
 assert.equal(merchantShippingQuote({...args,lines:[{id:"p",quantity:1},{id:"missing",quantity:1}]}),null);
 assert.equal(merchantShippingQuote({...args,catalog:[{...plant,supplierType:"CJ"}]}),null);
});
