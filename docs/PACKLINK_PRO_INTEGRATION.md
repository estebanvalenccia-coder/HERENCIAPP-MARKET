# Tropical Plants — Packlink PRO and customer-selected delivery

**Status (2026-10-31):** safe integration scaffold; local Horta pickup implemented on feature branch. Packlink PRO carrier rates, parcel-shop search, shipment labels, and tracking are **NOT active**. Never advertise €3 shipping until a live eligible service is quoted.

## Current installation

- Frontend: React/Vite Vercel, `src/app/pages/Checkout.tsx`.
- Backend: Railway Node, `backend/server.js` behind `/api/*`.
- Database/orders: Neon; payments: Stripe.
- Existing shipping: Maps/distance shipping policy. Preserve it when new services are off.
- Admin: `Envíos / Recogida` under `AdminDashboard`. Existing `shippingSettings` is extended, not overwritten.
- Local pickup: OFF by default, price €0; for merchant-fulfilled physical items only. The owner agrees a meeting place and time later. The customer does not see the owner's home address. The backend checks the selection against the current catalog before pricing Stripe payments or manual orders.

## Packlink PRO onboarding checklist

1. Create and verify Packlink PRO account.
2. Configure **sender address** and real default parcel dimensions inside Packlink PRO.
3. Generate key: Configuración → Packlink PRO clave de API.
4. Store key **only** as encrypted Railway service variable `PACKLINK_API_KEY`. Do not paste into `VITE_*` frontend variables, GitHub, order metadata or the chat.
5. Contact Packlink PRO support to confirm API access for a **custom React/Node ecommerce** (not just supported Shopify/WooCommerce modules), quote endpoint, authentication, accessible prices, parcel-shop selection endpoint, label creation, webhook/tracking, and account permissions.
6. Establish eligible products and confirmed transit services; live plants may be prohibited and must be filtered. Start with 3D merchant-fulfilled parcels.
7. In staging, implement a server-side adapter using provider-confirmed documentation. The frontend calls only our same-origin backend.
8. Before checkout, send basket SKUs/quantities and destination; backend retrieves authoritative dimensions and weights, quotes eligible services and returns short-lived quote IDs/expiry, authenticated provider point IDs, taxes and consumer-visible totals.
9. Reserve/validate the selected quote server-side when preparing the Stripe payment. If price expires or parcel is ineligible, block and request new selection; never trust client-sent price.
10. On Stripe webhook paid, enqueue an idempotent draft/label operation. Depending on provider commercial flow, paying a label may be manual or separately authorized; do not automatically charge Packlink until approved. Persist tracking and label link in Neon, notify buyer; handle refunds, retries and duplicates.
11. Smoke tests in staging: no provider key, provider timeout, wrong zip, unknown locker, supplier/plant, coupon, mixed cart, free pickup, Stripe retry, webhooks replay, and existing legacy checkout. Release behind toggle and observe.

## Source/caveat

Packlink documents API key generation for its integrations: https://support-pro.packlink.com/hc/es-es/articles/213431749--C%C3%B3mo-puedo-generar-una-Clave-API-en-Packlink-PRO

Its official WooCommerce/PrestaShop integrations import orders as drafts and let merchants pay shipments in Packlink PRO. Do NOT assume every API operation is granted to an arbitrary custom storefront without provider confirmation.

## Rollback

Disable local pickup from Envíos / Recogida. No change to existing home delivery pricing when pickup OFF. This branch can be reverted independently and must not be merged until checkout/Stripe regression tests pass.
