from pathlib import Path

path = Path("backend/server.js")
text = path.read_text()

if "const documentNumber = normalized.metadata?.invoiceNumber" in text:
    print("Fiscal order email already present")
    raise SystemExit(0)

old_head = '''function renderOrderEmail(order, recipientType = "customer") {
  const normalized = normalizeOrder(order);
  const isAdminEmail = recipientType === "admin";
  const itemsHtml = normalized.items.length'''
new_head = '''function renderOrderEmail(order, recipientType = "customer") {
  const normalized = normalizeOrder(order);
  const isAdminEmail = recipientType === "admin";
  const fiscal = normalized.metadata?.fiscalSnapshot || {};
  const taxAmount = Math.max(0, Number(normalized.metadata?.tax || 0));
  const documentNumber = normalized.metadata?.invoiceNumber || normalized.id;
  const customerNif = String(normalized.metadata?.customerNif || "");
  const customerAddress = String(normalized.metadata?.customerAddress || "");
  const itemsHtml = normalized.items.length'''
if old_head not in text:
    raise SystemExit("renderOrderEmail head marker not found")
text = text.replace(old_head, new_head, 1)

old_doc = '''                <p style="margin:10px 0 0;font-size:15px;opacity:.95;">Pedido #${escapeHtml(
                  normalized.id
                )}</p>'''
new_doc = '''                <p style="margin:10px 0 0;font-size:15px;opacity:.95;">Documento #${escapeHtml(
                  documentNumber
                )}</p>'''
if old_doc not in text:
    raise SystemExit("document number marker not found")
text = text.replace(old_doc, new_doc, 1)

old_customer = '''                  <tr>
                    <td style="padding:6px 0;color:#8b6b61;font-size:13px;">Email</td>
                    <td align="right" style="padding:6px 0;font-weight:700;">${escapeHtml(normalized.customerEmail || "No indicado")}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#8b6b61;font-size:13px;">Entrega</td>'''
new_customer = '''                  <tr>
                    <td style="padding:6px 0;color:#8b6b61;font-size:13px;">Email</td>
                    <td align="right" style="padding:6px 0;font-weight:700;">${escapeHtml(normalized.customerEmail || "No indicado")}</td>
                  </tr>
                  ${customerNif ? `<tr><td style="padding:6px 0;color:#8b6b61;font-size:13px;">NIF/CIF cliente</td><td align="right" style="padding:6px 0;font-weight:700;">${escapeHtml(customerNif)}</td></tr>` : ""}
                  ${customerAddress ? `<tr><td style="padding:6px 0;color:#8b6b61;font-size:13px;">Dirección fiscal</td><td align="right" style="padding:6px 0;font-weight:700;">${escapeHtml(customerAddress)}</td></tr>` : ""}
                  <tr>
                    <td style="padding:6px 0;color:#8b6b61;font-size:13px;">Entrega</td>'''
if old_customer not in text:
    raise SystemExit("customer fiscal marker not found")
text = text.replace(old_customer, new_customer, 1)

old_totals = '''                  <tr>
                    <td style="padding:5px 0;color:#f8d8cc;">Subtotal</td>
                    <td align="right" style="padding:5px 0;font-weight:700;">${formatCurrency(normalized.subtotal)}</td>
                  </tr>
                  <tr>
                    <td style="padding:5px 0;color:#f8d8cc;">Envío</td>
                    <td align="right" style="padding:5px 0;font-weight:700;">${formatCurrency(normalized.shipping)}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0 0;font-size:19px;font-weight:800;">Total</td>
                    <td align="right" style="padding:12px 0 0;font-size:22px;font-weight:900;color:#ffc75f;">${formatCurrency(normalized.total)}</td>
                  </tr>'''
new_totals = '''                  <tr>
                    <td style="padding:5px 0;color:#f8d8cc;">${taxAmount > 0 ? "Base imponible" : "Subtotal"}</td>
                    <td align="right" style="padding:5px 0;font-weight:700;">${formatCurrency(normalized.subtotal)}</td>
                  </tr>
                  ${taxAmount > 0 ? `<tr><td style="padding:5px 0;color:#f8d8cc;">IVA</td><td align="right" style="padding:5px 0;font-weight:700;">${formatCurrency(taxAmount)}</td></tr>` : ""}
                  <tr>
                    <td style="padding:5px 0;color:#f8d8cc;">Envío</td>
                    <td align="right" style="padding:5px 0;font-weight:700;">${formatCurrency(normalized.shipping)}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0 0;font-size:19px;font-weight:800;">Total</td>
                    <td align="right" style="padding:12px 0 0;font-size:22px;font-weight:900;color:#ffc75f;">${formatCurrency(normalized.total)}</td>
                  </tr>'''
if old_totals not in text:
    raise SystemExit("totals marker not found")
text = text.replace(old_totals, new_totals, 1)

old_footer = '''                <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#8b6b61;text-align:center;">
                  ${
                    isAdminEmail
                      ? "Revisa el panel de administración para gestionar este pedido."
                      : "Prepararemos tu pedido con mucho cariño. Si tienes cualquier duda, responde a este correo."
                  }
                </p>'''
new_footer = '''                ${fiscal.businessName || fiscal.nif || fiscal.address ? `
                  <div style="margin-top:22px;background:#fffaf7;border:1px solid #f1e7df;border-radius:18px;padding:16px;color:#4d3128;font-size:13px;line-height:1.6;">
                    <strong style="display:block;color:#2b1712;margin-bottom:4px;">Datos fiscales del emisor</strong>
                    ${fiscal.businessName ? `${escapeHtml(fiscal.businessName)}<br/>` : ""}
                    ${fiscal.nif ? `NIF/CIF: ${escapeHtml(fiscal.nif)}<br/>` : ""}
                    ${fiscal.address ? `${escapeHtml(fiscal.address)}<br/>` : ""}
                    ${fiscal.email ? `${escapeHtml(fiscal.email)}` : ""}
                  </div>` : ""}
                <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#8b6b61;text-align:center;">
                  ${
                    isAdminEmail
                      ? "Revisa el panel de administración para gestionar este pedido."
                      : "Gracias por tu compra. Conserva este correo como justificante de la operación. Si tienes cualquier duda, responde a este correo."
                  }
                </p>'''
if old_footer not in text:
    raise SystemExit("email footer marker not found")
text = text.replace(old_footer, new_footer, 1)

path.write_text(text)
print("Fiscal order email patch applied")
