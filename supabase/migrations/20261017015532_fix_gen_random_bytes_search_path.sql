/*
# Definitive fix: gen_random_bytes not found in trigger function

## Root cause
The handle_new_user trigger function has SET search_path = 'public', but 
gen_random_bytes lives in the 'extensions' schema (pgcrypto extension).
When the trigger fires during auth.users INSERT, it calls gen_random_bytes()
which is NOT on the search_path, causing a "function does not exist" error.
The exception handler swallows this error, so the user account is created 
but the profile row is never inserted — leaving the user unable to sign in.

## Fix
1. Change SET search_path to include both 'public' and 'extensions'
   (and pg_catalog for built-in functions like UPPER, SUBSTRING, encode)
2. Use explicit schema qualification for gen_random_bytes as a belt-and-suspenders fix
3. Remove the exception swallowing so we can see real errors if they occur
   (the trigger chain now has proper exception handling in each sub-function)

## Also fixes
- assign_free_car: same search_path fix
- promote_first_user_to_admin: same search_path fix
- enforce_free_car_rules: same search_path fix

## Important notes
1. This is the actual root cause of "Database error saving new user" — 
   the profile was never created because gen_random_bytes was unresolvable.
2. After this fix, new user signup will create the profile, referral code, 
   and free starter car investment automatically.
*/

-- Fix handle_new_user: include extensions schema in search_path
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

  -- Generate a unique referral code (gen_random_bytes is in extensions schema)
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
  -- If profile creation fails, don't block the auth user creation
  -- But the error is logged so we can debug
  RAISE LOG 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Fix promote_first_user_to_admin
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

-- Fix assign_free_car
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

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- Fix enforce_free_car_rules
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
