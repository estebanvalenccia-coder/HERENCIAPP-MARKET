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

// pg emits pool-level errors when an idle Neon connection is interrupted.
// Without a listener Node treats that event as unhandled and terminates the backend.
// Individual queries still reject normally and are handled by their callers.
if (neonPool) {
  neonPool.on("error", (error) => {
    console.error("Neon pool connection error:", error?.message || error);
  });
}

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

export async function listNeonStorageByPrefix(prefix = "") {
  if (!neonPool) return [];
  const result = await neonPool.query(
    "select key, value, updated_at from app_storage where key like $1 order by updated_at desc",
    [String(prefix) + "%"]
  );
  return result.rows || [];
}


const NEON_RESERVATIONS_KEY = "commerceStockReservations";
const NEON_RESERVATION_LOCK = "herencia:commerce-stock-reservations";

function parseArrayJson(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function reserveNeonCommerceStock(cartToken, items = [], ttlMinutes = 15) {
  if (!neonPool) throw new Error("Neon no está configurado");
  const token = String(cartToken || "").trim();
  if (!token) throw new Error("reservation_token_required");

  const requested = (Array.isArray(items) ? items : [])
    .map((item) => ({
      productId: String(item?.productId ?? item?.id ?? "").trim(),
      variantName: String(item?.variantName ?? item?.selectedVariant ?? "").trim(),
      quantity: Math.max(0, Math.floor(Number(item?.quantity ?? item?.qty ?? 0))),
      trackInventory: item?.trackInventory !== false,
    }))
    .filter((item) => item.productId && item.quantity > 0 && item.trackInventory);

  if (!requested.length) {
    return { active: false, mode: "neon_atomic_reservation", reason: "no_tracked_items", reservedItems: 0 };
  }

  const client = await neonPool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [NEON_RESERVATION_LOCK]);

    const [productsResult, reservationsResult] = await Promise.all([
      client.query("select value from app_storage where key=$1 limit 1 for update", ["adminProducts"]),
      client.query("select value from app_storage where key=$1 limit 1 for update", [NEON_RESERVATIONS_KEY]),
    ]);

    const products = parseArrayJson(productsResult.rows?.[0]?.value);
    const now = Date.now();
    const active = parseArrayJson(reservationsResult.rows?.[0]?.value)
      .filter((row) =>
        row &&
        row.status === "active" &&
        String(row.cartToken || "") !== token &&
        new Date(row.expiresAt || 0).getTime() > now
      );

    const reservedByKey = new Map();
    for (const reservation of active) {
      for (const item of Array.isArray(reservation.items) ? reservation.items : []) {
        const key = `${String(item.productId)}::${String(item.variantName || "base")}`;
        reservedByKey.set(key, Number(reservedByKey.get(key) || 0) + Math.max(0, Number(item.quantity || 0)));
      }
    }

    for (const item of requested) {
      const product = products.find((row) => String(row?.id ?? "") === item.productId);
      if (!product || product.active === false || product.deletedAt) {
        const error = new Error(`Producto no disponible: ${item.productId}`);
        error.statusCode = 409;
        throw error;
      }
      if (product.trackInventory === false) continue;

      const variant = item.variantName
        ? (Array.isArray(product.variants) ? product.variants : [])
            .find((row) => String(row?.name || row) === item.variantName)
        : null;
      if (item.variantName && !variant) {
        const error = new Error(`Variante no disponible: ${product.name || item.productId}`);
        error.statusCode = 409;
        throw error;
      }

      const key = `${item.productId}::${item.variantName || "base"}`;
      const stock = Math.max(0, Math.floor(Number(variant?.stock ?? product.stock ?? 0)));
      const alreadyReserved = Math.max(0, Number(reservedByKey.get(key) || 0));
      if (stock - alreadyReserved < item.quantity) {
        const error = new Error(
          `Stock insuficiente para ${product.name || item.productId}${item.variantName ? ` (${item.variantName})` : ""}. Disponible: ${Math.max(0, stock - alreadyReserved)}`
        );
        error.statusCode = 409;
        throw error;
      }
      reservedByKey.set(key, alreadyReserved + item.quantity);
    }

    const safeTtl = Math.max(1, Math.min(60, Math.floor(Number(ttlMinutes) || 15)));
    const expiresAt = new Date(now + safeTtl * 60_000).toISOString();
    active.push({
      cartToken: token,
      status: "active",
      createdAt: new Date(now).toISOString(),
      expiresAt,
      items: requested.map(({ productId, variantName, quantity }) => ({ productId, variantName, quantity })),
    });

    await client.query(
      `insert into app_storage(key,value,created_at,updated_at)
       values($1,$2,now(),now())
       on conflict(key) do update set value=excluded.value, updated_at=now()`,
      [NEON_RESERVATIONS_KEY, JSON.stringify(active)]
    );
    await client.query("commit");
    return { active: true, mode: "neon_atomic_reservation", expiresAt, reservedItems: requested.length };
  } catch (error) {
    await client.query("rollback").catch(() => null);
    throw error;
  } finally {
    client.release();
  }
}

async function clearNeonCommerceReservation(cartToken, outcome) {
  if (!neonPool) return { skipped: true, reason: "neon_unavailable" };
  const token = String(cartToken || "").trim();
  if (!token) return { skipped: true, reason: "missing_token" };

  const client = await neonPool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtext($1))", [NEON_RESERVATION_LOCK]);
    const result = await client.query(
      "select value from app_storage where key=$1 limit 1 for update",
      [NEON_RESERVATIONS_KEY]
    );
    const rows = parseArrayJson(result.rows?.[0]?.value);
    const removed = rows.filter((row) => row?.status === "active" && String(row.cartToken || "") === token).length;
    const next = rows.filter((row) => !(row?.status === "active" && String(row.cartToken || "") === token));
    await client.query(
      `insert into app_storage(key,value,created_at,updated_at)
       values($1,$2,now(),now())
       on conflict(key) do update set value=excluded.value, updated_at=now()`,
      [NEON_RESERVATIONS_KEY, JSON.stringify(next)]
    );
    await client.query("commit");
    return { ok: true, [outcome]: removed };
  } catch (error) {
    await client.query("rollback").catch(() => null);
    throw error;
  } finally {
    client.release();
  }
}

export async function consumeNeonCommerceStockReservation(cartToken) {
  return clearNeonCommerceReservation(cartToken, "consumed");
}

export async function releaseNeonCommerceStockReservation(cartToken) {
  return clearNeonCommerceReservation(cartToken, "released");
}

export async function syncNeonCommerceInventory(products = []) {
  if (!neonPool || !Array.isArray(products)) return { synced: 0 };
  const client = await neonPool.connect();
  let synced = 0;
  try {
    await client.query("begin");
    for (const product of products) {
      const productId = String(product?.id ?? "").trim();
      if (!productId) continue;
      await client.query(
        "update commerce_products set stock=$2, track_inventory=$3, updated_at=now() where id=$1",
        [productId, int(product.stock), product.trackInventory !== false]
      );
      if (Array.isArray(product.variants)) {
        for (const variant of product.variants) {
          if (!variant || typeof variant !== "object" || !String(variant.name || "").trim()) continue;
          await client.query(
            "update commerce_product_variants set stock=$3, updated_at=now() where product_id=$1 and name=$2",
            [productId, String(variant.name), int(variant.stock)]
          );
        }
      }
      synced++;
    }
    await client.query("commit");
    return { synced };
  } catch (error) {
    await client.query("rollback").catch(() => null);
    throw error;
  } finally {
    client.release();
  }
}

export async function listNeonOrders({ email = null, statuses = null, requestedDate = null, limit = 500 } = {}) {
  if (!neonPool) return [];
  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 2000));
  const where = [];
  const values = [];

  if (email) {
    values.push(String(email));
    where.push(`lower(customer_email) = lower($${values.length})`);
  }
  if (Array.isArray(statuses) && statuses.length) {
    values.push(statuses.map(String));
    where.push(`status = any($${values.length}::text[])`);
  }
  if (requestedDate) {
    values.push(String(requestedDate));
    where.push(`metadata->>'requestedDate' = $${values.length}`);
  }

  values.push(safeLimit);
  const sql = `select * from orders${where.length ? " where " + where.join(" and ") : ""}
               order by created_at desc limit $${values.length}`;
  const result = await neonPool.query(sql, values);
  return result.rows || [];
}

export async function getNeonOrder(id) {
  if (!neonPool) return null;
  const result = await neonPool.query(
    "select * from orders where id::text = $1 limit 1",
    [String(id)]
  );
  return result.rows?.[0] || null;
}

export async function insertNeonOrder(order = {}) {
  if (!neonPool) throw new Error("Neon no está configurado");
  const result = await neonPool.query(
    `insert into orders (
      id, customer_email, customer_name, payment_method, delivery_method,
      status, subtotal, shipping, total, items, metadata, stripe_payment_intent_id,
      tracking_estado, tracking_tiempo, factura_url, entrega_estimada, created_at, updated_at
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
      coalesce($17::timestamptz, now()), now()
    )
    returning *`,
    [
      String(order.id),
      order.customer_email ?? null,
      order.customer_name ?? null,
      order.payment_method || "manual",
      order.delivery_method || "envio",
      order.status || "pending",
      Number(order.subtotal || 0),
      Number(order.shipping || 0),
      Number(order.total || 0),
      order.items || [],
      order.metadata || {},
      order.stripe_payment_intent_id ?? null,
      order.tracking_estado ?? "pendiente",
      order.tracking_tiempo ?? null,
      order.factura_url ?? null,
      order.entrega_estimada ?? null,
      order.created_at ?? null,
    ]
  );
  return result.rows?.[0] || null;
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

export async function deleteNeonOrder(id) {
  if (!neonPool) throw new Error("Neon no está configurado");
  await neonPool.query("delete from orders where id::text = $1", [String(id)]);
  return true;
}



function slugify(value) {
  return String(value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    .slice(0, 100) || String(Date.now());
}
function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function int(value, fallback = 0) {
  return Math.max(0, Math.floor(num(value, fallback)));
}
const COMMERCE_COLLECTION_IDS = new Set([
  "plantas", "semillas", "jardineria", "sustratos", "decoracion", "dulce", "moda", "servicios"
]);
const COMMERCE_COLLECTION_ALIASES = new Map([
  ["planta", "plantas"], ["plantas", "plantas"], ["flores", "plantas"],
  ["plantas-interior", "plantas"], ["plantas-exterior", "plantas"], ["orquideas", "plantas"],
  ["semilla", "semillas"], ["semillas", "semillas"],
  ["jardineria", "jardineria"],
  ["sustrato", "sustratos"], ["sustratos", "sustratos"], ["tierra-y-sustratos", "sustratos"],
  ["decoracion", "decoracion"],
  ["dulce", "dulce"],
  ["moda", "moda"],
  ["servicio", "servicios"], ["servicios", "servicios"],
]);

function normalizeCommerceCollectionId(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  const normalized = COMMERCE_COLLECTION_ALIASES.get(raw) || raw;
  return COMMERCE_COLLECTION_IDS.has(normalized) ? normalized : "";
}

function inferCollections(product = {}) {
  const explicit = [
    ...(Array.isArray(product.collections) ? product.collections : []),
    ...(product.collection ? [product.collection] : []),
  ]
    .map(normalizeCommerceCollectionId)
    .filter(Boolean);
  if (explicit.length) return [...new Set(explicit)];

  // Compatibilidad para productos históricos: solo equivalencias exactas.
  // Nunca se decide la colección leyendo nombre, descripción o etiquetas.
  const categoryCollection = normalizeCommerceCollectionId(product.category);
  return [categoryCollection || "plantas"];
}

export async function ensureNeonCommerceDefaults() {
  if (!neonPool) return;
  const rows = [
    ["plantas","plantas","Plantas",10],["semillas","semillas","Semillas",20],
    ["jardineria","jardineria","Jardinería",30],["sustratos","tierra-y-sustratos","Tierra y sustratos",40],
    ["decoracion","decoracion","Decoración",50],["dulce","dulce","Dulce",60],
    ["moda","moda","Moda",70],["servicios","servicios","Servicios",80]
  ];
  for (const [id,slug,name,sort] of rows) {
    await neonPool.query(
      `insert into commerce_collections(id,slug,name,sort_order,status)
       values($1,$2,$3,$4,'active')
       on conflict(id) do update set slug=excluded.slug,name=excluded.name,sort_order=excluded.sort_order,updated_at=now()`,
      [id,slug,name,sort]
    );
  }
}

async function hydrateNeonProductRows(rows = []) {
  if (!rows.length) return [];
  const ids = rows.map(r => String(r.id));
  const [variants, images, joins] = await Promise.all([
    neonPool.query("select * from commerce_product_variants where product_id = any($1::text[]) order by position", [ids]),
    neonPool.query("select * from commerce_product_images where product_id = any($1::text[]) order by position", [ids]),
    neonPool.query("select * from commerce_product_collections where product_id = any($1::text[]) order by position", [ids]),
  ]);
  const by=(arr,key)=>{const m=new Map();for(const r of arr){const k=String(r[key]);m.set(k,[...(m.get(k)||[]),r]);}return m;};
  const vb=by(variants.rows||[],"product_id"), ib=by(images.rows||[],"product_id"), cb=by(joins.rows||[],"product_id");
  return rows.map(row=>{
    const imgs=ib.get(String(row.id))||[];
    const vars=vb.get(String(row.id))||[];
    const cols=(cb.get(String(row.id))||[]).map(x=>x.collection_id);
    const primary=imgs.find(x=>x.is_primary)||imgs[0];
    const saleActive=Boolean(row.compare_at_price && num(row.compare_at_price)>num(row.price));
    const regularPrice=saleActive?num(row.compare_at_price):num(row.price);
    const currentPrice=num(row.price);
    return {
      id:String(row.id), name:row.name, scientificName:row.scientific_name||"", description:row.description||"",
      category:row.category||"plantas", type:row.type||"plant", price:regularPrice,
      salePrice:saleActive?currentPrice:undefined,
      originalPrice:saleActive?regularPrice:undefined,
      compareAtPrice:saleActive?regularPrice:undefined,
      onSale:saleActive,
      cost:row.cost==null?undefined:num(row.cost), iva:num(row.tax_rate,21), taxRate:num(row.tax_rate,21),
      sku:row.sku||"", stock:int(row.stock), trackInventory:row.track_inventory!==false, active:row.status==="active",
      deletedAt:row.status==="archived"?row.updated_at:undefined, status:row.status, featured:Boolean(row.featured),
      environment:row.environment||"", light:row.light||"", size:row.size||"", difficulty:row.difficulty||"",
      petSafe:Boolean(row.pet_safe), toxicity:row.toxicity||"", water:row.water||"", temperature:row.temperature||"",
      occasion:row.occasion||"", allowDedication:row.allow_dedication!==false,
      seoTitle:row.seo_title||row.name, seoDescription:row.seo_description||row.description||"",
      image:primary?.url||row.metadata?.image||"", images:imgs.map(x=>({id:x.id,url:x.url,alt:x.alt_text,position:x.position})),
      variants:vars.map(v=>({id:v.id,name:v.name,sku:v.sku||"",price:v.price==null?undefined:num(v.price),stock:int(v.stock),image:v.metadata?.image||""})),
      collections:cols, ...(row.metadata||{})
    };
  });
}

export async function listNeonCommerceCollections() {
  if (!neonPool) return [];
  await ensureNeonCommerceDefaults();
  const r=await neonPool.query("select * from commerce_collections where status <> 'archived' order by sort_order,name");
  return r.rows||[];
}

export async function saveNeonCommerceCollection(input = {}) {
  if (!neonPool) throw new Error("Neon no está configurado");
  await ensureNeonCommerceDefaults();

  const name = String(input.name || "").trim();
  if (!name) {
    const error = new Error("Nombre obligatorio");
    error.statusCode = 400;
    throw error;
  }

  const id = String(input.id || slugify(name)).trim();
  const slug = slugify(input.slug || name);
  const description = String(input.description || "");
  const imageUrl = input.imageUrl ?? input.image_url ?? null;
  const status = ["draft", "active", "archived"].includes(String(input.status || "active"))
    ? String(input.status || "active")
    : "active";
  const sortOrder = int(input.sortOrder ?? input.sort_order, 0);

  await neonPool.query(
    `insert into commerce_collections(id,slug,name,description,image_url,status,sort_order,created_at,updated_at)
     values($1,$2,$3,$4,$5,$6,$7,now(),now())
     on conflict(id) do update set
       slug=excluded.slug,
       name=excluded.name,
       description=excluded.description,
       image_url=excluded.image_url,
       status=excluded.status,
       sort_order=excluded.sort_order,
       updated_at=now()`,
    [id, slug, name, description, imageUrl, status, sortOrder]
  );

  return listNeonCommerceCollections();
}

export async function listNeonCommerceProducts({ collection = "", includeArchived = false } = {}) {
  if (!neonPool) return [];
  await ensureNeonCommerceDefaults();
  let sql="select distinct p.* from commerce_products p";
  const params=[];
  const where=[];
  if (collection) {
    sql+=" join commerce_product_collections pc on pc.product_id=p.id";
    params.push(String(collection)); where.push(`pc.collection_id=$${params.length}`);
  }
  if (!includeArchived) where.push("p.status <> 'archived'");
  if (where.length) sql+=" where "+where.join(" and ");
  sql+=" order by p.created_at desc";
  const r=await neonPool.query(sql,params);
  const hydrated=await hydrateNeonProductRows(r.rows||[]);
  return hydrated.sort((a,b)=>{
    const aOrder=Number(a?.sortOrder);
    const bOrder=Number(b?.sortOrder);
    const aHas=Number.isFinite(aOrder);
    const bHas=Number.isFinite(bOrder);
    if(aHas&&bHas&&aOrder!==bOrder)return aOrder-bOrder;
    if(aHas&&!bHas)return -1;
    if(!aHas&&bHas)return 1;
    return 0;
  });
}

export async function getNeonCommerceProduct(id, { includeArchived = false } = {}) {
  if (!neonPool) return null;
  const r=await neonPool.query(
    `select * from commerce_products where id=$1 ${includeArchived?"":"and status <> 'archived'"} limit 1`,
    [String(id)]
  );
  const rows=await hydrateNeonProductRows(r.rows||[]);
  return rows[0]||null;
}

export async function bootstrapNeonCommerceFromLegacy() {
  if (!neonPool) return { imported:0 };
  await ensureNeonCommerceDefaults();
  const count=await neonPool.query("select count(*)::int as count from commerce_products");
  if (Number(count.rows?.[0]?.count||0)>0) return { imported:0 };
  const raw=await readNeonStorageValue("adminProducts");
  let products=[]; try{products=JSON.parse(raw||"[]");}catch{}
  if (!Array.isArray(products)) products=[];
  let imported=0;
  for (const p of products) {
    if (!String(p?.name||"").trim()) continue;
    await saveNeonCommerceProduct(p, { id:String(p.id||Date.now()) });
    imported++;
  }
  return { imported };
}

export async function saveNeonCommerceProduct(input = {}, { id = null } = {}) {
  if (!neonPool) throw new Error("Neon no está configurado");
  await ensureNeonCommerceDefaults();
  const productId=String(id||input.id||Date.now());
  const status=String(input.status|| (input.deletedAt?"archived":input.active===false?"draft":"active"));
  const metadata={...(input.metadata||{})};
  for(const key of [
    "humidity","growth","origin","potDiameter","height","careNotes","tags","barcode","supplierId",
    "material","color","dimensions","weight","allergens","portions","flavor",
    "requiresRefrigeration","madeToOrder","durationMinutes","serviceArea","bookingRequired","leadTimeDays",
    "sortOrder","vendor","customFields","plantProfile","aiPlantProfileGenerated","aiPlantProfileGeneratedAt"
  ]){
    if(input[key]!==undefined) metadata[key]=input[key];
  }
  const price=num(input.salePrice ?? input.price,0);
  const compare=input.compareAtPrice ?? input.originalPrice ?? (input.onSale && input.salePrice ? input.price : null);
  await neonPool.query(
    `insert into commerce_products(
      id,slug,type,name,scientific_name,description,category,status,featured,price,compare_at_price,cost,tax_rate,sku,stock,
      environment,light,size,difficulty,pet_safe,toxicity,water,temperature,occasion,allow_dedication,seo_title,seo_description,metadata,created_at,updated_at
    ) values(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,now(),now()
    )
    on conflict(id) do update set
      slug=excluded.slug,type=excluded.type,name=excluded.name,scientific_name=excluded.scientific_name,description=excluded.description,
      category=excluded.category,status=excluded.status,featured=excluded.featured,price=excluded.price,compare_at_price=excluded.compare_at_price,
      cost=excluded.cost,tax_rate=excluded.tax_rate,sku=excluded.sku,stock=excluded.stock,environment=excluded.environment,light=excluded.light,
      size=excluded.size,difficulty=excluded.difficulty,pet_safe=excluded.pet_safe,toxicity=excluded.toxicity,water=excluded.water,
      temperature=excluded.temperature,occasion=excluded.occasion,allow_dedication=excluded.allow_dedication,seo_title=excluded.seo_title,
      seo_description=excluded.seo_description,metadata=excluded.metadata,updated_at=now()`,
    [productId,slugify(input.slug||input.name||productId),String(input.type||"plant"),String(input.name||"").trim(),
     String(input.scientificName||input.scientific_name||"")||null,String(input.description||""),String(input.category||"plantas"),status,
     Boolean(input.featured),Math.max(0,price),compare==null?null:Math.max(0,num(compare)),input.cost==null||input.cost===""?null:Math.max(0,num(input.cost)),
     Math.max(0,num(input.taxRate??input.iva,21)),String(input.sku||"")||null,int(input.stock),
     String(input.environment||"")||null,String(input.light||"")||null,String(input.size||"")||null,String(input.difficulty||"")||null,
     Boolean(input.petSafe),String(input.toxicity||"")||null,String(input.water||"")||null,String(input.temperature||"")||null,
     String(input.occasion||"")||null,input.allowDedication!==false,String(input.seoTitle||input.name||"")||null,
     String(input.seoDescription||input.description||"")||null,metadata]
  );
  await neonPool.query(
    "update commerce_products set track_inventory=$2, updated_at=now() where id=$1",
    [productId, input.trackInventory !== false]
  );
  const collections=inferCollections(input);
  await neonPool.query("delete from commerce_product_collections where product_id=$1",[productId]);
  for(let i=0;i<collections.length;i++){
    await neonPool.query(
      "insert into commerce_product_collections(product_id,collection_id,position) values($1,$2,$3) on conflict do nothing",
      [productId,collections[i],i]
    );
  }
  const images=Array.isArray(input.images)&&input.images.length?input.images:(input.image?[input.image]:[]);
  await neonPool.query("delete from commerce_product_images where product_id=$1",[productId]);
  for(let i=0;i<images.length;i++){
    const img=images[i];const url=typeof img==="string"?img:img?.url;if(!url)continue;
    await neonPool.query(
      "insert into commerce_product_images(product_id,url,alt_text,position,is_primary) values($1,$2,$3,$4,$5)",
      [productId,String(url),typeof img==="string"?String(input.name||""):String(img.alt||img.altText||input.name||""),i,i===0]
    );
  }
  if (Array.isArray(input.variants)) {
    await neonPool.query("delete from commerce_product_variants where product_id=$1",[productId]);
    for(let i=0;i<input.variants.length;i++){
      const v=input.variants[i]; if(!String(v?.name||"").trim())continue;
      await neonPool.query(
        "insert into commerce_product_variants(product_id,name,sku,price,compare_at_price,stock,position,metadata) values($1,$2,$3,$4,$5,$6,$7,$8)",
        [productId,String(v.name).trim(),String(v.sku||"")||null,v.price==null||v.price===""?null:num(v.price),
         v.compareAtPrice==null||v.compareAtPrice===""?null:num(v.compareAtPrice),int(v.stock),i,v.image?{image:v.image}:{}]
      );
    }
  }
  const all=await listNeonCommerceProducts({includeArchived:true});
  await upsertNeonStorageValue("adminProducts",JSON.stringify(all));
  return getNeonCommerceProduct(productId,{includeArchived:true});
}

export async function archiveNeonCommerceProduct(id, { permanent = false } = {}) {
  if (!neonPool) throw new Error("Neon no está configurado");
  if (permanent) await neonPool.query("delete from commerce_products where id=$1",[String(id)]);
  else await neonPool.query("update commerce_products set status='archived',updated_at=now() where id=$1",[String(id)]);
  const all=await listNeonCommerceProducts({includeArchived:true});
  await upsertNeonStorageValue("adminProducts",JSON.stringify(all));
  return true;
}

export async function closeNeon() {
  if (neonPool) await neonPool.end();
}


let analyticsSchemaReady = false;

async function ensureNeonAnalyticsSchema() {
  if (!neonPool) throw new Error("Neon no está configurado");
  if (analyticsSchemaReady) return;

  await neonPool.query(`
    create table if not exists visitor_analytics (
      id bigserial primary key,
      visitor_id text not null,
      session_id text,
      event_type text not null default 'pageview',
      path text,
      referrer text,
      referrer_host text,
      country text,
      region text,
      city text,
      timezone text,
      language text,
      device text,
      browser text,
      created_at timestamptz not null default now()
    )
  `);
  await neonPool.query("create index if not exists visitor_analytics_created_at_idx on visitor_analytics(created_at desc)");
  await neonPool.query("create index if not exists visitor_analytics_visitor_idx on visitor_analytics(visitor_id, created_at desc)");
  await neonPool.query("create index if not exists visitor_analytics_event_idx on visitor_analytics(event_type, created_at desc)");
  analyticsSchemaReady = true;
}

export async function recordNeonAnalyticsEvent(input = {}) {
  await ensureNeonAnalyticsSchema();
  const clean = (value, max = 500) => String(value || "").trim().slice(0, max) || null;
  await neonPool.query(
    `insert into visitor_analytics (
      visitor_id, session_id, event_type, path, referrer, referrer_host,
      country, region, city, timezone, language, device, browser, created_at
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())`,
    [
      clean(input.visitorId, 120) || "anonymous",
      clean(input.sessionId, 120),
      clean(input.eventType, 80) || "pageview",
      clean(input.path, 500),
      clean(input.referrer, 700),
      clean(input.referrerHost, 220),
      clean(input.country, 120),
      clean(input.region, 160),
      clean(input.city, 160),
      clean(input.timezone, 120),
      clean(input.language, 80),
      clean(input.device, 80),
      clean(input.browser, 120),
    ]
  );
  return { ok: true };
}

export async function getNeonAnalyticsSummary(days = 30) {
  await ensureNeonAnalyticsSchema();
  const safeDays = Math.max(1, Math.min(365, Math.floor(Number(days) || 30)));
  const params = [safeDays];

  const [totals, daily, pages, locations, sources, devices, browsers] = await Promise.all([
    neonPool.query(`
      select
        count(*) filter (where event_type='pageview')::int as pageviews,
        count(distinct visitor_id) filter (where event_type='pageview')::int as visitors,
        count(distinct visitor_id) filter (where event_type='pageview' and created_at >= date_trunc('day', now()))::int as visitors_today,
        count(*) filter (where event_type='space_preview')::int as space_previews
      from visitor_analytics
      where created_at >= now() - ($1::int * interval '1 day')
    `, params),
    neonPool.query(`
      select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
             count(*) filter (where event_type='pageview')::int as pageviews,
             count(distinct visitor_id) filter (where event_type='pageview')::int as visitors
      from visitor_analytics
      where created_at >= now() - ($1::int * interval '1 day')
      group by 1 order by 1 asc
    `, params),
    neonPool.query(`
      select coalesce(nullif(path,''), '/') as label, count(*)::int as value
      from visitor_analytics
      where event_type='pageview' and created_at >= now() - ($1::int * interval '1 day')
      group by 1 order by value desc limit 12
    `, params),
    neonPool.query(`
      select trim(concat_ws(', ', nullif(city,''), nullif(region,''), nullif(country,''))) as label,
             count(distinct visitor_id)::int as value
      from visitor_analytics
      where event_type='pageview'
        and created_at >= now() - ($1::int * interval '1 day')
        and coalesce(city,region,country,'') <> ''
      group by 1 order by value desc limit 12
    `, params),
    neonPool.query(`
      select coalesce(nullif(referrer_host,''), 'Directo / desconocido') as label,
             count(*)::int as value
      from visitor_analytics
      where event_type='pageview' and created_at >= now() - ($1::int * interval '1 day')
      group by 1 order by value desc limit 12
    `, params),
    neonPool.query(`
      select coalesce(nullif(device,''), 'Desconocido') as label, count(*)::int as value
      from visitor_analytics
      where event_type='pageview' and created_at >= now() - ($1::int * interval '1 day')
      group by 1 order by value desc limit 8
    `, params),
    neonPool.query(`
      select coalesce(nullif(browser,''), 'Desconocido') as label, count(*)::int as value
      from visitor_analytics
      where event_type='pageview' and created_at >= now() - ($1::int * interval '1 day')
      group by 1 order by value desc limit 8
    `, params),
  ]);

  return {
    days: safeDays,
    totals: totals.rows?.[0] || { pageviews: 0, visitors: 0, visitors_today: 0, space_previews: 0 },
    daily: daily.rows || [],
    pages: pages.rows || [],
    locations: locations.rows || [],
    sources: sources.rows || [],
    devices: devices.rows || [],
    browsers: browsers.rows || [],
    generatedAt: new Date().toISOString(),
  };
}
