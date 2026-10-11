# Puesta en marcha de dropshipping — Herencia Market

## Objetivo
Que una persona sin conocimientos técnicos pueda configurar CJdropshipping, vincular un producto y supervisar su primera venta sin activar gastos automáticos por accidente. Esta guía no certifica por sí sola la operación en producción.

## Entrar
1. Abre `https://www.herenciamarket.es/admin` y accede con tu cuenta autorizada.
2. Selecciona **Proveedores** en el menú lateral.
3. En **Modo guiado · CJdropshipping** revisa los cinco pasos. Cada botón **Abrir este paso** lleva a la herramienta original.
4. Para otros proveedores y herramientas de soporte, usa **Mostrar herramientas avanzadas**. No se eliminó ninguna herramienta previa.

## Paso 1 — Conexión
- En **Proveedores y conexiones**, comprueba que CJ esté registrado y activo.
- Revisa si está en Sandbox o modo real. Pasar a modo real no debe hacerse hasta completar pruebas, permisos y presupuesto.
- Una API Key detectada no prueba autenticación, saldo ni compras exitosas. No pegues secretos en la interfaz pública.
- El panel CJ muestra los bloqueos reales según la API administrativa del backend.

## Paso 2 — Importar producto
- En **Importar por URL**, pega la URL oficial de un producto CJ.
- Comprueba que el importador cree un **borrador** con imágenes y datos genuinos, no capturas de CAPTCHA.
- Revisa el origen, variante SKU/VID, moneda y proveedor vinculado. Una ficha importada no se publica automáticamente.
- Si CJ cambia las variantes, invalida y revisa el vínculo; nunca presupongas equivalencia por el título.

## Paso 3 — Precio, stock y transporte
- En **Productos vinculados**, se abre el filtro de conectados CJ.
- Elige **una única variante** y una unidad; valida en vivo stock de almacén, coste en USD, conversión EUR, envío a un código postal español, IVA y margen.
- Una simulación de costes o una cotización antigua no sustituye una comprobación actual del proveedor.
- No marques como vendible un artículo que no cumpla los controles del checkout real.

## Paso 4 — Primera venta supervisada
- Comprueba fiscalidad, políticas de devoluciones, datos de contacto, precio final, entrega, inventario y Stripe en producción.
- Selecciona un artículo de bajo riesgo y **autoriza expresamente el importe antes de cualquier gasto**.
- Realiza y verifica una compra controlada: Stripe PaymentIntent real y webhook, pedido guardado en Neon, cola de proveedor, coste CJ real, creación CJ sin pago con primera aprobación, pago CJ con segunda aprobación, tracking y avisos al cliente.
- Verifica la operación también en las consolas Stripe y CJ, no solo en la base local.
- Documenta referencias y cantidades sin guardar números de tarjeta ni claves.
- En errores ambiguos de creación/pago, **no reintentes**: concilia con CJ primero.
- Para el alcance CJ actual, se admite solo una unidad, una variante y España continental/Baleares donde la ruta sea apta. Canarias, Ceuta y Melilla no están cubiertas por el piloto automático.

## Paso 5 — Activar automatización (solo tras la prueba)
- En **CJ automatización** revisa **Qué impide activar CJ Autopilot ahora**.
- Configura un tope EUR **por pedido**, un máximo **diario**, margen mínimo y lista cerrada de proveedores CJ autorizados.
- Valida que los tres interruptores de Railway, credenciales reales y pedido supervisado estén correctamente configurados. Nunca uses flags aislados para saltar las validaciones.
- El responsable debe aceptar explícitamente el mandato de gastos; caduca a los 30 días y puede revocarse.
- Confirma con una prueba adicional que los workers procesan sólo pedidos nuevos elegibles, validan cobro Stripe y costes, no duplican operaciones y reportan excepciones.
- Se ejecuta como máximo una acción externa por ciclo de 15 minutos; crear y pagar son acciones separadas, no simultáneas. Puede haber una demora entre ambas.
- No ampliar a pedidos mixtos, más unidades ni países adicionales sin revisar logística, impuestos e idempotencia.

## Otros proveedores
- **AliExpress/DSers:** importación y exportación CSV. No equivale a transmisión de pedidos por API en tiempo real.
- **Printful:** cotización de tarifas de envío, sin creación de pedidos automática.
- **EPROLO:** hasta obtener acceso oficial a la API, la gestión es manual/archivo y debe mostrar el adaptador pendiente.
- **Webhook propio:** requiere conector autorizado, prueba, identidad de variantes y protocolo idempotente. Registrar un proveedor no lo conecta.

## Criterios de salida a producción
- [ ] La vista de cinco pasos no muestra falsos éxitos cuando la API falla.
- [ ] Un operador no técnico puede importar y encontrar su producto CJ sin explorar herramientas avanzadas.
- [ ] Una compra real supervisada se verifica de principio a fin y tiene registros conciliados en Stripe y CJ.
- [ ] Un fallo de red o API bloquea automáticamente órdenes duplicadas.
- [ ] El estado de Autopilot se muestra **no autorizado** mientras el backend no confirme un mandato válido.
- [ ] Se comprueba la paridad de despliegue GitHub/Vercel/Railway backend, se verifica CI y se hace una prueba de navegación de producción.
- [ ] Todo gasto requiere autorización humana, y existen presupuesto, mecanismo de revocación, soporte y devoluciones.

**Importante:** los tests unitarios y de CI validan reglas de código. No prueban disponibilidad comercial, la conexión actual, un pago real ni una entrega efectiva.
