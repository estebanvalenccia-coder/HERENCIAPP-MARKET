# Herencia Market: control de releases y alta disponibilidad
Estado: preparado para revisión; no se activó failover, no se modificaron DNS, datos ni pagos.

## Inventario auditado 2026-10-08
- GitHub: estebanvalenccia-coder/HERENCIAPP-MARKET; main es origen del código.
- Vercel herenciapp-market: frontend primario previsto; www.herenciamarket.es.
- Railway wonderful-gentleness / HERENCIAPP-FRONTEND: respaldo web, main, puerto 8080.
- Railway / HERENCIAPP-MARKET: backend principal, directorio backend/, comando node neonGateway.js, puerto 3001.
- Ambos frontends exponen /api/* mediante proxy al backend Railway único. Mantener un único prefijo /api.
- El backend configura DATABASE_URL (PostgreSQL, cliente backend/neonDb.js), SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (legado), R2_* (multimedia), Stripe y seguridad. Los valores no se han leído ni alterado.
- Existe además Postgres Railway: NO asumir que DATABASE_URL apunta a él; verificar destino privadamente antes de hacer ningún cambio.
- Los dominios www y apex figuran tanto en Vercel como en Railway. Eso NO significa failover activo. Comprobar autoridad DNS, TLS y tráfico antes de cambiar.
- Vercel protege ciertos *.vercel.app con autenticación: el auditor marcará un origen inaccesible como unverified, no como SUCCESS.

## Flujo controlado
- vercel.json restringe despliegues Git automáticos a main; otras ramas mantienen pruebas GitHub CI sin crear previews Vercel.
- Una publicación aprobada equivale a una incorporación controlada a main. Evitar commits de prueba repetidos en main.
- Railway frontend y backend aún tienen autodeploy desde main; no desconectar servicios sin plan de reversión.
- Cada origen expone /herencia-deploy.json y la API expone /api/runtime-version: verificar los SHA completos y GitHub esperado.
- Script scripts/checkDeploymentParity.mjs devuelve 1 si hay drift o falta acceso; nunca reintenta desplegar, no toca datos y guarda JSON diagnóstico.
- Tras cambios revisar el estado real de GitHub Actions, ambos servicios Railway y la versión del alias producción Vercel.

## Failover automático: pendiente de autorización
1. Antes de tocar DNS, inspeccionar A/AAAA/CNAME y proveedor DNS; confirmar que el certificado cubre www y apex.
2. Probar acceso al frontend Vercel DIRECTO y a Railway DIRECTO, autenticación, admin, catálogo, precios, Stripe test-mode, archivos, sesiones y cache.
3. Monitorizar /herencia-deploy.json con contenido esperado; no usar solo HTTP 200 / porque SPA puede responder index.html.
4. Cloudflare Load Balancing es un complemento de pago, requiere consultar precio actual, cuenta Cloudflare y autorización explícita.
5. Solo tras aprobación: dos pools activo/pasivo, Vercel primario, Railway secundario, health checks desde varias regiones y umbrales consecutivos para evitar cambios por un fallo transitorio.
6. Simular caída únicamente en dominio de ensayo, probar recuperación, cookies, redirecciones y evitar failover hacia una versión incompatible.
7. Rollback verificado antes de cambiar www; NO efectuar caída real de producción.

## Backend y pagos
- El backend Railway sigue siendo punto único de fallo; duplicar el frontend no lo resuelve.
- Auditar unicidad de eventos de Stripe, idempotencia, reservas transaccionales y tareas programadas antes de cualquier backend activo/pasivo.
- NO crear un segundo receptor de webhooks activo ni ejecutar cargos de producción.
- No migrar, borrar, reiniciar ni duplicar bases de datos.
