/*
# Create Storage Buckets for Recharge Proofs and User Avatars

## Overview
Creates two public storage buckets needed for file uploads:
1. recharge-proofs — user-uploaded payment receipt screenshots
2. user-avatars — user profile photos

## Security
- Both buckets are public (read) so images can be displayed.
- Write access restricted to authenticated users.
*/

INSERT INTO storage.buckets (id, name, public) VALUES
  ('recharge-proofs', 'recharge-proofs', true),
  ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Recharge proofs: only authenticated users can upload
DROP POLICY IF EXISTS "auth_upload_recharge_proofs" ON storage.objects;
CREATE POLICY "auth_upload_recharge_proofs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recharge-proofs');

-- User avatars: only authenticated users can upload
DROP POLICY IF EXISTS "auth_upload_user_avatars" ON storage.objects;
CREATE POLICY "auth_upload_user_avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-avatars');

-- Allow users to update/replace their own avatar
DROP POLICY IF EXISTS "auth_update_user_avatars" ON storage.objects;
CREATE POLICY "auth_update_user_avatars" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'user-avatars')
  WITH CHECK (bucket_id = 'user-avatars');
