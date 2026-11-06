/*
# Add crypto recharge payment methods and administrator QR uploads

1. New payment options
- Adds BTC / Bitcoin.
- Adds USDT on BNB, OPBNB, BASE, and ERC20 networks.
- Adds WLD / WorldCoin.
- Each option has an editable QR image URL and network-specific instructions.

2. Storage
- Creates the public `payment-qr` bucket for administrator-managed payment QR images.
- Public read access allows signed-in users to display the payment QR codes.
- Only authenticated administrators can upload, replace, or remove payment QR images.

3. Security
- Existing `payment_methods` row policies remain in force: users can read active methods and only administrators can change them.
- Storage write policies check `public.is_admin()` on the authenticated session.
- Uploads are restricted to image MIME types and a 5 MB object size limit at the bucket level.

4. Important notes
- Existing payment-method rows are not deleted or modified.
- The initial QR images use the supplied public assets and can be replaced from the admin panel.
- The migration is idempotent and safe to apply more than once.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-qr',
  'payment-qr',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "public_read_payment_qr" ON storage.objects;
CREATE POLICY "public_read_payment_qr" ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'payment-qr');

DROP POLICY IF EXISTS "admin_upload_payment_qr" ON storage.objects;
CREATE POLICY "admin_upload_payment_qr" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payment-qr' AND public.is_admin());

DROP POLICY IF EXISTS "admin_update_payment_qr" ON storage.objects;
CREATE POLICY "admin_update_payment_qr" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'payment-qr' AND public.is_admin())
  WITH CHECK (bucket_id = 'payment-qr' AND public.is_admin());

DROP POLICY IF EXISTS "admin_delete_payment_qr" ON storage.objects;
CREATE POLICY "admin_delete_payment_qr" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'payment-qr' AND public.is_admin());

INSERT INTO public.payment_methods (method_name, qr_image_url, instructions, is_active)
SELECT 'BTC / Bitcoin', '/assets/payment/bank-payment_copy.jpg', 'Send BTC only to the Bitcoin address shown. Do not send other assets or use another network.', true
WHERE NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE method_name = 'BTC / Bitcoin');

INSERT INTO public.payment_methods (method_name, qr_image_url, instructions, is_active)
SELECT 'USDT / BNB', '/assets/payment/usdt-payment copy 2.jpg', 'Send USDT only on the BNB Smart Chain (BEP20) network.', true
WHERE NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE method_name = 'USDT / BNB');

INSERT INTO public.payment_methods (method_name, qr_image_url, instructions, is_active)
SELECT 'USDT / OPBNB', '/assets/payment/usdt-payment copy 2.jpg', 'Send USDT only on the opBNB network.', true
WHERE NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE method_name = 'USDT / OPBNB');

INSERT INTO public.payment_methods (method_name, qr_image_url, instructions, is_active)
SELECT 'USDT / BASE', '/assets/payment/usdt-payment copy 2.jpg', 'Send USDT only on the Base network.', true
WHERE NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE method_name = 'USDT / BASE');

INSERT INTO public.payment_methods (method_name, qr_image_url, instructions, is_active)
SELECT 'USDT / ERC20', '/assets/payment/usdt-payment copy 2.jpg', 'Send USDT only on the Ethereum ERC20 network.', true
WHERE NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE method_name = 'USDT / ERC20');

INSERT INTO public.payment_methods (method_name, qr_image_url, instructions, is_active)
SELECT 'WLD / WorldCoin', '/assets/payment/usdt-payment copy 2.jpg', 'Send WLD only using the supported WorldCoin network and verify the address before sending.', true
WHERE NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE method_name = 'WLD / WorldCoin');