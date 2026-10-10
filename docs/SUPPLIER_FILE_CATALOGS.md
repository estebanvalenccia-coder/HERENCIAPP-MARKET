# Herencia Market · Importación multiproveedor por archivos

Esta función **no requiere nuevas APIs** y complementa el importador por URL y el exportador a DSers. Los proveedores ya registrados pueden cargar sus catálogos **CSV, JSON o XML** y guardar únicamente productos en borrador, con control manual.

## Flujo

1. Abre Administración → Dropshipping → **Importar CSV/JSON**.
2. Selecciona un proveedor previamente registrado y activo, o crea uno desde el panel.
3. Sube un CSV, JSON o XML autorizado del proveedor. Puedes descargar la plantilla CSV incluida.
4. Pulsa **Inspeccionar columnas** para identificar campos de origen; relaciona los nombres desconocidos con los campos de Herencia y hasta cuatro atributos de variante.
5. **Previsualizar productos y cambios** muestra productos, variantes reales, costes fuente, conflictos y diferencias respecto al catálogo existente, sin escribir en Neon.
6. Pulsa **Confirmar y guardar borradores en Neon**. No se modifican productos existentes, incluidos los borradores.
7. Abre cada ficha para revisar atributos, fotos autorizadas (R2), IVA, precios de venta y proveedor antes de publicarla.

### Formato CSV

Una fila = una variante **existente**. Varias filas con el mismo \`product_id\` crean un único producto con variantes reales, nunca un producto cartesiano ficticio.

\`\`\`csv
product_id;product_name;variant_id;supplier_sku;option_color;option_talla;cost;currency;product_url
REF001;Camiseta;REF001-RED-S;TSHIRT-RED-S;Rojo;S;4,75;EUR;https://proveedor.example.com/camiseta
REF001;Camiseta;REF001-BLUE-M;TSHIRT-BLUE-M;Azul;M;4,95;EUR;https://proveedor.example.com/camiseta
\`\`\`

Se aceptan delimitadores \`;\`, \`,\` o tabulación; celdas entre comillas, comillas dobles escapadas y saltos de línea entrecomillados. Usa nombre de columna \`option_<nombre>\` o \`attribute_<nombre>\` para opciones dinámicas. Actualmente el selector existente de Herencia admite hasta cuatro atributos por variante; los archivos con más son rechazados en lugar de perder datos.

### Formato JSON

\`\`\`json
{
  "products": [
    {
      "product_id": "REF001",
      "name": "Camiseta",
      "currency": "EUR",
      "variants": [
        { "variant_id": "REF001-RED-S", "sku": "TSHIRT-RED-S", "cost": "4.75", "options": { "color": "Rojo", "talla": "S" } },
        { "variant_id": "REF001-BLUE-M", "sku": "TSHIRT-BLUE-M", "cost": "4.95", "options": { "color": "Azul", "talla": "M" } }
      ]
    }
  ]
}
\`\`\`

También se acepta un array plano de productos. Las variantes conservan identificadores y SKU originales (sin inventarlos). Los costes de compra originales se guardan con la moneda **sin convertirlos a EUR ni usarlos como precio de venta**.

## Archivos XML y mapeo personalizado

XML requiere un documento con una raíz `<products>`, `<catalog>`, `<feed>` o `<items>`, y entradas `<product>`, `<item>`, `<row>` o `<entry>`. Puede incluir `<variants><variant>...` con SKU e identificadores propios. La importación usa `fast-xml-parser` con validación estructural, límites estrictos y deshabilita DTD/entidades externas. No interpreta plantillas XML arbitrarias ni archivos con `DOCTYPE`: para otros esquemas usa mapeo sobre las columnas detectadas o convierte el feed a CSV/JSON.

Usa **Inspeccionar columnas** y selecciona los nombres del archivo para cada campo que Herencia no reconozca. Para variantes dinámicas, añade hasta cuatro atributos (`color`, `enchufe`, `talla`, `material`...). Las reglas de mapeo son explícitas, nunca habilitan pagos ni compras, y se vuelven a validar en el backend cuando guardas. Pulsa **Guardar mapeo para este proveedor** para reutilizarlo con archivos posteriores del mismo proveedor y formato. Los perfiles se almacenan solo en Neon con control administrativo y contienen nombres de columnas, no precios ni claves API. Pulsa **Inspeccionar columnas** en un archivo posterior para recuperar el perfil; se omiten columnas que ya no existan. No se sincronizan productos automáticamente.

Si el SKU o el coste de una variante ha cambiado, Herencia muestra las diferencias y mantiene **intactas** tus fichas existentes. No se aplican actualizaciones silenciosas; deberán revisarse en Administración antes de editar manualmente el artículo.

## Límites y seguridad

- Máximo 512 KB, 300 filas, 30 productos y 60 variantes por producto por archivo.
- Proveedor registrado y activo, sesión de administrador y confirmación manual obligatoria para escribir en Neon.
- Duplicados detectados por ID determinista de proveedor+ID del producto y por URL original. No se sobrescriben datos previos.
- Los borradores empiezan con \`status=draft\`, \`active=false\`, precio público \`0\`, stock \`0\` y \`fulfillmentMode=manual\`; no hay compras ni pagos.
- Las URLs originales e imágenes fuente solo se conservan como metadatos del borrador: las fotografías no se descargan de manera encubierta, no se publican y requieren revisión/copia autorizada a R2.
- Una vista previa de costes del proveedor **no** demuestra tarifas actuales, existencias reales, certificaciones de productos, impuestos ni plazos de entrega.
- XML con DTD, entidades externas, instrucciones de procesamiento no estándar, estructura malformada o entradas excesivas se rechaza.
- Las importaciones muy grandes deben dividirse en lotes. Una importación puede terminar parcialmente (muestra cada fila de resultado); repetirla no vuelve a modificar los artículos ya guardados.
- Esta capacidad no sustituye las APIs ni habilita automatización de pedidos o el checkout internacional.

## Pendiente

Guardar plantillas de mapeo reutilizables por proveedor, editar actualizaciones tras la comparación, verificar catálogos contra el proveedor y comparar automáticamente ofertas por variante y código postal de los 27 países de la UE, sin habilitar ventas antes de las verificaciones fiscales/comerciales.
