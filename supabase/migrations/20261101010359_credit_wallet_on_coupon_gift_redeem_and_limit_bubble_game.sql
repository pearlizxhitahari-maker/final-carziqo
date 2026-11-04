/*
# Credit wallet on coupon/gift redemption and limit bubble game to once per day

## Plain-English summary
1. Claiming a coupon or redeeming a gift now adds its cash value to the user's wallet, in addition to deducting carbon points.
2. The bubble game can only be played once per calendar day. The server rejects a second session on the same day, and a helper function lets the app check whether today's play is already used.

## Changes
- `claim_coupon(uuid)`: after deducting carbon, adds the coupon's discount value to `profiles.wallet_balance`.
- `redeem_gift(uuid)`: after deducting carbon, adds the gift's cash value to `profiles.wallet_balance`.
- `save_game_session(integer, integer, integer)`: raises an error if the user already has a bubble game session today.
- New function `bubble_game_played_today()` returns true when the signed-in user has already played today.

## Security
- Functions remain SECURITY DEFINER with `auth.uid()` ownership checks.
- `bubble_game_played_today()` is granted only to `authenticated`; it is revoked from PUBLIC and anon.

## Notes
- "Today" uses the database's CURRENT_DATE, the same convention used by daily check-ins.
- No existing rows are modified.
*/

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
