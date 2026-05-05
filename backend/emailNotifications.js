function money(value) {
  return `€${Number(value || 0).toFixed(2)}`;
}

function safe(value = "") {
  return String(value).replace(/[<>&"']/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "\"": "&quot;",
    "'": "&#039;",
  }[char]));
}

function orderText(order, customer = false) {
  const metadata = order.metadata || {};
  const address = metadata.shippingAddress || {};
  const items = (order.items || [])
    .map((item) => `- ${item.name} x${item.quantity || 1}: ${money(Number(item.price || 0) * Number(item.quantity || 1))}`)
    .join("\n");

  return `${customer ? "Gracias por tu compra en Herencia Floristería" : "Nuevo pedido recibido"}\n\nCliente:\nNombre: ${order.customer_name || ""}\nEmail: ${order.customer_email || ""}\nTeléfono: ${metadata.phone || ""}\n\nEntrega: ${order.delivery_method === "recoger" ? "Recoger en tienda" : "Envío a domicilio"}\nPago: ${order.payment_method || ""}\nEstado: ${order.status || ""}\n\nDirección:\n${address.address || ""}\n${address.postalCode || ""} ${address.city || ""}\n${address.province || ""}\n\nProductos:\n${items}\n\nSubtotal: ${money(order.subtotal)}\nEnvío: ${money(order.shipping)}\nTotal: ${money(order.total)}\n\nNotas:\n${metadata.notes || ""}\n`;
}

function orderHtml(order, customer = false) {
  const metadata = order.metadata || {};
  const address = metadata.shippingAddress || {};
  const items = (order.items || []).map((item) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #e8eee2;">
        <strong>${safe(item.name)}</strong><br><span style="color:#70806b;font-size:13px;">Cantidad: ${item.quantity || 1}</span>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #e8eee2;text-align:right;font-weight:700;">${money(Number(item.price || 0) * Number(item.quantity || 1))}</td>
    </tr>`).join("");

  const title = customer ? "Gracias por tu compra" : "Nuevo pedido recibido";
  const intro = customer ? "Hemos recibido tu pedido correctamente. Te contactaremos pronto para confirmar todos los detalles." : "Tienes un nuevo pedido en Herencia Floristería. Aquí tienes el resumen completo.";

  return `<!doctype html><html><body style="margin:0;background:#f4f7ef;font-family:Arial,sans-serif;color:#263326;">
    <div style="max-width:680px;margin:0 auto;padding:28px 14px;">
      <div style="background:#2f6b3f;color:white;border-radius:22px 22px 0 0;padding:28px;text-align:center;">
        <div style="font-size:34px;line-height:1;">🌿</div>
        <h1 style="margin:10px 0 4px;font-size:28px;">Herencia Floristería</h1>
        <p style="margin:0;color:#dfeee1;">${title}</p>
      </div>
      <div style="background:white;border:1px solid #e1ead8;border-top:0;border-radius:0 0 22px 22px;padding:28px;">
        <p style="font-size:16px;line-height:1.6;margin-top:0;">${intro}</p>

        <div style="background:#f7faf4;border:1px solid #e1ead8;border-radius:16px;padding:18px;margin:20px 0;">
          <h2 style="font-size:18px;margin:0 0 12px;color:#2f6b3f;">Datos del cliente</h2>
          <p style="margin:0;line-height:1.7;"><strong>Nombre:</strong> ${safe(order.customer_name || "")}<br><strong>Email:</strong> ${safe(order.customer_email || "")}<br><strong>Teléfono:</strong> ${safe(metadata.phone || "")}</p>
        </div>

        <div style="background:#fffaf0;border:1px solid #efe0bd;border-radius:16px;padding:18px;margin:20px 0;">
          <h2 style="font-size:18px;margin:0 0 12px;color:#8a6418;">Entrega y pago</h2>
          <p style="margin:0;line-height:1.7;"><strong>Entrega:</strong> ${order.delivery_method === "recoger" ? "Recoger en tienda" : "Envío a domicilio"}<br><strong>Pago:</strong> ${safe(order.payment_method || "")}<br><strong>Estado:</strong> ${safe(order.status || "")}</p>
          ${order.delivery_method === "envio" ? `<p style="margin:14px 0 0;line-height:1.7;"><strong>Dirección:</strong><br>${safe(address.address || "")}<br>${safe(address.postalCode || "")} ${safe(address.city || "")}<br>${safe(address.province || "")}</p>` : ""}
        </div>

        <h2 style="font-size:18px;margin:26px 0 8px;color:#2f6b3f;">Productos</h2>
        <table style="width:100%;border-collapse:collapse;">${items}</table>

        <div style="margin-top:22px;padding:18px;background:#2f6b3f;color:white;border-radius:16px;">
          <p style="margin:0;line-height:1.8;"><strong>Subtotal:</strong> ${money(order.subtotal)}<br><strong>Envío:</strong> ${money(order.shipping)}</p>
          <p style="margin:10px 0 0;font-size:26px;font-weight:800;">Total: ${money(order.total)}</p>
        </div>

        ${metadata.notes ? `<div style="margin-top:20px;padding:16px;background:#f7faf4;border-radius:14px;"><strong>Notas:</strong><br>${safe(metadata.notes)}</div>` : ""}
        <p style="text-align:center;color:#70806b;font-size:13px;margin:24px 0 0;">Gracias por confiar en Herencia Floristería 🌸</p>
      </div>
    </div>
  </body></html>`;
}

async function sendEmail({ to, subject, text, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY no configurada. Email omitido:", subject);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Herencia Floristería <onboarding@resend.dev>",
      to,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) console.error("Error enviando email:", await response.text());
}

export async function notifyOrder(order) {
  await sendEmail({
    to: process.env.STORE_EMAIL || "herenciafloristeria@gmail.com",
    subject: `🌿 Nuevo pedido - ${money(order.total)}`,
    text: orderText(order, false),
    html: orderHtml(order, false),
  });

  if (order.customer_email) {
    await sendEmail({
      to: order.customer_email,
      subject: "🌿 Hemos recibido tu pedido en Herencia Floristería",
      text: orderText(order, true),
      html: orderHtml(order, true),
    });
  }
}
