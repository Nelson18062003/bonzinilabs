
-- Create storage bucket for deposit proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('deposit-proofs', 'deposit-proofs', false);

-- Policies for deposit proofs bucket
CREATE POLICY "Users can upload own deposit proofs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'deposit-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view own deposit proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'deposit-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all deposit proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'deposit-proofs' 
  AND public.is_admin(auth.uid())
);
