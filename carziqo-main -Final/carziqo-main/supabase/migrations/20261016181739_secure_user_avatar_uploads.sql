/*
# Secure and support reliable user avatar uploads

## Overview
Updates avatar storage permissions so each signed-in user can only create or replace the avatar inside their own storage folder.

## Modified storage policies
- `auth_upload_user_avatars` now requires the first folder name to equal the signed-in user's ID.
- `auth_update_user_avatars` now applies the same ownership check when replacing an avatar.

## Important notes
1. Avatar files use the path `<user id>/avatar` so replacing an image keeps one stable file per user.
2. The avatar bucket remains public so profile images can be displayed in the app.
3. No existing profile rows or files are deleted.
*/

DROP POLICY IF EXISTS "auth_upload_user_avatars" ON storage.objects;
CREATE POLICY "auth_upload_user_avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "auth_update_user_avatars" ON storage.objects;
CREATE POLICY "auth_update_user_avatars" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
