-- Enforce accepted-only messaging access and single-finalized applicant behavior.

create or replace function public.sync_mission_status_from_application()
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

drop policy if exists "Demandeur can start a conversation" on public.conversations;
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
