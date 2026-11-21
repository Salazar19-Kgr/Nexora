-- NEXORA · 0009 · Devolver los NexoCoins si el pedido se rechaza o se reembolsa (una sola vez)
alter table orders add column if not exists coins_returned boolean not null default false;

create or replace function orders_return_coins() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('rejected','refunded') and old.status is distinct from new.status
     and new.coins_used > 0 and not new.coins_returned then
    update profiles set coins = coins + new.coins_used where id = new.user_id;
    new.coins_returned := true;
  end if;
  return new;
end $$;

drop trigger if exists trg_orders_return_coins on orders;
create trigger trg_orders_return_coins before update on orders
  for each row execute function orders_return_coins();

revoke all on function orders_return_coins() from public, anon, authenticated;
notify pgrst, 'reload schema';
