/*
# Add car-images storage bucket and expand language options

1. Creates a public 'car-images' storage bucket for admin car photo uploads.
2. Adds storage policies so admins can upload/replace car images and everyone can read them.
3. Expands the profiles.language CHECK constraint to support 8 languages:
   en, fil, es, fr, zh, ja, ko, ar
4. No user data is deleted or altered — existing 'en' and 'fil' values remain valid.
*/

-- ============================================================
-- STORAGE BUCKET: car-images (public read, admin write)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('car-images', 'car-images', true)
ON CONFLICT (id) DO NOTHING;

-- Admins can upload car images
DROP POLICY IF EXISTS "admin_upload_car_images" ON storage.objects;
CREATE POLICY "admin_upload_car_images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'car-images' AND public.is_admin());

-- Admins can update/replace car images
DROP POLICY IF EXISTS "admin_update_car_images" ON storage.objects;
CREATE POLICY "admin_update_car_images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'car-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'car-images' AND public.is_admin());

-- Admins can delete car images
DROP POLICY IF EXISTS "admin_delete_car_images" ON storage.objects;
CREATE POLICY "admin_delete_car_images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'car-images' AND public.is_admin());

-- Everyone (including anon) can read car images
DROP POLICY IF EXISTS "public_read_car_images" ON storage.objects;
CREATE POLICY "public_read_car_images" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'car-images');

-- ============================================================
-- EXPAND LANGUAGE OPTIONS
-- ============================================================
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_language_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_language_check
  CHECK (language IN ('en', 'fil', 'es', 'fr', 'zh', 'ja', 'ko', 'ar'));
