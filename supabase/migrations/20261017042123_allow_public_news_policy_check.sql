/*
# Keep published news readable anonymously

1. Security Changes
- Allows the harmless `is_admin()` helper to be evaluated by the public news policy.
- The helper only returns whether the current caller is an admin and does not expose private data.

2. Important Notes
- Published news remains readable without signing in.
- Anonymous callers still cannot execute administrative actions.
*/

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
