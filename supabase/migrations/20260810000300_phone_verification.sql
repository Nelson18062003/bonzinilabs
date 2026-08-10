-- ============================================================
-- SMS — Lot 4 : vérification du numéro par code à usage unique.
--
-- POURQUOI C'EST LA PREMIÈRE BRIQUE À ACTIVER : c'est le seul mécanisme qui
-- produit un numéro dont on SAIT qu'il est réel, au format E.164, avec le
-- consentement du client attaché. Tout le reste en dépend — envoyer un solde
-- à un numéro jamais vérifié, c'est l'envoyer à l'inconnu qui l'a récupéré.
--
-- ⚠️ CE N'EST PAS UN FACTEUR D'AUTHENTIFICATION. L'application dispose déjà
-- de passkeys WebAuthn, plus robustes. Le SIM-swap est une attaque réelle sur
-- ces marchés : ces codes servent à CONFIRMER UN NUMÉRO, jamais à ouvrir une
-- session ni à valider un paiement. confirm_phone_verification() exige déjà
-- une session authentifiée — le code seul n'ouvre rien.
--
-- ⚠️ search_path = public, extensions : pgcrypto est installé dans le schéma
-- `extensions`. Une fonction qui épingle `SET search_path = public` seul ne
-- voit PAS crypt()/gen_salt()/gen_random_bytes() et échoue à l'exécution.
-- Le dépôt porte déjà une migration correctrice pour exactement ce piège
-- (20260220000000_fix_admin_reset_password_searchpath).
--
-- DÉFENSES : code haché (bcrypt, jamais en clair au repos), expiration à
-- 10 minutes, usage unique, 5 essais maximum par code, 3 demandes par heure
-- et par utilisateur, et refus si le numéro est en liste de suppression.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_e164    TEXT NOT NULL,
  phone_country TEXT,
  code_hash     TEXT NOT NULL,           -- bcrypt : le code en clair n'est jamais stocké
  attempts      INT  NOT NULL DEFAULT 0,
  max_attempts  INT  NOT NULL DEFAULT 5,
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_user
  ON public.phone_verifications (user_id, created_at DESC);

COMMENT ON TABLE public.phone_verifications IS
  'Codes de vérification de numéro à usage unique. Code haché en bcrypt, expiration 10 min, 5 essais max. Sert à confirmer un numéro — jamais à authentifier.';

-- Table interne : RLS active et AUCUNE policy. Tout passe par les RPC
-- SECURITY DEFINER ci-dessous. Un client ne doit jamais pouvoir lire la
-- table des codes, fût-ce la sienne.
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- Demande d'un code
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_phone_verification(
  p_phone_e164 TEXT,
  p_country    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_country  TEXT := upper(nullif(trim(coalesce(p_country, '')), ''));
  v_enabled  BOOLEAN;
  v_recent   INT;
  v_bytes    BYTEA;
  v_num      BIGINT;
  v_code     TEXT;
  v_locale   TEXT;
  v_verif_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session requise');
  END IF;

  -- Forme E.164 stricte. La validité réelle du plan de numérotation est
  -- contrôlée côté client par libphonenumber avant l'appel.
  IF p_phone_e164 IS NULL OR p_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Numéro non conforme au format international');
  END IF;

  -- Le gabarit doit être actif AVANT toute écriture : sinon on consommerait
  -- un jeton de limitation de débit et on stockerait un code pour un SMS
  -- qui ne partirait jamais.
  SELECT enabled INTO v_enabled
    FROM public.sms_template_map WHERE notification_type = 'phone_verification';

  IF v_enabled IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vérification par SMS indisponible pour le moment');
  END IF;

  -- Un numéro ayant répondu STOP ne reçoit plus rien, code compris.
  IF EXISTS (SELECT 1 FROM public.sms_suppressions s WHERE s.phone_e164 = p_phone_e164) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro a demandé à ne plus être contacté');
  END IF;

  -- Limitation de débit : 3 demandes par heure et par utilisateur.
  SELECT count(*) INTO v_recent
    FROM public.phone_verifications
   WHERE user_id = v_uid AND created_at > now() - interval '1 hour';

  IF v_recent >= 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trop de demandes. Réessayez dans une heure.');
  END IF;

  -- Code à 6 chiffres tiré d'une source cryptographique (jamais random()).
  -- Composition octet par octet : le résultat est positif par construction,
  -- contrairement à l'idiome ('x'||hex)::bit(32)::int qui peut être négatif
  -- et produire un lpad aberrant.
  v_bytes := gen_random_bytes(4);
  v_num := get_byte(v_bytes, 0)::bigint * 16777216
         + get_byte(v_bytes, 1)::bigint * 65536
         + get_byte(v_bytes, 2)::bigint * 256
         + get_byte(v_bytes, 3)::bigint;
  v_code := lpad((v_num % 1000000)::text, 6, '0');

  -- Un seul code actif à la fois : les précédents sont invalidés.
  UPDATE public.phone_verifications
     SET consumed_at = now()
   WHERE user_id = v_uid AND consumed_at IS NULL;

  INSERT INTO public.phone_verifications (user_id, phone_e164, phone_country, code_hash, expires_at)
  VALUES (v_uid, p_phone_e164, v_country,
          crypt(v_code, gen_salt('bf')), now() + interval '10 minutes')
  RETURNING id INTO v_verif_id;

  SELECT coalesce(c.preferred_locale,
                  public.sms_locale_for_country(coalesce(v_country, c.phone_country)))
    INTO v_locale
    FROM public.clients c WHERE c.user_id = v_uid;

  -- Enfilement DIRECT dans sms_outbox, sans passer par notifications : un
  -- code de vérification n'a rien à faire dans le fil in-app, où il resterait
  -- lisible bien après son expiration.
  --
  -- La clé d'idempotence porte l'id de la ligne de vérification — unique par
  -- construction. Un horodatage à la seconde ferait silencieusement tomber
  -- une seconde demande émise dans la même seconde.
  INSERT INTO public.sms_outbox (
    event_type, recipient_user_id, recipient_phone, recipient_country,
    locale, template, category, payload, status, idempotency_key
  ) VALUES (
    'phone_verification', v_uid, p_phone_e164, v_country,
    coalesce(v_locale, 'fr'), 'phone_verification', 'security',
    jsonb_build_object('code', v_code), 'pending',
    'phoneverif:' || v_verif_id::text
  );

  RETURN jsonb_build_object('success', true, 'expires_in_seconds', 600);
END;
$$;

COMMENT ON FUNCTION public.request_phone_verification(TEXT, TEXT) IS
  '@mola:{"expose":false,"kind":"write","permission":"canEditClients","confirm":false,"danger":false,"label":"Envoyer un code de vérification de numéro par SMS (self-service client)"}';

-- ------------------------------------------------------------
-- Confirmation
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
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun code en attente');
  END IF;

  IF v_row.expires_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code expiré. Demandez-en un nouveau.');
  END IF;

  IF v_row.attempts >= v_row.max_attempts THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trop d''essais. Demandez un nouveau code.');
  END IF;

  -- L'essai est compté AVANT la comparaison : un abandon en cours de
  -- transaction ne doit pas offrir un essai gratuit.
  UPDATE public.phone_verifications SET attempts = attempts + 1 WHERE id = v_row.id;

  IF v_row.code_hash <> crypt(coalesce(p_code, ''), v_row.code_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code incorrect');
  END IF;

  UPDATE public.phone_verifications SET consumed_at = now() WHERE id = v_row.id;

  UPDATE public.clients
     SET phone_e164        = v_row.phone_e164,
         phone_country     = coalesce(v_row.phone_country, phone_country),
         phone_verified_at = now(),
         updated_at        = now()
   WHERE user_id = v_uid;

  RETURN jsonb_build_object('success', true, 'phone_e164', v_row.phone_e164);
END;
$$;

COMMENT ON FUNCTION public.confirm_phone_verification(TEXT) IS
  '@mola:{"expose":false,"kind":"write","permission":"canEditClients","confirm":false,"danger":false,"label":"Confirmer un code de vérification de numéro (self-service client)"}';

REVOKE ALL ON FUNCTION public.request_phone_verification(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_phone_verification(TEXT)       FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_phone_verification(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_phone_verification(TEXT)       TO authenticated;

NOTIFY pgrst, 'reload schema';
