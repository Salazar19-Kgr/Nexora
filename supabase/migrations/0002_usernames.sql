create extension if not exists citext;

alter table profiles add column if not exists username citext unique;
alter table profiles drop constraint if exists username_format;
alter table profiles add constraint username_format check (username is null or username ~ '^[A-Za-z0-9_]{3,20}$');

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_user text := nullif(new.raw_user_meta_data->>'username','');
begin
  insert into profiles (id, display_name, username)
  values (new.id, coalesce(v_user, split_part(new.email,'@',1)), v_user);
  return new;
end $$;
