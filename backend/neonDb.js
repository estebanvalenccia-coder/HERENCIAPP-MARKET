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

export async function listNeonStorageByPrefix(prefix = "") {
  if (!neonPool) return [];
  const result = await neonPool.query(
    "select key, value, updated_at from app_storage where key like $1 order by updated_at desc",
    [String(prefix) + "%"]
  );
  return result.rows || [];
}

export async function listNeonOrders({ email = null, statuses = null, requestedDate = null, limit = 500 } = {}) {
  if (!neonPool) return [];
  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 2000));
  const where = [];
  const values = [];

  if (email) {
    values.push(String(email));
    where.push(`lower(customer_email) = lower(${values.length})`);
  }
  if (Array.isArray(statuses) && statuses.length) {
    values.push(statuses.map(String));
    where.push(`status = any(${values.length}::text[])`);
  }
  if (requestedDate) {
    values.push(String(requestedDate));
    where.push(`metadata->>'requestedDate' = ${values.length}`);
  }

  values.push(safeLimit);
  const sql = `select * from orders${where.length ? " where " + where.join(" and ") : ""}
               order by created_at desc limit ${values.length}`;
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
function inferCollections(product = {}) {
  const text = [product.category, product.type, product.name, product.description, product.tags]
    .filter(Boolean).join(" ").toLowerCase();
  const explicit = Array.isArray(product.collections) ? product.collections.map(String) : [];
  if (explicit.length) return [...new Set(explicit)];
  if (/dulce|postre|tarta|pastel|reposter|brownie|galleta/.test(text)) return ["dulce"];
  if (/moda|ropa|textil|camisa|delantal/.test(text)) return ["moda"];
  if (/semilla/.test(text)) return ["semillas"];
  if (/sustrato|tierra/.test(text)) return ["sustratos"];
  if (/jardin/.test(text)) return ["jardineria"];
  if (/decor/.test(text)) return ["decoracion"];
  if (/servicio/.test(text)) return ["servicios"];
  return ["plantas"];
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
    return {
      id:String(row.id), name:row.name, scientificName:row.scientific_name||"", description:row.description||"",
      category:row.category||"plantas", type:row.type||"plant", price:num(row.price),
      originalPrice:row.compare_at_price==null?undefined:num(row.compare_at_price),
      compareAtPrice:row.compare_at_price==null?undefined:num(row.compare_at_price),
      onSale:Boolean(row.compare_at_price && num(row.compare_at_price)>num(row.price)),
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

export async function listNeonCommerceProducts({ collection = "", includeArchived = false } = {}) {
  if (!neonPool) return [];
  await ensureNeonCommerceDefaults();
  let sql="select distinct p.* from commerce_products p";
  const params=[];
  const where=[];
  if (collection) {
    sql+=" join commerce_product_collections pc on pc.product_id=p.id";
    params.push(String(collection)); where.push(`pc.collection_id=${params.length}`);
  }
  if (!includeArchived) where.push("p.status <> 'archived'");
  if (where.length) sql+=" where "+where.join(" and ");
  sql+=" order by p.created_at desc";
  const r=await neonPool.query(sql,params);
  return hydrateNeonProductRows(r.rows||[]);
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
  for(const key of ["humidity","growth","origin","potDiameter","height","careNotes","tags","barcode","supplierId"]){
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
