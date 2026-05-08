const fixedAdminOrderEmail = "herenciafloristeria@gmail.com";

process.env.ADMIN_ORDER_EMAIL = fixedAdminOrderEmail;
process.env.STORE_EMAIL = fixedAdminOrderEmail;

console.log(`Email de administrador de pedidos fijado en ${fixedAdminOrderEmail}`);
