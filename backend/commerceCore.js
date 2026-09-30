import express from "express";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const originalListen = express.application.listen;
const DEFAULT_COLLECTIONS = [
  ["plantas","plantas","Plantas"],
  ["semillas","semillas","Semillas"],
  ["jardineria","jardineria","Jardinería"],
  ["sustratos","tierra-y-sustratos","Tierra y sustratos"],
  ["decoracion","decoracion","Decoración"],
  ["dulce","dulce","Dulce"],
  ["moda","moda","Moda"],
  ["servicios","servicios","Servicios"],
];

function dbClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}
function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map((part) => {
    const [name, ...rest] = part.trim().split("=");
    return [decodeURIComponent(name), decodeURIComponent(rest.join("="))];
  }));
}
function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "change-me-in-production";
}
function sign(value) {
  return crypto.createHmac("sha256", sessionSecret()).update(value).digest("hex");
}
function isAdmin(req) {
  const token = parseCookies(req).admin_session;
  if (!token || !token.includes(".")) return false;
  const [payload, signature] = token.split(".");
  if (signature !== sign(payload)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return decoded.role === "admin" && Date.now() - Number(decoded.iat || 0) < 12 * 60 * 60 * 1000;
  } catch { return false; }
}
function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: "Acceso de administrador requerido" });
  next();
}
function slugify(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || crypto.randomUUID().slice(0, 8);
}
function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function integer(value, fallback = 0) {
  return Math.max(0, Math.floor(number(value, fallback)));
}
function inferCollections(product) {
  const raw = [product?.category, product?.collection, ...(Array.isArray(product?.collections) ? product.collections : [])]
    .filter(Boolean).map((x) => String(x).toLowerCase());
  const text = [product?.name, product?.category, product?.description, product?.tags].filter(Boolean).join(" ").toLowerCase();
  const ids = new Set();
  for (const value of raw) {
    if (/dulce|postre|tarta|pastel|reposter/.test(value)) ids.add("dulce");
    else if (/moda|textil|camisa|delantal|guante|ropa/.test(value)) ids.add("moda");
    else if (/semilla/.test(value)) ids.add("semillas");
    else if (/sustrato|tierra/.test(value)) ids.add("sustratos");
    else if (/jardin/.test(value)) ids.add("jardineria");
    else if (/decor/.test(value)) ids.add("decoracion");
    else if (/servicio/.test(value)) ids.add("servicios");
    else ids.add("plantas");
  }
  if (/dulce|postre|tarta|pastel|brownie|galleta|desayuno|reposter/.test(text)) ids.add("dulce");
  if (/moda|camisa|delantal|guante|ropa|textil|uniforme/.test(text)) ids.add("moda");
  if (!ids.size) ids.add("plantas");
  return [...ids];
}
function productRowToLegacy(row, variants = [], images = [], collections = []) {
  const metadata = row.metadata || {};
  const primary = images.find((image) => image.is_primary) || images[0];
  return {
    id: row.id,
    name: row.name,
    scientificName: row.scientific_name || "",
    description: row.description || "",
    category: row.category || "plantas",
    type: row.type || "plant",
    price: number(row.price),
    salePrice: row.compare_at_price && number(row.compare_at_price) > number(row.price) ? number(row.price) : undefined,
    originalPrice: row.compare_at_price ? number(row.compare_at_price) : undefined,
    onSale: Boolean(row.compare_at_price && number(row.compare_at_price) > number(row.price)),
    cost: row.cost == null ? undefined : number(row.cost),
    iva: number(row.tax_rate, 21),
    sku: row.sku || "",
    stock: integer(row.stock),
    active: row.status === "active",
    deletedAt: row.status === "archived" ? row.updated_at : undefined,
    featured: Boolean(row.featured),
    environment: row.environment || "",
    light: row.light || "",
    size: row.size || "",
    difficulty: row.difficulty || "",
    petSafe: Boolean(row.pet_safe),
    toxicity: row.toxicity || "",
    water: row.water || "",
    temperature: row.temperature || "",
    occasion: row.occasion || "",
    allowDedication: row.allow_dedication !== false,
    seoTitle: row.seo_title || row.name,
    seoDescription: row.seo_description || row.description || "",
    image: primary?.url || metadata.image || "",
    images: images.map((image) => ({ id: image.id, url: image.url, alt: image.alt_text, position: image.position })),
    variants: variants.map((variant) => ({ id: variant.id, name: variant.name, sku: variant.sku || "", price: variant.price == null ? undefined : number(variant.price), stock: integer(variant.stock), image: variant.metadata?.image || "" })),
    collections,
    ...metadata,
  };
}
async function ensureDefaults(db) {
  const rows = DEFAULT_COLLECTIONS.map(([id, slug, name], index) => ({ id, slug, name, sort_order: (index + 1) * 10, status: "active" }));
  const { error } = await db.from("commerce_collections").upsert(rows, { onConflict: "id" });
  if (error) throw error;
}
async function readLegacy(db) {
  const { data, error } = await db.from("app_storage").select("value").eq("key", "adminProducts").maybeSingle();
  if (error) throw error;
  try { return JSON.parse(data?.value || "[]"); } catch { return []; }
}
async function upsertLegacyStorage(db, products) {
  const { error } = await db.from("app_storage").upsert({
    key: "adminProducts",
    value: JSON.stringify(products),
    updated_at: new Date().toISOString(),
  }, { onConflict: "key" });
  if (error) throw error;
}
async function hydrateProducts(db, { includeArchived = false } = {}) {
  let query = db.from("commerce_products").select("*").order("created_at", { ascending: false });
  if (!includeArchived) query = query.neq("status", "archived");
  const [{ data: products, error }, { data: variants }, { data: images }, { data: joins }] = await Promise.all([
    query,
    db.from("commerce_product_variants").select("*").order("position", { ascending: true }),
    db.from("commerce_product_images").select("*").order("position", { ascending: true }),
    db.from("commerce_product_collections").select("product_id,collection_id,position").order("position", { ascending: true }),
  ]);
  if (error) throw error;
  const variantsBy = new Map(), imagesBy = new Map(), collectionsBy = new Map();
  for (const row of variants || []) { const key=String(row.product_id); variantsBy.set(key,[...(variantsBy.get(key)||[]),row]); }
  for (const row of images || []) { const key=String(row.product_id); imagesBy.set(key,[...(imagesBy.get(key)||[]),row]); }
  for (const row of joins || []) { const key=String(row.product_id); collectionsBy.set(key,[...(collectionsBy.get(key)||[]),row.collection_id]); }
  return (products || []).map((row) => productRowToLegacy(row, variantsBy.get(String(row.id)) || [], imagesBy.get(String(row.id)) || [], collectionsBy.get(String(row.id)) || []));
}
async function syncLegacy(db) {
  const products = await hydrateProducts(db, { includeArchived: true });
  await upsertLegacyStorage(db, products);
  return products;
}
async function replaceRelations(db, productId, product) {
  if (Array.isArray(product.variants)) {
    await db.from("commerce_product_variants").delete().eq("product_id", productId);
    const variants = product.variants.filter((v) => v && String(v.name || "").trim()).map((v, index) => ({
      id: /^[0-9a-f-]{36}$/i.test(String(v.id || "")) ? v.id : undefined,
      product_id: productId,
      name: String(v.name).trim(),
      sku: String(v.sku || "") || null,
      price: v.price === "" || v.price == null ? null : number(v.price),
      compare_at_price: v.compareAtPrice === "" || v.compareAtPrice == null ? null : number(v.compareAtPrice),
      stock: integer(v.stock),
      position: index,
      metadata: v.image ? { image: v.image } : {},
    }));
    if (variants.length) {
      const clean = variants.map((v) => { const { id, ...rest } = v; return id ? v : rest; });
      const { error } = await db.from("commerce_product_variants").insert(clean);
      if (error) throw error;
    }
  }
  if (Array.isArray(product.images)) {
    await db.from("commerce_product_images").delete().eq("product_id", productId);
    const images = product.images.filter((img) => typeof img === "string" ? img : img?.url).map((img, index) => {
      const url = typeof img === "string" ? img : img.url;
      return { product_id: productId, url, alt_text: typeof img === "string" ? product.name || "" : (img.alt || img.altText || product.name || ""), position: index, is_primary: index === 0 };
    });
    if (images.length) {
      const { error } = await db.from("commerce_product_images").insert(images);
      if (error) throw error;
    }
  } else if (product.image) {
    const { data: existing } = await db.from("commerce_product_images").select("id").eq("product_id", productId).limit(1);
    if (!existing?.length) await db.from("commerce_product_images").insert({ product_id: productId, url: product.image, alt_text: product.name || "", position: 0, is_primary: true });
  }
  if (Array.isArray(product.collections)) {
    await db.from("commerce_product_collections").delete().eq("product_id", productId);
    const values = [...new Set(product.collections.map(String).filter(Boolean))];
    if (values.length) {
      const { error } = await db.from("commerce_product_collections").insert(values.map((collection_id, index) => ({ product_id: productId, collection_id, position: index })));
      if (error) throw error;
    }
  }
}
function normalizeProductInput(input, existing = {}) {
  const id = String(input.id || existing.id || Date.now());
  const currentMetadata = existing.metadata || {};
  const metadata = { ...currentMetadata, ...(input.metadata || {}) };
  for (const key of ["humidity","growth","origin","potDiameter","height","careNotes","tags","barcode","supplierId"]) {
    if (input[key] !== undefined) metadata[key] = input[key];
  }
  return {
    id,
    slug: slugify(input.slug || input.name || existing.name || id),
    type: String(input.type || existing.type || "plant"),
    name: String(input.name || existing.name || "").trim(),
    scientific_name: String(input.scientificName ?? input.scientific_name ?? existing.scientific_name ?? "").trim() || null,
    description: String(input.description ?? existing.description ?? ""),
    category: String(input.category || existing.category || "plantas"),
    status: String(input.status || (input.active === false ? "draft" : existing.status || "active")),
    featured: input.featured !== undefined ? Boolean(input.featured) : Boolean(existing.featured),
    price: Math.max(0, number(input.price ?? existing.price)),
    compare_at_price: input.compareAtPrice ?? input.originalPrice ?? (input.onSale && input.salePrice ? existing.price : existing.compare_at_price),
    cost: input.cost === "" || input.cost == null ? (existing.cost ?? null) : Math.max(0, number(input.cost)),
    tax_rate: Math.max(0, number(input.taxRate ?? input.iva ?? existing.tax_rate, 21)),
    sku: String(input.sku ?? existing.sku ?? "").trim() || null,
    stock: integer(input.stock ?? existing.stock),
    environment: String(input.environment ?? existing.environment ?? "") || null,
    light: String(input.light ?? existing.light ?? "") || null,
    size: String(input.size ?? existing.size ?? "") || null,
    difficulty: String(input.difficulty ?? existing.difficulty ?? "") || null,
    pet_safe: input.petSafe !== undefined ? Boolean(input.petSafe) : Boolean(existing.pet_safe),
    toxicity: String(input.toxicity ?? existing.toxicity ?? "") || null,
    water: String(input.water ?? existing.water ?? "") || null,
    temperature: String(input.temperature ?? existing.temperature ?? "") || null,
    occasion: String(input.occasion ?? existing.occasion ?? "") || null,
    allow_dedication: input.allowDedication !== undefined ? Boolean(input.allowDedication) : existing.allow_dedication !== false,
    seo_title: String(input.seoTitle ?? existing.seo_title ?? input.name ?? existing.name ?? "") || null,
    seo_description: String(input.seoDescription ?? existing.seo_description ?? input.description ?? existing.description ?? "") || null,
    metadata,
    updated_at: new Date().toISOString(),
  };
}
async function bootstrapLegacy(db) {
  await ensureDefaults(db);
  const { count, error: countError } = await db.from("commerce_products").select("*", { count: "exact", head: true });
  if (countError) throw countError;
  if ((count || 0) > 0) return { imported: 0 };
  const legacy = await readLegacy(db);
  if (!Array.isArray(legacy) || !legacy.length) return { imported: 0 };
  let imported = 0;
  for (const product of legacy) {
    const row = normalizeProductInput({ ...product, status: product.deletedAt ? "archived" : product.active === false ? "draft" : "active" });
    if (!row.name) continue;
    const { error } = await db.from("commerce_products").upsert(row, { onConflict: "id" });
    if (error) throw error;
    const collections = Array.isArray(product.collections) && product.collections.length ? product.collections : inferCollections(product);
    await replaceRelations(db, row.id, { ...product, images: product.images?.length ? product.images : product.image ? [product.image] : [], collections });
    imported++;
  }
  await syncLegacy(db);
  return { imported };
}
async function getCollectionIds(db) {
  const { data, error } = await db.from("commerce_collections").select("*").neq("status","archived").order("sort_order");
  if (error) throw error;
  return data || [];
}

function defaultCollectionObjects() {
  return DEFAULT_COLLECTIONS.map(([id, slug, name], index) => ({
    id, slug, name, description: "", image_url: null, status: "active", sort_order: (index + 1) * 10,
  }));
}
function schemaMissing(error) {
  const text = String(error?.message || error || "").toLowerCase();
  return text.includes("commerce_products") || text.includes("commerce_collections") ||
    text.includes("relation") && text.includes("does not exist") || text.includes("pgrst205");
}
function decorateLegacyProduct(product) {
  const collections = Array.isArray(product?.collections) && product.collections.length
    ? product.collections.map(String)
    : inferCollections(product);
  return {
    ...product,
    id: String(product?.id ?? Date.now()),
    active: product?.deletedAt ? false : product?.active !== false,
    collections,
    type: product?.type || (collections.includes("dulce") ? "food" : collections.includes("moda") ? "fashion" : "plant"),
  };
}
async function legacyCatalog(db, { includeArchived = false, collection = "" } = {}) {
  const rows = (await readLegacy(db)).map(decorateLegacyProduct);
  return rows.filter((p) => (includeArchived || (p.active !== false && !p.deletedAt)) && (!collection || p.collections.includes(collection)));
}
async function legacyCreate(db, body) {
  const rows = await readLegacy(db);
  const id = String(body.id || Date.now());
  const collections = Array.isArray(body.collections) && body.collections.length ? body.collections.map(String) : inferCollections(body);
  const product = decorateLegacyProduct({
    ...body, id, collections,
    image: body.image || body.images?.[0] || "",
    price: Math.max(0, number(body.price)),
    stock: integer(body.stock),
    iva: Math.max(0, number(body.taxRate ?? body.iva, 21)),
    active: body.status !== "draft" && body.status !== "archived" && body.active !== false,
    deletedAt: body.status === "archived" ? new Date().toISOString() : undefined,
    variants: Array.isArray(body.variants) ? body.variants : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await upsertLegacyStorage(db, [...rows.filter((p) => String(p.id) !== id), product]);
  return product;
}
async function legacyUpdate(db, id, patch) {
  const rows = await readLegacy(db);
  const index = rows.findIndex((p) => String(p.id) === String(id));
  if (index < 0) throw Object.assign(new Error("Producto no encontrado"), { statusCode: 404 });
  const current = rows[index];
  const collections = Array.isArray(patch.collections) ? patch.collections.map(String) :
    (Array.isArray(current.collections) && current.collections.length ? current.collections : inferCollections({ ...current, ...patch }));
  const status = patch.status || (patch.deletedAt ? "archived" : patch.active === false ? "draft" : current.active === false ? "draft" : "active");
  const next = decorateLegacyProduct({
    ...current, ...patch, id: String(id), collections,
    image: patch.image ?? patch.images?.[0] ?? current.image ?? "",
    price: patch.price == null ? current.price : Math.max(0, number(patch.price)),
    stock: patch.stock == null ? current.stock : integer(patch.stock),
    iva: patch.taxRate == null && patch.iva == null ? current.iva : Math.max(0, number(patch.taxRate ?? patch.iva, 21)),
    active: status === "active",
    deletedAt: status === "archived" ? (current.deletedAt || new Date().toISOString()) : undefined,
    updatedAt: new Date().toISOString(),
  });
  rows[index] = next;
  await upsertLegacyStorage(db, rows);
  return next;
}

function installRoutes(app) {
  app.get("/api/commerce/collections", async (_req, res) => {
    const db = dbClient(); if (!db) return res.status(503).json({ error: "Supabase no está configurado" });
    try { await bootstrapLegacy(db); res.json({ collections: await getCollectionIds(db), source: "commerce_core" }); }
    catch (error) {
      if (schemaMissing(error)) return res.json({ collections: defaultCollectionObjects(), source: "legacy_fallback" });
      res.status(500).json({ error: error.message || "No se pudieron cargar las colecciones" });
    }
  });

  app.get("/api/commerce/products", async (req, res) => {
    const db = dbClient(); if (!db) return res.status(503).json({ error: "Supabase no está configurado" });
    try {
      await bootstrapLegacy(db);
      let products = await hydrateProducts(db, { includeArchived: isAdmin(req) && req.query.includeArchived === "1" });
      const collection = String(req.query.collection || "").trim();
      const status = String(req.query.status || "").trim();
      if (!isAdmin(req)) products = products.filter((p) => p.active !== false && !p.deletedAt);
      if (collection) products = products.filter((p) => Array.isArray(p.collections) && p.collections.includes(collection));
      if (status === "draft") products = products.filter((p) => p.active === false && !p.deletedAt);
      res.json({ products });
    } catch (error) {
      if (schemaMissing(error)) {
        const products = await legacyCatalog(db, { includeArchived: isAdmin(req) && req.query.includeArchived === "1", collection: String(req.query.collection || "") });
        return res.json({ products, source: "legacy_fallback" });
      }
      res.status(500).json({ error: error.message || "No se pudo cargar el catálogo" });
    }
  });

  app.get("/api/commerce/products/:id", async (req, res) => {
    const db = dbClient(); if (!db) return res.status(503).json({ error: "Supabase no está configurado" });
    try {
      await bootstrapLegacy(db);
      const products = await hydrateProducts(db, { includeArchived: isAdmin(req) });
      const product = products.find((p) => String(p.id) === String(req.params.id));
      if (!product || (!isAdmin(req) && (product.active === false || product.deletedAt))) return res.status(404).json({ error: "Producto no encontrado" });
      res.json({ product });
    } catch (error) {
      if (schemaMissing(error)) {
        const rows = await legacyCatalog(db, { includeArchived: isAdmin(req) });
        const product = rows.find((p) => String(p.id) === String(req.params.id));
        if (!product) return res.status(404).json({ error: "Producto no encontrado" });
        return res.json({ product, source: "legacy_fallback" });
      }
      res.status(500).json({ error: error.message || "No se pudo cargar el producto" });
    }
  });

  app.post("/api/admin/commerce/bootstrap", requireAdmin, async (_req, res) => {
    const db = dbClient(); if (!db) return res.status(503).json({ error: "Supabase no está configurado" });
    try { const result = await bootstrapLegacy(db); res.json({ ok: true, ...result, products: await hydrateProducts(db,{includeArchived:true}), source: "commerce_core" }); }
    catch (error) {
      if (schemaMissing(error)) return res.json({ ok: true, imported: 0, products: await legacyCatalog(db,{includeArchived:true}), source: "legacy_fallback", migrationRequired: true });
      res.status(500).json({ error: error.message || "No se pudo migrar el catálogo" });
    }
  });

  app.post("/api/admin/commerce/products", requireAdmin, async (req, res) => {
    const db = dbClient(); if (!db) return res.status(503).json({ error: "Supabase no está configurado" });
    try {
      await ensureDefaults(db);
      const body = req.body || {};
      const row = normalizeProductInput(body);
      if (!row.name) return res.status(400).json({ error: "El nombre es obligatorio" });
      if (!(row.price >= 0)) return res.status(400).json({ error: "Precio no válido" });
      const { error } = await db.from("commerce_products").insert({ ...row, created_at: new Date().toISOString() });
      if (error) throw error;
      const collections = Array.isArray(body.collections) && body.collections.length ? body.collections : inferCollections(body);
      await replaceRelations(db, row.id, { ...body, collections, images: body.images?.length ? body.images : body.image ? [body.image] : [] });
      const products = await syncLegacy(db);
      const product = products.find((p) => String(p.id) === row.id);
      res.status(201).json({ product });
    } catch (error) {
      if (schemaMissing(error)) return res.status(201).json({ product: await legacyCreate(db, req.body || {}), source: "legacy_fallback", migrationRequired: true });
      res.status(500).json({ error: error.message || "No se pudo crear el producto" });
    }
  });

  app.patch("/api/admin/commerce/products/:id", requireAdmin, async (req, res) => {
    const db = dbClient(); if (!db) return res.status(503).json({ error: "Supabase no está configurado" });
    try {
      const id = String(req.params.id);
      const { data: existing, error: readError } = await db.from("commerce_products").select("*").eq("id", id).maybeSingle();
      if (readError) throw readError;
      if (!existing) return res.status(404).json({ error: "Producto no encontrado" });
      const row = normalizeProductInput({ ...req.body, id }, existing);
      if (!row.name) return res.status(400).json({ error: "El nombre es obligatorio" });
      const { error } = await db.from("commerce_products").update(row).eq("id", id);
      if (error) throw error;
      await replaceRelations(db, id, req.body || {});
      const products = await syncLegacy(db);
      res.json({ product: products.find((p) => String(p.id) === id) });
    } catch (error) {
      if (schemaMissing(error)) {
        try { return res.json({ product: await legacyUpdate(db, req.params.id, req.body || {}), source: "legacy_fallback", migrationRequired: true }); }
        catch (fallbackError) { return res.status(fallbackError.statusCode || 500).json({ error: fallbackError.message || "No se pudo actualizar el producto" }); }
      }
      res.status(500).json({ error: error.message || "No se pudo actualizar el producto" });
    }
  });

  app.delete("/api/admin/commerce/products/:id", requireAdmin, async (req, res) => {
    const db = dbClient(); if (!db) return res.status(503).json({ error: "Supabase no está configurado" });
    try {
      const id = String(req.params.id);
      const permanent = req.query.permanent === "1";
      if (permanent) {
        const { error } = await db.from("commerce_products").delete().eq("id", id); if (error) throw error;
      } else {
        const { error } = await db.from("commerce_products").update({ status:"archived", updated_at:new Date().toISOString() }).eq("id",id); if (error) throw error;
      }
      await syncLegacy(db);
      res.json({ ok: true });
    } catch (error) {
      if (schemaMissing(error)) {
        const rows = await readLegacy(db);
        const id = String(req.params.id);
        const permanent = req.query.permanent === "1";
        const next = permanent ? rows.filter((p) => String(p.id) !== id) : rows.map((p) => String(p.id) === id ? { ...p, active: false, deletedAt: new Date().toISOString() } : p);
        await upsertLegacyStorage(db, next);
        return res.json({ ok: true, source: "legacy_fallback", migrationRequired: true });
      }
      res.status(500).json({ error: error.message || "No se pudo eliminar el producto" });
    }
  });

  app.post("/api/admin/commerce/collections", requireAdmin, async (req,res) => {
    const db=dbClient(); if(!db) return res.status(503).json({error:"Supabase no está configurado"});
    try {
      const name=String(req.body?.name||"").trim(); if(!name) return res.status(400).json({error:"Nombre obligatorio"});
      const id=String(req.body?.id||slugify(name)); const row={id,slug:slugify(req.body?.slug||name),name,description:String(req.body?.description||""),image_url:req.body?.imageUrl||null,status:req.body?.status||"active",sort_order:integer(req.body?.sortOrder)};
      const {error}=await db.from("commerce_collections").upsert(row,{onConflict:"id"}); if(error) throw error;
      res.json({collections:await getCollectionIds(db)});
    } catch(error){
      if(schemaMissing(error)) return res.json({collections:defaultCollectionObjects(),source:"legacy_fallback",migrationRequired:true});
      res.status(500).json({error:error.message||"No se pudo guardar la colección"});
    }
  });

  app.get("/api/admin/commerce/health", requireAdmin, async (_req,res) => {
    const db=dbClient(); if(!db) return res.status(503).json({ok:false,error:"Supabase no está configurado"});
    try {
      await bootstrapLegacy(db);
      const [{count:products},{count:collections}] = await Promise.all([
        db.from("commerce_products").select("*",{count:"exact",head:true}),
        db.from("commerce_collections").select("*",{count:"exact",head:true}),
      ]);
      res.json({ok:true,products:products||0,collections:collections||0,source:"commerce_core"});
    } catch(error){
      if(schemaMissing(error)) {
        const products=await legacyCatalog(db,{includeArchived:true});
        return res.json({ok:true,products:products.length,collections:DEFAULT_COLLECTIONS.length,source:"legacy_fallback",migrationRequired:true});
      }
      res.status(500).json({ok:false,error:error.message});
    }
  });
}

express.application.listen = function patchedCommerceListen(...args) {
  if (!this.locals.__commerceCoreRoutesInstalled) {
    this.locals.__commerceCoreRoutesInstalled = true;
    installRoutes(this);
  }
  return originalListen.apply(this, args);
};
