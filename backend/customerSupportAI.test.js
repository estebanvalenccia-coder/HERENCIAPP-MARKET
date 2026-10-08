import test from "node:test";
import assert from "node:assert/strict";
import { needsHumanSupport, answerGeneralSupport } from "./customerSupportAI.js";

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
