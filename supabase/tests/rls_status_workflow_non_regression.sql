-- Non-regression checks for MVP status workflow and RLS.
-- Run in Supabase SQL editor after migrations are applied.

DO $$
DECLARE
  mission_insert_check text;
  applications_insert_check text;
  applications_update_using text;
  applications_update_check text;
  mission_update_using text;
  mission_update_check text;
  mission_status_constraint text;
  application_status_constraint text;
  trigger_count int;
  function_body text;
  mission_transition_body text;
  conversation_transition_body text;
  accepted_index_count int;
BEGIN
  -- missions.status constraint
  SELECT pg_get_constraintdef(c.oid)
  INTO mission_status_constraint
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'missions'
    AND c.conname = 'missions_status_check';

  IF mission_status_constraint IS NULL
     OR mission_status_constraint NOT ILIKE '%open%'
     OR mission_status_constraint NOT ILIKE '%assigned%'
     OR mission_status_constraint NOT ILIKE '%completed%'
     OR mission_status_constraint NOT ILIKE '%cancelled%' THEN
    RAISE EXCEPTION 'missions.status constraint is missing or invalid';
  END IF;

  SELECT with_check
  INTO mission_insert_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'missions'
    AND policyname = 'Demandeurs can create their own missions';

  IF mission_insert_check IS NULL
     OR mission_insert_check NOT ILIKE '%status = ''open''%'
     OR mission_insert_check NOT ILIKE '%owner%'
     OR mission_insert_check NOT ILIKE '%broker%'
     OR mission_insert_check NOT ILIKE '%charter_company%' THEN
    RAISE EXCEPTION 'Mission insert policy must require open status and demandeur roles';
  END IF;

  -- applications.status constraint
  SELECT pg_get_constraintdef(c.oid)
  INTO application_status_constraint
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'applications'
    AND c.conname = 'applications_status_check';

  IF application_status_constraint IS NULL
     OR application_status_constraint NOT ILIKE '%pending%'
     OR application_status_constraint NOT ILIKE '%accepted%'
      OR application_status_constraint NOT ILIKE '%rejected%' THEN
    RAISE EXCEPTION 'applications.status constraint is missing or invalid';
  END IF;

  -- insert policy must require mission open
  SELECT with_check
  INTO applications_insert_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'applications'
    AND policyname = 'Skippers can apply';

  IF applications_insert_check IS NULL
      OR applications_insert_check NOT ILIKE '%m.status = ''open''%'
      OR applications_insert_check NOT ILIKE '%status = ''pending''%' THEN
    RAISE EXCEPTION 'Skippers can apply policy must require mission status open';
  END IF;

  -- update policy must allow only owner of mission or skipper
  SELECT qual, with_check
  INTO applications_update_using, applications_update_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'applications'
    AND policyname = 'Mission owner or skipper can update application';

  IF applications_update_using IS NULL OR applications_update_check IS NULL THEN
    RAISE EXCEPTION 'Mission owner or skipper update policy is missing';
  END IF;

  IF applications_update_using NOT ILIKE '%auth.uid() = skipper_id%'
     OR applications_update_using NOT ILIKE '%poster_id%' THEN
    RAISE EXCEPTION 'applications update USING policy is missing skipper/owner guards';
  END IF;

  IF applications_update_check NOT ILIKE '%auth.uid() = skipper_id%'
     OR applications_update_check NOT ILIKE '%poster_id%' THEN
    RAISE EXCEPTION 'applications update WITH CHECK policy is missing skipper/owner guards';
  END IF;

  SELECT qual, with_check
  INTO mission_update_using, mission_update_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'missions'
    AND policyname = 'Posters can update their own missions';

  IF mission_update_using IS NULL OR mission_update_check IS NULL THEN
    RAISE EXCEPTION 'Mission update policy is missing';
  END IF;

  IF mission_update_using NOT ILIKE '%auth.uid() = poster_id%'
     OR mission_update_check NOT ILIKE '%auth.uid() = poster_id%' THEN
    RAISE EXCEPTION 'Mission update policy must lock poster ownership';
  END IF;

  -- partial unique index to prevent multiple accepted applications per mission
  SELECT count(*)
  INTO accepted_index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'applications'
    AND indexname = 'applications_single_accepted_per_mission_idx'
    AND indexdef ILIKE '%WHERE (status = ''accepted''::text)%';

  IF accepted_index_count <> 1 THEN
    RAISE EXCEPTION 'Missing or invalid single accepted application index';
  END IF;

  -- trigger existence for transition enforcement and mission sync
  SELECT count(*)
  INTO trigger_count
  FROM pg_trigger tg
  JOIN pg_class tbl ON tbl.oid = tg.tgrelid
  JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
  WHERE ns.nspname = 'public'
    AND tbl.relname = 'applications'
    AND tg.tgname = 'on_application_status_update'
    AND NOT tg.tgisinternal;

  IF trigger_count <> 1 THEN
    RAISE EXCEPTION 'Missing trigger on_application_status_update';
  END IF;

  SELECT count(*)
  INTO trigger_count
  FROM pg_trigger tg
  JOIN pg_class tbl ON tbl.oid = tg.tgrelid
  JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
  WHERE ns.nspname = 'public'
    AND tbl.relname = 'applications'
    AND tg.tgname = 'on_application_status_sync_mission'
    AND NOT tg.tgisinternal;

  IF trigger_count <> 1 THEN
    RAISE EXCEPTION 'Missing trigger on_application_status_sync_mission';
  END IF;

  SELECT count(*)
  INTO trigger_count
  FROM pg_trigger tg
  JOIN pg_class tbl ON tbl.oid = tg.tgrelid
  JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
  WHERE ns.nspname = 'public'
    AND tbl.relname = 'missions'
    AND tg.tgname = 'on_mission_status_update'
    AND NOT tg.tgisinternal;

  IF trigger_count <> 1 THEN
    RAISE EXCEPTION 'Missing trigger on_mission_status_update';
  END IF;

  SELECT count(*)
  INTO trigger_count
  FROM pg_trigger tg
  JOIN pg_class tbl ON tbl.oid = tg.tgrelid
  JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
  WHERE ns.nspname = 'public'
    AND tbl.relname = 'conversations'
    AND tg.tgname = 'on_conversation_created_sync_mission'
    AND NOT tg.tgisinternal;

  IF trigger_count <> 1 THEN
    RAISE EXCEPTION 'Missing trigger on_conversation_created_sync_mission';
  END IF;

  -- function body sanity checks for transition semantics
  SELECT pg_get_functiondef(p.oid)
  INTO function_body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'enforce_application_status_transition';

  IF function_body IS NULL
     OR function_body NOT ILIKE '%pending%'
     OR function_body NOT ILIKE '%accepted%'
     OR function_body NOT ILIKE '%rejected%' THEN
    RAISE EXCEPTION 'Transition function is missing expected status guards';
  END IF;

  IF function_body NOT ILIKE '%Mission must be open to accept an application%' THEN
    RAISE EXCEPTION 'Transition function must block acceptance on closed missions';
  END IF;

  IF function_body NOT ILIKE '%Only status can be updated on applications%' THEN
    RAISE EXCEPTION 'Transition function does not enforce status-only updates';
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO mission_transition_body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'enforce_mission_status_transition';

  IF mission_transition_body IS NULL
     OR mission_transition_body NOT ILIKE '%open%'
     OR mission_transition_body NOT ILIKE '%assigned%'
     OR mission_transition_body NOT ILIKE '%completed%'
     OR mission_transition_body NOT ILIKE '%cancelled%' THEN
    RAISE EXCEPTION 'Mission transition function is missing expected status guards';
  END IF;

  IF mission_transition_body NOT ILIKE '%Only status can be updated on missions%' THEN
    RAISE EXCEPTION 'Mission transition function does not enforce status-only updates';
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO conversation_transition_body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'sync_mission_status_from_conversation';

  IF conversation_transition_body IS NULL
     OR conversation_transition_body ILIKE '%set status = ''in_discussion''%' THEN
    RAISE EXCEPTION 'Conversation trigger must not mutate mission status anymore';
  END IF;
END $$;
