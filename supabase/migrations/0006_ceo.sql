-- NEXORA · 0006 · Acceso SSECEO (una sola cuenta de propietario, con bloqueo contra intentos)
-- Se puede ejecutar más de una vez sin problema.

create table if not exists ceo_access (
  id int primary key default 1 check (id = 1),          -- solo puede existir UNA fila
  username text not null check (length(username) between 3 and 30),
  email text,                                           -- correo interno aleatorio (nadie lo conoce)
  user_id uuid references auth.users(id) on delete set null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  last_login timestamptz,
  created_at timestamptz not null default now()
);
alter table ceo_access enable row level security;
revoke all on ceo_access from anon, authenticated;
grant select, insert, update, delete on ceo_access to service_role;

-- Reclamar el acceso: solo la primera persona lo logra (la clave primaria lo garantiza).
create or replace function ceo_claim(p_username text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into ceo_access (id, username) values (1, p_username);
  return true;
exception when unique_violation then
  return false;
end $$;

-- Cada intento fallido suma; cada 5 fallos se bloquea (15 min, luego el doble, máximo 24 h).
create or replace function ceo_fail()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r ceo_access%rowtype;
begin
  update ceo_access set
    failed_attempts = failed_attempts + 1,
    locked_until = case when (failed_attempts + 1) % 5 = 0
      then now() + make_interval(mins => least(15 * (2 ^ ((failed_attempts + 1) / 5 - 1))::int, 1440))
      else locked_until end
  where id = 1 returning * into r;
  return jsonb_build_object('attempts', r.failed_attempts, 'locked_until', r.locked_until);
end $$;

create or replace function ceo_ok()
returns void language sql security definer set search_path = public as $$
  update ceo_access set failed_attempts = 0, locked_until = null, last_login = now() where id = 1;
$$;

revoke all on function ceo_claim(text), ceo_fail(), ceo_ok() from public, anon, authenticated;
grant execute on function ceo_claim(text), ceo_fail(), ceo_ok() to service_role;

notify pgrst, 'reload schema';
