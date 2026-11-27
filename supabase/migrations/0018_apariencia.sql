-- NEXORA · 0018 · Apariencia de la tienda (tema activo, programación y textos de banners)
create table if not exists site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table site_settings enable row level security;
revoke all on site_settings from public, anon, authenticated;
grant select, insert, update, delete on site_settings to service_role;
