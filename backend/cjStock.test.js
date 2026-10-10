import test from "node:test";
import assert from "node:assert/strict";
import { interpretCjVariantStock } from "./cjCatalogImporter.js";

test("stock is counted for the exact VID and chosen origin warehouse only",()=>{
 const rows=[
  {vid:"VID-A",countryCode:"CN",storageNum:8},
  {vid:"VID-A",countryCode:"US",storageNum:9999},
  {vid:"VID-B",countryCode:"CN",storageNum:0},
 ];
 assert.deepEqual(interpretCjVariantStock(rows,"VID-A","CN"),{
   available:true,quantity:8,verified:true,vid:"VID-A",origin:"CN",source:"cj_api"
 });
 assert.equal(interpretCjVariantStock(rows,"VID-B","CN").available,false);
 assert.equal(interpretCjVariantStock(rows,"VID-A","DE").verified,false);
});
test("incomplete or malformed warehouse inventory never counts as available",()=>{
 assert.equal(interpretCjVariantStock([{vid:"X",countryCode:"CN"}],"X").verified,false);
 assert.equal(interpretCjVariantStock([{vid:"X",countryCode:"CN",storageNum:"five"}],"X").available,false);
 assert.equal(interpretCjVariantStock(null,"X").available,false);
});
