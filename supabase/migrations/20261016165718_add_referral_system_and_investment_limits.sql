/*
# Referral System & Investment Limits & Withdrawal Eligibility

## Overview
1. Adds referral_code and referred_by columns to profiles
2. Auto-generates a unique referral code for each new user
3. Creates check_withdrawal_eligibility() function that requires:
   - At least 5 referrals (users who registered with this user's referral code)
   - Each referral must have at least one investment >= 500 PHP
4. Modifies approve_withdrawal() to enforce referral check server-side
5. Adds check_investment_limit() function for 500-100000 PHP enforcement
6. Adds referred_by to user metadata handling in handle_new_user
*/

-- ============================================================
-- ADD REFERRAL COLUMNS TO PROFILES
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by text;

-- Generate referral codes for existing users
UPDATE public.profiles
SET referral_code = UPPER(SUBSTRING(encode(gen_random_bytes(4), 'hex') FROM 1 FOR 6))
WHERE referral_code IS NULL;

-- ============================================================
-- UPDATE handle_new_user to auto-generate referral code
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_code text;
  v_referred_by text;
BEGIN
  v_referred_by := NEW.raw_user_meta_data->>'referral_code';

  -- Generate a unique referral code
  LOOP
    v_referral_code := UPPER(SUBSTRING(encode(gen_random_bytes(4), 'hex') FROM 1 FOR 6));
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_referral_code) THEN
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO public.profiles (id, full_name, phone, referral_code, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    v_referral_code,
    NULLIF(v_referred_by, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================================
-- INVESTMENT LIMITS FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_investment_limit(p_amount numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_amount < 500 THEN
    RAISE EXCEPTION 'Minimum investment amount is 500 PHP';
  END IF;
  IF p_amount > 100000 THEN
    RAISE EXCEPTION 'Maximum investment amount is 100,000 PHP';
  END IF;
  RETURN true;
END;
$$;

-- ============================================================
-- WITHDRAWAL ELIGIBILITY CHECK
-- ============================================================
-- Returns true if the user has at least 5 referrals who each have
-- at least one investment with investment_amount >= 500
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
  -- Get the user's referral code
  SELECT referral_code INTO v_referral_code FROM public.profiles WHERE id = p_user_id;
  IF v_referral_code IS NULL THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  -- Count total referrals (users who registered with this referral code)
  SELECT count(*) INTO v_total_referrals
  FROM public.profiles
  WHERE referred_by = v_referral_code;

  -- Count qualified referrals (referrals who have at least one investment >= 500)
  SELECT count(DISTINCT p.id) INTO v_qualified_referrals
  FROM public.profiles p
  JOIN public.investments i ON i.user_id = p.id
  WHERE p.referred_by = v_referral_code
    AND i.investment_amount >= 500;

  RETURN QUERY SELECT (v_qualified_referrals >= 5), v_total_referrals, v_qualified_referrals;
END;
$$;

-- ============================================================
-- UPDATE approve_withdrawal TO CHECK ELIGIBILITY
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_withdrawal(p_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_amount numeric(12,2);
  v_eligible boolean;
  v_qualified integer;
BEGIN
  SELECT user_id, amount INTO v_user_id, v_amount
  FROM public.withdrawal_logs
  WHERE id = p_withdrawal_id AND status = 'pending';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Withdrawal not found or not pending';
  END IF;

  -- Check withdrawal eligibility
  SELECT eligible INTO v_eligible
  FROM public.check_withdrawal_eligibility(v_user_id);

  IF NOT v_eligible THEN
    SELECT qualified_referrals INTO v_qualified
    FROM public.check_withdrawal_eligibility(v_user_id);
    RAISE EXCEPTION 'Withdrawal blocked: User has only % qualified referrals (minimum 5 required, each with 500+ PHP investment)', v_qualified;
  END IF;

  UPDATE public.withdrawal_logs
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_withdrawal_id;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance - v_amount
  WHERE id = v_user_id;

  PERFORM public.log_action(v_user_id, 'withdrawal_approved',
    'Amount: ' || v_amount || ' approved by admin');
END;
$$;

-- Grant execute on the eligibility check to authenticated users
GRANT EXECUTE ON FUNCTION public.check_withdrawal_eligibility(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_investment_limit(numeric) TO authenticated;
