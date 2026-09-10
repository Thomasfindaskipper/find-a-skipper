-- MVP status workflow and RLS hardening for missions/applications.

alter table public.missions
  add column if not exists status text;

update public.missions
set status = coalesce(status, 'open');

alter table public.missions
  alter column status set default 'open';

alter table public.missions
  alter column status set not null;

alter table public.missions
  drop constraint if exists missions_status_check;

alter table public.missions
  add constraint missions_status_check
  check (status in ('open', 'in_discussion', 'filled', 'assigned', 'completed', 'cancelled'));

alter table public.applications
  add column if not exists status text;

update public.applications
set status = coalesce(status, 'pending');

alter table public.applications
  alter column status set default 'pending';

alter table public.applications
  alter column status set not null;

alter table public.applications
  drop constraint if exists applications_status_check;

alter table public.applications
  add constraint applications_status_check
  check (status in ('pending', 'accepted', 'rejected', 'withdrawn'));

drop policy if exists "Skippers can apply" on public.applications;
create policy "Skippers can apply"
  on public.applications for insert
  with check (
    auth.uid() = skipper_id
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

  if auth.uid() is null then
    raise exception 'Authentication required for status transition';
  end if;

  if auth.uid() = old.skipper_id then
    if not (old.status = 'pending' and new.status = 'withdrawn') then
      raise exception 'Skipper can only move pending application to withdrawn';
    end if;
  elsif auth.uid() = mission_owner then
    if not (old.status = 'pending' and new.status in ('accepted', 'rejected')) then
      raise exception 'Owner can only accept or reject a pending application';
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
    set status = 'filled'
    where id = new.mission_id
      and status in ('open', 'in_discussion');
  end if;

  if tg_op = 'INSERT' and new.status = 'accepted' then
    update public.missions
    set status = 'filled'
    where id = new.mission_id
      and status in ('open', 'in_discussion');
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
  update public.missions
  set status = 'in_discussion'
  where id = new.mission_id
    and status = 'open';

  return new;
end;
$$;

drop trigger if exists on_conversation_created_sync_mission on public.conversations;
create trigger on_conversation_created_sync_mission
  after insert on public.conversations
  for each row execute function public.sync_mission_status_from_conversation();
