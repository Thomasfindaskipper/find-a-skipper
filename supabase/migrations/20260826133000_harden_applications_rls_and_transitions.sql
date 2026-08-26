-- Harden applications RLS and status transitions without touching notifications.

-- Ensure read access is limited to applicant and mission owner.
DROP POLICY IF EXISTS "Applicant or poster can read applications" ON public.applications;
DROP POLICY IF EXISTS "Applicant or mission owner can read applications" ON public.applications;
CREATE POLICY "Applicant or mission owner can read applications"
  ON public.applications FOR SELECT
  USING (
    auth.uid() = skipper_id
    OR auth.uid() = (
      SELECT m.poster_id
      FROM public.missions m
      WHERE m.id = applications.mission_id
    )
  );

-- Skippers can only create pending applications on open missions.
DROP POLICY IF EXISTS "Skippers can apply" ON public.applications;
CREATE POLICY "Skippers can apply"
  ON public.applications FOR INSERT
  WITH CHECK (
    auth.uid() = skipper_id
    AND status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'skipper'
    )
    AND EXISTS (
      SELECT 1
      FROM public.missions m
      WHERE m.id = mission_id
        AND m.status = 'open'
    )
  );

-- Only mission owners can update applications rows.
DROP POLICY IF EXISTS "Mission owners can update applications" ON public.applications;
DROP POLICY IF EXISTS "Mission owner or skipper can update application" ON public.applications;
CREATE POLICY "Mission owners can update applications"
  ON public.applications FOR UPDATE
  USING (
    auth.uid() = (
      SELECT m.poster_id
      FROM public.missions m
      WHERE m.id = applications.mission_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT m.poster_id
      FROM public.missions m
      WHERE m.id = applications.mission_id
    )
  );

-- Transition guard: owner can only move pending to accepted/rejected.
CREATE OR REPLACE FUNCTION public.enforce_application_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mission_owner uuid;
BEGIN
  IF new.status = old.status THEN
    RETURN new;
  END IF;

  IF new.mission_id <> old.mission_id
     OR new.skipper_id <> old.skipper_id
     OR coalesce(new.phone, '') <> coalesce(old.phone, '')
     OR coalesce(new.message, '') <> coalesce(old.message, '')
     OR new.applied_at <> old.applied_at THEN
    RAISE EXCEPTION 'Only status can be updated on applications';
  END IF;

  SELECT m.poster_id INTO mission_owner
  FROM public.missions m
  WHERE m.id = old.mission_id;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required for status transition';
  END IF;

  IF auth.uid() <> mission_owner THEN
    RAISE EXCEPTION 'Only mission owner can accept or reject applications';
  END IF;

  IF NOT (old.status = 'pending' AND new.status IN ('accepted', 'rejected')) THEN
    RAISE EXCEPTION 'Owner can only accept or reject a pending application';
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_application_status_update ON public.applications;
CREATE TRIGGER on_application_status_update
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_application_status_transition();