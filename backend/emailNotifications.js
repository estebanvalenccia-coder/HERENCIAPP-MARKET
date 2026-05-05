function money(value) {
  return `€${Number(value || 0).toFixed(2)}`;
}

function orderText(order, customer = false) {
  const metadata = order.metadata || {};
  const address = metadata.shippingAddress || {};
  const items = (order.items || [])
    .map((item) => `- ${item.name} x${item.quantity || 1}: ${money(Number(item.price || 0) * Number(item.quantity || 1))}`)
    .join("\n");

  return `${customer ? "Gracias por tu compra en Herencia Floristería" : "Nuevo pedido recibido"}

Cliente:
Nombre: ${order.customer_name || ""}
Email: ${order.customer_email || ""}
Teléfono: ${metadata.phone || ""}

Entrega: ${order.delivery_method === "recoger" ? "Recoger en tienda" : "Envío a domicilio"}
Pago: ${order.payment_method || ""}
Estado: ${order.status || ""}

Dirección:
${address.address || ""}
${address.postalCode || ""} ${address.city || ""}
${address.province || ""}

Productos:
${items}

Subtotal: ${money(order.subtotal)}
Envío: ${money(order.shipping)}
Total: ${money(order.total)}

Notas:
${metadata.notes || ""}
`;
}

async function sendEmail({ to, subject, text }) {
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
    }),
  });

  if (!response.ok) console.error("Error enviando email:", await response.text());
}

export async function notifyOrder(order) {
  await sendEmail({
    to: process.env.STORE_EMAIL || "herenciafloristeria@gmail.com",
    subject: `Nuevo pedido - ${money(order.total)}`,
    text: orderText(order, false),
  });

  if (order.customer_email) {
    await sendEmail({
      to: order.customer_email,
      subject: "Hemos recibido tu pedido en Herencia Floristería",
      text: orderText(order, true),
    });
  }
}
