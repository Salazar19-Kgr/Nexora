-- NEXORA · 0019 · Endurecimiento: permisos mínimos y límites de intentos compartidos (por IP)
revoke trigger, truncate, references on all tables in schema public from anon, authenticated;
revoke insert, update, delete on public.games, public.products, public.providers from authenticated;
revoke select on public.exchange_rates, public.providers, public.inventory_batches, public.digital_codes, public.deliveries, public.payment_events, public.audit_logs from authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.products_fill_prices() from public, anon, authenticated;
create table if not exists rate_limits (key text primary key, n int not null default 0, reset_at timestamptz not null);
alter table rate_limits enable row level security;
revoke all on rate_limits from public, anon, authenticated;
grant select, insert, update, delete on rate_limits to service_role;
create or replace function rate_hit(p_key text, p_max int, p_secs int, p_inc boolean default true) returns boolean language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if random() < 0.02 then delete from rate_limits where reset_at < now() - interval '1 day'; end if;
  insert into rate_limits (key, n, reset_at) values (p_key, case when p_inc then 1 else 0 end, now() + make_interval(secs => p_secs))
  on conflict (key) do update set
    n = case when rate_limits.reset_at < now() then (case when p_inc then 1 else 0 end) else rate_limits.n + (case when p_inc then 1 else 0 end) end,
    reset_at = case when rate_limits.reset_at < now() then now() + make_interval(secs => p_secs) else rate_limits.reset_at end
  returning n into v_n;
  return v_n <= p_max;
end $$;
revoke all on function rate_hit(text, int, int, boolean) from public, anon, authenticated;
grant execute on function rate_hit(text, int, int, boolean) to service_role;
notify pgrst, 'reload schema';
