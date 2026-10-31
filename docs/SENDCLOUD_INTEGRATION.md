# Tropical Plants: Sendcloud staging setup

Status: **feature branch only**, not active in public checkout. No labels or paid bookings created.

## Account setup
1. From Sendcloud Settings → Integrations → Sendcloud API create integration named Tropical Plants.
2. Disable webhook callbacks until an authenticated webhook endpoint is implemented and deployed; do **not** insert a fictitious URL.
3. Enable service-point delivery and selected carriers in Sendcloud.
4. Copy generated Public and Secret keys into Railway backend **HERENCIAPP-MARKET** (production environment): `SENDCLOUD_PUBLIC_KEY` and `SENDCLOUD_SECRET_KEY`. Never store them in `VITE_*`, a public field, or a GitHub commit.
5. Configure real sender address and activated carriers in Sendcloud. A payment method is required before **creating** labels. No label generation has been implemented.
6. Once the feature branch passes CI and is deployed to a staging backend with credentials available, open Admin → Envíos / Recogida → Sendcloud and use «Probar API», «Ver transportistas», «Ver puntos de recogida».

## Staging read-only endpoints (admin login required)
- `GET /api/admin/shipping/sendcloud/status`: key presence only; no secret values.
- `POST /api/admin/shipping/sendcloud/test`: credential test by retrieving configured v2 shipping methods.
- `POST /api/admin/shipping/sendcloud/methods`: lists shipping methods, **not** a guaranteed price for a specific shipment.
- `POST /api/admin/shipping/sendcloud/points`: uses v3 Service Points API based on destination postal code, configured integration carriers.

No customers see these methods until a separate production-ready checkout integration is developed.
Sendcloud's legacy v2 pricing API does not support all carriers whose prices depend on postal zones in Spain. Never show generic prices as confirmed checkout quotes; use the v3 shipping options and quotes system for later implementation.

## Special restrictions
Sendcloud excludes plants and flora (all types) from claims for loss or damage, while actual acceptance depends on each carrier's terms. Do not offer Sendcloud for live plants without prior written confirmation of acceptance and eligibility, including packaging requirements.

## Before launch
- Confirm real account credentials and enabled carriers; inspect 401/403 or empty services.
- Validate the exact shipping option quote with postcode, weights, dimensions and goods eligibility on the server.
- Customer chooses carrier/service-point; re-validate availability and price at payment creation; persist a server-issued quote ID/expiry, not client-side price.
- Create shipment after paid Stripe order via idempotent background job (never auto-charge carrier without explicit authorization); save label and tracking safely, enable webhook HMAC/signature checks and replay protection.
- Test failure modes, disabled services, mixed carts, supplier fulfillment and refunds.
- Merge and deploy only after CI and payment regression checks.

References:
- https://support.sendcloud.com/hc/es/articles/360024967012
- https://sendcloud.dev/docs/service-points/find-service-points-with-the-api
- https://www.sendcloud.com/es/api/
- https://support.sendcloud.com/hc/en-us/articles/22998589646225-What-goods-are-excluded-from-my-claims
