-- NEXORA · 0011 · Tienda: ventas reales por juego y precio anterior (para mostrar descuentos reales)
alter table products add column if not exists old_price_usd numeric(14,4) check (old_price_usd is null or old_price_usd > 0);

-- Ventas completadas y mayor descuento activo por juego. Solo cifras agregadas, sin datos de clientes.
create or replace function game_stats()
returns table (game_id uuid, sold bigint, discount_pct int)
language sql stable security definer set search_path = public as $$
  select g.id,
         coalesce((select count(*) from orders o join products p on p.id = o.product_id
                   where p.game_id = g.id and o.status = 'completed'), 0),
         coalesce((select max(round((1 - p.price_usd / p.old_price_usd) * 100))::int
                   from products p where p.game_id = g.id and p.status = 'active'
                   and p.old_price_usd is not null and p.old_price_usd > p.price_usd), 0)
  from games g where g.status = 'active';
$$;
revoke all on function game_stats() from public, anon, authenticated;
grant execute on function game_stats() to service_role;
notify pgrst, 'reload schema';
