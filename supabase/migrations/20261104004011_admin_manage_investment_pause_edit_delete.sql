/*
# Admin management of user rentals: pause, edit, delete

1. Modified Tables
- `investments`: new `pause_reason text` column (nullable). Records why an admin paused a rental. No data loss to existing rows.

2. New Functions
- `admin_manage_investment(p_investment_id uuid, p_action text, p_duration_days int, p_daily_payout numeric, p_reason text)`: SECURITY DEFINER, admin-only. Lets an admin:
  1. pause: set status to 'paused' (earnings stop accruing because credit_daily_earnings only credits status='active').
  2. resume: set status back to 'active' and clear pause_reason.
  3. edit: adjust duration_days and daily_payout on a rental (bounds-checked server-side).
  4. delete: permanently remove the rental row. Refunds are not performed automatically; the admin should handle any wallet adjustment separately.
  The caller must be an admin (checked via is_admin()). All mutations bypass RLS because the function is SECURITY DEFINER.

3. Security
- Function is SECURITY DEFINER with a pinned search_path.
- EXECUTE is revoked from PUBLIC and anon; granted to authenticated only. Only callers passing the is_admin() check inside can mutate.
- No change to existing investment RLS policies. Users still cannot edit/delete their own rentals directly; the existing update_own_investments policy only allows status changes the user controls, and admin updates go through this function.
- The new column is nullable and carries no default; it is informational.

4. Notes
- Idempotent: re-running adds the column if missing and replaces the function.
- Pausing does NOT credit partial earnings for the current day; credit_daily_earnings simply skips non-active rows on the next run.
*/

ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS pause_reason text;

CREATE OR REPLACE FUNCTION public.admin_manage_investment(
  p_investment_id uuid,
  p_action text,
  p_duration_days int DEFAULT NULL,
  p_daily_payout numeric DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v_inv record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_inv FROM public.investments WHERE id = p_investment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Investment not found';
  END IF;

  IF p_action = 'pause' THEN
    IF v_inv.status = 'paused' THEN
      RAISE EXCEPTION 'Rental is already paused';
    END IF;
    UPDATE public.investments
      SET status = 'paused', pause_reason = COALESCE(p_reason, v_inv.pause_reason)
      WHERE id = p_investment_id;
    PERFORM public.log_action(v_inv.user_id, 'investment_paused',
      'Admin paused rental ' || v_inv.car_name || COALESCE(': ' || p_reason, ''));

  ELSIF p_action = 'resume' THEN
    IF v_inv.status <> 'paused' THEN
      RAISE EXCEPTION 'Only paused rentals can be resumed';
    END IF;
    UPDATE public.investments
      SET status = 'active', pause_reason = NULL
      WHERE id = p_investment_id;
    PERFORM public.log_action(v_inv.user_id, 'investment_resumed',
      'Admin resumed rental ' || v_inv.car_name);

  ELSIF p_action = 'edit' THEN
    IF p_duration_days IS NULL AND p_daily_payout IS NULL THEN
      RAISE EXCEPTION 'Nothing to edit';
    END IF;
    IF p_duration_days IS NOT NULL AND (p_duration_days < 1 OR p_duration_days > 365) THEN
      RAISE EXCEPTION 'Duration must be between 1 and 365 days';
    END IF;
    IF p_daily_payout IS NOT NULL AND (p_daily_payout < 0 OR p_daily_payout > 100000) THEN
      RAISE EXCEPTION 'Daily payout is out of range';
    END IF;
    UPDATE public.investments
      SET duration_days = COALESCE(p_duration_days, duration_days),
          daily_payout = COALESCE(p_daily_payout, daily_payout)
      WHERE id = p_investment_id;
    PERFORM public.log_action(v_inv.user_id, 'investment_edited',
      'Admin edited rental ' || v_inv.car_name ||
      COALESCE(' to ' || p_duration_days || ' days', '') ||
      COALESCE(' / ' || p_daily_payout || ' per day', ''));

  ELSIF p_action = 'delete' THEN
    DELETE FROM public.investments WHERE id = p_investment_id;
    PERFORM public.log_action(v_inv.user_id, 'investment_deleted',
      'Admin deleted rental ' || v_inv.car_name);

  ELSE
    RAISE EXCEPTION 'Unknown action';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_manage_investment(uuid, text, int, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_manage_investment(uuid, text, int, numeric, text) TO authenticated;
