/*
# Daily Check-in, Bubble Game, Coupons, Gift List & Carbon Points

## Overview
Adds a gamification system to the car rental platform:
1. Daily check-in with 5 PHP reward + carbon points
2. Bubble pop mini-game (15 seconds, each bubble gives 1-5 points)
3. Carbon points system (1 carbon point = 0.10 PHP / 10 centavos)
4. Coupons system (admin-managed discount codes)
5. Gift list system (admin-managed redeemable gifts purchasable with carbon points)

## New Tables
- daily_checkins — tracks daily check-in per user (one per day)
- game_sessions — tracks bubble game sessions and points earned
- coupons — admin-managed coupon codes for users
- user_coupons — coupons claimed by users
- gift_list — admin-managed gifts redeemable with carbon points
- user_gifts — gifts redeemed by users using carbon points

## Modified Tables
- profiles — adds carbon_points column (integer, default 0)

## Security
- All new tables have RLS enabled with ownership-scoped policies
- Admin-only access for managing coupons and gifts
*/

-- ============================================================
-- ADD CARBON POINTS TO PROFILES
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS carbon_points integer NOT NULL DEFAULT 0;

-- ============================================================
-- DAILY CHECK-INS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_amount numeric(12,2) NOT NULL DEFAULT 5.00,
  carbon_earned integer NOT NULL DEFAULT 1,
  checkin_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, checkin_date)
);

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_checkins" ON public.daily_checkins;
CREATE POLICY "select_own_checkins" ON public.daily_checkins FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "insert_own_checkins" ON public.daily_checkins;
CREATE POLICY "insert_own_checkins" ON public.daily_checkins FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_select_all_checkins" ON public.daily_checkins;
CREATE POLICY "admin_select_all_checkins" ON public.daily_checkins FOR SELECT
  TO authenticated USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_checkins_user_id ON public.daily_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_date ON public.daily_checkins(checkin_date);

-- ============================================================
-- GAME SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  game_type text NOT NULL DEFAULT 'bubble_pop',
  points_earned integer NOT NULL DEFAULT 0,
  bubbles_popped integer NOT NULL DEFAULT 0,
  duration_seconds integer NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_games" ON public.game_sessions;
CREATE POLICY "select_own_games" ON public.game_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "insert_own_games" ON public.game_sessions;
CREATE POLICY "insert_own_games" ON public.game_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON public.game_sessions(user_id);

-- ============================================================
-- COUPONS TABLE (admin-managed)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  discount_value numeric(12,2) NOT NULL DEFAULT 0,
  carbon_cost integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  max_claims integer NOT NULL DEFAULT 0,
  claims_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_active_coupons" ON public.coupons;
CREATE POLICY "select_active_coupons" ON public.coupons FOR SELECT
  TO authenticated USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "admin_insert_coupons" ON public.coupons;
CREATE POLICY "admin_insert_coupons" ON public.coupons FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_coupons" ON public.coupons;
CREATE POLICY "admin_update_coupons" ON public.coupons FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_coupons" ON public.coupons;
CREATE POLICY "admin_delete_coupons" ON public.coupons FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================
-- USER COUPONS TABLE (claimed coupons)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  discount_value numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','expired')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  UNIQUE(user_id, coupon_id)
);

ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_user_coupons" ON public.user_coupons;
CREATE POLICY "select_own_user_coupons" ON public.user_coupons FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "insert_own_user_coupons" ON public.user_coupons;
CREATE POLICY "insert_own_user_coupons" ON public.user_coupons FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_user_coupons" ON public.user_coupons;
CREATE POLICY "update_own_user_coupons" ON public.user_coupons FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_coupons_user_id ON public.user_coupons(user_id);

-- ============================================================
-- GIFT LIST TABLE (admin-managed, redeemable with carbon points)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gift_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  carbon_cost integer NOT NULL DEFAULT 0,
  cash_value numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  stock integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gift_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_active_gifts" ON public.gift_list;
CREATE POLICY "select_active_gifts" ON public.gift_list FOR SELECT
  TO authenticated USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "admin_insert_gifts" ON public.gift_list;
CREATE POLICY "admin_insert_gifts" ON public.gift_list FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_gifts" ON public.gift_list;
CREATE POLICY "admin_update_gifts" ON public.gift_list FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_gifts" ON public.gift_list;
CREATE POLICY "admin_delete_gifts" ON public.gift_list FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================
-- USER GIFTS TABLE (redeemed gifts)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  gift_id uuid NOT NULL REFERENCES public.gift_list(id) ON DELETE CASCADE,
  name text NOT NULL,
  carbon_cost integer NOT NULL DEFAULT 0,
  cash_value numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'redeemed' CHECK (status IN ('redeemed','processed','cancelled')),
  redeemed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_gifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_user_gifts" ON public.user_gifts;
CREATE POLICY "select_own_user_gifts" ON public.user_gifts FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "insert_own_user_gifts" ON public.user_gifts;
CREATE POLICY "insert_own_user_gifts" ON public.user_gifts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_update_user_gifts" ON public.user_gifts;
CREATE POLICY "admin_update_user_gifts" ON public.user_gifts FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_user_gifts_user_id ON public.user_gifts(user_id);

-- ============================================================
-- FUNCTION: Claim daily check-in reward
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

-- ============================================================
-- FUNCTION: Save game session and add carbon points
-- ============================================================
CREATE OR REPLACE FUNCTION public.save_game_session(
  p_points_earned integer,
  p_bubbles_popped integer,
  p_duration_seconds integer DEFAULT 15
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.game_sessions (user_id, game_type, points_earned, bubbles_popped, duration_seconds)
  VALUES (v_user_id, 'bubble_pop', p_points_earned, p_bubbles_popped, p_duration_seconds);

  UPDATE public.profiles
  SET carbon_points = carbon_points + p_points_earned
  WHERE id = v_user_id;

  PERFORM public.log_action(v_user_id, 'bubble_game_played',
    'Points: ' || p_points_earned || ', Bubbles: ' || p_bubbles_popped);
END;
$$;

-- ============================================================
-- FUNCTION: Claim coupon with carbon points
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_coupon(p_coupon_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  SET carbon_points = carbon_points - v_coupon.carbon_cost
  WHERE id = v_user_id;

  INSERT INTO public.user_coupons (user_id, coupon_id, code, title, discount_value)
  VALUES (v_user_id, p_coupon_id, v_coupon.code, v_coupon.title, v_coupon.discount_value);

  UPDATE public.coupons SET claims_count = claims_count + 1 WHERE id = p_coupon_id;

  PERFORM public.log_action(v_user_id, 'coupon_claimed',
    'Coupon: ' || v_coupon.code || ', Carbon cost: ' || v_coupon.carbon_cost);
END;
$$;

-- ============================================================
-- FUNCTION: Redeem gift with carbon points
-- ============================================================
CREATE OR REPLACE FUNCTION public.redeem_gift(p_gift_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  SET carbon_points = carbon_points - v_gift.carbon_cost
  WHERE id = v_user_id;

  INSERT INTO public.user_gifts (user_id, gift_id, name, carbon_cost, cash_value)
  VALUES (v_user_id, p_gift_id, v_gift.name, v_gift.carbon_cost, v_gift.cash_value);

  UPDATE public.gift_list SET stock = stock - 1 WHERE id = p_gift_id;

  PERFORM public.log_action(v_user_id, 'gift_redeemed',
    'Gift: ' || v_gift.name || ', Carbon cost: ' || v_gift.carbon_cost);
END;
$$;

-- ============================================================
-- GRANT EXECUTE
-- ============================================================
GRANT EXECUTE ON FUNCTION public.claim_daily_checkin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_game_session(integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_coupon(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_gift(uuid) TO authenticated;

-- ============================================================
-- SEED: Starter coupons
-- ============================================================
INSERT INTO public.coupons (code, title, description, discount_value, carbon_cost, max_claims)
SELECT 'WELCOME10', 'Welcome Bonus', '10 PHP discount on your next investment', 10.00, 10, 1000
WHERE NOT EXISTS (SELECT 1 FROM public.coupons WHERE code = 'WELCOME10');

INSERT INTO public.coupons (code, title, description, discount_value, carbon_cost, max_claims)
SELECT 'CARBON25', 'Carbon Saver', '25 PHP bonus to your wallet', 25.00, 30, 500
WHERE NOT EXISTS (SELECT 1 FROM public.coupons WHERE code = 'CARBON25');

INSERT INTO public.coupons (code, title, description, discount_value, carbon_cost, max_claims)
SELECT 'ECO50', 'Eco Warrior', '50 PHP bonus to your wallet', 50.00, 60, 200
WHERE NOT EXISTS (SELECT 1 FROM public.coupons WHERE code = 'ECO50');

-- ============================================================
-- SEED: Starter gift list
-- ============================================================
INSERT INTO public.gift_list (name, description, carbon_cost, cash_value, stock)
SELECT '5 PHP Cash Reward', 'Convert your carbon points to cash', 50, 5.00, 1000
WHERE NOT EXISTS (SELECT 1 FROM public.gift_list WHERE name = '5 PHP Cash Reward');

INSERT INTO public.gift_list (name, description, carbon_cost, cash_value, stock)
SELECT '10 PHP Cash Reward', 'Convert your carbon points to cash', 100, 10.00, 1000
WHERE NOT EXISTS (SELECT 1 FROM public.gift_list WHERE name = '10 PHP Cash Reward');

INSERT INTO public.gift_list (name, description, carbon_cost, cash_value, stock)
SELECT '25 PHP Cash Reward', 'Convert your carbon points to cash', 250, 25.00, 500
WHERE NOT EXISTS (SELECT 1 FROM public.gift_list WHERE name = '25 PHP Cash Reward');

INSERT INTO public.gift_list (name, description, carbon_cost, cash_value, stock)
SELECT '50 PHP Cash Reward', 'Convert your carbon points to cash', 500, 50.00, 200
WHERE NOT EXISTS (SELECT 1 FROM public.gift_list WHERE name = '50 PHP Cash Reward');
