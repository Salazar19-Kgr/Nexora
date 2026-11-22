-- NEXORA · 0014 · Recarga de saldo (5/10/20/50 $) aprobada por el equipo + pagar pedidos con saldo
-- Se puede ejecutar más de una vez sin problema.

create table if not exists topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  method_id uuid not null references payment_methods(id),
  amount_usd numeric(12,2) not null check (amount_usd in (5,10,20,50)),
  reference text not null check (length(reference) between 4 and 64),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid references auth.users(id),
  reject_reason text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
-- La misma referencia no puede servir dos veces (salvo si fue rechazada).
create unique index if not exists topups_unique_ref on topups (method_id, upper(reference)) where status <> 'rejected';
create index if not exists topups_user on topups (user_id, created_at desc);

alter table topups enable row level security;
revoke all on topups from anon, authenticated;
grant select, insert, update, delete on topups to service_role;

create or replace function topup_create(p_user uuid, p_amount numeric, p_method uuid, p_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if exists (select 1 from profiles where id = p_user and banned) then raise exception 'cuenta_suspendida'; end if;
  if p_amount not in (5,10,20,50) then raise exception 'monto_invalido'; end if;
  if not exists (select 1 from payment_methods where id = p_method and active) then raise exception 'metodo_no_disponible'; end if;
  if (select count(*) from topups where user_id = p_user and status = 'pending') >= 3 then raise exception 'demasiadas_recargas'; end if;
  begin
    insert into topups (user_id, method_id, amount_usd, reference) values (p_user, p_method, p_amount, trim(p_ref)) returning id into v_id;
  exception when unique_violation then raise exception 'referencia_repetida';
  end;
  return jsonb_build_object('topup_id', v_id, 'status', 'pending', 'amount_usd', p_amount);
end $$;

create or replace function topup_decide(p_id uuid, p_actor uuid, p_approve boolean, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t topups%rowtype; v_bal numeric;
begin
  select * into t from topups where id = p_id for update;
  if not found then raise exception 'recarga_no_existe'; end if;
  if t.status <> 'pending' then raise exception 'recarga_decidida'; end if;
  if p_approve then
    update profiles set balance_usd = balance_usd + t.amount_usd where id = t.user_id returning balance_usd into v_bal;
    if not found then raise exception 'usuario_no_existe'; end if;
    update topups set status = 'approved', decided_by = p_actor, decided_at = now() where id = p_id;
  else
    update topups set status = 'rejected', decided_by = p_actor, decided_at = now(), reject_reason = left(p_reason, 200) where id = p_id;
  end if;
  return jsonb_build_object('status', case when p_approve then 'approved' else 'rejected' end, 'amount_usd', t.amount_usd, 'balance_usd', v_bal);
end $$;

-- Pagar un pedido con el saldo de la cuenta (descuenta una sola vez; si algo falla, no se cobra).
create or replace function pay_with_balance(p_user uuid, p_order uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; v_left numeric;
begin
  select * into o from orders where id = p_order and user_id = p_user for update;
  if not found or o.status not in ('pending','awaiting_review') then raise exception 'pedido_no_pagable'; end if;
  if o.amount_usd <= 0 then raise exception 'pedido_no_pagable'; end if;
  update profiles set balance_usd = balance_usd - o.amount_usd where id = p_user and balance_usd >= o.amount_usd and not banned returning balance_usd into v_left;
  if not found then raise exception 'saldo_insuficiente'; end if;
  perform confirm_payment(p_order, 'otro', 'SALDO-' || upper(substr(replace(p_order::text, '-', ''), 1, 12)), o.amount_usd, 'USD', 'balance:' || p_user::text);
  return jsonb_build_object('order_id', p_order, 'paid_usd', o.amount_usd, 'balance_usd', v_left);
end $$;

revoke all on function topup_create(uuid, numeric, uuid, text), topup_decide(uuid, uuid, boolean, text), pay_with_balance(uuid, uuid) from public, anon, authenticated;
grant execute on function topup_create(uuid, numeric, uuid, text), topup_decide(uuid, uuid, boolean, text), pay_with_balance(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
