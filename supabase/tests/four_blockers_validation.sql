begin;

DO $$
DECLARE
  owner_id uuid;
  skipper_a uuid;
  skipper_b uuid;
  v_mission_id uuid;
  app_a_id uuid;
  app_b_id uuid;
  conv_id uuid;
  mission_status text;
  app_b_status text;
  rejected_count int;
  new_application_count int;
  new_message_count int;
  old_application_created_count int;
  old_message_new_count int;
  auto_reject_notif_count int;
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

  SELECT id INTO skipper_b
  FROM public.profiles
  WHERE role = 'skipper'
    AND id <> owner_id
    AND id <> skipper_a
  LIMIT 1;

  IF owner_id IS NULL OR skipper_a IS NULL OR skipper_b IS NULL THEN
    RAISE EXCEPTION 'Not enough seeded profiles (owner + 2 skippers) for validation';
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
    'Marseille',
    'Ajaccio',
    (now() + interval '14 days')::date,
    'Validation mission blockers',
    'open'
  )
  RETURNING id INTO v_mission_id;

  INSERT INTO public.applications (mission_id, skipper_id, status)
  VALUES (v_mission_id, skipper_a, 'pending')
  RETURNING id INTO app_a_id;

  INSERT INTO public.applications (mission_id, skipper_id, status)
  VALUES (v_mission_id, skipper_b, 'pending')
  RETURNING id INTO app_b_id;

  -- Blocker 1: pending application cannot open/create conversation.
  PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    INSERT INTO public.conversations (mission_id, demandeur_id, skipper_id)
    VALUES (v_mission_id, owner_id, skipper_a);
    RAISE EXCEPTION 'Blocker 1 failed: pending conversation insert unexpectedly succeeded';
  EXCEPTION
    WHEN OTHERS THEN
      IF position('row-level security' in SQLERRM) = 0 AND position('permission denied' in SQLERRM) = 0 THEN
        RAISE;
      END IF;
  END;
  EXECUTE 'RESET ROLE';

  -- Blocker 2: accepting one application auto-rejects others and assigns mission.
  UPDATE public.applications
  SET status = 'accepted'
  WHERE id = app_a_id;

  SELECT status INTO mission_status
  FROM public.missions
  WHERE id = v_mission_id;

  IF mission_status <> 'assigned' THEN
    RAISE EXCEPTION 'Blocker 2 failed: mission status is %, expected assigned', mission_status;
  END IF;

  SELECT status INTO app_b_status
  FROM public.applications
  WHERE id = app_b_id;

  IF app_b_status <> 'rejected' THEN
    RAISE EXCEPTION 'Blocker 2 failed: non-selected application status is %, expected rejected', app_b_status;
  END IF;

  SELECT count(*) INTO rejected_count
  FROM public.applications
  WHERE mission_id = v_mission_id
    AND status = 'rejected';

  IF rejected_count < 1 THEN
    RAISE EXCEPTION 'Blocker 2 failed: no rejected application found after acceptance';
  END IF;

  INSERT INTO public.conversations (mission_id, demandeur_id, skipper_id)
  VALUES (v_mission_id, owner_id, skipper_a)
  ON CONFLICT (mission_id, skipper_id) DO NOTHING
  RETURNING id INTO conv_id;

  IF conv_id IS NULL THEN
    SELECT c.id INTO conv_id
    FROM public.conversations c
    WHERE c.mission_id = v_mission_id
      AND c.skipper_id = skipper_a;
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, text)
  VALUES (conv_id, skipper_a, 'Validation ping');

  -- Blocker 3: notification naming unified to new_application/new_message.
  SELECT count(*) INTO new_application_count
  FROM public.notifications n
  WHERE n.type = 'new_application'
    AND n.payload ->> 'mission_id' = v_mission_id::text;

  SELECT count(*) INTO new_message_count
  FROM public.notifications n
  WHERE n.type = 'new_message'
    AND n.payload ->> 'mission_id' = v_mission_id::text;

  SELECT count(*) INTO old_application_created_count
  FROM public.notifications n
  WHERE n.type = 'application_created'
    AND n.payload ->> 'mission_id' = v_mission_id::text;

  SELECT count(*) INTO old_message_new_count
  FROM public.notifications n
  WHERE n.type = 'message_new'
    AND n.payload ->> 'mission_id' = v_mission_id::text;

  IF new_application_count < 2 THEN
    RAISE EXCEPTION 'Blocker 3 failed: expected >=2 new_application notifications, got %', new_application_count;
  END IF;

  IF new_message_count < 1 THEN
    RAISE EXCEPTION 'Blocker 3 failed: expected >=1 new_message notification, got %', new_message_count;
  END IF;

  IF old_application_created_count <> 0 OR old_message_new_count <> 0 THEN
    RAISE EXCEPTION 'Blocker 3 failed: legacy notification types detected for test mission';
  END IF;

  -- Blocker 4: auto-rejected skipper receives rejected notification.
  SELECT count(*) INTO auto_reject_notif_count
  FROM public.notifications n
  WHERE n.user_id = skipper_b
    AND n.type = 'application_rejected'
    AND n.payload ->> 'mission_id' = v_mission_id::text
    AND n.payload ->> 'application_id' = app_b_id::text
    AND n.payload ->> 'status' = 'rejected';

  IF auto_reject_notif_count < 1 THEN
    RAISE EXCEPTION 'Blocker 4 failed: auto-rejected notification not found';
  END IF;
END $$;

ROLLBACK;

SELECT 'four_blockers_validation_ok' AS result;
