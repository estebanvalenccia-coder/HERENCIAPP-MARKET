# Backend de producción — Herencia Market

## Topología actual

El navegador utiliza rutas `/api/*` del mismo origen. Vercel las reenvía al backend de Railway. No es necesario que el frontend conozca secretos ni claves privadas.

Railway ejecuta el gateway híbrido de Herencia:
- Neon es la base de datos principal.
- Stripe gestiona los pagos.
- Cloudflare R2 almacena imágenes y archivos.
- Resend envía emails transaccionales.
- Google Maps calcula distancia y precio de reparto.
- Groq y Gemini alimentan HERENCIA SALES y funciones de IA.
- Supabase se conserva únicamente para compatibilidad de rutas legacy durante la migración.

## Variables privadas de Railway

Como mínimo:

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
ADMIN_USERNAME=
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
ADMIN_TOTP_SECRET=

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PUBLISHABLE_KEY=

RESEND_API_KEY=
EMAIL_FROM=
STORE_EMAIL=

GOOGLE_MAPS_API_KEY=
STORE_ADDRESS=
SHIPPING_BASE_PRICE=5
SHIPPING_STEP_KM=3
SHIPPING_STEP_PRICE=3

GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b
GEMINI_API_KEY=
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-2.5-flash-image

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

Las variables `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `RESEND_API_KEY` y credenciales R2 **nunca** deben publicarse como variables `VITE_*`.

## Stripe

El webhook de producción debe apuntar a:

```text
https://herenciapp-market-production.up.railway.app/api/stripe/webhook
```

Como mínimo debe procesar `payment_intent.succeeded`. El backend valida precio, cupón, stock, dirección y coste de reparto antes de crear el PaymentIntent.

## Reparto

Herencia Market funciona únicamente con **entrega a domicilio**. `STORE_ADDRESS` es el origen privado usado para calcular rutas; no representa un establecimiento abierto al público y no debe mostrarse en la web.

El precio del reparto se vuelve a calcular en servidor. El navegador no es la fuente autoritativa del coste.

## Inventario

Commerce/Neon es la fuente autoritativa del catálogo y stock vendible. El TPV, checkout, HERENCIA SALES y herramientas de inventario deben leer esa fuente. Las ubicaciones internas sirven para distribuir existencias entre almacén, preparación o vehículo.

## Diagnóstico previo a ventas

Desde Administración → Diagnóstico comprueba:
- Railway/API y Neon.
- sesión admin.
- catálogo vendible.
- Stripe + webhook.
- datos fiscales TPV.
- R2 con lectura/escritura.
- Resend.
- Google Maps.
- HERENCIA SALES / IA.
- pedidos.

Los smoke tests de email y Maps no crean pedidos ni realizan cargos.
