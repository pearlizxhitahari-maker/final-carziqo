/*
# Add user display currency preference

1. Modified Tables
- `public.profiles.currency` (text, default 'PHP') stores the user's preferred display currency.
- Existing rows are backfilled to PHP; no profile data is deleted.

2. Security
- The new column is user-editable through the existing owner-scoped update policy.
- No new policies or triggers are introduced.

3. Important Notes
- Supported currencies: PHP (Philippine Peso), USD (US Dollar), EUR (Euro).
- Stored amounts remain in PHP; conversion to the display currency happens in the frontend.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'PHP'
    CHECK (currency IN ('PHP', 'USD', 'EUR'));
