import pg from "pg";

const { Pool } = pg;

const connectionString = String(process.env.DATABASE_URL || "").trim();

export const neonPool = connectionString
  ? new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  : null;

export function hasNeon() {
  return Boolean(neonPool);
}

export async function neonReady() {
  if (!neonPool) return false;
  const result = await neonPool.query("select 1 as ok");
  return result.rows?.[0]?.ok === 1;
}

export async function readNeonStorageValue(key) {
  if (!neonPool) return null;
  const result = await neonPool.query(
    "select value from app_storage where key = $1 limit 1",
    [String(key)]
  );
  return result.rows?.[0]?.value ?? null;
}

export async function readNeonStorageValues(keys = []) {
  if (!neonPool || !keys.length) return [];
  const result = await neonPool.query(
    "select key, value from app_storage where key = any($1::text[])",
    [keys.map(String)]
  );
  return result.rows || [];
}

export async function upsertNeonStorageValue(key, value) {
  if (!neonPool) throw new Error("Neon no está configurado");
  await neonPool.query(
    `insert into app_storage (key, value, created_at, updated_at)
     values ($1, $2, now(), now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [String(key), value == null ? "" : String(value)]
  );
}

export async function deleteNeonStorageValue(key) {
  if (!neonPool) throw new Error("Neon no está configurado");
  await neonPool.query("delete from app_storage where key = $1", [String(key)]);
}

export async function listNeonOrders({ email = null, limit = 500 } = {}) {
  if (!neonPool) return [];
  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 2000));
  if (email) {
    const result = await neonPool.query(
      `select * from orders where lower(customer_email) = lower($1)
       order by created_at desc limit $2`,
      [String(email), safeLimit]
    );
    return result.rows || [];
  }
  const result = await neonPool.query(
    "select * from orders order by created_at desc limit $1",
    [safeLimit]
  );
  return result.rows || [];
}

export async function patchNeonOrder(id, patch = {}) {
  if (!neonPool) throw new Error("Neon no está configurado");
  const allowed = new Set([
    "customer_email", "customer_name", "payment_method", "delivery_method",
    "status", "subtotal", "shipping", "total", "items", "metadata",
    "stripe_payment_intent_id", "tracking_estado", "tracking_tiempo",
    "factura_url", "entrega_estimada"
  ]);
  const entries = Object.entries(patch).filter(([key]) => allowed.has(key));
  if (!entries.length) return null;
  const values = entries.map(([, value]) => value);
  const assignments = entries.map(([key], index) => `${key} = $${index + 1}`);
  values.push(String(id));
  const result = await neonPool.query(
    `update orders set ${assignments.join(", ")}, updated_at = now()
     where id::text = $${values.length} returning *`,
    values
  );
  return result.rows?.[0] || null;
}

export async function closeNeon() {
  if (neonPool) await neonPool.end();
}
