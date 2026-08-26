-- Harden notifications policies and event emitters to match workflow guarantees.

-- Users can only read their own notifications.
DROP POLICY IF EXISTS "Users read their own notifications" ON public.notifications;
CREATE POLICY "Users read their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users may only toggle read state on their own rows.
DROP POLICY IF EXISTS "Users update their own notifications" ON public.notifications;
CREATE POLICY "Users update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND user_id = (
      SELECT n.user_id
      FROM public.notifications n
      WHERE n.id = notifications.id
    )
    AND type = (
      SELECT n.type
      FROM public.notifications n
      WHERE n.id = notifications.id
    )
    AND payload = (
      SELECT n.payload
      FROM public.notifications n
      WHERE n.id = notifications.id
    )
    AND created_at = (
      SELECT n.created_at
      FROM public.notifications n
      WHERE n.id = notifications.id
    )
  );

-- New application notification should only reflect a real pending application.
CREATE OR REPLACE FUNCTION public.notify_on_application_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mission_owner uuid;
BEGIN
  IF new.status <> 'pending' THEN
    RETURN new;
  END IF;

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

-- Application status notifications should only follow pending -> accepted/rejected.
CREATE OR REPLACE FUNCTION public.notify_application_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mission_departure text;
  mission_destination text;
  mission_label text;
  notif_type text;
  notif_message text;
BEGIN
  IF old.status = 'pending' AND new.status IN ('accepted', 'rejected') THEN
    SELECT departure, destination
    INTO mission_departure, mission_destination
    FROM public.missions
    WHERE id = new.mission_id;

    mission_label := coalesce(mission_departure, 'votre mission')
      || CASE WHEN mission_destination IS NOT NULL AND mission_destination <> '' THEN ' -> ' || mission_destination ELSE '' END;

    IF new.status = 'accepted' THEN
      notif_type := 'application_accepted';
      notif_message := 'Votre candidature pour ' || mission_label || ' a ete acceptee.';
    ELSE
      notif_type := 'application_rejected';
      notif_message := 'Votre candidature pour ' || mission_label || ' a ete refusee.';
    END IF;

    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      new.skipper_id,
      notif_type,
      jsonb_build_object(
        'message', notif_message,
        'mission_id', new.mission_id,
        'application_id', new.id,
        'skipper_id', new.skipper_id,
        'status', new.status
      )
    );
  END IF;

  RETURN new;
END;
$$;

-- Message notifications must only be emitted for accepted application conversations.
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

  IF conv_demandeur IS NULL OR conv_skipper IS NULL OR conv_mission IS NULL THEN
    RETURN new;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.applications a
    WHERE a.mission_id = conv_mission
      AND a.skipper_id = conv_skipper
      AND a.status = 'accepted'
  ) THEN
    RETURN new;
  END IF;

  IF new.sender_id = conv_demandeur THEN
    recipient_id := conv_skipper;
  ELSIF new.sender_id = conv_skipper THEN
    recipient_id := conv_demandeur;
  ELSE
    RETURN new;
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

DROP TRIGGER IF EXISTS on_application_created_notify ON public.applications;
CREATE TRIGGER on_application_created_notify
  AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_application_created();

DROP TRIGGER IF EXISTS on_application_status_update_notify ON public.applications;
DROP TRIGGER IF EXISTS on_application_status_notification ON public.applications;
CREATE TRIGGER on_application_status_notification
  AFTER UPDATE OF status ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.notify_application_status_changed();

DROP TRIGGER IF EXISTS on_message_created_notify ON public.messages;
CREATE TRIGGER on_message_created_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_message_created();