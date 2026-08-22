-- ============================================================
-- Find a Skipper — schéma Supabase (Postgres) v2
-- Architecture élargie : 5 rôles + champs anticipés pour les
-- fonctionnalités futures (vérification, avis, favoris, notifs).
-- À exécuter dans : Supabase Dashboard > SQL Editor > New query
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- 1. PROFILES ----------
-- Un profil par utilisateur. Le rôle détermine le tableau de bord et
-- les permissions. "owner" = propriétaire particulier (1-2 bateaux),
-- "broker" et "charter_company" = professionnels (flotte plus large),
-- "admin" = prévu dès maintenant, interface développée plus tard.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('skipper', 'owner', 'broker', 'charter_company', 'admin')),
  full_name text not null,
  phone text,
  avatar_url text,

  -- Champs demandeur (owner / broker / charter_company)
  company_name text,          -- utilisé par broker / charter_company
  fleet_size int,             -- nombre de bateaux gérés
  city text,

  -- Champs skipper
  experience_years int,
  zones text[] default '{}',
  boat_types text[] default '{}',
  languages text[] default '{}',
  permits text,
  certifications jsonb default '[]',   -- [{name, file_url, verified}]
  bio text,
  gallery_urls text[] default '{}',
  hourly_rate text,
  availability_note text,
  identity_verified boolean not null default false,

  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Public read of skipper profiles"
  on public.profiles for select
  using (role = 'skipper' or auth.uid() = id);

create policy "Admins can read all profiles"
  on public.profiles for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and identity_verified = (
      select p.identity_verified
      from public.profiles p
      where p.id = auth.uid()
    )
  );

create policy "Admins can update any profile"
  on public.profiles for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Auto-création du profil à l'inscription, à partir des métadonnées
-- passées à supabase.auth.signUp({ options: { data: {...} } }).
create function public.handle_new_user()
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
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 2. MISSIONS ----------
create table public.missions (
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
  is_featured boolean not null default false,   -- mise en avant par un admin
  posted_at timestamptz not null default now()
);

alter table public.missions enable row level security;

create policy "Anyone can read missions"
  on public.missions for select using (true);

create policy "Demandeurs can create their own missions"
  on public.missions for insert
  with check (
    auth.uid() = poster_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'broker', 'charter_company'))
  );

create policy "Posters can update their own missions"
  on public.missions for update
  using (auth.uid() = poster_id)
  with check (
    auth.uid() = poster_id
    and is_featured = (
      select m.is_featured
      from public.missions m
      where m.id = missions.id
    )
    and applicants_count = (
      select m.applicants_count
      from public.missions m
      where m.id = missions.id
    )
  );

create policy "Admins can update any mission"
  on public.missions for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create index missions_zone_idx on public.missions (zone);
create index missions_type_idx on public.missions (type);
create index missions_poster_idx on public.missions (poster_id);

-- ---------- 3. APPLICATIONS ----------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  skipper_id uuid not null references public.profiles(id) on delete cascade,
  phone text,
  message text,
  applied_at timestamptz not null default now(),
  unique (mission_id, skipper_id)
);

alter table public.applications enable row level security;

create policy "Applicant or mission owner can read applications"
  on public.applications for select
  using (
    auth.uid() = skipper_id
    or auth.uid() = (select poster_id from public.missions m where m.id = mission_id)
  );

create policy "Skippers can apply"
  on public.applications for insert
  with check (
    auth.uid() = skipper_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'skipper')
  );

create function public.increment_applicants_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.missions set applicants_count = applicants_count + 1 where id = new.mission_id;
  return new;
end;
$$;

create trigger on_application_created
  after insert on public.applications
  for each row execute function public.increment_applicants_count();

-- ---------- 4. CONVERSATIONS & MESSAGES ----------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  demandeur_id uuid not null references public.profiles(id) on delete cascade,
  skipper_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (mission_id, skipper_id)
);

alter table public.conversations enable row level security;

create policy "Participants can read their conversations"
  on public.conversations for select
  using (auth.uid() = demandeur_id or auth.uid() = skipper_id);

create policy "Demandeur can start a conversation"
  on public.conversations for insert
  with check (
    auth.uid() = demandeur_id
    and exists (
      select 1
      from public.missions m
      where m.id = mission_id
        and m.poster_id = auth.uid()
    )
    and exists (
      select 1
      from public.applications a
      where a.mission_id = mission_id
        and a.skipper_id = skipper_id
    )
  );

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "Participants can read messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.demandeur_id or auth.uid() = c.skipper_id)
    )
  );

create policy "Participants can send messages"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.demandeur_id or auth.uid() = c.skipper_id)
    )
  );

alter publication supabase_realtime add table public.messages;

-- ---------- 5. FAVORIS (schéma prêt, UI à développer plus tard) ----------
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  skipper_id uuid references public.profiles(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (
    (skipper_id is not null and mission_id is null)
    or (skipper_id is null and mission_id is not null)
  )
);

alter table public.favorites enable row level security;

create policy "Users manage their own favorites"
  on public.favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- 6. AVIS (schéma prêt, UI à développer plus tard) ----------
create table public.reviews (
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

create policy "Anyone can read reviews"
  on public.reviews for select using (true);

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

-- ---------- 7. NOTIFICATIONS (schéma prêt, UI à développer plus tard) ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Users read their own notifications"
  on public.notifications for select using (auth.uid() = user_id);

create policy "Users update their own notifications"
  on public.notifications for update using (auth.uid() = user_id);

-- ============================================================
-- Notes :
-- - Le rôle "admin" est prévu dans le check constraint et les policies,
--   mais aucune interface n'est développée pour l'instant — un compte
--   admin devra être créé/promu manuellement dans Supabase (Table Editor
--   > profiles > modifier la colonne "role").
-- - Les tables favorites/reviews/notifications existent et sont
--   sécurisées, mais ne sont pas encore branchées à l'interface.
-- ============================================================
