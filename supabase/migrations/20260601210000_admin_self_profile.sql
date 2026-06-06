-- ============================================================
-- Profil admin éditable par soi-même : nom, prénom, photo de profil.
--
-- - Ajoute user_roles.avatar_url.
-- - RPC update_my_admin_profile : l'admin met à jour SA propre fiche
--   (nom/prénom/photo). SECURITY DEFINER + garde is_admin.
-- - Bucket Storage 'avatars' (public en lecture) : chaque admin écrit dans
--   son propre dossier (name commençant par son user_id).
-- ============================================================

ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE OR REPLACE FUNCTION public.update_my_admin_profile(
  p_first_name TEXT,
  p_last_name  TEXT,
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin(v_uid) THEN
    RETURN json_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  UPDATE public.user_roles
     SET first_name = NULLIF(TRIM(p_first_name), ''),
         last_name  = NULLIF(TRIM(p_last_name), ''),
         avatar_url = COALESCE(NULLIF(p_avatar_url, ''), avatar_url)  -- garde l'ancienne si vide
   WHERE user_id = v_uid;

  RETURN json_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.update_my_admin_profile IS
  'Permet à un admin de mettre à jour SA propre fiche (nom, prénom, photo).';

REVOKE ALL ON FUNCTION public.update_my_admin_profile(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_admin_profile(TEXT, TEXT, TEXT) TO authenticated;

-- ── Bucket avatars (public) ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique des avatars.
DROP POLICY IF EXISTS "Avatars public read" ON storage.objects;
CREATE POLICY "Avatars public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Écriture réservée au propriétaire (dossier = son user_id).
DROP POLICY IF EXISTS "Avatars owner insert" ON storage.objects;
CREATE POLICY "Avatars owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Avatars owner update" ON storage.objects;
CREATE POLICY "Avatars owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

NOTIFY pgrst, 'reload schema';
