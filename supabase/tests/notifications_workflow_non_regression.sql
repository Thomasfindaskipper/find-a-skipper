-- Notifications hardening non-regression:
-- - update policy is read-only except read flag
-- - event functions match workflow transitions
-- - message notifications require accepted application

DO $$
DECLARE
  notif_update_check text;
  fn text;
  trigger_count int;
BEGIN
  SELECT with_check
  INTO notif_update_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'notifications'
    AND policyname = 'Users update their own notifications';

  IF notif_update_check IS NULL
     OR notif_update_check NOT ILIKE '%user_id = (%'
     OR notif_update_check NOT ILIKE '%type = (%'
     OR notif_update_check NOT ILIKE '%payload = (%'
     OR notif_update_check NOT ILIKE '%created_at = (%' THEN
    RAISE EXCEPTION 'Notifications update policy must lock user_id/type/payload/created_at';
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'notify_on_application_created';

  IF fn IS NULL
     OR fn NOT ILIKE '%new.status <> ''pending''%'
     OR fn NOT ILIKE '%new_application%' THEN
    RAISE EXCEPTION 'notify_on_application_created must emit only for pending applications';
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'notify_application_status_changed';

  IF fn IS NULL
     OR fn NOT ILIKE '%old.status = ''pending'' and new.status in (''accepted'', ''rejected'')%'
     OR fn NOT ILIKE '%application_accepted%'
     OR fn NOT ILIKE '%application_rejected%'
     OR fn NOT ILIKE '%''status'', new.status%' THEN
    RAISE EXCEPTION 'notify_application_status_changed must enforce pending -> accepted/rejected notifications';
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'notify_on_message_created';

  IF fn IS NULL
     OR fn NOT ILIKE '%a.status = ''accepted''%'
     OR fn NOT ILIKE '%new_message%' THEN
    RAISE EXCEPTION 'notify_on_message_created must require accepted application';
  END IF;

  SELECT count(*)
  INTO trigger_count
  FROM pg_trigger tg
  JOIN pg_class tbl ON tbl.oid = tg.tgrelid
  JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
  WHERE ns.nspname = 'public'
    AND tbl.relname = 'applications'
    AND tg.tgname = 'on_application_status_notification'
    AND NOT tg.tgisinternal;

  IF trigger_count <> 1 THEN
    RAISE EXCEPTION 'Missing trigger on_application_status_notification';
  END IF;
END $$;

BEGIN;

DO $$
DECLARE
  owner_id uuid;
  skipper_a uuid;
  v_mission_id uuid;
  app_a_id uuid;
  conv_id uuid;
  before_pending_msg_notifs int;
  after_pending_msg_notifs int;
  accepted_notifs int;
  after_accepted_msg_notifs int;
BEGIN
  SELECT id INTO owner_id
  FROM public.profiles
  WHERE role = 'owner'
  LIMIT 1;

  SELECT id INTO skipper_a
  FROM public.profiles
  WHERE role = 'skipper'
    AND id <> owner_id
  LIMIT 1;

  IF owner_id IS NULL OR skipper_a IS NULL THEN
    RAISE EXCEPTION 'Not enough seeded profiles for notifications workflow test';
  END IF;

  INSERT INTO public.missions (
    poster_id,
    type,
    boat_type,
    zone,
    departure,
    destination,
    start_date,
    title,
    status
  )
  VALUES (
    owner_id,
    'Convoyage',
    'catamaran',
    'mediterranean',
    'Toulon',
    'Bastia',
    (now() + interval '9 days')::date,
    'Notifications workflow regression mission',
    'open'
  )
  RETURNING id INTO v_mission_id;

  INSERT INTO public.applications (mission_id, skipper_id, status)
  VALUES (v_mission_id, skipper_a, 'pending')
  RETURNING id INTO app_a_id;

  INSERT INTO public.conversations (mission_id, demandeur_id, skipper_id)
  VALUES (v_mission_id, owner_id, skipper_a)
  RETURNING id INTO conv_id;

  SELECT count(*) INTO before_pending_msg_notifs
  FROM public.notifications n
  WHERE n.type = 'new_message'
    AND n.payload ->> 'conversation_id' = conv_id::text;

  INSERT INTO public.messages (conversation_id, sender_id, text)
  VALUES (conv_id, skipper_a, 'pending message should not notify');

  SELECT count(*) INTO after_pending_msg_notifs
  FROM public.notifications n
  WHERE n.type = 'new_message'
    AND n.payload ->> 'conversation_id' = conv_id::text;

  IF after_pending_msg_notifs <> before_pending_msg_notifs THEN
    RAISE EXCEPTION 'new_message notification emitted before accepted application';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  UPDATE public.applications
  SET status = 'accepted'
  WHERE id = app_a_id;
  EXECUTE 'RESET ROLE';

  SELECT count(*) INTO accepted_notifs
  FROM public.notifications n
  WHERE n.user_id = skipper_a
    AND n.type = 'application_accepted'
    AND n.payload ->> 'mission_id' = v_mission_id::text
    AND n.payload ->> 'application_id' = app_a_id::text
    AND n.payload ->> 'status' = 'accepted';

  IF accepted_notifs < 1 THEN
    RAISE EXCEPTION 'application_accepted notification not emitted for accepted transition';
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, text)
  VALUES (conv_id, skipper_a, 'accepted message should notify');

  SELECT count(*) INTO after_accepted_msg_notifs
  FROM public.notifications n
  WHERE n.type = 'new_message'
    AND n.payload ->> 'conversation_id' = conv_id::text;

  IF after_accepted_msg_notifs < (after_pending_msg_notifs + 1) THEN
    RAISE EXCEPTION 'new_message notification missing after accepted application';
  END IF;
END $$;

ROLLBACK;