/*
# Car Rental Platform — Functions, Triggers, Seeds

## Overview
Creates all PL/pgSQL functions, triggers, and seed data for the platform.
Key bug fixes:
1. approve_withdrawal does NOT check referral eligibility — admin can approve freely.
   Eligibility is still enforced at submission time via the enforce_withdrawal_eligibility trigger.
2. admin_manage_investment function for pause/resume/edit/delete rental contracts.
3. investments.status CHECK already includes 'paused' from the previous migration.
*/

-- ============================================================
-- LOG_ACTION helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_action(
  p_user_id uuid,
  p_action text,
  p_details text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.audit_logs (user_id, action, details)
  VALUES (p_user_id, p_action, p_details);
$$;

-- ============================================================
-- HANDLE_NEW_USER trigger (resilient, with extensions schema)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions', 'pg_catalog'
AS $$
DECLARE
  v_referral_code text;
  v_referred_by text;
  v_phone text;
BEGIN
  v_referred_by := NEW.raw_user_meta_data->>'referral_code';
  v_phone := NULLIF(NEW.raw_user_meta_data->>'phone', '');

  LOOP
    v_referral_code := UPPER(SUBSTRING(encode(extensions.gen_random_bytes(4), 'hex') FROM 1 FOR 6));
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_referral_code) THEN
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO public.profiles (id, full_name, phone, referral_code, referred_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_phone,
    v_referral_code,
    NULLIF(v_referred_by, '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- PROMOTE_FIRST_USER_TO_ADMIN
-- ============================================================
CREATE OR REPLACE FUNCTION public.promote_first_user_to_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions', 'pg_catalog'
AS $$
DECLARE
  profile_count integer;
BEGIN
  SELECT COUNT(*) INTO profile_count FROM public.profiles;
  IF profile_count = 1 THEN
    UPDATE public.profiles SET role = 'admin' WHERE id = NEW.id;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_first_admin ON public.profiles;
CREATE TRIGGER on_profile_created_first_admin
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.promote_first_user_to_admin();

-- ============================================================
-- ASSIGN_FREE_CAR
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_free_car()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions', 'pg_catalog'
AS $$
DECLARE
  free_car RECORD;
  inv_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.investments
    WHERE user_id = NEW.id
      AND investment_amount = 0.00
      AND status <> 'cancelled'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO free_car
  FROM public.cars
  WHERE is_free = true AND status = 'active'
  ORDER BY created_at ASC
  LIMIT 1;

  IF free_car.id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.investments (
      user_id, car_id, car_name, car_image_url,
      investment_amount, duration_days, daily_payout
    ) VALUES (
      NEW.id,
      free_car.id,
      free_car.car_name,
      free_car.image_url,
      0.00,
      15,
      1.00
    )
    RETURNING id INTO inv_id;

    IF inv_id IS NOT NULL THEN
      UPDATE public.profiles
      SET free_investment_id = inv_id
      WHERE id = NEW.id;

      PERFORM public.log_action(NEW.id, 'free_car_assigned', 'Free starter car: ' || free_car.car_name);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_free_car ON public.profiles;
CREATE TRIGGER on_profile_created_free_car
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.assign_free_car();

-- ============================================================
-- ENFORCE_FREE_CAR_RULES
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_free_car_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions', 'pg_catalog'
AS $$
DECLARE
  car_is_free boolean;
BEGIN
  SELECT is_free INTO car_is_free
  FROM public.cars
  WHERE id = NEW.car_id;

  IF COALESCE(car_is_free, false) THEN
    IF NEW.investment_amount <> 0.00 THEN
      RAISE EXCEPTION 'The starter car is free and cannot have a price';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.investments
      WHERE user_id = NEW.user_id
        AND investment_amount = 0.00
        AND status <> 'cancelled'
        AND id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'Each user may claim the free starter car only once';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_free_car_rules_on_investment ON public.investments;
CREATE TRIGGER enforce_free_car_rules_on_investment
  BEFORE INSERT ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_free_car_rules();

-- ============================================================
-- PREPARE_WITHDRAWAL trigger (fee calculation)
-- ============================================================
CREATE OR REPLACE FUNCTION public.prepare_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.amount < 500.00 THEN
    RAISE EXCEPTION 'Minimum withdrawal is 500 PHP';
  END IF;

  NEW.fee_amount := round(NEW.amount * 0.01, 2);
  NEW.net_amount := NEW.amount - NEW.fee_amount;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_withdrawal_before_write ON public.withdrawal_logs;
CREATE TRIGGER prepare_withdrawal_before_write
  BEFORE INSERT OR UPDATE OF amount ON public.withdrawal_logs
  FOR EACH ROW EXECUTE FUNCTION public.prepare_withdrawal();

-- ============================================================
-- PREPARE_RECHARGE trigger (amount limits)
-- ============================================================
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

-- ============================================================
-- WITHDRAWAL ELIGIBILITY (referral tiers)
-- ============================================================
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

REVOKE EXECUTE ON FUNCTION public.check_withdrawal_eligibility(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_withdrawal_eligibility(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_withdrawal_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

DROP TRIGGER IF EXISTS enforce_withdrawal_eligibility_before_write ON public.withdrawal_logs;
CREATE TRIGGER enforce_withdrawal_eligibility_before_write
  BEFORE INSERT ON public.withdrawal_logs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_withdrawal_eligibility();

-- ============================================================
-- CHECK_INVESTMENT_LIMIT
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
-- CREATE_INVESTMENT (server-side, locked writes)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_investment(p_car_id uuid, p_amount numeric, p_duration_days integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_car public.cars%ROWTYPE;
  v_balance numeric;
  v_daily_rate numeric;
  v_daily_payout numeric;
  v_investment_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to invest';
  END IF;

  SELECT * INTO v_car FROM public.cars WHERE id = p_car_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This car is not available for rent';
  END IF;

  IF v_car.is_free THEN
    IF COALESCE(p_amount, -1) <> 0 THEN
      RAISE EXCEPTION 'The free starter car does not require payment';
    END IF;
    IF p_duration_days <> 15 THEN
      RAISE EXCEPTION 'The starter car has a fixed 15 day term';
    END IF;
    v_daily_payout := 1.00;
  ELSE
    IF p_amount IS NULL OR p_amount < 500 THEN
      RAISE EXCEPTION 'Minimum investment amount is 500 PHP';
    END IF;
    IF p_amount > 100000 THEN
      RAISE EXCEPTION 'Maximum investment amount is 100,000 PHP';
    END IF;

    v_daily_rate := CASE p_duration_days WHEN 30 THEN 0.02 WHEN 60 THEN 0.03 ELSE NULL END;
    IF v_daily_rate IS NULL THEN
      RAISE EXCEPTION 'Rental period must be 30 or 60 days';
    END IF;
    v_daily_payout := round(p_amount * v_daily_rate, 2);

    SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = v_user FOR UPDATE;
    IF v_balance IS NULL OR v_balance < p_amount THEN
      RAISE EXCEPTION 'Insufficient balance. Please recharge your wallet first.';
    END IF;

    UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE id = v_user;
  END IF;

  INSERT INTO public.investments (
    user_id, car_id, car_name, car_image_url, investment_amount, duration_days, daily_payout
  ) VALUES (
    v_user, v_car.id, v_car.car_name, v_car.image_url, COALESCE(p_amount, 0), p_duration_days, v_daily_payout
  )
  RETURNING id INTO v_investment_id;

  IF v_car.is_free THEN
    UPDATE public.profiles SET free_investment_id = v_investment_id WHERE id = v_user;
  END IF;

  PERFORM public.log_action(
    v_user,
    'investment_created',
    'Car: ' || v_car.car_name || ', Amount: ' || COALESCE(p_amount, 0) || ', Duration: ' || p_duration_days || ' days'
  );

  RETURN v_investment_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_investment(uuid, numeric, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_investment(uuid, numeric, integer) TO authenticated;

-- Lock direct investment writes from clients
REVOKE INSERT, UPDATE, DELETE ON public.investments FROM anon, authenticated;

-- Restrict profile updates to safe columns only
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, phone, avatar_url, avatar_frame, theme_color, language, notif_sound, currency)
  ON public.profiles TO authenticated;

-- ============================================================
-- CREDIT_DAILY_EARNINGS (scoped to caller)
-- ============================================================
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

-- ============================================================
-- APPROVE_RECHARGE (admin-only)
-- ============================================================
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

-- ============================================================
-- REJECT_RECHARGE (admin-only)
-- ============================================================
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

-- ============================================================
-- APPROVE_WITHDRAWAL (admin-only, NO referral check — BUG FIX)
-- The referral eligibility is enforced at submission time via trigger.
-- Admins can approve without being blocked by the referral requirement.
-- ============================================================
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

-- ============================================================
-- REJECT_WITHDRAWAL (admin-only)
-- ============================================================
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

-- ============================================================
-- ADMIN_MANAGE_INVESTMENT (pause/resume/edit/delete — BUG FIX)
-- ============================================================
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

-- ============================================================
-- VIP LEVEL functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_vip_level(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_code text;
  v_referral_count integer := 0;
  v_investment_total numeric(12,2) := 0;
  v_referral_level integer := 1;
  v_investment_level integer := 1;
BEGIN
  SELECT referral_code INTO v_referral_code
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_referral_code IS NOT NULL THEN
    SELECT count(*) INTO v_referral_count
    FROM public.profiles
    WHERE referred_by = v_referral_code;
  END IF;

  SELECT COALESCE(SUM(investment_amount), 0) INTO v_investment_total
  FROM public.investments
  WHERE user_id = p_user_id
    AND status = 'active';

  v_referral_level := LEAST(10, GREATEST(1, v_referral_count - 2));
  v_investment_level := CASE
    WHEN v_investment_total >= 100000 THEN 5
    WHEN v_investment_total >= 50000 THEN 4
    WHEN v_investment_total >= 20000 THEN 3
    WHEN v_investment_total >= 5000 THEN 2
    ELSE 1
  END;

  UPDATE public.profiles
  SET vip_level = GREATEST(v_referral_level, v_investment_level)
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_vip_level(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_vip_level_after_investment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_vip_level(CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END);
  IF TG_OP = 'UPDATE' AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    PERFORM public.refresh_vip_level(OLD.user_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS investments_refresh_vip_level ON public.investments;
CREATE TRIGGER investments_refresh_vip_level
  AFTER INSERT OR UPDATE OR DELETE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.refresh_vip_level_after_investment();

CREATE OR REPLACE FUNCTION public.refresh_referrer_vip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_referrer_id uuid;
  v_old_referrer_id uuid;
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.referred_by IS NOT NULL THEN
    SELECT id INTO v_old_referrer_id
    FROM public.profiles
    WHERE referral_code = OLD.referred_by;
    IF v_old_referrer_id IS NOT NULL THEN
      PERFORM public.refresh_vip_level(v_old_referrer_id);
    END IF;
  END IF;

  IF NEW.referred_by IS NOT NULL THEN
    SELECT id INTO v_new_referrer_id
    FROM public.profiles
    WHERE referral_code = NEW.referred_by;
    IF v_new_referrer_id IS NOT NULL THEN
      PERFORM public.refresh_vip_level(v_new_referrer_id);
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_referrer_vip() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_refresh_referrer_vip ON public.profiles;
CREATE TRIGGER profiles_refresh_referrer_vip
  AFTER INSERT OR UPDATE OF referred_by ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.refresh_referrer_vip();

-- ============================================================
-- ADMIN NOTIFICATION functions and triggers
-- ============================================================
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

REVOKE ALL ON FUNCTION public.notify_profile_created() FROM PUBLIC, anon, authenticated;

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

REVOKE ALL ON FUNCTION public.notify_recharge_created() FROM PUBLIC, anon, authenticated;

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

-- ============================================================
-- USER-FACING functions: checkin, game, coupons, gifts
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_daily_checkin()
RETURNS TABLE(reward_amount numeric, carbon_earned integer, already_claimed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing record;
  v_reward numeric(12,2) := 5.00;
  v_carbon integer := 1;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_existing
  FROM public.daily_checkins
  WHERE user_id = v_user_id AND checkin_date = CURRENT_DATE;

  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT v_existing.reward_amount, v_existing.carbon_earned, true;
    RETURN;
  END IF;

  INSERT INTO public.daily_checkins (user_id, reward_amount, carbon_earned)
  VALUES (v_user_id, v_reward, v_carbon);

  UPDATE public.profiles
  SET wallet_balance = wallet_balance + v_reward,
      carbon_points = carbon_points + v_carbon
  WHERE id = v_user_id;

  PERFORM public.log_action(v_user_id, 'daily_checkin',
    'Reward: ' || v_reward || ' PHP, Carbon: +' || v_carbon);

  RETURN QUERY SELECT v_reward, v_carbon, false;
END;
$$;

CREATE OR REPLACE FUNCTION public.bubble_game_played_today()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.game_sessions
    WHERE user_id = v_user_id
      AND game_type = 'bubble_pop'
      AND created_at >= date_trunc('day', now())
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.bubble_game_played_today() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bubble_game_played_today() TO authenticated;

CREATE OR REPLACE FUNCTION public.save_game_session(p_points_earned integer, p_bubbles_popped integer, p_duration_seconds integer DEFAULT 15)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.bubble_game_played_today() THEN
    RAISE EXCEPTION 'You can only play the bubble game once per day';
  END IF;

  INSERT INTO public.game_sessions (user_id, game_type, points_earned, bubbles_popped, duration_seconds)
  VALUES (v_user_id, 'bubble_pop', p_points_earned, p_bubbles_popped, p_duration_seconds);

  UPDATE public.profiles
  SET carbon_points = carbon_points + p_points_earned
  WHERE id = v_user_id;

  PERFORM public.log_action(v_user_id, 'bubble_game_played',
    'Points: ' || p_points_earned || ', Bubbles: ' || p_bubbles_popped);
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_coupon(p_coupon_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_coupon record;
  v_user_carbon integer;
  v_already_claimed record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_coupon FROM public.coupons WHERE id = p_coupon_id AND is_active = true;
  IF v_coupon IS NULL THEN
    RAISE EXCEPTION 'Coupon not found or inactive';
  END IF;

  IF v_coupon.max_claims > 0 AND v_coupon.claims_count >= v_coupon.max_claims THEN
    RAISE EXCEPTION 'Coupon has reached maximum claims';
  END IF;

  IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at < now() THEN
    RAISE EXCEPTION 'Coupon has expired';
  END IF;

  SELECT * INTO v_already_claimed FROM public.user_coupons
  WHERE user_id = v_user_id AND coupon_id = p_coupon_id;
  IF v_already_claimed IS NOT NULL THEN
    RAISE EXCEPTION 'You have already claimed this coupon';
  END IF;

  SELECT carbon_points INTO v_user_carbon FROM public.profiles WHERE id = v_user_id;
  IF v_user_carbon < v_coupon.carbon_cost THEN
    RAISE EXCEPTION 'Insufficient carbon points. You need %, you have %', v_coupon.carbon_cost, v_user_carbon;
  END IF;

  UPDATE public.profiles
  SET carbon_points = carbon_points - v_coupon.carbon_cost,
      wallet_balance = wallet_balance + v_coupon.discount_value
  WHERE id = v_user_id;

  INSERT INTO public.user_coupons (user_id, coupon_id, code, title, discount_value)
  VALUES (v_user_id, p_coupon_id, v_coupon.code, v_coupon.title, v_coupon.discount_value);

  UPDATE public.coupons SET claims_count = claims_count + 1 WHERE id = p_coupon_id;

  PERFORM public.log_action(v_user_id, 'coupon_claimed',
    'Coupon: ' || v_coupon.code || ', Carbon cost: ' || v_coupon.carbon_cost || ', Credited: ' || v_coupon.discount_value || ' PHP');
END;
$function$;

CREATE OR REPLACE FUNCTION public.redeem_gift(p_gift_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_gift record;
  v_user_carbon integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_gift FROM public.gift_list WHERE id = p_gift_id AND is_active = true;
  IF v_gift IS NULL THEN
    RAISE EXCEPTION 'Gift not found or inactive';
  END IF;

  IF v_gift.stock <= 0 THEN
    RAISE EXCEPTION 'Gift is out of stock';
  END IF;

  SELECT carbon_points INTO v_user_carbon FROM public.profiles WHERE id = v_user_id;
  IF v_user_carbon < v_gift.carbon_cost THEN
    RAISE EXCEPTION 'Insufficient carbon points. You need %, you have %', v_gift.carbon_cost, v_user_carbon;
  END IF;

  UPDATE public.profiles
  SET carbon_points = carbon_points - v_gift.carbon_cost,
      wallet_balance = wallet_balance + v_gift.cash_value
  WHERE id = v_user_id;

  INSERT INTO public.user_gifts (user_id, gift_id, name, carbon_cost, cash_value)
  VALUES (v_user_id, p_gift_id, v_gift.name, v_gift.carbon_cost, v_gift.cash_value);

  UPDATE public.gift_list SET stock = stock - 1 WHERE id = p_gift_id;

  PERFORM public.log_action(v_user_id, 'gift_redeemed',
    'Gift: ' || v_gift.name || ', Carbon cost: ' || v_gift.carbon_cost || ', Credited: ' || v_gift.cash_value || ' PHP');
END;
$function$;

-- ============================================================
-- FUNCTION EXECUTE GRANTS (final state)
-- ============================================================
-- Admin RPC functions: authenticated only (is_admin check inside)
REVOKE EXECUTE ON FUNCTION public.approve_recharge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_recharge(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.reject_recharge(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_recharge(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.approve_withdrawal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) TO authenticated;

-- User-facing functions: authenticated only
REVOKE EXECUTE ON FUNCTION public.claim_daily_checkin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_checkin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.save_game_session(integer, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_game_session(integer, integer, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.claim_coupon(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_coupon(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.redeem_gift(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_gift(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.check_investment_limit(numeric) FROM PUBLIC, anon, authenticated;

-- is_admin: needed by anon for news policy check
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- Internal/trigger-only functions: locked from direct call
REVOKE EXECUTE ON FUNCTION public.assign_free_car() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_free_car_rules() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_action(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prepare_withdrawal() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prepare_recharge() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promote_first_user_to_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_vip_level_after_investment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_referrer_vip() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_withdrawal_eligibility() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_profile_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_recharge_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_withdrawal_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_admin_notification(text, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;