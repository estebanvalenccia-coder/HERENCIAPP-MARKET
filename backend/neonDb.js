import pg from "pg";
import crypto from "node:crypto";

const { Pool } = pg;
const connectionString = String(process.env.DATABASE_URL || "").trim();

export const neonPool = connectionString ? new Pool({
  connectionString,
  ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
  max: 8,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
}) : null;

export function hasNeon(){ return Boolean(neonPool); }
export async function ensureNeonSchema(){
  if(!neonPool) throw new Error("Neon no está configurado");
  await neonPool.query(`
    create table if not exists app_storage (key text primary key,value text not null default '',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
    create index if not exists app_storage_updated_at_idx on app_storage(updated_at desc);
    create table if not exists orders (id text primary key,customer_email text,customer_name text,payment_method text not null default 'manual',delivery_method text not null default 'envio',status text not null default 'pending',subtotal numeric not null default 0,shipping numeric not null default 0,total numeric not null default 0,items jsonb not null default '[]'::jsonb,metadata jsonb not null default '{}'::jsonb,stripe_payment_intent_id text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
    create index if not exists orders_created_at_idx on orders(created_at desc);
    create index if not exists orders_status_idx on orders(status);
    create index if not exists orders_customer_email_idx on orders(customer_email);
  `); return true;
}
export async function neonReady(){ if(!neonPool)return false; const r=await neonPool.query("select 1 as ok"); return r.rows?.[0]?.ok===1; }
export async function readNeonStorageValue(key){ if(!neonPool)return null; const r=await neonPool.query("select value from app_storage where key=$1 limit 1",[String(key)]); return r.rows?.[0]?.value??null; }
export async function readNeonStorageValues(keys=[]){ if(!neonPool||!keys.length)return[]; const r=await neonPool.query("select key,value from app_storage where key=any($1::text[])",[keys.map(String)]); return r.rows||[]; }
export async function listAllNeonStorage(){ if(!neonPool)return[]; const r=await neonPool.query("select key,value,updated_at from app_storage order by key"); return r.rows||[]; }
export async function upsertNeonStorageValue(key,value){ if(!neonPool)throw new Error("Neon no está configurado"); await neonPool.query(`insert into app_storage(key,value,created_at,updated_at) values($1,$2,now(),now()) on conflict(key) do update set value=excluded.value,updated_at=now()`,[String(key),value==null?"":String(value)]); }
export async function deleteNeonStorageValue(key){ if(!neonPool)throw new Error("Neon no está configurado"); await neonPool.query("delete from app_storage where key=$1",[String(key)]); }
export async function listNeonOrders({email=null,limit=500}={}){ if(!neonPool)return[]; const safe=Math.max(1,Math.min(Number(limit)||500,2000)); if(email){const r=await neonPool.query(`select * from orders where lower(customer_email)=lower($1) order by created_at desc limit $2`,[String(email),safe]);return r.rows||[];} const r=await neonPool.query("select * from orders order by created_at desc limit $1",[safe]); return r.rows||[]; }
export async function createNeonOrder(order={}){ if(!neonPool)throw new Error("Neon no está configurado"); const id=String(order.id||crypto.randomUUID()); const r=await neonPool.query(`insert into orders(id,customer_email,customer_name,payment_method,delivery_method,status,subtotal,shipping,total,items,metadata,stripe_payment_intent_id,created_at,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,coalesce($13::timestamptz,now()),now()) on conflict(id) do update set customer_email=excluded.customer_email,customer_name=excluded.customer_name,payment_method=excluded.payment_method,delivery_method=excluded.delivery_method,status=excluded.status,subtotal=excluded.subtotal,shipping=excluded.shipping,total=excluded.total,items=excluded.items,metadata=excluded.metadata,stripe_payment_intent_id=excluded.stripe_payment_intent_id,updated_at=now() returning *`,[id,order.customer_email||order.customerEmail||order.email||null,order.customer_name||order.customerName||order.name||null,order.payment_method||order.paymentMethod||"manual",order.delivery_method||order.deliveryMethod||"envio",order.status||"pending",Number(order.subtotal||0),Number(order.shipping||0),Number(order.total||0),JSON.stringify(Array.isArray(order.items)?order.items:[]),JSON.stringify(order.metadata||{}),order.stripe_payment_intent_id||order.stripePaymentIntentId||null,order.created_at||order.date||null]); return r.rows?.[0]||null; }
export async function patchNeonOrder(id,patch={}){ if(!neonPool)throw new Error("Neon no está configurado"); const allowed=new Set(["customer_email","customer_name","payment_method","delivery_method","status","subtotal","shipping","total","items","metadata","stripe_payment_intent_id"]); const entries=Object.entries(patch).filter(([k])=>allowed.has(k)); if(!entries.length)return null; const values=[]; const assignments=[]; for(const [key,value] of entries){values.push(["items","metadata"].includes(key)?JSON.stringify(value):value);assignments.push(`${key} = $${values.length}${["items","metadata"].includes(key)?"::jsonb":""}`);} values.push(String(id)); const r=await neonPool.query(`update orders set ${assignments.join(", ")},updated_at=now() where id::text=$${values.length} returning *`,values); return r.rows?.[0]||null; }
export async function closeNeon(){ if(neonPool)await neonPool.end(); }
