-- Herencia Market - Supabase schema
-- Ejecuta este SQL en Supabase Dashboard > SQL Editor si las tablas no existen.

create table if not exists public.app_storage (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id text primary key,
  customer_email text,
  customer_name text,
  payment_method text not null default 'manual',
  delivery_method text not null default 'envio',
  status text not null default 'pending',
  subtotal numeric not null default 0,
  shipping numeric not null default 0,
  total numeric not null default 0,
  items jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_customer_email_idx on public.orders (customer_email);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_app_storage_updated_at on public.app_storage;
create trigger set_app_storage_updated_at
before update on public.app_storage
for each row execute function public.set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

alter table public.app_storage enable row level security;
alter table public.orders enable row level security;

-- El backend usa SUPABASE_SERVICE_ROLE_KEY, por eso puede leer/escribir aunque RLS esté activo.
-- No abras políticas públicas para pedidos o ajustes privados.
