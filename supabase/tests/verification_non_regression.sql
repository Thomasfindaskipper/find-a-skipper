-- Non-regression checks for profile verification workflow.

DO $$
DECLARE
  req_col_count int;
  doc_col_count int;
  req_status_constraint text;
  doc_type_constraint text;
  req_trigger_count int;
  fn_body text;
  bucket_count int;
  policy_count int;
BEGIN
  SELECT count(*) INTO req_col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'verification_requests';

  IF req_col_count = 0 THEN
    RAISE EXCEPTION 'verification_requests table missing';
  END IF;

  SELECT count(*) INTO doc_col_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'verification_documents';

  IF doc_col_count = 0 THEN
    RAISE EXCEPTION 'verification_documents table missing';
  END IF;

  SELECT pg_get_constraintdef(c.oid)
  INTO req_status_constraint
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'verification_requests'
    AND c.conname LIKE '%status%';

  IF req_status_constraint IS NULL
     OR req_status_constraint NOT ILIKE '%draft%'
     OR req_status_constraint NOT ILIKE '%submitted%'
     OR req_status_constraint NOT ILIKE '%approved%'
     OR req_status_constraint NOT ILIKE '%rejected%' THEN
    RAISE EXCEPTION 'verification_requests status constraint invalid';
  END IF;

  SELECT pg_get_constraintdef(c.oid)
  INTO doc_type_constraint
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'verification_documents'
    AND c.conname LIKE '%doc_type%';

  IF doc_type_constraint IS NULL
     OR doc_type_constraint NOT ILIKE '%identity%'
     OR doc_type_constraint NOT ILIKE '%license%'
     OR doc_type_constraint NOT ILIKE '%certificate%'
     OR doc_type_constraint NOT ILIKE '%company%'
     OR doc_type_constraint NOT ILIKE '%ownership%'
     OR doc_type_constraint NOT ILIKE '%mandate%' THEN
    RAISE EXCEPTION 'verification_documents doc_type constraint invalid';
  END IF;

  SELECT count(*) INTO req_trigger_count
  FROM pg_trigger tg
  JOIN pg_class tbl ON tbl.oid = tg.tgrelid
  JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
  WHERE ns.nspname = 'public'
    AND tbl.relname = 'verification_requests'
    AND tg.tgname = 'on_verification_request_status_change'
    AND NOT tg.tgisinternal;

  IF req_trigger_count <> 1 THEN
    RAISE EXCEPTION 'Missing trigger on_verification_request_status_change';
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO fn_body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'sync_profile_identity_from_verification';

  IF fn_body IS NULL
     OR fn_body NOT ILIKE '%identity_verified = true%'
     OR fn_body NOT ILIKE '%identity_verified = false%' THEN
    RAISE EXCEPTION 'sync_profile_identity_from_verification function invalid';
  END IF;

  SELECT count(*) INTO bucket_count
  FROM storage.buckets
  WHERE id = 'verification-documents'
    AND public = false;

  IF bucket_count <> 1 THEN
    RAISE EXCEPTION 'verification-documents bucket missing or public';
  END IF;

  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Users read own verification documents';

  IF policy_count <> 1 THEN
    RAISE EXCEPTION 'Missing storage select policy for verification documents';
  END IF;

  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'Users can update their own profile'
    AND with_check ILIKE '%identity_verified%';

  IF policy_count <> 1 THEN
    RAISE EXCEPTION 'profiles update policy no longer protects identity_verified';
  END IF;
END $$;
