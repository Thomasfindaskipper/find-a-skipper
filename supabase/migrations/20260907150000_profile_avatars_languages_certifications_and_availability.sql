-- Add structured skipper availability and avatar storage without weakening existing RLS.

create table if not exists public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  skipper_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  check (start_date <= end_date)
);

create index if not exists availability_slots_skipper_id_idx
  on public.availability_slots(skipper_id, start_date, end_date);

alter table public.availability_slots enable row level security;

drop policy if exists "Public read skipper availability" on public.availability_slots;
create policy "Public read skipper availability"
  on public.availability_slots for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = availability_slots.skipper_id
        and p.role = 'skipper'
    )
  );

drop policy if exists "Skippers manage own availability" on public.availability_slots;
create policy "Skippers manage own availability"
  on public.availability_slots for all
  using (auth.uid() = skipper_id)
  with check (auth.uid() = skipper_id);

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Users upload own profile avatar" on storage.objects;
create policy "Users upload own profile avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users read own profile avatar" on storage.objects;
create policy "Users read own profile avatar"
  on storage.objects for select
  using (
    bucket_id = 'profile-avatars'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin(auth.uid())
    )
  );

drop policy if exists "Users delete own profile avatar" on storage.objects;
create policy "Users delete own profile avatar"
  on storage.objects for delete
  using (
    bucket_id = 'profile-avatars'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or public.is_admin(auth.uid())
    )
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, role, full_name, phone, company_name, fleet_size, city,
    experience_years, zones, boat_types, languages, permits, avatar_url, hourly_rate, availability_note, certifications, bio,
    onboarding_step, onboarding_completed_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'owner'),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'company_name',
    nullif(new.raw_user_meta_data->>'fleet_size', '')::int,
    new.raw_user_meta_data->>'city',
    nullif(new.raw_user_meta_data->>'experience_years', '')::int,
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(new.raw_user_meta_data->'zones', '[]'::jsonb)) x), '{}'),
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(new.raw_user_meta_data->'boat_types', '[]'::jsonb)) x), '{}'),
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(new.raw_user_meta_data->'languages', '[]'::jsonb)) x), '{}'),
    new.raw_user_meta_data->>'permits',
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'hourly_rate',
    new.raw_user_meta_data->>'availability_note',
    coalesce(new.raw_user_meta_data->'certifications', '[]'::jsonb),
    new.raw_user_meta_data->>'bio',
    'role_details',
    null
  )
  on conflict (id) do update
    set role = excluded.role,
        full_name = excluded.full_name,
        phone = excluded.phone,
        company_name = excluded.company_name,
        fleet_size = excluded.fleet_size,
        city = excluded.city,
        experience_years = excluded.experience_years,
        zones = excluded.zones,
        boat_types = excluded.boat_types,
        languages = excluded.languages,
        permits = excluded.permits,
        avatar_url = excluded.avatar_url,
        hourly_rate = excluded.hourly_rate,
        availability_note = excluded.availability_note,
        certifications = excluded.certifications,
        bio = excluded.bio;

  return new;
end;
$$;