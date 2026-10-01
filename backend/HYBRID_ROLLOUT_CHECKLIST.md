# Rollout checklist

- [x] Neon schema created and tested.
- [x] `DATABASE_URL` added to Railway by the administrator.
- [x] Hybrid gateway added: Neon handles storage/settings, legacy backend remains available.
- [x] Stripe variables and webhook configuration remain untouched.
- [x] Supabase variables remain untouched for compatibility.
- [x] R2 adapter prepared without requiring credentials at startup.
- [ ] Add R2 credentials to Railway.
- [ ] Enable R2 media routes after credentials are verified.
- [ ] Migrate remaining order/customer SQL paths to Neon after production storage validation.
