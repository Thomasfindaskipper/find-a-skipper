-- Harden accepted-only messaging access, enforce acceptance side-effects,
-- and standardize notification type naming.

-- If legacy mission status values are still present, normalize them to the
-- canonical workflow expected by the app.
DO $$
DECLARE
  status_constraint text;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
  INTO status_constraint
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'missions'
    AND c.conname = 'missions_status_check';

  IF status_constraint ILIKE '%draft%' OR status_constraint ILIKE '%published%' OR status_constraint ILIKE '%closed%' THEN
    ALTER TABLE public.missions
      DROP CONSTRAINT IF EXISTS missions_status_check;

    ALTER TABLE public.missions
      ADD CONSTRAINT missions_status_check
      CHECK (status IN ('draft', 'published', 'closed', 'open', 'assigned', 'completed', 'cancelled'));

    UPDATE public.missions
    SET status = CASE
      WHEN status IN ('draft', 'published') THEN 'open'
      WHEN status = 'closed' THEN 'completed'
      ELSE status
    END;

    ALTER TABLE public.missions
      ALTER COLUMN status SET DEFAULT 'open';

    ALTER TABLE public.missions
      DROP CONSTRAINT IF EXISTS missions_status_check;

    ALTER TABLE public.missions
      ADD CONSTRAINT missions_status_check
      CHECK (status IN ('open', 'assigned', 'completed', 'cancelled'));
  END IF;
END $$;

-- Accepted-only conversation creation.
DROP POLICY IF EXISTS "Demandeur can start a conversation" ON public.conversations;
CREATE POLICY "Demandeur can start a conversation"
  ON public.conversations FOR INSERT
  WITH CHECK (
    auth.uid() = demandeur_id
    AND EXISTS (
      SELECT 1
      FROM public.missions m
      WHERE m.id = conversations.mission_id
        AND m.poster_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.applications a
      WHERE a.mission_id = conversations.mission_id
        AND a.skipper_id = conversations.skipper_id
        AND a.status = 'accepted'
    )
  );

-- Accepted-only conversation visibility.
DROP POLICY IF EXISTS "Participants can read their conversations" ON public.conversations;
CREATE POLICY "Participants can read their conversations"
  ON public.conversations FOR SELECT
  USING (
    (auth.uid() = demandeur_id OR auth.uid() = skipper_id)
    AND EXISTS (
      SELECT 1
      FROM public.applications a
      WHERE a.mission_id = conversations.mission_id
        AND a.skipper_id = conversations.skipper_id
        AND a.status = 'accepted'
    )
  );

-- Accepted-only messages read/write, even if a conversation row already exists.
DROP POLICY IF EXISTS "Participants can read messages" ON public.messages;
CREATE POLICY "Participants can read messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND (auth.uid() = c.demandeur_id OR auth.uid() = c.skipper_id)
        AND EXISTS (
          SELECT 1
          FROM public.applications a
          WHERE a.mission_id = c.mission_id
            AND a.skipper_id = c.skipper_id
            AND a.status = 'accepted'
        )
    )
  );

DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND (auth.uid() = c.demandeur_id OR auth.uid() = c.skipper_id)
        AND EXISTS (
          SELECT 1
          FROM public.applications a
          WHERE a.mission_id = c.mission_id
            AND a.skipper_id = c.skipper_id
            AND a.status = 'accepted'
        )
    )
  );

-- Acceptance side-effects:
-- - keep accepted row unchanged
-- - auto-reject all other pending rows for same mission
-- - set mission status to assigned
CREATE OR REPLACE FUNCTION public.sync_mission_status_from_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF tg_op = 'UPDATE' AND new.status = 'accepted' AND old.status <> 'accepted' THEN
    UPDATE public.applications
    SET status = 'rejected'
    WHERE mission_id = new.mission_id
      AND id <> new.id
      AND status = 'pending';

    UPDATE public.missions
    SET status = 'assigned'
    WHERE id = new.mission_id
      AND status = 'open';
  END IF;

  IF tg_op = 'INSERT' AND new.status = 'accepted' THEN
    UPDATE public.applications
    SET status = 'rejected'
    WHERE mission_id = new.mission_id
      AND id <> new.id
      AND status = 'pending';

    UPDATE public.missions
    SET status = 'assigned'
    WHERE id = new.mission_id
      AND status = 'open';
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_application_status_sync_mission ON public.applications;
CREATE TRIGGER on_application_status_sync_mission
  AFTER INSERT OR UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.sync_mission_status_from_application();

-- Standardized notification naming.
CREATE OR REPLACE FUNCTION public.notify_on_application_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mission_owner uuid;
BEGIN
  SELECT m.poster_id INTO mission_owner
  FROM public.missions m
  WHERE m.id = new.mission_id;

  IF mission_owner IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      mission_owner,
      'new_application',
      jsonb_build_object(
        'mission_id', new.mission_id,
        'application_id', new.id,
        'skipper_id', new.skipper_id
      )
    );
  END IF;

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_application_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mission_owner uuid;
BEGIN
  SELECT m.poster_id INTO mission_owner
  FROM public.missions m
  WHERE m.id = new.mission_id;

  IF mission_owner IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      mission_owner,
      'new_application',
      jsonb_build_object(
        'message', 'Nouvelle candidature recue.',
        'mission_id', new.mission_id,
        'application_id', new.id,
        'skipper_id', new.skipper_id
      )
    );
  END IF;

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_on_message_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_demandeur uuid;
  conv_skipper uuid;
  conv_mission uuid;
  recipient_id uuid;
BEGIN
  SELECT c.demandeur_id, c.skipper_id, c.mission_id
  INTO conv_demandeur, conv_skipper, conv_mission
  FROM public.conversations c
  WHERE c.id = new.conversation_id;

  IF conv_demandeur IS NULL OR conv_skipper IS NULL THEN
    RETURN new;
  END IF;

  IF new.sender_id = conv_demandeur THEN
    recipient_id := conv_skipper;
  ELSE
    recipient_id := conv_demandeur;
  END IF;

  IF recipient_id IS NOT NULL AND recipient_id <> new.sender_id THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      recipient_id,
      'new_message',
      jsonb_build_object(
        'conversation_id', new.conversation_id,
        'mission_id', conv_mission,
        'sender_id', new.sender_id,
        'message_id', new.id
      )
    );
  END IF;

  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_message_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_demandeur uuid;
  conv_skipper uuid;
  conv_mission uuid;
  recipient_id uuid;
  sender_name text;
BEGIN
  SELECT c.demandeur_id, c.skipper_id, c.mission_id, p.full_name
  INTO conv_demandeur, conv_skipper, conv_mission, sender_name
  FROM public.conversations c
  LEFT JOIN public.profiles p ON p.id = new.sender_id
  WHERE c.id = new.conversation_id;

  IF conv_demandeur IS NULL AND conv_skipper IS NULL THEN
    RETURN new;
  END IF;

  recipient_id := CASE WHEN new.sender_id = conv_demandeur THEN conv_skipper ELSE conv_demandeur END;

  IF recipient_id IS NULL OR recipient_id = new.sender_id THEN
    RETURN new;
  END IF;

  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    recipient_id,
    'new_message',
    jsonb_build_object(
      'message', 'Nouveau message de ' || coalesce(sender_name, 'votre contact') || '.',
      'conversation_id', new.conversation_id,
      'mission_id', conv_mission,
      'sender_id', new.sender_id,
      'sender_name', coalesce(sender_name, 'Contact'),
      'message_excerpt', left(new.text, 140)
    )
  );

  RETURN new;
END;
$$;

-- Ensure both legacy and canonical trigger names point to normalized functions.
DROP TRIGGER IF EXISTS on_application_created_notify ON public.applications;
DROP TRIGGER IF EXISTS on_application_notification ON public.applications;
CREATE TRIGGER on_application_created_notify
  AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_application_created();

DROP TRIGGER IF EXISTS on_message_created_notify ON public.messages;
DROP TRIGGER IF EXISTS on_message_notification ON public.messages;
CREATE TRIGGER on_message_created_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_message_created();
