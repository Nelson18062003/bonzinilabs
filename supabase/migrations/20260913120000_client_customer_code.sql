-- ============================================================
-- IDENTIFIANT CLIENT — un code unique, court, permanent, par client.
--
-- Besoin réel (fondateur) : « chaque client a un identifiant unique. Quand
-- il fait un virement bancaire, il met ce code sur le virement et on
-- retrouve le dépôt tout de suite. Et quand son fournisseur chinois nous
-- expédie des colis, il colle le QR code du client sur chaque carton : à
-- l'entrepôt, on scanne, et on sait à qui c'est. »
--
-- Le code doit donc être :
--   · COURT et DICTABLE — il sera tapé dans le libellé d'un virement, lu au
--     téléphone, écrit à la main sur un carton : `BZ-482913` (préfixe
--     Bonzini + 6 chiffres). Pas de lettres ambiguës (O/0, I/1), pas de
--     casse à respecter, pas de compte à rebours qui révèle le nombre de
--     clients (les codes sont tirés au hasard, pas séquentiels).
--   · UNIQUE — index unique ; le générateur boucle jusqu'à trouver un code
--     libre (900 000 codes possibles pour quelques milliers de clients :
--     la collision est rare et le retry la couvre).
--   · PERMANENT — il figure sur des virements passés et des cartons en
--     transit. Un code qui change casse le rapprochement. Un déclencheur
--     BEFORE UPDATE le rend immuable, pour tout le monde (admin compris).
--   · AUTOMATIQUE — attribué à l'INSERT par déclencheur, donc aussi par
--     `_create_client_and_wallet` (inscription) sans toucher ce helper.
--
-- Idempotent : ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE, DROP TRIGGER IF
-- EXISTS. Le backfill ne touche que les lignes sans code.
-- ============================================================

-- ── 1. La colonne ────────────────────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS customer_code TEXT;

COMMENT ON COLUMN public.clients.customer_code IS
  'Identifiant client court et permanent (BZ-NNNNNN). Libellé de virement bancaire + contenu du QR code collé sur les colis. Attribué automatiquement à la création, immuable ensuite.';

-- ── 2. Le générateur ─────────────────────────────────────────
-- SECURITY DEFINER pour lire `clients` en entier lors du test d'unicité, même
-- quand l'appelant (le déclencheur d'inscription) n'a aucun droit de lecture.
-- Non exposé : c'est un helper interne, le déclencheur suffit.
CREATE OR REPLACE FUNCTION public.generate_customer_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_try  INTEGER := 0;
BEGIN
  LOOP
    v_try := v_try + 1;
    -- 6 chiffres, premier chiffre non nul : 100000..999999.
    v_code := 'BZ-' || (100000 + floor(random() * 900000))::INTEGER::TEXT;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clients WHERE customer_code = v_code);
    IF v_try >= 50 THEN
      RAISE EXCEPTION 'generate_customer_code: aucun code libre après % essais', v_try;
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_customer_code() FROM public, anon, authenticated;
COMMENT ON FUNCTION public.generate_customer_code() IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":false,"danger":false,"label":"Tirer un identifiant client libre (helper interne du déclencheur)"}';

-- ── 3. Attribution à la création ─────────────────────────────
CREATE OR REPLACE FUNCTION public.assign_customer_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_code IS NULL OR NEW.customer_code = '' THEN
    NEW.customer_code := public.generate_customer_code();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_customer_code() FROM public, anon, authenticated;
COMMENT ON FUNCTION public.assign_customer_code() IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":false,"danger":false,"label":"Attribuer l''identifiant client à l''inscription (déclencheur interne)"}';

DROP TRIGGER IF EXISTS assign_customer_code ON public.clients;
CREATE TRIGGER assign_customer_code
BEFORE INSERT ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.assign_customer_code();

-- ── 4. Immuable — pour tout le monde ─────────────────────────
-- Distinct de guard_clients_privileged_columns (qui laisse les admins libres) :
-- ici même un admin ne réécrit pas le code, parce qu'il vit déjà sur des
-- virements et des cartons hors de notre contrôle.
CREATE OR REPLACE FUNCTION public.freeze_customer_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.customer_code IS NOT NULL THEN
    NEW.customer_code := OLD.customer_code;
  ELSIF NEW.customer_code IS NULL OR NEW.customer_code = '' THEN
    -- Ligne historique jamais codée (ne devrait plus exister après le
    -- backfill) : on la rattrape au premier UPDATE plutôt que de la laisser
    -- sans identifiant.
    NEW.customer_code := public.generate_customer_code();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.freeze_customer_code() FROM public, anon, authenticated;
COMMENT ON FUNCTION public.freeze_customer_code() IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":false,"danger":false,"label":"Rendre l''identifiant client immuable (déclencheur interne)"}';

DROP TRIGGER IF EXISTS freeze_customer_code ON public.clients;
CREATE TRIGGER freeze_customer_code
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.freeze_customer_code();

-- ── 5. Backfill des clients existants ────────────────────────
-- Ligne par ligne : le générateur consulte la table à chaque tirage, donc un
-- UPDATE ensembliste pourrait tirer deux fois le même code dans la même
-- instruction (la contrainte unique n'est posée qu'ensuite, précisément
-- pour que le backfill ne se heurte pas à lui-même).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.clients WHERE customer_code IS NULL OR customer_code = '' LOOP
    UPDATE public.clients SET customer_code = public.generate_customer_code() WHERE id = r.id;
  END LOOP;
END $$;

-- ── 6. Contraintes, une fois tout le monde codé ──────────────
ALTER TABLE public.clients ALTER COLUMN customer_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clients_customer_code_key
  ON public.clients (customer_code);

-- Format verrouillé : un code hors format ne peut entrer ni par l'API ni par
-- un import. NOT VALID + VALIDATE pour ne pas bloquer si une ligne
-- historique bizarre existait (le backfill n'en produit pas).
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_customer_code_format;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_customer_code_format
  CHECK (customer_code ~ '^BZ-[1-9][0-9]{5}$') NOT VALID;
ALTER TABLE public.clients VALIDATE CONSTRAINT clients_customer_code_format;

-- ── 7. Retrouver un client par son code ──────────────────────
-- C'est l'action de l'entrepôt (scan du QR) et du rapprochement bancaire
-- (libellé du virement). Tolérante à la saisie : casse, espaces, tiret
-- oublié, code brut ou URL du QR — tout est ramené à `BZ-NNNNNN`.
-- Garde : canViewClients (miroir de ROLE_PERMISSIONS), jamais is_admin seul.
CREATE OR REPLACE FUNCTION public.find_client_by_customer_code(p_code TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_digits   TEXT;
  v_code     TEXT;
  v_client   RECORD;
BEGIN
  IF v_admin_id IS NULL OR NOT public.admin_has_permission(v_admin_id, 'canViewClients') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  -- « bz 482913 », « BZ-482913 », « https://bonzinilabs.com/c/BZ-482913 » →
  -- on garde les 6 derniers chiffres consécutifs précédés de BZ.
  v_digits := substring(upper(coalesce(p_code, '')) from 'BZ[^0-9]{0,3}([1-9][0-9]{5})');
  IF v_digits IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code client invalide');
  END IF;
  v_code := 'BZ-' || v_digits;

  SELECT c.user_id, c.customer_code, c.first_name, c.last_name, c.company_name,
         c.phone, c.email, c.status, c.city, c.country
    INTO v_client
    FROM public.clients c
   WHERE c.customer_code = v_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun client avec ce code', 'code', v_code);
  END IF;

  RETURN jsonb_build_object(
    'success',       true,
    'user_id',       v_client.user_id,
    'customer_code', v_client.customer_code,
    'first_name',    v_client.first_name,
    'last_name',     v_client.last_name,
    'company_name',  v_client.company_name,
    'phone',         v_client.phone,
    'email',         v_client.email,
    'status',        v_client.status,
    'city',          v_client.city,
    'country',       v_client.country
  );
END;
$$;

REVOKE ALL ON FUNCTION public.find_client_by_customer_code(TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.find_client_by_customer_code(TEXT) TO authenticated;

COMMENT ON FUNCTION public.find_client_by_customer_code(TEXT) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewClients","confirm":false,"danger":false,"label":"Retrouver un client par son identifiant BZ-NNNNNN (libellé de virement, QR code colis)"}';

NOTIFY pgrst, 'reload schema';
