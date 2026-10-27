# Administración visual Herencia Market — Implementación incremental

**Rama:** `feature/admin-universal-controls-20261027`  
**PR borrador:** #330  
**Regla:** no fusionar a `main` ni desplegar automáticamente hasta revisar compatibilidad con desarrollos paralelos.

## Funcionalidad implementada en esta rama

- Los enlaces de navegación pueden activarse, desactivarse, reordenarse, duplicarse, eliminarse y añadirse desde administración.
- Los enlaces admiten visibilidad diferenciada para móvil y escritorio, además de submenús configurables.
- Los desplegables de Plantas y Jardinería tienen contenido inicial editable; la tienda usa los enlaces guardados, no listas fijas para renderizarlos.
- Categorías, tarjetas de servicios y beneficios de Inicio admiten ON/OFF, edición, orden, duplicación, borrado y creación.
- Los banners promocionales permiten ON/OFF individual y ventanas de publicación.
- Secciones de portada independientes: portada, entrega internacional, categorías redondas, contenido dinámico, botón de plantas, cuadrícula de categorías, servicios, productos destacados, promociones, beneficios y CTA inferior.
- Cabecera: franja informativa, buscador, cuenta, favoritos, carrito, selector de entrega y pie de página configurables.
- Enlaces del pie: ON/OFF, publicación programada, orden, duplicación, eliminación y creación.
- Botones de llamada a la acción: visibilidad y calendario mediante el editor compartido.
- Herencia Sales: botón flotante con posición, altura y color; acciones rápidas con ON/OFF individual.
- El panel existente de administración se mantiene. Dentro del constructor visual se añade un acceso a **Controles ON/OFF** conectado con sus mecanismos de borrador, deshacer y rehacer.
- Las listas vacías de navegación, categorías, servicios, beneficios, acciones y enlaces del pie se respetan; no se reconstruyen automáticamente por sus valores por defecto.
- Las ventanas se guardan como instantes ISO con zona horaria; el cliente las evalúa periódicamente.
- Se añadieron pruebas Node para programación de publicación.

## Invariantes de compatibilidad

1. El catálogo, proveedores, compras, pedidos, clientes, inventario y configuración de envíos existentes no se modifican.
2. La distinción entre plantas naturales propias y accesorios de dropshipping se mantiene.
3. Nunca publicar `siteContentDraft` por defecto: usar las acciones explícitas del editor.
4. El contenido publicado reside en el mecanismo `backendStorage` existente; no alterar permisos del backend con este cambio.
5. Comparar y actualizar esta rama antes de fusionar si `main` recibe trabajos concurrentes.

## Verificaciones antes de producción

- CI: pruebas Node, seguridad, delivery, release, compilación Vite, importaciones backend aisladas y sintaxis backend.
- Probar manualmente en administración: guardar borrador, recargar, publicar, recargar tienda, restaurar y deshacer.
- Comprobar navegación y submenús en escritorio, tablet y móvil con y sin accesibilidad mediante teclado.
- Probar inicio y fin de una promoción programada en zona horaria Europa/Madrid (incluidos cambios de hora).
- Verificar estado draft/archived de colecciones, relaciones categoría-banner, enlaces inválidos y categorías inexistentes.
- Comprobar que guardar configuraciones simultáneamente desde dos sesiones no pierda modificaciones.
- Revisar cambios paralelos contra el último commit de `main`.

## Pendiente — siguientes fases del prompt maestro

### P1: Persistencia y seguridad reforzadas
- Migración de esquemas de contenidos, permisos administrativos de granularidad fina por acción (más allá de los roles existentes) y publicación de contratos de componentes nuevos.
- Auditoría permanente de quién modificó cada elemento, permisos backend por rol.
- El historial de publicaciones se guarda junto con el contenido publicado en una transacción Neon; queda pendiente verificar recuperación y migración de versiones antiguas con datos reales.

### P2: Editor universal de estilos
- Registro declarativo de componentes que nuevos desarrollos deberán implementar.
- Propiedades de tamaño, espaciado, tipografía, sombras y breakpoints para **cada** elemento.
- Inspector visual por clic en la página publicada y sincronización completa de cada sección de Inicio con bloques del constructor.
- Reordenar secciones promocionales completas (además del orden de tarjetas existente).

### P3: Configuración comercial y asistentes
- Ajustes visuales y de permisos detallados de Herencia IA, soporte y WhatsApp.
- Subcategorías jerárquicas ilimitadas, filtros y reglas de catálogo.
- Gestión independiente de banners de categoría que preserve políticas de estado archivado.

### P4: Operativa y marketing
- Calendario de campañas con zona horaria de tienda, plantillas, programación por público y acciones masivas.
- Analítica de clics y conversiones respetando consentimiento.
- Biblioteca reutilizable de secciones y elementos.
- Diagnóstico de enlaces, imágenes, SEO, accesibilidad y componentes sin registrar.

### P5: Entrega
- Pruebas de interacción/visual end-to-end, accesibilidad y regresión responsive.
- Entorno de preproducción aislado y aprobación de despliegue.
- Guía de uso en español para los administradores.

**Estado:** propuesta funcional en desarrollo; NO es una entrega final de todas las fases.

## Avance adicional — componentes universales y orden real

- Registro declarativo en `src/app/lib/componentRegistry.ts`, con 21 componentes iniciales de cabecera, portada, botones flotantes y pie de página.
- Política reutilizable de visibilidad, programación y escritorio/tablet/móvil en `componentPolicy.mjs`.
- Aplicación efectiva mediante `StorefrontComponentBoundary` en `Home.tsx` y `Layout.tsx`.
- Inventario filtrable `AdminComponentRegistry`: encender/apagar, horario, dispositivo, ir al editor de contenido, aviso de ajustes guardados sin registro.
- Modelo `marketExperience.componentControls` persistido con el resto del contenido. Los controles anteriores de cabecera, portada y Sales permanecen sincronizados.
- Orden de las 11 secciones completas de la portada guardado en `home.sectionOrder`, reordenable con arrastre o flechas y aplicado con flex order en la tienda.
- Resumen del orden/estado de secciones en la previsualización del constructor (esquema visual, **no** reproducción fiel de todas las secciones de Home).
- Los editores publican mediante el endpoint atómico `/api/admin/site-content/publish`. PostgreSQL bloquea la clave de contenido, compara la versión y guarda contenido, borrador e historial en una transacción. Conflictos concurrentes devuelven HTTP 409.
- Las listas vacías de bloques, categorías y ventajas legacy permanecen vacías cuando se eliminan explícitamente; el constructor utiliza la marca `blocksInitialized` para distinguir tiendas antiguas de una eliminación intencionada.
- Pruebas `backend/componentPolicy.test.js` para OFF, calendario y 8 combinaciones de dispositivo.

### Notas de compatibilidad y riesgos

- Un nuevo componente debe declararse en el registro **y** envolverse en la frontera de visibilidad en su renderizado. El sistema no descubre automáticamente JSX arbitrario.
- Los cambios de posición de la portada se aplican como CSS `order`; requieren revisión manual de presentación y accesibilidad en tamaños reales antes del despliegue.
- Los controles de catálogo, autenticación, cobro y stock no se alteran desde esta configuración visual.
- Comprobar los estados del calendario en cambios de horario, y los controles que ocultan un acceso importante como carrito o soporte.
- Esta propuesta sigue siendo borrador hasta completar QA, conflictos y las fases pendientes del prompt.

## Avance de publicación segura y diagnóstico

- `sitePublicationValidation.mjs` valida protocolos de enlaces, submenús, fechas ISO con zona horaria y enlaces legales obligatorios antes de publicar en ambos editores.
- `AdminSiteDiagnostics` avisa de enlaces duplicados, imágenes ausentes, componentes sin destino y secciones activadas pero ocultas en todos los dispositivos. No hace peticiones externas ni asegura que un enlace remoto funcione.
- Incluso con el pie de página opcional desactivado se conserva una zona legal con privacidad, cookies, términos y copyright.
- La detección previa en cliente ahora se complementa con una comprobación transaccional en el servidor y autenticación de roles administrativos. Un administrador no puede sobrescribir la publicación posterior de otro.
- `ensureBuilderBlocks` distingue el estado legado de una lista de bloques intencionadamente vacía mediante `blocksInitialized`.
- `marketExperience.home.sectionOrder` controla el orden de once secciones reales sin reescribir los componentes. Las tarjetas y servicios mantienen controles independientes.
- Las pruebas de publicación se amplían con `sitePublicationValidation.test.js` y casos de calendario ambiguo.

**Precaución:** el despliegue permanece bloqueado hasta comprobar el comportamiento en navegadores reales, permisos administrativos, actualización de base de la rama frente a cambios paralelos y revisión funcional completa.

## Avance de estilos específicos y botones flotantes

- Diseño individual para tarjetas de categorías y servicios: fondo, color de título, esquinas, altura y encuadre de imagen. Son campos guardados con cada tarjeta y aplicados en la portada.
- Banners promocionales: altura mínima, borde redondeado, opacidad del degradado, posición de imagen y alineación del contenido.
- Límites editables para la cuadrícula de categorías (0 significa todas) y para productos destacados.
- La asistencia al cliente se reposiciona automáticamente cuando el botón flotante de Herencia Sales utiliza la misma esquina y una altura que lo cubriría; preserva el lado de soporte existente cuando no hay colisión.

## Comprobaciones aún pendientes

- Validación visual manual en móviles pequeños, tablets y escritorios (colores, espacios, stacking de widgets, orden CSS, teclado y foco).
- Estructura de componentes de registro para cualquier desarrollo nuevo no incluido entre los 21 elementos actuales.
- Se implementaron publicación transaccional, roles del gateway, plantillas de campañas estacionales y analítica agregada de clics. Sigue pendiente QA real de navegadores y estilos avanzados para componentes aún no integrados.

## Avance de integración final — octubre de 2026

### Publicación, roles y reversión
- Endpoint seguro `POST /api/admin/site-content/publish` en el gateway Neon; comparación del contenido publicado original mediante transacción y bloqueo PostgreSQL, respuesta HTTP 409 si otra cuenta publicó antes.
- Guarda contenido, borrador, historial y ajustes visuales auxiliares en la misma transacción, sin sobrescribir optimistamente el navegador.
- Ambos editores utilizan el nuevo endpoint. La ruta genérica PUT de `siteContent` se rechaza para forzar la publicación con control de versiones.
- El acceso administrativo del gateway verifica rol `admin` o `owner` y rechaza sesiones incompletas de alta de usuario.
- Botón para deshacer la última publicación desde el constructor visual; mantiene una nueva entrada de historial al revertir.
- Tests de colisión de versiones, contenido no válido, configuración auxiliar y límites de historial.

### Editor sobre el frontend real
- Vista previa de la portada mediante iframe del mismo origen, aislada de la publicación; recibe el contenido actual como mensaje temporal.
- Los elementos `StorefrontComponentBoundary` pueden seleccionarse haciendo clic: abre un inspector contextual con ON/OFF, dispositivo, programación y orden.
- El inspector remite al panel completo cuando se necesitan propiedades específicas.
- Editar enlaces globales de la cabecera en el constructor sincroniza los cambios con el menú que usa el frontend.

### Promociones, estadísticas y asistencia
- Campañas estacionales independientes de Dulce/Moda, inicialmente ocultas, con plantillas Navidad, San Valentín y temporada; imágenes, diseños, orden y fechas independientes.
- Agregación de clics de componentes; se registra exclusivamente cuando el visitante aceptó medición. El tablero es agregado, no incluye datos personales ni pretende atribuir compras.
- Editor de apariencia para cabecera y footer conectado con `site.builder` y renderizado real.
- Posición, color, distancia y etiqueta del botón de atención al cliente; evita solapamientos con Herencia Sales.

### Bloqueadores del último paso a producción
- No se ha ejecutado una prueba E2E en una implementación temporal. La creación del preview en Vercel fue rechazada por falta de autorización para el equipo (403); requiere aprobación del propietario.
- Completar pruebas reales de ratón y teclado, móvil/tablet/escritorio, campañas y recuperación de publicación, con dos cuentas administrativas simultáneas.
- Revisar integridad de productos, pagos, pedidos y devoluciones después del despliegue.
- Revisar nuevas incorporaciones al registro de componentes y su compatibilidad con los trabajos paralelos.
- No fusionar la PR a `main` ni activar producción hasta resolver estos puntos.

**Alcance:** base operativa del editor visual y su publicación segura, no garantía de personalización de código arbitrario no registrado.
