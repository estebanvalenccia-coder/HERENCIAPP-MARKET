-- Backfill normalized Commerce Core from the existing adminProducts storage.
-- Safe to re-run because product IDs and collection joins are upserted.

with legacy as (
  select elem as product
  from public.app_storage s
  cross join lateral jsonb_array_elements(
    case
      when s.key = 'adminProducts' and jsonb_typeof(s.value::jsonb) = 'array' then s.value::jsonb
      else '[]'::jsonb
    end
  ) elem
  where s.key = 'adminProducts'
),
normalized as (
  select
    coalesce(nullif(product->>'id',''), gen_random_uuid()::text) as id,
    product
  from legacy
)
insert into public.commerce_products (
  id, slug, type, name, scientific_name, description, category, status, featured,
  price, compare_at_price, cost, tax_rate, sku, track_inventory, stock,
  environment, light, size, difficulty, pet_safe, toxicity, water, temperature,
  occasion, allow_dedication, seo_title, seo_description, metadata, created_at, updated_at
)
select
  id,
  left(
    trim(both '-' from regexp_replace(lower(coalesce(nullif(product->>'name',''), id)), '[^a-z0-9]+', '-', 'g')),
    72
  ) || '-' || left(regexp_replace(id, '[^a-zA-Z0-9]+', '', 'g'), 12),
  case
    when lower(coalesce(product->>'category','')) ~ '(dulce|postre|tarta|pastel|brownie|galleta|reposter)' then 'food'
    when lower(coalesce(product->>'category','')) ~ '(moda|textil|ropa|camisa|delantal|guante)' then 'fashion'
    when lower(coalesce(product->>'category','')) ~ '(servicio)' then 'service'
    when lower(coalesce(product->>'category','')) ~ '(decor)' then 'decor'
    when lower(coalesce(product->>'category','')) ~ '(jardin|semilla|sustrato|tierra)' then 'garden'
    else coalesce(nullif(product->>'type',''), 'plant')
  end,
  coalesce(nullif(product->>'name',''), 'Producto Herencia'),
  nullif(coalesce(product->>'scientificName', product->>'scientific_name'), ''),
  coalesce(product->>'description',''),
  coalesce(nullif(product->>'category',''), 'plantas'),
  case
    when nullif(product->>'deletedAt','') is not null then 'archived'
    when lower(coalesce(product->>'active','true')) = 'false' then 'draft'
    else 'active'
  end,
  lower(coalesce(product->>'featured','false')) = 'true',
  case when coalesce(product->>'price','') ~ '^-?[0-9]+([.][0-9]+)?$' then greatest(0,(product->>'price')::numeric) else 0 end,
  case
    when coalesce(product->>'originalPrice', product->>'compareAtPrice','') ~ '^-?[0-9]+([.][0-9]+)?$'
      then greatest(0,coalesce(product->>'originalPrice', product->>'compareAtPrice')::numeric)
    else null
  end,
  case when coalesce(product->>'cost','') ~ '^-?[0-9]+([.][0-9]+)?$' then greatest(0,(product->>'cost')::numeric) else null end,
  case when coalesce(product->>'iva', product->>'taxRate','') ~ '^-?[0-9]+([.][0-9]+)?$' then greatest(0,coalesce(product->>'iva', product->>'taxRate')::numeric) else 21 end,
  nullif(product->>'sku',''),
  true,
  case when coalesce(product->>'stock','') ~ '^-?[0-9]+$' then greatest(0,(product->>'stock')::integer) else 0 end,
  nullif(product->>'environment',''),
  nullif(product->>'light',''),
  nullif(product->>'size',''),
  nullif(product->>'difficulty',''),
  lower(coalesce(product->>'petSafe','false')) = 'true',
  nullif(product->>'toxicity',''),
  nullif(product->>'water',''),
  nullif(product->>'temperature',''),
  nullif(product->>'occasion',''),
  lower(coalesce(product->>'allowDedication','true')) <> 'false',
  nullif(coalesce(product->>'seoTitle', product->>'name'),''),
  nullif(coalesce(product->>'seoDescription', product->>'description'),''),
  product,
  coalesce(nullif(product->>'createdAt','')::timestamptz, now()),
  now()
from normalized
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  status = excluded.status,
  featured = excluded.featured,
  price = excluded.price,
  compare_at_price = excluded.compare_at_price,
  cost = excluded.cost,
  tax_rate = excluded.tax_rate,
  sku = excluded.sku,
  stock = excluded.stock,
  metadata = excluded.metadata,
  updated_at = now();

with catalog as (
  select
    p.id,
    lower(
      concat_ws(' ',
        p.name,
        p.category,
        p.description,
        p.metadata->>'tags'
      )
    ) as searchable
  from public.commerce_products p
)
insert into public.commerce_product_collections(product_id, collection_id, position)
select
  id,
  case
    when searchable ~ '(dulce|postre|tarta|pastel|brownie|galleta|desayuno|reposter)' then 'dulce'
    when searchable ~ '(moda|textil|camisa|delantal|guante|ropa|uniforme)' then 'moda'
    when searchable ~ '(semilla)' then 'semillas'
    when searchable ~ '(sustrato|tierra)' then 'sustratos'
    when searchable ~ '(jardin)' then 'jardineria'
    when searchable ~ '(decor)' then 'decoracion'
    when searchable ~ '(servicio)' then 'servicios'
    else 'plantas'
  end,
  0
from catalog
on conflict (product_id, collection_id) do nothing;

insert into public.commerce_product_images(product_id, url, alt_text, position, is_primary)
select
  p.id,
  p.metadata->>'image',
  p.name,
  0,
  true
from public.commerce_products p
where nullif(p.metadata->>'image','') is not null
  and not exists (
    select 1 from public.commerce_product_images i
    where i.product_id = p.id
  );

with variant_source as (
  select
    p.id as product_id,
    v.value as variant,
    v.ordinality - 1 as position
  from public.commerce_products p
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(p.metadata->'variants') = 'array' then p.metadata->'variants' else '[]'::jsonb end
  ) with ordinality as v(value, ordinality)
)
insert into public.commerce_product_variants(product_id, name, sku, price, stock, position, metadata)
select
  product_id,
  coalesce(nullif(variant->>'name',''), 'Variante'),
  nullif(variant->>'sku',''),
  case when coalesce(variant->>'price','') ~ '^-?[0-9]+([.][0-9]+)?$' then greatest(0,(variant->>'price')::numeric) else null end,
  case when coalesce(variant->>'stock','') ~ '^-?[0-9]+$' then greatest(0,(variant->>'stock')::integer) else 0 end,
  position::integer,
  variant
from variant_source
where not exists (
  select 1
  from public.commerce_product_variants existing
  where existing.product_id = variant_source.product_id
    and existing.name = coalesce(nullif(variant_source.variant->>'name',''), 'Variante')
);
