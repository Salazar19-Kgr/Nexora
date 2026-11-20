-- NEXORA · 0007 · Países: cada país tiene sus métodos de pago y sus precios
-- Se puede ejecutar más de una vez sin problema.

-- ---------- País del usuario (obligatorio para comprar) ----------
alter table profiles add column if not exists country text;
alter table profiles drop constraint if exists profiles_country_check;
alter table profiles add constraint profiles_country_check check (country is null or country in ('VE','DO','PA','MX','US'));

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_user text := nullif(new.raw_user_meta_data->>'username','');
  v_country text := nullif(upper(new.raw_user_meta_data->>'country'),'');
begin
  if v_country is not null and v_country not in ('VE','DO','PA','MX','US') then v_country := null; end if;
  insert into profiles (id, display_name, username, country)
  values (new.id, coalesce(v_user, split_part(new.email,'@',1)), v_user, v_country);
  return new;
end $$;

-- ---------- Métodos de pago por país ----------
alter table payment_methods add column if not exists country text not null default 'VE';
alter table payment_methods drop constraint if exists payment_methods_country_check;
alter table payment_methods add constraint payment_methods_country_check check (country in ('VE','DO','PA','MX','US'));
alter table payment_methods drop constraint if exists payment_methods_currency_check;
alter table payment_methods add constraint payment_methods_currency_check check (currency in ('USD','VES','USDT','DOP','MXN'));

-- El bot también puede avisar pagos en pesos dominicanos o mexicanos.
alter table incoming_payments drop constraint if exists incoming_payments_currency_check;
alter table incoming_payments add constraint incoming_payments_currency_check check (currency in ('USD','VES','USDT','DOP','MXN'));

-- ---------- Precios por país (en USD; el cliente ve su moneda con la tasa del día) ----------
create table if not exists product_prices (
  product_id uuid not null references products(id) on delete cascade,
  country text not null check (country in ('VE','DO','PA','MX','US')),
  price_usd numeric(12,2) not null check (price_usd >= 0),
  updated_at timestamptz not null default now(),
  primary key (product_id, country)
);
alter table product_prices enable row level security;
revoke all on product_prices from anon, authenticated;
grant select, insert, update, delete on product_prices to service_role;

-- Los paquetes que ya existían quedan con su precio actual en Venezuela.
insert into product_prices (product_id, country, price_usd)
select id, 'VE', price_usd from products on conflict (product_id, country) do nothing;

-- ---------- Pedidos: guardan el país ----------
alter table orders add column if not exists country text;

-- Moneda local de cada país (USD = sin conversión)
create or replace function country_currency(p_country text) returns text language sql immutable as $$
  select case p_country when 'VE' then 'VES' when 'DO' then 'DOP' when 'MX' then 'MXN' else 'USD' end;
$$;

-- Crear pedido: el país sale del perfil (no del navegador) y el precio de la tabla de ese país.
create or replace function create_order(p_user uuid, p_product uuid, p_player jsonb, p_coupon text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_prod record; v_rate record; v_cpn coupons%rowtype; v_country text; v_cur text; v_price numeric;
  v_disc numeric := 0; v_final numeric; v_cid uuid; v_order orders%rowtype;
begin
  select country into v_country from profiles where id = p_user and not banned;
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

  v_final := greatest(v_price - v_disc, 0);

  insert into orders (user_id, product_id, amount_usd, discount_usd, coupon_id, rate_id, rate_applied, player_details, status, country)
  values (p_user, v_prod.id, v_final, v_disc, v_cid, v_rate.id, v_rate.rate, coalesce(p_player, '{}'::jsonb), 'pending', v_country)
  returning * into v_order;

  return jsonb_build_object('order_id', v_order.id, 'status', v_order.status,
                            'amount_usd', v_order.amount_usd, 'discount_usd', v_disc, 'country', v_country);
end $$;

-- Verificación automática: monto esperado en la moneda del método (con la tasa guardada en el pedido).
create or replace function auto_match(p_proof uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare pr payment_proofs%rowtype; m payment_methods%rowtype; o orders%rowtype; inc incoming_payments%rowtype; v_exp numeric;
begin
  select * into pr from payment_proofs where id = p_proof and status = 'pending' for update;
  if not found then return false; end if;
  select * into m from payment_methods where id = pr.method_id;
  select * into o from orders where id = pr.order_id for update;
  if o.status not in ('pending','awaiting_review') then return false; end if;
  v_exp := case when m.currency in ('VES','DOP','MXN') then o.amount_usd * coalesce(o.rate_applied, 0) else o.amount_usd end;
  if v_exp <= 0 then return false; end if;
  select * into inc from incoming_payments
   where kind = m.kind and upper(reference) = upper(pr.reference) and currency = m.currency
     and matched_order is null and amount >= v_exp * 0.995
   for update;
  if not found then return false; end if;
  insert into payments (order_id, method, currency, amount, reference, status, confirmed_by)
  values (o.id, m.kind, m.currency, inc.amount, upper(pr.reference), 'paid', 'bot:' || coalesce(inc.source, 'auto'));
  update orders set status = 'paid', updated_at = now() where id = o.id;
  update payment_proofs set status = 'verified', verified_by = 'bot', reviewed_at = now() where id = pr.id;
  update incoming_payments set matched_order = o.id where id = inc.id;
  return true;
end $$;

-- Enviar comprobante: el método tiene que ser del país del pedido.
create or replace function submit_proof(p_user uuid, p_order uuid, p_method uuid, p_ref text, p_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; m payment_methods%rowtype; v_id uuid; v_auto boolean;
begin
  if exists (select 1 from profiles where id = p_user and banned) then raise exception 'cuenta_suspendida'; end if;
  select * into o from orders where id = p_order and user_id = p_user for update;
  if not found then raise exception 'pedido_no_existe'; end if;
  if o.status not in ('pending','awaiting_review') then raise exception 'pedido_no_pagable'; end if;
  select * into m from payment_methods where id = p_method and active;
  if not found or (o.country is not null and m.country <> o.country) then raise exception 'metodo_invalido'; end if;
  if o.amount_usd < m.min_usd then raise exception 'monto_minimo'; end if;
  if exists (select 1 from payment_proofs where order_id = p_order and status = 'pending') then raise exception 'comprobante_pendiente'; end if;
  begin
    insert into payment_proofs (order_id, user_id, method_id, reference, proof_path)
    values (p_order, p_user, p_method, trim(p_ref), p_path) returning id into v_id;
  exception when unique_violation then raise exception 'referencia_usada';
  end;
  update orders set status = 'awaiting_review', updated_at = now() where id = p_order;
  v_auto := auto_match(v_id);
  return jsonb_build_object('proof_id', v_id, 'auto_verified', v_auto);
end $$;

revoke all on function country_currency(text), create_order(uuid,uuid,jsonb,text), auto_match(uuid),
  submit_proof(uuid,uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function country_currency(text), create_order(uuid,uuid,jsonb,text), auto_match(uuid),
  submit_proof(uuid,uuid,uuid,text,text) to service_role;

notify pgrst, 'reload schema';
