/*
# Restrict admin-only SECURITY DEFINER functions

## Overview
Revokes EXECUTE on admin-only SECURITY DEFINER functions from the anon and 
authenticated roles so regular users cannot call privileged operations like 
approving/rejecting recharges and withdrawals, crediting earnings, or promoting admins.

## Changes
- REVOKE EXECUTE on admin-only functions FROM anon, authenticated
- GRANT EXECUTE on user-facing functions TO authenticated only (not anon)

## Security
- Admin functions (approve_recharge, reject_recharge, approve_withdrawal, 
  reject_withdrawal, credit_daily_earnings, promote_first_user_to_admin,
  assign_free_car, enforce_free_car_rules, handle_new_user, log_action,
  prepare_withdrawal) are now only callable by superuser/service_role
- User functions (check_investment_limit, check_withdrawal_eligibility,
  claim_daily_checkin, claim_coupon, redeem_gift, save_game_session, is_admin)
  remain callable by authenticated users only

## Important notes
1. No data is deleted or altered.
2. The frontend admin panel uses the service role through RPC calls; these 
   functions still work because they are called by authenticated admins whose
   RLS policies allow admin actions.
3. Trigger functions (handle_new_user, assign_free_car, enforce_free_car_rules,
   promote_first_user_to_admin, prepare_withdrawal) are called by the database
   internally during trigger execution, not via the API, so revoking API access
   does not affect trigger behavior.
*/

-- Admin-only functions: revoke from anon and authenticated
REVOKE EXECUTE ON FUNCTION public.approve_recharge(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_recharge(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_withdrawal(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_daily_earnings() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promote_first_user_to_admin() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_free_car() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_free_car_rules() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_action(uuid, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prepare_withdrawal() FROM anon, authenticated;

-- User-facing functions: revoke from anon, keep for authenticated
REVOKE EXECUTE ON FUNCTION public.check_investment_limit(numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_withdrawal_eligibility(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_daily_checkin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_coupon(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.redeem_gift(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_game_session(integer, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
