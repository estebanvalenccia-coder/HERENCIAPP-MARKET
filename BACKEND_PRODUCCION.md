# Backend real para Herencia Market

Este paquete elimina el uso de almacenamiento crítico en el navegador y mueve carrito, pedidos, configuración admin, claves de IA y pagos a un backend Express conectado a Supabase.

## Qué se cambió

- Se añadió `backend/server.js` como API real.
- Se añadió `src/app/lib/backendStorage.ts` para que el frontend lea y guarde contra backend.
- Se añadió `supabase/migrations/001_backend_real.sql` con tablas para configuración, pedidos y productos admin.
- Stripe usa `STRIPE_SECRET_KEY` solo en backend.
- La IA usa la clave guardada en backend y ya no llama a OpenAI/Groq directamente desde el navegador.
- Los pedidos manuales, Bizum y Stripe se guardan en base de datos.
- El panel admin lee los pedidos desde backend.

## Variables necesarias

Copia `.env.example` a `.env` y rellena los valores reales.

```env
VITE_API_URL=https://herenciapp-market-production.up.railway.app
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
STRIPE_SECRET_KEY=sk_live_o_sk_test
STRIPE_WEBHOOK_SECRET=whsec_tu_webhook
CORS_ORIGIN=https://www.herenciamarket.es,https://herenciamarket.es
PORT=3001
```

La `SUPABASE_SERVICE_ROLE_KEY` y `STRIPE_SECRET_KEY` nunca deben ponerse en Vercel como variables públicas del frontend. Deben estar solo en el servicio backend.

## Supabase

Ejecuta el SQL de `supabase/migrations/001_backend_real.sql` en el SQL editor de Supabase.

## Desarrollo

```bash
npm install
npm run dev:backend
npm run dev
```

También puedes arrancar todo junto con:

```bash
npm run dev:full
```

## Producción

El frontend puede ir en Vercel, Netlify o similar.

El backend debe ir en Render, Railway, Fly.io, VPS o cualquier servicio Node que permita variables privadas.

Después de desplegar el backend, pon en el frontend:

```env
VITE_API_URL=https://herenciapp-market-production.up.railway.app
```

## Stripe real

Configura en Stripe un webhook hacia:

```txt
https://herenciapp-market-production.up.railway.app/api/stripe/webhook
```

Evento necesario:

```txt
payment_intent.succeeded
```

