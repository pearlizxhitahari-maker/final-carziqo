/*
# Server-side investment creation with locked client writes

1. Summary
- Adds a server function that creates an investment, computes its daily payout, and debits the user's wallet in one step.
- Removes the browser's ability to insert or edit investment rows directly, so payouts cannot be forged.
- Restricts the browser's profile updates to profile-editing fields, so wallet balances cannot be changed directly.

2. New function
- `create_investment(p_car_id, p_amount, p_duration_days)` returns the new investment id.
- Rental periods are limited to 30 days (2% per day) and 60 days (3% per day). The daily payout is computed here, not in the browser.
- Investment amounts must be between 500 and 100,000 PHP. The wallet must cover the amount, and the debit happens in the same transaction as the investment insert.
- The free starter car is supported: no payment, fixed 15-day term, 1.00 per day, and the user's free car reference is updated.
- The function runs with owner rights and only checks `auth.uid()`. It is executable by signed-in users only.

3. Security changes
- investments: INSERT, UPDATE, and DELETE are revoked from `anon` and `authenticated`. Users can still read their own investments. Earnings are written only by the daily credit process, which runs with owner rights.
- profiles: UPDATE is revoked from `anon` and `authenticated`, then re-granted to `authenticated` for these columns only: full_name, phone, avatar_url, avatar_frame, theme_color, language, notif_sound, currency. Wallet balance, carbon points, VIP level, referral, and role columns can no longer be written from the browser.
- create_investment: EXECUTE revoked from PUBLIC and anon, granted to authenticated.

4. Notes
- Existing investments are not changed.
- Other server functions that update wallets (redemptions, approvals, daily earnings) run with owner rights and are unaffected.
*/

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

REVOKE INSERT, UPDATE, DELETE ON public.investments FROM anon, authenticated;

REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (full_name, phone, avatar_url, avatar_frame, theme_color, language, notif_sound, currency)
  ON public.profiles TO authenticated;
