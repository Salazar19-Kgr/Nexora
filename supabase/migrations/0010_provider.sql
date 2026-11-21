-- NEXORA · 0010 · Entrega automática con proveedor (GamesDrop)
-- Un pedido pagado genera UNA entrega (order_id único). El transaction_id que se envía al proveedor
-- también es único, así que un reintento nunca compra dos veces. Se puede ejecutar más de una vez.

alter table products add column if not exists provider_offer_id bigint;

create table if not exists fulfillments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete restrict,
  transaction_id text not null unique,
  offer_id bigint,
  status text not null default 'queued' check (status in ('queued','submitted','completed','failed','manual')),
  provider_order_id text,
  provider_status text,
  cost numeric(12,4),
  cost_currency text,
  attempts int not null default 0,
  last_error text,
  next_try_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fulfillments_status_idx on fulfillments(status, next_try_at);
alter table fulfillments enable row level security;
revoke all on fulfillments from public, anon, authenticated;
grant select, insert, update on fulfillments to service_role;

-- Reclama los pedidos pagados que aún no tienen entrega (seguro con varios procesos a la vez).
create or replace function claim_deliveries(p_limit int default 10)
returns int language plpgsql security definer set search_path = public as $$
declare o record; n int := 0;
begin
  for o in select id from orders where status = 'paid'
           and not exists (select 1 from fulfillments f where f.order_id = orders.id)
           order by created_at limit greatest(p_limit, 1) for update skip locked loop
    insert into fulfillments (order_id, transaction_id, offer_id)
    select o.id, 'nx-' || replace(o.id::text, '-', ''), p.provider_offer_id
    from orders od join products p on p.id = od.product_id where od.id = o.id
    on conflict (order_id) do nothing;
    update orders set status = 'delivering', updated_at = now() where id = o.id and status = 'paid';
    n := n + 1;
  end loop;
  return n;
end $$;

-- Actualiza una entrega. Si queda completada, el pedido pasa a completado.
create or replace function fulfillment_set(
  p_id uuid, p_status text, p_provider_order text default null, p_provider_status text default null,
  p_cost numeric default null, p_currency text default null, p_error text default null, p_retry_in int default 0)
returns void language plpgsql security definer set search_path = public as $$
declare f fulfillments%rowtype;
begin
  if p_status not in ('queued','submitted','completed','failed','manual') then raise exception 'accion_invalida'; end if;
  update fulfillments set
    status = p_status,
    provider_order_id = coalesce(p_provider_order, provider_order_id),
    provider_status = coalesce(p_provider_status, provider_status),
    cost = coalesce(p_cost, cost),
    cost_currency = coalesce(p_currency, cost_currency),
    last_error = p_error,
    attempts = attempts + case when p_error is not null then 1 else 0 end,
    next_try_at = now() + make_interval(secs => greatest(p_retry_in, 0)),
    updated_at = now()
  where id = p_id returning * into f;
  if not found then raise exception 'pedido_no_existe'; end if;
  if p_status = 'completed' then
    update orders set status = 'completed', updated_at = now() where id = f.order_id and status in ('paid','delivering','disputed');
  end if;
end $$;

-- El administrador reintenta una entrega fallida o manual.
create or replace function fulfillment_retry(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update fulfillments set status = 'queued', attempts = 0, last_error = null, next_try_at = now(), updated_at = now()
  where id = p_id and status in ('failed','manual') and provider_order_id is null;
  if not found then raise exception 'accion_invalida'; end if;
end $$;

-- El administrador entregó a mano (fuera de la API).
create or replace function fulfillment_manual_done(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare f fulfillments%rowtype;
begin
  update fulfillments set status = 'completed', provider_status = coalesce(provider_status, 'MANUAL'), last_error = null, updated_at = now()
  where id = p_id and status in ('failed','manual','queued') returning * into f;
  if not found then raise exception 'accion_invalida'; end if;
  update orders set status = 'completed', updated_at = now() where id = f.order_id and status in ('paid','delivering','disputed');
end $$;

revoke all on function claim_deliveries(int), fulfillment_set(uuid, text, text, text, numeric, text, text, int),
  fulfillment_retry(uuid), fulfillment_manual_done(uuid) from public, anon, authenticated;
grant execute on function claim_deliveries(int), fulfillment_set(uuid, text, text, text, numeric, text, text, int),
  fulfillment_retry(uuid), fulfillment_manual_done(uuid) to service_role;

notify pgrst, 'reload schema';
