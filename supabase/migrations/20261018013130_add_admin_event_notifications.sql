/*
# Add admin event notifications

1. New Tables
- `public.admin_notifications`
- `id` (uuid, primary key) identifies the notification.
- `event_type` (text) identifies signup, recharge, or withdrawal events.
- `title` (text) stores the short notification heading.
- `message` (text) stores the readable event details.
- `entity_id` (uuid) links the event to the created profile, recharge, or withdrawal record.
- `user_id` (uuid) identifies the user involved in the event.
- `is_read` (boolean) tracks whether an administrator dismissed the notification.
- `created_at` (timestamptz) stores when the event happened.

2. Automatic Events
- A new profile creates a new-user notification.
- A new recharge request creates a recharge notification.
- A new withdrawal request creates a withdrawal notification.
- Existing user and transaction data is not changed.

3. Security
- Row level security is enabled.
- Only authenticated administrators can read and mark notifications as read.
- Inserts are performed only by a SECURITY DEFINER trigger function; clients cannot create fake notifications.
- Anonymous and regular user accounts have no access to notification rows.

4. Important Notes
- Notifications remain stored until an administrator marks them read.
- The website can safely poll unread notifications without exposing another user's private records.
*/

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('signup', 'recharge', 'withdrawal')),
  title text NOT NULL,
  message text NOT NULL,
  entity_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_select_notifications" ON public.admin_notifications;
CREATE POLICY "admins_select_notifications" ON public.admin_notifications FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "admins_update_notifications" ON public.admin_notifications;
CREATE POLICY "admins_update_notifications" ON public.admin_notifications FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread
  ON public.admin_notifications(is_read, created_at DESC);

CREATE OR REPLACE FUNCTION public.create_admin_notification(
  p_event_type text,
  p_title text,
  p_message text,
  p_entity_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_notifications (event_type, title, message, entity_id, user_id)
  VALUES (p_event_type, p_title, p_message, p_entity_id, p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_admin_notification(text, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_profile_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.create_admin_notification(
    'signup',
    'New user signed up',
    COALESCE(NULLIF(NEW.full_name, ''), 'A new user') || ' created an account.',
    NEW.id,
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_recharge_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT NULLIF(full_name, '') INTO v_name FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.create_admin_notification(
    'recharge',
    'New recharge request',
    COALESCE(v_name, 'A user') || ' submitted a ' || to_char(NEW.amount, 'FM999,999,990.00') || ' recharge request.',
    NEW.id,
    NEW.user_id
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_withdrawal_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT NULLIF(full_name, '') INTO v_name FROM public.profiles WHERE id = NEW.user_id;
  PERFORM public.create_admin_notification(
    'withdrawal',
    'New withdrawal request',
    COALESCE(v_name, 'A user') || ' submitted a ' || to_char(NEW.amount, 'FM999,999,990.00') || ' withdrawal request.',
    NEW.id,
    NEW.user_id
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_profile_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_recharge_created() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_withdrawal_created() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_admin_notification ON public.profiles;
CREATE TRIGGER profiles_admin_notification
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_profile_created();

DROP TRIGGER IF EXISTS recharge_admin_notification ON public.recharge_logs;
CREATE TRIGGER recharge_admin_notification
  AFTER INSERT ON public.recharge_logs
  FOR EACH ROW EXECUTE FUNCTION public.notify_recharge_created();

DROP TRIGGER IF EXISTS withdrawal_admin_notification ON public.withdrawal_logs;
CREATE TRIGGER withdrawal_admin_notification
  AFTER INSERT ON public.withdrawal_logs
  FOR EACH ROW EXECUTE FUNCTION public.notify_withdrawal_created();
