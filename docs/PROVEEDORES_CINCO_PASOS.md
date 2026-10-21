# Motor de proveedores: guía operativa de cinco pasos

El frontend público y `/admin` siguen siendo HERENCIA MARKET. El dropshipping se aplica **solo** a
productos externos; las plantas y los artículos con inventario propio no pasan por este motor.

## 1. Conectar
- Elegir AliExpress, CJdropshipping, Printful o un proveedor manual/CSV/webhook.
- Comprobar que la API autentica **y** que el alcance de pedidos está verificado por separado.
- Un proveedor con credenciales guardadas no implica compras habilitadas.
- Para nuevas API, crear y probar un adaptador individual; el alta genérica no crea uno.

## 2. Importar
- Pegar URL oficial o ID para AliExpress, CJ y Printful; CSV/JSON/XML para otros proveedores.
- Guardar borrador con el ID remoto, imágenes y variantes genuinas (nunca inventar SKU).
- Si faltan variantes, no publicar como artículo de dropshipping listo para vender.

## 3. Vincular
- Confirmar la variante seleccionada por el cliente y su SKU/VID exacto en el proveedor.
- Guardar el coste comercial y el transporte con cotización vigente para el destino.
- Un error de mapeo bloquea el pedido externo aunque el artículo ya esté visible.

## 4. Publicar
- Revisar precio, margen neto, IVA, transportes, stock, derechos sobre imágenes y cumplimiento.
- Aprobar publicación y la automatización por separado; no son el mismo permiso.
- El producto puede estar publicado sin estar habilitado para compras automáticas. El panel debe indicarlo.

## 5. Vender y tramitar
- El pago confirmado crea el pedido HERENCIA y una tarea en la cola del proveedor.
- Consultar **Paso 5 → Diagnosticar AliExpress** para ver los motivos concretos del bloqueo.
- Nunca convertir un pago de 0 € en autorización automática para cargar al proveedor.
- Antes de enviar datos personales, verificar la base jurídica y las autorizaciones aplicables.
- Mantener protección contra duplicados y conciliación tras respuestas de red ambiguas.

### Realidad por proveedor
- **AliExpress**: API OAuth y creación de pedido **sin pagar**, solo si los permisos, el cobro
  Stripe LIVE, el SKU, el coste, el envío, el margen y las variables de entorno están correctos.
  El **pago automático a AliExpress todavía NO está implementado**.
- **CJdropshipping**: dispone de creación/pago supervisados, y ejecutor opcional sujeto
  a tres variables privadas, límites económicos, mandato vigente (30 días) y prueba real previa.
  El nuevo mandato no debe ejecutar compras sobre pedidos antiguos.
- **Printful**: la confirmación de los pedidos necesita el flujo y la política de pagos específicos.
- **Otros proveedores**: importar CSV o guardar una ficha no equivale a crear pedidos mediante API.
  Cada conector debe documentar autenticación, precio, variantes, órdenes y tracking.

### Incidente reproducible en base de datos (19-oct-2026)
Una orden de ejemplo de AliExpress quedó en `connector_required`: total de venta 0 €,
sin PaymentIntent de Stripe, coste externo 0 y SKU/variante sin vincular.
El bloqueo evita una compra no autorizada y no se debe quitar mediante `force` ni
activando indiscriminadamente las variables de entorno.

### Pruebas obligatorias antes de activar dinero real
1. Producto importado con ID original y variantes verificadas.
2. Pedido de prueba supervisado con cobro real autorizado y límite económico.
3. Confirmación inequívoca en la plataforma de origen con ID remoto.
4. Pago real al proveedor **solo tras autorización expresa**, con saldo y conciliación.
5. Estado y tracking recuperados; fallos visibles y reintentos idempotentes.

La prueba de solo lectura no crea, paga ni envía pedidos. No activar automáticamente
las compras reales a partir de un estado verde de catálogo.
