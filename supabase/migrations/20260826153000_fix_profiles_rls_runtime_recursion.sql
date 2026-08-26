-- Fix profiles RLS runtime recursion without weakening security.
-- Scope: public.profiles policies/functions only.

-- Compare immutable fields against current row through a definer function,
-- so policy evaluation does not recurse into profiles RLS.
CREATE OR REPLACE FUNCTION public.profile_user_update_fields_unchanged(
  target_id uuid,
  new_role text,
  new_identity_verified boolean
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = target_id
      AND p.role = new_role
      AND coalesce(p.identity_verified, false) = coalesce(new_identity_verified, false)
  );
$$;

GRANT EXECUTE ON FUNCTION public.profile_user_update_fields_unchanged(uuid, text, boolean) TO authenticated;

-- Replace self-referential admin policies by is_admin helper to avoid recursion.
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Keep user update rights, while locking role and identity_verified without
-- querying profiles from inside policy expressions.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND public.profile_user_update_fields_unchanged(id, role, identity_verified)
  );