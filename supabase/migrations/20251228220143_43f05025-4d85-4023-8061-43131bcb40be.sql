-- Allow admins to upload/delete files in deposit-proofs bucket (Storage)
-- Needed because admin uploads use path: admin/<depositId>/...

CREATE POLICY "Admins can upload deposit proofs files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'deposit-proofs'
  AND public.is_admin(auth.uid())
);

CREATE POLICY "Admins can delete deposit proofs files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'deposit-proofs'
  AND public.is_admin(auth.uid())
);