# Herencia Market ↔ CJdropshipping — operación controlada

## Flujo de un pedido

1. El cliente paga con Stripe o utiliza un cupón válido que deja el total en **0,00 €**.
2. Herencia confirma el pedido y lo introduce en **Administración → Proveedores → Cola de pedidos a proveedores**.
3. Herencia valida la variante CJ (VID y SKU), el país y código postal, el transporte elegido, el coste del artículo y la cotización reciente en USD/EUR.
4. El administrador pulsa **«Revisar aprobación CJ»**. La vista muestra coste estimado en euros, coste CJ en dólares, máximo configurado y si el coste lo asume Herencia.
5. **Crear pedido en CJ SIN pagar:** exige proveedor CJ REAL, `CJ_LIVE_ORDER_CREATION_ENABLED=true`, importe máximo en USD, confirmación textual, y aceptación expresa cuando Herencia financia el cupón. Se envía a CJ con `payType=3`, sin llamar a su API de pagos.
6. Si CJ confirma el ID, el pedido pasa a **payment_required**. NO hay débito al proveedor todavía.
7. **Revisar y autorizar pago CJ:** requiere una **segunda** confirmación textual y `CJ_LIVE_PAYMENT_ENABLED=true`; solo con coste real CJ conocido y menor o igual que el tope aprobado. Revalida Stripe para pedidos cobrados, y exige aceptación explícita para cupones de 0,00 €.
8. Una vez confirmado el cargo, aparece el ID CJ y el pedido pasa a `ordered`. Luego se puede consultar estado y tracking por API en Administración.

## Variables de Railway

| Variable | Producción segura antes de autorizar | Función |
|---|---|---|
| `CJ_API_KEY` | Ya configurada; no compartir ni mostrar | Consultas autenticadas CJ |
| `CJ_LIVE_AUTOPILOT_ENABLED` | **false** | Prohibir pagos automáticos; la aprobación manual nueva no depende de activarla |
| `CJ_LIVE_ORDER_CREATION_ENABLED` | **false** hasta que el responsable apruebe el modo real | Interruptor de creación de pedidos CJ sin pago |
| `CJ_LIVE_PAYMENT_ENABLED` | **false** o ausente hasta autorización explícita | Interruptor INDEPENDIENTE para autorizar un débito de saldo por pedido |

Además, en **Proveedores registrados → CJdropshipping** el modo deberá ser REAL (no SANDBOX) antes de cualquier creación. No basta con modificar una variable para que se hagan compras: exige dos gestos autenticados y distintos desde Administración.

## Incidencias y duplicados

- `cj_creating` / `cj_paying`: hay una acción externa iniciada. NO repetir.
- `cj_creation_unknown` / `cj_payment_unknown`: la respuesta externa fue ambigua. NO repetir, ni siquiera si CJ devuelve un error genérico.
- Pulsar **«Conciliar con CJ (sin comprar)»** consulta el pedido en CJ por el ID o la referencia determinística `HM-{idPedido}-{idFulfillmentCorto}`.
- Solo una confirmación positiva de CJ puede actualizar la cola: si la API no encuentra el pedido (paginación/latencia), el estado sigue bloqueado. Revisar también en el portal CJ.
- Una reserva transaccional en Neon **y un registro de acción independiente** por creación/pago evitan reintentos automáticos por clics repetidos, pestañas antiguas o resynchronización.
- **NUNCA** utilizar el antiguo botón Autopilot de proveedores para comprar en CJ. Está protegido y solo permite revisión.
- En cupones del 100 %, el cliente no paga pero Herencia **sí pagará el producto y el transporte CJ** si el administrador autoriza el segundo paso. No hay Stripe PaymentIntent de 0,00 €; el origen de financiación se registra como `merchant_coupon`.

## Límites y alcance

- La cotización actual de la tienda CJ está soportada para **una unidad, una variante y envío a España** por pedido. Pedidos mixtos, cantidades múltiples o países distintos se bloquean hasta implementar y verificar cotización para ellos.
- Exigir `cjMaxPaymentUsd > 0` y `maxAutoOrderTotal > 0` en el proveedor. No activar compras sin límite.
- El importe final y la disponibilidad siguen dependiendo de CJ. La prueba CI usa casos deterministas **sin enviar pedidos ni efectuar cargos**.
- Acceso a la cuenta CJ vía API de Railway, sin plugin directo de CJ en ChatGPT. **No pegar claves CJ en chats ni capturas**.
