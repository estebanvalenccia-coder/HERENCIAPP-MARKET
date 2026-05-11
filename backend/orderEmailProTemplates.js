export function formatCurrency(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function normalizeOrderForEmail(order = {}) {
  const metadata = order.metadata || {};
  return {
    id: order.id || metadata.orderId || "pedido",
    customerName: order.customer_name || order.customerName || order.name || metadata.customerName || "Cliente",
    customerEmail: order.customer_email || order.customerEmail || order.email || metadata.customerEmail || "",
    customerPhone: order.customer_phone || order.customerPhone || order.phone || metadata.phone || metadata.customerPhone || "No indicado",
    address: order.address || metadata.address || metadata.deliveryAddress || metadata.street || "No indicada",
    postalCode: order.postal_code || order.postalCode || metadata.postalCode || metadata.zip || "",
    city: order.city || metadata.city || "Barcelona",
    items: Array.isArray(order.items) ? order.items : [],
    subtotal: Number(order.subtotal || 0),
    shipping: Number(order.shipping || 0),
    discount: Number(order.discount || metadata.discount || 0),
    total: Number(order.total || 0),
    paymentMethod: order.payment_method || order.paymentMethod || "tarjeta",
    deliveryMethod: order.delivery_method || order.deliveryMethod || "envio",
    status: order.status || "pending",
    date: order.created_at || order.date || new Date().toISOString(),
    metadata,
  };
}

function paymentLabel(value) {
  const labels = { stripe: "Tarjeta", tarjeta: "Tarjeta", card: "Tarjeta", bizum: "Bizum", cash: "Efectivo", manual: "Pago manual" };
  return labels[String(value || "").toLowerCase()] || value || "No indicado";
}

function statusLabel(value) {
  const labels = { paid: "Pagado", pending: "Pendiente", payment_pending: "Pago pendiente", cancelled: "Cancelado" };
  return labels[String(value || "").toLowerCase()] || value || "Pendiente";
}

function deliveryLabel(value) {
  return String(value || "").toLowerCase() === "recogida" ? "Recogida en tienda" : "Envío a domicilio";
}

function renderItems(items) {
  if (!items.length) {
    return `<tr><td colspan="4" style="padding:18px 0;color:#8b6b61;">No se recibió detalle de productos. Revisa el pedido en el panel.</td></tr>`;
  }

  return items.map((item) => {
    const name = escapeHtml(item.name || item.title || item.productName || "Producto");
    const quantity = Number(item.quantity || item.qty || 1);
    const unitPrice = Number(item.price || item.unitPrice || 0);
    const total = unitPrice * quantity;
    const image = item.image || item.imageUrl || item.photo || "";
    return `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #f1e7df;">
          <div style="display:flex;gap:12px;align-items:center;">
            ${image ? `<img src="${escapeHtml(image)}" width="54" height="54" alt="${name}" style="border-radius:14px;object-fit:cover;border:1px solid #f1e7df;" />` : `<div style="width:54px;height:54px;border-radius:14px;background:#fff1f5;border:1px solid #f1e7df;text-align:center;line-height:54px;font-size:24px;">🌿</div>`}
            <div>
              <div style="font-weight:800;color:#2b1712;font-size:15px;">${name}</div>
              <div style="color:#8b6b61;font-size:12px;margin-top:4px;">Producto del pedido</div>
            </div>
          </div>
        </td>
        <td align="center" style="padding:14px 8px;border-bottom:1px solid #f1e7df;font-weight:700;">${quantity}</td>
        <td align="right" style="padding:14px 8px;border-bottom:1px solid #f1e7df;white-space:nowrap;">${formatCurrency(unitPrice)}</td>
        <td align="right" style="padding:14px 0;border-bottom:1px solid #f1e7df;font-weight:800;white-space:nowrap;">${formatCurrency(total)}</td>
      </tr>`;
  }).join("");
}

function infoRow(label, value) {
  return `<tr><td style="padding:7px 0;color:#8b6b61;font-size:13px;">${label}</td><td align="right" style="padding:7px 0;font-weight:800;color:#2b1712;">${escapeHtml(value || "No indicado")}</td></tr>`;
}

export function renderOrderEmailPro(order, recipientType = "customer") {
  const o = normalizeOrderForEmail(order);
  const isAdmin = recipientType === "admin";
  const title = isAdmin ? "Nuevo pedido en Herencia Market" : "¡Gracias por tu compra!";
  const subtitle = isAdmin
    ? `Se ha recibido una compra de ${escapeHtml(o.customerName)}. Revisa los datos para preparar el pedido.`
    : `Hola ${escapeHtml(o.customerName)}, hemos recibido tu compra correctamente. Aquí tienes el resumen.`;
  const deliveryText = o.deliveryMethod === "recogida"
    ? "Tu pedido será preparado para recogida en tienda. Te avisaremos cuando esté listo."
    : "Tu pedido será preparado para envío a domicilio. Te avisaremos cuando salga para entrega.";

  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#fff7f2;font-family:Arial,Helvetica,sans-serif;color:#2b1712;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${title} · Pedido #${escapeHtml(o.id)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff7f2;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#ffffff;border-radius:30px;overflow:hidden;box-shadow:0 18px 55px rgba(96,46,24,.14);">
        <tr><td style="background:linear-gradient(135deg,#ff5f8f,#ff9671,#ffc75f);padding:36px 30px;text-align:center;color:#fff;">
          <div style="font-size:46px;line-height:1;margin-bottom:12px;">🌸</div>
          <h1 style="margin:0;font-size:30px;line-height:1.15;font-weight:900;">${title}</h1>
          <p style="margin:10px 0 0;font-size:15px;opacity:.95;">Pedido #${escapeHtml(o.id)}</p>
        </td></tr>
        <tr><td style="padding:30px;">
          <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#4d3128;">${subtitle}</p>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fffaf7;border:1px solid #f1e7df;border-radius:22px;padding:18px;margin-bottom:22px;">
            ${infoRow("Cliente", o.customerName)}
            ${infoRow("Email", o.customerEmail)}
            ${infoRow("Teléfono", o.customerPhone)}
            ${infoRow("Entrega", deliveryLabel(o.deliveryMethod))}
            ${infoRow("Dirección", `${o.address}${o.postalCode ? `, ${o.postalCode}` : ""}${o.city ? `, ${o.city}` : ""}`)}
            ${infoRow("Método de pago", paymentLabel(o.paymentMethod))}
            ${infoRow("Estado", statusLabel(o.status))}
          </table>

          <h2 style="font-size:20px;margin:0 0 12px;color:#2b1712;">Detalle de la compra</h2>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:22px;">
            <tr>
              <th align="left" style="padding:0 0 10px;color:#8b6b61;font-size:12px;text-transform:uppercase;">Producto</th>
              <th align="center" style="padding:0 8px 10px;color:#8b6b61;font-size:12px;text-transform:uppercase;">Cant.</th>
              <th align="right" style="padding:0 8px 10px;color:#8b6b61;font-size:12px;text-transform:uppercase;">Unidad</th>
              <th align="right" style="padding:0 0 10px;color:#8b6b61;font-size:12px;text-transform:uppercase;">Total</th>
            </tr>
            ${renderItems(o.items)}
          </table>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#2b1712;color:#fff;border-radius:22px;padding:20px;margin-bottom:22px;">
            <tr><td style="padding:6px 0;color:#f8d8cc;">Subtotal</td><td align="right" style="padding:6px 0;font-weight:800;">${formatCurrency(o.subtotal)}</td></tr>
            <tr><td style="padding:6px 0;color:#f8d8cc;">Envío</td><td align="right" style="padding:6px 0;font-weight:800;">${formatCurrency(o.shipping)}</td></tr>
            ${o.discount ? `<tr><td style="padding:6px 0;color:#f8d8cc;">Descuento</td><td align="right" style="padding:6px 0;font-weight:800;">-${formatCurrency(o.discount)}</td></tr>` : ""}
            <tr><td style="padding:14px 0 0;font-size:19px;font-weight:900;">Total pagado</td><td align="right" style="padding:14px 0 0;font-size:24px;font-weight:900;color:#ffc75f;">${formatCurrency(o.total)}</td></tr>
          </table>

          <div style="background:#fff1f5;border:1px solid #ffd7e2;border-radius:20px;padding:18px;color:#5f332c;line-height:1.6;font-size:14px;">
            <strong>${isAdmin ? "Acción recomendada:" : "Información de entrega:"}</strong><br>
            ${isAdmin ? "Prepara el pedido, confirma los datos del cliente y actualiza el estado desde el panel de administración." : deliveryText}
          </div>

          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#8b6b61;text-align:center;">
            ${isAdmin ? "Este correo es interno para gestionar el pedido." : "Gracias por confiar en Herencia Market. Prepararemos tu pedido con mucho cariño."}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
