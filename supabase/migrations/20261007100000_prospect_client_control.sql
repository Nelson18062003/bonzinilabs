-- ============================================================================
-- Prospects : numéro déjà client (« À vérifier ») · Le super admin passe un
-- prospect en client, et un client sans aucune opération en prospect
--
-- Le 07/10/2026, le directeur (super admin) :
--
--   1. CLOISONNEMENT — le commercial n'a accès qu'à SES clients et à SES
--      prospects, jamais à la base des clients. C'est déjà le cas depuis le
--      05/10 (is_admin() l'exclut ; ses lectures passent par des RPC limitées
--      à sa fiche) : cette migration n'ouvre RIEN. La nouvelle table des
--      fiches « à vérifier » ne lui est jamais lisible (RLS : canManageSales
--      seulement), et la vérification d'un numéro pendant la saisie
--      (prospect_phone_check) ne dit rien du client — seulement ce que
--      prospect_create lui dirait déjà.
--   2. NUMÉRO DÉJÀ CLIENT — un commercial saisit un numéro (principal ou
--      autre) qui est déjà celui d'un client Bonzini. Il ne sait pas de quel
--      client il s'agit (les noms sont souvent imprécis : c'est LE NUMÉRO qui
--      reconnaît le client) et remplit sa fiche normalement. Avant : refusé.
--      Désormais :
--        · le client est l'un de SES clients (origine = sa fiche) → refusé,
--          « Le numéro X est déjà celui d'un de vos clients » ;
--        · un AUTRE client → la fiche est enregistrée au statut particulier
--          « À vérifier » (to_verify), une vérification est ouverte par client
--          reconnu (prospect_client_claims), et le super admin est notifié
--          (c'est peut-être que le commercial a rencontré ce client et l'a
--          convaincu). La réponse porte to_verify: true.
--      Le super admin tranche (prospect_resolve_claim) : ATTRIBUER ce client
--      au commercial (son origine passe à la fiche du commercial, le prospect
--      devient « devenu client » ; un ancien prospect « devenu client » de ce
--      client est détaché ; les autres commerciaux qui l'avaient aussi saisi
--      sont prévenus) ou REFUSER (le prospect passe « perdu »). Le commercial
--      concerné reçoit une notification. Tant que la direction n'a pas
--      tranché, le commercial ne change pas le statut de la fiche (il peut
--      en modifier les autres champs).
--      « À vérifier » n'est pas un statut ouvert : il n'entre ni dans l'index
--      des numéros suivis, ni dans les compteurs « ouverts » / « à relancer »
--      des tableaux de bord, ni dans l'attribution automatique d'un nouveau
--      client (clients_match_prospect, inchangé : il ne lit que new /
--      contacted / interested). Un numéro d'une fiche « À vérifier » reste
--      en revanche « suivi » pour les autres saisies (pas de doublon).
--   3. PROSPECT ↔ CLIENT PAR LE SUPER ADMIN —
--        · prospect → client : le formulaire « Nouveau client » existant,
--          pré-rempli depuis la fiche prospect (prospect_lookup_phone, déjà
--          en place) ; le déclencheur clients_match_prospect attribue le
--          compte et passe le prospect « devenu client ». Rien à ajouter ici.
--        · client → prospect (admin_client_to_prospect) : SEULEMENT pour un
--          client qui n'a fait AUCUNE opération (ni dépôt, ni paiement, ni
--          écriture au grand livre, ni ajustement, solde nul, aucun découvert,
--          aucun colis, envoi cargo ou dossier de douane), sans fiche « à
--          vérifier » en attente. Un instantané complet du client part dans
--          le journal d'audit, son compte est supprimé (admin_delete_client),
--          puis son ancien prospect est rouvert, ou un prospect est créé avec
--          ses coordonnées, chez le commercial choisi, qui est notifié.
--          admin_client_prospect_eligibility dit à l'écran ce qui bloque.
--      Les deux sens demandent canManageUsers ET canManageSales (le super
--      admin aujourd'hui).
--
-- Mêmes règles que le 06/10 : tout est vérifié AVANT d'écrire, les numéros
-- saisis sont verrouillés (advisory locks), les lignes lues puis écrites sont
-- verrouillées (FOR UPDATE) avant d'être lues. Les notifications ne font
-- jamais échouer une opération.
--
-- Idempotente (rejouable sans dégât, y compris deux fois dans une même
-- transaction). Suppose 20261005160000 (Mes équipes + commerciaux),
-- 20261006120000 (fiche prospect complète), 20260926100000 (notifications du
-- personnel, send_staff_push) et admin_delete_client (20260831160000).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Le statut « À vérifier »
-- ─────────────────────────────────────────────────────────────────────────
-- La contrainte d'origine (05/10) est anonyme dans CREATE TABLE : Postgres
-- l'a nommée prospects_status_check. On retire toute contrainte de statut
-- qui ne connaît pas to_verify, puis on pose la nouvelle, nommée.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.prospects'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) LIKE '%status%'
       AND pg_get_constraintdef(oid) LIKE '%''won''%'
       AND pg_get_constraintdef(oid) NOT LIKE '%''to_verify''%'
  LOOP
    EXECUTE format('ALTER TABLE public.prospects DROP CONSTRAINT %I', r.conname);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.prospects'::regclass AND conname = 'prospects_status_check') THEN
    ALTER TABLE public.prospects ADD CONSTRAINT prospects_status_check
      CHECK (status IN ('new', 'contacted', 'interested', 'to_verify', 'won', 'lost'));
  END IF;
END $$;

COMMENT ON COLUMN public.prospects.status IS
  'new / contacted / interested (ouverts) · to_verify (un numéro est déjà celui d''un client : la direction tranche) · won (devenu client) · lost (perdu, avec motif).';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Les vérifications : « ce numéro saisi par un commercial est celui de
--    tel client »
-- ─────────────────────────────────────────────────────────────────────────
-- Une ligne par (prospect, client reconnu). Lue par la direction seulement :
-- le commercial n'y a JAMAIS accès (il ne doit pas savoir de quel client il
-- s'agit). Aucune politique d'écriture : tout passe par les RPC.
CREATE TABLE IF NOT EXISTS public.prospect_client_claims (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id    UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Le numéro saisi qui a reconnu le client (le premier, s'il y en a plusieurs).
  matched_phone  TEXT NOT NULL CHECK (matched_phone ~ '^\+[1-9][0-9]{7,14}$'),
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'attributed', 'rejected')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at    TIMESTAMPTZ,
  resolved_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note           TEXT CHECK (note IS NULL OR length(note) <= 300),
  UNIQUE (prospect_id, client_user_id)
);
-- La dernière fois que la DIRECTION a refusé ce client pour cette fiche :
-- gardée quand la vérification se rouvre (le commercial ressaisit le numéro),
-- pour que la direction le voie (« Déjà refusé le … »). Les autres clôtures
-- (numéro retiré, client attribué ailleurs, compte supprimé) ne la posent pas.
ALTER TABLE public.prospect_client_claims ADD COLUMN IF NOT EXISTS direction_rejected_at TIMESTAMPTZ;
-- « Qu'est-ce qui attend la direction ? » et « ce client est-il réclamé ? »
CREATE INDEX IF NOT EXISTS prospect_client_claims_pending_idx
  ON public.prospect_client_claims (client_user_id, created_at) WHERE status = 'pending';

ALTER TABLE public.prospect_client_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Direction reads prospect claims" ON public.prospect_client_claims;
CREATE POLICY "Direction reads prospect claims" ON public.prospect_client_claims
  FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canManageSales'));

-- Les droits par défaut de Supabase ouvrent tout à anon et authenticated :
-- on les retire, puis on rend la seule lecture (filtrée par la RLS).
REVOKE ALL ON TABLE public.prospect_client_claims FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.prospect_client_claims TO authenticated;
GRANT ALL ON TABLE public.prospect_client_claims TO service_role;

COMMENT ON TABLE public.prospect_client_claims IS
  'Fiches « À vérifier » : un numéro saisi par un commercial est déjà celui d''un client Bonzini. Lue par la direction (canManageSales) seulement ; écrite par prospect_create / prospect_update / prospect_resolve_claim.';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Règles communes (internes)
-- ─────────────────────────────────────────────────────────────────────────
-- Ce numéro est-il pris ? Même signature qu'au 06/10, une réponse de plus :
--   'own_client' : celui d'un client dont l'origine est CETTE fiche commercial ;
--   'client'     : celui d'un AUTRE client Bonzini (la fiche partira « À vérifier ») ;
--   'mine'       : suivi par un autre prospect de cette fiche (ouvert ou à vérifier) ;
--   'other'      : suivi par un prospect d'une autre fiche (ouvert ou à vérifier) ;
--   NULL         : libre. p_except : le prospect qu'on modifie.
-- Un numéro de client déjà saisi dans la liste du même commercial répond
-- 'mine' (pas de seconde fiche « à vérifier » pour le même client).
CREATE OR REPLACE FUNCTION public._prospect_number_conflict(p_e164 TEXT, p_source_id UUID, p_except UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cl AS (
    SELECT c.source_id FROM public.clients c WHERE c.phone_e164 = p_e164
    UNION ALL
    SELECT c.source_id
      FROM public.client_phones cp JOIN public.clients c ON c.id = cp.client_id
     WHERE cp.phone_e164 = p_e164
  ), h AS (
    SELECT p.source_id
      FROM public.prospects p
     WHERE p.phone_e164 = p_e164
       AND p.status IN ('new','contacted','interested','to_verify')
       AND p.id IS DISTINCT FROM p_except
    UNION ALL
    SELECT p.source_id
      FROM public.prospect_phones pp
      JOIN public.prospects p ON p.id = pp.prospect_id
     WHERE pp.phone_e164 = p_e164
       AND p.status IN ('new','contacted','interested','to_verify')
       AND p.id IS DISTINCT FROM p_except
  )
  SELECT CASE
           WHEN EXISTS (SELECT 1 FROM cl WHERE cl.source_id = p_source_id) THEN 'own_client'
           WHEN EXISTS (SELECT 1 FROM cl) THEN
             CASE WHEN EXISTS (SELECT 1 FROM h WHERE h.source_id = p_source_id) THEN 'mine' ELSE 'client' END
           WHEN EXISTS (SELECT 1 FROM h WHERE h.source_id IS DISTINCT FROM p_source_id) THEN 'other'
           WHEN EXISTS (SELECT 1 FROM h) THEN 'mine'
         END
$$;

-- Le premier des numéros donnés qui est REFUSÉ, dit en clair ; NULL si aucun.
-- p_client_ok : le numéro d'un autre client n'est pas un refus (saisie d'un
-- commercial : la fiche part « À vérifier ») ; il l'est pour rouvrir un
-- prospect perdu.
CREATE OR REPLACE FUNCTION public._prospect_numbers_refusal(p_numbers TEXT[], p_source_id UUID, p_except UUID, p_client_ok BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n TEXT;
  v_c TEXT;
BEGIN
  FOREACH v_n IN ARRAY coalesce(p_numbers, ARRAY[]::TEXT[]) LOOP
    v_c := public._prospect_number_conflict(v_n, p_source_id, p_except);
    IF v_c = 'own_client' THEN
      RETURN 'Le numéro ' || v_n || ' est déjà celui d''un de vos clients';
    ELSIF v_c = 'client' AND NOT coalesce(p_client_ok, false) THEN
      RETURN 'Le numéro ' || v_n || ' est déjà celui d''un client Bonzini';
    ELSIF v_c = 'other' THEN
      RETURN 'Le numéro ' || v_n || ' est déjà suivi par un autre commercial';
    ELSIF v_c = 'mine' THEN
      RETURN 'Le numéro ' || v_n || ' est déjà dans votre liste';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

-- Même signature qu'au 06/10 (rouvrir un prospect perdu) : le numéro d'un
-- client y reste un refus.
CREATE OR REPLACE FUNCTION public._prospect_numbers_error(p_numbers TEXT[], p_source_id UUID, p_except UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public._prospect_numbers_refusal(p_numbers, p_source_id, p_except, false)
$$;

-- Les clients reconnus par ces numéros (principal OU autre numéro du
-- client), un par client, avec le premier numéro saisi qui l'a reconnu ;
-- jamais les clients de la fiche p_source_id (ceux-là sont refusés plus haut).
CREATE OR REPLACE FUNCTION public._prospect_client_matches(p_numbers TEXT[], p_source_id UUID)
RETURNS TABLE (client_user_id UUID, matched_phone TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.user_id, m.phone
    FROM (
      SELECT DISTINCT ON (x.user_id) x.user_id, x.phone, x.ord
        FROM (
          SELECT c.user_id, c.source_id, n.phone, n.ord
            FROM unnest(coalesce(p_numbers, ARRAY[]::TEXT[])) WITH ORDINALITY AS n(phone, ord)
            JOIN public.clients c ON c.phone_e164 = n.phone
          UNION ALL
          SELECT c.user_id, c.source_id, n.phone, n.ord
            FROM unnest(coalesce(p_numbers, ARRAY[]::TEXT[])) WITH ORDINALITY AS n(phone, ord)
            JOIN public.client_phones cp ON cp.phone_e164 = n.phone
            JOIN public.clients c ON c.id = cp.client_id
        ) x
       WHERE x.user_id IS NOT NULL
         AND x.source_id IS DISTINCT FROM p_source_id
       ORDER BY x.user_id, x.ord
    ) m
   ORDER BY m.ord, m.user_id
$$;

-- Notification ciblée : les téléphones d'UNE personne du personnel (active),
-- sur le modèle de send_staff_push. Interne ; ne fait JAMAIS échouer
-- l'opération métier (une notification ratée se lit dans les journaux).
CREATE OR REPLACE FUNCTION public.send_staff_push_user(p_user_id UUID, p_title TEXT, p_body TEXT, p_path TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_msgs JSONB;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 0;
  END IF;
  SELECT jsonb_agg(jsonb_build_object(
           'to', d.expo_token,
           'title', p_title,
           'body', p_body,
           'data', jsonb_build_object('path', p_path),
           'sound', 'default',
           'priority', 'high',
           'channelId', 'default'))
    INTO v_msgs
    FROM public.staff_push_devices d
   WHERE d.user_id = p_user_id
     AND EXISTS (SELECT 1 FROM public.user_roles r
                  WHERE r.user_id = d.user_id AND (r.is_disabled = false OR r.is_disabled IS NULL));
  IF v_msgs IS NULL THEN
    RETURN 0;
  END IF;
  -- Une personne a quelques téléphones : bien moins que les 100 messages
  -- qu'accepte une requête à l'API Expo.
  PERFORM net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := v_msgs,
    headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb,
    timeout_milliseconds := 5000
  );
  RETURN jsonb_array_length(v_msgs);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'send_staff_push_user: %', SQLERRM;
  RETURN 0;
END;
$$;

-- Ouvre (ou rouvre) une vérification par client reconnu, puis prévient le
-- super admin s'il y a du nouveau. Appelée APRÈS l'écriture de la fiche, une
-- fois tout validé. Renvoie le nombre de vérifications ouvertes.
CREATE OR REPLACE FUNCTION public._prospect_claim_clients(p_prospect_id UUID, p_numbers TEXT[], p_source_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n INTEGER;
  v_phone TEXT;
  v_p public.prospects;
  v_label TEXT;
BEGIN
  WITH ins AS (
    INSERT INTO public.prospect_client_claims AS k (prospect_id, client_user_id, matched_phone, created_by)
    SELECT p_prospect_id, m.client_user_id, m.matched_phone, auth.uid()
      FROM public._prospect_client_matches(p_numbers, p_source_id) m
    ON CONFLICT (prospect_id, client_user_id) DO UPDATE
       SET status = 'pending', matched_phone = EXCLUDED.matched_phone, created_at = now(),
           created_by = EXCLUDED.created_by, resolved_at = NULL, resolved_by = NULL, note = NULL
     WHERE k.status <> 'pending'
    RETURNING k.id
  )
  SELECT count(*)::int INTO v_n FROM ins;

  IF v_n > 0 THEN
    BEGIN
      SELECT m.matched_phone INTO v_phone FROM public._prospect_client_matches(p_numbers, p_source_id) m LIMIT 1;
      SELECT * INTO v_p FROM public.prospects WHERE id = p_prospect_id;
      SELECT label INTO v_label FROM public.client_sources WHERE id = v_p.source_id;
      PERFORM public.send_staff_push('canManageSales', 'Numéro déjà client',
        coalesce(v_label, 'Un commercial') || ' a saisi ' || btrim(v_p.first_name || ' ' || coalesce(v_p.last_name, ''))
          || ' (' || v_phone || ') : déjà client Bonzini — à vérifier',
        '/m/equipe/ventes/a-verifier', ARRAY['super_admin'], auth.uid());
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '_prospect_claim_clients (notification) : %', SQLERRM;
    END;
  END IF;
  RETURN v_n;
END;
$$;

-- Une fiche « À vérifier » qui n'attend plus AUCUNE vérification sur un
-- client existant (le commercial a retiré ou corrigé le numéro ; le compte du
-- client a été supprimé) ne reste pas figée : ses vérifications encore « en
-- attente » sont closes, ses numéros revérifiés comme pour rouvrir une fiche
-- perdue, puis elle redevient « À contacter » — ou « Perdu » si l'un d'eux
-- est celui d'un client, ou suivi ailleurs. Renvoie le nouveau statut, NULL
-- si la fiche ne change pas. p_notify : prévenir le commercial (quand ce
-- n'est pas lui qui agit). Appelée sous le verrou de la fiche ou le prend.
CREATE OR REPLACE FUNCTION public._prospect_release_if_unclaimed(p_prospect_id UUID, p_notify BOOLEAN DEFAULT false)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.prospects;
  v_numbers TEXT[];
  v_n TEXT;
  v_c TEXT;
  v_conflict TEXT;
  v_status TEXT := 'new';
  v_reason TEXT;
BEGIN
  SELECT * INTO v_p FROM public.prospects WHERE id = p_prospect_id FOR UPDATE;
  IF NOT FOUND OR v_p.status <> 'to_verify' THEN
    RETURN NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM public.prospect_client_claims k
               JOIN public.clients c ON c.user_id = k.client_user_id
              WHERE k.prospect_id = p_prospect_id AND k.status = 'pending') THEN
    RETURN NULL;
  END IF;

  -- Ce qui reste « en attente » vise un compte qui n'existe plus.
  UPDATE public.prospect_client_claims
     SET status = 'rejected', resolved_at = now(), resolved_by = auth.uid(), note = 'Compte client supprimé'
   WHERE prospect_id = p_prospect_id AND status = 'pending';

  -- Ses numéros, verrouillés puis revérifiés (comme une réouverture).
  SELECT v_p.phone_e164 || coalesce(array_agg(pp.phone_e164 ORDER BY pp.position, pp.created_at), ARRAY[]::TEXT[])
    INTO v_numbers
    FROM public.prospect_phones pp WHERE pp.prospect_id = p_prospect_id;
  PERFORM public._prospect_lock_numbers(v_numbers);
  FOREACH v_n IN ARRAY v_numbers LOOP
    v_c := public._prospect_number_conflict(v_n, v_p.source_id, p_prospect_id);
    IF v_c IS NOT NULL THEN
      v_conflict := v_c;
      EXIT;
    END IF;
  END LOOP;
  IF v_conflict IS NOT NULL THEN
    v_status := 'lost';
    v_reason := CASE v_conflict
                  WHEN 'own_client' THEN 'Déjà un de vos clients'
                  WHEN 'client'     THEN 'Déjà client de Bonzini'
                  WHEN 'mine'       THEN 'Doublon d''un autre de vos prospects'
                  ELSE 'Déjà suivi par un autre commercial' END;
  END IF;

  BEGIN
    UPDATE public.prospects
       SET status = v_status, lost_reason = v_reason, status_changed_at = now(), updated_at = now()
     WHERE id = p_prospect_id;
  EXCEPTION WHEN unique_violation THEN
    -- Son numéro principal est repris par un prospect ouvert (index des numéros suivis).
    v_status := 'lost';
    v_reason := 'Déjà suivi par un autre commercial';
    UPDATE public.prospects
       SET status = v_status, lost_reason = v_reason, status_changed_at = now(), updated_at = now()
     WHERE id = p_prospect_id;
  END;

  IF coalesce(p_notify, false) THEN
    PERFORM public.send_staff_push_user(
      (SELECT staff_user_id FROM public.client_sources WHERE id = v_p.source_id),
      CASE WHEN v_status = 'new' THEN 'Fiche rouverte' ELSE 'Fiche classée' END,
      btrim(v_p.first_name || ' ' || coalesce(v_p.last_name, ''))
        || CASE WHEN v_status = 'new' THEN ' : la vérification est close, la fiche est de nouveau à contacter'
                ELSE ' : vérification close, fiche classée (' || v_reason || ')' END,
      '/v/prospects/' || p_prospect_id);
  END IF;
  RETURN v_status;
END;
$$;

-- Ce qui empêche de repasser un client en prospect, en clair (vide = rien).
-- « Aucune transaction » au sens large : la moindre trace d'activité bloque.
CREATE OR REPLACE FUNCTION public._client_prospect_blockers(p_user_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b TEXT[] := ARRAY[]::TEXT[];
  v_client public.clients;
  v_n BIGINT;
  v_bal BIGINT;
  v_od BIGINT;
  r RECORD;
BEGIN
  SELECT * INTO v_client FROM public.clients WHERE user_id = p_user_id;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id) THEN
    v_b := v_b || 'Compte du personnel, pas un client'::TEXT;
  END IF;

  -- L'argent : dépôts (tous statuts), paiements, grand livre, ajustements, solde, découvert.
  SELECT count(*) INTO v_n FROM public.deposits WHERE user_id = p_user_id;
  IF v_n > 0 THEN v_b := v_b || (v_n || ' ' || CASE WHEN v_n > 1 THEN 'dépôts' ELSE 'dépôt' END); END IF;
  SELECT count(*) INTO v_n FROM public.payments WHERE user_id = p_user_id;
  IF v_n > 0 THEN v_b := v_b || (v_n || ' ' || CASE WHEN v_n > 1 THEN 'paiements' ELSE 'paiement' END); END IF;
  SELECT count(*) INTO v_n FROM public.ledger_entries WHERE user_id = p_user_id;
  IF v_n > 0 THEN v_b := v_b || (v_n || ' ' || CASE WHEN v_n > 1 THEN 'écritures au grand livre' ELSE 'écriture au grand livre' END); END IF;
  SELECT count(*) INTO v_n FROM public.wallet_adjustments WHERE user_id = p_user_id;
  IF v_n > 0 THEN v_b := v_b || (v_n || ' ' || CASE WHEN v_n > 1 THEN 'ajustements de solde' ELSE 'ajustement de solde' END); END IF;
  SELECT sum(balance_xaf), max(overdraft_limit_xaf) INTO v_bal, v_od FROM public.wallets WHERE user_id = p_user_id;
  IF coalesce(v_bal, 0) <> 0 THEN
    v_b := v_b || ('Solde de ' || replace(to_char(v_bal, 'FM999,999,999,999,999'), ',', ' ') || ' XAF');
  END IF;
  IF coalesce(v_od, 0) > 0 THEN
    v_b := v_b || ('Découvert accordé (' || replace(to_char(v_od, 'FM999,999,999,999,999'), ',', ' ') || ' XAF)');
  END IF;

  -- Colis, cargo, douane : lus seulement si la table (et sa colonne) existe.
  FOR r IN
    SELECT * FROM (VALUES
      ('payment_batches',          'user_id',        false, 'lot de paiements',                       'lots de paiements'),
      ('parcel_deposits',          'client_user_id', false, 'dépôt de colis',                         'dépôts de colis'),
      ('parcel_releases',          'client_user_id', false, 'bon de retrait de colis',                'bons de retrait de colis'),
      ('cargo_shipments',          'client_id',      true,  'conteneur à son nom',                    'conteneurs à son nom'),
      ('cargo_packages',           'client_id',      true,  'lot de marchandise en conteneur',        'lots de marchandise en conteneur'),
      ('customs_classifications',  'client_user_id', false, 'classement en douane',                   'classements en douane'),
      ('customs_audits',           'client_user_id', false, 'audit de déclaration en douane',         'audits de déclaration en douane'),
      ('customs_supplier_invites', 'client_user_id', false, 'demande de documents à un fournisseur',  'demandes de documents à des fournisseurs')
    ) AS t(tbl, col, by_client_id, one, many)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_attribute a
                WHERE a.attrelid = to_regclass('public.' || r.tbl) AND a.attname = r.col
                  AND a.attnum > 0 AND NOT a.attisdropped) THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = $1', r.tbl, r.col)
        INTO v_n
        USING CASE WHEN r.by_client_id THEN v_client.id ELSE p_user_id END;
      IF v_n > 0 THEN
        v_b := v_b || (v_n || ' ' || CASE WHEN v_n > 1 THEN r.many ELSE r.one END);
      END IF;
    END IF;
  END LOOP;

  -- Une fiche « à vérifier » d'un commercial attend une décision sur ce client.
  SELECT count(*) INTO v_n
    FROM public.prospect_client_claims k
    JOIN public.prospects p ON p.id = k.prospect_id
   WHERE k.client_user_id = p_user_id AND k.status = 'pending' AND p.status = 'to_verify';
  IF v_n = 1 THEN
    v_b := v_b || 'Une fiche « À vérifier » d''un commercial attend votre décision sur ce client'::TEXT;
  ELSIF v_n > 1 THEN
    v_b := v_b || (v_n || ' fiches « À vérifier » de commerciaux attendent votre décision sur ce client');
  END IF;

  -- Le prospect a besoin d'un numéro principal au format international.
  IF v_client.user_id IS NOT NULL
     AND coalesce(public._phone_e164(v_client.phone_e164), public._phone_e164(v_client.phone)) IS NULL THEN
    v_b := v_b || 'Numéro principal absent ou sans indicatif (+237…) : corrigez-le d''abord'::TEXT;
  END IF;

  RETURN v_b;
END;
$$;

-- Ce que la suppression du compte efface AUSSI et que les blocages ne
-- retiennent pas (ce ne sont pas des opérations), recensé d'après les clés
-- étrangères (ON DELETE CASCADE vers auth.users ou clients) et
-- admin_delete_client :
--   · beneficiaries        ses bénéficiaires (comptes de ses fournisseurs :
--                          Alipay, WeChat, banque) — lignes complètes ;
--   · chat_conversations + chat_messages   ses échanges avec le support —
--                          conversations et messages complets (les images
--                          restent dans le stockage : leur adresse est gardée),
--                          plus un résumé (support) pour l'écran ;
--   · auth.users / identities   son compte de connexion : email, téléphone,
--                          dates, moyens de connexion (jamais le mot de passe) ;
--   · prospect_client_claims    les décisions déjà prises sur lui (fiches
--                          « À vérifier » tranchées).
-- La fiche clients entière et ses numéros sont pris par l'appelant. Le reste
-- ne se garde pas : opérations (bloquantes, donc absentes), portefeuille à
-- zéro (bloquant sinon), notifications, vérifications de numéro par SMS,
-- clés d'accès (passkeys) — technique, sans valeur une fois le compte parti.
-- Les dossiers de douane sont bloquants ; les documents des fournisseurs
-- n'existent pas sans dossier. Chaque partie n'est lue que si sa table (et
-- ses colonnes) existe.
CREATE OR REPLACE FUNCTION public._client_erasable_data(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID;
  v_benef JSONB := '[]'::jsonb;
  v_support JSONB := jsonb_build_object('conversations', 0, 'messages', 0);
  v_convs JSONB := '[]'::jsonb;
  v_account JSONB;
  v_claims JSONB := '[]'::jsonb;
BEGIN
  SELECT id INTO v_client_id FROM public.clients WHERE user_id = p_user_id;
  BEGIN
    EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(b)), ''[]''::jsonb) FROM public.beneficiaries b WHERE b.client_id = $1'
      INTO v_benef USING p_user_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    v_benef := '[]'::jsonb;
  END;
  IF v_client_id IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT jsonb_build_object(''conversations'', count(DISTINCT c.id), ''messages'', count(m.id),
                                        ''first_message_at'', min(m.created_at), ''last_message_at'', max(m.created_at))
                 FROM public.chat_conversations c LEFT JOIN public.chat_messages m ON m.conversation_id = c.id
                WHERE c.client_id = $1'
        INTO v_support USING v_client_id;
      EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object(''messages'',
                        coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.created_at, m.id)
                                    FROM public.chat_messages m WHERE m.conversation_id = c.id), ''[]''::jsonb))
                      ORDER BY c.id), ''[]''::jsonb)
                 FROM public.chat_conversations c WHERE c.client_id = $1'
        INTO v_convs USING v_client_id;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      v_support := jsonb_build_object('conversations', 0, 'messages', 0);
      v_convs := '[]'::jsonb;
    END;
  END IF;
  -- Le compte de connexion : quelques champs choisis (pas de secret).
  BEGIN
    SELECT jsonb_build_object('email', u.j -> 'email', 'phone', u.j -> 'phone',
                              'created_at', u.j -> 'created_at', 'last_sign_in_at', u.j -> 'last_sign_in_at',
                              'email_confirmed_at', u.j -> 'email_confirmed_at',
                              'providers', (SELECT coalesce(jsonb_agg(DISTINCT i.provider), '[]'::jsonb)
                                              FROM auth.identities i WHERE i.user_id = p_user_id))
      INTO v_account
      FROM (SELECT to_jsonb(au) AS j FROM auth.users au WHERE au.id = p_user_id) u;
  EXCEPTION WHEN undefined_table OR undefined_column OR insufficient_privilege THEN
    v_account := NULL;
  END;
  SELECT coalesce(jsonb_agg(to_jsonb(k) ORDER BY k.created_at, k.id), '[]'::jsonb)
    INTO v_claims
    FROM public.prospect_client_claims k WHERE k.client_user_id = p_user_id;
  RETURN jsonb_build_object('beneficiaries', v_benef, 'support', v_support, 'support_conversations', v_convs,
                            'account', v_account, 'prospect_claims', v_claims);
END;
$$;

-- Pour l'écran : ce qui sera effacé avec le compte sans bloquer (ce ne sont
-- pas des opérations), en clair, pour que la direction décide en
-- connaissance de cause. Vide = rien de tel.
CREATE OR REPLACE FUNCTION public._client_prospect_warnings(p_user_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_w TEXT[] := ARRAY[]::TEXT[];
  v_client JSONB;
  v_data JSONB := public._client_erasable_data(p_user_id);
  v_n BIGINT;
BEGIN
  SELECT to_jsonb(c) INTO v_client FROM public.clients c WHERE c.user_id = p_user_id;
  v_n := jsonb_array_length(v_data -> 'beneficiaries');
  IF v_n > 0 THEN
    v_w := v_w || (v_n || ' ' || CASE WHEN v_n > 1 THEN 'bénéficiaires enregistrés' ELSE 'bénéficiaire enregistré' END
                   || ' (comptes de ses fournisseurs)');
  END IF;
  v_n := coalesce((v_data -> 'support' ->> 'messages')::bigint, 0);
  IF coalesce((v_data -> 'support' ->> 'conversations')::bigint, 0) > 0 THEN
    v_w := v_w || ('Sa conversation avec le support'
                   || CASE WHEN v_n > 0 THEN ' (' || v_n || ' ' || CASE WHEN v_n > 1 THEN 'messages' ELSE 'message' END || ')' ELSE '' END);
  END IF;
  IF coalesce((v_client ->> 'kyc_verified')::boolean, false) THEN
    v_w := v_w || 'Son identité vérifiée (KYC)'::TEXT;
  END IF;
  IF length(btrim(coalesce(v_client ->> 'notes', ''))) > 0 THEN
    v_w := v_w || 'Les notes de l''équipe sur ce client'::TEXT;
  END IF;
  RETURN v_w;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Ajouter un prospect (même signature qu'au 06/10)
-- ─────────────────────────────────────────────────────────────────────────
-- Seul changement : le numéro (principal ou autre) d'un AUTRE client
-- Bonzini n'est plus refusé — la fiche part « À vérifier » et la direction
-- est prévenue ; celui d'un de SES clients est refusé.
CREATE OR REPLACE FUNCTION public.prospect_create(
  p_first_name TEXT,
  p_phone TEXT,
  p_last_name TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_next_action_at TIMESTAMPTZ DEFAULT NULL,
  p_interests TEXT[] DEFAULT NULL,
  p_source_id UUID DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_birth_date DATE DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phones JSONB DEFAULT NULL,
  p_pain_points TEXT DEFAULT NULL,
  p_help_needed TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_src UUID := public._sales_scope(p_source_id);
  v_e164 TEXT := public._phone_e164(p_phone);
  v_gender TEXT := upper(btrim(coalesce(p_gender, '')));
  v_email TEXT := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_pain TEXT := nullif(btrim(coalesce(p_pain_points, '')), '');
  v_help TEXT := nullif(btrim(coalesce(p_help_needed, '')), '');
  v_list JSONB;
  v_others TEXT[];
  v_conflict TEXT;
  v_err TEXT;
  v_to_verify BOOLEAN;
  v_id UUID;
BEGIN
  IF v_src IS NULL THEN
    RETURN public._sales_scope_error();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.client_sources WHERE id = v_src AND kind = 'commercial' AND is_active) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette fiche commercial est archivée ou introuvable');
  END IF;

  -- Qui : prénom, nom, sexe, ville — obligatoires.
  IF length(btrim(coalesce(p_first_name, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le prénom est requis');
  END IF;
  IF length(btrim(coalesce(p_last_name, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le nom est requis');
  END IF;
  IF v_gender NOT IN ('MALE', 'FEMALE') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le sexe : homme ou femme');
  END IF;
  IF length(btrim(coalesce(p_city, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'La ville est requise');
  END IF;
  -- Facultatifs, mais justes s'ils sont donnés.
  v_err := coalesce(public._birth_date_error(p_birth_date), public._email_error(v_email));
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_err);
  END IF;
  IF length(v_pain) > 2000 OR length(v_help) > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un champ est trop long');
  END IF;

  -- Les numéros : la forme d'abord, tous.
  IF v_e164 IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Numéro invalide : indiquez l''indicatif (+237…)');
  END IF;
  v_list := public._prospect_phone_list(p_phones, v_e164);
  IF v_list ? 'error' THEN
    RETURN jsonb_build_object('success', false, 'error', v_list ->> 'error');
  END IF;
  SELECT coalesce(array_agg(e ->> 'phone_e164' ORDER BY o), ARRAY[]::TEXT[])
    INTO v_others
    FROM jsonb_array_elements(v_list -> 'phones') WITH ORDINALITY AS t(e, o);

  -- Puis, verrouillés : le principal, puis les autres. Un refus (le numéro
  -- d'un de SES clients, déjà dans sa liste, suivi par un autre commercial)
  -- arrête tout ; le numéro d'un AUTRE client fait partir la fiche « À vérifier ».
  PERFORM public._prospect_lock_numbers(v_e164 || v_others);
  v_conflict := public._prospect_number_conflict(v_e164, v_src, NULL);
  IF v_conflict IS NOT NULL AND v_conflict <> 'client' THEN
    RETURN jsonb_build_object('success', false, 'error',
      CASE v_conflict WHEN 'own_client' THEN 'Le numéro ' || v_e164 || ' est déjà celui d''un de vos clients'
                      WHEN 'mine'       THEN 'Ce prospect est déjà dans votre liste'
                      ELSE 'Ce numéro est déjà suivi par un autre commercial' END);
  END IF;
  v_err := public._prospect_numbers_refusal(v_others, v_src, NULL, true);
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_err);
  END IF;
  v_to_verify := EXISTS (SELECT 1 FROM public._prospect_client_matches(v_e164 || v_others, v_src));

  -- Tout est bon : on écrit.
  INSERT INTO public.prospects (source_id, first_name, last_name, company, phone, phone_e164, city, interests, notes, next_action_at, created_by,
                                gender, birth_date, email, pain_points, help_needed, status)
  VALUES (v_src, btrim(p_first_name), btrim(p_last_name), nullif(btrim(coalesce(p_company, '')), ''),
          btrim(p_phone), v_e164, btrim(p_city),
          coalesce((SELECT array_agg(DISTINCT i) FROM unnest(p_interests) i WHERE i IN ('payments','air','sea')), '{}'),
          nullif(btrim(coalesce(p_notes, '')), ''), p_next_action_at, v_uid,
          v_gender, p_birth_date, v_email, v_pain, v_help,
          CASE WHEN v_to_verify THEN 'to_verify' ELSE 'new' END)
  RETURNING id INTO v_id;

  INSERT INTO public.prospect_phones (prospect_id, phone_e164, country_iso, label, position)
  SELECT v_id, e ->> 'phone_e164', e ->> 'country_iso', e ->> 'label', o
    FROM jsonb_array_elements(v_list -> 'phones') WITH ORDINALITY AS t(e, o);

  IF v_to_verify THEN
    PERFORM public._prospect_claim_clients(v_id, v_e164 || v_others, v_src);
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id, 'to_verify', v_to_verify);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est déjà suivi par un commercial');
  WHEN check_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un champ est trop long');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Modifier un prospect (même signature qu'au 06/10)
-- ─────────────────────────────────────────────────────────────────────────
-- Seuls les numéros NOUVEAUX pour la fiche sont vérifiés (comme au 06/10).
-- L'un d'eux est celui d'un autre client : la fiche passe « À vérifier »
-- (sauf « devenu client », figé comme avant) et la direction est prévenue.
-- Une fiche « À vérifier » dont le commercial retire ou corrige le numéro
-- d'un client : la vérification de ce client est close (sinon une faute de
-- frappe corrigée pourrait encore lui faire attribuer un client sans
-- rapport) ; s'il n'en reste aucune, la fiche sort de « À vérifier »
-- (_prospect_release_if_unclaimed). La réponse dit le statut FINAL :
-- to_verify (la fiche attend la direction), status, notified (une
-- vérification vient d'être ouverte : la direction est prévenue), released
-- (la fiche vient de sortir de « À vérifier »).
CREATE OR REPLACE FUNCTION public.prospect_update(
  p_id UUID,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_next_action_at TIMESTAMPTZ DEFAULT NULL,
  p_clear_next_action BOOLEAN DEFAULT false,
  p_interests TEXT[] DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_birth_date DATE DEFAULT NULL,
  p_clear_birth_date BOOLEAN DEFAULT false,
  p_email TEXT DEFAULT NULL,
  p_phones JSONB DEFAULT NULL,
  p_pain_points TEXT DEFAULT NULL,
  p_help_needed TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.prospects;
  v_e164 TEXT;
  v_email TEXT := CASE WHEN p_email IS NULL THEN NULL ELSE nullif(lower(btrim(p_email)), '') END;
  v_clear_birth BOOLEAN := coalesce(p_clear_birth_date, false);
  v_current TEXT[];
  v_existing TEXT[];
  v_others TEXT[];
  v_new_others TEXT[];
  v_new_numbers TEXT[];
  v_list JSONB;
  v_conflict TEXT;
  v_err TEXT;
  v_to_verify BOOLEAN := false;
  v_notified BOOLEAN := false;
  v_after TEXT[];
  v_released TEXT;
  v_final TEXT;
BEGIN
  -- Verrouillée AVANT d'être lue : deux modifications simultanées passent l'une après l'autre.
  SELECT * INTO v_p FROM public.prospects WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR public._sales_scope(v_p.source_id) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Prospect introuvable');
  END IF;

  IF p_first_name IS NOT NULL AND btrim(p_first_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le prénom est requis');
  END IF;
  IF p_last_name IS NOT NULL AND btrim(p_last_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le nom est requis');
  END IF;
  IF p_gender IS NOT NULL AND upper(btrim(p_gender)) NOT IN ('MALE', 'FEMALE') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le sexe : homme ou femme');
  END IF;
  IF p_city IS NOT NULL AND btrim(p_city) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La ville est requise');
  END IF;
  v_err := coalesce(CASE WHEN v_clear_birth THEN NULL ELSE public._birth_date_error(p_birth_date) END,
                    public._email_error(v_email));
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_err);
  END IF;
  IF length(btrim(coalesce(p_pain_points, ''))) > 2000 OR length(btrim(coalesce(p_help_needed, ''))) > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un champ est trop long');
  END IF;

  -- Ses numéros d'avant : le principal, puis les autres.
  SELECT coalesce(array_agg(phone_e164 ORDER BY position, created_at), ARRAY[]::TEXT[])
    INTO v_current
    FROM public.prospect_phones WHERE prospect_id = p_id;
  v_existing := v_p.phone_e164 || v_current;

  -- Le principal.
  v_e164 := v_p.phone_e164;
  IF p_phone IS NOT NULL AND public._phone_e164(p_phone) IS DISTINCT FROM v_p.phone_e164 THEN
    IF v_p.status = 'won' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce prospect est devenu client : ses numéros ne changent plus ici');
    END IF;
    v_e164 := public._phone_e164(p_phone);
    IF v_e164 IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Numéro invalide : indiquez l''indicatif (+237…)');
    END IF;
  END IF;

  -- Les autres (liste complète), s'ils sont envoyés.
  IF p_phones IS NOT NULL THEN
    v_list := public._prospect_phone_list(p_phones, v_e164);
    IF v_list ? 'error' THEN
      RETURN jsonb_build_object('success', false, 'error', v_list ->> 'error');
    END IF;
    SELECT coalesce(array_agg(e ->> 'phone_e164' ORDER BY o), ARRAY[]::TEXT[])
      INTO v_others
      FROM jsonb_array_elements(v_list -> 'phones') WITH ORDINALITY AS t(e, o);
    -- Devenu client : la même liste (libellés et ordre mis à part) est acceptée, pas une autre.
    IF v_p.status = 'won'
       AND ARRAY(SELECT x FROM unnest(v_others) x ORDER BY x) IS DISTINCT FROM ARRAY(SELECT x FROM unnest(v_current) x ORDER BY x) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce prospect est devenu client : ses numéros ne changent plus ici');
    END IF;
  END IF;

  -- Seuls les numéros NOUVEAUX pour cette fiche sont vérifiés, après verrou.
  -- Une fiche « À vérifier » peut en sortir (plus bas) : tous ses numéros
  -- sont alors revérifiés — verrouillés ici, d'un coup et dans l'ordre (pas
  -- d'interblocage avec une saisie simultanée).
  v_new_others := ARRAY(SELECT n FROM unnest(coalesce(v_others, ARRAY[]::TEXT[])) n WHERE NOT n = ANY(v_existing));
  v_new_numbers := CASE WHEN v_e164 = ANY(v_existing) THEN ARRAY[]::TEXT[] ELSE ARRAY[v_e164] END || v_new_others;
  PERFORM public._prospect_lock_numbers(v_new_numbers || CASE WHEN v_p.status = 'to_verify' THEN v_existing ELSE ARRAY[]::TEXT[] END);
  IF NOT v_e164 = ANY(v_existing) THEN
    v_conflict := public._prospect_number_conflict(v_e164, v_p.source_id, p_id);
    IF v_conflict IS NOT NULL AND v_conflict <> 'client' THEN
      RETURN jsonb_build_object('success', false, 'error',
        CASE v_conflict WHEN 'own_client' THEN 'Le numéro ' || v_e164 || ' est déjà celui d''un de vos clients'
                        WHEN 'mine'       THEN 'Ce numéro est déjà dans votre liste'
                        ELSE 'Ce numéro est déjà suivi par un autre commercial' END);
    END IF;
  END IF;
  v_err := public._prospect_numbers_refusal(v_new_others, v_p.source_id, p_id, true);
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_err);
  END IF;
  v_to_verify := v_p.status <> 'won'
                 AND EXISTS (SELECT 1 FROM public._prospect_client_matches(v_new_numbers, v_p.source_id));

  -- Tout est bon : on écrit.
  UPDATE public.prospects
     SET first_name  = coalesce(btrim(p_first_name), first_name),
         last_name   = CASE WHEN p_last_name IS NULL THEN last_name ELSE btrim(p_last_name) END,
         company     = CASE WHEN p_company IS NULL THEN company ELSE nullif(btrim(p_company), '') END,
         city        = CASE WHEN p_city IS NULL THEN city ELSE btrim(p_city) END,
         notes       = CASE WHEN p_notes IS NULL THEN notes ELSE nullif(btrim(p_notes), '') END,
         phone       = CASE WHEN p_phone IS NULL THEN phone ELSE btrim(p_phone) END,
         phone_e164  = v_e164,
         interests   = CASE WHEN p_interests IS NULL THEN interests
                            ELSE coalesce((SELECT array_agg(DISTINCT i) FROM unnest(p_interests) i WHERE i IN ('payments','air','sea')), '{}') END,
         next_action_at = CASE WHEN p_clear_next_action THEN NULL ELSE coalesce(p_next_action_at, next_action_at) END,
         gender      = CASE WHEN p_gender IS NULL THEN gender ELSE upper(btrim(p_gender)) END,
         birth_date  = CASE WHEN v_clear_birth THEN NULL ELSE coalesce(p_birth_date, birth_date) END,
         email       = CASE WHEN p_email IS NULL THEN email ELSE v_email END,
         pain_points = CASE WHEN p_pain_points IS NULL THEN pain_points ELSE nullif(btrim(p_pain_points), '') END,
         help_needed = CASE WHEN p_help_needed IS NULL THEN help_needed ELSE nullif(btrim(p_help_needed), '') END,
         status      = CASE WHEN v_to_verify THEN 'to_verify' ELSE status END,
         lost_reason = CASE WHEN v_to_verify THEN NULL ELSE lost_reason END,
         status_changed_at = CASE WHEN v_to_verify AND status <> 'to_verify' THEN now() ELSE status_changed_at END,
         updated_at  = now()
   WHERE id = p_id;

  IF p_phones IS NOT NULL THEN
    DELETE FROM public.prospect_phones WHERE prospect_id = p_id;
    INSERT INTO public.prospect_phones (prospect_id, phone_e164, country_iso, label, position)
    SELECT p_id, e ->> 'phone_e164', e ->> 'country_iso', e ->> 'label', o
      FROM jsonb_array_elements(v_list -> 'phones') WITH ORDINALITY AS t(e, o);
  ELSIF v_e164 IS DISTINCT FROM v_p.phone_e164 THEN
    -- Un autre numéro devenu le principal ne reste pas en double dans la liste.
    DELETE FROM public.prospect_phones WHERE prospect_id = p_id AND phone_e164 = v_e164;
  END IF;

  IF v_to_verify THEN
    v_notified := public._prospect_claim_clients(p_id, v_new_numbers, v_p.source_id) > 0;
  END IF;

  -- Une vérification dont le client n'a plus AUCUN des numéros de la fiche
  -- (le commercial a retiré ou corrigé le sien) est close ; plus aucune en
  -- attente : la fiche sort de « À vérifier ».
  IF v_p.status = 'to_verify' THEN
    SELECT v_e164 || coalesce(array_agg(pp.phone_e164 ORDER BY pp.position, pp.created_at), ARRAY[]::TEXT[])
      INTO v_after
      FROM public.prospect_phones pp WHERE pp.prospect_id = p_id;
    UPDATE public.prospect_client_claims k
       SET status = 'rejected', resolved_at = now(), resolved_by = auth.uid(), note = 'Numéro retiré par le commercial'
     WHERE k.prospect_id = p_id AND k.status = 'pending'
       AND EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = k.client_user_id)
       AND NOT EXISTS (SELECT 1 FROM public.clients c
                        WHERE c.user_id = k.client_user_id
                          AND (c.phone_e164 = ANY (v_after)
                               OR EXISTS (SELECT 1 FROM public.client_phones cp
                                           WHERE cp.client_id = c.id AND cp.phone_e164 = ANY (v_after))));
    v_released := public._prospect_release_if_unclaimed(p_id, false);
  END IF;

  SELECT status INTO v_final FROM public.prospects WHERE id = p_id;
  RETURN jsonb_build_object('success', true, 'to_verify', v_final = 'to_verify', 'status', v_final,
                            'notified', v_notified, 'released', v_released IS NOT NULL);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est déjà suivi par un commercial');
  WHEN check_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un champ est trop long');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Statut : une fiche « À vérifier » attend la direction
-- ─────────────────────────────────────────────────────────────────────────
-- Même fonction qu'au 06/10. En plus : tant qu'une vérification est en
-- attente, le commercial ne change pas le statut. Si plus aucune ne l'est
-- (le client a été supprimé entre-temps), la fiche se rouvre comme une
-- fiche perdue : ses numéros sont revérifiés.
CREATE OR REPLACE FUNCTION public.prospect_set_status(p_id UUID, p_status TEXT, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.prospects;
  v_reason TEXT := nullif(btrim(coalesce(p_reason, '')), '');
  v_others TEXT[];
  v_conflict TEXT;
  v_err TEXT;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('new','contacted','interested','lost') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Statut inconnu');
  END IF;
  SELECT * INTO v_p FROM public.prospects WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR public._sales_scope(v_p.source_id) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Prospect introuvable');
  END IF;
  IF v_p.status = 'won' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce prospect est déjà devenu client');
  END IF;
  IF v_p.status = 'to_verify'
     AND EXISTS (SELECT 1 FROM public.prospect_client_claims k
                   JOIN public.clients c ON c.user_id = k.client_user_id
                  WHERE k.prospect_id = p_id AND k.status = 'pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette fiche attend la vérification de la direction');
  END IF;
  IF p_status = 'lost' AND (v_reason IS NULL OR length(v_reason) < 3) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dites en quelques mots pourquoi il est perdu');
  END IF;
  IF v_p.status IN ('lost', 'to_verify') AND p_status <> 'lost' THEN
    SELECT coalesce(array_agg(phone_e164 ORDER BY position, created_at), ARRAY[]::TEXT[])
      INTO v_others
      FROM public.prospect_phones WHERE prospect_id = p_id;
    PERFORM public._prospect_lock_numbers(v_p.phone_e164 || v_others);
    v_conflict := public._prospect_number_conflict(v_p.phone_e164, v_p.source_id, p_id);
    IF v_conflict = 'own_client' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est devenu celui d''un de vos clients');
    ELSIF v_conflict = 'client' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est devenu celui d''un client Bonzini');
    ELSIF v_conflict = 'mine' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est déjà celui d''un autre de vos prospects');
    ELSIF v_conflict IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est de nouveau suivi par un autre commercial');
    END IF;
    v_err := public._prospect_numbers_error(v_others, v_p.source_id, p_id);
    IF v_err IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', v_err);
    END IF;
  END IF;

  UPDATE public.prospects
     SET status = p_status,
         lost_reason = CASE WHEN p_status = 'lost' THEN v_reason ELSE NULL END,
         status_changed_at = CASE WHEN status = p_status THEN status_changed_at ELSE now() END,
         updated_at = now()
   WHERE id = p_id;
  -- Une vérification restée « en attente » sans client (compte supprimé) est close.
  IF v_p.status = 'to_verify' THEN
    UPDATE public.prospect_client_claims
       SET status = 'rejected', resolved_at = now(), resolved_by = auth.uid(), note = 'Compte client supprimé'
     WHERE prospect_id = p_id AND status = 'pending';
  END IF;
  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est de nouveau suivi par un autre commercial');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6 bis. Un client supprimé pendant une vérification : la fiche se libère
-- ─────────────────────────────────────────────────────────────────────────
-- « Supprimer le client » (admin_delete_client) efface la ligne clients,
-- puis le compte de connexion, qui emporte ses vérifications (cascade). Sans
-- ceci, la fiche resterait « À vérifier » sans plus rien à vérifier : absente
-- de la liste de la direction, figée chez le commercial (qui ne change pas
-- le statut d'une fiche « À vérifier »). Si le compte de connexion reste
-- (email non libéré), les vérifications restent, sans client.
-- Déclencheurs DIFFÉRÉS : ils jouent à la fin de la transaction, quand
-- toutes les cascades sont passées (leur ordre n'est pas garanti). Chaque
-- fiche concernée qui n'attend plus rien est libérée et son commercial
-- prévenu. Une erreur ici ne fait jamais échouer la suppression.
CREATE OR REPLACE FUNCTION public._clients_release_prospect_claims()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT k.prospect_id FROM public.prospect_client_claims k
     WHERE k.client_user_id = OLD.user_id AND k.status = 'pending'
     ORDER BY k.prospect_id
  LOOP
    PERFORM public._prospect_release_if_unclaimed(r.prospect_id, true);
  END LOOP;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '_clients_release_prospect_claims : %', SQLERRM;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public._prospect_claims_release()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._prospect_release_if_unclaimed(OLD.prospect_id, true);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '_prospect_claims_release : %', SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS clients_release_prospect_claims ON public.clients;
CREATE CONSTRAINT TRIGGER clients_release_prospect_claims
  AFTER DELETE ON public.clients
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public._clients_release_prospect_claims();

DROP TRIGGER IF EXISTS prospect_claims_release ON public.prospect_client_claims;
CREATE CONSTRAINT TRIGGER prospect_claims_release
  AFTER DELETE ON public.prospect_client_claims
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.status = 'pending')
  EXECUTE FUNCTION public._prospect_claims_release();

-- ─────────────────────────────────────────────────────────────────────────
-- 7. Rattacher un prospect à un client : pas une fiche « À vérifier »
-- ─────────────────────────────────────────────────────────────────────────
-- Même fonction qu'au 05/10, avec un refus de plus : une fiche « À
-- vérifier » se tranche par prospect_resolve_claim (sinon ses vérifications
-- resteraient « en attente » pour toujours).
CREATE OR REPLACE FUNCTION public.prospect_link_client(p_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_p public.prospects;
  v_client public.clients;
  v_attributed BOOLEAN := false;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageSales') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_p FROM public.prospects WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Prospect introuvable');
  END IF;
  IF v_p.status = 'won' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce prospect est déjà rattaché à un client');
  END IF;
  IF v_p.status = 'to_verify' THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Cette fiche est « À vérifier » : attribuez ou refusez le client depuis la liste à vérifier');
  END IF;
  SELECT * INTO v_client FROM public.clients WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;
  IF EXISTS (SELECT 1 FROM public.prospects WHERE converted_user_id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce client est déjà rattaché à un autre prospect');
  END IF;
  IF v_client.source_id IS NOT NULL AND v_client.source_id <> v_p.source_id
     AND NOT EXISTS (SELECT 1 FROM public.client_sources WHERE id = v_client.source_id AND is_system) THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Ce client est déjà attribué à une autre source : changez d''abord son origine');
  END IF;

  IF v_client.source_id IS DISTINCT FROM v_p.source_id THEN
    PERFORM set_config('bonzini.client_source_write', 'on', true);
    UPDATE public.clients SET source_id = v_p.source_id, source_set_at = now(), source_set_by = v_uid WHERE user_id = p_user_id;
    PERFORM set_config('bonzini.client_source_write', '', true);
    v_attributed := true;
  END IF;

  UPDATE public.prospects
     SET status = 'won', converted_user_id = p_user_id, converted_at = now(),
         status_changed_at = now(), lost_reason = NULL, updated_at = now()
   WHERE id = p_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'prospect_link_client', 'prospect', p_id,
          jsonb_build_object('client_user_id', p_user_id, 'source_id', v_p.source_id, 'attributed', v_attributed));
  RETURN jsonb_build_object('success', true, 'attributed', v_attributed);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce client est déjà rattaché à un autre prospect');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. « Ce numéro est-il libre ? » pendant la saisie
-- ─────────────────────────────────────────────────────────────────────────
-- Exactement ce que prospect_create dirait déjà, et RIEN sur l'identité du
-- client : free / client / own_client / mine (+ l'id de SON prospect) /
-- other / invalid. p_exclude_prospect_id : la fiche en cours de
-- modification (ses propres numéros ne comptent pas ; sa fiche commercial
-- sert de référence). Le commercial (sa fiche) ou la direction.
CREATE OR REPLACE FUNCTION public.prospect_phone_check(p_phone TEXT, p_exclude_prospect_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src UUID := public.current_commercial_source_id();
  v_e164 TEXT := public._phone_e164(p_phone);
  v_status TEXT;
  v_pid UUID;
BEGIN
  IF v_src IS NULL AND NOT public.admin_has_permission(auth.uid(), 'canManageSales') THEN
    RETURN public._sales_scope_error();
  END IF;
  IF p_exclude_prospect_id IS NOT NULL THEN
    SELECT source_id INTO v_src FROM public.prospects WHERE id = p_exclude_prospect_id;
    IF NOT FOUND OR public._sales_scope(v_src) IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Prospect introuvable');
    END IF;
  END IF;
  IF v_e164 IS NULL THEN
    RETURN jsonb_build_object('success', true, 'status', 'invalid');
  END IF;

  v_status := coalesce(public._prospect_number_conflict(v_e164, v_src, p_exclude_prospect_id), 'free');
  IF v_status = 'mine' THEN
    SELECT p.id INTO v_pid
      FROM public.prospects p
     WHERE p.source_id = v_src
       AND p.status IN ('new','contacted','interested','to_verify')
       AND p.id IS DISTINCT FROM p_exclude_prospect_id
       AND (p.phone_e164 = v_e164
            OR EXISTS (SELECT 1 FROM public.prospect_phones pp WHERE pp.prospect_id = p.id AND pp.phone_e164 = v_e164))
     ORDER BY (p.phone_e164 = v_e164) DESC, p.created_at
     LIMIT 1;
    RETURN jsonb_build_object('success', true, 'status', v_status, 'prospect_id', v_pid);
  END IF;
  RETURN jsonb_build_object('success', true, 'status', v_status);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Les fiches « À vérifier » qui attendent la direction
-- ─────────────────────────────────────────────────────────────────────────
-- Une ligne par vérification en attente : la fiche prospect complète (avec
-- ses autres numéros), le commercial (et si sa fiche est encore active : une
-- fiche archivée se confie d'abord à un autre), le numéro qui a reconnu le
-- client, la dernière fois que la direction a déjà refusé ce client à ce
-- commercial (previously_rejected_at, sur cette fiche ou une autre), et le
-- client (coordonnées, origine actuelle, activité) pour décider.
CREATE OR REPLACE FUNCTION public.prospect_claims_pending()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canManageSales') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'claim_id', k.id,
           'prospect', to_jsonb(p) || jsonb_build_object('phones', coalesce((
               SELECT jsonb_agg(jsonb_build_object('phone_e164', pp.phone_e164, 'country_iso', pp.country_iso,
                                                   'label', pp.label, 'position', pp.position)
                                ORDER BY pp.position, pp.created_at)
                 FROM public.prospect_phones pp WHERE pp.prospect_id = p.id), '[]'::jsonb)),
           'source_id', p.source_id,
           'source_label', s.label,
           'source_active', coalesce(s.is_active, false),
           'matched_phone', k.matched_phone,
           'created_at', k.created_at,
           'previously_rejected_at', (SELECT max(k2.direction_rejected_at)
                                        FROM public.prospect_client_claims k2
                                        JOIN public.prospects p2 ON p2.id = k2.prospect_id
                                       WHERE k2.client_user_id = k.client_user_id AND p2.source_id = p.source_id),
           'client', jsonb_build_object(
             'user_id', c.user_id,
             'name', coalesce(nullif(btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''), c.company_name, 'Client'),
             'company', c.company_name,
             'customer_code', c.customer_code,
             'phone_e164', c.phone_e164,
             -- L'adresse technique d'un compte « téléphone seul » n'en est pas une.
             'email', CASE WHEN lower(coalesce(c.email, '')) LIKE '%@bonzini-client.local' THEN NULL ELSE c.email END,
             'city', c.city,
             'created_at', c.created_at,
             'source_id', c.source_id,
             'source_label', cs.label,
             'source_kind', cs.kind,
             'deposits_count', (SELECT count(*) FROM public.deposits d WHERE d.user_id = c.user_id),
             'payments_count', (SELECT count(*) FROM public.payments y WHERE y.user_id = c.user_id),
             'last_activity_at', (SELECT max(t) FROM (
                 SELECT max(d.created_at) AS t FROM public.deposits d WHERE d.user_id = c.user_id
                 UNION ALL
                 SELECT max(y.created_at) FROM public.payments y WHERE y.user_id = c.user_id) a)
           )) ORDER BY k.created_at DESC, k.id), '[]'::jsonb)
    INTO v_rows
    FROM public.prospect_client_claims k
    JOIN public.prospects p ON p.id = k.prospect_id AND p.status = 'to_verify'
    JOIN public.client_sources s ON s.id = p.source_id
    JOIN public.clients c ON c.user_id = k.client_user_id
    LEFT JOIN public.client_sources cs ON cs.id = c.source_id
   WHERE k.status = 'pending';

  RETURN jsonb_build_object('success', true, 'rows', v_rows);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 10. La décision de la direction
-- ─────────────────────────────────────────────────────────────────────────
-- 'attribute' : le client (p_client_user_id, obligatoire si la fiche en a
--   reconnu plusieurs) devient celui du commercial du prospect : son origine
--   passe à cette fiche commercial, le prospect devient « devenu client ».
--   Un AUTRE prospect déjà « devenu client » de ce client est détaché
--   (perdu). Les autres vérifications en attente sur ce client (d'autres
--   commerciaux) sont refusées et leurs fiches, sans autre vérification en
--   attente, passent « perdu » (un doublon du MÊME commercial le dit, sans
--   seconde notification). Refusé si le client n'a plus aucun des numéros
--   de la fiche (le commercial l'a corrigé entre-temps).
-- 'reject' : le prospect passe « perdu » avec un motif FIXE, « Déjà client
--   de Bonzini » : c'est tout ce que lit le commercial, qui ne doit pas
--   apprendre de quel client il s'agit. La note libre de la direction reste
--   INTERNE (sur la vérification et au journal d'audit). Toutes ses
--   vérifications sont refusées et la date du refus gardée
--   (direction_rejected_at).
-- Journalisée ; chaque commercial dont une fiche change est notifié, de même
-- que le commercial qui perd ce client (son origine d'avant).
-- Verrous : le client AVANT le prospect (même ordre que la réouverture d'un
-- client en prospect), le prospect AVANT ses vérifications.
CREATE OR REPLACE FUNCTION public.prospect_resolve_claim(
  p_prospect_id UUID,
  p_decision TEXT,
  p_client_user_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_note TEXT := nullif(btrim(coalesce(p_note, '')), '');
  v_client_id UUID := p_client_user_id;
  v_candidates UUID[];
  v_client public.clients;
  v_p public.prospects;
  v_src public.client_sources;
  v_old public.prospects;
  v_other public.prospects;
  v_k RECORD;
  v_closed UUID[] := ARRAY[]::UUID[];
  v_name TEXT;
  v_dup BOOLEAN;
  v_rejected UUID[];
  v_prev_staff UUID;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageSales') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('attribute', 'reject') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Décision inconnue (attribute ou reject)');
  END IF;
  IF length(v_note) > 300 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Note trop longue (300 caractères au plus)');
  END IF;

  -- Attribuer : le client d'abord, verrouillé.
  IF p_decision = 'attribute' THEN
    IF v_client_id IS NULL THEN
      SELECT array_agg(k.client_user_id ORDER BY k.created_at)
        INTO v_candidates
        FROM public.prospect_client_claims k
        JOIN public.clients c ON c.user_id = k.client_user_id
       WHERE k.prospect_id = p_prospect_id AND k.status = 'pending';
      IF coalesce(cardinality(v_candidates), 0) > 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Plusieurs clients ont ces numéros : choisissez lequel attribuer');
      END IF;
      v_client_id := v_candidates[1];
    END IF;
    IF v_client_id IS NOT NULL THEN
      SELECT * INTO v_client FROM public.clients WHERE user_id = v_client_id FOR UPDATE;
    END IF;
  END IF;

  SELECT * INTO v_p FROM public.prospects WHERE id = p_prospect_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Prospect introuvable');
  END IF;
  IF v_p.status <> 'to_verify' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette fiche n''attend plus de vérification');
  END IF;
  PERFORM 1 FROM public.prospect_client_claims WHERE prospect_id = p_prospect_id AND status = 'pending' FOR UPDATE;
  SELECT * INTO v_src FROM public.client_sources WHERE id = v_p.source_id;
  v_name := btrim(v_p.first_name || ' ' || coalesce(v_p.last_name, ''));

  -- ── Refuser ──
  IF p_decision = 'reject' THEN
    WITH r AS (
      UPDATE public.prospect_client_claims
         SET status = 'rejected', resolved_at = now(), resolved_by = v_uid, note = v_note, direction_rejected_at = now()
       WHERE prospect_id = p_prospect_id AND status = 'pending'
      RETURNING client_user_id
    )
    SELECT coalesce(array_agg(client_user_id ORDER BY client_user_id), ARRAY[]::UUID[]) INTO v_rejected FROM r;
    UPDATE public.prospects
       SET status = 'lost', lost_reason = 'Déjà client de Bonzini',
           status_changed_at = now(), updated_at = now()
     WHERE id = p_prospect_id;
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (v_uid, 'prospect_resolve_claim', 'prospect', p_prospect_id,
            jsonb_build_object('decision', 'reject', 'source_id', v_p.source_id, 'note', v_note,
                               'client_user_ids', to_jsonb(v_rejected)));
    PERFORM public.send_staff_push_user(v_src.staff_user_id, 'Fiche classée',
      v_name || ' : déjà client Bonzini — fiche classée par la direction', '/v/prospects/' || p_prospect_id);
    RETURN jsonb_build_object('success', true, 'decision', 'reject', 'prospect_id', p_prospect_id);
  END IF;

  -- ── Attribuer ──
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun client reconnu pour cette fiche : refusez-la');
  END IF;
  IF v_client.user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.prospect_client_claims
                  WHERE prospect_id = p_prospect_id AND client_user_id = v_client_id AND status = 'pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce client n''est pas reconnu pour cette fiche');
  END IF;
  -- Une vérification a pu s'ajouter entre la lecture et le verrou.
  IF p_client_user_id IS NULL
     AND (SELECT count(*) FROM public.prospect_client_claims k JOIN public.clients c ON c.user_id = k.client_user_id
           WHERE k.prospect_id = p_prospect_id AND k.status = 'pending') > 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plusieurs clients ont ces numéros : choisissez lequel attribuer');
  END IF;
  IF v_src.kind IS DISTINCT FROM 'commercial' OR NOT coalesce(v_src.is_active, false) THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Cette fiche commercial est archivée : confiez d''abord le prospect à un commercial actif');
  END IF;
  -- Le client doit avoir encore au moins un des numéros de la fiche (principal ou autre).
  IF NOT EXISTS (
    SELECT 1
      FROM unnest(v_p.phone_e164 || ARRAY(SELECT pp.phone_e164 FROM public.prospect_phones pp WHERE pp.prospect_id = p_prospect_id)) AS n(phone)
     WHERE n.phone = v_client.phone_e164
        OR EXISTS (SELECT 1 FROM public.client_phones cp WHERE cp.client_id = v_client.id AND cp.phone_e164 = n.phone)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Ce client n''a plus aucun des numéros de cette fiche : refusez-la');
  END IF;

  -- Un autre prospect « devenu client » de ce client : détaché.
  SELECT * INTO v_old FROM public.prospects
   WHERE converted_user_id = v_client_id AND id <> p_prospect_id FOR UPDATE;
  IF FOUND THEN
    UPDATE public.prospects
       SET status = 'lost', lost_reason = 'Client réattribué par la direction',
           converted_user_id = NULL, converted_at = NULL, status_changed_at = now(), updated_at = now()
     WHERE id = v_old.id;
  END IF;

  -- Le prospect AVANT l'origine du client : le déclencheur d'attribution ne
  -- le trouve donc plus « ouvert » et ne le touche pas.
  UPDATE public.prospects
     SET status = 'won', converted_user_id = v_client_id, converted_at = now(),
         status_changed_at = now(), lost_reason = NULL, updated_at = now()
   WHERE id = p_prospect_id;

  IF v_client.source_id IS DISTINCT FROM v_p.source_id THEN
    PERFORM set_config('bonzini.client_source_write', 'on', true);
    UPDATE public.clients
       SET source_id = v_p.source_id, source_set_at = now(), source_set_by = v_uid
     WHERE user_id = v_client_id;
    PERFORM set_config('bonzini.client_source_write', '', true);
  END IF;

  UPDATE public.prospect_client_claims
     SET status = 'attributed', resolved_at = now(), resolved_by = v_uid, note = v_note
   WHERE prospect_id = p_prospect_id AND client_user_id = v_client_id AND status = 'pending';
  UPDATE public.prospect_client_claims
     SET status = 'rejected', resolved_at = now(), resolved_by = v_uid, note = 'Un autre client a été attribué à cette fiche'
   WHERE prospect_id = p_prospect_id AND status = 'pending';

  -- Les autres fiches qui avaient saisi ce même client : d'autres
  -- commerciaux, ou un doublon du même (son principal sur l'une, un autre de
  -- ses numéros sur l'autre).
  FOR v_k IN
    SELECT k.id, k.prospect_id FROM public.prospect_client_claims k
     WHERE k.client_user_id = v_client_id AND k.status = 'pending' AND k.prospect_id <> p_prospect_id
     ORDER BY k.prospect_id
  LOOP
    SELECT * INTO v_other FROM public.prospects WHERE id = v_k.prospect_id FOR UPDATE;
    v_dup := v_other.source_id IS NOT DISTINCT FROM v_p.source_id;
    UPDATE public.prospect_client_claims
       SET status = 'rejected', resolved_at = now(), resolved_by = v_uid,
           note = CASE WHEN v_dup THEN 'Doublon d''une fiche attribuée au même commercial' ELSE 'Client attribué à un autre commercial' END
     WHERE id = v_k.id AND status = 'pending';
    UPDATE public.prospects p
       SET status = 'lost',
           lost_reason = CASE WHEN v_dup THEN 'Doublon : ce client vous est attribué par une autre de vos fiches'
                              ELSE 'Client attribué à un autre commercial' END,
           status_changed_at = now(), updated_at = now()
     WHERE p.id = v_k.prospect_id AND p.status = 'to_verify'
       AND NOT EXISTS (SELECT 1 FROM public.prospect_client_claims x WHERE x.prospect_id = p.id AND x.status = 'pending');
    IF FOUND THEN
      v_closed := v_closed || v_other.id;
      -- Le même commercial reçoit déjà « la direction vous attribue ce client ».
      IF NOT v_dup THEN
        PERFORM public.send_staff_push_user(
          (SELECT staff_user_id FROM public.client_sources WHERE id = v_other.source_id), 'Fiche classée',
          btrim(v_other.first_name || ' ' || coalesce(v_other.last_name, '')) || ' : déjà client Bonzini, suivi par un autre commercial',
          '/v/prospects/' || v_other.id);
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'prospect_resolve_claim', 'prospect', p_prospect_id,
          jsonb_build_object('decision', 'attribute', 'client_user_id', v_client_id, 'source_id', v_p.source_id,
                             'client_source_from', v_client.source_id, 'note', v_note,
                             'detached_prospect_id', v_old.id, 'closed_prospect_ids', to_jsonb(v_closed)));

  PERFORM public.send_staff_push_user(v_src.staff_user_id, 'Client attribué',
    v_name || ' : la direction vous attribue ce client', '/v/prospects/' || p_prospect_id);
  IF v_old.id IS NOT NULL THEN
    PERFORM public.send_staff_push_user(
      (SELECT staff_user_id FROM public.client_sources WHERE id = v_old.source_id), 'Client réattribué',
      btrim(v_old.first_name || ' ' || coalesce(v_old.last_name, '')) || ' : client réattribué par la direction',
      '/v/prospects/' || v_old.id);
  END IF;
  -- Son origine d'avant était un AUTRE commercial (attribué par la réception
  -- ou par l'origine posée à la main, sans prospect chez lui) : prévenu aussi.
  -- C'était son client : il le connaît par son nom.
  IF v_client.source_id IS DISTINCT FROM v_p.source_id
     AND (v_old.id IS NULL OR v_old.source_id IS DISTINCT FROM v_client.source_id) THEN
    SELECT staff_user_id INTO v_prev_staff FROM public.client_sources
     WHERE id = v_client.source_id AND kind = 'commercial';
    IF v_prev_staff IS NOT NULL THEN
      PERFORM public.send_staff_push_user(v_prev_staff, 'Client réattribué',
        coalesce(nullif(btrim(coalesce(v_client.first_name, '') || ' ' || coalesce(v_client.last_name, '')), ''), v_client.company_name, 'Un de vos clients')
          || ' : client réattribué par la direction',
        '/v/clients');
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'decision', 'attribute', 'prospect_id', p_prospect_id,
                            'client_user_id', v_client_id, 'detached_prospect_id', v_old.id,
                            'closed_prospect_ids', to_jsonb(v_closed));
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce client est déjà rattaché à un autre prospect');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 11. Client → prospect : ce qui bloque
-- ─────────────────────────────────────────────────────────────────────────
-- Pour l'écran : peut-on repasser ce client en prospect ? Ce qui bloque, en
-- clair ; ce qui serait effacé AUSSI sans bloquer (warnings : bénéficiaires,
-- conversation avec le support, KYC, notes — gardés au journal) ; la fiche
-- commercial proposée (son origine, si c'est un commercial actif, sinon
-- celle de son ancien prospect) ; le prospect « devenu client » qui serait
-- rouvert. Super admin (canManageUsers ET canManageSales).
CREATE OR REPLACE FUNCTION public.admin_client_prospect_eligibility(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_client public.clients;
  v_blockers TEXT[];
  v_reopen public.prospects;
  v_suggested UUID;
BEGIN
  IF NOT (public.admin_has_permission(v_uid, 'canManageUsers') AND public.admin_has_permission(v_uid, 'canManageSales')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_client FROM public.clients WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;
  v_blockers := public._client_prospect_blockers(p_user_id);
  SELECT * INTO v_reopen FROM public.prospects WHERE converted_user_id = p_user_id;
  SELECT s.id INTO v_suggested FROM public.client_sources s
   WHERE s.id = v_client.source_id AND s.kind = 'commercial' AND s.is_active;
  IF v_suggested IS NULL AND v_reopen.id IS NOT NULL THEN
    SELECT s.id INTO v_suggested FROM public.client_sources s
     WHERE s.id = v_reopen.source_id AND s.kind = 'commercial' AND s.is_active;
  END IF;
  RETURN jsonb_build_object('success', true,
    'eligible', coalesce(cardinality(v_blockers), 0) = 0,
    'blockers', to_jsonb(v_blockers),
    'warnings', to_jsonb(public._client_prospect_warnings(p_user_id)),
    'suggested_source_id', v_suggested,
    'reopen_prospect_id', v_reopen.id);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 12. Client → prospect
-- ─────────────────────────────────────────────────────────────────────────
-- Seulement un client SANS AUCUNE opération (les mêmes règles, recalculées
-- sous verrou). Dans l'ordre : client, portefeuille, compte de connexion et
-- ancien prospect verrouillés, numéros verrouillés, tout revérifié. Le
-- compte de connexion en FOR UPDATE : une insertion EN COURS qui le
-- référence (dépôt, paiement, grand livre, colis, douane, bénéficiaire…)
-- tient un verrou « clé partagée » sur lui ; on attend qu'elle se termine,
-- puis les blocages la voient — sans cela, un dépôt saisi au même instant
-- échappait au contrôle puis disparaissait avec le compte (cascade). Puis,
-- d'un bloc (tout ou rien) : instantané COMPLET du client dans le journal
-- d'audit (sa fiche entière, ses numéros, ses bénéficiaires, ses échanges
-- avec le support, son compte de connexion), compte supprimé
-- par admin_delete_client (la même logique que « Supprimer le client »),
-- puis son ancien prospect « devenu client » rouvert (contacté, chez
-- p_source_id, champs vides complétés), ou un prospect créé avec ses
-- coordonnées. Le commercial est notifié. Jamais l'adresse technique
-- @bonzini-client.local comme email.
CREATE OR REPLACE FUNCTION public.admin_client_to_prospect(p_user_id UUID, p_source_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_reason TEXT := nullif(btrim(coalesce(p_reason, '')), '');
  v_src public.client_sources;
  v_client public.clients;
  v_e164 TEXT;
  v_phones JSONB;
  v_numbers TEXT[];
  v_check TEXT[];
  v_blockers TEXT[];
  v_reopen public.prospects;
  v_n TEXT;
  v_holder UUID;
  v_email TEXT;
  v_gender TEXT;
  v_birth DATE;
  v_note TEXT;
  v_label TEXT;
  v_del JSON;
  v_id UUID;
  v_name TEXT;
BEGIN
  IF NOT (public.admin_has_permission(v_uid, 'canManageUsers') AND public.admin_has_permission(v_uid, 'canManageSales')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF length(v_reason) > 300 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Motif trop long (300 caractères au plus)');
  END IF;
  SELECT * INTO v_src FROM public.client_sources WHERE id = p_source_id;
  IF NOT FOUND OR v_src.kind <> 'commercial' OR NOT v_src.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Choisissez un commercial actif');
  END IF;

  -- Verrouillés AVANT d'être lus : le client, son portefeuille (même ordre
  -- qu'un paiement : portefeuille, puis le compte qu'il référence), puis son
  -- compte de connexion (voir plus haut).
  SELECT * INTO v_client FROM public.clients WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;
  PERFORM 1 FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  PERFORM 1 FROM auth.users WHERE id = p_user_id FOR UPDATE;

  -- Ses numéros : le principal, puis ses autres numéros valables (neuf au plus).
  v_e164 := coalesce(public._phone_e164(v_client.phone_e164), public._phone_e164(v_client.phone));
  SELECT coalesce(jsonb_agg(jsonb_build_object('phone_e164', x.e, 'country_iso', x.iso, 'label', x.label) ORDER BY x.o), '[]'::jsonb)
    INTO v_phones
    FROM (
      SELECT d.*, row_number() OVER (ORDER BY d.is_primary DESC, d.created_at, d.e) AS o
        FROM (
          SELECT DISTINCT ON (public._phone_e164(cp.phone_e164))
                 public._phone_e164(cp.phone_e164) AS e,
                 CASE WHEN cp.country_iso ~ '^[A-Z]{2}$' THEN cp.country_iso END AS iso,
                 left(nullif(btrim(coalesce(cp.label, '')), ''), 40) AS label,
                 cp.is_primary, cp.created_at
            FROM public.client_phones cp
           WHERE cp.client_id = v_client.id
             AND public._phone_e164(cp.phone_e164) IS NOT NULL
             AND public._phone_e164(cp.phone_e164) IS DISTINCT FROM v_e164
           ORDER BY public._phone_e164(cp.phone_e164), cp.is_primary DESC, cp.created_at
        ) d
    ) x
   WHERE x.o <= 9;
  SELECT coalesce(array_agg(e ->> 'phone_e164' ORDER BY o), ARRAY[]::TEXT[]) INTO v_numbers
    FROM jsonb_array_elements(v_phones) WITH ORDINALITY AS t(e, o);
  v_numbers := v_e164 || v_numbers;

  -- Son ancien prospect « devenu client » (rouvert plutôt que recréé) : ses
  -- numéros à lui comptent aussi.
  SELECT * INTO v_reopen FROM public.prospects WHERE converted_user_id = p_user_id FOR UPDATE;
  v_check := v_numbers;
  IF v_reopen.id IS NOT NULL THEN
    v_check := v_check || v_reopen.phone_e164
               || ARRAY(SELECT pp.phone_e164 FROM public.prospect_phones pp WHERE pp.prospect_id = v_reopen.id ORDER BY pp.position);
  END IF;
  v_check := ARRAY(SELECT DISTINCT n FROM unnest(v_check) AS n WHERE n IS NOT NULL ORDER BY n);

  -- Numéros verrouillés (une saisie simultanée d'un commercial attend), puis
  -- tout revérifié : rien ne doit bloquer.
  PERFORM public._prospect_lock_numbers(v_check);
  v_blockers := public._client_prospect_blockers(p_user_id);
  IF coalesce(cardinality(v_blockers), 0) > 0 THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Ce client ne peut pas redevenir prospect : ' || array_to_string(v_blockers, ' · '), 'blockers', to_jsonb(v_blockers));
  END IF;

  -- Aucun de ces numéros ne doit être suivi ailleurs, ni être celui d'un autre client.
  FOREACH v_n IN ARRAY v_check LOOP
    SELECT p.source_id INTO v_holder
      FROM public.prospects p
     WHERE p.status IN ('new','contacted','interested','to_verify')
       AND p.id IS DISTINCT FROM v_reopen.id
       AND (p.phone_e164 = v_n
            OR EXISTS (SELECT 1 FROM public.prospect_phones pp WHERE pp.prospect_id = p.id AND pp.phone_e164 = v_n))
     ORDER BY (p.source_id = p_source_id), p.created_at
     LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('success', false, 'error',
        CASE WHEN v_holder = p_source_id THEN 'Le numéro ' || v_n || ' est déjà dans la liste de ce commercial'
             ELSE 'Le numéro ' || v_n || ' est déjà suivi par un autre commercial' END);
    END IF;
    IF EXISTS (SELECT 1 FROM public.clients c WHERE c.phone_e164 = v_n AND c.user_id <> p_user_id)
       OR EXISTS (SELECT 1 FROM public.client_phones cp JOIN public.clients c ON c.id = cp.client_id
                   WHERE cp.phone_e164 = v_n AND c.user_id <> p_user_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Le numéro ' || v_n || ' est aussi celui d''un autre client');
    END IF;
  END LOOP;

  -- Ce que la fiche prospect reprend du client (sa forme vérifiée).
  v_email := nullif(lower(btrim(coalesce(v_client.email, ''))), '');
  IF v_email LIKE '%@bonzini-client.local' OR public._email_error(v_email) IS NOT NULL THEN
    v_email := NULL;
  END IF;
  v_gender := CASE WHEN upper(coalesce(v_client.gender, '')) IN ('MALE', 'FEMALE') THEN upper(v_client.gender) END;
  v_birth := CASE WHEN public._birth_date_error(v_client.date_of_birth) IS NULL THEN v_client.date_of_birth END;
  v_note := 'Ancien compte client ' || coalesce(v_client.customer_code, '(sans code)') || ' repassé en prospect le '
            || to_char((now() AT TIME ZONE 'Africa/Douala')::date, 'DD/MM/YYYY') || coalesce(' : ' || v_reason, '');
  SELECT label INTO v_label FROM public.client_sources WHERE id = v_client.source_id;

  BEGIN
    -- L'instantané : tout ce que la suppression va effacer. Les champs
    -- principaux à plat (lisibles d'un coup d'œil), puis la fiche client
    -- ENTIÈRE (notes de l'équipe, KYC, secteur, quartier, inscription…), ses
    -- numéros, ses bénéficiaires, ses échanges avec le support (messages
    -- compris), son compte de connexion et les décisions déjà prises sur lui
    -- (_client_erasable_data).
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (v_uid, 'client_to_prospect', 'client', p_user_id, public._client_erasable_data(p_user_id) || jsonb_build_object(
      'client', to_jsonb(v_client),
      'customer_code', v_client.customer_code,
      'first_name', v_client.first_name,
      'last_name', v_client.last_name,
      'company', v_client.company_name,
      'phone', v_client.phone,
      'phone_e164', v_client.phone_e164,
      'phones', coalesce((SELECT jsonb_agg(jsonb_build_object('phone_e164', cp.phone_e164, 'country_iso', cp.country_iso,
                                                              'label', cp.label, 'is_primary', cp.is_primary)
                                           ORDER BY cp.is_primary DESC, cp.created_at)
                            FROM public.client_phones cp WHERE cp.client_id = v_client.id), '[]'::jsonb),
      'email', v_client.email,
      'city', v_client.city,
      'country', v_client.country,
      'gender', v_client.gender,
      'date_of_birth', v_client.date_of_birth,
      'source_id', v_client.source_id,
      'source_label', v_label,
      'registered_at', v_client.created_at,
      'registered_by_name', to_jsonb(v_client) ->> 'registered_by_name',
      'reason', v_reason,
      'prospect_source_id', p_source_id,
      'prospect_source_label', v_src.label,
      'reopened_prospect_id', v_reopen.id));

    -- Ses vérifications (déjà tranchées) n'ont plus d'objet ; l'ancien
    -- prospect est détaché avant que le compte disparaisse.
    DELETE FROM public.prospect_client_claims WHERE client_user_id = p_user_id;
    IF v_reopen.id IS NOT NULL THEN
      UPDATE public.prospects SET converted_user_id = NULL, converted_at = NULL WHERE id = v_reopen.id;
    END IF;

    -- Le compte : même logique que « Supprimer le client ».
    v_del := public.admin_delete_client(p_user_id);
    IF NOT coalesce((v_del ->> 'success')::boolean, false) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = coalesce(v_del ->> 'error', 'Suppression du compte refusée');
    END IF;

    IF v_reopen.id IS NOT NULL THEN
      UPDATE public.prospects
         SET status = 'contacted', source_id = p_source_id,
             converted_user_id = NULL, converted_at = NULL, lost_reason = NULL,
             status_changed_at = now(), updated_at = now(),
             last_name  = coalesce(last_name, left(nullif(btrim(coalesce(v_client.last_name, '')), ''), 80)),
             company    = coalesce(company, left(nullif(btrim(coalesce(v_client.company_name, '')), ''), 120)),
             city       = coalesce(city, left(nullif(btrim(coalesce(v_client.city, '')), ''), 80)),
             email      = coalesce(email, v_email),
             gender     = coalesce(gender, v_gender),
             birth_date = coalesce(birth_date, v_birth),
             notes      = CASE WHEN notes IS NULL THEN v_note
                               ELSE left(notes, greatest(0, 1000 - length(v_note) - 1)) || E'\n' || v_note END
       WHERE id = v_reopen.id;
      -- Ses numéros de client absents de la fiche s'y ajoutent (neuf autres au plus).
      INSERT INTO public.prospect_phones (prospect_id, phone_e164, country_iso, label, position)
      SELECT v_reopen.id, y.e, y.iso, y.label,
             coalesce((SELECT max(position) FROM public.prospect_phones WHERE prospect_id = v_reopen.id), 0) + row_number() OVER (ORDER BY y.o)
        FROM (
          SELECT n.e, NULL::TEXT AS iso, NULL::TEXT AS label, n.o
            FROM unnest(v_numbers) WITH ORDINALITY AS n(e, o)
           WHERE n.o = 1
          UNION ALL
          SELECT e ->> 'phone_e164', e ->> 'country_iso', e ->> 'label', o + 1
            FROM jsonb_array_elements(v_phones) WITH ORDINALITY AS t(e, o)
        ) y
       WHERE y.e IS DISTINCT FROM v_reopen.phone_e164
         AND NOT EXISTS (SELECT 1 FROM public.prospect_phones pp WHERE pp.prospect_id = v_reopen.id AND pp.phone_e164 = y.e)
       ORDER BY y.o
       LIMIT greatest(0, 9 - (SELECT count(*) FROM public.prospect_phones WHERE prospect_id = v_reopen.id));
      v_id := v_reopen.id;
      v_name := btrim(v_reopen.first_name || ' ' || coalesce(v_reopen.last_name, v_client.last_name, ''));
    ELSE
      v_name := left(coalesce(nullif(btrim(coalesce(v_client.first_name, '')), ''), nullif(btrim(coalesce(v_client.company_name, '')), ''), 'Client'), 80);
      INSERT INTO public.prospects (source_id, first_name, last_name, company, phone, phone_e164, city, interests, notes,
                                    created_by, gender, birth_date, email, status)
      VALUES (p_source_id, v_name,
              left(nullif(btrim(coalesce(v_client.last_name, '')), ''), 80),
              left(nullif(btrim(coalesce(v_client.company_name, '')), ''), 120),
              v_e164, v_e164,
              left(nullif(btrim(coalesce(v_client.city, '')), ''), 80),
              '{}', v_note, v_uid, v_gender, v_birth, v_email, 'contacted')
      RETURNING id INTO v_id;
      INSERT INTO public.prospect_phones (prospect_id, phone_e164, country_iso, label, position)
      SELECT v_id, e ->> 'phone_e164', e ->> 'country_iso', e ->> 'label', o
        FROM jsonb_array_elements(v_phones) WITH ORDINALITY AS t(e, o);
      v_name := btrim(v_name || ' ' || coalesce(v_client.last_name, ''));
    END IF;
  EXCEPTION
    WHEN raise_exception THEN
      RETURN jsonb_build_object('success', false, 'error', SQLERRM);
    WHEN unique_violation THEN
      RETURN jsonb_build_object('success', false, 'error', 'Un de ses numéros est déjà suivi par un commercial');
    WHEN check_violation THEN
      RETURN jsonb_build_object('success', false, 'error', 'Une coordonnée du client ne tient pas dans la fiche prospect');
    WHEN foreign_key_violation THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce client a encore des données liées : suppression impossible');
  END;

  PERFORM public.send_staff_push_user(v_src.staff_user_id, 'Nouveau prospect',
    v_name || ' vous est confié par la direction (ancien compte client)', '/v/prospects/' || v_id);

  RETURN jsonb_build_object('success', true, 'prospect_id', v_id, 'reopened', v_reopen.id IS NOT NULL,
                            'email_freed', (v_del ->> 'email_freed')::boolean);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 13. Droits
-- ─────────────────────────────────────────────────────────────────────────
-- Internes : jamais appelables depuis l'API (les RPC ci-dessous, SECURITY
-- DEFINER, les appellent avec les droits de leur propriétaire).
REVOKE ALL ON FUNCTION public._prospect_number_conflict(TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._prospect_numbers_error(TEXT[], UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._prospect_numbers_refusal(TEXT[], UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._prospect_client_matches(TEXT[], UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._prospect_claim_clients(UUID, TEXT[], UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._client_prospect_blockers(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_staff_push_user(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._prospect_release_if_unclaimed(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._client_erasable_data(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._client_prospect_warnings(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._clients_release_prospect_claims() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._prospect_claims_release() FROM PUBLIC, anon, authenticated;

-- Les actions : membres du personnel connectés ; chaque RPC vérifie la permission.
DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.prospect_create(text, text, text, text, text, text, timestamptz, text[], uuid, text, date, text, jsonb, text, text)',
    'public.prospect_update(uuid, text, text, text, text, text, text, timestamptz, boolean, text[], text, date, boolean, text, jsonb, text, text)',
    'public.prospect_set_status(uuid, text, text)',
    'public.prospect_link_client(uuid, uuid)',
    'public.prospect_phone_check(text, uuid)',
    'public.prospect_claims_pending()',
    'public.prospect_resolve_claim(uuid, text, uuid, text)',
    'public.admin_client_prospect_eligibility(uuid)',
    'public.admin_client_to_prospect(uuid, uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 14. Étiquettes Mola
-- ─────────────────────────────────────────────────────────────────────────
-- Le commercial n'a pas Mola (la passerelle le refuse). La décision sur une
-- fiche « À vérifier » est ouverte à Mola pour la direction ; repasser un
-- client en prospect (suppression de son compte) ne l'est pas.
COMMENT ON FUNCTION public.prospect_create(text, text, text, text, text, text, timestamptz, text[], uuid, text, date, text, jsonb, text, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Ajouter un prospect pour un commercial — obligatoires : prénom, nom, sexe (p_gender MALE ou FEMALE), ville au Cameroun, numéro principal (+237…) ; facultatifs : autres numéros (p_phones [{phone_e164, country_iso, label}], neuf au plus), entreprise, date de naissance (AAAA-MM-JJ, 16 à 110 ans), email, intérêts (payments / air / sea), ses plus gros problèmes aujourd''hui (p_pain_points), ce que nous pouvons faire pour l''aider (p_help_needed). Un numéro déjà celui d''un client (pas de ce commercial) : la fiche part « À vérifier » (to_verify) et la direction tranche"}';
COMMENT ON FUNCTION public.prospect_update(uuid, text, text, text, text, text, text, timestamptz, boolean, text[], text, date, boolean, text, jsonb, text, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Modifier un prospect (NULL = inchangé) : nom, sexe (MALE / FEMALE) et ville ne se vident pas ; numéro principal, autres numéros (p_phones = la liste complète, [] = aucun), entreprise, date de naissance (p_clear_birth_date l''efface), email, ses plus gros problèmes (p_pain_points), ce que nous pouvons faire pour l''aider (p_help_needed), notes, date de relance. Un nouveau numéro déjà celui d''un client : la fiche passe « À vérifier » ; le numéro d''un client retiré d''une fiche « À vérifier » clôt sa vérification (plus aucune : la fiche redevient à contacter)"}';
COMMENT ON FUNCTION public.prospect_set_status(uuid, text, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Changer le statut d''un prospect (new, contacted, interested, lost avec motif) ; une fiche « À vérifier » se tranche par prospect_resolve_claim"}';
COMMENT ON FUNCTION public.prospect_link_client(uuid, uuid) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Rattacher un prospect au compte client qu''il est devenu (attribue le client à son commercial s''il n''a pas d''origine ; pas une fiche « À vérifier »)","resolve":{"p_user_id":"client"}}';
COMMENT ON FUNCTION public.prospect_phone_check(text, uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Pendant la saisie d''un prospect : ce numéro est-il libre, déjà client, déjà suivi ? (aucune identité de client)"}';
COMMENT ON FUNCTION public.prospect_claims_pending() IS
  '@mola:{"expose":true,"kind":"read","permission":"canManageSales","label":"Les fiches prospect « À vérifier » : un numéro saisi par un commercial est déjà celui d''un client — la fiche, le commercial (fiche active ou non), le client reconnu et son activité, un refus antérieur"}';
COMMENT ON FUNCTION public.prospect_resolve_claim(uuid, text, uuid, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Trancher une fiche « À vérifier » : attribute = le client devient celui du commercial (son origine change, le prospect devient client), reject = le prospect passe perdu, motif fixe « Déjà client de Bonzini » (la note reste interne : le commercial ne la voit pas)","resolve":{"p_client_user_id":"client"}}';
COMMENT ON FUNCTION public.admin_client_prospect_eligibility(uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageUsers","label":"Ce client peut-il redevenir prospect ? (ce qui bloque : dépôts, paiements, solde, colis…)"}';
COMMENT ON FUNCTION public.admin_client_to_prospect(uuid, uuid, text) IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":true,"danger":true,"label":"Repasser en prospect un client sans aucune opération (son compte est supprimé, la fiche va au commercial choisi)"}';
COMMENT ON FUNCTION public.send_staff_push_user(uuid, text, text, text) IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":true,"danger":false,"label":"Envoyer une notification push à une personne du personnel (interne)"}';
COMMENT ON FUNCTION public._prospect_number_conflict(text, uuid, uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : ce numéro est-il celui d''un client (du commercial ou non) ou d''un prospect suivi"}';
COMMENT ON FUNCTION public._prospect_numbers_error(text[], uuid, uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : le premier des autres numéros déjà pris, dit en clair"}';
COMMENT ON FUNCTION public._prospect_numbers_refusal(text[], uuid, uuid, boolean) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : le premier numéro refusé, dit en clair (le numéro d''un autre client accepté ou non)"}';
COMMENT ON FUNCTION public._prospect_client_matches(text[], uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageSales","label":"Interne : les clients reconnus par les numéros saisis"}';
COMMENT ON FUNCTION public._prospect_claim_clients(uuid, text[], uuid) IS
  '@mola:{"expose":false,"kind":"write","permission":"canProspect","label":"Interne : ouvrir les vérifications d''une fiche « À vérifier » et prévenir la direction"}';
COMMENT ON FUNCTION public._client_prospect_blockers(uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageUsers","label":"Interne : ce qui empêche un client de redevenir prospect"}';
COMMENT ON FUNCTION public._client_erasable_data(uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageUsers","label":"Interne : ce qu''efface aussi la suppression d''un compte client — bénéficiaires, échanges avec le support, compte de connexion, décisions sur ses fiches « À vérifier » (pour l''instantané du journal)"}';
COMMENT ON FUNCTION public._client_prospect_warnings(uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canManageUsers","label":"Interne : ce que repasser un client en prospect efface aussi sans le bloquer (bénéficiaires, support, KYC, notes)"}';
COMMENT ON FUNCTION public._prospect_release_if_unclaimed(uuid, boolean) IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Interne : une fiche « À vérifier » qui n''attend plus aucune vérification redevient à contacter (ou perdue)"}';
COMMENT ON FUNCTION public._clients_release_prospect_claims() IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","label":"Interne (déclencheur) : un client supprimé libère les fiches « À vérifier » qui l''attendaient"}';
COMMENT ON FUNCTION public._prospect_claims_release() IS
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","label":"Interne (déclencheur) : une vérification en attente effacée libère sa fiche « À vérifier »"}';

NOTIFY pgrst, 'reload schema';
