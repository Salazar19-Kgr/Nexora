-- NEXORA · 0012 · Reembolsos con doble aprobación: una persona solicita y OTRA aprueba.
create table if not exists refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete restrict,
  requested_by uuid not null,
  reason text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
-- Solo una solicitud pendiente por pedido.
create unique index if not exists refund_one_pending on refund_requests(order_id) where status = 'pending';
alter table refund_requests enable row level security;
revoke all on refund_requests from public, anon, authenticated;
grant select, insert, update on refund_requests to service_role;

create or replace function refund_request(p_order uuid, p_actor uuid, p_reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_status text;
begin
  select status into v_status from orders where id = p_order for update;
  if not found then raise exception 'pedido_no_existe'; end if;
  if v_status not in ('paid','delivering','completed','disputed') then raise exception 'accion_invalida'; end if;
  if exists (select 1 from refund_requests where order_id = p_order and status = 'pending') then raise exception 'reembolso_pendiente'; end if;
  insert into refund_requests (order_id, requested_by, reason) values (p_order, p_actor, left(coalesce(p_reason,''), 200)) returning id into v_id;
  return v_id;
end $$;

create or replace function refund_decide(p_id uuid, p_actor uuid, p_approve boolean)
returns text language plpgsql security definer set search_path = public as $$
declare r refund_requests%rowtype;
begin
  select * into r from refund_requests where id = p_id for update;
  if not found then raise exception 'pedido_no_existe'; end if;
  if r.status <> 'pending' then raise exception 'reembolso_decidido'; end if;
  if r.requested_by = p_actor then raise exception 'misma_persona'; end if;
  update refund_requests set status = case when p_approve then 'approved' else 'rejected' end, decided_by = p_actor, decided_at = now() where id = p_id;
  if p_approve then
    update orders set status = 'refunded', updated_at = now() where id = r.order_id and status in ('paid','delivering','completed','disputed');
    if not found then raise exception 'accion_invalida'; end if;
  end if;
  return case when p_approve then 'approved' else 'rejected' end;
end $$;

revoke all on function refund_request(uuid, uuid, text), refund_decide(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function refund_request(uuid, uuid, text), refund_decide(uuid, uuid, boolean) to service_role;
notify pgrst, 'reload schema';
