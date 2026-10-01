CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_storage (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_storage_updated_at_idx ON app_storage(updated_at DESC);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email text,
  customer_name text,
  payment_method text NOT NULL DEFAULT 'manual',
  delivery_method text NOT NULL DEFAULT 'envio',
  status text NOT NULL DEFAULT 'pending',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  shipping numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  stripe_payment_intent_id text,
  tracking_estado text,
  tracking_tiempo text,
  factura_url text,
  entrega_estimada text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_customer_email_idx ON orders(lower(customer_email));
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);

CREATE TABLE IF NOT EXISTS commerce_products (
  id text PRIMARY KEY,
  slug text UNIQUE,
  type text NOT NULL DEFAULT 'plant',
  name text NOT NULL,
  scientific_name text,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'plantas',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','archived')),
  featured boolean NOT NULL DEFAULT false,
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  compare_at_price numeric(12,2), cost numeric(12,2), tax_rate numeric(5,2) NOT NULL DEFAULT 21,
  sku text, track_inventory boolean NOT NULL DEFAULT true, stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  environment text, light text, size text, difficulty text, pet_safe boolean NOT NULL DEFAULT false,
  toxicity text, water text, temperature text, occasion text, allow_dedication boolean NOT NULL DEFAULT true,
  seo_title text, seo_description text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commerce_product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id text NOT NULL REFERENCES commerce_products(id) ON DELETE CASCADE,
  name text NOT NULL, sku text, price numeric(12,2), compare_at_price numeric(12,2), stock integer NOT NULL DEFAULT 0 CHECK(stock >= 0),
  position integer NOT NULL DEFAULT 0, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS commerce_product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id text NOT NULL REFERENCES commerce_products(id) ON DELETE CASCADE,
  url text NOT NULL, alt_text text NOT NULL DEFAULT '', position integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS commerce_collections (
  id text PRIMARY KEY, slug text NOT NULL UNIQUE, name text NOT NULL, description text NOT NULL DEFAULT '', image_url text,
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','archived')), sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS commerce_product_collections (
  product_id text NOT NULL REFERENCES commerce_products(id) ON DELETE CASCADE,
  collection_id text NOT NULL REFERENCES commerce_collections(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0, PRIMARY KEY(product_id,collection_id)
);
CREATE TABLE IF NOT EXISTS commerce_inventory_locations (
  id text PRIMARY KEY, name text NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS commerce_inventory_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id text NOT NULL REFERENCES commerce_products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES commerce_product_variants(id) ON DELETE CASCADE,
  location_id text NOT NULL REFERENCES commerce_inventory_locations(id) ON DELETE CASCADE,
  available integer NOT NULL DEFAULT 0, reserved integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS commerce_inventory_levels_variant_unique ON commerce_inventory_levels(product_id,variant_id,location_id) WHERE variant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS commerce_inventory_levels_base_unique ON commerce_inventory_levels(product_id,location_id) WHERE variant_id IS NULL;
CREATE TABLE IF NOT EXISTS commerce_stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cart_token text NOT NULL, product_id text NOT NULL REFERENCES commerce_products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES commerce_product_variants(id) ON DELETE CASCADE, quantity integer NOT NULL CHECK(quantity > 0),
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','consumed','released','expired')),
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS commerce_coupons (
  code text PRIMARY KEY, name text NOT NULL, type text NOT NULL CHECK(type IN ('percent','fixed','free_shipping')),
  value numeric(12,2) NOT NULL DEFAULT 0, minimum_subtotal numeric(12,2) NOT NULL DEFAULT 0, max_uses integer,
  uses_count integer NOT NULL DEFAULT 0, starts_at timestamptz, ends_at timestamptz, active boolean NOT NULL DEFAULT true,
  collection_ids text[] NOT NULL DEFAULT '{}', product_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS commerce_payment_events (
  provider text NOT NULL, event_id text NOT NULL, event_type text, order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb, processed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(provider,event_id)
);
CREATE INDEX IF NOT EXISTS commerce_products_status_idx ON commerce_products(status);
CREATE INDEX IF NOT EXISTS commerce_products_category_idx ON commerce_products(category);
CREATE INDEX IF NOT EXISTS commerce_products_sku_idx ON commerce_products(sku);
CREATE INDEX IF NOT EXISTS commerce_variants_product_idx ON commerce_product_variants(product_id);
CREATE INDEX IF NOT EXISTS commerce_images_product_idx ON commerce_product_images(product_id,position);
CREATE INDEX IF NOT EXISTS commerce_product_collections_collection_idx ON commerce_product_collections(collection_id,position);
CREATE INDEX IF NOT EXISTS commerce_reservations_expiry_idx ON commerce_stock_reservations(status,expires_at);

INSERT INTO commerce_inventory_locations(id,name) VALUES('tienda','Tienda') ON CONFLICT(id) DO NOTHING;
INSERT INTO commerce_collections(id,slug,name,sort_order) VALUES
 ('plantas','plantas','Plantas',10),('semillas','semillas','Semillas',20),('jardineria','jardineria','Jardinería',30),
 ('sustratos','tierra-y-sustratos','Tierra y sustratos',40),('decoracion','decoracion','Decoración',50),
 ('dulce','dulce','Dulce',60),('moda','moda','Moda',70),('servicios','servicios','Servicios',80)
ON CONFLICT(id) DO UPDATE SET name=excluded.name,slug=excluded.slug,sort_order=excluded.sort_order;
