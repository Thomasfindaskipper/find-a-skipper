-- Non-regression checks for applications-only hardening.

DO $$
DECLARE
  apply_with_check text;
  owner_update_using text;
  owner_update_check text;
  transition_fn text;
  transition_trigger_count int;
BEGIN
  SELECT with_check
  INTO apply_with_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'applications'
    AND policyname = 'Skippers can apply';

  IF apply_with_check IS NULL
     OR apply_with_check NOT ILIKE '%status = ''pending''%'
     OR apply_with_check NOT ILIKE '%m.status = ''open''%'
     OR apply_with_check NOT ILIKE '%p.role = ''skipper''%' THEN
    RAISE EXCEPTION 'Skippers can apply policy must enforce pending status, open mission, and skipper role';
  END IF;

  SELECT qual, with_check
  INTO owner_update_using, owner_update_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'applications'
    AND policyname = 'Mission owners can update applications';

  IF owner_update_using IS NULL OR owner_update_check IS NULL THEN
    RAISE EXCEPTION 'Mission owners update policy must define USING and WITH CHECK';
  END IF;

  IF owner_update_using NOT ILIKE '%poster_id%'
     OR owner_update_check NOT ILIKE '%poster_id%' THEN
    RAISE EXCEPTION 'Mission owners update policy must be restricted to mission poster';
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO transition_fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'enforce_application_status_transition';

  IF transition_fn IS NULL
     OR transition_fn NOT ILIKE '%Only status can be updated on applications%'
     OR transition_fn NOT ILIKE '%Only mission owner can accept or reject applications%'
     OR transition_fn NOT ILIKE '%old.status = ''pending'' and new.status in (''accepted'', ''rejected'')%' THEN
    RAISE EXCEPTION 'enforce_application_status_transition must enforce owner-only pending -> accepted/rejected';
  END IF;

  SELECT count(*)
  INTO transition_trigger_count
  FROM pg_trigger tg
  JOIN pg_class tbl ON tbl.oid = tg.tgrelid
  JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
  WHERE ns.nspname = 'public'
    AND tbl.relname = 'applications'
    AND tg.tgname = 'on_application_status_update'
    AND NOT tg.tgisinternal;

  IF transition_trigger_count <> 1 THEN
    RAISE EXCEPTION 'Missing trigger on_application_status_update';
  END IF;
END $$;