-- Allow skippers to cancel their own pending applications safely.

DROP POLICY IF EXISTS "Skippers can cancel pending applications" ON public.applications;
CREATE POLICY "Skippers can cancel pending applications"
  ON public.applications FOR DELETE
  USING (
    auth.uid() = applications.skipper_id
    AND applications.status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'skipper'
    )
  );

CREATE OR REPLACE FUNCTION public.decrement_applicants_count_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.missions
  SET applicants_count = GREATEST(applicants_count - 1, 0)
  WHERE id = OLD.mission_id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_application_deleted ON public.applications;
CREATE TRIGGER on_application_deleted
  AFTER DELETE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.decrement_applicants_count_on_delete();
