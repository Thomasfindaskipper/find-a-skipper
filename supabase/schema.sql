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
  onboarding_step text check (onboarding_step in ('role_details', 'done')),
  onboarding_completed_at timestamptz,

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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 2. MISSIONS ----------
create table public.missions (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'assigned', 'completed', 'cancelled')),
  type text not null check (type in ('À la journée', 'À la semaine', 'Saisonnier', 'Convoyage', 'Autre')),
  boat_type text not null,
  zone text not null,
  departure text not null,
  destination text,
  start_date date not null,
  duration text,
  compensation text,
  description text,
  requirements text,
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
    and status = 'open'
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
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
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
    and status = 'pending'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'skipper')
    and exists (select 1 from public.missions m where m.id = mission_id and m.status = 'open')
  );

create policy "Mission owner or skipper can update application"
  on public.applications for update
  using (
    auth.uid() = skipper_id
    or auth.uid() = (select m.poster_id from public.missions m where m.id = mission_id)
  )
  with check (
    auth.uid() = skipper_id
    or auth.uid() = (select m.poster_id from public.missions m where m.id = mission_id)
  );

create unique index applications_single_accepted_per_mission_idx
  on public.applications (mission_id)
  where status = 'accepted';

create function public.enforce_mission_status_transition()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if new.id <> old.id
     or new.poster_id <> old.poster_id
     or new.type <> old.type
     or new.boat_type <> old.boat_type
     or new.zone <> old.zone
     or new.departure <> old.departure
     or coalesce(new.destination, '') <> coalesce(old.destination, '')
     or new.start_date <> old.start_date
     or coalesce(new.duration, '') <> coalesce(old.duration, '')
     or coalesce(new.compensation, '') <> coalesce(old.compensation, '')
     or coalesce(new.description, '') <> coalesce(old.description, '')
     or coalesce(new.requirements, '') <> coalesce(old.requirements, '')
     or new.applicants_count <> old.applicants_count
     or new.is_featured <> old.is_featured
     or new.posted_at <> old.posted_at then
    raise exception 'Only status can be updated on missions';
  end if;

  if auth.uid() <> old.poster_id then
    raise exception 'Not allowed to change this mission status';
  end if;

  if old.status = 'open' and new.status in ('assigned', 'cancelled') then
    return new;
  end if;

  if old.status = 'assigned' and new.status in ('completed', 'cancelled') then
    return new;
  end if;

  raise exception 'Invalid mission status transition';
end;
$$;

drop trigger if exists on_mission_status_update on public.missions;
create trigger on_mission_status_update
  before update on public.missions
  for each row execute function public.enforce_mission_status_transition();

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

create function public.notify_on_application_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  mission_owner uuid;
begin
  select m.poster_id into mission_owner
  from public.missions m
  where m.id = new.mission_id;

  if mission_owner is not null then
    insert into public.notifications (user_id, type, payload)
    values (
      mission_owner,
      'application_created',
      jsonb_build_object(
        'mission_id', new.mission_id,
        'application_id', new.id,
        'skipper_id', new.skipper_id
      )
    );
  end if;

  return new;
end;
$$;

create trigger on_application_created_notify
  after insert on public.applications
  for each row execute function public.notify_on_application_created();

create function public.enforce_application_status_transition()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  mission_owner uuid;
  mission_status text;
begin
  if new.status = old.status then
    return new;
  end if;

  if new.mission_id <> old.mission_id
     or new.skipper_id <> old.skipper_id
     or coalesce(new.phone, '') <> coalesce(old.phone, '')
     or coalesce(new.message, '') <> coalesce(old.message, '')
     or new.applied_at <> old.applied_at then
    raise exception 'Only status can be updated on applications';
  end if;

  select m.poster_id into mission_owner
  from public.missions m
  where m.id = old.mission_id;

  select m.status into mission_status
  from public.missions m
  where m.id = old.mission_id;

  if auth.uid() is null then
    raise exception 'Authentication required for status transition';
  end if;

  if auth.uid() = mission_owner then
    if not (old.status = 'pending' and new.status in ('accepted', 'rejected')) then
      raise exception 'Owner can only accept or reject a pending application';
    end if;

    if new.status = 'accepted' and mission_status <> 'open' then
      raise exception 'Mission must be open to accept an application';
    end if;
  else
    raise exception 'Not allowed to change this application status';
  end if;

  return new;
end;
$$;

create trigger on_application_status_update
  before update on public.applications
  for each row execute function public.enforce_application_status_transition();

create function public.notify_on_application_status_changed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status <> old.status and new.status in ('accepted', 'rejected') then
    insert into public.notifications (user_id, type, payload)
    values (
      new.skipper_id,
      case when new.status = 'accepted' then 'application_accepted' else 'application_rejected' end,
      jsonb_build_object(
        'mission_id', new.mission_id,
        'application_id', new.id,
        'status', new.status
      )
    );
  end if;

  return new;
end;
$$;

create trigger on_application_status_update_notify
  after update on public.applications
  for each row execute function public.notify_on_application_status_changed();

create function public.sync_mission_status_from_application()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status = 'accepted' and old.status <> 'accepted' then
    update public.applications
    set status = 'rejected'
    where mission_id = new.mission_id
      and id <> new.id
      and status = 'pending';

    update public.missions
    set status = 'assigned'
    where id = new.mission_id
      and status = 'open';
  end if;

  if tg_op = 'INSERT' and new.status = 'accepted' then
    update public.applications
    set status = 'rejected'
    where mission_id = new.mission_id
      and id <> new.id
      and status = 'pending';

    update public.missions
    set status = 'assigned'
    where id = new.mission_id
      and status = 'open';
  end if;

  return new;
end;
$$;

create trigger on_application_status_sync_mission
  after insert or update on public.applications
  for each row execute function public.sync_mission_status_from_application();

create function public.notify_on_mission_status_changed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  accepted_skipper_id uuid;
begin
  if new.status = old.status then
    return new;
  end if;

  select a.skipper_id into accepted_skipper_id
  from public.applications a
  where a.mission_id = new.id and a.status = 'accepted'
  limit 1;

  if new.status = 'assigned' and accepted_skipper_id is not null then
    insert into public.notifications (user_id, type, payload)
    values (
      accepted_skipper_id,
      'mission_assigned',
      jsonb_build_object(
        'mission_id', new.id,
        'new_status', new.status
      )
    );
  elsif new.status in ('completed', 'cancelled') and accepted_skipper_id is not null then
    insert into public.notifications (user_id, type, payload)
    values (
      accepted_skipper_id,
      'mission_status_changed',
      jsonb_build_object(
        'mission_id', new.id,
        'old_status', old.status,
        'new_status', new.status
      )
    );
  end if;

  return new;
end;
$$;

create trigger on_mission_status_update_notify
  after update on public.missions
  for each row execute function public.notify_on_mission_status_changed();

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
        and a.status = 'accepted'
    )
  );

create function public.sync_mission_status_from_conversation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  return new;
end;
$$;

create trigger on_conversation_created_sync_mission
  after insert on public.conversations
  for each row execute function public.sync_mission_status_from_conversation();

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

create function public.notify_on_message_created()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  conv_demandeur uuid;
  conv_skipper uuid;
  conv_mission uuid;
  recipient_id uuid;
begin
  select c.demandeur_id, c.skipper_id, c.mission_id
  into conv_demandeur, conv_skipper, conv_mission
  from public.conversations c
  where c.id = new.conversation_id;

  if conv_demandeur is null or conv_skipper is null then
    return new;
  end if;

  if new.sender_id = conv_demandeur then
    recipient_id := conv_skipper;
  else
    recipient_id := conv_demandeur;
  end if;

  if recipient_id is not null and recipient_id <> new.sender_id then
    insert into public.notifications (user_id, type, payload)
    values (
      recipient_id,
      'message_new',
      jsonb_build_object(
        'conversation_id', new.conversation_id,
        'mission_id', conv_mission,
        'sender_id', new.sender_id,
        'message_id', new.id
      )
    );
  end if;

  return new;
end;
$$;

create trigger on_message_created_notify
  after insert on public.messages
  for each row execute function public.notify_on_message_created();

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
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and user_id = (select n.user_id from public.notifications n where n.id = notifications.id)
    and type = (select n.type from public.notifications n where n.id = notifications.id)
    and payload = (select n.payload from public.notifications n where n.id = notifications.id)
    and created_at = (select n.created_at from public.notifications n where n.id = notifications.id)
  );

create index notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);

create index notifications_user_read_created_at_idx
  on public.notifications (user_id, read, created_at desc);

-- ============================================================
-- Notes :
-- - Le rôle "admin" est prévu dans le check constraint et les policies,
--   mais aucune interface n'est développée pour l'instant — un compte
--   admin devra être créé/promu manuellement dans Supabase (Table Editor
--   > profiles > modifier la colonne "role").
-- - Les tables favorites/reviews/notifications existent et sont
--   sécurisées, mais ne sont pas encore branchées à l'interface.
-- ============================================================
