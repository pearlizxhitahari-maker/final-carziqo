/*
# Car Rental Platform — Complete Schema (Tables, RLS, Policies, Storage)

## Overview
Creates all tables for the Carziqo.Ltd car rental/investment platform.
Bug fixes addressed:
1. investments.status CHECK includes 'paused' so admin pause works.
2. approve_withdrawal (next migration) will NOT block admin approval with referral check.

## Tables
profiles, cars, investments, payment_methods, recharge_logs, withdrawal_logs,
audit_logs, daily_checkins, game_sessions, coupons, user_coupons, gift_list,
user_gifts, withdrawal_wallets, news, admin_notifications, fleet_routes
*/

-- ============================================================
-- PROFILES TABLE (without free_investment_id FK — added after investments)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  avatar_url text,
  wallet_balance numeric(12,2) NOT NULL DEFAULT 0.00,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  referral_code text UNIQUE,
  referred_by text,
  carbon_points integer NOT NULL DEFAULT 0,
  vip_level integer NOT NULL DEFAULT 1 CHECK (vip_level BETWEEN 1 AND 10),
  theme_color text NOT NULL DEFAULT 'blue' CHECK (theme_color IN ('blue', 'emerald', 'amber', 'rose', 'violet', 'cyan')),
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'fil')),
  notif_sound boolean NOT NULL DEFAULT true,
  avatar_frame text DEFAULT 'none' CHECK (avatar_frame IS NULL OR avatar_frame IN ('none', 'gold', 'neon', 'cosmic')),
  currency text NOT NULL DEFAULT 'PHP' CHECK (currency IN ('PHP', 'USD', 'EUR'))
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- IS_ADMIN HELPER (needed by policies)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Profile policies
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile" ON public.profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;
CREATE POLICY "admin_update_profiles" ON public.profiles FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- CARS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_name text NOT NULL,
  image_url text NOT NULL,
  price numeric(10,2) NOT NULL,
  daily_return_rate numeric(5,2) NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  is_free boolean NOT NULL DEFAULT false
);

ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_active_cars" ON public.cars;
CREATE POLICY "select_active_cars" ON public.cars FOR SELECT
  TO authenticated USING (status = 'active' OR public.is_admin());

DROP POLICY IF EXISTS "admin_insert_cars" ON public.cars;
CREATE POLICY "admin_insert_cars" ON public.cars FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_cars" ON public.cars;
CREATE POLICY "admin_update_cars" ON public.cars FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_cars" ON public.cars;
CREATE POLICY "admin_delete_cars" ON public.cars FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================
-- INVESTMENTS TABLE (status includes 'paused' for admin pause)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  car_name text NOT NULL,
  car_image_url text NOT NULL,
  investment_amount numeric(10,2) NOT NULL,
  duration_days integer NOT NULL,
  daily_payout numeric(10,2) NOT NULL,
  days_completed integer NOT NULL DEFAULT 0,
  total_earned numeric(12,2) NOT NULL DEFAULT 0.00,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled','paused')),
  start_date timestamptz NOT NULL DEFAULT now(),
  last_payout_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  pause_reason text
);

ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_investments" ON public.investments;
CREATE POLICY "select_own_investments" ON public.investments FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "insert_own_investments" ON public.investments;
CREATE POLICY "insert_own_investments" ON public.investments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_investments" ON public.investments;
CREATE POLICY "update_own_investments" ON public.investments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_update_investments" ON public.investments;
CREATE POLICY "admin_update_investments" ON public.investments FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_investments_user_id ON public.investments(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_status ON public.investments(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_free_investment_per_user
ON public.investments (user_id)
WHERE investment_amount = 0.00 AND status <> 'cancelled';

-- Now add the free_investment_id FK to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS free_investment_id uuid REFERENCES public.investments(id) ON DELETE SET NULL;

-- ============================================================
-- PAYMENT METHODS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  method_name text NOT NULL,
  qr_image_url text NOT NULL,
  instructions text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_active_payment_methods" ON public.payment_methods;
CREATE POLICY "select_active_payment_methods" ON public.payment_methods FOR SELECT
  TO authenticated USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "admin_insert_payment_methods" ON public.payment_methods;
CREATE POLICY "admin_insert_payment_methods" ON public.payment_methods FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_payment_methods" ON public.payment_methods;
CREATE POLICY "admin_update_payment_methods" ON public.payment_methods FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_payment_methods" ON public.payment_methods;
CREATE POLICY "admin_delete_payment_methods" ON public.payment_methods FOR DELETE
  TO authenticated USING (public.is_admin());

-- ============================================================
-- RECHARGE LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recharge_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  payment_method text NOT NULL,
  proof_image_url text,
  reference_number text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recharge_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_recharges" ON public.recharge_logs;
CREATE POLICY "select_own_recharges" ON public.recharge_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "insert_own_recharges" ON public.recharge_logs;
CREATE POLICY "insert_own_recharges" ON public.recharge_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_update_recharges" ON public.recharge_logs;
CREATE POLICY "admin_update_recharges" ON public.recharge_logs FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_recharge_user_id ON public.recharge_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_recharge_status ON public.recharge_logs(status);

-- ============================================================
-- WITHDRAWAL LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.withdrawal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  bank_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  fee_amount numeric(12,2) NOT NULL DEFAULT 0.00,
  net_amount numeric(12,2) NOT NULL DEFAULT 0.00
);

ALTER TABLE public.withdrawal_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_withdrawals" ON public.withdrawal_logs;
CREATE POLICY "select_own_withdrawals" ON public.withdrawal_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "insert_own_withdrawals" ON public.withdrawal_logs;
CREATE POLICY "insert_own_withdrawals" ON public.withdrawal_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_update_withdrawals" ON public.withdrawal_logs;
CREATE POLICY "admin_update_withdrawals" ON public.withdrawal_logs FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_withdrawal_user_id ON public.withdrawal_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON public.withdrawal_logs(status);

-- ============================================================
-- AUDIT LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_audit_logs" ON public.audit_logs;
CREATE POLICY "select_own_audit_logs" ON public.audit_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "insert_own_audit_logs" ON public.audit_logs;
CREATE POLICY "insert_own_audit_logs" ON public.audit_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "admin_delete_audit_logs" ON public.audit_logs;
CREATE POLICY "admin_delete_audit_logs" ON public.audit_logs FOR DELETE
  TO authenticated USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_audit_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.audit_logs(created_at DESC);

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
-- COUPONS TABLE
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
-- USER COUPONS TABLE
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
-- GIFT LIST TABLE
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
-- USER GIFTS TABLE
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
-- WITHDRAWAL WALLETS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.withdrawal_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'My Wallet',
  method text NOT NULL CHECK (method IN ('gcash', 'paymaya', 'bank', 'crypto')),
  account_name text NOT NULL,
  account_number text NOT NULL,
  bank_name text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.withdrawal_wallets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_withdrawal_wallets_user ON public.withdrawal_wallets(user_id);

DROP POLICY IF EXISTS "select_own_wallets" ON public.withdrawal_wallets;
CREATE POLICY "select_own_wallets" ON public.withdrawal_wallets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_wallets" ON public.withdrawal_wallets;
CREATE POLICY "insert_own_wallets" ON public.withdrawal_wallets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_wallets" ON public.withdrawal_wallets;
CREATE POLICY "update_own_wallets" ON public.withdrawal_wallets
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_wallets" ON public.withdrawal_wallets;
CREATE POLICY "delete_own_wallets" ON public.withdrawal_wallets
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- NEWS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  image_url text,
  category text NOT NULL DEFAULT 'announcement' CHECK (category IN ('update', 'promotion', 'announcement', 'maintenance')),
  is_published boolean NOT NULL DEFAULT true,
  published_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_published_news" ON public.news;
CREATE POLICY "select_published_news" ON public.news
  FOR SELECT TO anon, authenticated
  USING (is_published = true OR public.is_admin());

DROP POLICY IF EXISTS "admin_insert_news" ON public.news;
CREATE POLICY "admin_insert_news" ON public.news
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_update_news" ON public.news;
CREATE POLICY "admin_update_news" ON public.news
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_delete_news" ON public.news;
CREATE POLICY "admin_delete_news" ON public.news
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_news_published ON public.news(is_published, published_at DESC);

-- ============================================================
-- ADMIN NOTIFICATIONS TABLE
-- ============================================================
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

REVOKE ALL ON TABLE public.admin_notifications FROM anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.admin_notifications TO authenticated;

-- ============================================================
-- FLEET ROUTES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fleet_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  origin_name text NOT NULL CHECK (char_length(trim(origin_name)) BETWEEN 1 AND 60),
  origin_lat double precision NOT NULL CHECK (origin_lat BETWEEN 32 AND 42.1),
  origin_lng double precision NOT NULL CHECK (origin_lng BETWEEN -124.5 AND -114),
  destination_name text NOT NULL CHECK (char_length(trim(destination_name)) BETWEEN 1 AND 60),
  destination_lat double precision NOT NULL CHECK (destination_lat BETWEEN 32 AND 42.1),
  destination_lng double precision NOT NULL CHECK (destination_lng BETWEEN -124.5 AND -114),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fleet_routes_active_sort_idx ON public.fleet_routes (is_active, sort_order);

ALTER TABLE public.fleet_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_active_or_admin_fleet_routes" ON public.fleet_routes;
CREATE POLICY "select_active_or_admin_fleet_routes" ON public.fleet_routes FOR SELECT
  TO authenticated USING (is_active OR public.is_admin());

DROP POLICY IF EXISTS "insert_admin_fleet_routes" ON public.fleet_routes;
CREATE POLICY "insert_admin_fleet_routes" ON public.fleet_routes FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "update_admin_fleet_routes" ON public.fleet_routes;
CREATE POLICY "update_admin_fleet_routes" ON public.fleet_routes FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "delete_admin_fleet_routes" ON public.fleet_routes;
CREATE POLICY "delete_admin_fleet_routes" ON public.fleet_routes FOR DELETE
  TO authenticated USING (public.is_admin());

REVOKE ALL ON public.fleet_routes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_routes TO authenticated;

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('recharge-proofs', 'recharge-proofs', true),
  ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "auth_upload_recharge_proofs" ON storage.objects;
CREATE POLICY "auth_upload_recharge_proofs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recharge-proofs');

DROP POLICY IF EXISTS "auth_upload_user_avatars" ON storage.objects;
CREATE POLICY "auth_upload_user_avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "auth_update_user_avatars" ON storage.objects;
CREATE POLICY "auth_update_user_avatars" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "public_read_user_avatars" ON storage.objects;
CREATE POLICY "public_read_user_avatars" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'user-avatars');