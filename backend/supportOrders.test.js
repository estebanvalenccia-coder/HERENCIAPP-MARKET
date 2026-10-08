import test from "node:test";
import assert from "node:assert/strict";
import { isOrderStatusQuestion, summarizeOwnOrders, answerOwnOrderStatus } from "./supportOrders.js";

test("status lookup runs only on explicit order-status questions",()=>{
  for(const q of ["¿Cuál es el estado de mi pedido?", "¿Dónde está mi paquete?", "¿Cuándo llega mi envío?"]){
    assert.equal(isOrderStatusQuestion(q),true,q);
  }
  for(const q of ["Quiero un reembolso", "Mi pedido llegó roto", "Quiero devolver mi compra", "Hola", "¿Dónde está vuestra tienda?"]){
    assert.equal(isOrderStatusQuestion(q),false,q);
  }
});
test("order status reply returns verified status but no email, address, phone, invoice or card data",()=>{
  const reply=summarizeOwnOrders([
    {id:"private-12345",status:"preparing",created_at:"2026-10-08T10:00:00", customer_email:"ana@example.com", shipping_address:"SECRET ADDRESS", metadata:{card:"4111111111111111"}},
    {id:"private-50000",status:"delivered",created_at:"2026-09-01T10:00:00"},
  ]);
  assert.match(reply,/preparación|entregado/);
  assert.doesNotMatch(reply,/private|example\.com|SECRET|4111111/);
});
test("guests never reach the order database or receive private status",async()=>{
  let calls=0;
  const reply=await answerOwnOrderStatus({
    question:"¿Dónde está mi pedido?",ownerType:"guest",ownerId:"guest-1",
    loadCustomerAccounts:async()=>{calls++;return [{id:"a",email:"a@example.com"}]},
    listOrdersByEmail:async()=>{calls++;return [{status:"delivered"}]},
  });
  assert.match(reply,/iniciar sesión/i);
  assert.equal(calls,0);
});
test("customer lookup always uses server-verified own account email, not user-provided identifiers",async()=>{
  const lookedUp=[];
  const common={
    question:"¿Cuál es el estado de mi pedido?",ownerType:"customer",
    loadCustomerAccounts:async()=>[
      {id:"a",email:"a@example.com"},{id:"b",email:"b@example.com"},
    ],
    listOrdersByEmail:async email=>{lookedUp.push(email);return email==="a@example.com"?[{status:"paid"}]:[{status:"preparing"}]},
  };
  const a=await answerOwnOrderStatus({...common,ownerId:"a"});
  const b=await answerOwnOrderStatus({...common,ownerId:"b"});
  assert.deepEqual(lookedUp,["a@example.com","b@example.com"]);
  assert.match(a,/pagado/);
  assert.match(b,/preparación/);
  assert.doesNotMatch(a,/preparación/);
});

test("Barcelona own delivery never invents a courier or tracking number",()=>{
  const reply=summarizeOwnOrders([{status:"out_for_delivery",metadata:{deliveryMethod:"local_delivery",isLocalDelivery:true}}]);
  assert.match(reply,/directamente por Herencia en Barcelona/i);
  assert.match(reply,/no necesita transportista externo/i);
  assert.doesNotMatch(reply,/Transportista registrado|Código de seguimiento registrado/);
});
test("dropshipping courier remains unknown until provider assigns one",()=>{
  const unknown=summarizeOwnOrders([{status:"preparing",metadata:{fulfillmentMethod:"dropshipping"}}]);
  assert.match(unknown,/proveedor todavía no ha facilitado/i);
  assert.doesNotMatch(unknown,/DHL|Correos|SEUR/);
  const assigned=summarizeOwnOrders([{status:"shipped",metadata:{fulfillmentMethod:"dropshipping",shipment:{carrier:"DHL",trackingNumber:"TRACK-123"}}}]);
  assert.match(assigned,/Transportista registrado: DHL/);
  assert.match(assigned,/Código de seguimiento registrado: TRACK-123/);
});
