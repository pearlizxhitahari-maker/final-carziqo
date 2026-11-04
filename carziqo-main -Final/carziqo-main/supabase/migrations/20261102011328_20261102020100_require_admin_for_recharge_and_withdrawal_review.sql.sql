/*
# Require admin for recharge and withdrawal review

## Problem
approve_recharge, reject_recharge, approve_withdrawal and reject_withdrawal
run with owner rights but never checked the caller's role. Any signed-in user
could approve their own recharge (crediting their wallet) or approve or reject
anyone's withdrawal.

## Changes
Each function now starts with an is_admin() check and raises an error for
non-admin callers. Bodies are otherwise unchanged.

## Notes
- Idempotent: CREATE OR REPLACE can be re-run safely.
- EXECUTE for anon was already revoked in the previous lock-down migration.
*/

CREATE OR REPLACE FUNCTION public.approve_recharge(p_recharge_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid;
  v_amount numeric(12,2);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can review recharges';
  END IF;

  SELECT user_id, amount INTO v_user_id, v_amount
  FROM public.recharge_logs
  WHERE id = p_recharge_id AND status = 'pending';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Recharge not found or not pending';
  END IF;

  UPDATE public.recharge_logs
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_recharge_id;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance + v_amount
  WHERE id = v_user_id;

  PERFORM public.log_action(v_user_id, 'recharge_approved',
    'Amount: ' || v_amount || ' approved by admin');
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_recharge(p_recharge_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can review recharges';
  END IF;

  UPDATE public.recharge_logs
  SET status = 'rejected', admin_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_recharge_id AND status = 'pending';

  PERFORM public.log_action(
    (SELECT user_id FROM public.recharge_logs WHERE id = p_recharge_id),
    'recharge_rejected', p_note
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_withdrawal(p_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid;
  v_amount numeric(12,2);
  v_fee numeric(12,2);
  v_net numeric(12,2);
  v_eligible boolean;
  v_qualified integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can review withdrawals';
  END IF;

  SELECT user_id, amount, fee_amount, net_amount
  INTO v_user_id, v_amount, v_fee, v_net
  FROM public.withdrawal_logs
  WHERE id = p_withdrawal_id AND status = 'pending';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Withdrawal not found or not pending';
  END IF;

  SELECT eligible, qualified_referrals INTO v_eligible, v_qualified
  FROM public.check_withdrawal_eligibility(v_user_id);

  IF NOT COALESCE(v_eligible, false) THEN
    RAISE EXCEPTION 'Withdrawal blocked: at least one qualified referral with a rental of 500 PHP is required';
  END IF;

  IF v_amount < 500.00 THEN
    RAISE EXCEPTION 'Minimum withdrawal is 500 PHP';
  END IF;

  UPDATE public.withdrawal_logs
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_withdrawal_id;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance - v_amount
  WHERE id = v_user_id;

  PERFORM public.log_action(
    v_user_id,
    'withdrawal_approved',
    'Requested: ' || v_amount || ' PHP, Fee: ' || v_fee || ' PHP, Payout: ' || v_net || ' PHP'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_withdrawal(p_withdrawal_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can review withdrawals';
  END IF;

  UPDATE public.withdrawal_logs
  SET status = 'rejected', admin_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_withdrawal_id AND status = 'pending';

  PERFORM public.log_action(
    (SELECT user_id FROM public.withdrawal_logs WHERE id = p_withdrawal_id),
    'withdrawal_rejected', p_note
  );
END;
$$;
