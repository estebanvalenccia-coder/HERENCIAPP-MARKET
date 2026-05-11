export function formatCurrencyEUR(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

export function escapeEmailHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function normalizeHerenciaOrder(order = {}) {
  const metadata = order.metadata || {};
  return {
    id: order.id || metadata.orderId || "pedido",
    customerName: order.customer_name || order.customerName || order.name || metadata.customerName || "Cliente",
    customerEmail: order.customer_email || order.customerEmail || order.email || metadata.customerEmail || "",
    customerPhone: order.customer_phone || order.customerPhone || order.phone || metadata.phone || "No indicado",
    address: order.address || metadata.address || metadata.deliveryAddress || metadata.street || "No indicada",
    postalCode: order.postal_code || order.postalCode || metadata.postalCode || metadata.zip || "",
    city: order.city || metadata.city || "Barcelona",
    notes: order.notes || metadata.notes || metadata.customerNotes || "",
    items: Array.isArray(order.items) ? order.items : [],
    subtotal: Number(order.subtotal || 0),
    shipping: Number(order.shipping || 0),
    discount: Number(order.discount || metadata.discount || 0),
    total: Number(order.total || 0),
    paymentMethod: order.payment_method || order.paymentMethod || "tarjeta",
    deliveryMethod: order.delivery_method || order.deliveryMethod || "envio",
    status: order.status || "pending",
    date: order.created_at || order.date || new Date().toISOString(),
    logoUrl: metadata.logoUrl || "",
  };
}

function labelPayment(value) {
  const labels = { stripe: "Tarjeta", tarjeta: "Tarjeta", card: "Tarjeta", bizum: "Bizum", cash: "Efectivo", manual: "Pago manual" };
  return labels[String(value || "").toLowerCase()] || value || "No indicado";
}

function labelStatus(value) {
  const labels = { paid: "Pagado", pending: "Pendiente", payment_pending: "Pago pendiente", preparing: "Preparando", shipped: "En reparto", delivered: "Entregado", cancelled: "Cancelado" };
  return labels[String(value || "").toLowerCase()] || value || "Pendiente";
}

function labelDelivery(value) {
  return String(value || "").toLowerCase() === "recogida" ? "Recogida en tienda" : "Envío a domicilio";
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch {
    return "Fecha no indicada";
  }
}

function logoBlock(logoUrl = "") {
  if (logoUrl) {
    return `<img src="${escapeEmailHtml(logoUrl)}" alt="Herencia Floristería" width="150" style="display:block;margin:0 auto 18px;max-width:150px;height:auto;" />`;
  }
  return `<div style="margin:0 auto 18px;text-align:center;color:#204b2a;"><div style="width:86px;height:86px;border:2px solid #204b2a;border-radius:44px 44px 8px 8px;margin:0 auto 10px;line-height:86px;font-size:34px;">🌿</div><div style="font-family:Georgia,'Times New Roman',serif;font-size:34px;letter-spacing:2px;font-weight:700;line-height:1;">HERENCIA</div><div style="font-size:14px;letter-spacing:8px;margin-top:6px;">floristería</div></div>`;
}

function infoRow(label, value) {
  return `<tr><td style="padding:7px 0;color:#806f5f;font-size:13px;">${label}</td><td align="right" style="padding:7px 0;font-weight:800;color:#1f3426;">${escapeEmailHtml(value || "No indicado")}</td></tr>`;
}

function itemsRows(items) {
  if (!items.length) return `<tr><td colspan="4" style="padding:18px 0;color:#806f5f;">No se recibió detalle de productos. Revisa el pedido en el panel.</td></tr>`;
  return items.map((item) => {
    const name = escapeEmailHtml(item.name || item.title || item.productName || "Producto");
    const quantity = Number(item.quantity || item.qty || 1);
    const unitPrice = Number(item.price || item.unitPrice || 0);
    const total = unitPrice * quantity;
    const image = item.image || item.imageUrl || item.photo || "";
    return `<tr><td style="padding:14px 0;border-bottom:1px solid #eee5d8;"><div style="display:flex;gap:12px;align-items:center;">${image ? `<img src="${escapeEmailHtml(image)}" width="54" height="54" alt="${name}" style="border-radius:14px;object-fit:cover;border:1px solid #eee5d8;" />` : `<div style="width:54px;height:54px;border-radius:14px;background:#f4f1e8;border:1px solid #eee5d8;text-align:center;line-height:54px;font-size:24px;">🌿</div>`}<div><div style="font-weight:800;color:#1f3426;font-size:15px;">${name}</div><div style="color:#806f5f;font-size:12px;margin-top:4px;">Producto del pedido</div></div></div></td><td align="center" style="padding:14px 8px;border-bottom:1px solid #eee5d8;font-weight:700;color:#1f3426;">${quantity}</td><td align="right" style="padding:14px 8px;border-bottom:1px solid #eee5d8;white-space:nowrap;color:#1f3426;">${formatCurrencyEUR(unitPrice)}</td><td align="right" style="padding:14px 0;border-bottom:1px solid #eee5d8;font-weight:800;white-space:nowrap;color:#1f3426;">${formatCurrencyEUR(total)}</td></tr>`;
  }).join("");
}

function adminBlock(order) {
  return `<div style="background:#f7f4ec;border:1px solid #e8dfcf;border-radius:20px;padding:18px;margin-bottom:18px;"><h3 style="margin:0 0 12px;font-size:17px;color:#204b2a;font-family:Georgia,'Times New Roman',serif;">Información del cliente</h3><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${infoRow("Cliente", order.customerName)}${infoRow("Email", order.customerEmail)}${infoRow("Teléfono", order.customerPhone)}${infoRow("Dirección", `${order.address}${order.postalCode ? `, ${order.postalCode}` : ""}${order.city ? `, ${order.city}` : ""}`)}${infoRow("Entrega", labelDelivery(order.deliveryMethod))}${infoRow("Método de pago", labelPayment(order.paymentMethod))}</table></div>${order.notes ? `<div style="background:#fff;border:1px solid #e8dfcf;border-radius:18px;padding:16px;margin-bottom:18px;color:#1f3426;"><strong>Notas del cliente:</strong><br>${escapeEmailHtml(order.notes)}</div>` : ""}`;
}

function customerBlock(order) {
  const deliveryText = String(order.deliveryMethod).toLowerCase() === "recogida" ? "Tu pedido será preparado para recogida en tienda. Te avisaremos cuando esté listo." : "Tu pedido será preparado para envío a domicilio. Te avisaremos cuando salga para entrega.";
  return `<div style="background:#f7f4ec;border:1px solid #e8dfcf;border-radius:20px;padding:18px;margin-bottom:18px;"><h3 style="margin:0 0 12px;font-size:17px;color:#204b2a;font-family:Georgia,'Times New Roman',serif;">Entrega</h3><p style="margin:0 0 12px;color:#1f3426;line-height:1.55;font-size:14px;">${escapeEmailHtml(deliveryText)}</p><div style="background:#ffffff;border:1px solid #eee5d8;border-radius:16px;padding:14px;color:#1f3426;line-height:1.5;font-size:14px;"><strong>Dirección:</strong><br>${escapeEmailHtml(order.customerName)}<br>${escapeEmailHtml(order.address)}<br>${escapeEmailHtml(`${order.postalCode ? `${order.postalCode}, ` : ""}${order.city}`)}</div></div><div style="background:#eef5ee;border:1px solid #dbe8d8;border-radius:18px;padding:16px;color:#204b2a;line-height:1.6;font-size:14px;">🌿 Tu ramo está siendo preparado con mucho cariño. Si tienes cualquier duda, responde a este correo.</div>`;
}

export function renderHerenciaOrderEmail(orderData, recipientType = "customer") {
  const order = normalizeHerenciaOrder(orderData);
  const isAdmin = recipientType === "admin";
  const title = isAdmin ? "Nuevo pedido recibido" : "¡Gracias por tu compra!";
  const pretitle = isAdmin ? "Para: ADMIN" : "Para: CLIENTE";
  const subtitle = isAdmin ? `Tienes un nuevo pedido de ${escapeEmailHtml(order.customerName)} en Herencia Floristería.` : `Hola ${escapeEmailHtml(order.customerName)}, hemos recibido tu pedido correctamente.`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;background:#f7f2e9;font-family:Arial,Helvetica,sans-serif;color:#1f3426;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${title} · Pedido #${escapeEmailHtml(order.id)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f2e9;padding:28px 12px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#fffdf8;border:1px solid #eadfce;border-radius:28px;overflow:hidden;box-shadow:0 18px 55px rgba(31,52,38,.12);"><tr><td style="padding:28px 30px 18px;text-align:right;"><span style="display:inline-block;background:#204b2a;color:#fff;border-radius:999px;padding:8px 14px;font-size:12px;font-weight:800;">${pretitle}</span></td></tr><tr><td style="padding:0 30px 26px;text-align:center;">${logoBlock(order.logoUrl)}<h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.15;font-weight:800;color:#204b2a;">${title}</h1><p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#2f4635;">${subtitle}</p><div style="margin:22px auto 0;background:#f4f1e8;border:1px solid #ded6c8;border-radius:16px;padding:16px;color:#1f3426;max-width:520px;"><strong>Pedido #${escapeEmailHtml(order.id)}</strong><br><span style="font-size:13px;color:#6f6254;">${formatDate(order.date)}</span></div></td></tr><tr><td style="padding:0 30px 30px;"><div style="background:#ffffff;border:1px solid #eee5d8;border-radius:22px;padding:18px;margin-bottom:18px;"><h2 style="font-size:18px;margin:0 0 14px;color:#204b2a;font-family:Georgia,'Times New Roman',serif;">${isAdmin ? "Resumen del pedido" : "Resumen de tu pedido"}</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:10px 0;color:#806f5f;font-size:13px;">Estado del pedido<br><span style="display:inline-block;margin-top:8px;background:#edf4e9;color:#204b2a;border-radius:8px;padding:6px 10px;font-weight:800;">${labelStatus(order.status)}</span></td><td align="right" style="padding:10px 0;color:#806f5f;font-size:13px;">${isAdmin ? "Total del pedido" : "Total pagado"}<br><span style="display:inline-block;margin-top:8px;color:#1f3426;font-size:25px;font-weight:900;">${formatCurrencyEUR(order.total)}</span></td></tr></table></div>${isAdmin ? adminBlock(order) : customerBlock(order)}<div style="background:#ffffff;border:1px solid #eee5d8;border-radius:22px;padding:18px;margin-bottom:18px;"><h2 style="font-size:18px;margin:0 0 14px;color:#204b2a;font-family:Georgia,'Times New Roman',serif;">${isAdmin ? "Detalle de la compra" : "Detalle de tu compra"}</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><th align="left" style="padding:0 0 10px;color:#806f5f;font-size:12px;text-transform:uppercase;">Producto</th><th align="center" style="padding:0 8px 10px;color:#806f5f;font-size:12px;text-transform:uppercase;">Cant.</th><th align="right" style="padding:0 8px 10px;color:#806f5f;font-size:12px;text-transform:uppercase;">Unidad</th><th align="right" style="padding:0 0 10px;color:#806f5f;font-size:12px;text-transform:uppercase;">Subtotal</th></tr>${itemsRows(order.items)}</table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px;"><tr><td style="padding:6px 0;color:#806f5f;">Subtotal</td><td align="right" style="padding:6px 0;color:#1f3426;">${formatCurrencyEUR(order.subtotal)}</td></tr><tr><td style="padding:6px 0;color:#806f5f;">Envío</td><td align="right" style="padding:6px 0;color:#1f3426;">${formatCurrencyEUR(order.shipping)}</td></tr>${order.discount ? `<tr><td style="padding:6px 0;color:#806f5f;">Descuento</td><td align="right" style="padding:6px 0;color:#1f3426;">-${formatCurrencyEUR(order.discount)}</td></tr>` : ""}<tr><td style="padding:14px 0 0;font-size:18px;font-weight:900;color:#204b2a;border-top:1px solid #eee5d8;">${isAdmin ? "Total del pedido" : "Total pagado"}</td><td align="right" style="padding:14px 0 0;font-size:22px;font-weight:900;color:#204b2a;border-top:1px solid #eee5d8;">${formatCurrencyEUR(order.total)}</td></tr></table></div><div style="background:#204b2a;border-radius:18px;padding:16px;text-align:center;color:#fff;font-weight:800;">${isAdmin ? "Ver pedido en el panel admin" : "Gracias por confiar en Herencia Floristería"}</div></td></tr><tr><td style="background:#f1eee4;padding:26px 30px;text-align:center;color:#204b2a;"><div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:800;">Herencia Floristería</div><div style="margin-top:6px;color:#6f6254;font-size:13px;">Flores que cuentan historias</div></td></tr></table></td></tr></table></body></html>`;
}
