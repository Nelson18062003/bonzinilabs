-- ============================================================
-- Clés des armateurs lisibles depuis Vault par les edge functions cargo quand
-- le secret n'est pas posé dans l'environnement des fonctions (Edge Functions →
-- Secrets). Seule la clé service peut appeler cette RPC (REVOKE public / anon /
-- authenticated + contrôle du rôle JWT) ; liste blanche de noms, jamais de
-- lecture libre du coffre. La clé elle-même est posée dans Vault à la main
-- (vault.create_secret), jamais dans une migration ni dans le dépôt.
-- Idempotent (CREATE OR REPLACE).
-- ============================================================

CREATE OR REPLACE FUNCTION public.cargo_secret(p_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value text;
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;
  IF p_name NOT IN ('CMACGM_API_KEY', 'MAERSK_CONSUMER_KEY', 'AISSTREAM_API_KEY') THEN
    RAISE EXCEPTION 'Secret inconnu';
  END IF;
  SELECT decrypted_secret INTO v_value FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1;
  RETURN v_value;
END;
$$;
REVOKE ALL ON FUNCTION public.cargo_secret(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cargo_secret(text) TO service_role;
COMMENT ON FUNCTION public.cargo_secret(text) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageCargo","label":"Lire une cle armateur dans Vault (interne, service role uniquement)"}';
