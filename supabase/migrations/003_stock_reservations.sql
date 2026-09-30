-- Atomic stock reservations for Herencia Commerce Core.
-- This migration is additive and safe to apply after 002_commerce_core.sql.

create or replace function public.reserve_commerce_stock(
  p_cart_token text,
  p_items jsonb,
  p_ttl_minutes integer default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  p_id text;
  v_name text;
  qty integer;
  variant_row public.commerce_product_variants%rowtype;
  product_row public.commerce_products%rowtype;
  reserved_qty integer;
  expires_at_value timestamptz := now() + make_interval(mins => greatest(1, least(coalesce(p_ttl_minutes, 15), 60)));
begin
  if coalesce(trim(p_cart_token), '') = '' then
    raise exception 'reservation_token_required';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'reservation_items_required';
  end if;

  update public.commerce_stock_reservations
    set status = 'expired', updated_at = now()
  where status = 'active' and expires_at <= now();

  delete from public.commerce_stock_reservations
  where cart_token = p_cart_token and status = 'active';

  for item in select * from jsonb_array_elements(p_items)
  loop
    p_id := trim(coalesce(item->>'productId', item->>'id', ''));
    v_name := trim(coalesce(item->>'variantName', item->>'selectedVariant', ''));
    qty := greatest(0, floor(coalesce((item->>'quantity')::numeric, (item->>'qty')::numeric, 0))::integer);

    if p_id = '' or qty <= 0 then
      raise exception 'reservation_item_invalid';
    end if;

    select * into product_row
    from public.commerce_products
    where id = p_id and status = 'active'
    for update;

    if not found then
      raise exception 'product_unavailable:%', p_id;
    end if;

    if v_name <> '' then
      select * into variant_row
      from public.commerce_product_variants
      where product_id = p_id and name = v_name
      for update;

      if not found then
        raise exception 'variant_unavailable:%:%', p_id, v_name;
      end if;

      select coalesce(sum(r.quantity), 0)::integer into reserved_qty
      from public.commerce_stock_reservations r
      where r.product_id = p_id
        and r.variant_id = variant_row.id
        and r.status = 'active'
        and r.expires_at > now();

      if variant_row.stock - reserved_qty < qty then
        raise exception 'stock_insufficient:%:%:%', p_id, v_name, greatest(0, variant_row.stock - reserved_qty);
      end if;

      insert into public.commerce_stock_reservations(
        cart_token, product_id, variant_id, quantity, status, expires_at, created_at, updated_at
      ) values (
        p_cart_token, p_id, variant_row.id, qty, 'active', expires_at_value, now(), now()
      );
    else
      select coalesce(sum(r.quantity), 0)::integer into reserved_qty
      from public.commerce_stock_reservations r
      where r.product_id = p_id
        and r.variant_id is null
        and r.status = 'active'
        and r.expires_at > now();

      if product_row.stock - reserved_qty < qty then
        raise exception 'stock_insufficient:%:base:%', p_id, greatest(0, product_row.stock - reserved_qty);
      end if;

      insert into public.commerce_stock_reservations(
        cart_token, product_id, variant_id, quantity, status, expires_at, created_at, updated_at
      ) values (
        p_cart_token, p_id, null, qty, 'active', expires_at_value, now(), now()
      );
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'cartToken', p_cart_token,
    'expiresAt', expires_at_value,
    'reservedItems', jsonb_array_length(p_items)
  );
end;
$$;

create or replace function public.consume_commerce_stock_reservation(p_cart_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_record record;
  consumed_count integer := 0;
begin
  for row_record in
    select r.*
    from public.commerce_stock_reservations r
    where r.cart_token = p_cart_token
      and r.status = 'active'
      and r.expires_at > now()
    order by r.created_at
    for update
  loop
    if row_record.variant_id is not null then
      update public.commerce_product_variants
      set stock = greatest(0, stock - row_record.quantity), updated_at = now()
      where id = row_record.variant_id
        and product_id = row_record.product_id
        and stock >= row_record.quantity;
      if not found then
        raise exception 'stock_commit_failed:%', row_record.product_id;
      end if;
    else
      update public.commerce_products
      set stock = greatest(0, stock - row_record.quantity), updated_at = now()
      where id = row_record.product_id
        and stock >= row_record.quantity;
      if not found then
        raise exception 'stock_commit_failed:%', row_record.product_id;
      end if;
    end if;

    update public.commerce_stock_reservations
    set status = 'consumed', updated_at = now()
    where id = row_record.id;

    consumed_count := consumed_count + 1;
  end loop;

  return jsonb_build_object('ok', true, 'consumed', consumed_count);
end;
$$;

create or replace function public.release_commerce_stock_reservation(p_cart_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  released_count integer;
begin
  update public.commerce_stock_reservations
  set status = 'released', updated_at = now()
  where cart_token = p_cart_token and status = 'active';

  get diagnostics released_count = row_count;
  return jsonb_build_object('ok', true, 'released', released_count);
end;
$$;

create or replace function public.restock_commerce_stock(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $
declare
  item jsonb;
  p_id text;
  v_name text;
  qty integer;
  variant_id_value uuid;
  restored_count integer := 0;
begin
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'restock_items_required';
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    p_id := trim(coalesce(item->>'productId', item->>'id', ''));
    v_name := trim(coalesce(item->>'variantName', item->>'selectedVariant', ''));
    qty := greatest(0, floor(coalesce((item->>'quantity')::numeric, (item->>'qty')::numeric, 0))::integer);
    if p_id = '' or qty <= 0 then continue; end if;

    if v_name <> '' then
      select id into variant_id_value
      from public.commerce_product_variants
      where product_id = p_id and name = v_name
      for update;

      if variant_id_value is not null then
        update public.commerce_product_variants
        set stock = stock + qty, updated_at = now()
        where id = variant_id_value;
        restored_count := restored_count + 1;
      end if;
    else
      update public.commerce_products
      set stock = stock + qty, updated_at = now()
      where id = p_id;
      if found then restored_count := restored_count + 1; end if;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'restored', restored_count);
end;
$;

revoke all on function public.reserve_commerce_stock(text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.consume_commerce_stock_reservation(text) from public, anon, authenticated;
revoke all on function public.release_commerce_stock_reservation(text) from public, anon, authenticated;
revoke all on function public.restock_commerce_stock(jsonb) from public, anon, authenticated;

grant execute on function public.reserve_commerce_stock(text, jsonb, integer) to service_role;
grant execute on function public.consume_commerce_stock_reservation(text) to service_role;
grant execute on function public.release_commerce_stock_reservation(text) to service_role;
grant execute on function public.restock_commerce_stock(jsonb) to service_role;
