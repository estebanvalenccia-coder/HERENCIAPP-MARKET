# Herencia Market · Conectores de proveedor extensibles

El Supplier Hub no está restringido a CJdropshipping y DSers. Es posible
registrar cualquier distribuidor que tenga un nombre, con o sin página web.

## Modalidades al crear un proveedor

- **Manual**: pedidos revisados y tramitados por una persona. No requiere API.
- **CSV**: alta y vinculación del proveedor. Se desarrolla un mapeador de
  importación/exportación según su plantilla específica, sin prometer pedidos
  automáticos por el solo hecho de registrarlo.
- **API propia**: ficha del proveedor registrada; requiere implementar y
  aprobar un adaptador de su API oficial antes de sincronizar catálogo,
  pedidos, stock o seguimiento.
- **Webhook**: se puede conectar un servicio intermediario autorizado para
  recepción de pedidos y avisos de seguimiento, sujeto a prueba y controles.
- **CJdropshipping**: conserva el flujo existente de doble aprobación de
  creación y pago. No se usa el webhook genérico para comprar en CJ.

DSers se utiliza inicialmente como puente CSV para AliExpress, no como
conector de pedidos en tiempo real.

## Ejemplo de proveedor externo por webhook

1. En Administrador → Proveedores → Nuevo proveedor, escribe el nombre,
   dominio si lo hay y selecciona **Webhook personalizado**.
2. Escribe una clave alfanumérica en mayúsculas, p. ej. `VIVERO_NORTE`.
   Guarda el proveedor en modo **Manual**.
3. Configura **solo en las variables privadas del backend de Railway**:
   - `SUPPLIER_CONNECTOR_VIVERO_NORTE_URL` = endpoint HTTPS autorizado
   - `SUPPLIER_CONNECTOR_VIVERO_NORTE_TOKEN` = secreto de autenticación
4. Despliega Railway. En Proveedores registrados pulsa **Probar conector**.
   Herencia envía `POST` con cabecera `Authorization: Bearer <token>`:
   ```json
   {"event":"supplier.connector.test","dryRun":true,"supplier":{"id":"...","name":"..."}}
   ```
   El conector debe responder HTTP 200 con:
   ```json
   {"ok":true,"capabilities":{"orders":true}}
   ```
   **No se envían productos, pedidos, nombres, direcciones ni pagos** durante la
   prueba. Esta respuesta confirma el protocolo de prueba, no garantiza
   cumplimiento real o aprobación comercial del proveedor.
5. Si pasa la prueba, la ficha muestra el conector como listo. El administrador
   puede después elegir Autopilot manualmente y vincular artículos.
   El sistema comprueba costes, presupuesto, dirección, margen y cobro Stripe
   real antes de enviar un pedido. No admite cupones totalmente financiados
   por Herencia sin autorización manual adicional.

## Contrato de pedido del conector

El proveedor recibe `POST` HTTPS con `Authorization: Bearer <token>`,
`Idempotency-Key: HERENCIA-<fulfillmentId>`, evento
`supplier.order.create`, ID de proveedor, ID de pedido, SKU, cantidades,
costes estimados, nombre/dirección de envío y correo del cliente.

El conector **debe** ser idempotente y nunca comprar dos veces con la misma
clave. En caso de aceptación, responde con:
```json
{"status":"ordered","externalOrderId":"ID-REAL-DEL-PROVEEDOR"}
```
El sistema rechaza para conectores nuevos confirmaciones ambiguas sin
`externalOrderId`; las incidencias de red no se reintentan automáticamente.
Quedan marcadas para conciliación con el proveedor.

Para tracking, el conector puede llamar al webhook autorizado de Herencia:
`POST /api/supplier-autopilot/webhook`, con su propio Bearer token, el
`fulfillmentId` emitido por Herencia y estado `shipped`, `delivered`,
`cancelled` o `action_required`. La tokenización está aislada por proveedor.

**Nunca** pongas una API Key, token, password o URL arbitraria desde un campo
de producto. Herencia toma URL y token del backend únicamente, y no permite
conexiones HTTP ni direcciones IP directas en las variables de webhook.

## Lo que no hace el registro por sí solo

Crear una ficha de proveedor no importa automáticamente fotografías de
AliExpress, no instala aplicaciones externas, no habilita la API de un
distribuidor, ni garantiza sincronización de inventario, transporte o pagos.
Cada proveedor necesita sus propios permisos, catálogo y mapeos de variantes.
