import test from "node:test";
import assert from "node:assert/strict";
import {assessCjDistanceSaleCompliance} from "../src/app/lib/cjDistanceSaleCompliance.js";
const base={name:"Artículo CJ",sku:"SKU",metadata:{
 sourceHost:"cjdropshipping.com",fulfillmentType:"dropship",
 gpsrManufacturerName:"Fábrica real",gpsrManufacturerPostalAddress:"Calle 1, Shanghai, China",
 gpsrManufacturerEmail:"support@example.com",gpsrManufacturerCountryCode:"CN",
 gpsrEuResponsibleName:"Representante UE",gpsrEuResponsiblePostalAddress:"Calle 2, Madrid, España",
 gpsrEuResponsibleEmail:"contact@example.es",gpsrNoWarningsApplicable:true,
 gpsrSafetyReviewed:true,cjImportArrangement:"DDP",cjImportCostsReviewed:true,cjAdditionalImportCostEur:3
}};
test("CJ with no identity or customs documentation never counts as legal-ready",()=>{
 const a=assessCjDistanceSaleCompliance({name:"Imported",metadata:{sourceHost:"cjdropshipping.com",fulfillmentType:"dropship"}});
 assert.equal(a.ready,false);
 assert.ok(a.blockers.some(x=>x.includes("fabricante")));
 assert.ok(a.blockers.some(x=>x.includes("aduanas")));
});
test("documented manufacturer outside EU needs an EU responsible person",()=>{
 const {gpsrEuResponsibleName,gpsrEuResponsiblePostalAddress,gpsrEuResponsibleEmail,...m}=base.metadata;
 const a=assessCjDistanceSaleCompliance({...base,metadata:m});
 assert.equal(a.ready,false);
 assert.ok(a.blockers.some(x=>x.includes("responsable")));
});
test("a documented EU manufacturer does not need a separate EU responsible person",()=>{
 const m={...base.metadata,gpsrManufacturerCountryCode:"ES"};
 delete m.gpsrEuResponsibleName;delete m.gpsrEuResponsiblePostalAddress;delete m.gpsrEuResponsibleEmail;
 assert.equal(assessCjDistanceSaleCompliance({...base,metadata:m}).ready,true);
});
test("additional import cost is explicit and included, not silently assumed zero",()=>{
 assert.equal(assessCjDistanceSaleCompliance(base).additionalImportCostEur,3);
 assert.equal(assessCjDistanceSaleCompliance({...base,metadata:{...base.metadata,cjAdditionalImportCostEur:""}}).ready,false);
 assert.equal(assessCjDistanceSaleCompliance({...base,metadata:{...base.metadata,cjImportCostsReviewed:false}}).ready,false);
 assert.equal(assessCjDistanceSaleCompliance({...base,metadata:{...base.metadata,gpsrNoWarningsApplicable:false}}).ready,false);
 assert.equal(assessCjDistanceSaleCompliance({metadata:{}}).ready,true);
});
