import crypto from "node:crypto";
import { neonPool } from "./neonDb.js";
import {
  normalizeAdminUsername, createPendingAdmin, activateAdminAccount,
  hashAdminPassword, verifyAdminPassword, changeAdminPassword, sanitizeAdminAccount,
} from "./adminAccounts.js";

let setupPromise = null;

export async function initializeAdminAccounts() {
  if (!neonPool) throw new Error("Se necesita la base de datos Neon para gestionar administradores");
  if (!setupPromise) {
    setupPromise = (async () => {
      await neonPool.query(`create table if not exists herencia_admin_accounts (
        id uuid primary key,
        username text not null unique,
        email text,
        role text not null check (role in ('admin','employee')),
        state text not null check (state in ('pending','active','disabled')),
        password_hash text,
        must_change_password boolean not null default true,
        session_version integer not null default 0,
        created_at timestamptz not null default now(),
        password_changed_at timestamptz
      )`);
    })().catch((error) => { setupPromise = null; throw error; });
  }
  await setupPromise;
}

function asAccount(row) {
  if (!row) return null;
  return {
    id: row.id, username: row.username, role: row.role, email: row.email,
    state: row.state, passwordHash: row.password_hash,
    mustChangePassword: row.must_change_password,
    sessionVersion: row.session_version,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    passwordChangedAt: row.password_changed_at instanceof Date ? row.password_changed_at.toISOString() : row.password_changed_at,
  };
}
export async function findAdminByUsername(username) {
  await initializeAdminAccounts();
  const normalized = normalizeAdminUsername(username);
  const result = await neonPool.query("select * from herencia_admin_accounts where username=$1", [normalized]);
  return asAccount(result.rows[0]);
}
export async function findAdminById(id) {
  await initializeAdminAccounts();
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) return null;
  const result = await neonPool.query("select * from herencia_admin_accounts where id=$1", [String(id)]);
  return asAccount(result.rows[0]);
}
export async function listAdminAccounts() {
  await initializeAdminAccounts();
  const result = await neonPool.query("select * from herencia_admin_accounts order by created_at asc");
  return result.rows.map((row) => ({ ...sanitizeAdminAccount(asAccount(row)), mustChangePassword: row.must_change_password }));
}
/** Password supplied by an authenticated administrator; never put plain text in the database. */
export async function createAdminWithPassword({ username, password, role = "admin", email = null }) {
  await initializeAdminAccounts();
  if (!["admin", "employee"].includes(role)) throw new Error("Rol no permitido");
  const pending = createPendingAdmin(username, role, email);
  const activated = activateAdminAccount(pending, password, { temporary: true });
  const result = await neonPool.query(`insert into herencia_admin_accounts
    (id,username,email,role,state,password_hash,must_change_password,session_version)
    values($1,$2,$3,$4,$5,$6,true,1)
    on conflict(username) do nothing returning *`,
    [activated.id, activated.username, activated.email, activated.role, activated.state, activated.passwordHash]);
  if (!result.rows.length) throw new Error("Ya existe un administrador con ese nombre");
  return sanitizeAdminAccount(asAccount(result.rows[0]));
}
/** One-off rollout seed. Requires a separately supplied environment secret, not source-code credentials. */
export async function bootstrapChristianFromEnvironment() {
  const initialPassword = String(process.env.ADMIN_CHRISTIAN_INITIAL_PASSWORD || "");
  if (!initialPassword) return { seeded: false, reason: "not_configured" };
  await initializeAdminAccounts();
  if (await findAdminByUsername("christian")) return { seeded: false, reason: "already_exists" };
  try {
    await createAdminWithPassword({ username: "christian", password: initialPassword, role: "admin" });
    return { seeded: true };
  } catch (error) {
    if (String(error.message || "").includes("Ya existe")) return { seeded: false, reason: "already_exists" };
    throw error;
  }
}
export async function updateAdminPassword(accountId, currentPassword, nextPassword) {
  await initializeAdminAccounts();
  const client = await neonPool.connect();
  try {
    await client.query("begin");
    const record = await client.query("select * from herencia_admin_accounts where id=$1 for update", [accountId]);
    const account = asAccount(record.rows[0]);
    if (!account || account.state !== "active") throw new Error("Cuenta no disponible");
    const changed = changeAdminPassword(account, currentPassword, nextPassword);
    await client.query(`update herencia_admin_accounts
      set password_hash=$2, password_changed_at=now(), must_change_password=false, session_version=$3
      where id=$1`, [accountId, changed.passwordHash, changed.sessionVersion]);
    await client.query("commit");
    return { ...sanitizeAdminAccount(changed), mustChangePassword: false, sessionVersion: changed.sessionVersion };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
