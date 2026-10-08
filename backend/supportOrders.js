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
function deliveryDetails(row) {
  // A tracking number or carrier is displayed only when recorded on the order.
  const metadata=row.metadata && typeof row.metadata==="object" ? row.metadata : {};
  const shipment=metadata.shipment && typeof metadata.shipment==="object" ? metadata.shipment : {};
  const shipping=metadata.shipping && typeof metadata.shipping==="object" ? metadata.shipping : {};
  const method=String(row.fulfillment_method||row.delivery_method||metadata.fulfillmentMethod||metadata.deliveryMethod||metadata.shippingMethod||"").toLowerCase();
  const dropship=/dropship|cj.*fulfill|proveedor externo/.test(method)||metadata.isDropshipping===true;
  const own=/local_delivery|own_delivery|reparto propio|entrega propia|herencia delivery/.test(method)||metadata.isLocalDelivery===true;
  if(own){
    return " Es una entrega gestionada directamente por Herencia en Barcelona; no necesita transportista externo ni código de seguimiento. El estado se actualizará cuando el equipo registre la preparación y la entrega.";
  }
  if(!dropship)return "";
  const carrier=String(row.carrier||row.shipping_carrier||shipment.carrier||shipping.carrier||metadata.carrier||"").trim();
  const tracking=String(row.tracking_number||row.trackingNumber||shipment.trackingNumber||shipment.tracking_number||shipping.trackingNumber||metadata.trackingNumber||"").trim();
  const details=[" Es un envío gestionado por el proveedor de dropshipping."];
  if(carrier && carrier.length<=90)details.push(" Transportista registrado: "+carrier.replace(/[<>]/g,"")+".");
  if(tracking && tracking.length<=110)details.push(" Código de seguimiento registrado: "+tracking.replace(/[<>]/g,"")+".");
  if(!carrier&&!tracking)details.push(" El proveedor todavía no ha facilitado datos de seguimiento; no puedo confirmar qué transportista utilizará.");
  return details.join("");
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
    return (index===0?"Tu pedido más reciente":"Otro pedido") + " figura como «"+label+"»."+deliveryDetails(row);
  });
  return summary.join(" ")+" Puedes entrar a Mi cuenta para ver tus pedidos. Este estado procede de los registros de Herencia y no garantiza la ubicación en tiempo real.";
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
