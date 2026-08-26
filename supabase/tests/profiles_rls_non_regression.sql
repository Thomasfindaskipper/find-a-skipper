-- Non-regression checks scoped to profiles RLS hardening.

DO $$
DECLARE
  weak_insert_count int;
  weak_update_count int;
  strict_insert_check text;
  strict_update_check text;
  admin_update_using text;
  admin_update_check text;
  admin_read_using text;
BEGIN
  SELECT count(*)
  INTO weak_insert_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'Users can insert own profile';

  IF weak_insert_count <> 0 THEN
    RAISE EXCEPTION 'Weak insert policy still present on profiles';
  END IF;

  SELECT count(*)
  INTO weak_update_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'Users can update own profile';

  IF weak_update_count <> 0 THEN
    RAISE EXCEPTION 'Weak update policy still present on profiles';
  END IF;

  SELECT with_check
  INTO strict_insert_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'Users can insert their own profile';

  IF strict_insert_check IS NULL
     OR strict_insert_check NOT ILIKE '%auth.uid() = id%'
     OR strict_insert_check NOT ILIKE '%role = any%'
     OR strict_insert_check NOT ILIKE '%identity_verified%' THEN
    RAISE EXCEPTION 'Strict insert policy for profiles is missing required guards';
  END IF;

  SELECT with_check
  INTO strict_update_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'Users can update their own profile';

    IF strict_update_check IS NULL
      OR strict_update_check NOT ILIKE '%role = (%'
      OR strict_update_check NOT ILIKE '%from profiles p%'
      OR strict_update_check NOT ILIKE '%p.id = auth.uid()%'
      OR strict_update_check NOT ILIKE '%identity_verified%' THEN
    RAISE EXCEPTION 'Strict update policy for profiles is missing role/identity locks';
  END IF;

  SELECT qual, with_check
  INTO admin_update_using, admin_update_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'Admins can update any profile';

  IF admin_update_using IS NULL OR admin_update_check IS NULL THEN
    RAISE EXCEPTION 'Admins update policy must define both USING and WITH CHECK';
  END IF;

  SELECT qual
  INTO admin_read_using
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'Admins can read all profiles';

  IF admin_read_using IS NULL THEN
    RAISE EXCEPTION 'Admins read-all profiles policy is missing';
  END IF;
END $$;
