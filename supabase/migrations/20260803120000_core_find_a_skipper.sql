-- Core schema for Find a Skipper
-- Run via Supabase SQL Editor or: supabase db push

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('skipper', 'owner', 'broker', 'charter_company', 'admin')) default 'owner',
  full_name text not null,
  phone text,
  avatar_url text,
  company_name text,
  fleet_size int,
  city text,
  experience_years int,
  zones text[] default '{}',
  boat_types text[] default '{}',
  languages text[] default '{}',
  permits text,
  certifications jsonb default '[]',
  bio text,
  gallery_urls text[] default '{}',
  hourly_rate text,
  availability_note text,
  identity_verified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Public read skipper profiles') then
    create policy "Public read skipper profiles"
      on public.profiles for select
      using (role = 'skipper' or auth.uid() = id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users can insert own profile') then
    create policy "Users can insert own profile"
      on public.profiles for insert
      with check (auth.uid() = id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Users can update own profile') then
    create policy "Users can update own profile"
      on public.profiles for update
      using (auth.uid() = id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Admins can read all profiles') then
    create policy "Admins can read all profiles"
      on public.profiles for select
      using (
        exists (
          select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
        )
      );
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, role, full_name, phone, company_name, fleet_size, city,
    experience_years, zones, boat_types, languages, permits, bio
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
    new.raw_user_meta_data->>'bio'
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
        bio = excluded.bio;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('À la journée', 'À la semaine', 'Saisonnier', 'Convoyage', 'Autre')),
  boat_type text not null,
  zone text not null,
  departure text not null,
  destination text,
  start_date date not null,
  duration text,
  compensation text,
  description text,
  applicants_count int not null default 0,
  is_featured boolean not null default false,
  posted_at timestamptz not null default now()
);

alter table public.missions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'missions' and policyname = 'Anyone can read missions') then
    create policy "Anyone can read missions"
      on public.missions for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'missions' and policyname = 'Owners or brokers can create mission') then
    create policy "Owners or brokers can create mission"
      on public.missions for insert
      with check (
        auth.uid() = poster_id
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('owner', 'broker', 'charter_company')
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'missions' and policyname = 'Poster can update own missions') then
    create policy "Poster can update own missions"
      on public.missions for update using (auth.uid() = poster_id);
  end if;
end $$;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  skipper_id uuid not null references public.profiles(id) on delete cascade,
  phone text,
  message text,
  applied_at timestamptz not null default now(),
  unique (mission_id, skipper_id)
);

alter table public.applications enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'applications' and policyname = 'Applicant or poster can read applications') then
    create policy "Applicant or poster can read applications"
      on public.applications for select
      using (
        auth.uid() = skipper_id
        or auth.uid() = (select poster_id from public.missions where id = mission_id)
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'applications' and policyname = 'Skippers can apply') then
    create policy "Skippers can apply"
      on public.applications for insert
      with check (
        auth.uid() = skipper_id
        and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'skipper')
      );
  end if;
end $$;

create or replace function public.increment_applicants_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.missions
  set applicants_count = applicants_count + 1
  where id = new.mission_id;
  return new;
end;
$$;

drop trigger if exists on_application_created on public.applications;
create trigger on_application_created
  after insert on public.applications
  for each row execute function public.increment_applicants_count();

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  demandeur_id uuid not null references public.profiles(id) on delete cascade,
  skipper_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (mission_id, skipper_id)
);

alter table public.conversations enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'conversations' and policyname = 'Participants can read their conversations') then
    create policy "Participants can read their conversations"
      on public.conversations for select
      using (auth.uid() = demandeur_id or auth.uid() = skipper_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'conversations' and policyname = 'Demandeur can start a conversation') then
    create policy "Demandeur can start a conversation"
      on public.conversations for insert
      with check (auth.uid() = demandeur_id);
  end if;
end $$;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'messages' and policyname = 'Participants can read messages') then
    create policy "Participants can read messages"
      on public.messages for select
      using (
        exists (
          select 1 from public.conversations c
          where c.id = conversation_id and (auth.uid() = c.demandeur_id or auth.uid() = c.skipper_id)
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'messages' and policyname = 'Participants can send messages') then
    create policy "Participants can send messages"
      on public.messages for insert
      with check (
        auth.uid() = sender_id
        and exists (
          select 1 from public.conversations c
          where c.id = conversation_id and (auth.uid() = c.demandeur_id or auth.uid() = c.skipper_id)
        )
      );
  end if;
end $$;

create table if not exists public.skippers (
  id uuid primary key references public.profiles(id) on delete cascade,
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  experience_years int,
  permits text,
  bio text,
  zones text[] default '{}',
  boat_types text[] default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.owners (
  id uuid primary key references public.profiles(id) on delete cascade,
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  company_name text,
  fleet_size int,
  city text,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  skipper_id uuid references public.profiles(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((skipper_id is not null and mission_id is null) or (skipper_id is null and mission_id is not null))
);

alter table public.favorites enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'favorites' and policyname = 'Users manage own favorites') then
    create policy "Users manage own favorites"
      on public.favorites for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (mission_id, reviewer_id, reviewee_id)
);

alter table public.reviews enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reviews' and policyname = 'Anyone can read reviews') then
    create policy "Anyone can read reviews"
      on public.reviews for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reviews' and policyname = 'Participants can leave a review after a mission') then
    create policy "Participants can leave a review after a mission"
      on public.reviews for insert
      with check (
        auth.uid() = reviewer_id
        and exists (
          select 1 from public.applications a
          join public.missions m on m.id = a.mission_id
          where a.mission_id = reviews.mission_id
            and (
              (auth.uid() = m.poster_id and a.skipper_id = reviews.reviewee_id)
              or (auth.uid() = a.skipper_id and m.poster_id = reviews.reviewee_id)
            )
        )
      );
  end if;
end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'Users read their own notifications') then
    create policy "Users read their own notifications"
      on public.notifications for select using (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications' and policyname = 'Users update their own notifications') then
    create policy "Users update their own notifications"
      on public.notifications for update using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists idx_missions_poster_id on public.missions (poster_id);
create index if not exists idx_missions_zone on public.missions (zone);
create index if not exists idx_missions_posted_at on public.missions (posted_at desc);
create index if not exists idx_applications_mission_id on public.applications (mission_id);
create index if not exists idx_applications_skipper_id on public.applications (skipper_id);
create index if not exists idx_conversations_mission on public.conversations (mission_id);
create index if not exists idx_messages_conversation on public.messages (conversation_id);
