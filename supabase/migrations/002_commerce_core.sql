-- Herencia Commerce Core
-- Normalized catalog, collections, variants, media, inventory, coupons and stock reservations.
create extension if not exists pgcrypto;

create table if not exists public.commerce_products (
  id text primary key,
  slug text unique,
  type text not null default 'plant',
  name text not null,
  scientific_name text,
  description text not null default '',
  category text not null default 'plantas',
  status text not null default 'active' check (status in ('draft','active','archived')),
  featured boolean not null default false,
  price numeric(12,2) not null default 0 check (price >= 0),
  compare_at_price numeric(12,2),
  cost numeric(12,2),
  tax_rate numeric(5,2) not null default 21,
  sku text,
  track_inventory boolean not null default true,
  stock integer not null default 0 check (stock >= 0),
  environment text,
  light text,
  size text,
  difficulty text,
  pet_safe boolean not null default false,
  toxicity text,
  water text,
  temperature text,
  occasion text,
  allow_dedication boolean not null default true,
  seo_title text,
  seo_description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.commerce_products(id) on delete cascade,
  name text not null,
  sku text,
  price numeric(12,2),
  compare_at_price numeric(12,2),
  stock integer not null default 0 check (stock >= 0),
  position integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.commerce_products(id) on delete cascade,
  url text not null,
  alt_text text not null default '',
  position integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.commerce_collections (
  id text primary key,
  slug text not null unique,
  name text not null,
  description text not null default '',
  image_url text,
  status text not null default 'active' check (status in ('draft','active','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_product_collections (
  product_id text not null references public.commerce_products(id) on delete cascade,
  collection_id text not null references public.commerce_collections(id) on delete cascade,
  position integer not null default 0,
  primary key (product_id, collection_id)
);

create table if not exists public.commerce_inventory_locations (
  id text primary key,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.commerce_inventory_levels (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.commerce_products(id) on delete cascade,
  variant_id uuid references public.commerce_product_variants(id) on delete cascade,
  location_id text not null references public.commerce_inventory_locations(id) on delete cascade,
  available integer not null default 0,
  reserved integer not null default 0,
  updated_at timestamptz not null default now()
);

create unique index if not exists commerce_inventory_levels_variant_unique
  on public.commerce_inventory_levels(product_id, variant_id, location_id)
  where variant_id is not null;

create unique index if not exists commerce_inventory_levels_base_unique
  on public.commerce_inventory_levels(product_id, location_id)
  where variant_id is null;

create table if not exists public.commerce_stock_reservations (
  id uuid primary key default gen_random_uuid(),
  cart_token text not null,
  product_id text not null references public.commerce_products(id) on delete cascade,
  variant_id uuid references public.commerce_product_variants(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  status text not null default 'active' check (status in ('active','consumed','released','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_coupons (
  code text primary key,
  name text not null,
  type text not null check (type in ('percent','fixed','free_shipping')),
  value numeric(12,2) not null default 0,
  minimum_subtotal numeric(12,2) not null default 0,
  max_uses integer,
  uses_count integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  collection_ids text[] not null default '{}',
  product_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commerce_payment_events (
  provider text not null,
  event_id text not null,
  event_type text,
  order_id uuid references public.orders(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  primary key (provider, event_id)
);

create index if not exists commerce_products_status_idx on public.commerce_products(status);
create index if not exists commerce_products_category_idx on public.commerce_products(category);
create index if not exists commerce_products_sku_idx on public.commerce_products(sku);
create index if not exists commerce_variants_product_idx on public.commerce_product_variants(product_id);
create index if not exists commerce_images_product_idx on public.commerce_product_images(product_id, position);
create index if not exists commerce_product_collections_collection_idx on public.commerce_product_collections(collection_id, position);
create index if not exists commerce_reservations_expiry_idx on public.commerce_stock_reservations(status, expires_at);

insert into public.commerce_inventory_locations(id, name)
values ('tienda', 'Tienda')
on conflict (id) do nothing;

insert into public.commerce_collections(id, slug, name, sort_order) values
  ('plantas','plantas','Plantas',10),
  ('semillas','semillas','Semillas',20),
  ('jardineria','jardineria','Jardinería',30),
  ('sustratos','tierra-y-sustratos','Tierra y sustratos',40),
  ('decoracion','decoracion','Decoración',50),
  ('dulce','dulce','Dulce',60),
  ('moda','moda','Moda',70),
  ('servicios','servicios','Servicios',80)
on conflict (id) do update set name=excluded.name, slug=excluded.slug, sort_order=excluded.sort_order;

alter table public.commerce_products enable row level security;
alter table public.commerce_product_variants enable row level security;
alter table public.commerce_product_images enable row level security;
alter table public.commerce_collections enable row level security;
alter table public.commerce_product_collections enable row level security;
alter table public.commerce_inventory_locations enable row level security;
alter table public.commerce_inventory_levels enable row level security;
alter table public.commerce_stock_reservations enable row level security;
alter table public.commerce_coupons enable row level security;
alter table public.commerce_payment_events enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'commerce_products','commerce_product_variants','commerce_product_images',
    'commerce_collections','commerce_product_collections','commerce_inventory_locations',
    'commerce_inventory_levels','commerce_stock_reservations','commerce_coupons','commerce_payment_events'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename=t and policyname='service role full access'
    ) then
      execute format(
        'create policy %I on public.%I for all using (auth.role() = %L) with check (auth.role() = %L)',
        'service role full access', t, 'service_role', 'service_role'
      );
    end if;
  end loop;
end $$;
