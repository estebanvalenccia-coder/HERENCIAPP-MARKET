import test from "node:test";
import assert from "node:assert/strict";
import { needsHumanSupport, answerGeneralSupport, canAppendSupportAIReply, containsPrivateSupportData, safeSupportHistory } from "./customerSupportAI.js";

test("refunds, order questions and delivery problems are handled before human escalation", () => {
  for(const question of [
    "Me han hecho un cobro duplicado",
    "Quiero devolver mi pedido",
    "El paquete no llegó",
    "Mi pedido llegó roto",
    "Me gustaría cancelar la compra",
    "¿Qué horario tenéis?",
    "¿Cómo cuido un pothos?",
  ]) assert.equal(needsHumanSupport(question),false,question);
});
test("direct requests for a person remain eligible for human handoff", () => {
  for(const q of ["Quiero hablar con una persona","Necesito contactar con un agente","Puedo hablar con un operador"]) {
    assert.equal(needsHumanSupport(q),true,q);
  }
});
test("AI gives safe first steps for refunds and deliveries without a model key", async () => {
  const previous=process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  try{
    const refund=await answerGeneralSupport("Quiero un reembolso");
    assert.equal(refund.needsHuman,false);
    assert.match(refund.reply,/dañado|devolverlo|devolución/i);
    const shipment=await answerGeneralSupport("Mi pedido no llegó");
    assert.equal(shipment.needsHuman,false);
    assert.match(shipment.reply,/pedido|entrega/i);
    const human=await answerGeneralSupport("Necesito hablar con una persona");
    assert.equal(human.needsHuman,true);
    assert.match(human.reply,/Amigo Plantil/i);
  }finally{
    if(previous===undefined)delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY=previous;
  }
});
test("private details are never sent to the assistant as new text or past history", async()=>{
  for(const value of [
    "example@example.com", "+34 612 345 678", "12345678Z",
    "ES9121000418450200051332", "Mi contraseña es 123", "mi dirección postal",
  ]) assert.equal(containsPrivateSupportData(value),true,value);
  const history=safeSupportHistory([
    {role:"customer",text:"Mi email es example@example.com"},
    {role:"customer",text:"Hola, quiero saber qué opciones existen"},
    {role:"internal",text:"nota interna privada"},
    {role:"assistant",text:"Escríbeme tu pregunta"},
    {role:"customer",text:"Llama al +34 612 345 678"},
  ]);
  assert.equal(history.length,2);
  assert.equal(history[0].content,"Hola, quiero saber qué opciones existen");
  assert.equal(history[1].role,"assistant");
  const fallback=await answerGeneralSupport("Mi email es example@example.com", "", []);
  assert.equal(fallback.needsHuman,false);
  assert.doesNotMatch(fallback.reply,/example@example.com/);
});
test("AI replies cannot overwrite newer messages, agents or resolved conversations", () => {
  const old={id:"user-1",role:"customer",text:"Horario"};
  const open={status:"open",messages:[old]};
  assert.equal(canAppendSupportAIReply(open,"user-1"),true);
  assert.equal(canAppendSupportAIReply({status:"answered",messages:[old,{id:"agent-1",role:"agent"}]},"user-1"),false);
  assert.equal(canAppendSupportAIReply({status:"open",messages:[old,{id:"user-2",role:"customer"}]},"user-1"),false);
  assert.equal(canAppendSupportAIReply({...open,status:"resolved"},"user-1"),false);
});
