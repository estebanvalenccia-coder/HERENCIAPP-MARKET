const configuredAdminOrderEmail = String(
  process.env.ADMIN_ORDER_EMAIL || process.env.STORE_EMAIL || ""
).trim();

if (configuredAdminOrderEmail) {
  process.env.ADMIN_ORDER_EMAIL = process.env.ADMIN_ORDER_EMAIL || configuredAdminOrderEmail;
  process.env.STORE_EMAIL = process.env.STORE_EMAIL || configuredAdminOrderEmail;
  console.log("Email de pedidos configurado desde variables de entorno");
} else {
  console.warn("ADMIN_ORDER_EMAIL/STORE_EMAIL no configurado; las notificaciones internas por email pueden omitirse");
}
