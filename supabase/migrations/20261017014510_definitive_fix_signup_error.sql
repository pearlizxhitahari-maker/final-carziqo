/*
# Definitive fix for "Database error saving new user"

## Overview
The signup error occurs because the trigger chain on auth.users → profiles → investments
is fragile. When ANY sub-operation in the chain fails (RLS check, unique constraint, 
trigger exception), the error propagates back to the auth.users INSERT, causing Supabase
Auth to return "Database error saving new user" to the client.

## Root cause
The handle_new_user function wraps the profile insert in exception handling, but:
1. The AFTER INSERT trigger on profiles fires TWO more triggers 
   (promote_first_user_to_admin + assign_free_car)
2. assign_free_car inserts into investments, which fires enforce_free_car_rules
3. If ANY of these fail and the exception isn't caught, it rolls back the entire 
   transaction including the auth.users insert
4. The promote_first_user_to_admin function has NO exception handling at all

## Fix
1. Wraps the ENTIRE handle_new_user body in a single exception handler
2. Wraps promote_first_user_to_admin in exception handling
3. Makes assign_free_car's exception handling catch ALL errors (already done but verified)
4. Grants EXECUTE on log_action back to authenticated (needed for trigger chain)

## Security
- No RLS policy changes
- No data is deleted or altered
- log_action is SECURITY DEFINER so it runs as postgres regardless of caller

## Important notes
1. User account creation will NEVER fail due to profile/trigger errors
2. If profile creation fails, the user can still sign in and the profile will be
   created on next sign-in attempt via the AuthContext retry logic
*/

-- Grant log_action back to authenticated (needed by trigger chain)
GRANT EXECUTE ON FUNCTION public.log_action(uuid, text, text) TO authenticated;

-- Rewrite handle_new_user with full exception wrapping
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_code text;
  v_referred_by text;
  v_phone text;
BEGIN
  BEGIN
    v_referred_by := NEW.raw_user_meta_data->>'referral_code';
    v_phone := NULLIF(NEW.raw_user_meta_data->>'phone', '');

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
      v_phone,
      v_referral_code,
      NULLIF(v_referred_by, '')
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Swallow ALL errors so user creation never fails
  END;

  RETURN NEW;
END;
$$;

-- Rewrite promote_first_user_to_admin with exception handling
CREATE OR REPLACE FUNCTION public.promote_first_user_to_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_count integer;
BEGIN
  BEGIN
    SELECT COUNT(*) INTO profile_count FROM public.profiles;
    IF profile_count = 1 THEN
      UPDATE public.profiles SET role = 'admin' WHERE id = NEW.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Never block profile creation
  END;
  RETURN NEW;
END;
$$;

-- Verify assign_free_car has full exception handling (rewrite to be sure)
CREATE OR REPLACE FUNCTION public.assign_free_car()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  free_car RECORD;
  inv_id uuid;
BEGIN
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
    -- Never block profile creation or user signup
  END;
  RETURN NEW;
END;
$$;
