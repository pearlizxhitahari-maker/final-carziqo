/*
# Require one qualified referral and cap recharge requests

1. Withdrawal Rules
- A user must have at least one referred account that has an active or completed car rental of at least PHP 500 before a withdrawal can be submitted or approved.
- The server checks this requirement at both stages so it cannot be bypassed through direct API calls.
- The existing 500 PHP minimum withdrawal and 1% fee remain unchanged.

2. Recharge Rules
- Adds a server-side maximum recharge amount of 100,000 PHP per request.
- Existing recharge records are preserved.

3. Security
- Eligibility is checked from the signed-in user's referral relationship and investment records.
- Anonymous callers cannot create withdrawal or recharge requests through these checks.

4. Important Notes
- No balances, referrals, rentals, or transactions are deleted.
- One qualified referral means one user registered with the account's referral code and holding a rental investment of at least 500 PHP.
*/

CREATE OR REPLACE FUNCTION public.check_withdrawal_eligibility(p_user_id uuid)
RETURNS TABLE(eligible boolean, total_referrals integer, qualified_referrals integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_code text;
  v_total_referrals integer := 0;
  v_qualified_referrals integer := 0;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT referral_code INTO v_referral_code
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_referral_code IS NULL THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  SELECT count(*) INTO v_total_referrals
  FROM public.profiles
  WHERE referred_by = v_referral_code;

  SELECT count(DISTINCT p.id) INTO v_qualified_referrals
  FROM public.profiles p
  JOIN public.investments i ON i.user_id = p.id
  WHERE p.referred_by = v_referral_code
    AND i.investment_amount >= 500
    AND i.status IN ('active', 'completed');

  RETURN QUERY SELECT (v_qualified_referrals >= 1), v_total_referrals, v_qualified_referrals;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_withdrawal_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_eligible boolean;
BEGIN
  SELECT eligible INTO v_eligible
  FROM public.check_withdrawal_eligibility(NEW.user_id);

  IF NOT COALESCE(v_eligible, false) THEN
    RAISE EXCEPTION 'Withdrawal requires at least one qualified referral with a rental of at least 500 PHP';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_withdrawal_eligibility_before_write ON public.withdrawal_logs;
CREATE TRIGGER enforce_withdrawal_eligibility_before_write
  BEFORE INSERT ON public.withdrawal_logs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_withdrawal_eligibility();

CREATE OR REPLACE FUNCTION public.approve_withdrawal(p_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_amount numeric(12,2);
  v_fee numeric(12,2);
  v_net numeric(12,2);
  v_eligible boolean;
  v_qualified integer;
BEGIN
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

CREATE OR REPLACE FUNCTION public.prepare_recharge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.amount <= 0 OR NEW.amount > 100000.00 THEN
    RAISE EXCEPTION 'Recharge amount must be between 1 and 100,000 PHP';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_recharge_before_write ON public.recharge_logs;
CREATE TRIGGER prepare_recharge_before_write
  BEFORE INSERT OR UPDATE OF amount ON public.recharge_logs
  FOR EACH ROW EXECUTE FUNCTION public.prepare_recharge();

GRANT EXECUTE ON FUNCTION public.check_withdrawal_eligibility(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_investment_limit(numeric) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_withdrawal_eligibility() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prepare_recharge() FROM PUBLIC, anon, authenticated;
