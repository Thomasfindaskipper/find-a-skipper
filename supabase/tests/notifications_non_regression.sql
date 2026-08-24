-- Non-regression checks scoped to the 4 blockers only:
-- 3) notification type naming is normalized
-- 4) auto-reject notification is emitted via status-change notifier

DO $$
DECLARE
  fn text;
  trigger_count int;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'notify_on_application_created';

  IF fn IS NULL OR fn NOT ILIKE '%new_application%' OR fn ILIKE '%''application_created''%' THEN
    RAISE EXCEPTION 'notify_on_application_created must use only new_application';
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'notify_on_message_created';

  IF fn IS NULL OR fn NOT ILIKE '%new_message%' OR fn ILIKE '%''message_new''%' THEN
    RAISE EXCEPTION 'notify_on_message_created must use only new_message';
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'notify_application_status_changed';

  IF fn IS NULL OR fn NOT ILIKE '%application_rejected%' OR fn NOT ILIKE '%''status'', new.status%' THEN
    RAISE EXCEPTION 'notify_application_status_changed must emit application_rejected notification';
  END IF;

  SELECT count(*)
  INTO trigger_count
  FROM pg_trigger tg
  JOIN pg_class tbl ON tbl.oid = tg.tgrelid
  JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
  WHERE ns.nspname = 'public'
    AND tbl.relname = 'applications'
    AND tg.tgname IN ('on_application_status_notification', 'on_application_status_update_notify')
    AND NOT tg.tgisinternal;

  IF trigger_count < 1 THEN
    RAISE EXCEPTION 'Missing application status notification trigger';
  END IF;
END $$;
