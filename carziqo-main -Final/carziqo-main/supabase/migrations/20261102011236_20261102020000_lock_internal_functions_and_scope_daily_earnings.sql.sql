/*
# Lock down internal functions and scope daily earnings to the caller

## Problem
- credit_daily_earnings() was callable by any signed-in or anonymous user and
  credited every user's active investments at once.
- Several internal helpers (assign_free_car, promote_first_user_to_admin,
  prepare_withdrawal, check_investment_limit, log_action, trigger functions)
  were executable by anon and authenticated roles.
- Public-facing user actions were executable by the anon role.

## Changes
1. credit_daily_earnings() now credits only the caller's own investments when a
   user is signed in. When no user is signed in (the scheduled edge function
   using the service role), it credits all active investments as before.
2. Internal and trigger-only functions have EXECUTE revoked from PUBLIC, anon
   and authenticated. They are still callable by the database owner and the
   service role, so triggers and the edge function keep working.
3. User-facing RPCs keep EXECUTE for authenticated and lose it for anon.
   Admin RPCs continue to check is_admin() internally.

## Notes
- is_admin() keeps its grants because row level security policies evaluate it
  for the caller's role.
- Idempotent: CREATE OR REPLACE and REVOKE can be re-run safely.
*/

CREATE OR REPLACE FUNCTION public.credit_daily_earnings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  inv RECORD;
  days_elapsed_val integer;
  new_days_val integer;
  payout_val numeric(12,2);
BEGIN
  FOR inv IN
    SELECT * FROM public.investments
    WHERE status = 'active'
      AND (auth.uid() IS NULL OR user_id = auth.uid())
  LOOP
    IF inv.last_payout_date IS NULL THEN
      days_elapsed_val := EXTRACT(EPOCH FROM (now() - inv.start_date)) / 86400;
    ELSE
      days_elapsed_val := EXTRACT(EPOCH FROM (now() - inv.last_payout_date)) / 86400;
    END IF;

    new_days_val := LEAST(inv.days_completed + floor(days_elapsed_val)::integer, inv.duration_days);
    payout_val := (new_days_val - inv.days_completed) * inv.daily_payout;

    IF new_days_val > inv.days_completed AND payout_val > 0 THEN
      UPDATE public.investments
      SET
        days_completed = new_days_val,
        total_earned = total_earned + payout_val,
        last_payout_date = now(),
        status = CASE WHEN new_days_val >= inv.duration_days THEN 'completed' ELSE 'active' END
      WHERE id = inv.id;

      UPDATE public.profiles
      SET wallet_balance = wallet_balance + payout_val
      WHERE id = inv.user_id;

      PERFORM public.log_action(inv.user_id, 'daily_earnings_credited',
        'Payout: ' || payout_val || ' for ' || (new_days_val - inv.days_completed) || ' days');
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.credit_daily_earnings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.credit_daily_earnings() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.assign_free_car() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_free_car_rules() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_action(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prepare_withdrawal() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promote_first_user_to_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_vip_level_after_investment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_investment_limit(numeric) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.approve_recharge(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_recharge(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_withdrawal(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_coupon(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_gift(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_daily_checkin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_game_session(integer, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bubble_game_played_today() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_withdrawal_eligibility(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.withdrawal_referrals_required(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_investment(uuid, numeric, integer) FROM PUBLIC, anon;
