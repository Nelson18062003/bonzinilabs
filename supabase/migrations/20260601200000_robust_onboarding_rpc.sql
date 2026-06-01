-- ============================================================
-- Onboarding ROBUSTE : corrige la « boucle d'onboarding sans fin ».
--
-- BUG : si un compte auth existe SANS fiche client (ex. client supprimé par
-- l'admin puis reconnexion Google), l'onboarding faisait un UPDATE sur une
-- fiche inexistante → 0 ligne, « profil validé » mais rien ne se passe →
-- /wallet renvoie vers /onboarding → BOUCLE infinie.
--
-- CORRECTIF : une RPC qui CRÉE la fiche si absente (depuis les métadonnées
-- auth) puis met à jour les champs métier (liste blanche). SECURITY DEFINER
-- (contourne la RLS, qui n'autorise pas l'INSERT client côté app).
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_client_onboarding(
  p_phone   TEXT,
  p_country TEXT,
  p_company TEXT DEFAULT NULL,
  p_sector  TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_meta  JSONB;
  v_email TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'non authentifié');
  END IF;

  -- Filet : fiche client absente (compte orphelin) → on la crée depuis l'auth.
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE user_id = v_uid) THEN
    SELECT raw_user_meta_data, email INTO v_meta, v_email
      FROM auth.users WHERE id = v_uid;
    PERFORM public._create_client_and_wallet(v_uid, COALESCE(v_meta, '{}'::jsonb), v_email);
  END IF;

  -- Champs métier (liste blanche stricte : jamais kyc_verified/status ici).
  UPDATE public.clients
     SET phone           = p_phone,
         country         = p_country,
         company_name    = NULLIF(p_company, ''),
         activity_sector = NULLIF(p_sector, '')
   WHERE user_id = v_uid;

  RETURN json_build_object('success', true);
END;
$$;

COMMENT ON FUNCTION public.complete_client_onboarding IS
  'Finalise l''onboarding client : crée la fiche si absente (compte orphelin) puis met à jour phone/country/company/sector. Corrige la boucle d''onboarding.';

REVOKE ALL ON FUNCTION public.complete_client_onboarding(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_client_onboarding(TEXT, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
