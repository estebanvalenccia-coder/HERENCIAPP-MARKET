# HERENCIA — seis bloques sin nuevas APIs y dos preparados

Esta fase completa una **base de operaciones supervisadas**, no una automatización integral.
Se mantiene el código anterior: CJ con controles manuales, proveedores existentes, Stripe,
TPV, Herencia Neural, contenido, Neon y R2.

## 1. Revisión de catálogos existentes

- Importa CSV, JSON o XML y ve los cambios respecto al artículo existente antes de guardar.
- Al **aprobar solo costes**, el backend vuelve a analizar el archivo auténtico,
  comprueba que sigue siendo el mismo proveedor, mismo ID de producto y mismas
  combinaciones SKU/VID.
- Neon guarda únicamente `supplierVariantPrices`, `supplierOriginalPrice`,
  `supplierCurrency` y una marca de revisión; exige la última versión de la ficha
  y `status=draft` / `importedFromFile=true`.
- El precio público, stock, imágenes, descripción y opciones no cambian. No permite
  cambios de variantes automáticamente. Si un SKU o VID difiere, abre la ficha y
  resuélvelo manualmente con el proveedor.
- La aprobación del archivo **no certifica** precio ni stock reales.

## 2. Identificar referencias entre proveedores

- Utiliza GTIN válido (comprobación de dígito) o fabricante + número de pieza MPN.
- Ni el nombre parecido ni el SKU local permiten deducir equivalencia.
- El administrador compara ambas fichas y puede confirmar la misma referencia.
- El vínculo queda en almacenamiento privado Neon; las variantes, enchufes y tallas
  continúan siendo independientes. No cambia el proveedor de los pedidos.

## 3. Margen y precio estimados

- Simulación por variante y país UE, con coste, flete EUR, otros gastos,
  IVA indicado por el comerciante y margen neto objetivo.
- El módulo backend exige cotización de envío de antigüedad máxima 15 minutos
  y cambio de divisas inferior a una hora si se usa una moneda distinta de EUR.
- El panel ofrece simulación manual EUR, **no una cotización verificable**.
- La recomendación nunca actualiza el precio de Herencia ni habilita checkout.

## 4. Alertas de inventario y costes

- Del archivo se conservan las existencias **declaradas por el proveedor**, sin
  modificar las existencias de la tienda ni reservas.
- Se detectan subidas de coste por variante, nuevas/retiradas variantes,
  cambios de divisa y transición de stock reportado a cero.
- Para vender se sigue necesitando verificar el stock real y transporte con el
  proveedor autorizado; los datos históricos no autorizan un cobro.

## 5. Incidencias y posventa

- Casos internos administrables por pedido existente, proveedor y motivo:
  retraso, daño, pérdida, variante incorrecta, devolución, reembolso solicitado
  o error del proveedor.
- Idempotencia por pedido/proveedor/motivo, revisión/versionado y notas privadas.
- Nunca dispara `Stripe.refunds`, compras al proveedor ni un reembolso. Las
  obligaciones legales y el procesamiento financiero usan los flujos autorizados.

## 6. Pruebas

- Test de GTIN/MPN, opciones exactas, bloqueo de cambios no aprobados,
  condiciones fiscales, alertas de coste/stock, casos de posventa y seguridad.
- Sigue activa la comprobación aislada de dependencias de Railway que evita
  errores anteriores de `fast-xml-parser`.

## 7–8. Conectores externos y automatización

Contrato técnico de capacidades requerido antes de activar cualquier conector:
variantes, stock, precio por VID/SKU, envío por destino, borrador de pedido, tracking,
reclamaciones, idempotencia, auditoría y aprobaciones. **No significa que estas
integraciones estén conectadas ni que puedan realizar compras.** Requieren
credenciales y permisos oficiales, pruebas en entorno seguro y activación expresa.

## Seguridad operativa

- El panel está restringido a administradores; `supplierAftercareCases` y
  `supplierProductLinks` son claves protegidas privadas de Neon.
- No se publican automáticamente fichas, no se cambia la información de pago,
  no se amplía checkout CJ España/1 unidad sin verificar impuestos y portes.
- Pueden existir cotizaciones caducadas y fuentes manuales; toda activación
  comercial requiere inspección reciente de API donde esté disponible.

## Archivos principales

`backend/supplierOfflineIntelligence.js`, `supplierCostApproval.js`,
`supplierAftercare.js`, `supplierProductLinks.js`,
`backend/neonGateway.js`, `backend/neonDb.js`,
`src/app/components/admin/AdminSupplierOperations.tsx` y
`AdminSupplierFileImport.tsx`.
