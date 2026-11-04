/*
# Add automatic VIP levels and support the illustrated avatar catalog

1. Modified Tables
- `public.profiles.vip_level` (integer, default 1) stores the user's current VIP tier.
- Existing profile rows are initialized from each user's active investment total.

2. VIP Rules
- VIP 1: under PHP 5,000 in active investments.
- VIP 2: PHP 5,000–19,999.99.
- VIP 3: PHP 20,000–49,999.99.
- VIP 4: PHP 50,000–99,999.99.
- VIP 5: PHP 100,000 or more.
- A SECURITY DEFINER recalculation function runs automatically whenever investments change.

3. Security
- The recalculation function is trigger-only and cannot be called by anonymous or authenticated clients.
- VIP level is calculated from database investment records rather than trusted browser input.

4. Important Notes
- No user investments or profile data are deleted or renamed.
- Existing users are recalculated immediately.
- The frontend displays the resulting VIP badge in the profile area.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vip_level integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_vip_level_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_vip_level_check CHECK (vip_level BETWEEN 1 AND 5);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.refresh_vip_level(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric(12,2);
  v_level integer;
BEGIN
  SELECT COALESCE(SUM(investment_amount), 0)
  INTO v_total
  FROM public.investments
  WHERE user_id = p_user_id
    AND status = 'active';

  v_level := CASE
    WHEN v_total >= 100000 THEN 5
    WHEN v_total >= 50000 THEN 4
    WHEN v_total >= 20000 THEN 3
    WHEN v_total >= 5000 THEN 2
    ELSE 1
  END;

  UPDATE public.profiles
  SET vip_level = v_level
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_vip_level(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_vip_level(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.refresh_vip_level(uuid) FROM authenticated;

CREATE OR REPLACE FUNCTION public.refresh_vip_level_after_investment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_vip_level(CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END);
  IF TG_OP = 'UPDATE' AND OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    PERFORM public.refresh_vip_level(OLD.user_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS investments_refresh_vip_level ON public.investments;
CREATE TRIGGER investments_refresh_vip_level
  AFTER INSERT OR UPDATE OR DELETE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.refresh_vip_level_after_investment();

UPDATE public.profiles p
SET vip_level = CASE
  WHEN totals.total_amount >= 100000 THEN 5
  WHEN totals.total_amount >= 50000 THEN 4
  WHEN totals.total_amount >= 20000 THEN 3
  WHEN totals.total_amount >= 5000 THEN 2
  ELSE 1
END
FROM (
  SELECT p2.id, COALESCE(SUM(i.investment_amount), 0) AS total_amount
  FROM public.profiles p2
  LEFT JOIN public.investments i
    ON i.user_id = p2.id AND i.status = 'active'
  GROUP BY p2.id
) totals
WHERE p.id = totals.id;
