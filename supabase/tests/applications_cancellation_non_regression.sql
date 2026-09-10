-- Non-regression checks for skipper-side application cancellation.

DO $$
DECLARE
  delete_using text;
  delete_trigger_count int;
  decrement_fn text;
BEGIN
  SELECT qual
  INTO delete_using
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'applications'
    AND policyname = 'Skippers can cancel pending applications';

  IF delete_using IS NULL
     OR delete_using NOT ILIKE '%auth.uid() = applications.skipper_id%'
     OR delete_using NOT ILIKE '%applications.status = ''pending''%'
     OR delete_using NOT ILIKE '%p.role = ''skipper''%' THEN
    RAISE EXCEPTION 'Skippers can cancel pending applications policy is missing or too permissive';
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO decrement_fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'decrement_applicants_count_on_delete';

  IF decrement_fn IS NULL
     OR decrement_fn NOT ILIKE '%GREATEST(applicants_count - 1, 0)%'
     OR decrement_fn NOT ILIKE '%WHERE id = OLD.mission_id%' THEN
    RAISE EXCEPTION 'decrement_applicants_count_on_delete must safely decrement mission applicants_count';
  END IF;

  SELECT count(*)
  INTO delete_trigger_count
  FROM pg_trigger tg
  JOIN pg_class tbl ON tbl.oid = tg.tgrelid
  JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
  WHERE ns.nspname = 'public'
    AND tbl.relname = 'applications'
    AND tg.tgname = 'on_application_deleted'
    AND NOT tg.tgisinternal;

  IF delete_trigger_count <> 1 THEN
    RAISE EXCEPTION 'Missing trigger on_application_deleted on applications';
  END IF;
END $$;
