-- Cada paquete nuevo queda con precio en los 5 países (el que pongas en "Precio en USD").
-- Luego puedes cambiar el precio de un país en "Precios". Así ningún paquete queda invisible.
create or replace function products_fill_prices() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into product_prices (product_id, country, price_usd)
  select new.id, c, new.price_usd from unnest(array['VE','DO','PA','MX','US']) c
  on conflict (product_id, country) do nothing;
  return new;
end $$;
drop trigger if exists trg_products_fill_prices on products;
create trigger trg_products_fill_prices after insert on products for each row execute function products_fill_prices();

-- Rellena los paquetes que ya existen y no tenían precio en algún país.
insert into product_prices (product_id, country, price_usd)
select p.id, c, p.price_usd from products p cross join unnest(array['VE','DO','PA','MX','US']) c
on conflict (product_id, country) do nothing;

-- Los paquetes de prueba que quedaron en borrador pasan a activos.
update products set status = 'active' where status = 'draft';
