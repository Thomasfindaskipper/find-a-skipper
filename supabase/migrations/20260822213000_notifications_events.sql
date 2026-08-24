-- Add notifications for key product events.

create or replace function public.notify_on_application_created()
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

drop trigger if exists on_application_created_notify on public.applications;
create trigger on_application_created_notify
  after insert on public.applications
  for each row execute function public.notify_on_application_created();

create or replace function public.notify_on_application_status_changed()
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

drop trigger if exists on_application_status_update_notify on public.applications;
create trigger on_application_status_update_notify
  after update on public.applications
  for each row execute function public.notify_on_application_status_changed();

create or replace function public.notify_on_mission_status_changed()
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

drop trigger if exists on_mission_status_update_notify on public.missions;
create trigger on_mission_status_update_notify
  after update on public.missions
  for each row execute function public.notify_on_mission_status_changed();

create or replace function public.notify_on_message_created()
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

drop trigger if exists on_message_created_notify on public.messages;
create trigger on_message_created_notify
  after insert on public.messages
  for each row execute function public.notify_on_message_created();

drop policy if exists "Users update their own notifications" on public.notifications;
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

create index if not exists notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_read_created_at_idx
  on public.notifications (user_id, read, created_at desc);
