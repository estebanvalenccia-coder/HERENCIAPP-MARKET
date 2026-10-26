# Administración multiusuario y dispositivos de confianza

Estado: diseño pendiente de implementación y pruebas. **No desplegar.**

## Objetivo
- Crear cuenta administrativa `christian`, rol `admin`, sin dirección de correo hasta que el propietario la facilite y sin credenciales publicadas.
- Permitir omitir OTP durante un plazo máximo de 30 días **solo en dispositivos autorizados tras superar OTP previamente**. Estar conectado al Wi-Fi doméstico no es prueba suficiente.
- Seguir exigiendo contraseña en cada nuevo inicio de sesión y OTP en equipos nuevos, desconocidos, revocados o ante riesgo elevado.

## Inspección de la implementación actual
- `backend/server.js` obtiene `ADMIN_USERNAME`, `ADMIN_PASSWORD` y `ADMIN_TOTP_SECRET` del entorno. El endpoint `POST /api/admin/login` compara un único usuario/contraseña y siempre comprueba el mismo TOTP.
- `GET /api/admin/auth-config` expone únicamente `totpRequired`.
- `src/app/pages/AdminDashboard.tsx` muestra el campo OTP cuando `totpRequired` es verdadero.
- No se debe desactivar `ADMIN_TOTP_SECRET` en Railway: se eliminaría el segundo factor de todos los accesos.

## Implementación requerida antes del despliegue
1. Migración de base de datos: tabla de administradores con identificador estable, nombre único, hash de contraseña con algoritmo robusto, rol, estado y campos de auditoría. Convertir cuenta antigua en cuenta principal sin exponer el secreto actual. Evitar que la última cuenta principal se borre.
2. Invitación individual para `christian` en estado pendiente, rol `admin`, sin contraseña prefijada. Debe completar un alta segura con contraseña nueva y enrolamiento OTP; cuando exista correo, habilitar invitación por email.
3. Tabla de dispositivos de confianza: propietario, hash de token aleatorio (no token en claro), creación, expiración <= 30 días, fecha de último uso y revocación. Guardar token en cookie Secure, HttpOnly, SameSite=Lax, con validación contra servidor.
4. En `POST /api/admin/login`, verificar primero usuario y contraseña. Solicitar OTP si no existe un token confiable, válido, perteneciente a ese mismo usuario y dispositivo. Al verificar OTP, ofrecer marcar este dispositivo como confiable explícitamente. Nunca confiar exclusivamente en SSID, IP local, cabecera X-Forwarded-For o localStorage.
5. En `/api/admin/auth-config`, reflejar únicamente si este navegador precisa OTP para el usuario identificado **sin divulgar existencia de cuentas**; idealmente el servidor decide tras verificar contraseña y responde a un desafío breve. Evitar un `totpRequired:false` global.
6. En Administración > Usuarios: alta/invitación, modificación de rol, suspensión y revocación de sesiones/dispositivos. Registrar auditoría; restringir gestión de administradores al propietario.
7. Protección CSRF apropiada para cookies y operaciones sensibles, límites de intentos por cuenta/IP, mensajes neutrales de error y reautenticación para cambios de rol y contraseñas.
8. Pruebas: login válido e inválido; OTP obligatorio en equipo nuevo; token caducado/revocado; token de otro usuario; cierre de sesión y revocación; cambios de IP/Wi-Fi; no exposición de contraseñas/tokens; Christian sin invitación activada no puede entrar; no regresión del administrador actual.
9. Antes de desplegar: ejecutar tests automatizados del backend y frontend, validar migración sobre copia de pruebas, revisar compatibilidad con cookies detrás de Railway/Vercel y probar acceso normal y restauración del propietario.

## No realizado
No se ha creado ninguna cuenta activa, contraseña, tabla o cookie; tampoco se ha desactivado OTP. Este documento únicamente registra el diseño y las condiciones de seguridad para implementar.
