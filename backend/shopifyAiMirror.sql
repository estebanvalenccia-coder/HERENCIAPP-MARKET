-- Solo espejo para IA. No modifica commerce_products, precios ni pedidos en Neon.
CREATE TABLE IF NOT EXISTS public.shopify_ai_products (
 shop_domain text NOT NULL,
 shopify_gid text NOT NULL,
 herencia_product_id text NULL REFERENCES public.commerce_products(id) ON DELETE SET NULL,
 handle text NOT NULL,
 shopify_status text NOT NULL,
 shopify_updated_at timestamptz NOT NULL,
 snapshot jsonb NOT NULL,
 synced_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(shop_domain,shopify_gid)
);
CREATE UNIQUE INDEX IF NOT EXISTS shopify_ai_products_link_unique
 ON public.shopify_ai_products (shop_domain,herencia_product_id)
 WHERE herencia_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS shopify_ai_products_handle_idx
 ON public.shopify_ai_products(shop_domain,handle);
CREATE TABLE IF NOT EXISTS public.shopify_ai_webhook_events (
 shop_domain text NOT NULL,
 event_id text NOT NULL,
 topic text NOT NULL,
 processed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(shop_domain,event_id)
);
-- No se otorga acceso anónimo ni se publican tablas por API REST.
-- Solo el backend de Railway consulta/escribe aquí.
