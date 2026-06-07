-- ============================================================
-- Centrale d'achat — Lot 0 : bucket de preuves « procurement-docs »
--
-- Stocke les PREUVES jointes (photos de factures, reçus, captures
-- WeChat, PDF) — JAMAIS analysées. Bucket privé, scopé par dossier
-- {auth.uid()}/... comme assistant-attachments (20260531130000).
-- Accès réservé aux utilisateurs procurement (can_access_procurement).
-- Limite 10 Mo (aligné sur validateUploadFile). Service role (edge
-- functions) bypasse la RLS.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'procurement-docs',
  'procurement-docs',
  false,
  10485760, -- 10 Mo
  ARRAY['image/png','image/jpeg','image/jpg','image/webp','image/heic','image/heif','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Upload : utilisateur procurement, dans son propre dossier {uid}/...
CREATE POLICY "Procurement users can upload proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'procurement-docs'
    AND public.can_access_procurement(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lecture : tout utilisateur procurement (preuves partagées dans l'équipe interne)
CREATE POLICY "Procurement users can view proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'procurement-docs'
    AND public.can_access_procurement(auth.uid())
  );

-- Mise à jour : seulement ses propres fichiers
CREATE POLICY "Procurement users can update own proofs"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'procurement-docs'
    AND public.can_access_procurement(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Suppression : seulement ses propres fichiers
CREATE POLICY "Procurement users can delete own proofs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'procurement-docs'
    AND public.can_access_procurement(auth.uid())
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
