-- NEXORA · 0015 · Datos para el Resumen del panel (gráficas y pendientes)
-- Se puede ejecutar más de una vez sin problema.
create or replace function admin_overview()
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('d', to_char(g.d, 'YYYY-MM-DD'), 'usd', coalesce(x.usd, 0), 'n', coalesce(x.n, 0)) order by g.d), '[]'::jsonb)
      from generate_series((now() - interval '13 days')::date, now()::date, interval '1 day') as g(d)
      left join (
        select created_at::date as d, sum(amount_usd) as usd, count(*) as n
        from orders where status in ('paid','delivering','completed') and created_at >= (now() - interval '13 days')::date
        group by 1
      ) x on x.d = g.d::date
    ),
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) n from orders group by status) s),
    'pending', jsonb_build_object(
      'proofs', (select count(*) from payment_proofs where status = 'pending'),
      'topups', (select count(*) from topups where status = 'pending'),
      'refunds', (select count(*) from refund_requests where status = 'pending'),
      'deliveries', (select count(*) from fulfillments where status in ('failed','manual'))
    ),
    'recent', (
      select coalesce(jsonb_agg(r order by r.created_at desc), '[]'::jsonb) from (
        select o.id, o.amount_usd, o.status, o.created_at, o.country, pr.name as product, g.name as game
        from orders o left join products pr on pr.id = o.product_id left join games g on g.id = pr.game_id
        order by o.created_at desc limit 6
      ) r
    )
  );
$$;
revoke all on function admin_overview() from public, anon, authenticated;
grant execute on function admin_overview() to service_role;
notify pgrst, 'reload schema';
