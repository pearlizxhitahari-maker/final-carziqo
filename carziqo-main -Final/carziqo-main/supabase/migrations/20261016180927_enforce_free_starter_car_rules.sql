/*
# Enforce Carziqo.Ltd free starter car rules

## Overview
This migration makes the starter car genuinely free and enforces the one-free-car-per-user rule in the database.

## Modified data
- Sets the active free starter car price to 0.00 PHP.
- Keeps its starter payout at 1.00 PHP per day through the assignment function.

## Security and integrity
- Adds a database trigger that rejects paid or duplicate free-car investments.
- Adds a unique partial index so concurrent requests cannot create two free investments for one user.
- Updates the new-user assignment function to stop safely when a user already has a free investment.

## Important notes
1. The free starter car remains a 15-day rental.
2. Paid cars continue to use their normal investment limits and prices.
3. Existing user data is preserved; no investments or profiles are deleted.
*/

UPDATE public.cars
SET price = 0.00
WHERE is_free = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_free_investment_per_user
ON public.investments (user_id)
WHERE investment_amount = 0.00 AND status <> 'cancelled';

CREATE OR REPLACE FUNCTION public.enforce_free_car_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  UPDATE public.profiles
  SET free_investment_id = inv_id
  WHERE id = NEW.id;

  PERFORM public.log_action(NEW.id, 'free_car_assigned', 'Free starter car: ' || free_car.car_name);

  RETURN NEW;
END;
$$;
