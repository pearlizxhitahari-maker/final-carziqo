/*
# Car Rental & Daily Earning Return Platform — Complete Schema

## Overview
Creates the full database for a car rental/investment platform where users invest in cars
and earn daily returns over fixed holding periods (15-180 days). Admins manage car listings,
approve deposits (recharges) and withdrawals, and audit all activity.

## Tables
1. profiles — extends auth.users with full_name, phone, avatar_url, wallet_balance, role
2. cars — car listings with price, daily_return_rate, image, status
3. payment_methods — admin-managed QR codes and payment instructions
4. investments — user rental contracts
5. recharge_logs — deposit requests with proof image, reference number, status
6. withdrawal_logs — withdrawal requests with bank/e-wallet details, status
7. audit_logs — immutable action log

## Security
- All tables have RLS enabled with ownership-scoped policies.
- is_admin() helper function used for admin-only policies.
- SECURITY DEFINER functions for privileged operations.
*/

-- ============================================================
-- PROFILES TABLE (must exist before is_admin function)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text UNIQUE,
  avatar_url text,
  wallet_balance numeric(12,2) NOT NULL DEFAULT 0.00,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- IS_ADMIN HELPER FUNCTION (after profiles table exists)
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

-- ============================================================
-- PROFILE POLICIES
-- ============================================================
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
-- HANDLE NEW USER TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

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
  created_at timestamptz NOT NULL DEFAULT now()
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
-- INVESTMENTS TABLE
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
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  start_date timestamptz NOT NULL DEFAULT now(),
  last_payout_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
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
  created_at timestamptz NOT NULL DEFAULT now()
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
-- HELPER: Log audit action
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
-- HELPER: Approve recharge (credits wallet)
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_recharge(p_recharge_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_amount numeric(12,2);
BEGIN
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
-- HELPER: Approve withdrawal (deducts wallet)
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
BEGIN
  SELECT user_id, amount INTO v_user_id, v_amount
  FROM public.withdrawal_logs
  WHERE id = p_withdrawal_id AND status = 'pending';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Withdrawal not found or not pending';
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

-- ============================================================
-- HELPER: Reject recharge
-- ============================================================
CREATE OR REPLACE FUNCTION public.reject_recharge(p_recharge_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
-- HELPER: Reject withdrawal
-- ============================================================
CREATE OR REPLACE FUNCTION public.reject_withdrawal(p_withdrawal_id uuid, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
-- HELPER: Credit daily earnings
-- ============================================================
CREATE OR REPLACE FUNCTION public.credit_daily_earnings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  days_elapsed_val integer;
  new_days_val integer;
  payout_val numeric(12,2);
BEGIN
  FOR inv IN
    SELECT * FROM public.investments WHERE status = 'active'
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
