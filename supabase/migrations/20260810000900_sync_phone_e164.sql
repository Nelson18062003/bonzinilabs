-- ============================================================
-- SMS — Lot 10 : garder phone_e164 synchronisé avec phone.
--
-- LE DÉFAUT CORRIGÉ ICI, ET IL EST GRAVE :
-- `clients.phone` est écrit par une douzaine de RPC existantes (création de
-- client, mise à jour admin, onboarding…) écrites bien avant l'ajout de
-- `phone_e164`. Aucune ne connaît cette nouvelle colonne, qui n'a été
-- remplie qu'une fois, par la reprise initiale.
--
-- Conséquence observée en production : un admin corrige le numéro d'un
-- client, `phone` change, `phone_e164` conserve l'ancien — et le SMS,
-- avec le solde du client, part vers un numéro dont il ne veut plus.
-- Éventuellement un numéro qu'il ne contrôle même plus.
--
-- POURQUOI UN TRIGGER PLUTÔT QUE CORRIGER LES RPC : elles sont une dizaine,
-- toutes sur des chemins sensibles (création de compte, onboarding). En
-- modifier une par une, c'est dix occasions de régression, et la certitude
-- qu'une onzième écrite demain oubliera à nouveau la règle. Un trigger sur
-- la table couvre TOUS les chemins d'écriture, y compris un UPDATE lancé à
-- la main dans l'éditeur SQL.
--
-- RÈGLE DE SÛRETÉ : si le nouveau numéro n'est pas au format international,
-- `phone_e164` passe à NULL — on n'envoie plus rien plutôt que de continuer
-- vers l'ancien. Ne rien envoyer est un désagrément ; envoyer un solde au
-- mauvais destinataire est une divulgation.
--
-- La vérification est également remise à zéro : un numéro modifié est un
-- autre numéro, la confirmation obtenue sur le précédent ne vaut plus.
-- ============================================================

-- ------------------------------------------------------------
-- Pays déduit du préfixe international
--
-- Sert au routage de l'expéditeur et au repli de langue. Un préfixe inconnu
-- renvoie NULL, ce qui est sans danger : la langue retombe sur le français
-- et l'expéditeur sur le numéro long.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.phone_country_from_e164(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    -- CEMAC / Afrique centrale
    WHEN p_phone LIKE '+237%' THEN 'CM'  WHEN p_phone LIKE '+241%' THEN 'GA'
    WHEN p_phone LIKE '+235%' THEN 'TD'  WHEN p_phone LIKE '+236%' THEN 'CF'
    WHEN p_phone LIKE '+242%' THEN 'CG'  WHEN p_phone LIKE '+240%' THEN 'GQ'
    WHEN p_phone LIKE '+243%' THEN 'CD'
    -- Afrique de l'Ouest
    WHEN p_phone LIKE '+225%' THEN 'CI'  WHEN p_phone LIKE '+221%' THEN 'SN'
    WHEN p_phone LIKE '+223%' THEN 'ML'  WHEN p_phone LIKE '+226%' THEN 'BF'
    WHEN p_phone LIKE '+227%' THEN 'NE'  WHEN p_phone LIKE '+228%' THEN 'TG'
    WHEN p_phone LIKE '+229%' THEN 'BJ'  WHEN p_phone LIKE '+224%' THEN 'GN'
    WHEN p_phone LIKE '+234%' THEN 'NG'  WHEN p_phone LIKE '+233%' THEN 'GH'
    WHEN p_phone LIKE '+238%' THEN 'CV'
    -- Afrique de l'Est et australe
    WHEN p_phone LIKE '+254%' THEN 'KE'  WHEN p_phone LIKE '+255%' THEN 'TZ'
    WHEN p_phone LIKE '+256%' THEN 'UG'  WHEN p_phone LIKE '+250%' THEN 'RW'
    WHEN p_phone LIKE '+257%' THEN 'BI'  WHEN p_phone LIKE '+244%' THEN 'AO'
    WHEN p_phone LIKE '+251%' THEN 'ET'  WHEN p_phone LIKE '+27%'  THEN 'ZA'
    -- Afrique du Nord
    WHEN p_phone LIKE '+212%' THEN 'MA'  WHEN p_phone LIKE '+216%' THEN 'TN'
    WHEN p_phone LIKE '+213%' THEN 'DZ'
    -- Europe
    WHEN p_phone LIKE '+352%' THEN 'LU'  WHEN p_phone LIKE '+351%' THEN 'PT'
    WHEN p_phone LIKE '+33%'  THEN 'FR'  WHEN p_phone LIKE '+32%'  THEN 'BE'
    WHEN p_phone LIKE '+41%'  THEN 'CH'  WHEN p_phone LIKE '+49%'  THEN 'DE'
    WHEN p_phone LIKE '+44%'  THEN 'GB'  WHEN p_phone LIKE '+39%'  THEN 'IT'
    WHEN p_phone LIKE '+34%'  THEN 'ES'  WHEN p_phone LIKE '+48%'  THEN 'PL'
    WHEN p_phone LIKE '+40%'  THEN 'RO'
    -- Asie et Moyen-Orient
    WHEN p_phone LIKE '+86%'  THEN 'CN'  WHEN p_phone LIKE '+91%'  THEN 'IN'
    WHEN p_phone LIKE '+90%'  THEN 'TR'  WHEN p_phone LIKE '+966%' THEN 'SA'
    WHEN p_phone LIKE '+971%' THEN 'AE'
    -- Amériques
    WHEN p_phone LIKE '+55%'  THEN 'BR'
    -- +1 est ambigu (États-Unis / Canada) : dans les deux cas l'expéditeur
    -- alphanumérique est interdit et le repli est le même. On ne tranche pas.
    ELSE NULL
  END;
$$;

COMMENT ON FUNCTION public.phone_country_from_e164(TEXT) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewClients","confirm":false,"danger":false,"label":"Déduire le pays d''un numéro E.164 (interne)"}';

-- ------------------------------------------------------------
-- Le trigger de synchronisation
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_client_phone_e164()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Ne rien faire si `phone` n'a pas bougé : sans cette garde, une simple
  -- mise à jour d'un autre champ effacerait la vérification du numéro.
  IF TG_OP = 'UPDATE' AND NEW.phone IS NOT DISTINCT FROM OLD.phone THEN
    RETURN NEW;
  END IF;

  IF NEW.phone ~ '^\+[1-9][0-9]{7,14}$' THEN
    NEW.phone_e164    := NEW.phone;
    NEW.phone_country := public.phone_country_from_e164(NEW.phone);
  ELSE
    -- Numéro absent ou mal formé : on coupe l'envoi plutôt que de laisser
    -- les SMS continuer vers l'ancien numéro.
    NEW.phone_e164    := NULL;
    NEW.phone_country := NULL;
  END IF;

  -- Numéro changé ⇒ numéro non confirmé. La vérification portait sur le
  -- précédent et ne dit rien de celui-ci.
  NEW.phone_verified_at := NULL;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_client_phone_e164 IS
  'Trigger BEFORE INSERT/UPDATE ON clients : maintient phone_e164 et phone_country alignés sur phone, et invalide la vérification quand le numéro change. Couvre tous les chemins d''écriture, y compris les RPC antérieures à ces colonnes.';

DROP TRIGGER IF EXISTS on_client_phone_sync_e164 ON public.clients;
CREATE TRIGGER on_client_phone_sync_e164
  BEFORE INSERT OR UPDATE OF phone ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.sync_client_phone_e164();

-- ------------------------------------------------------------
-- Rattrapage : réaligner les lignes déjà désynchronisées
--
-- Les numéros modifiés depuis la reprise initiale pointent encore vers
-- l'ancienne valeur. On les remet d'aplomb maintenant.
-- ------------------------------------------------------------
UPDATE public.clients
   SET phone_e164    = CASE WHEN phone ~ '^\+[1-9][0-9]{7,14}$' THEN phone ELSE NULL END,
       phone_country = public.phone_country_from_e164(phone)
 WHERE phone_e164 IS DISTINCT FROM
       (CASE WHEN phone ~ '^\+[1-9][0-9]{7,14}$' THEN phone ELSE NULL END);

-- ------------------------------------------------------------
-- La confirmation de numéro écrit désormais aussi `phone`
--
-- Sans cela, `phone` et `phone_e164` divergeraient après une vérification,
-- et la prochaine écriture de `phone` par une RPC ancienne écraserait le
-- numéro que le client venait pourtant de confirmer.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_phone_verification(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.phone_verifications%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session requise');
  END IF;

  SELECT * INTO v_row
    FROM public.phone_verifications
   WHERE user_id = v_uid AND consumed_at IS NULL
   ORDER BY created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun code en attente');
  END IF;

  IF v_row.expires_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code expiré. Demandez-en un nouveau.');
  END IF;

  IF v_row.attempts >= v_row.max_attempts THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trop d''essais. Demandez un nouveau code.');
  END IF;

  UPDATE public.phone_verifications SET attempts = attempts + 1 WHERE id = v_row.id;

  IF v_row.code_hash <> crypt(coalesce(p_code, ''), v_row.code_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code incorrect');
  END IF;

  UPDATE public.phone_verifications SET consumed_at = now() WHERE id = v_row.id;

  -- `phone` est écrit en premier : le trigger de synchronisation s'exécute
  -- alors et remplit phone_e164 / phone_country, en remettant
  -- phone_verified_at à NULL…
  UPDATE public.clients
     SET phone      = v_row.phone_e164,
         updated_at = now()
   WHERE user_id = v_uid;

  -- …que l'on repose ici, une fois le numéro effectivement confirmé.
  UPDATE public.clients
     SET phone_verified_at = now()
   WHERE user_id = v_uid;

  RETURN jsonb_build_object('success', true, 'phone_e164', v_row.phone_e164);
END;
$$;

COMMENT ON FUNCTION public.confirm_phone_verification(TEXT) IS
  '@mola:{"expose":false,"kind":"write","permission":"canEditClients","confirm":false,"danger":false,"label":"Confirmer un code de vérification de numéro (self-service client)"}';

NOTIFY pgrst, 'reload schema';
