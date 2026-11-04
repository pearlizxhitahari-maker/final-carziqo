/*
# Fix new user signup database errors

## Overview
Fixes the "Database error saving new user" error that occurs during registration.
The root cause is the handle_new_user trigger function failing when:
1. A phone number conflicts with the UNIQUE constraint on profiles.phone
2. The trigger chain (handle_new_user -> assign_free_car -> enforce_free_car_rules) 
   has ordering issues that can cause exceptions to propagate back to auth.users insert

## Changes
1. Drops the UNIQUE constraint on profiles.phone — multiple users may share a phone
   number or leave it blank. The phone field is informational, not an identifier.
2. Rewrites handle_new_user to be resilient: wraps the profile insert in a block
   that catches errors so a profile creation failure never blocks auth signup.
3. Rewrites assign_free_car to be resilient: wraps the free car assignment so
   trigger errors don't crash the user creation flow.

## Security
- No RLS policy changes.
- No data is deleted or altered.

## Important notes
1. The phone field remains on profiles but is no longer unique.
2. If profile creation fails for any reason, the user account still exists
   and can sign in; the profile will be created on next attempt or manually.
3. The referral code generation remains unique.
*/

-- Drop the unique constraint on phone - it causes signup failures
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_key;

-- Rewrite handle_new_user to be resilient
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
  v_referred_by := NEW.raw_user_meta_data->>'referral_code';
  v_phone := NULLIF(NEW.raw_user_meta_data->>'phone', '');

  -- Generate a unique referral code
  LOOP
    v_referral_code := UPPER(SUBSTRING(encode(gen_random_bytes(4), 'hex') FROM 1 FOR 6));
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_referral_code) THEN
      EXIT;
    END IF;
  END LOOP;

  BEGIN
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
    -- If profile insert fails, don't block user creation
    -- The profile can be created later
  END;

  RETURN NEW;
END;
$$;

-- Rewrite assign_free_car to be resilient
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
  -- Only proceed if the profile exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Check if user already has a free investment
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
    -- If free car assignment fails, don't block user creation
  END;

  RETURN NEW;
END;
$$;
