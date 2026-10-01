import crypto from "node:crypto";

export const hasR2 = Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME && process.env.R2_PUBLIC_URL);

export function r2ConfigStatus() {
  return {
    configured: hasR2,
    account: Boolean(process.env.R2_ACCOUNT_ID),
    accessKey: Boolean(process.env.R2_ACCESS_KEY_ID),
    secretKey: Boolean(process.env.R2_SECRET_ACCESS_KEY),
    bucket: Boolean(process.env.R2_BUCKET_NAME),
    publicUrl: Boolean(process.env.R2_PUBLIC_URL),
  };
}

export function createMediaObjectName(filename = "imagen", extension = "jpg") {
  const base = String(filename).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").replace(/\.[^.]+$/, "").slice(0, 80) || "imagen";
  return `builder/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${base}.${extension}`;
}

// Upload/list/delete are enabled only after R2 credentials are present in Railway.
// Keeping this adapter isolated prevents media configuration from affecting Stripe,
// Neon, Supabase compatibility, or the public storefront during the rollout.
