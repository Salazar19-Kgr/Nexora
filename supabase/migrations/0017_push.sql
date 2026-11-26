-- Avisos push del panel (solo personal). Las llaves las crea el servidor solo, la primera vez.
create table if not exists push_config (
  id int primary key check (id = 1),
  pub text not null,
  jwk jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists push_subs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  created_at timestamptz not null default now()
);
alter table push_config enable row level security;
alter table push_subs enable row level security;
revoke all on push_config, push_subs from public, anon, authenticated;
grant select, insert, update, delete on push_config, push_subs to service_role;
