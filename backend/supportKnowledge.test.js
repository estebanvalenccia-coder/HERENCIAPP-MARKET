import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSupportKnowledge, validateSupportKnowledgePayload, relevantSupportKnowledge, knowledgeContext } from "./supportKnowledge.js";
import {isPrivateSupportStorageKey} from "./supportStorageSecurity.js";

const examples=[
  {id:"returns",question:"¿Cómo solicito una devolución o reembolso?",answer:"La devolución se solicita mediante el formulario indicado en nuestras condiciones publicadas.",enabled:true},
  {id:"delivery",question:"¿Cuánto tarda el envío?",answer:"Las entregas se coordinan según la zona de servicio y el horario elegido.",enabled:true},
  {id:"secret",question:"Política interna de descuentos",answer:"Esta respuesta desactivada nunca se debe compartir con clientes.",enabled:false},
];

test("published knowledge is selected by query relevance",()=>{
  const reply=relevantSupportKnowledge(examples,"¿Cómo puedo pedir un reembolso?");
  assert.equal(reply[0]?.id,"returns");
  assert.equal(relevantSupportKnowledge(examples,"¿Cuánto tarda el envío?")[0]?.id,"delivery");
  assert.equal(relevantSupportKnowledge(examples,"¿Qué descuentos internos tenéis?").some(x=>x.id==="secret"),false);
});
test("model context contains only relevant enabled and admin-approved answers",()=>{
  const context=knowledgeContext(examples,"Quiero una devolución");
  assert.match(context,/solicita mediante el formulario/);
  assert.doesNotMatch(context,/descuentos|entregas|desactivada/);
});
test("admin content is validated and cannot silently save incomplete or excessive policies",()=>{
  assert.deepEqual(validateSupportKnowledgePayload({articles:examples}),examples);
  for(const bad of [
    {articles:[{id:"x",question:"a",answer:"sin detalles",enabled:true}]},
    {articles:[{id:"x",question:"Devoluciones",answer:"demasiado corta",enabled:"true"}]},
    {articles:[examples[0],examples[0]]},
    {articles:Array(51).fill(examples[0])},
    {articles:[] ,surprise:"ignored"},
    {},
  ]){
    if(Array.isArray(bad.articles)&&bad.articles.length===0){
      assert.deepEqual(validateSupportKnowledgePayload(bad),[]);continue;
    }
    assert.throws(()=>validateSupportKnowledgePayload(bad));
  }
});
test("stored knowledge and disabled entries are normalized consistently",()=>{
  assert.equal(normalizeSupportKnowledge(JSON.stringify(examples)).length,3);
  assert.equal(isPrivateSupportStorageKey("customerSupportKnowledgeBase"),true);
});
