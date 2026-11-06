/*
# Add secure administrator wallet balance management

1. New capability
- Adds the `admin_set_wallet_balance` function.
- An administrator can set one user's wallet balance to an exact non-negative amount.
- The function returns the updated balance for immediate display in the admin panel.

2. Security
- The caller is taken from `auth.uid()` and must be an administrator.
- The target user id and new amount are validated inside the database.
- Direct browser writes to protected wallet balance columns remain unavailable.
- Anonymous callers cannot execute the function; authenticated callers are checked again inside it.

3. Audit history
- Every successful balance change creates an audit-log entry for the affected user.
- The entry records the previous balance, new balance, reason, and administrator id.

4. Important notes
- No user records, balances, wallets, or transaction history are deleted.
- The amount is capped at 999,999,999,999.99 to fit the existing numeric precision.
- Re-running this migration safely replaces the function definition and grants.
*/

CREATE OR REPLACE FUNCTION public.admin_set_wallet_balance(
  p_user_id uuid,
  p_new_balance numeric,
  p_reason text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_balance numeric(12,2);
  v_reason text := NULLIF(trim(COALESCE(p_reason, '')), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'user') THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF p_new_balance IS NULL OR p_new_balance < 0 OR p_new_balance > 999999999999.99 THEN
    RAISE EXCEPTION 'Invalid wallet balance';
  END IF;

  IF v_reason IS NULL OR char_length(v_reason) > 240 THEN
    RAISE EXCEPTION 'A reason up to 240 characters is required';
  END IF;

  SELECT wallet_balance INTO v_previous_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  UPDATE public.profiles
  SET wallet_balance = round(p_new_balance, 2)
  WHERE id = p_user_id;

  INSERT INTO public.audit_logs (user_id, action, details)
  VALUES (
    p_user_id,
    'admin_wallet_balance_changed',
    format('Previous: %s, New: %s, Reason: %s, Admin: %s', v_previous_balance, round(p_new_balance, 2), v_reason, auth.uid())
  );

  RETURN round(p_new_balance, 2);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_wallet_balance(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_wallet_balance(uuid, numeric, text) TO authenticated;