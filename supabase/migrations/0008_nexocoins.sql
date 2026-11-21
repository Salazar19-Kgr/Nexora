-- NEXORA · 0008 · NexoCoins: monedas de la ruleta y de los códigos; cada una da un mini descuento al comprar
-- 1 NexoCoin = $0.01 de descuento, hasta un máximo del 25 % del precio del pedido.
-- Se puede ejecutar más de una vez sin problema.

alter table profiles add column if not exists coins int not null default 0 check (coins >= 0);
alter table orders add column if not exists coins_used int not null default 0 check (coins_used >= 0);

alter table wheel_prizes drop constraint if exists wheel_prizes_prize_type_check;
alter table wheel_prizes add constraint wheel_prizes_prize_type_check check (prize_type in ('none','balance','points','spins','coins'));
alter table redeem_codes drop constraint if exists redeem_codes_reward_type_check;
alter table redeem_codes add constraint redeem_codes_reward_type_check check (reward_type in ('balance','points','spins','coins'));

-- Canjear código (ahora también regala NexoCoins)
create or replace function redeem_code(p_user uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v redeem_codes%rowtype;
begin
  if exists (select 1 from profiles where id = p_user and banned) then raise exception 'cuenta_suspendida'; end if;
  select * into v from redeem_codes where lower(code) = lower(trim(p_code)) for update;
  if not found or not v.active
     or (v.expires_at is not null and v.expires_at < now())
     or (v.max_uses is not null and v.used_count >= v.max_uses) then
    raise exception 'codigo_invalido';
  end if;
  if exists (select 1 from redemptions where code_id = v.id and user_id = p_user) then
    raise exception 'codigo_ya_usado';
  end if;
  insert into redemptions (code_id, user_id) values (v.id, p_user);
  update redeem_codes set used_count = used_count + 1 where id = v.id;
  if v.reward_type = 'balance' then update profiles set balance_usd = balance_usd + v.reward_value where id = p_user;
  elsif v.reward_type = 'points' then update profiles set points = points + trunc(v.reward_value)::int where id = p_user;
  elsif v.reward_type = 'coins' then update profiles set coins = coins + trunc(v.reward_value)::int where id = p_user;
  else update profiles set spins = spins + trunc(v.reward_value)::int where id = p_user;
  end if;
  return jsonb_build_object('reward_type', v.reward_type, 'reward_value', v.reward_value);
end $$;

-- Girar la ruleta (ahora también puede dar NexoCoins)
create or replace function spin_wheel(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_total int; v_r int; v_acc int := 0; v_prize wheel_prizes%rowtype;
begin
  update profiles set spins = spins - 1 where id = p_user and spins > 0 and not banned;
  if not found then raise exception 'sin_giros'; end if;
  select coalesce(sum(weight), 0) into v_total from wheel_prizes where active;
  if v_total = 0 then raise exception 'ruleta_vacia'; end if;
  v_r := (('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint % v_total)::int;
  for v_prize in select * from wheel_prizes where active order by created_at, id loop
    v_acc := v_acc + v_prize.weight;
    if v_r < v_acc then exit; end if;
  end loop;
  if v_prize.prize_type = 'balance' then update profiles set balance_usd = balance_usd + v_prize.value where id = p_user;
  elsif v_prize.prize_type = 'points' then update profiles set points = points + trunc(v_prize.value)::int where id = p_user;
  elsif v_prize.prize_type = 'coins' then update profiles set coins = coins + trunc(v_prize.value)::int where id = p_user;
  elsif v_prize.prize_type = 'spins' then update profiles set spins = spins + trunc(v_prize.value)::int where id = p_user;
  end if;
  insert into spin_results (user_id, prize_id, label, prize_type, value)
  values (p_user, v_prize.id, v_prize.label, v_prize.prize_type, v_prize.value);
  return jsonb_build_object('prize_id', v_prize.id, 'label', v_prize.label,
                            'prize_type', v_prize.prize_type, 'value', v_prize.value);
end $$;

-- Ajuste manual del administrador
create or replace function admin_adjust(p_user uuid, p_kind text, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r profiles%rowtype;
begin
  if p_kind = 'balance' then update profiles set balance_usd = balance_usd + p_amount where id = p_user returning * into r;
  elsif p_kind = 'points' then update profiles set points = points + trunc(p_amount)::int where id = p_user returning * into r;
  elsif p_kind = 'coins' then update profiles set coins = coins + trunc(p_amount)::int where id = p_user returning * into r;
  elsif p_kind = 'spins' then update profiles set spins = spins + trunc(p_amount)::int where id = p_user returning * into r;
  else raise exception 'tipo_invalido'; end if;
  if not found then raise exception 'usuario_no_existe'; end if;
  return jsonb_build_object('balance_usd', r.balance_usd, 'points', r.points, 'spins', r.spins, 'coins', r.coins);
end $$;

-- Crear pedido: ahora acepta usar NexoCoins como descuento.
drop function if exists create_order(uuid, uuid, jsonb, text);
create or replace function create_order(p_user uuid, p_product uuid, p_player jsonb, p_coupon text default null, p_use_coins boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_prod record; v_rate record; v_cpn coupons%rowtype; v_country text; v_cur text; v_price numeric;
  v_disc numeric := 0; v_final numeric; v_cid uuid; v_order orders%rowtype;
  v_have int; v_max int; v_use int := 0;
begin
  select country, coins into v_country, v_have from profiles where id = p_user and not banned;
  if not found then raise exception 'cuenta_suspendida'; end if;
  if v_country is null then raise exception 'pais_requerido'; end if;

  select p.id, p.game_id into v_prod
  from products p join games g on g.id = p.game_id
  where p.id = p_product and p.status = 'active' and g.status = 'active';
  if not found then raise exception 'producto_no_disponible'; end if;

  select price_usd into v_price from product_prices where product_id = p_product and country = v_country;
  if v_price is null then raise exception 'producto_no_disponible'; end if;

  v_cur := country_currency(v_country);
  if v_cur <> 'USD' then
    select id, rate into v_rate from exchange_rates where quote = v_cur order by fetched_at desc limit 1;
  end if;

  if p_coupon is not null and length(trim(p_coupon)) > 0 then
    select * into v_cpn from coupons where lower(code) = lower(trim(p_coupon)) for update;
    if not found or not v_cpn.active
       or (v_cpn.expires_at is not null and v_cpn.expires_at < now())
       or (v_cpn.max_uses is not null and v_cpn.used_count >= v_cpn.max_uses)
       or (v_cpn.game_id is not null and v_cpn.game_id <> v_prod.game_id)
       or v_price < v_cpn.min_amount_usd then
      raise exception 'cupon_invalido';
    end if;
    if exists (select 1 from orders where user_id = p_user and coupon_id = v_cpn.id and status not in ('rejected','refunded')) then
      raise exception 'cupon_usado';
    end if;
    if v_cpn.kind = 'percent' then v_disc := round(v_price * v_cpn.value / 100, 2);
    else v_disc := least(v_cpn.value, v_price); end if;
    v_cid := v_cpn.id;
    update coupons set used_count = used_count + 1 where id = v_cid;
  end if;

  -- NexoCoins: 1 moneda = $0.01, máximo 25 % de lo que queda por pagar.
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
  values (p_user, v_prod.id, v_final, v_disc, v_cid, v_rate.id, v_rate.rate, coalesce(p_player, '{}'::jsonb), 'pending', v_country, v_use)
  returning * into v_order;

  return jsonb_build_object('order_id', v_order.id, 'status', v_order.status,
                            'amount_usd', v_order.amount_usd, 'discount_usd', v_disc, 'country', v_country, 'coins_used', v_use);
end $$;

revoke all on function redeem_code(uuid, text), spin_wheel(uuid), admin_adjust(uuid, text, numeric),
  create_order(uuid, uuid, jsonb, text, boolean) from public, anon, authenticated;
grant execute on function redeem_code(uuid, text), spin_wheel(uuid), admin_adjust(uuid, text, numeric),
  create_order(uuid, uuid, jsonb, text, boolean) to service_role;

notify pgrst, 'reload schema';
