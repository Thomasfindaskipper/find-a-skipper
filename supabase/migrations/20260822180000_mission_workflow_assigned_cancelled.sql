-- Align mission/application workflow with open -> assigned -> completed/cancelled.

alter table public.missions
  add column if not exists requirements text;

update public.missions
set status = case
  when status in ('in_discussion', 'filled') then 'assigned'
  when status = 'completed' then 'completed'
  when status = 'cancelled' then 'cancelled'
  else coalesce(status, 'open')
end;

alter table public.missions
  alter column status set default 'open';

alter table public.missions
  alter column status set not null;

alter table public.missions
  drop constraint if exists missions_status_check;

alter table public.missions
  add constraint missions_status_check
  check (status in ('open', 'assigned', 'completed', 'cancelled'));

drop policy if exists "Demandeurs can create their own missions" on public.missions;
create policy "Demandeurs can create their own missions"
  on public.missions for insert
  with check (
    auth.uid() = poster_id
    and status = 'open'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner', 'broker', 'charter_company'))
  );

create or replace function public.enforce_mission_status_transition()
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

alter table public.applications
  alter column status set default 'pending';

alter table public.applications
  alter column status set not null;

alter table public.applications
  drop constraint if exists applications_status_check;

alter table public.applications
  add constraint applications_status_check
  check (status in ('pending', 'accepted', 'rejected'));

drop policy if exists "Skippers can apply" on public.applications;
create policy "Skippers can apply"
  on public.applications for insert
  with check (
    auth.uid() = skipper_id
    and status = 'pending'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'skipper')
    and exists (select 1 from public.missions m where m.id = mission_id and m.status = 'open')
  );

drop policy if exists "Mission owner or skipper can update application" on public.applications;
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

create unique index if not exists applications_single_accepted_per_mission_idx
  on public.applications (mission_id)
  where status = 'accepted';

create or replace function public.enforce_application_status_transition()
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

drop trigger if exists on_application_status_update on public.applications;
create trigger on_application_status_update
  before update on public.applications
  for each row execute function public.enforce_application_status_transition();

create or replace function public.sync_mission_status_from_application()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status = 'accepted' and old.status <> 'accepted' then
    update public.missions
    set status = 'assigned'
    where id = new.mission_id
      and status = 'open';
  end if;

  if tg_op = 'INSERT' and new.status = 'accepted' then
    update public.missions
    set status = 'assigned'
    where id = new.mission_id
      and status = 'open';
  end if;

  return new;
end;
$$;

drop trigger if exists on_application_status_sync_mission on public.applications;
create trigger on_application_status_sync_mission
  after insert or update on public.applications
  for each row execute function public.sync_mission_status_from_application();

create or replace function public.sync_mission_status_from_conversation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  return new;
end;
$$;

drop trigger if exists on_conversation_created_sync_mission on public.conversations;
create trigger on_conversation_created_sync_mission
  after insert on public.conversations
  for each row execute function public.sync_mission_status_from_conversation();