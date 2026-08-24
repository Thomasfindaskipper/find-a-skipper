-- Add role-based onboarding state and initialize it for new users.

alter table public.profiles
  add column if not exists onboarding_step text;

alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_onboarding_step_check;

alter table public.profiles
  add constraint profiles_onboarding_step_check
  check (onboarding_step in ('role_details', 'done'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, role, full_name, phone, company_name, fleet_size, city,
    experience_years, zones, boat_types, languages, permits, avatar_url, hourly_rate, availability_note, bio,
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
    new.raw_user_meta_data->>'bio',
    'role_details',
    null
  );
  return new;
end;
$$;
