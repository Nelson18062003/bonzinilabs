-- Rendre le bucket public pour que les preuves soient accessibles
UPDATE storage.buckets SET public = true WHERE id = 'deposit-proofs';

-- Supprimer les anciennes policies si elles existent
DROP POLICY IF EXISTS "Users can upload proofs for their deposits" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view deposit proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all proofs" ON storage.objects;

-- Policy: Les utilisateurs peuvent uploader des preuves pour leurs propres dépôts
CREATE POLICY "Users can upload proofs for their deposits"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'deposit-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Tout le monde peut voir les preuves (le bucket est public)
CREATE POLICY "Anyone can view deposit proofs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'deposit-proofs');

-- Policy: Les utilisateurs peuvent supprimer leurs propres preuves
CREATE POLICY "Users can delete their own proofs"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'deposit-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);