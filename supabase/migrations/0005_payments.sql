-- NEXORA · 0005 · Métodos de pago, comprobantes y verificación automática
-- Se puede ejecutar más de una vez sin problema.

-- ---------- Métodos de pago (los configura el admin) ----------
create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 60),
  kind text not null check (kind in ('pago_movil','transferencia','zelle','binance','usdt','efectivo','otro')),
  currency text not null check (currency in ('USD','VES','USDT')),
  instructions text not null default '' check (length(instructions) <= 800),
  min_usd numeric(12,2) not null default 0 check (min_usd >= 0),
  active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

-- ---------- Comprobantes enviados por los compradores ----------
create table if not exists payment_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  user_id uuid not null references auth.users(id),
  method_id uuid not null references payment_methods(id),
  reference text not null check (length(reference) between 4 and 64),
  proof_path text,
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  verified_by text,
  reject_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
-- Solo un comprobante en espera por pedido, y una referencia no puede usarse dos veces (salvo si fue rechazada).
create unique index if not exists proofs_one_pending_per_order on payment_proofs (order_id) where status = 'pending';
create unique index if not exists proofs_unique_reference on payment_proofs (method_id, upper(reference)) where status <> 'rejected';

-- ---------- Pagos que avisó el banco/bot (para liberar solo) ----------
create table if not exists incoming_payments (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('pago_movil','transferencia','zelle','binance','usdt','efectivo','otro')),
  reference text not null check (length(reference) between 4 and 64),
  amount numeric(18,6) not null check (amount > 0),
  currency text not null check (currency in ('USD','VES','USDT')),
  matched_order uuid references orders(id),
  source text,
  created_at timestamptz not null default now()
);
create unique index if not exists incoming_unique on incoming_payments (kind, upper(reference));

alter table payment_methods enable row level security;
alter table payment_proofs enable row level security;
alter table incoming_payments enable row level security;
-- Sin políticas: solo el Worker (service_role) puede leer o escribir.
revoke all on payment_methods, payment_proofs, incoming_payments from anon, authenticated;
grant select, insert, update, delete on payment_methods, payment_proofs, incoming_payments to service_role;

-- Los juegos pueden tener su logo (URL o ruta) en la columna icon_url que ya existe.

-- ---------- Bucket privado para las capturas ----------
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('proofs', 'proofs', false) on conflict (id) do nothing;
  end if;
end $$;

-- ---------- Verificación: libera el pedido si el pago ya llegó ----------
-- Monto esperado en la moneda del método: VES usa la tasa guardada en el pedido.
create or replace function auto_match(p_proof uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare pr payment_proofs%rowtype; m payment_methods%rowtype; o orders%rowtype; inc incoming_payments%rowtype; v_exp numeric;
begin
  select * into pr from payment_proofs where id = p_proof and status = 'pending' for update;
  if not found then return false; end if;
  select * into m from payment_methods where id = pr.method_id;
  select * into o from orders where id = pr.order_id for update;
  if o.status not in ('pending','awaiting_review') then return false; end if;
  v_exp := case when m.currency = 'VES' then o.amount_usd * coalesce(o.rate_applied, 0) else o.amount_usd end;
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

-- El comprador envía su comprobante (referencia + captura).
create or replace function submit_proof(p_user uuid, p_order uuid, p_method uuid, p_ref text, p_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; m payment_methods%rowtype; v_id uuid; v_auto boolean;
begin
  if exists (select 1 from profiles where id = p_user and banned) then raise exception 'cuenta_suspendida'; end if;
  select * into o from orders where id = p_order and user_id = p_user for update;
  if not found then raise exception 'pedido_no_existe'; end if;
  if o.status not in ('pending','awaiting_review') then raise exception 'pedido_no_pagable'; end if;
  select * into m from payment_methods where id = p_method and active;
  if not found then raise exception 'metodo_invalido'; end if;
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

-- El admin aprueba o rechaza un comprobante.
create or replace function review_proof(p_proof uuid, p_action text, p_actor text, p_amount numeric, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pr payment_proofs%rowtype; m payment_methods%rowtype; o orders%rowtype;
begin
  select * into pr from payment_proofs where id = p_proof for update;
  if not found or pr.status <> 'pending' then raise exception 'comprobante_no_pendiente'; end if;
  select * into m from payment_methods where id = pr.method_id;
  select * into o from orders where id = pr.order_id for update;
  if p_action = 'approve' then
    if o.status not in ('pending','awaiting_review') then raise exception 'pedido_no_pagable'; end if;
    insert into payments (order_id, method, currency, amount, reference, status, confirmed_by)
    values (o.id, m.kind, m.currency, p_amount, upper(pr.reference), 'paid', p_actor);
    update orders set status = 'paid', updated_at = now() where id = o.id;
    update payment_proofs set status = 'verified', verified_by = p_actor, reviewed_at = now() where id = pr.id;
  elsif p_action = 'reject' then
    update payment_proofs set status = 'rejected', verified_by = p_actor, reject_reason = left(coalesce(p_reason, ''), 200), reviewed_at = now() where id = pr.id;
    if o.status = 'awaiting_review' then update orders set status = 'pending', updated_at = now() where id = o.id; end if;
  else
    raise exception 'accion_invalida';
  end if;
  return jsonb_build_object('proof_id', pr.id, 'order_id', o.id, 'action', p_action);
end $$;

-- El bot/banco avisa que llegó un pago; si ya hay comprobante con esa referencia, se libera.
create or replace function register_incoming(p_kind text, p_ref text, p_amount numeric, p_currency text, p_source text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_pr uuid; v_ok boolean := false; v_new boolean := true;
begin
  insert into incoming_payments (kind, reference, amount, currency, source)
  values (p_kind, trim(p_ref), p_amount, p_currency, left(p_source, 40))
  on conflict (kind, upper(reference)) do nothing returning id into v_id;
  if v_id is null then v_new := false; end if;
  select pr.id into v_pr from payment_proofs pr join payment_methods m on m.id = pr.method_id
   where pr.status = 'pending' and m.kind = p_kind and upper(pr.reference) = upper(trim(p_ref)) limit 1;
  if v_pr is not null then v_ok := auto_match(v_pr); end if;
  return jsonb_build_object('new', v_new, 'released', v_ok);
end $$;

revoke all on function auto_match(uuid), submit_proof(uuid,uuid,uuid,text,text), review_proof(uuid,text,text,numeric,text),
  register_incoming(text,text,numeric,text,text) from public, anon, authenticated;
grant execute on function auto_match(uuid), submit_proof(uuid,uuid,uuid,text,text), review_proof(uuid,text,text,numeric,text),
  register_incoming(text,text,numeric,text,text) to service_role;

notify pgrst, 'reload schema';
