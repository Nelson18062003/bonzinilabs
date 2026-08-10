-- ============================================================
-- SMS — Lot 8 : langue des messages, choisie et non devinée.
--
-- LE PROBLÈME QUE ÇA CORRIGE : jusqu'ici la langue se déduisait du pays du
-- numéro. Ça marche pour un client en Chine ou aux États-Unis, mais pas au
-- Cameroun — pays officiellement bilingue, où un client du Nord-Ouest a un
-- numéro +237 exactement comme un client de Douala. La déduction se
-- trompait donc précisément sur la population anglophone qu'il s'agit de
-- servir : ce n'est pas un cas marginal, c'est une partie du marché.
--
-- LA SOURCE DE VÉRITÉ devient la langue que le client a choisie lui-même
-- dans l'application. Ce n'est plus une supposition, c'est une décision.
-- Le pays ne sert plus que de repli, et le français de défaut.
--
-- DÉFAUT FRANÇAIS pour tout le monde : c'est la langue de la majorité du
-- portefeuille, et un défaut explicite vaut mieux qu'un NULL qui laisserait
-- chaque appelant improviser.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Français par défaut, partout
-- ------------------------------------------------------------
UPDATE public.clients
   SET preferred_locale = 'fr'
 WHERE preferred_locale IS NULL;

ALTER TABLE public.clients
  ALTER COLUMN preferred_locale SET DEFAULT 'fr';

COMMENT ON COLUMN public.clients.preferred_locale IS
  'Langue des SMS, choisie par le client dans l''app ou réglée par un admin. Défaut « fr ». Le pays du numéro ne sert plus que de repli.';

-- ------------------------------------------------------------
-- 2. Le client règle sa propre langue
--
-- Appelée par l'application au moment où le client change de langue. Le
-- chinois existe dans l'interface mais pas en SMS : un message en
-- idéogrammes bascule en UCS-2 (70 caractères par segment au lieu de 160)
-- et doublerait le coût de chaque envoi. Un client qui navigue en chinois
-- reçoit donc ses SMS en anglais — plus utile que du français pour
-- quelqu'un qui a explicitement écarté le français.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_my_preferred_locale(p_locale TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_locale TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session requise');
  END IF;

  v_locale := CASE lower(left(coalesce(p_locale, ''), 2))
                WHEN 'fr' THEN 'fr'
                WHEN 'en' THEN 'en'
                WHEN 'zh' THEN 'en'   -- pas de SMS en chinois : voir en-tête
                ELSE NULL
              END;

  IF v_locale IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Langue non prise en charge');
  END IF;

  UPDATE public.clients
     SET preferred_locale = v_locale,
         updated_at       = now()
   WHERE user_id = v_uid;

  RETURN jsonb_build_object('success', true, 'locale', v_locale);
END;
$$;

COMMENT ON FUNCTION public.set_my_preferred_locale(TEXT) IS
  '@mola:{"expose":false,"kind":"write","permission":"canEditClients","confirm":false,"danger":false,"label":"Enregistrer la langue de SMS choisie par le client (self-service)"}';

-- ------------------------------------------------------------
-- 3. Un admin règle la langue d'un client
--
-- Indispensable pour les clients inscrits par un agent, qui n'ouvriront
-- peut-être jamais l'application et ne pourront donc jamais exprimer ce
-- choix eux-mêmes.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_client_locale(
  p_user_id UUID,
  p_locale  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locale TEXT := lower(left(coalesce(p_locale, ''), 2));
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF v_locale NOT IN ('fr', 'en') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Langue invalide (fr ou en)');
  END IF;

  UPDATE public.clients
     SET preferred_locale = v_locale,
         updated_at       = now()
   WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;

  RETURN jsonb_build_object('success', true, 'locale', v_locale);
END;
$$;

COMMENT ON FUNCTION public.admin_set_client_locale(UUID, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canEditClients","confirm":true,"danger":false,"label":"Changer la langue des SMS d''un client","resolve":{"p_user_id":"client"}}';

REVOKE ALL ON FUNCTION public.set_my_preferred_locale(TEXT)      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_client_locale(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_my_preferred_locale(TEXT)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_client_locale(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
