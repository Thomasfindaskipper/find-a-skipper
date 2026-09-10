-- Non-regression checks for reviews integrity and anti-fraud guarantees.

DO $$
DECLARE
  insert_check text;
  unique_idx_count int;
  review_fn text;
  review_trigger_count int;
BEGIN
  SELECT with_check
  INTO insert_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'reviews'
    AND policyname = 'Participants can leave a review after a mission';

  IF insert_check IS NULL
     OR insert_check NOT ILIKE '%auth.uid() = reviews.reviewer_id%'
     OR insert_check NOT ILIKE '%reviews.reviewer_id <> reviews.reviewee_id%'
     OR insert_check NOT ILIKE '%a.status = ''accepted''%'
     OR insert_check NOT ILIKE '%m.status = ''completed''%' THEN
    RAISE EXCEPTION 'Reviews insert policy must require reviewer ownership, no self-review, accepted application, and completed mission';
  END IF;

  SELECT count(*)
  INTO unique_idx_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'reviews'
    AND indexname = 'reviews_unique_by_mission_reviewer_idx';

  IF unique_idx_count <> 1 THEN
    RAISE EXCEPTION 'Missing unique index reviews_unique_by_mission_reviewer_idx';
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO review_fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'enforce_review_integrity';

  IF review_fn IS NULL
     OR review_fn NOT ILIKE '%mission_status <> ''completed''%'
     OR review_fn NOT ILIKE '%a.status = ''accepted''%'
     OR review_fn NOT ILIKE '%NEW.reviewer_id = NEW.reviewee_id%' THEN
    RAISE EXCEPTION 'enforce_review_integrity must enforce completed mission + accepted application + no self-review';
  END IF;

  SELECT count(*)
  INTO review_trigger_count
  FROM pg_trigger tg
  JOIN pg_class tbl ON tbl.oid = tg.tgrelid
  JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
  WHERE ns.nspname = 'public'
    AND tbl.relname = 'reviews'
    AND tg.tgname = 'on_review_integrity_check'
    AND NOT tg.tgisinternal;

  IF review_trigger_count <> 1 THEN
    RAISE EXCEPTION 'Missing reviews trigger on_review_integrity_check';
  END IF;
END $$;
