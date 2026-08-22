-- Non-regression checks for P0 RLS hardening.
-- Run in Supabase SQL editor after migrations are applied.

DO $$
DECLARE
  profile_with_check text;
  mission_with_check text;
BEGIN
  SELECT with_check
  INTO profile_with_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'Users can update their own profile';

  IF profile_with_check IS NULL THEN
    RAISE EXCEPTION 'Missing WITH CHECK for policy Users can update their own profile';
  END IF;

  IF profile_with_check NOT ILIKE '%role = (select p.role from public.profiles p where p.id = auth.uid())%' THEN
    RAISE EXCEPTION 'profiles update policy does not lock role';
  END IF;

  IF profile_with_check NOT ILIKE '%identity_verified%' THEN
    RAISE EXCEPTION 'profiles update policy does not lock identity_verified';
  END IF;

  SELECT with_check
  INTO mission_with_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'missions'
    AND policyname = 'Posters can update their own missions';

  IF mission_with_check IS NULL THEN
    RAISE EXCEPTION 'Missing WITH CHECK for policy Posters can update their own missions';
  END IF;

  IF mission_with_check NOT ILIKE '%is_featured%' THEN
    RAISE EXCEPTION 'missions update policy does not lock is_featured';
  END IF;

  IF mission_with_check NOT ILIKE '%applicants_count%' THEN
    RAISE EXCEPTION 'missions update policy does not lock applicants_count';
  END IF;
END $$;
