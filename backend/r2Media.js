import crypto from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadBucketCommand,
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

export function parseR2ImageDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/i);
  if (!match) throw new Error("Formato de imagen no válido");

  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) throw new Error("La imagen está vacía");
  if (buffer.length > 6 * 1024 * 1024) {
    throw new Error("La imagen supera 6 MB después de procesarla");
  }

  const extension =
    mimeType === "image/png" ? "png" :
    mimeType === "image/webp" ? "webp" :
    mimeType === "image/gif" ? "gif" : "jpg";

  return { mimeType, buffer, extension };
}

export async function uploadR2Media({ dataUrl, filename = "imagen" } = {}) {
  const { mimeType, buffer, extension } = parseR2ImageDataUrl(dataUrl);
  const path = createMediaObjectName(filename, extension);

  await r2Client().send(new PutObjectCommand({
    Bucket: bucketName(),
    Key: path,
    Body: buffer,
    ContentType: mimeType,
    CacheControl: "public, max-age=31536000, immutable",
  }));

  return {
    name: path.split("/").pop(),
    path,
    url: publicUrlForKey(path),
    size: buffer.length,
    createdAt: new Date().toISOString(),
  };
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


export async function checkR2Connection() {
  if (!hasR2) {
    return { ok: false, configured: false, error: "Cloudflare R2 no está configurado" };
  }

  try {
    await r2Client().send(new HeadBucketCommand({ Bucket: bucketName() }));
    return {
      ok: true,
      configured: true,
      bucket: bucketName(),
      publicUrl: publicBaseUrl(),
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      bucket: bucketName(),
      publicUrl: publicBaseUrl(),
      error: error?.message || String(error),
      code: error?.name || null,
    };
  }
}
