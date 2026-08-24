-- Non-regression checks scoped to the 4 blockers only:
-- 1) accepted-only conversation/message access
-- 2) acceptance auto-reject side-effect + mission assigned sync

DO $$
DECLARE
  conversation_insert_check text;
  conversation_select_using text;
  messages_select_using text;
  messages_insert_check text;
  trigger_count int;
  fn text;
BEGIN
  SELECT with_check
  INTO conversation_insert_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'conversations'
    AND policyname = 'Demandeur can start a conversation';

  IF conversation_insert_check IS NULL
     OR conversation_insert_check NOT ILIKE '%a.status = ''accepted''%'
     OR conversation_insert_check NOT ILIKE '%conversations.mission_id%'
     OR conversation_insert_check NOT ILIKE '%conversations.skipper_id%' THEN
    RAISE EXCEPTION 'Conversation insert policy must enforce accepted app with qualified columns';
  END IF;

  SELECT qual
  INTO conversation_select_using
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'conversations'
    AND policyname = 'Participants can read their conversations';

  IF conversation_select_using IS NULL
     OR conversation_select_using NOT ILIKE '%a.status = ''accepted''%' THEN
    RAISE EXCEPTION 'Conversation read policy must require accepted application';
  END IF;

  SELECT with_check
  INTO messages_insert_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'messages'
    AND policyname = 'Participants can send messages';

  IF messages_insert_check IS NULL
     OR messages_insert_check NOT ILIKE '%a.status = ''accepted''%' THEN
    RAISE EXCEPTION 'Messages insert policy must require accepted application';
  END IF;

  SELECT qual
  INTO messages_select_using
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'messages'
    AND policyname = 'Participants can read messages';

  IF messages_select_using IS NULL
     OR messages_select_using NOT ILIKE '%a.status = ''accepted''%' THEN
    RAISE EXCEPTION 'Messages read policy must require accepted application';
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

  SELECT pg_get_functiondef(p.oid)
  INTO fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'sync_mission_status_from_application';

  IF fn IS NULL
     OR fn NOT ILIKE '%SET status = ''rejected''%'
     OR fn NOT ILIKE '%status = ''pending''%'
     OR fn NOT ILIKE '%SET status = ''assigned''%'
     OR fn NOT ILIKE '%status = ''open''%' THEN
    RAISE EXCEPTION 'sync_mission_status_from_application must auto-reject pending and assign mission';
  END IF;
END $$;
