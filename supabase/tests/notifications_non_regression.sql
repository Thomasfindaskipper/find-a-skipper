-- Non-regression checks for notification event pipeline.

DO $$
DECLARE
  notifications_update_check text;
  trigger_count int;
  fn text;
BEGIN
  SELECT with_check
  INTO notifications_update_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'notifications'
    AND policyname = 'Users update their own notifications';

  IF notifications_update_check IS NULL THEN
    RAISE EXCEPTION 'Notifications update policy is missing';
  END IF;

  IF notifications_update_check NOT ILIKE '%type%' OR notifications_update_check NOT ILIKE '%payload%' THEN
    RAISE EXCEPTION 'Notifications update policy must lock type/payload';
  END IF;

  SELECT count(*)
  INTO trigger_count
  FROM pg_trigger tg
  JOIN pg_class tbl ON tbl.oid = tg.tgrelid
  JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
  WHERE ns.nspname = 'public'
    AND tbl.relname = 'applications'
    AND tg.tgname = 'on_application_created_notify'
    AND NOT tg.tgisinternal;

  IF trigger_count <> 1 THEN
    RAISE EXCEPTION 'Missing trigger on_application_created_notify';
  END IF;

  SELECT count(*)
  INTO trigger_count
  FROM pg_trigger tg
  JOIN pg_class tbl ON tbl.oid = tg.tgrelid
  JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
  WHERE ns.nspname = 'public'
    AND tbl.relname = 'applications'
    AND tg.tgname = 'on_application_status_update_notify'
    AND NOT tg.tgisinternal;

  IF trigger_count <> 1 THEN
    RAISE EXCEPTION 'Missing trigger on_application_status_update_notify';
  END IF;

  SELECT count(*)
  INTO trigger_count
  FROM pg_trigger tg
  JOIN pg_class tbl ON tbl.oid = tg.tgrelid
  JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
  WHERE ns.nspname = 'public'
    AND tbl.relname = 'missions'
    AND tg.tgname = 'on_mission_status_update_notify'
    AND NOT tg.tgisinternal;

  IF trigger_count <> 1 THEN
    RAISE EXCEPTION 'Missing trigger on_mission_status_update_notify';
  END IF;

  SELECT count(*)
  INTO trigger_count
  FROM pg_trigger tg
  JOIN pg_class tbl ON tbl.oid = tg.tgrelid
  JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
  WHERE ns.nspname = 'public'
    AND tbl.relname = 'messages'
    AND tg.tgname = 'on_message_created_notify'
    AND NOT tg.tgisinternal;

  IF trigger_count <> 1 THEN
    RAISE EXCEPTION 'Missing trigger on_message_created_notify';
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'notify_on_application_created';

  IF fn IS NULL OR fn NOT ILIKE '%application_created%' THEN
    RAISE EXCEPTION 'notify_on_application_created function is invalid';
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'notify_on_application_status_changed';

  IF fn IS NULL OR fn NOT ILIKE '%application_accepted%' OR fn NOT ILIKE '%application_rejected%' THEN
    RAISE EXCEPTION 'notify_on_application_status_changed function is invalid';
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'notify_on_mission_status_changed';

  IF fn IS NULL OR fn NOT ILIKE '%mission_assigned%' OR fn NOT ILIKE '%mission_status_changed%' THEN
    RAISE EXCEPTION 'notify_on_mission_status_changed function is invalid';
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'notify_on_message_created';

  IF fn IS NULL OR fn NOT ILIKE '%message_new%' THEN
    RAISE EXCEPTION 'notify_on_message_created function is invalid';
  END IF;
END $$;
