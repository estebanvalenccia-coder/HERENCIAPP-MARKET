# Banggood Dropshipping — Herencia Market (alta preparada, NO conectada)

## Qué se ha preparado

- Plantilla **Banggood** en Administración → Dropshipping → Nuevo proveedor (host `banggood.com`, integración `api`, ejecución manual).
- Instrucciones contextualizadas de alta y variables de Railway.
- Comprobación administrativa de presencia de **BANGGOOD_APP_ID** y **BANGGOOD_APP_SECRET** sin revelar sus valores ni enviarlos al navegador.
- El indicador `credentials_present_unverified` significa **credenciales presentes pero no autenticadas**, no conexión validada.
- Los pedidos automáticos están desactivados hasta implementar y verificar el adaptador oficial y los controles de pago/consentimiento.
- Se puede utilizar la importación existente CSV/JSON/XML con catálogo autorizado de Banggood y mapeo de variantes; esto no mantiene stock sincronizado automáticamente.

## Alta necesaria en Banggood

1. Regístrate en [Banggood Dropship](https://www.banggood.com/index.php?com=dropshipcenter&t=login) con la URL **https://www.herenciamarket.es**.
2. Solicita acceso a [Banggood Open Platform](https://api.banggood.com/) y verifica el dominio en su centro de gestión.
3. Confirma con **openplatform@banggood.com** las condiciones y límites actuales: la página pública ofrece API sin cuota, pero la guía histórica exige nivel de dropshipper VIP/Advanced/VVIP. El acceso **no se presupone aprobado**.
4. Cuando Banggood proporcione credenciales, configura las variables `BANGGOOD_APP_ID` y `BANGGOOD_APP_SECRET` en el backend Herencia de Railway (nunca frontend, producto ni repositorio).
5. En Administración → Proveedores, elige Banggood, guarda la ficha y deja gestión **Manual**. Comprueba la etiqueta de conexión: sin claves `not_configured`; con claves `credentials_present_unverified`.
6. Para pruebas de catálogo, usa únicamente exportaciones autorizadas y revisa precio con IVA, envío y margen, variantes SKU exactas, stock/almacén para España y documentación de seguridad UE antes de publicar.

## Pendiente para que funcione de extremo a extremo (NO implementado)

- Validar autorización real y emisión/renovación de token mediante documentación de Banggood para la cuenta.
- Implementar el cliente API de lectura: categorías, variantes por SKU, precios, stock por almacén, tarifas a código postal de España y sincronización periódica con despublicación segura ante agotamiento.
- Implementar la creación de **pedido individual** (1, 2 o 3 unidades) con clave idempotente, financiación y aceptación explícita, reconciliación tras timeout, presupuestos y reglas de margen.
- Consultar envío, estado de compra y tracking con identificación de referencia externa; revisar cumplimiento RGPD/GPSR e información fiscal.
- Ejecutar pruebas con cuenta real, pedidos pequeños y aprobación administrativa antes de habilitar autopilot.

## Documentación del proveedor

- [Guía comercial Dropship](https://www.banggood.com/index.php?com=account&t=dropshipIntroduce)
- [Open Platform y API](https://api.banggood.com/)
- [Guía histórica de acceso](https://api.banggood.com/index.php?article_id=3&com=document)

**Nunca** reutilices una clave de la API de afiliados para gestionar compras de Dropship.
