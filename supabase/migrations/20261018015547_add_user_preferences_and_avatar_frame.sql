/*
# Add user preferences and avatar frame

1. Modified Tables
- `public.profiles.theme_color` (text, default 'blue') stores the user's accent color choice.
- `public.profiles.language` (text, default 'en') stores the user's preferred display language.
- `public.profiles.notif_sound` (boolean, default true) stores whether in-app notification sounds are enabled.
- `public.profiles.avatar_frame` (text, nullable) stores the selected avatar frame style key.
- Existing rows are backfilled with defaults; no profile data is deleted.

2. Security
- All new columns are user-editable through the existing owner-scoped update policy.
- No new policies or triggers are introduced.

3. Important Notes
- Theme color accepts blue, emerald, amber, rose, violet, cyan.
- Language accepts en, fil (Filipino). Frontend reads these to adjust labels.
- notif_sound controls the global in-app alert sound for the user.
- avatar_frame accepts none, gold, neon, cosmic.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme_color text NOT NULL DEFAULT 'blue'
    CHECK (theme_color IN ('blue', 'emerald', 'amber', 'rose', 'violet', 'cyan'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en'
    CHECK (language IN ('en', 'fil'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notif_sound boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_frame text DEFAULT 'none'
    CHECK (avatar_frame IS NULL OR avatar_frame IN ('none', 'gold', 'neon', 'cosmic'));
