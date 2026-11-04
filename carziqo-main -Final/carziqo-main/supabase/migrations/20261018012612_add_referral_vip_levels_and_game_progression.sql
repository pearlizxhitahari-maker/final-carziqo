/*
# Add referral-based VIP progression through VIP 10

1. Modified Tables
- `public.profiles.vip_level`: expands the allowed range from 1–5 to 1–10.
- Existing profile records are recalculated without deleting or changing referral data.

2. VIP Rules
- Three total referrals qualify the referrer for VIP 1.
- Each additional referral advances one VIP level: 4 referrals = VIP 2, continuing through 12 referrals = VIP 10.
- VIP 10 remains the maximum referral tier.
- Existing investment-based VIP qualification is preserved, so a user keeps the stronger level from either investment value or referral count.

3. Automatic Updates
- New referred users automatically refresh the referrer's VIP level.
- Changes to referral ownership also refresh both the old and new referrers.
- Existing investment triggers continue refreshing VIP levels after investment changes.

4. Security
- VIP calculations run only inside SECURITY DEFINER trigger functions.
- Direct execution by anonymous and authenticated clients remains revoked.

5. Important Notes
- No profiles, referrals, investments, or balances are deleted.
- Existing users are backfilled immediately using the new rules.
*/

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_vip_level_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_vip_level_check CHECK (vip_level BETWEEN 1 AND 10);

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

UPDATE public.profiles p
SET vip_level = GREATEST(
  LEAST(10, GREATEST(1, referral_totals.total_referrals - 2)),
  CASE
    WHEN investment_totals.total_amount >= 100000 THEN 5
    WHEN investment_totals.total_amount >= 50000 THEN 4
    WHEN investment_totals.total_amount >= 20000 THEN 3
    WHEN investment_totals.total_amount >= 5000 THEN 2
    ELSE 1
  END
)
FROM (
  SELECT p2.id, count(r.id)::integer AS total_referrals
  FROM public.profiles p2
  LEFT JOIN public.profiles r ON r.referred_by = p2.referral_code
  GROUP BY p2.id
) referral_totals
JOIN (
  SELECT p3.id, COALESCE(SUM(i.investment_amount), 0) AS total_amount
  FROM public.profiles p3
  LEFT JOIN public.investments i ON i.user_id = p3.id AND i.status = 'active'
  GROUP BY p3.id
) investment_totals ON investment_totals.id = referral_totals.id
WHERE p.id = referral_totals.id;
