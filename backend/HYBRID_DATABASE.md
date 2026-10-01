# Herencia hybrid database rollout

## Runtime
- Neon (`DATABASE_URL`) is the primary store for `/api/storage*` and `/api/settings/public` through `backend/neonGateway.js`.
- The existing backend remains available internally and keeps Stripe, Supabase compatibility, auth, orders and the remaining routes working while they are migrated incrementally.
- Supabase credentials are intentionally preserved; this rollout does not disable or delete Supabase.
- Cloudflare R2 is the planned media store. Until R2 variables are configured, media routes continue through the legacy backend/Supabase Storage.

## Required environment
- `DATABASE_URL` — Neon pooled PostgreSQL connection string.
- Existing Stripe/Supabase/Resend variables remain unchanged.

## Safety
The gateway listens on Railway's public `PORT`; the legacy Express server is spawned on `LEGACY_BACKEND_PORT` (default 3002) and is only proxied internally.
