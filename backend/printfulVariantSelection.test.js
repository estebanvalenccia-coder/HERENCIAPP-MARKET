import test from "node:test";
import assert from "node:assert/strict";
import {isPrintfulProduct,needsExplicitVariantSelection,validPrintfulCartSelection,firstUnselectedPrintfulItem,removeStalePrintfulLines}
 from "../src/app/lib/printfulVariantSelection.js";
const variants=[
 {name:"White / XS",printfulSyncVariantId:"101",printfulCatalogVariantId:"9526",printfulAvailability:"active"},
 {name:"White / M",printfulSyncVariantId:"102",printfulCatalogVariantId:"4012",printfulAvailability:"active"},
];
const product={id:"camisa",metadata:{provider:"printful"},variants};
test("Printful and any multi-variant product must open variant selection",()=>{
 assert.equal(isPrintfulProduct(product),true);
 assert.equal(needsExplicitVariantSelection(product),true);
 assert.equal(needsExplicitVariantSelection({variants}),true);
 assert.equal(needsExplicitVariantSelection({variants:[{name:"Base"}]}),false);
});
test("old cart default White XS cannot reach payment",()=>{
 const stale={...product,selectedVariant:"White / XS",price:20};
 assert.equal(validPrintfulCartSelection(stale),false);
 assert.equal(firstUnselectedPrintfulItem([stale]),stale);
 assert.equal(validPrintfulCartSelection({...stale,printfulVariantChosen:true}),false);
});
test("explicit variant must match authentic supplier IDs and live availability",()=>{
 const chosen={...product,selectedVariant:"White / M",price:25,
  printfulVariantChosen:true,printfulSyncVariantId:"102",printfulCatalogVariantId:"4012"};
 assert.equal(validPrintfulCartSelection(chosen),true);
 assert.equal(validPrintfulCartSelection({...chosen,printfulSyncVariantId:"101"}),false);
 assert.equal(validPrintfulCartSelection({...chosen,selectedVariant:"White / XL"}),false);
 assert.equal(validPrintfulCartSelection({...chosen,variants:variants.map(v=>({...v,printfulAvailability:"unknown"}))}),false);
 assert.equal(firstUnselectedPrintfulItem([chosen]),null);
 assert.deepEqual(removeStalePrintfulLines([{...product,selectedVariant:"White / XS"},chosen,{id:"rose"}],"camisa"),[chosen,{id:"rose"}]);
 assert.equal(firstUnselectedPrintfulItem([{id:"rose",metadata:{}}]),null);
});
