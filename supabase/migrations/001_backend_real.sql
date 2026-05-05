create extension if not exists pgcrypto;

create table if not exists public.app_storage (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_email text,
  customer_name text,
  payment_method text not null default 'manual',
  delivery_method text not null default 'envio',
  status text not null default 'pending',
  subtotal numeric(12,2) not null default 0,
  shipping numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_storage enable row level security;
alter table public.orders enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'app_storage' and policyname = 'service role full app_storage') then
    create policy "service role full app_storage" on public.app_storage for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and policyname = 'service role full orders') then
    create policy "service role full orders" on public.orders for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
end $$;
