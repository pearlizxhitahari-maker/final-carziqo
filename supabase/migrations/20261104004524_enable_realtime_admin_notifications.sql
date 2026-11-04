/*
# Enable Supabase Realtime on admin_notifications

1. Modified Publications
- `supabase_realtime`: now publishes `public.admin_notifications` so admin clients can subscribe to INSERT events and receive new notifications instantly instead of polling.

2. Security
- No change to row-level security policies. Realtime delivery still respects RLS: an admin client only receives rows its `is_admin()` SELECT policy allows. Non-admin clients receive nothing.
- Existing SELECT/UPDATE grants and admin-only policies are unchanged.

3. Notes
- Idempotent: `ALTER PUBLICATION ... ADD TABLE` is a no-op if the table is already a member.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
