CREATE OR REPLACE FUNCTION public.withdrawal_referrals_required(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prior integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT count(*) INTO v_prior
  FROM public.withdrawal_logs
  WHERE user_id = p_user_id AND status <> 'rejected';

  RETURN CASE WHEN v_prior = 0 THEN 1 WHEN v_prior = 1 THEN 3 ELSE 5 END;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.withdrawal_referrals_required(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdrawal_referrals_required(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_withdrawal_eligibility(p_user_id uuid)
RETURNS TABLE(eligible boolean, total_referrals integer, qualified_referrals integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_referral_code text;
  v_total_referrals integer := 0;
  v_qualified_referrals integer := 0;
  v_required integer;
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

  v_required := public.withdrawal_referrals_required(p_user_id);

  RETURN QUERY SELECT (v_qualified_referrals >= v_required), v_total_referrals, v_qualified_referrals;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_withdrawal_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_eligible boolean;
  v_required integer;
BEGIN
  SELECT eligible INTO v_eligible
  FROM public.check_withdrawal_eligibility(NEW.user_id);

  IF NOT COALESCE(v_eligible, false) THEN
    v_required := public.withdrawal_referrals_required(NEW.user_id);
    RAISE EXCEPTION 'This withdrawal requires % qualified referral(s) who each invested at least 500 PHP', v_required;
  END IF;

  RETURN NEW;
END;
$function$;
