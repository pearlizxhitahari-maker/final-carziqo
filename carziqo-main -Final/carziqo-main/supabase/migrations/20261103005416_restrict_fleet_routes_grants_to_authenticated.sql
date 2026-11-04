/*
# Restrict fleet route grants to signed-in users

1. Modified Tables
- `fleet_routes`: the anonymous role no longer holds any table privileges.

2. Security
- Signed-in users keep SELECT, and write verbs are still limited by the existing admin-only policies.
- The anonymous role has no policy on this table, so granting it access was unnecessary.

3. Notes
- Idempotent: safe to re-run.
*/

REVOKE ALL ON fleet_routes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON fleet_routes TO authenticated;
