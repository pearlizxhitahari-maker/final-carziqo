/*
# Restrict privileged database functions from anonymous callers

1. Security Changes
- Revokes EXECUTE on every existing public-schema function from the `anon` role.
- Keeps signed-in users able to call the application functions through the `authenticated` role.
- Trigger-only functions remain usable by database triggers because trigger execution does not depend on anon API grants.

2. Important Notes
- This does not change tables, rows, balances, investments, or user accounts.
- Admin functions still perform their own admin checks.
- Anonymous visitors can still use intentionally public SELECT policies such as published news.
*/

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
