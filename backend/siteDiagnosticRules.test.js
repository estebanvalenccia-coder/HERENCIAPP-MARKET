import test from "node:test";
import assert from "node:assert/strict";
import {contrastRatio,diagnoseMarketSite} from "../src/app/lib/siteDiagnosticRules.mjs";

test("contrast tests meet WCAG 4.5 threshold for strong combinations",()=>{
  assert.ok(contrastRatio("#000000","#ffffff")>20);
  assert.ok(contrastRatio("#ffffff","#ffffff")<4.5);
  assert.equal(contrastRatio("javascript:evil","#ffffff"),null);
});
test("warns about unregistered components and unreadable styles",()=>{
  const warnings=diagnoseMarketSite({brand:{},builder:{blocks:[]}},{
    navigation:[],home:{title:"Herencia",categories:[],services:[]},
    componentControls:{"unknown.unwired":{enabled:true,desktop:false,tablet:false,mobile:false,design:{textColor:"#ffffff",backgroundColor:"#ffffff"}}}
  },["home.hero"]);
  assert.ok(warnings.some(x=>x.includes("sin registro frontend")));
  assert.ok(warnings.some(x=>x.includes("todos los dispositivos")));
  assert.ok(warnings.some(x=>x.includes("contraste bajo")));
});
test("spots duplicate menu destinations and missing card fields",()=>{
  const warnings=diagnoseMarketSite({brand:{logoUrl:"https://example.com/logo.svg",logoAlt:""},builder:{blocks:[]}},{
    navigation:[{label:"Inicio",href:"/"},{label:"Home",href:"/"}],
    home:{title:"",categories:[{title:"Plantas",visible:true,imageUrl:"",href:""}],services:[]},componentControls:{},
  },[]);
  assert.ok(warnings.some(x=>x.includes("comparten destino")));
  assert.ok(warnings.some(x=>x.includes("sin imagen")));
  assert.ok(warnings.some(x=>x.includes("texto alternativo")));
  assert.ok(warnings.some(x=>x.includes("título principal")));
});
