-- Non-regression checks for onboarding state.

DO $$
DECLARE
  onboarding_step_column_count int;
  onboarding_done_column_count int;
  onboarding_constraint text;
  profile_update_check text;
  trigger_body text;
BEGIN
  SELECT count(*)
  INTO onboarding_step_column_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'onboarding_step';

  IF onboarding_step_column_count <> 1 THEN
    RAISE EXCEPTION 'profiles.onboarding_step column missing';
  END IF;

  SELECT count(*)
  INTO onboarding_done_column_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'onboarding_completed_at';

  IF onboarding_done_column_count <> 1 THEN
    RAISE EXCEPTION 'profiles.onboarding_completed_at column missing';
  END IF;

  SELECT pg_get_constraintdef(c.oid)
  INTO onboarding_constraint
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'profiles'
    AND c.conname = 'profiles_onboarding_step_check';

  IF onboarding_constraint IS NULL
     OR onboarding_constraint NOT ILIKE '%role_details%'
     OR onboarding_constraint NOT ILIKE '%done%' THEN
    RAISE EXCEPTION 'profiles onboarding constraint is missing or invalid';
  END IF;

  SELECT with_check
  INTO profile_update_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'Users can update their own profile';

    IF profile_update_check IS NULL
      OR profile_update_check NOT ILIKE '%profile_user_update_fields_unchanged%'
      OR profile_update_check NOT ILIKE '%identity_verified%' THEN
    RAISE EXCEPTION 'profiles update policy changed unexpectedly';
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO trigger_body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'handle_new_user';

  IF trigger_body IS NULL
     OR trigger_body NOT ILIKE '%onboarding_step%'
     OR trigger_body NOT ILIKE '%role_details%'
     OR trigger_body NOT ILIKE '%onboarding_completed_at%' THEN
    RAISE EXCEPTION 'handle_new_user onboarding defaults are missing';
  END IF;
END $$;
