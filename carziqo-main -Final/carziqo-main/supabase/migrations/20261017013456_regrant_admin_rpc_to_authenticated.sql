/*
# Re-grant admin RPC functions to authenticated role

## Overview
The admin panel frontend calls approve_withdrawal, reject_withdrawal, 
approve_recharge, and reject_recharge via supabase.rpc(). These need to be 
callable by authenticated users. The is_admin() check inside each function's
RLS context ensures only admins can actually succeed.

## Changes
- GRANT EXECUTE on the 4 admin action functions TO authenticated
- These functions remain revoked from anon (unauthenticated access blocked)

## Security
- anon role still cannot call any admin function
- authenticated non-admin users can call the function but it will fail because
  the RLS policies on withdrawal_logs/recharge_logs only allow admin updates
- The functions check for pending status and use auth.uid() for reviewed_by

## Important notes
1. No data changes.
2. This restores admin panel functionality while keeping anon locked out.
*/

GRANT EXECUTE ON FUNCTION public.approve_recharge(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_recharge(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal(uuid, text) TO authenticated;
