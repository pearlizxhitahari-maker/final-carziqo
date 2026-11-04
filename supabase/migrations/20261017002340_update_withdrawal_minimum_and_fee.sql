/*
# Update withdrawal minimum and processing fee

## Overview
Removes the referral requirement from withdrawals, enforces a 500 PHP minimum, and applies a 1% processing fee.

## Modified table
- `withdrawal_logs.amount` remains the gross amount requested by the user.
- Adds `withdrawal_logs.fee_amount`, the 1% processing fee.
- Adds `withdrawal_logs.net_amount`, the amount the user receives after the fee.

## Security and integrity
- Adds a server-side trigger that rejects requests below 500 PHP and calculates fee/net values from the requested amount.
- Replaces the approval function so it no longer checks referrals.
- Approval still deducts the full gross amount from the user's wallet.

## Important notes
1. A 500 PHP request has a 5 PHP fee and a 495 PHP payout.
2. Existing withdrawal rows are preserved and receive zero-value fee fields for historical compatibility.
3. No user balances are deleted or reset.
*/

ALTER TABLE public.withdrawal_logs
  ADD COLUMN IF NOT EXISTS fee_amount numeric(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS net_amount numeric(12,2) NOT NULL DEFAULT 0.00;

UPDATE public.withdrawal_logs
SET fee_amount = round(amount * 0.01, 2),
    net_amount = amount - round(amount * 0.01, 2)
WHERE fee_amount = 0.00 AND net_amount = 0.00 AND amount > 0;

CREATE OR REPLACE FUNCTION public.prepare_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.amount < 500.00 THEN
    RAISE EXCEPTION 'Minimum withdrawal is 500 PHP';
  END IF;

  NEW.fee_amount := round(NEW.amount * 0.01, 2);
  NEW.net_amount := NEW.amount - NEW.fee_amount;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_withdrawal_before_write ON public.withdrawal_logs;
CREATE TRIGGER prepare_withdrawal_before_write
  BEFORE INSERT OR UPDATE OF amount ON public.withdrawal_logs
  FOR EACH ROW EXECUTE FUNCTION public.prepare_withdrawal();

CREATE OR REPLACE FUNCTION public.approve_withdrawal(p_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_amount numeric(12,2);
  v_fee numeric(12,2);
  v_net numeric(12,2);
BEGIN
  SELECT user_id, amount, fee_amount, net_amount
  INTO v_user_id, v_amount, v_fee, v_net
  FROM public.withdrawal_logs
  WHERE id = p_withdrawal_id AND status = 'pending';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Withdrawal not found or not pending';
  END IF;

  IF v_amount < 500.00 THEN
    RAISE EXCEPTION 'Minimum withdrawal is 500 PHP';
  END IF;

  UPDATE public.withdrawal_logs
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_withdrawal_id;

  UPDATE public.profiles
  SET wallet_balance = wallet_balance - v_amount
  WHERE id = v_user_id;

  PERFORM public.log_action(
    v_user_id,
    'withdrawal_approved',
    'Requested: ' || v_amount || ' PHP, Fee: ' || v_fee || ' PHP, Payout: ' || v_net || ' PHP'
  );
END;
$$;
