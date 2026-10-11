# CJdropshipping · Automatización segura — octubre 2026

CJ **ya utiliza una API Key** en el backend. Este módulo NO vuelve a integrar
CJ ni exige conectar DSers. Es una fase complementaria para preparar el flujo
completo sin comprometer dinero o duplicar pedidos del proveedor.

## Flujo existente verificado por el código

1. Stripe valida el cobro del cliente mediante webhook; se encola la
   preparación de proveedor, nunca se compra desde el webhook.
2. Herencia valida en checkout una única variante CJ con SKU/VID real,
   stock origen, costes, margen y transportista para un código postal español.
3. El administrador puede revisar el pedido, crearlo **sin pagar** mediante
   CJ `createOrderV2` y aprobar el pago por separado.
4. Las llamadas que gastan saldo están protegidas por un registro atómico
   no repetible, estados ambiguos `cj_creation_unknown` /
   `cj_payment_unknown` y conciliación de solo lectura.
5. Devoluciones y reclamaciones requieren acciones revisadas.

### Incorporado en esta fase

- Worker de seguimiento de pedidos CJ *ya creados y pagados*. Ejecuta solo
  `/shopping/order/getOrderDetail`, con máximo **3 pedidos cada 15 minutos**
  y aproximadamente 1,4 segundos entre llamadas al proveedor.
- Arranca automáticamente con el backend si `CJ_API_KEY` está configurada y
  Neon está disponible. `CJ_READ_ONLY_TRACKING_ENABLED=false` permite
  desactivarlo sin afectar las acciones manuales existentes.
- Control de concurrencia: reserva de lectura con expiración 14 min por pedido
  compartida entre réplicas y actualización transaccional **compare-and-swap**
  (mismo estado, ID CJ y revisión local).
- Solo sincroniza pedidos locales con estado `ordered` o `shipped` e ID CJ
  externo. Nunca toca `payment_required`, `cj_creating`,
  `cj_creation_unknown`, `cj_paying`, `cj_payment_unknown`, estados
  cerrados, pagos o devoluciones.
- El ID recibido de CJ debe coincidir exactamente; el estado solo puede
  avanzar. Los estados desconocidos, cobros ambiguos, números de seguimiento
  sustituidos o posibles retrocesos requieren revisión humana.
- El tracking HTTP solo se acepta con URL HTTPS; nunca se guardan URLs
  ejecutables en el frontend.
- Antes de que el administrador cree **sin pagar** un pedido CJ, se vuelven a
  consultar el precio, los portes y **el stock del VID exacto en origen CN**.
  Las consultas de proveedor son secuenciales para reducir errores API 429;
  la compra se bloquea si CJ no acredita al menos una unidad real. Esto es
  una lectura reciente, no una reserva de almacén.
- Se actualizan los metadatos de seguimiento del pedido, **no** el saldo
  proveedor, el pedido externo, el importe real CJ o Stripe. Notificaciones
  internas idempotentes por pedido/estado/seguimiento.
- Administración → Dropshipping → CJ automatización: indicadores, motivos de
  bloqueo y botón **Actualizar seguimiento CJ (sin comprar)**.
- Un fallo de proveedor no habilita reintentos de crear/pagar. El worker no
  devuelve ni crea pedidos, y nunca se conecta a rutas de `payBalance`.

## Nueva fase: límites configurables y simulación verificable

En **Administración → Dropshipping → CJ automatización** puedes guardar (sin
valor predeterminado) un límite máximo en EUR por pedido, un máximo diario EUR,
margen neto mínimo del 10–70 % y proveedores CJ reales autorizados. Se guardan
bajo la clave privada `cjAutopilotGuardrails:v1`, accesible únicamente por
rutas administrativas. El formulario rechaza intentos de habilitar compras,
pagos, otro país o más de una unidad. Los valores siguen siendo una **propuesta
de reglas** en modo simulación, no una autorización financiera de producción.

La comprobación de un pedido ya preparado hace lecturas reales y limitadas de:
- Stripe `paymentIntents.retrieve`, únicamente si el cobro del cliente
  corresponde al PaymentIntent, está en modo producción, es EUR y figura
  `succeeded`, con importe suficiente.
- CJ: identidad exacta SKU/VID, stock de almacén CN, precio de variante y
  logística española por código postal, con las mismas validaciones que el
  paso manual de creación.
- Tipo de cambio actualizado, coste de compra y flete actualizado, estimación
  de comisión Stripe (1,5 % + 0,25 €), margen neto supuesto con IVA español
  del 21 %, restricciones por proveedor y presupuesto diario.

Para limitar el riesgo fiscal, las simulaciones excluyen automáticamente
Canarias, Ceuta y Melilla. La lectura sólo es válida para una unidad con
envío confirmado a España y no reserva existencias CJ. Las tarifas reales,
comisiones e impuestos deben auditarse antes de activar pagos desatendidos.

**El presupuesto diario en esta versión es una simulación conservadora** que
suma los pedidos CJ ya creados, pendientes o de resultado incierto desde la
cola interna en horario UTC. Una operación con costes desconocidos bloquea
la aprobación. Se ha implementado y probado una reserva transaccional de
presupuesto preparada para integrarla en las compras automáticas futuras,
pero **no se le ha conectado ninguna función que gaste dinero**.

Las rutas `autopilot-guardrails` y `autopilot-preflight/:id` necesitan una
sesión de administrador, y las comprobaciones en vivo tienen limitación de
peticiones para proteger la cuota de CJ.

**No habilita auto-`createOrderV2` ni auto-`cjPayOrder`**. Para llegar a
esa última fase deben existir límites de gasto **elegidos expresamente por
el comerciante**, un mecanismo real de autorización, ensayos de conciliación
ante timeout, reservas transaccionales antes del débito, pruebas de pagos
Stripe/CJ sin duplicados y un pedido real supervisado.

## Para permitir compras desatendidas más adelante

Se requiere una decisión expresa sobre los presupuestos **por pedido y por
día**, mínimo beneficio, proveedores autorizados, cancelaciones, devoluciones,
stock y origen de fondos. No basta con tener una API Key ni con marcar
`CJ_LIVE_AUTOPILOT_ENABLED`.

La automatización de cargos debe cumplir TODAS estas garantías:
- Captura real del pago y confirmación de Stripe en modo producción.
- Validación inmediata de SKU/VID exacto, stock, precio, cotización de envío
  y divisa con límite estricto de antigüedad.
- Coste final del pedido CJ dentro de presupuesto por pedido **y del
  presupuesto diario agregado**, verificable transaccionalmente entre réplicas.
- Idempotencia duradera, un único intento de pago externo y conciliación de
  resultados inciertos (nunca «reintentar hasta que funcione»).
- Bloqueo de descuentos financiados por la tienda y pedidos que no sean
  España / una unidad, salvo aprobación y verificación fiscal/logística.
- Tests en entorno de prueba y un primer pedido real de bajo importe aprobado
  expresamente por el comerciante.

**No se habilita compra ni pago automático en este PR**. Los interruptores
`CJ_LIVE_ORDER_CREATION_ENABLED` y `CJ_LIVE_PAYMENT_ENABLED` siguen
siendo independientes y requieren las rutas de confirmación del administrador.

## Pruebas

Ejecutar `npm run test:release`; incluye
`backend/cjTrackingAutomation.test.js` con simulaciones de progreso,
retrasos, estado ambiguo, órdenes concurrentes, leases, URL de tracking y
bloqueo explícito de operaciones que gastan saldo.

Un test verde verifica reglas locales, **no prueba una compra real en CJ**.
