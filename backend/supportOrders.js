// Verified, server-side order status answers; never send order rows to a model.
const STATUS_LABELS = Object.freeze({
  payment_pending: "pendiente de pago", pending: "pendiente de confirmación",
  pending_bizum_review: "Bizum pendiente de revisión",
  pending_manual_review: "pago pendiente de revisión",
  pending_transfer_review: "transferencia pendiente de revisión",
  paid: "pagado", confirmed: "confirmado",
  preparing: "en preparación", processing: "en preparación",
  ready: "preparado", ready_for_delivery: "preparado para entrega",
  shipped: "enviado", in_transit: "en tránsito",
  out_for_delivery: "en reparto", delivered: "entregado",
  completed: "completado", cancelled: "cancelado", refunded: "reembolsado",
  failed: "no confirmado", rejected: "rechazado",
});
export function isOrderStatusQuestion(question = "") {
  const text=String(question||"").toLowerCase();
  const order=/(pedido|paquete|env[ií]o|compra)/i.test(text);
  const status=/(estado|seguimiento|d[oó]nde|localiz|llegar[aá]|cu[aá]ndo llega|cu[aá]ndo recibir|ya ha salid|en camino|rastre)/i.test(text);
  return order && status;
}
export function summarizeOwnOrders(orders) {
  const rows=(Array.isArray(orders)?orders:[])
    .filter(o=>o&&typeof o==="object")
    .sort((a,b)=>new Date(b.created_at||b.date||0).getTime()-new Date(a.created_at||a.date||0).getTime())
    .slice(0,3);
  if(!rows.length) return "No encuentro pedidos vinculados a tu cuenta actual. Si hiciste la compra sin iniciar sesión, puedes consultar el correo de confirmación o contactar con nuestro equipo. No compartas datos bancarios en el chat.";
  const summary=rows.map((row,index)=>{
    const raw=String(row.status||"").trim().toLowerCase();
    const label=STATUS_LABELS[raw]||"pendiente de consultar";
    return (index===0?"Tu pedido más reciente":"Otro pedido") + " figura como «"+label+"»";
  });
  return summary.join(". ")+". Puedes entrar a Mi cuenta para ver tus pedidos. Este estado procede de los registros de Herencia, pero no confirma la ubicación exacta de un transportista.";
}
export async function answerOwnOrderStatus({ question, ownerType, ownerId, loadCustomerAccounts, listOrdersByEmail }) {
  if(!isOrderStatusQuestion(question)) return null;
  if(ownerType!=="customer") return "Para consultar el estado real de tus pedidos necesitas iniciar sesión en Mi cuenta. Mientras tanto, puedo explicarte cómo se realizan los envíos o qué hacer si se retrasa una entrega.";
  if(typeof listOrdersByEmail!=="function") return "Ahora mismo no puedo consultar el estado del pedido de forma segura. Puedes verlo en Mi cuenta o, si no está disponible, te ofreceré contactar con Amigo Plantil.";
  const accounts=await loadCustomerAccounts();
  const owner=Array.isArray(accounts)?accounts.find(x=>String(x.id)===String(ownerId)):null;
  const email=String(owner?.email||"").toLowerCase().trim();
  if(!email) return "No encuentro una cuenta verificada para consultar pedidos. Inicia sesión nuevamente antes de continuar.";
  const rows=await listOrdersByEmail(email);
  return summarizeOwnOrders(rows);
}
