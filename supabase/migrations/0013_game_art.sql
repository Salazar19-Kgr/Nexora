-- NEXORA · 0013 · Bucket público para los logos de los juegos
insert into storage.buckets (id, name, public) values ('game-art', 'game-art', true) on conflict (id) do update set public = true;
