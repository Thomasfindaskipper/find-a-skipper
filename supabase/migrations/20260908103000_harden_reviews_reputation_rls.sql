-- Harden reviews/reputation integrity: only real completed missions, no self-review, no duplicates/falsification.

-- Tighten insert policy for reviews.
DROP POLICY IF EXISTS "Participants can leave a review after a mission" ON public.reviews;
CREATE POLICY "Participants can leave a review after a mission"
  ON public.reviews FOR INSERT
  WITH CHECK (
    auth.uid() = reviews.reviewer_id
    AND reviews.reviewer_id <> reviews.reviewee_id
    AND EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.missions m ON m.id = a.mission_id
      WHERE a.mission_id = reviews.mission_id
        AND a.status = 'accepted'
        AND m.status = 'completed'
        AND (
          (reviews.reviewer_id = m.poster_id AND reviews.reviewee_id = a.skipper_id)
          OR (reviews.reviewer_id = a.skipper_id AND reviews.reviewee_id = m.poster_id)
        )
    )
  );

-- One review per reviewer per mission.
DROP INDEX IF EXISTS reviews_unique_by_mission_reviewer_idx;
CREATE UNIQUE INDEX reviews_unique_by_mission_reviewer_idx
  ON public.reviews (mission_id, reviewer_id);

-- Runtime guard against forged insert payloads.
CREATE OR REPLACE FUNCTION public.enforce_review_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mission_owner uuid;
  accepted_skipper uuid;
  mission_status text;
BEGIN
  SELECT m.poster_id, m.status
  INTO mission_owner, mission_status
  FROM public.missions m
  WHERE m.id = NEW.mission_id;

  IF mission_owner IS NULL THEN
    RAISE EXCEPTION 'Mission introuvable pour cet avis';
  END IF;

  IF mission_status <> 'completed' THEN
    RAISE EXCEPTION 'Avis autorise uniquement pour une mission terminee';
  END IF;

  SELECT a.skipper_id
  INTO accepted_skipper
  FROM public.applications a
  WHERE a.mission_id = NEW.mission_id
    AND a.status = 'accepted'
  LIMIT 1;

  IF accepted_skipper IS NULL THEN
    RAISE EXCEPTION 'Aucun skipper accepte pour cette mission';
  END IF;

  IF NEW.reviewer_id = NEW.reviewee_id THEN
    RAISE EXCEPTION 'Auto-evaluation interdite';
  END IF;

  IF NOT (
    (NEW.reviewer_id = mission_owner AND NEW.reviewee_id = accepted_skipper)
    OR (NEW.reviewer_id = accepted_skipper AND NEW.reviewee_id = mission_owner)
  ) THEN
    RAISE EXCEPTION 'Participants invalides pour cet avis';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_review_integrity_check ON public.reviews;
CREATE TRIGGER on_review_integrity_check
  BEFORE INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.enforce_review_integrity();
