-- NEXORA · 0020 · Países globales (Binance) + saldo sin límite
-- VE y DO compran directo con métodos de su país. El resto del mundo ("GL") compra con saldo.
alter table profiles drop constraint if exists profiles_country_check;
alter table profiles add constraint profiles_country_check check (country is null or country ~ '^[A-Z]{2}$');
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare v_user text := nullif(new.raw_user_meta_data->>'username',''); v_country text := nullif(upper(new.raw_user_meta_data->>'country'),'');
begin
  if v_country is not null and v_country !~ '^[A-Z]{2}$' then v_country := null; end if;
  insert into profiles (id, display_name, username, country) values (new.id, coalesce(v_user, split_part(new.email,'@',1)), v_user, v_country);
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
alter table payment_methods drop constraint if exists payment_methods_country_check;
update payment_methods set active = false, country = 'GL' where country not in ('VE','DO');
alter table payment_methods add constraint payment_methods_country_check check (country in ('VE','DO','GL'));
alter table product_prices drop constraint if exists product_prices_country_check;
insert into product_prices (product_id, country, price_usd) select p.id, 'GL', coalesce((select price_usd from product_prices x where x.product_id = p.id and x.country = 'US'), (select price_usd from product_prices x where x.product_id = p.id and x.country = 'VE'), p.price_usd) from products p on conflict (product_id, country) do nothing;
delete from product_prices where country not in ('VE','DO','GL');
alter table product_prices add constraint product_prices_country_check check (country in ('VE','DO','GL'));
create or replace function products_fill_prices() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into product_prices (product_id, country, price_usd) select new.id, c, new.price_usd from unnest(array['VE','DO','GL']) c on conflict (product_id, country) do nothing;
  return new;
end $$;
revoke execute on function public.products_fill_prices() from public, anon, authenticated;
drop function if exists create_order(uuid, uuid, jsonb, text, boolean);
create or replace function create_order(p_user uuid, p_product uuid, p_player jsonb, p_coupon text default null, p_use_coins boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_prod record; v_rate record; v_cpn coupons%rowtype; v_country text; v_zone text; v_cur text; v_price numeric;
  v_disc numeric := 0; v_final numeric; v_cid uuid; v_order orders%rowtype; v_have int; v_max int; v_use int := 0;
begin
  select country, coins into v_country, v_have from profiles where id = p_user and not banned;
  if not found then raise exception 'cuenta_suspendida'; end if;
  if v_country is null then raise exception 'pais_requerido'; end if;
  v_zone := case when v_country in ('VE','DO') then v_country else 'GL' end;
  select p.id, p.game_id into v_prod from products p join games g on g.id = p.game_id where p.id = p_product and p.status = 'active' and g.status = 'active';
  if not found then raise exception 'producto_no_disponible'; end if;
  select price_usd into v_price from product_prices where product_id = p_product and country = v_zone;
  if v_price is null then raise exception 'producto_no_disponible'; end if;
  v_cur := country_currency(v_zone);
  if v_cur <> 'USD' then select id, rate into v_rate from exchange_rates where quote = v_cur order by fetched_at desc limit 1; end if;
  if p_coupon is not null and length(trim(p_coupon)) > 0 then
    select * into v_cpn from coupons where lower(code) = lower(trim(p_coupon)) for update;
    if not found or not v_cpn.active or (v_cpn.expires_at is not null and v_cpn.expires_at < now()) or (v_cpn.max_uses is not null and v_cpn.used_count >= v_cpn.max_uses) or (v_cpn.game_id is not null and v_cpn.game_id <> v_prod.game_id) or v_price < v_cpn.min_amount_usd then
      raise exception 'cupon_invalido';
    end if;
    if exists (select 1 from orders where user_id = p_user and coupon_id = v_cpn.id and status not in ('rejected','refunded')) then raise exception 'cupon_usado'; end if;
    if v_cpn.kind = 'percent' then v_disc := round(v_price * v_cpn.value / 100, 2); else v_disc := least(v_cpn.value, v_price); end if;
    v_cid := v_cpn.id;
    update coupons set used_count = used_count + 1 where id = v_cid;
  end if;
  if p_use_coins and v_have > 0 then
    v_max := floor((v_price - v_disc) * 0.25 * 100)::int;
    v_use := least(v_have, greatest(v_max, 0));
    if v_use > 0 then
      update profiles set coins = coins - v_use where id = p_user and coins >= v_use;
      if not found then raise exception 'coins_insuficientes'; end if;
      v_disc := v_disc + v_use * 0.01;
    end if;
  end if;
  v_final := greatest(v_price - v_disc, 0);
  insert into orders (user_id, product_id, amount_usd, discount_usd, coupon_id, rate_id, rate_applied, player_details, status, country, coins_used)
  values (p_user, v_prod.id, v_final, v_disc, v_cid, v_rate.id, v_rate.rate, coalesce(p_player, '{}'::jsonb), 'pending', v_zone, v_use) returning * into v_order;
  return jsonb_build_object('order_id', v_order.id, 'status', v_order.status, 'amount_usd', v_order.amount_usd, 'discount_usd', v_disc, 'country', v_zone, 'coins_used', v_use);
end $$;
revoke all on function create_order(uuid, uuid, jsonb, text, boolean) from public, anon, authenticated;
grant execute on function create_order(uuid, uuid, jsonb, text, boolean) to service_role;
alter table topups drop constraint if exists topups_amount_usd_check;
alter table topups add constraint topups_amount_usd_check check (amount_usd >= 1);
create or replace function topup_create(p_user uuid, p_amount numeric, p_method uuid, p_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_country text; v_mzone text;
begin
  select country into v_country from profiles where id = p_user and not banned;
  if not found then raise exception 'cuenta_suspendida'; end if;
  if p_amount is null or p_amount < 1 then raise exception 'monto_invalido'; end if;
  select country into v_mzone from payment_methods where id = p_method and active;
  if v_mzone is null or v_mzone <> (case when v_country in ('VE','DO') then v_country else 'GL' end) then raise exception 'metodo_no_disponible'; end if;
  if (select count(*) from topups where user_id = p_user and status = 'pending') >= 3 then raise exception 'demasiadas_recargas'; end if;
  begin
    insert into topups (user_id, method_id, amount_usd, reference) values (p_user, p_method, round(p_amount, 2), trim(p_ref)) returning id into v_id;
  exception when unique_violation then raise exception 'referencia_repetida';
  end;
  return jsonb_build_object('topup_id', v_id, 'status', 'pending', 'amount_usd', round(p_amount, 2));
end $$;
revoke all on function topup_create(uuid, numeric, uuid, text) from public, anon, authenticated;
grant execute on function topup_create(uuid, numeric, uuid, text) to service_role;
notify pgrst, 'reload schema';
