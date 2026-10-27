# Guía del administrador visual — Herencia Market
**Versión de desarrollo:** PR #333. Los cambios no aparecen en producción hasta que la propuesta sea integrada y desplegada.
## Cómo editar sin alterar la tienda pública
1. Abre `/admin` e inicia sesión con una cuenta administradora activa.
2. En el constructor visual, elige **Editar sobre tienda real**. Elige Inicio, Productos, Ficha de producto, Servicios o Contacto.
3. Selecciona un componente en el visor. Su inspector permite activar/desactivar, limitar a móvil/tablet/ordenador y cambiar fechas y estilos. Las operaciones de comercio están bloqueadas en la previsualización.
4. Utiliza **Controles ON/OFF** para buscar todos los elementos registrados y acceder a sus opciones avanzadas.
5. **Guardar borrador** no publica. **Publicar** valida enlaces, permisos y versión; si otro administrador publicó antes, se recibe un aviso de conflicto y no se sobrescribe.
6. **Deshacer publicación** restaura la última versión mediante el servidor y crea un nuevo registro. No modifica compras ni inventario.

## Elementos que pueden administrarse
- Cabecera: mensaje, buscador, cuenta, favoritos, carrito, Herencia IA, entrega y navegación.
- Inicio: 11 secciones, tarjetas, banners, categorías y beneficios.
- Catálogo: introducción, filtros y cuadrícula de productos (sin alterar precio, stock ni disponibilidad).
- Ficha de producto: galería, información de compra, relacionados, reseñas y preguntas (su diseño, no la lógica de cobro).
- Servicios: portada, tarjetas, contratación y pasos del servicio.
- Contacto: métodos, formulario y horarios.
- Flotantes: Herencia Sales, WhatsApp, soporte y accesibilidad; pie de página y enlaces.

## Diseño visual
En el inspector puedes cambiar colores hexadecimales, márgenes, padding vertical, radio de esquinas, tamaños de título y sección, ancho, tipografía, sombras y animaciones suaves. Cada control puede volver a **Diseño original**. Las animaciones respetan el ajuste de movimiento reducido del dispositivo. Algunos elementos interiores aún tienen estilos específicos que requieren su editor de página.

## Menús y subcategorías
El menú admite enlaces anidados (hasta 8 niveles para evitar árboles inusables). Los enlaces pueden ocultarse por dispositivo o fecha. Desactivar una categoría comercial no debe utilizarse para eliminar stock, clasificaciones ni productos: esas operaciones pertenecen al módulo de Comercio.

## Campañas
En **Campañas y banners programables** crea una campaña desde plantilla, carga imagen, título, botón y destino; decide ON/OFF y fecha inicial/final. El calendario interpreta fechas en Europa/Madrid. **Activar campañas completas** solo habilita las que tienen imagen, título y destino; las fechas siguen determinando cuándo se ven. Evita activar campañas sin revisar precios y existencias.

## Biblioteca de secciones
Selecciona un bloque del constructor, dale un nombre y elige **Guardar sección seleccionada**. Puedes insertar nuevas copias o eliminar plantillas guardadas. Borrar una plantilla no elimina las copias ya insertadas. Se admiten hasta 30 plantillas.

## Analítica
El informe de clics registra interacciones solo con consentimiento de medición. Los totales de pedidos pagados/confirmados se muestran separados. **No son ventas atribuibles a un botón concreto** y no deben utilizarse como una métrica de conversión por campaña sin implementar y verificar atribución.

## Permisos, historial y seguridad
Solo el propietario puede establecer restricciones individuales para que un administrador publique, restaure o consulte auditoría. El rol empleado no puede publicar. La auditoría registra administrador, acción y revisión del contenido, no borradores completos. La publicación atómica en Neon impide sobrescrituras simultáneas.
La configuración visual **no administra pagos, pedidos, proveedores, contraseñas o inventario**. Las plantas naturales siguen siendo stock propio; las herramientas/macetas/accesorios pueden proceder de dropshipping según la configuración comercial.

## Diagnóstico antes de publicar
Revisa advertencias de vínculos repetidos o vacíos, imágenes ausentes, títulos faltantes, componentes no registrados, controles invisibles en todos los dispositivos y contrastes de color por debajo de 4.5:1. Algunas advertencias son orientativas; enlaces peligrosos o fechas inválidas bloquean la publicación.
Si una función nueva desarrollada por otro chat no aparece, su desarrollador debe añadir un ID al registro y envolverla en `StorefrontComponentBoundary`. **No hay detección automática de JSX arbitrario.**

## Comprobaciones recomendadas de regresión
- Guardar borrador, recargar, publicar, restaurar y comprobar en otra ventana privada.
- Visibilidad y fechas con horario Madrid, incluso el cambio de hora.
- Navegación con ratón y teclado, desktop/tablet/móvil.
- Cambios simultáneos desde dos cuentas admin.
- Probar pagos con método de pruebas, carrito, cupones, variantes de dropshipping y comunicaciones de pedido antes de cualquier lanzamiento importante.
