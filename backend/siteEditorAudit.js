import { neonPool } from "./neonDb.js";
import { randomUUID } from "node:crypto";

let schemaPromise;
export async function ensureSiteEditorAuditTables() {
  if (!neonPool) throw new Error("Neon no está configurado");
  if (!schemaPromise) schemaPromise = (async () => {
    await neonPool.query(`create table if not exists herencia_site_publication_audit (
      id uuid primary key, changed_at timestamptz not null default now(),
      actor text not null, action text not null,
      previous_revision text, next_revision text, subject text
    )`);
    await neonPool.query(`create table if not exists herencia_site_editor_restrictions (
      username text primary key, can_publish boolean not null default true,
      can_restore boolean not null default true, can_view_audit boolean not null default true,
      changed_at timestamptz not null default now(), changed_by text
    )`);
  })().catch((error) => { schemaPromise = undefined; throw error; });
  return schemaPromise;
}

export async function getSiteRestrictions(username) {
  await ensureSiteEditorAuditTables();
  const res = await neonPool.query(
    "select can_publish, can_restore, can_view_audit from herencia_site_editor_restrictions where username=$1",
    [String(username || "").trim().toLowerCase()]
  );
  const row = res.rows[0];
  return {
    canPublish: row?.can_publish !== false,
    canRestore: row?.can_restore !== false,
    canViewAudit: row?.can_view_audit !== false,
  };
}

export async function listSiteRestrictions() {
  await ensureSiteEditorAuditTables();
  const result = await neonPool.query(
    "select username, can_publish, can_restore, can_view_audit, changed_at, changed_by from herencia_site_editor_restrictions order by username asc limit 100"
  );
  return result.rows.map((row) => ({
    username: row.username,
    canPublish: row.can_publish,
    canRestore: row.can_restore,
    canViewAudit: row.can_view_audit,
    changedAt: row.changed_at,
    changedBy: row.changed_by,
  }));
}

export function validSiteUsername(username) {
  return /^[a-z][a-z0-9._-]{2,31}$/.test(String(username || "").trim().toLowerCase());
}

export async function updateSiteRestrictions({username, actor, restrictions}) {
  const name = String(username || "").trim().toLowerCase();
  if (!validSiteUsername(name)) throw Object.assign(new Error("Nombre de administrador no válido"), {statusCode:400});
  if (!restrictions || typeof restrictions !== "object" || Array.isArray(restrictions)) {
    throw Object.assign(new Error("Permisos no válidos"), {statusCode:400});
  }
  if (Object.entries(restrictions).some(([key, value]) => !["canPublish","canRestore","canViewAudit"].includes(key) || typeof value !== "boolean")) {
    throw Object.assign(new Error("Solo se permiten denegaciones de permisos definidos"), {statusCode:400});
  }
  await ensureSiteEditorAuditTables();
  const effective = {canPublish:restrictions.canPublish !== false,canRestore:restrictions.canRestore !== false,canViewAudit:restrictions.canViewAudit !== false};
  const client = await neonPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`insert into herencia_site_editor_restrictions
      (username,can_publish,can_restore,can_view_audit,changed_at,changed_by)
      values ($1,$2,$3,$4,now(),$5)
      on conflict (username) do update set can_publish=excluded.can_publish,
        can_restore=excluded.can_restore,can_view_audit=excluded.can_view_audit,
        changed_at=now(),changed_by=excluded.changed_by`,
      [name,effective.canPublish,effective.canRestore,effective.canViewAudit,String(actor).slice(0,80)]);
    await client.query(`insert into herencia_site_publication_audit
      (id, actor, action, subject) values ($1,$2,'permissions',$3)`,
      [randomUUID(),String(actor).slice(0,80),name]);
    await client.query("COMMIT");
    return {username:name,...effective};
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function recordSitePublicationAudit(client,{actor,action,previousRevision,nextRevision}) {
  await client.query(`insert into herencia_site_publication_audit
    (id,actor,action,previous_revision,next_revision)
    values ($1,$2,$3,$4,$5)`,
    [randomUUID(),String(actor).slice(0,80),action==="restore"?"restore":"publish",previousRevision,nextRevision]);
}

export async function listSitePublicationAudit(limit = 35) {
  await ensureSiteEditorAuditTables();
  const safeLimit = Math.max(1,Math.min(100,Math.floor(Number(limit)||35)));
  const result = await neonPool.query(`select id, changed_at, actor, action, previous_revision, next_revision, subject
    from herencia_site_publication_audit order by changed_at desc limit $1`,[safeLimit]);
  return result.rows.map((row) => ({
    id:row.id,at:row.changed_at,actor:row.actor,action:row.action,
    previousRevision:row.previous_revision,nextRevision:row.next_revision,subject:row.subject,
  }));
}
