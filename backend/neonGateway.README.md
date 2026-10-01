# Zero-toggle hybrid behavior

The production process runs a public gateway and the existing Express backend together.

1. `/api/storage*` and `/api/settings/public` use Neon directly.
2. All other routes are transparently proxied to the existing backend.
3. Supabase stays configured and can continue serving legacy features; there is no manual on/off switch.
4. Stripe stays in the existing backend, with the same environment variables and webhook endpoint.
5. R2 is optional until its Railway credentials are configured.

This is intentionally incremental: the storefront can move its highest-frequency state traffic away from Supabase without rewriting the whole application in one deployment.
