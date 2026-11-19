-- NEXORA · 0004 · Administración, cupones, códigos de canje y ruleta
-- Pega TODO este archivo en Supabase > SQL Editor > Run. Se puede repetir sin problema.

-- ---------- Perfiles: saldo, puntos, giros y suspensión ----------
alter table profiles add column if not exists balance_usd numeric(14,2) not null default 0 check (balance_usd >= 0);
alter table profiles add column if not exists points int not null default 0 check (points >= 0);
alter table profiles add column if not exists spins int not null default 0 check (spins >= 0);
alter table profiles add column if not exists banned boolean not null default false;

-- ---------- Cupones de descuento (se aplican al comprar) ----------
create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  kind text not null check (kind in ('percent','fixed')),
  value numeric(10,2) not null check (value > 0),
  min_amount_usd numeric(10,2) not null default 0,
  max_uses int check (max_uses is null or max_uses > 0),
  used_count int not null default 0,
  game_id uuid references games(id),
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint coupon_pct check (kind <> 'percent' or value <= 100)
);
create unique index if not exists coupons_code_uq on coupons (lower(code));

-- ---------- Códigos de canje (regalan saldo, puntos o giros) ----------
create table if not exists redeem_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  reward_type text not null check (reward_type in ('balance','points','spins')),
  reward_value numeric(10,2) not null check (reward_value > 0),
  max_uses int check (max_uses is null or max_uses > 0),
  used_count int not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists redeem_codes_code_uq on redeem_codes (lower(code));

create table if not exists redemptions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references redeem_codes(id),
  user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (code_id, user_id)
);

-- ---------- Ruleta ----------
create table if not exists wheel_prizes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  prize_type text not null check (prize_type in ('none','balance','points','spins')),
  value numeric(10,2) not null default 0 check (value >= 0),
  weight int not null check (weight > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists spin_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  prize_id uuid references wheel_prizes(id) on delete set null,
  label text not null,
  prize_type text not null,
  value numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- Pedidos: cupón aplicado ----------
alter table orders add column if not exists coupon_id uuid references coupons(id);
alter table orders add column if not exists discount_usd numeric(14,4) not null default 0;

-- ---------- Seguridad: estas tablas solo las toca el servidor (clave secreta) ----------
alter table coupons enable row level security;
alter table redeem_codes enable row level security;
alter table redemptions enable row level security;
alter table wheel_prizes enable row level security;
alter table spin_results enable row level security;

grant select, insert, update, delete on public.coupons, public.redeem_codes, public.redemptions,
  public.wheel_prizes, public.spin_results to service_role;

-- ---------- Funciones atómicas ----------
-- Crear pedido: valida producto, aplica cupón y cuenta el uso, todo en una sola transacción.
create or replace function create_order(p_user uuid, p_product uuid, p_player jsonb, p_coupon text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_prod record; v_rate record; v_cpn coupons%rowtype;
  v_disc numeric := 0; v_final numeric; v_cid uuid; v_order orders%rowtype;
begin
  if exists (select 1 from profiles where id = p_user and banned) then raise exception 'cuenta_suspendida'; end if;

  select p.id, p.price_usd, p.game_id into v_prod
  from products p join games g on g.id = p.game_id
  where p.id = p_product and p.status = 'active' and g.status = 'active';
  if not found then raise exception 'producto_no_disponible'; end if;

  select id, rate into v_rate from exchange_rates where quote = 'VES' order by fetched_at desc limit 1;

  if p_coupon is not null and length(trim(p_coupon)) > 0 then
    select * into v_cpn from coupons where lower(code) = lower(trim(p_coupon)) for update;
    if not found or not v_cpn.active
       or (v_cpn.expires_at is not null and v_cpn.expires_at < now())
       or (v_cpn.max_uses is not null and v_cpn.used_count >= v_cpn.max_uses)
       or (v_cpn.game_id is not null and v_cpn.game_id <> v_prod.game_id)
       or v_prod.price_usd < v_cpn.min_amount_usd then
      raise exception 'cupon_invalido';
    end if;
    if exists (select 1 from orders where user_id = p_user and coupon_id = v_cpn.id and status not in ('rejected','refunded')) then
      raise exception 'cupon_usado';
    end if;
    if v_cpn.kind = 'percent' then v_disc := round(v_prod.price_usd * v_cpn.value / 100, 2);
    else v_disc := least(v_cpn.value, v_prod.price_usd); end if;
    v_cid := v_cpn.id;
    update coupons set used_count = used_count + 1 where id = v_cid;
  end if;

  v_final := greatest(v_prod.price_usd - v_disc, 0);

  insert into orders (user_id, product_id, amount_usd, discount_usd, coupon_id, rate_id, rate_applied, player_details, status)
  values (p_user, v_prod.id, v_final, v_disc, v_cid, v_rate.id, v_rate.rate, coalesce(p_player, '{}'::jsonb), 'pending')
  returning * into v_order;

  return jsonb_build_object('order_id', v_order.id, 'status', v_order.status,
                            'amount_usd', v_order.amount_usd, 'discount_usd', v_disc);
end $$;

-- Canjear código: un código por persona, con tope de usos, sin carreras.
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
  else update profiles set spins = spins + trunc(v.reward_value)::int where id = p_user;
  end if;
  return jsonb_build_object('reward_type', v.reward_type, 'reward_value', v.reward_value);
end $$;

-- Girar la ruleta: el premio lo decide el servidor, con probabilidad según el peso.
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
  elsif v_prize.prize_type = 'spins' then update profiles set spins = spins + trunc(v_prize.value)::int where id = p_user;
  end if;
  insert into spin_results (user_id, prize_id, label, prize_type, value)
  values (p_user, v_prize.id, v_prize.label, v_prize.prize_type, v_prize.value);
  return jsonb_build_object('prize_id', v_prize.id, 'label', v_prize.label,
                            'prize_type', v_prize.prize_type, 'value', v_prize.value);
end $$;

-- Confirmar pago a mano: la misma referencia no puede pagar dos pedidos.
create or replace function confirm_payment(p_order uuid, p_method text, p_ref text, p_amount numeric, p_currency text, p_actor text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v orders%rowtype; v_pay uuid;
begin
  select * into v from orders where id = p_order for update;
  if not found or v.status not in ('pending','awaiting_review') then raise exception 'pedido_no_pagable'; end if;
  insert into payments (order_id, method, currency, amount, reference, status, confirmed_by)
  values (p_order, p_method, p_currency, p_amount, p_ref, 'paid', p_actor) returning id into v_pay;
  update orders set status = 'paid', updated_at = now() where id = p_order;
  return jsonb_build_object('payment_id', v_pay, 'order_id', p_order);
end $$;

-- Ajustar saldo, puntos o giros de un usuario (el servidor registra quién lo hizo).
create or replace function admin_adjust(p_user uuid, p_kind text, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r profiles%rowtype;
begin
  if p_kind = 'balance' then update profiles set balance_usd = balance_usd + p_amount where id = p_user returning * into r;
  elsif p_kind = 'points' then update profiles set points = points + trunc(p_amount)::int where id = p_user returning * into r;
  elsif p_kind = 'spins' then update profiles set spins = spins + trunc(p_amount)::int where id = p_user returning * into r;
  else raise exception 'tipo_invalido'; end if;
  if not found then raise exception 'usuario_no_existe'; end if;
  return jsonb_build_object('balance_usd', r.balance_usd, 'points', r.points, 'spins', r.spins);
end $$;

-- Cifras del panel
create or replace function admin_stats()
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'users', (select count(*) from profiles),
    'orders_total', (select count(*) from orders),
    'orders_pending', (select count(*) from orders where status in ('pending','awaiting_review')),
    'orders_paid', (select count(*) from orders where status in ('paid','delivering')),
    'orders_completed', (select count(*) from orders where status = 'completed'),
    'revenue_usd', (select coalesce(sum(amount_usd), 0) from orders where status in ('paid','delivering','completed')),
    'revenue_30d_usd', (select coalesce(sum(amount_usd), 0) from orders where status in ('paid','delivering','completed') and created_at > now() - interval '30 days'),
    'games_active', (select count(*) from games where status = 'active'),
    'products_active', (select count(*) from products where status = 'active')
  );
$$;

-- Solo el servidor puede llamar estas funciones
revoke all on function create_order(uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function redeem_code(uuid, text) from public, anon, authenticated;
revoke all on function spin_wheel(uuid) from public, anon, authenticated;
revoke all on function confirm_payment(uuid, text, text, numeric, text, text) from public, anon, authenticated;
revoke all on function admin_adjust(uuid, text, numeric) from public, anon, authenticated;
revoke all on function admin_stats() from public, anon, authenticated;
grant execute on function create_order(uuid, uuid, jsonb, text), redeem_code(uuid, text), spin_wheel(uuid),
  confirm_payment(uuid, text, text, numeric, text, text), admin_adjust(uuid, text, numeric), admin_stats() to service_role;
