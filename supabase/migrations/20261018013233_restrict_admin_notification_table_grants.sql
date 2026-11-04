/*
# Restrict admin notification table privileges

1. Modified Tables
- `public.admin_notifications`: removes direct client insert and delete privileges.
- `public.admin_notifications`: keeps only the select and update privileges needed by the admin website.

2. Security
- Anonymous clients receive no table privileges.
- Authenticated clients can only use the table through the existing administrator-only row policies.
- SECURITY DEFINER notification triggers continue creating rows for signup, recharge, and withdrawal events.

3. Important Notes
- No notification rows are deleted or changed.
- The admin website can still view unread notifications and mark them as read.
*/

REVOKE ALL ON TABLE public.admin_notifications FROM anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.admin_notifications TO authenticated;
