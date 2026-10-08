import test from "node:test";
import assert from "node:assert/strict";
import { needsHumanSupport, answerGeneralSupport, canAppendSupportAIReply } from "./customerSupportAI.js";

test("payments, refunds, deliveries and human requests must transfer to an agent", () => {
  for (const query of [
    "Me han hecho un cobro duplicado",
    "Quiero devolver mi pedido",
    "El paquete no llegó",
    "Hablar con una persona",
    "Mi pedido llegó roto",
    "Me gustaría cancelar la compra",
  ]) {
    assert.equal(needsHumanSupport(query), true, query);
  }
});

test("general questions can use the support assistant", () => {
  assert.equal(needsHumanSupport("¿Qué horario tenéis?"), false);
  assert.equal(needsHumanSupport("¿Cómo cuido un pothos?"), false);
});

test("human escalation does not require a model key or a network request", async () => {
  const result = await answerGeneralSupport("Necesito un reembolso y hablar con alguien");
  assert.equal(result.needsHuman, true);
  assert.match(result.reply, /persona de Herencia/i);
});

test("email and long phone numbers are not forwarded to a model", async () => {
  const result = await answerGeneralSupport("Mi email es example@example.com");
  assert.equal(result.needsHuman, true);
  const phoneResult = await answerGeneralSupport("Llámame al +34 612 345 678");
  assert.equal(phoneResult.needsHuman, true);
});

test("AI replies never overwrite a human reply or a newer customer message", () => {
  const oldUserMessage = { id: "user-1", role: "customer", text: "Horario" };
  const open = { status: "open", messages: [oldUserMessage] };
  assert.equal(canAppendSupportAIReply(open, "user-1"), true);

  const withAgent = { status: "answered", messages: [...open.messages, { id: "agent-1", role: "agent" }] };
  assert.equal(canAppendSupportAIReply(withAgent, "user-1"), false);

  const withNewMessage = {
    status: "open",
    messages: [...open.messages, { id: "user-2", role: "customer", text: "Nueva consulta" }],
  };
  assert.equal(canAppendSupportAIReply(withNewMessage, "user-1"), false);
  assert.equal(canAppendSupportAIReply(withNewMessage, "user-2"), true);
  assert.equal(canAppendSupportAIReply({ ...open, status: "resolved" }, "user-1"), false);
  assert.equal(canAppendSupportAIReply(open, ""), false);
});
