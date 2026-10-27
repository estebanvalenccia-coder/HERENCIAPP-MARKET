import { createHash, randomUUID } from "node:crypto";
import { neonPool } from "./neonDb.js";
import { validateSitePublication } from "./sitePublicationValidation.mjs";
import { ensureSiteEditorAuditTables, recordSitePublicationAudit } from "./siteEditorAudit.js";

export class SitePublicationConflict extends Error {
  constructor() {
    super("El contenido publicado ha cambiado desde que abriste el editor. Actualiza y revisa los cambios antes de volver a publicar.");
    this.name = "SitePublicationConflict";
    this.statusCode = 409;
    this.code = "SITE_CONTENT_CONFLICT";
  }
}

export function contentRevision(raw) {
  return createHash("sha256").update(typeof raw === "string" ? raw : "").digest("hex");
}

const auxiliaryAllowed = new Set(["heroBanner", "ctaBanner", "menuIcons", "herenciaSettings"]);
const maxContentBytes = 3_500_000;
const maxHistoryBytes = 5_000_000;

export function planSiteContentPublication({
  before,
  expectedRaw,
  nextRaw,
  historyRaw,
  actor = "administrador",
  auxiliary = {},
  now = new Date(),
}) {
  if (typeof nextRaw !== "string" || Buffer.byteLength(nextRaw, "utf8") > maxContentBytes) {
    throw Object.assign(new Error("El contenido de la tienda supera el tamaño permitido o está vacío."), { statusCode: 413 });
  }
  if (expectedRaw !== null && typeof expectedRaw !== "string") {
    throw Object.assign(new Error("La versión anterior debe ser texto o null."), { statusCode: 400 });
  }
  const previous = before === undefined || before === null ? null : String(before);
  if (previous !== expectedRaw) throw new SitePublicationConflict();

  let document;
  try { document = JSON.parse(nextRaw); }
  catch { throw Object.assign(new Error("El contenido de la tienda no contiene JSON válido."), { statusCode: 400 }); }
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw Object.assign(new Error("El contenido debe ser un objeto."), { statusCode: 400 });
  }
  const errors = validateSitePublication(document);
  if (errors.length) {
    throw Object.assign(new Error(`No se puede publicar: ${errors.slice(0, 4).join("; ")}`), { statusCode: 422 });
  }
  if (!auxiliary || typeof auxiliary !== "object" || Array.isArray(auxiliary)) {
    throw Object.assign(new Error("Configuración adicional no válida."), { statusCode: 400 });
  }
  const settings = {};
  for (const [key, value] of Object.entries(auxiliary)) {
    if (!auxiliaryAllowed.has(key) || typeof value !== "string" || Buffer.byteLength(value, "utf8") > 1_000_000) {
      throw Object.assign(new Error(`Configuración adicional no válida: ${key}`), { statusCode: 400 });
    }
    settings[key] = value;
  }
  let past;
  try { past = historyRaw ? JSON.parse(historyRaw) : []; } catch { past = []; }
  if (!Array.isArray(past)) past = [];
  const versions = previous === null ? past.slice(0, 12) : [{
    id: `version-${randomUUID()}`,
    at: now.toISOString(),
    label: `Antes de publicar · ${now.toLocaleString("es-ES", { timeZone: "Europe/Madrid" })} · ${String(actor).slice(0, 80)}`,
    content: previous,
  }, ...past].slice(0, 12);
  while (versions.length && Buffer.byteLength(JSON.stringify(versions), "utf8") > maxHistoryBytes) {
    versions.pop();
  }
  return {
    content: nextRaw,
    history: JSON.stringify(versions),
    draft: nextRaw,
    auxiliary: settings,
    revision: contentRevision(nextRaw),
    previousRevision: contentRevision(previous),
    versionCount: versions.length,
  };
}

/**
 * Persist ALL publication keys under one PostgreSQL transaction.
 * An advisory lock on siteContent makes compare-and-swap conflict detection atomic.
 * The public content, draft snapshot and versions are committed or rolled back together.
 */
export async function publishNeonSiteContent({ expectedRaw, nextRaw, actor, auxiliary, action = "publish" }) {
  if (!neonPool) throw Object.assign(new Error("Neon no está configurado."), { statusCode: 503 });
  await ensureSiteEditorAuditTables();
  const client = await neonPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", ["storage:siteContent"]);
    const previousRow = await client.query("select value from app_storage where key=$1", ["siteContent"]);
    const historyRow = await client.query("select value from app_storage where key=$1", ["siteContentHistory"]);
    const plan = planSiteContentPublication({
      before: previousRow.rows?.[0]?.value ?? null,
      expectedRaw,
      nextRaw,
      historyRaw: historyRow.rows?.[0]?.value ?? null,
      actor,
      auxiliary,
    });
    for (const [key, value] of Object.entries({
      siteContent: plan.content,
      siteContentDraft: plan.draft,
      siteContentHistory: plan.history,
      ...plan.auxiliary,
    })) {
      await client.query(
        `insert into app_storage (key,value,created_at,updated_at)
         values ($1,$2,now(),now())
         on conflict (key) do update set value=excluded.value,updated_at=now()`,
        [key, value]
      );
    }
    await recordSitePublicationAudit(client, {
      actor, action,
      previousRevision: plan.previousRevision,
      nextRevision: plan.revision,
    });
    await client.query("COMMIT");
    return { ok: true, revision: plan.revision, previousRevision: plan.previousRevision, versionCount: plan.versionCount, history: plan.history };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
