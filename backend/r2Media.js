import crypto from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

export const hasR2 = Boolean(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET_NAME &&
  process.env.R2_PUBLIC_URL
);

let client = null;

function r2Client() {
  if (!hasR2) throw new Error("Cloudflare R2 no está configurado");
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

function bucketName() {
  return String(process.env.R2_BUCKET_NAME || "").trim();
}

function publicBaseUrl() {
  return String(process.env.R2_PUBLIC_URL || "").trim().replace(/\/+$/, "");
}

function publicUrlForKey(key) {
  const encoded = String(key)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  return `${publicBaseUrl()}/${encoded}`;
}

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
  const base = String(filename)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/\.[^.]+$/, "")
    .slice(0, 80) || "imagen";
  return `builder/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${base}.${extension}`;
}

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

function extensionForMimeType(mimeType) {
  return mimeType === "image/png" ? "png" :
    mimeType === "image/webp" ? "webp" :
    mimeType === "image/gif" ? "gif" :
    mimeType === "image/avif" ? "avif" : "jpg";
}

export function parseR2ImageDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/(?:jpeg|png|webp|gif|avif));base64,(.+)$/i);
  if (!match) throw new Error("Formato de imagen no válido");

  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) throw new Error("La imagen está vacía");
  if (buffer.length > 6 * 1024 * 1024) {
    throw new Error("La imagen supera 6 MB después de procesarla");
  }

  const extension = extensionForMimeType(mimeType);

  return { mimeType, buffer, extension };
}

export async function uploadR2MediaBuffer({ buffer, mimeType, filename = "imagen" } = {}) {
  const normalizedMimeType = String(mimeType || "").toLowerCase();
  const body = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || "");
  if (!ALLOWED_IMAGE_MIME_TYPES.has(normalizedMimeType)) {
    throw new Error("Formato de imagen no válido");
  }
  if (!body.length) throw new Error("La imagen está vacía");
  if (body.length > 8 * 1024 * 1024) throw new Error("La imagen supera 8 MB");

  const extension = extensionForMimeType(normalizedMimeType);
  const path = createMediaObjectName(filename, extension);
  await r2Client().send(new PutObjectCommand({
    Bucket: bucketName(),
    Key: path,
    Body: body,
    ContentType: normalizedMimeType,
    CacheControl: "public, max-age=31536000, immutable",
  }));

  return {
    name: path.split("/").pop(),
    path,
    url: publicUrlForKey(path),
    size: body.length,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Accept previously uploaded gallery pictures without downloading and
 * uploading the exact same bytes again. Checks exact configured public origin,
 * a safe object key, and actual object existence via R2 HeadObject.
 */
export function ownR2MediaPathFromUrl(value, publicBase = publicBaseUrl()) {
  try {
    const base = new URL(String(publicBase).replace(/\\/+$/, "") + "/");
    const candidate = new URL(String(value || ""));
    if (base.protocol !== "https:" || candidate.protocol !== "https:" ||
        base.origin !== candidate.origin || candidate.username || candidate.password ||
        candidate.search || candidate.hash) return "";
    if (!candidate.pathname.startsWith(base.pathname)) return "";
    const key = decodeURIComponent(candidate.pathname.slice(base.pathname.length));
    return /^builder\\/[a-zA-Z0-9._-]+$/.test(key) && !key.endsWith("..") ? key : "";
  } catch { return ""; }
}

export async function verifiedExistingR2Media(value) {
  if (!hasR2) return null;
  const path = ownR2MediaPathFromUrl(value);
  if (!path) return null;
  const object = await r2Client().send(new HeadObjectCommand({ Bucket: bucketName(), Key: path }));
  const size = Number(object.ContentLength || 0);
  const mimeType = String(object.ContentType || "").toLowerCase();
  if (size <= 0 || size > 8 * 1024 * 1024 || !ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error("La fotografía existente en R2 no es válida");
  }
  return { path, name: path.split("/").pop(), url: publicUrlForKey(path), size, sourceUrl: String(value) };
}

export async function uploadR2Media({ dataUrl, filename = "imagen" } = {}) {
  const { mimeType, buffer } = parseR2ImageDataUrl(dataUrl);
  return uploadR2MediaBuffer({ buffer, mimeType, filename });
}

export async function listR2Media({ prefix = "builder/", limit = 100 } = {}) {
  const result = await r2Client().send(new ListObjectsV2Command({
    Bucket: bucketName(),
    Prefix: prefix,
    MaxKeys: Math.max(1, Math.min(1000, Number(limit) || 100)),
  }));

  return (result.Contents || [])
    .filter((item) => item?.Key && item.Key !== prefix)
    .sort((a, b) => new Date(b.LastModified || 0) - new Date(a.LastModified || 0))
    .map((item) => ({
      name: String(item.Key).split("/").pop(),
      path: String(item.Key),
      url: publicUrlForKey(item.Key),
      createdAt: item.LastModified ? new Date(item.LastModified).toISOString() : null,
      size: Number(item.Size || 0),
      etag: String(item.ETag || "").replace(/^"|"$/g, ""),
    }));
}

export async function deleteR2Media(path) {
  const key = String(path || "");
  if (!/^builder\/[a-zA-Z0-9._-]+$/.test(key)) {
    throw new Error("Ruta multimedia no válida");
  }

  await r2Client().send(new DeleteObjectCommand({
    Bucket: bucketName(),
    Key: key,
  }));

  return true;
}


export async function checkR2Connection({ verifyWrite = true } = {}) {
  if (!hasR2) {
    return { ok: false, configured: false, error: "Cloudflare R2 no está configurado" };
  }

  let probeKey = null;
  try {
    await r2Client().send(new HeadBucketCommand({ Bucket: bucketName() }));

    if (verifyWrite) {
      probeKey = `_health/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.txt`;
      await r2Client().send(new PutObjectCommand({
        Bucket: bucketName(),
        Key: probeKey,
        Body: Buffer.from("ok"),
        ContentType: "text/plain",
        CacheControl: "no-store",
      }));
      await r2Client().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: probeKey }));
      probeKey = null;
    }

    return {
      ok: true,
      configured: true,
      bucket: bucketName(),
      publicUrl: publicBaseUrl(),
      writeVerified: Boolean(verifyWrite),
    };
  } catch (error) {
    if (probeKey) {
      try { await r2Client().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: probeKey })); } catch {}
    }
    return {
      ok: false,
      configured: true,
      bucket: bucketName(),
      publicUrl: publicBaseUrl(),
      writeVerified: false,
      error: error?.message || String(error),
      code: error?.name || null,
    };
  }
}
