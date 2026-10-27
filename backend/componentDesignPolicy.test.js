import test from "node:test";
import assert from "node:assert/strict";
import { normalizeComponentDesign } from "../src/app/lib/componentDesignPolicy.mjs";

test("visual design accepts safe colors and bounded numbers",()=>{
  const safe=normalizeComponentDesign({backgroundColor:"#abcdef",textColor:"#173126",paddingY:500,radius:-2,headingSize:30,maxWidth:1200,animation:"fade-in"});
  assert.deepEqual(safe,{backgroundColor:"#abcdef",textColor:"#173126",paddingY:140,radius:0,headingSize:30,maxWidth:1200,animation:"fade-in"});
});
test("unsafe CSS cannot become inline styles",()=>{
  const data=normalizeComponentDesign({backgroundColor:"red;transform:scale(50)",textColor:"url(javascript:evil())",shadow:"url(javascript:evil())",fontFamily:"evil",paddingY:Infinity,animation:"spin"});
  assert.deepEqual(data,{});
});
test("unconfigured elements retain unmodified storefront appearance",()=>{
  assert.deepEqual(normalizeComponentDesign(),{});
  assert.deepEqual(normalizeComponentDesign(null),{});
});
