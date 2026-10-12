import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {chooseCjValidationVariant,cjSpanishFreightPreviewSamples,recommendCjPreviewMethod} from "./cjAdminAutoValidation.js";

const variant={vid:"2074707068783022081",sku:"CJYL29731560001",priceUsd:6.06};

test("selects only saved VID or unique real CJ variant",()=>{
  assert.equal(chooseCjValidationVariant([variant],"").variant,variant);
  assert.equal(chooseCjValidationVariant([variant,{...variant,vid:"OTHER"}],"").reason,"SELECT_EXACT_VARIANT");
  assert.equal(chooseCjValidationVariant([variant,{...variant,vid:"OTHER"}],variant.vid).variant,variant);
  assert.equal(chooseCjValidationVariant([]).reason,"NO_VARIANTS");
  assert.equal(chooseCjValidationVariant([{vid:"a",sku:""}]).reason,"SELECT_EXACT_VARIANT");
});

test("reference ZIP retries only diagnostic examples for Spain",()=>{
  assert.deepEqual(cjSpanishFreightPreviewSamples("ES"),["28001","08001"]);
  assert.deepEqual(cjSpanishFreightPreviewSamples("FR"),[]);
});

test("shipping recommendation requires complete postage and positive margin",()=>{
  const methods=[
    {name:"missing-postage",shippingUsd:1,profitability:{available:true,feasible:true}},
    {name:"unprofitable",totalPostageUsd:2,profitability:{available:true,feasible:false}},
    {name:"safe",totalPostageUsd:5,profitability:{available:true,feasible:true}},
    {name:"expensive",totalPostageUsd:10,profitability:{available:true,feasible:true}},
  ];
  assert.equal(recommendCjPreviewMethod(methods)?.name,"safe");
  assert.equal(recommendCjPreviewMethod([{name:"x",totalPostageUsd:1,profitability:{available:false}}]),null);
});

test("auto validation action uses only read-only supplier calls",()=>{
  const panel=readFileSync(new URL("../src/app/components/admin/AdminSuppliersPanel.tsx",import.meta.url),"utf8");
  const from=panel.indexOf("const autoValidateCjProduct = async");
  const to=panel.indexOf("const inspectCjStockAndCost = async",from);
  assert.ok(from>0 && to>from);
  const implementation=panel.slice(from,to);
  assert.match(implementation,/listCjProductVariants/);
  assert.match(implementation,/checkCjVariantReadiness/);
  assert.match(implementation,/quoteCjProductFreight/);
  assert.doesNotMatch(implementation,/onSave\(|updateCommerceProduct/);
});
