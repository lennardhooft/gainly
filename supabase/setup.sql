-- Gainly: cloud sync setup. Paste this whole file into Supabase › SQL Editor › New query, then Run.
-- Safe to run more than once.

-- 1. One row per user with the app data (measurements, gym, nutrition, settings) as JSON.
create table if not exists public.gainly_state (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  device     text
);

alter table public.gainly_state enable row level security;

-- Only you can read and write your own row.
drop policy if exists "gainly_state_select_own" on public.gainly_state;
drop policy if exists "gainly_state_insert_own" on public.gainly_state;
drop policy if exists "gainly_state_update_own" on public.gainly_state;
drop policy if exists "gainly_state_delete_own" on public.gainly_state;
create policy "gainly_state_select_own" on public.gainly_state for select to authenticated using (auth.uid() = user_id);
create policy "gainly_state_insert_own" on public.gainly_state for insert to authenticated with check (auth.uid() = user_id);
create policy "gainly_state_update_own" on public.gainly_state for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gainly_state_delete_own" on public.gainly_state for delete to authenticated using (auth.uid() = user_id);

-- The server sets the time, so devices with a wrong clock can't win a sync.
create or replace function public.gainly_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists gainly_state_touch on public.gainly_state;
create trigger gainly_state_touch before insert or update on public.gainly_state
  for each row execute function public.gainly_touch();

-- 2. Private bucket for progress photos: <your user id>/<date>_<pose>.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update set public = false;

drop policy if exists "gainly_photos_select_own" on storage.objects;
drop policy if exists "gainly_photos_insert_own" on storage.objects;
drop policy if exists "gainly_photos_update_own" on storage.objects;
drop policy if exists "gainly_photos_delete_own" on storage.objects;
create policy "gainly_photos_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "gainly_photos_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "gainly_photos_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "gainly_photos_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
