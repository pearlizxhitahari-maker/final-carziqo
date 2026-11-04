/*
# Add withdrawal wallet addresses and fix avatar read access

## Overview
1. Creates a `withdrawal_wallets` table so each user can save multiple payout destinations
   (GCash, PayMaya, bank transfer, crypto) and reuse them when withdrawing.
2. Adds a SELECT policy to the `user-avatars` storage bucket so public avatar URLs load.
3. Adds owner-scoped CRUD policies on `withdrawal_wallets`.

## New table: withdrawal_wallets
- id (uuid, primary key)
- user_id (uuid, owner, defaults to auth.uid())
- label (text, a friendly name e.g. "My GCash")
- method (text, one of: gcash, paymaya, bank, crypto)
- account_name (text)
- account_number (text, wallet number / bank account / wallet address)
- bank_name (text, optional, used for bank transfers)
- is_default (boolean, marks the user's preferred destination)
- created_at (timestamptz)

## Security
- RLS enabled on withdrawal_wallets.
- 4 owner-scoped policies (select/insert/update/delete) scoped to authenticated users.
- New storage SELECT policy allows anyone (anon + authenticated) to read avatar files
  from the user-avatars bucket so profile images display.

## Important notes
1. No existing data is deleted or altered.
2. A user can have multiple wallets; only one can be the default at a time (enforced in app logic).
3. Avatar uploads remain restricted to each user's own folder.
*/

CREATE TABLE IF NOT EXISTS public.withdrawal_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'My Wallet',
  method text NOT NULL CHECK (method IN ('gcash', 'paymaya', 'bank', 'crypto')),
  account_name text NOT NULL,
  account_number text NOT NULL,
  bank_name text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.withdrawal_wallets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_withdrawal_wallets_user ON public.withdrawal_wallets(user_id);

DROP POLICY IF EXISTS "select_own_wallets" ON public.withdrawal_wallets;
CREATE POLICY "select_own_wallets" ON public.withdrawal_wallets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_wallets" ON public.withdrawal_wallets;
CREATE POLICY "insert_own_wallets" ON public.withdrawal_wallets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_wallets" ON public.withdrawal_wallets;
CREATE POLICY "update_own_wallets" ON public.withdrawal_wallets
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_wallets" ON public.withdrawal_wallets;
CREATE POLICY "delete_own_wallets" ON public.withdrawal_wallets
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Fix avatar read access: allow anyone to view files in user-avatars bucket
DROP POLICY IF EXISTS "public_read_user_avatars" ON storage.objects;
CREATE POLICY "public_read_user_avatars" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'user-avatars');
