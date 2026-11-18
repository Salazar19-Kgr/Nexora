-- Supabase ya no da permisos automáticos a las tablas nuevas (cambio de octubre 2026).
-- Estos permisos son mínimos; las políticas RLS siguen decidiendo quién ve qué.

grant usage on schema public to anon, authenticated, service_role;

-- Visitantes: solo leer el catálogo (RLS deja pasar únicamente lo activo)
grant select on public.games, public.products to anon;

-- Clientes con sesión
grant select on public.games, public.products, public.profiles, public.orders, public.payments to authenticated;

-- Personal (las políticas limitan quién ve qué)
grant select on public.exchange_rates, public.providers, public.inventory_batches,
  public.digital_codes, public.deliveries, public.payment_events, public.audit_logs to authenticated;
grant insert, update, delete on public.games, public.products, public.providers to authenticated;

-- El servidor (Worker) con la clave secreta
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Funciones que usan las políticas
grant execute on function public.is_staff(), public.is_admin() to anon, authenticated, service_role;
grant execute on function public.reserve_code(uuid, uuid) to service_role;
