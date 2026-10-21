# Preparación Herencia Market → Shopify «Mi tienda»
**Destino:** `1f0pav-td.myshopify.com` · Shopify Basic · EUR. **Estado:** sin despliegues ni publicaciones.

## Auditoría en Neon (21-10-2026)
- 138 productos (101 activos, 19 archivados, 18 borradores), 34 variantes en 5 productos, 8 colecciones.
- 256 imágenes vinculadas a 134 productos.
- 57 pedidos históricos que se mantienen en origen por ahora.
- 122 productos con inventario controlado y existencias no positivas; 30 precios de producto no positivos y 24 variantes con precios no positivos.
- Shopify destino tenía 0 productos al auditar, y 4 colecciones existentes (Inicio, Jardinería, Moda, Novedades).
- Los registros no equivalen a artículos listos para vender: no activar productos de forma masiva.

## Arquitectura híbrida elegida
Conservar React/Vite, tema y diseño dinámicos, Vercel, HERENCIA SALES, bouquets/IA (Groq y Gemini), CRM/ERP, TPV, herramientas de proveedores y Railway/Neon. Shopify debe llegar a ser fuente de verdad comercial de productos vendibles, checkout, pedidos online y stock comprometido **solo después del corte**. Integrar Storefront Cart API → checkoutUrl alojado por Shopify; nunca ejecutar una segunda orden/cargo por Stripe antiguo para la misma compra. Guardar correspondencias estables Herencia product/variant IDs ↔ Shopify GIDs solo del lado servidor. Ver https://shopify.dev/docs/storefronts/headless/bring-your-own-stack

| Componente | Antes del corte |
|---|---|
| Catálogo | Preparar CSV con todos los productos como `draft`, sin publicar, cantidad Shopify 0; revisar precios/stock/manual |
| Colecciones | Reconciliar 8 de Neon con 4 de Shopify existentes; tags permiten agrupación sin duplicar |
| Carrito | Mapear exclusivamente variantes verificadas con `mapHerenciaCartToShopifyLines`, conservar dedicatorias y atribución no sensible |
| Envíos | Solo entrega a domicilio; no recogida. Verificar local delivery por radio/código postal, franjas y reglas CJ/Printful |
| IA | Mantener interacción visual, recomendaciones y generación; traducir identificadores antes de añadir al carrito |
| TPV/Inventario | Definir Shopify como fuente autoritativa y sincronización bidireccional controlada; evitar ventas duplicadas |
| Pedidos | Preservar historia Neon; webhooks Shopify firmados con HMAC e idempotencia, email único, devoluciones conciliadas |
| SEO | Mantener URLs principales de Herencia, configurar redirecciones y comprobar diseño responsive |

### Límites del plan Basic
- Las extensiones visuales para las etapas información/envío/pago del checkout están disponibles solo en Plus: https://shopify.dev/docs/api/checkout-ui-extensions/latest
- El servicio externo de tarifas calculadas dinámicamente no se incluye en Basic; entrega local puede trabajar con radios, zonas postales y precios configurables: https://help.shopify.com/en/manual/fulfillment/setup/delivery-methods/local-delivery y https://help.shopify.com/en/manual/fulfillment/setup/shipping-rates/third-party-carrier-calculated-shipping
- Los cálculos actuales por Google Maps no deben presentarse como importe definitivo si difieren del checkout Shopify.

## Preparación técnica incluida
- `backend/shopifyMigration.js`: exportación CSV sin efectos y adaptación segura de carritos.
- `backend/shopifyMigration.test.js`: pruebas para borradores, CSV, variantes, dedicatorias y bloqueos.
- `scripts/exportShopifyCatalog.mjs`: exportador de lectura Neon → CSV Shopify y reporte local, sin acceso a pedidos/clientes.

En un servidor privado con `DATABASE_URL` seguro y dependencias instaladas:
```bash
node --test backend/shopifyMigration.test.js
node scripts/exportShopifyCatalog.mjs --out=/ruta/privada/herencia-shopify-drafts.csv
```
El exportador exige una ruta CSV inexistente; genera también `.report.json`. **Nunca añadir estos archivos al repositorio público.** CSV: `Status=draft`, `Published on online store=false`, `Inventory quantity=0`. Es formato de preparación, no equivale a catálogo validado. Instrucciones oficiales: https://help.shopify.com/en/manual/products/import-export/using-csv

## Puertas de seguridad
1. Backup de Neon y archivos R2; revisión de derechos de imágenes, precios, impuestos, costes y stock.
2. Revisión y piloto de importación de productos en borrador, sin publicación, reconstruyendo ID mappings fiables.
3. Implementar lectura/carro Shopify headless bajo feature flag; preservar frontend y componentes IA.
4. Crear webhooks verificados, reconciliar pedidos, POS, proveedor, stock y cliente sin datos duplicados.
5. Adaptar distribución y franjas horarias al checkout posible en Shopify Basic; probar carritos CJ/Printful por separado.
6. Ejecutar prueba controlada end-to-end, devolución, correo, impuesto, atribución, SEO y rollback.
7. Activar checkout y publicar solo tras aprobación y conciliación. **Este PR no activa nada.**

## Pendiente
No se han importado 138 productos ni trasladado pedidos, no hay Shopify Storefront token conectado a la web, no se han activado webhooks ni cambiado dominio o pagos.