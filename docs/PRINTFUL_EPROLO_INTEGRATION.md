# Herencia Market · Printful y EPROLO sin intermediarios

## Printful v2 — cotización real y segura de envíos a la UE

Herencia dispone del endpoint administrativo **POST /api/admin/suppliers/printful/shipping-quote**. La consulta utiliza **exclusivamente** el API oficial `https://api.printful.com/v2/shipping-rates` con **una unidad**, identificador de variante de catálogo, país de la UE y código postal. La autorización utiliza un token privado guardado en el backend Railway, jamás en el frontend ni en Neon.

1. Crear un token privado en el panel de Printful con el permiso mínimo necesario para consultar tarifas de envío. No usar una clave que permita operaciones innecesarias si Printful deja ajustar los scopes.
2. Configurar `PRINTFUL_API_TOKEN` en las variables privadas del servicio backend Railway. Si es token a nivel de cuenta, configurar también `PRINTFUL_STORE_ID` usando el ID numérico de la tienda.
3. Abrir **Administración → Dropshipping → Printful API**; comprobar si el token se detecta en Railway.
4. Obtener un **catalog_variant_id** real desde Printful (no equivale al ID del producto de Herencia); introducirlo con un país UE y un código postal.
5. Pulsar **Cotizar envío real (sin comprar)**. El servidor llama a Printful y muestra métodos, costes EUR y plazo orientativo.

### Límites deliberados

- La respuesta confirma **solo transporte**, no el precio de compra del artículo, si la decoración/diseño es válida, inventario ni coste fiscal total.
- Algunos productos necesitan datos adicionales de impresión (`placements`); no se fabrican esos datos para lograr una estimación.
- No se crean productos, mockups, envíos, pedidos, autorizaciones de pago, ni clientes en Printful.
- No se extiende por esta vía la elegibilidad del checkout; ni se compara como oferta elegible en el motor multiproveedor hasta que existan stock, precio, IVA, variantes y condiciones autorizadas.
- Las tarifas dinámicas pueden cambiar en menos de una hora, por lo que deberán recalcularse antes de cualquier pedido real.
- El estado `configured: true` indica solo que existen credenciales con sintaxis válida; no garantiza que hayan sido autorizadas por Printful.

Referencia oficial: https://developers.printful.com/docs/v2-preview/

## EPROLO — acceso privado, no inventar API

EPROLO requiere solicitar acceso y documentación al representante de la cuenta desde su panel:
https://eprolo.com/es/eprolo-api/

Hasta recibir las especificaciones y credenciales autorizadas, Herencia solo puede usar **importación de URL autorizada, catálogo manual, CSV y perfil de proveedor**, y debe reflejar `adapter_required` (no configurado) para funciones API. No se implementan rutas supuestas, ni se automatizan pedidos con técnicas de scraping.

Al obtener el contrato de API de EPROLO, crear un adaptador independiente con autenticación protegida, inventario y coste por variante, métodos de entrega UE, idempotencia, tracking y reembolsos; probar en sandbox primero. Mantener las compras reales desactivadas hasta aprobar un pedido de prueba de extremo a extremo.

## Seguridad

Las variables nunca deben incluirse en `VITE_*`, enviarse a Herencia Sales, guardarse en `adminSuppliers` ni devolverse en una respuesta HTTP.
El límite del servidor para Printful es de 12 consultas de cotización por minuto y proceso. En réplicas distintas el límite es local, no global.
Los endpoints requieren sesión de administrador y los tests usan `fetch` simulado, sin llamadas a proveedores en vivo.
