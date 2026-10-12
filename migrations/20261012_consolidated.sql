-- ============================================================================
-- MIGRATION CONSOLIDÉE · 12/10/2026 · CARGO — LES DOCUMENTS DU CLIENT
--   · l'état de chaque colis à la réception (bon de réception et devis) ;
--   · la facture établie à l'arrivée à Douala, numérotée sans trou,
--     acquittée au paiement ;
--   · le relevé des colis d'un client (devis, facture, conteneurs, vols).
-- Projet Supabase : fmhsohrgbznqmcvqktjw · à coller d'un bloc dans le SQL Editor.
-- ============================================================================
--
-- À coller APRÈS migrations/20261006_consolidated.sql (et donc après les
-- paquets avion du 05/10). Le contrôle des prérequis ci-dessous s'arrête net
-- s'il en manque un, sans rien modifier.
--
-- Contenu, dans l'ordre d'exécution :
--   0. Contrôle des prérequis.
--   1. Copie conforme de
--        ← supabase/migrations/20261012100000_cargo_documents.sql
--      (qui reste la source pour `npx supabase db push --linked`) :
--      · parcels.reception_condition (+ note) : good / damaged / opened /
--        wet, NULL = sans réserve ; reception_deposit_json les renvoie ;
--        RPC reception_set_parcel_condition (@mola exposée,
--        canReceiveParcels ; l'auteur du dépôt ou l'équipe cargo ; refusée
--        une fois le colis parti) ;
--      · la facture : compteur parcel_invoice_counter (repris au plus grand
--        FA-… déjà émis), cargo_next_invoice_no (interne) ;
--        cargo_quote_invoice : à l'arrivée de tous les colis (montant
--        définitif, devis complet) OU une fois tout payé (comme avant) ;
--        cargo_quote_recompute : `invoiced` = facturé ET soldé, une facture
--        due laisse le devis « envoyé » ; lignes d'un devis facturé figées
--        (déclencheur) ; encaisser / annuler permis tant que la facture est
--        due, refusé une fois acquittée ; notification du client adaptée ;
--      · reception_client_deposits : par dépôt, le devis (total, payé,
--        facture) et les conteneurs / vols avec leurs dates.
--   Une table créée (parcel_invoice_counter, une ligne). Aucune donnée
--   existante modifiée.
--
-- Idempotent : rejouable sans dégât. Vérifié sur Postgres 16 (schéma minimal
-- des tables cargo, réception, devis, encaissements, avion) : ce fichier passé
-- deux fois dans UNE transaction, puis : état noté / refusé (colis parti,
-- valeur inconnue, sans droit) / effacé ; facture refusée avant l'arrivée,
-- établie à l'arrivée (statut « envoyé », notification « à régler ») ; lignes
-- figées ; encaissement partiel puis solde (statut « facturé ») ; encaisser
-- et annuler refusés une fois acquittée ; numéro rendu par une transaction
-- annulée puis réutilisé (FA-000043 après FA-000042) ; facture acquittée
-- d'un dépôt payé dont les colis sont encore à Guangzhou ; relevé client ;
-- EXECUTE refusé à anon.
--
-- Après passage :
--   npx supabase migration repair --status applied 20261012100000
--   /gen-types
-- ============================================================================


-- ############################################################################
-- SECTION 0 — Prérequis
-- ############################################################################
DO $pre$
DECLARE
  v_missing TEXT[] := ARRAY[]::TEXT[];
  r         RECORD;
BEGIN
  FOR r IN
    SELECT t.tbl, t.origin FROM (VALUES
      ('parcel_deposits',       'réception des colis, 20/09'),
      ('parcels',               'réception des colis, 20/09'),
      ('parcel_photos',         'photos multiples, 02/10'),
      ('parcel_quotes',         'devis, 21/09'),
      ('parcel_quote_lines',    'devis, 21/09'),
      ('parcel_quote_payments', 'encaissements, 21/09'),
      ('parcel_releases',       'remise à Douala, 21/09'),
      ('cargo_shipments',       'conteneurs'),
      ('air_shipments',         'expéditions aériennes, 21/09'),
      ('air_packages',          'paquets avion, 05/10'),
      ('wallets',               'portefeuilles'),
      ('ledger_entries',        'grand livre'),
      ('admin_audit_logs',      'journal d''audit'),
      ('user_roles',            'équipe')
    ) AS t(tbl, origin)
    WHERE to_regclass('public.' || t.tbl) IS NULL
  LOOP
    v_missing := array_append(v_missing, 'table public.' || r.tbl || ' (' || r.origin || ')');
  END LOOP;

  FOR r IN
    SELECT c.tbl, c.col, c.origin FROM (VALUES
      ('parcels',         'air_package_id',      'paquets avion, 05/10'),
      ('parcels',         'checked_in_at',       'Douala, 21/09'),
      ('parcel_deposits', 'cancelled_at',        'contrôle total de la réception, 02/10'),
      ('parcel_deposits', 'supplier_name',       'fournisseurs, 22/09'),
      ('parcel_quotes',   'invoice_no',          'encaissements, 21/09'),
      ('cargo_shipments', 'eta_manual',          'arrivée relevée, 03/10'),
      ('wallets',         'overdraft_limit_xaf', 'découvert, 18/09')
    ) AS c(tbl, col, origin)
    WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns ic
                       WHERE ic.table_schema = 'public' AND ic.table_name = c.tbl AND ic.column_name = c.col)
  LOOP
    v_missing := array_append(v_missing, 'colonne public.' || r.tbl || '.' || r.col || ' (' || r.origin || ')');
  END LOOP;

  FOR r IN
    SELECT f.sig, f.origin FROM (VALUES
      ('public.admin_has_permission(uuid,text)',                   'droits par rôle'),
      ('public.reception_client_card(uuid)',                       'réception des colis'),
      ('public.reception_parcel_locked(public.parcels)',           'contrôle total de la réception, 02/10'),
      ('public.cargo_quote_json(uuid)',                            'devis'),
      ('public.cargo_notify_client(uuid,text,text,text,jsonb)',    'notifications cargo, 21/09'),
      ('public.cargo_fmt_xaf(numeric)',                            'notifications cargo, 21/09'),
      ('public.cargo_quote_pay_from_wallet(uuid,numeric,text)',    'règlement au solde, 22/09')
    ) AS f(sig, origin)
    WHERE to_regprocedure(f.sig) IS NULL
  LOOP
    v_missing := array_append(v_missing, 'fonction ' || r.sig || ' (' || r.origin || ')');
  END LOOP;

  IF array_length(v_missing, 1) > 0 THEN
    RAISE EXCEPTION 'Prérequis manquants — rien n''a été modifié : %', array_to_string(v_missing, ' ; ');
  END IF;
END
$pre$;


-- ############################################################################
-- SECTION 1 — supabase/migrations/20261012100000_cargo_documents.sql
-- ############################################################################
-- ============================================================================
-- LES DOCUMENTS CARGO DU CLIENT (12/10/2026) — guide « Les documents à
-- remettre aux clients » (04/10/2026) et demande du fondateur :
--
--   1. L'ÉTAT DE CHAQUE COLIS À LA RÉCEPTION (Guangzhou), imprimé sur le bon de
--      réception et devis : bon état apparent, carton abîmé, colis ouvert,
--      colis mouillé, et une note. Posé tant que le colis n'est pas parti —
--      après, ce serait maquiller un dommage de transport en réserve d'origine.
--   2. LA FACTURE À L'ARRIVÉE : « émettre une vraie facture dès l'arrivée,
--      numérotée, la marquer acquittée au paiement ». Jusqu'ici la facture
--      n'existait qu'une fois tout payé. Désormais :
--        · elle s'établit dès que TOUS les colis du dépôt sont arrivés à
--          Douala (ou, comme avant, quand tout est payé) ;
--        · sa numérotation est une suite continue, SANS TROU (un compteur
--          verrouillé, pas une séquence : une séquence perd un numéro à
--          chaque transaction annulée) ;
--        · ses lignes sont figées (déclencheur) : une facture ne se modifie
--          pas, elle s'annule par un avoir ;
--        · les encaissements restent possibles tant qu'elle n'est pas
--          soldée ; une facture ACQUITTÉE (soldée) gèle les encaissements,
--          comme avant ;
--        · le statut `invoiced` garde son sens « facturé ET payé » : une
--          facture pas encore réglée laisse le devis en `sent`. Rien de ce
--          qui lit `status IN ('paid','invoiced')` ne la prend pour payée.
--   3. LE RELEVÉ DES COLIS D'UN CLIENT (« quels sont tous mes colis chez
--      vous ? ») : reception_client_deposits porte, par dépôt, le devis
--      (total, payé, facture) et les conteneurs / vols avec leurs dates.
--
-- Idempotent. Suppose passées 20261005170000_air_packages.sql et
-- 20260922130000_cargo_wallet_payment.sql. Après : /gen-types.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. L'état à la réception
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS reception_condition TEXT;
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS reception_condition_note TEXT;
ALTER TABLE public.parcels DROP CONSTRAINT IF EXISTS parcels_reception_condition_check;
ALTER TABLE public.parcels ADD CONSTRAINT parcels_reception_condition_check
  CHECK (reception_condition IS NULL OR reception_condition IN ('good','damaged','opened','wet'));
ALTER TABLE public.parcels DROP CONSTRAINT IF EXISTS parcels_reception_condition_note_check;
ALTER TABLE public.parcels ADD CONSTRAINT parcels_reception_condition_note_check
  CHECK (reception_condition_note IS NULL OR char_length(reception_condition_note) <= 300);
COMMENT ON COLUMN public.parcels.reception_condition IS
  'État constaté à la réception à Guangzhou (bon de réception) : good, damaged, opened, wet. NULL = sans réserve (bon état apparent). Distinct de `condition` (pointage à Douala).';

-- 1.1 Le dépôt, tel que les écrans le lisent : chaque colis dit aussi son état à la réception.
CREATE OR REPLACE FUNCTION public.reception_deposit_json(p_deposit_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id',                   d.id,
    'deposit_no',           d.deposit_no,
    'client',               public.reception_client_card(d.client_user_id),
    'location',             d.location,
    'brought_by',           d.brought_by,
    'representative_name',  d.representative_name,
    'representative_phone', d.representative_phone,
    'supplier_kind',        d.supplier_kind,
    'supplier_name',        d.supplier_name,
    'supplier_contact',     d.supplier_contact,
    'supplier_phone',       d.supplier_phone,
    'supplier_email',       d.supplier_email,
    'supplier_wechat',      d.supplier_wechat,
    'supplier_address',     d.supplier_address,
    'status',               d.status,
    'received_by',          d.received_by,
    'received_by_name',     (SELECT TRIM(COALESCE(ur.first_name,'') || ' ' || COALESCE(ur.last_name,'')) FROM public.user_roles ur WHERE ur.user_id = d.received_by),
    'opened_at',            d.opened_at,
    'closed_at',            d.closed_at,
    'updated_at',           d.updated_at,
    'cancelled_at',         d.cancelled_at,
    'cancel_reason',        d.cancel_reason,
    'cancelled_by_name',    (SELECT TRIM(COALESCE(ur.first_name,'') || ' ' || COALESCE(ur.last_name,'')) FROM public.user_roles ur WHERE ur.user_id = d.cancelled_by),
    'parcel_count',         (SELECT count(*) FROM public.parcels p WHERE p.deposit_id = d.id),
    'total_weight_kg',      (SELECT COALESCE(sum(p.weight_kg), 0) FROM public.parcels p WHERE p.deposit_id = d.id),
    'total_cbm',            (SELECT COALESCE(sum(p.cbm), 0) FROM public.parcels p WHERE p.deposit_id = d.id),
    'notes',                d.notes,
    'parcels',              COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'seq', p.seq, 'parcel_no', p.parcel_no, 'kind', p.kind,
        'weight_kg', p.weight_kg, 'length_cm', p.length_cm, 'width_cm', p.width_cm, 'height_cm', p.height_cm,
        'cbm', p.cbm, 'description', p.description, 'courier_waybill', p.courier_waybill,
        'photo_path', p.photo_path,
        'photos', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', ph.id, 'path', ph.path, 'position', ph.position, 'created_at', ph.created_at)
                           ORDER BY ph.position, ph.created_at)
          FROM public.parcel_photos ph WHERE ph.parcel_id = p.id), '[]'::jsonb),
        'status', p.status, 'shipment_id', p.shipment_id,
        'container_number', (SELECT cs.container_number FROM public.cargo_shipments cs WHERE cs.id = p.shipment_id),
        'air_shipment_id', p.air_shipment_id,
        'air_package_id', p.air_package_id,
        'package_no', (SELECT k.package_no FROM public.air_packages k WHERE k.id = p.air_package_id),
        'awb_number', (SELECT a.awb_number FROM public.air_shipments a WHERE a.id = p.air_shipment_id),
        'reception_condition', p.reception_condition, 'reception_condition_note', p.reception_condition_note,
        'checked_in_at', p.checked_in_at, 'warehouse_location', p.warehouse_location, 'condition', p.condition, 'condition_note', p.condition_note,
        'delivered_at', p.delivered_at, 'release_id', p.release_id,
        'release_no', (SELECT r.release_no FROM public.parcel_releases r WHERE r.id = p.release_id),
        'created_at', p.created_at, 'updated_at', p.updated_at
      ) ORDER BY p.seq)
      FROM public.parcels p WHERE p.deposit_id = d.id), '[]'::jsonb)
  )
  FROM public.parcel_deposits d
  WHERE d.id = p_deposit_id;
$fn$;

-- 1.2 Noter l'état d'un colis à la réception. Qui : l'auteur du dépôt ou l'équipe cargo.
--     Sur quelle ligne : un colis pas encore parti (ni chargé, ni emballé, ni arrivé, ni remis).
CREATE OR REPLACE FUNCTION public.reception_set_parcel_condition(p_parcel_id UUID, p_condition TEXT, p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid    UUID := auth.uid();
  v_dep    public.parcel_deposits;
  v_par    public.parcels;
  v_locked TEXT;
  v_cond   TEXT := NULLIF(TRIM(COALESCE(p_condition, '')), '');
  v_note   TEXT := NULLIF(TRIM(COALESCE(p_note, '')), '');
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF v_cond IS NOT NULL AND v_cond NOT IN ('good','damaged','opened','wet') THEN
    RETURN jsonb_build_object('success', false, 'error', 'État inconnu');
  END IF;
  IF v_note IS NOT NULL AND char_length(v_note) > 300 THEN
    RETURN jsonb_build_object('success', false, 'error', 'La note ne dépasse pas 300 caractères');
  END IF;
  SELECT * INTO v_par FROM public.parcels WHERE id = p_parcel_id;
  IF v_par.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Colis introuvable'); END IF;
  -- Le dépôt verrouillé AVANT de relire le colis (même ordre que reception_update_parcel).
  SELECT * INTO v_dep FROM public.parcel_deposits WHERE id = v_par.deposit_id FOR UPDATE;
  SELECT * INTO v_par FROM public.parcels WHERE id = p_parcel_id FOR UPDATE;
  IF NOT (v_dep.received_by = v_uid OR public.admin_has_permission(v_uid, 'canManageCargo')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt ne vous appartient pas');
  END IF;
  IF v_dep.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est supprimé');
  END IF;
  v_locked := public.reception_parcel_locked(v_par);
  IF v_locked IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_locked || ' : son état à la réception ne se change plus');
  END IF;

  UPDATE public.parcels
     SET reception_condition = v_cond,
         reception_condition_note = v_note,
         updated_at = now()
   WHERE id = v_par.id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'set_parcel_reception_condition', 'parcel_deposit', v_dep.id,
          jsonb_build_object('description', 'État à la réception du colis ' || v_par.parcel_no || ' : ' || COALESCE(v_cond, 'non précisé'),
                             'parcel_id', v_par.id, 'parcel_no', v_par.parcel_no,
                             'before', jsonb_build_object('condition', v_par.reception_condition, 'note', v_par.reception_condition_note),
                             'after', jsonb_build_object('condition', v_cond, 'note', v_note)));

  RETURN jsonb_build_object('success', true, 'deposit', public.reception_deposit_json(v_dep.id));
END;
$fn$;
REVOKE ALL ON FUNCTION public.reception_set_parcel_condition(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reception_set_parcel_condition(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.reception_set_parcel_condition(UUID, TEXT, TEXT) TO authenticated;
COMMENT ON FUNCTION public.reception_set_parcel_condition(UUID, TEXT, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Noter l''état d''un colis à la réception (bon état, carton abîmé, ouvert, mouillé) avant son départ"}';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. La facture à l'arrivée
-- ─────────────────────────────────────────────────────────────────────────

-- 2.1 Le compteur des factures : une seule ligne, verrouillée à chaque numéro.
--     Repris là où la séquence s'était arrêtée (le plus grand FA-… émis).
CREATE TABLE IF NOT EXISTS public.parcel_invoice_counter (
  id      BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  last_no INTEGER NOT NULL
);
ALTER TABLE public.parcel_invoice_counter ENABLE ROW LEVEL SECURITY;
-- Aucune politique : personne ne le lit ni ne l'écrit en direct ; seules les RPC (SECURITY DEFINER) y touchent.
INSERT INTO public.parcel_invoice_counter (id, last_no)
SELECT true, COALESCE(max(NULLIF(regexp_replace(q.invoice_no, '\D', '', 'g'), '')::integer), 0)
FROM public.parcel_quotes q WHERE q.invoice_no ~ '^FA-\d+$'
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.cargo_next_invoice_no()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_n INTEGER;
BEGIN
  -- L'UPDATE verrouille la ligne jusqu'à la fin de la transaction : deux factures simultanées
  -- se suivent, et une transaction annulée rend son numéro (pas de trou).
  UPDATE public.parcel_invoice_counter SET last_no = last_no + 1 WHERE id RETURNING last_no INTO v_n;
  IF v_n IS NULL THEN
    INSERT INTO public.parcel_invoice_counter (id, last_no) VALUES (true, 1)
    ON CONFLICT (id) DO UPDATE SET last_no = public.parcel_invoice_counter.last_no + 1
    RETURNING last_no INTO v_n;
  END IF;
  RETURN 'FA-' || lpad(v_n::text, 6, '0');
END;
$fn$;
REVOKE ALL ON FUNCTION public.cargo_next_invoice_no() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cargo_next_invoice_no() FROM anon, authenticated;
COMMENT ON FUNCTION public.cargo_next_invoice_no() IS
  '@mola:{"expose":false,"kind":"write","permission":"canCollectParcelPayments","confirm":false,"danger":false,"label":"Numéro de facture suivant, sans trou (helper interne)"}';

-- 2.2 Le statut : `invoiced` = facturé ET soldé. Une facture pas encore réglée laisse le devis « envoyé ».
CREATE OR REPLACE FUNCTION public.cargo_quote_recompute(p_quote_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_total NUMERIC; v_paid NUMERIC; v_q public.parcel_quotes; v_status TEXT;
BEGIN
  SELECT * INTO v_q FROM public.parcel_quotes WHERE id = p_quote_id;
  IF v_q.id IS NULL THEN RETURN; END IF;
  SELECT COALESCE(sum(l.amount_xaf), 0) INTO v_total FROM public.parcel_quote_lines l WHERE l.quote_id = p_quote_id;
  SELECT COALESCE(sum(p.amount_xaf), 0) INTO v_paid FROM public.parcel_quote_payments p WHERE p.quote_id = p_quote_id AND p.cancelled_at IS NULL;
  v_status := CASE
    WHEN v_total > 0 AND v_paid >= v_total THEN CASE WHEN v_q.invoice_no IS NOT NULL THEN 'invoiced' ELSE 'paid' END
    WHEN v_q.sent_at IS NOT NULL OR v_q.invoice_no IS NOT NULL THEN 'sent'
    ELSE 'draft'
  END;
  UPDATE public.parcel_quotes
     SET total_xaf = v_total,
         amount_paid_xaf = v_paid,
         status = v_status,
         paid_at = CASE WHEN v_status IN ('paid','invoiced') THEN COALESCE(paid_at, now()) ELSE NULL END,
         updated_at = now()
   WHERE id = p_quote_id;
END;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_recompute(UUID) IS
  '@mola:{"expose":false,"kind":"write","permission":"canPriceParcels","confirm":false,"danger":false,"label":"Recalculer le total, l''encaissé et le statut d''un devis (helper interne)"}';
REVOKE ALL ON FUNCTION public.cargo_quote_recompute(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cargo_quote_recompute(UUID) FROM anon, authenticated;

-- 2.3 Une facture ne se modifie pas : ses lignes sont figées (on annule par un avoir).
CREATE OR REPLACE FUNCTION public.parcel_quote_lines_frozen_by_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_no TEXT;
BEGIN
  SELECT q.invoice_no INTO v_no FROM public.parcel_quotes q
   WHERE q.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.quote_id ELSE NEW.quote_id END;
  IF v_no IS NOT NULL THEN
    RAISE EXCEPTION USING
      MESSAGE = 'La facture ' || v_no || ' est établie : ses montants ne se modifient plus (une correction passe par un avoir)',
      ERRCODE = 'P0001';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$fn$;
REVOKE ALL ON FUNCTION public.parcel_quote_lines_frozen_by_invoice() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.parcel_quote_lines_frozen_by_invoice() FROM anon, authenticated;
COMMENT ON FUNCTION public.parcel_quote_lines_frozen_by_invoice() IS
  '@mola:{"expose":false,"kind":"write","permission":"canPriceParcels","confirm":false,"danger":false,"label":"Garde-fou : les lignes d''un devis facturé sont figées (déclencheur)"}';
DROP TRIGGER IF EXISTS parcel_quote_lines_frozen_by_invoice ON public.parcel_quote_lines;
CREATE TRIGGER parcel_quote_lines_frozen_by_invoice
  BEFORE INSERT OR UPDATE OR DELETE ON public.parcel_quote_lines
  FOR EACH ROW EXECUTE FUNCTION public.parcel_quote_lines_frozen_by_invoice();

-- 2.4 Établir la facture : quand tous les colis du dépôt sont arrivés à Douala, ou quand tout est payé.
CREATE OR REPLACE FUNCTION public.cargo_quote_invoice(p_quote_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_q public.parcel_quotes; v_no TEXT; v_waiting INTEGER; v_measure INTEGER; v_paid_full BOOLEAN;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canCollectParcelPayments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_q FROM public.parcel_quotes WHERE id = p_quote_id FOR UPDATE;
  IF v_q.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Devis introuvable'); END IF;
  IF v_q.invoice_no IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'invoice_no', v_q.invoice_no, 'quote', public.cargo_quote_json(v_q.id));
  END IF;
  IF EXISTS (SELECT 1 FROM public.parcel_deposits d WHERE d.id = v_q.deposit_id AND d.status = 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est supprimé');
  END IF;
  PERFORM public.cargo_quote_recompute(v_q.id);
  SELECT * INTO v_q FROM public.parcel_quotes WHERE id = p_quote_id;
  IF v_q.total_xaf <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Le devis n''a pas de montant'); END IF;

  v_paid_full := v_q.amount_paid_xaf >= v_q.total_xaf;
  -- Tout payé : la facture sort acquittée, comme avant (aucune autre condition — un devis réglé
  -- ne se complète plus, cargo_quote_ensure le laisse tel quel). Pas encore payé : à l'arrivée seulement,
  -- et sur un montant définitif.
  IF NOT v_paid_full THEN
    -- Un colis au kilo ou au m³ sans mesure : le montant n'est pas définitif.
    SELECT count(*) INTO v_measure FROM public.parcel_quote_lines l
     WHERE l.quote_id = v_q.id AND l.kind = 'parcel' AND l.basis <> 'fixed' AND (l.quantity IS NULL OR l.quantity <= 0);
    IF v_measure > 0 THEN
      RETURN jsonb_build_object('success', false, 'error', v_measure || ' colis reste(nt) à peser ou mesurer avant la facture');
    END IF;
    -- Un colis du dépôt sans ligne au devis : le devis est incomplet.
    IF EXISTS (SELECT 1 FROM public.parcels p WHERE p.deposit_id = v_q.deposit_id
                AND NOT EXISTS (SELECT 1 FROM public.parcel_quote_lines l WHERE l.quote_id = v_q.id AND l.parcel_id = p.id)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Des colis du dépôt ne sont pas au devis : complétez-le avant la facture');
    END IF;
    -- Le service est rendu quand les colis sont à Douala : arrivés, pointés ou remis.
    SELECT count(*) INTO v_waiting FROM public.parcels p
     WHERE p.deposit_id = v_q.deposit_id
       AND NOT (p.status IN ('arrived','delivered') OR p.checked_in_at IS NOT NULL OR p.delivered_at IS NOT NULL);
    IF v_waiting > 0 THEN
      RETURN jsonb_build_object('success', false, 'error',
        'La facture s''établit à l''arrivée à Douala : ' || v_waiting || ' colis ne sont pas encore arrivés (ou réglez d''abord le devis en entier)');
    END IF;
  END IF;

  v_no := public.cargo_next_invoice_no();
  UPDATE public.parcel_quotes SET invoice_no = v_no, invoiced_at = now(), invoiced_by = v_uid, updated_at = now() WHERE id = v_q.id;
  PERFORM public.cargo_quote_recompute(v_q.id);

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'issue_parcel_invoice', 'parcel_quote', v_q.id,
          jsonb_build_object('description', CASE WHEN v_paid_full THEN 'Facture acquittée ' ELSE 'Facture ' END || v_no || ' établie : ' || v_q.total_xaf || ' XAF (' || v_q.quote_no || ')'
                                            || CASE WHEN v_paid_full THEN '' ELSE ', reste ' || (v_q.total_xaf - v_q.amount_paid_xaf) || ' XAF à encaisser' END,
                             'invoice_no', v_no, 'quote_no', v_q.quote_no, 'deposit_id', v_q.deposit_id, 'total_xaf', v_q.total_xaf,
                             'paid_xaf', v_q.amount_paid_xaf, 'acquitted', v_paid_full));
  RETURN jsonb_build_object('success', true, 'invoice_no', v_no, 'quote', public.cargo_quote_json(v_q.id));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_invoice(UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canCollectParcelPayments","confirm":true,"danger":false,"label":"Établir la facture d''un dépôt (à l''arrivée des colis à Douala, ou une fois tout payé)"}';

-- 2.5 Encaisser : refusé seulement quand la facture est ACQUITTÉE (rien ne reste dû).
CREATE OR REPLACE FUNCTION public.cargo_quote_add_payment(
  p_quote_id UUID,
  p_amount_xaf NUMERIC,
  p_method TEXT DEFAULT 'cash',
  p_place TEXT DEFAULT 'guangzhou',
  p_paid_at TIMESTAMPTZ DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_proof_path TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_q public.parcel_quotes; v_balance NUMERIC; v_pm public.parcel_quote_payments;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canCollectParcelPayments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_amount_xaf IS NULL OR p_amount_xaf <= 0 OR p_amount_xaf <> round(p_amount_xaf) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant doit être un nombre entier de XAF, supérieur à zéro');
  END IF;
  IF p_method NOT IN ('cash','mobile_money','bank_transfer','other') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mode de paiement inconnu');
  END IF;
  IF p_place NOT IN ('guangzhou','douala','other') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lieu d''encaissement inconnu');
  END IF;
  IF p_paid_at IS NOT NULL AND p_paid_at > now() + interval '1 day' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La date du paiement est dans le futur');
  END IF;
  SELECT * INTO v_q FROM public.parcel_quotes WHERE id = p_quote_id FOR UPDATE;
  IF v_q.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Devis introuvable'); END IF;
  IF v_q.invoice_no IS NOT NULL AND v_q.amount_paid_xaf >= v_q.total_xaf THEN
    RETURN jsonb_build_object('success', false, 'error', 'La facture ' || v_q.invoice_no || ' est acquittée : ce dépôt est soldé');
  END IF;
  IF v_q.total_xaf <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Le devis n''a pas de montant : posez les prix d''abord'); END IF;
  v_balance := v_q.total_xaf - v_q.amount_paid_xaf;
  IF v_balance <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Ce devis est déjà soldé'); END IF;
  IF p_amount_xaf > v_balance THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant dépasse le reste à payer (' || v_balance || ' XAF)');
  END IF;

  -- La preuve : un objet que CET agent vient de déposer, sous ce devis, jamais réutilisé.
  IF NULLIF(TRIM(p_proof_path), '') IS NOT NULL THEN
    IF p_proof_path !~ ('^' || v_q.id::text || '/[A-Za-z0-9._-]+$') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Chemin de preuve invalide');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'parcel-payment-proofs' AND o.name = p_proof_path AND (o.owner = v_uid OR o.owner_id = v_uid::text)) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Preuve introuvable : reprenez la photo');
    END IF;
    IF EXISTS (SELECT 1 FROM public.parcel_quote_payments x WHERE x.proof_path = p_proof_path) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cette preuve est déjà rattachée à un encaissement');
    END IF;
  END IF;

  INSERT INTO public.parcel_quote_payments (quote_id, amount_xaf, method, place, paid_at, reference, proof_path, note, received_by)
  VALUES (v_q.id, p_amount_xaf, p_method, p_place, COALESCE(p_paid_at, now()),
          NULLIF(TRIM(p_reference), ''), NULLIF(TRIM(p_proof_path), ''), NULLIF(TRIM(p_note), ''), v_uid)
  RETURNING * INTO v_pm;
  PERFORM public.cargo_quote_recompute(v_q.id);

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'collect_parcel_payment', 'parcel_quote', v_q.id,
          jsonb_build_object('description', 'Encaissement ' || v_pm.receipt_no || ' : ' || p_amount_xaf || ' XAF sur ' || COALESCE(v_q.invoice_no, v_q.quote_no) || ' (' || p_method || ', ' || p_place || ')',
                             'receipt_no', v_pm.receipt_no, 'payment_id', v_pm.id, 'quote_no', v_q.quote_no, 'invoice_no', v_q.invoice_no, 'deposit_id', v_q.deposit_id,
                             'amount_xaf', p_amount_xaf, 'method', p_method, 'place', p_place, 'proof', v_pm.proof_path IS NOT NULL));
  RETURN jsonb_build_object('success', true, 'payment_id', v_pm.id, 'receipt_no', v_pm.receipt_no, 'quote', public.cargo_quote_json(v_q.id));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_add_payment(UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canCollectParcelPayments","confirm":true,"danger":true,"label":"Encaisser un paiement sur un devis ou une facture de colis (montant, mode, lieu, preuve)"}';

-- 2.6 Régler depuis le solde du client : même règle.
CREATE OR REPLACE FUNCTION public.cargo_quote_pay_from_wallet(
  p_quote_id UUID,
  p_amount_xaf NUMERIC,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_q public.parcel_quotes;
  v_dep public.parcel_deposits;
  v_wallet public.wallets;
  v_balance NUMERIC;
  v_floor NUMERIC;
  v_new NUMERIC;
  v_pm public.parcel_quote_payments;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canCollectParcelPayments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_amount_xaf IS NULL OR p_amount_xaf <= 0 OR p_amount_xaf <> round(p_amount_xaf) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant doit être un nombre entier de XAF, supérieur à zéro');
  END IF;

  SELECT * INTO v_q FROM public.parcel_quotes WHERE id = p_quote_id FOR UPDATE;
  IF v_q.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Devis introuvable'); END IF;
  IF v_q.invoice_no IS NOT NULL AND v_q.amount_paid_xaf >= v_q.total_xaf THEN
    RETURN jsonb_build_object('success', false, 'error', 'La facture ' || v_q.invoice_no || ' est acquittée : ce dépôt est soldé');
  END IF;
  IF v_q.total_xaf <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Le devis n''a pas de montant : posez les prix d''abord'); END IF;
  v_balance := v_q.total_xaf - v_q.amount_paid_xaf;
  IF v_balance <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Ce devis est déjà soldé'); END IF;
  IF p_amount_xaf > v_balance THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant dépasse le reste à payer (' || v_balance || ' XAF)');
  END IF;

  SELECT * INTO v_dep FROM public.parcel_deposits WHERE id = v_q.deposit_id;
  IF v_dep.client_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt n''est attribué à aucun client : attribuez-le avant de régler depuis un solde');
  END IF;

  -- Le portefeuille, verrouillé AVANT d'être lu ; jamais sous son plancher.
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_dep.client_user_id FOR UPDATE;
  IF v_wallet.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Ce client n''a pas de portefeuille'); END IF;
  v_floor := -COALESCE(v_wallet.overdraft_limit_xaf, 0);
  IF v_wallet.balance_xaf - p_amount_xaf < v_floor THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant',
      'available_xaf', v_wallet.balance_xaf - v_floor, 'balance_xaf', v_wallet.balance_xaf,
      'overdraft_limit_xaf', COALESCE(v_wallet.overdraft_limit_xaf, 0));
  END IF;
  v_new := v_wallet.balance_xaf - p_amount_xaf;
  UPDATE public.wallets SET balance_xaf = balance_xaf - p_amount_xaf, updated_at = now() WHERE id = v_wallet.id;

  INSERT INTO public.parcel_quote_payments (quote_id, amount_xaf, method, place, paid_at, reference, note, received_by)
  VALUES (v_q.id, p_amount_xaf, 'wallet', 'other', now(), 'Solde Bonzini', NULLIF(TRIM(p_note), ''), v_uid)
  RETURNING * INTO v_pm;

  INSERT INTO public.ledger_entries (wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
                                     reference_type, reference_id, description, created_by_admin_id, metadata)
  VALUES (v_wallet.id, v_dep.client_user_id, 'CARGO_FEES', p_amount_xaf, v_wallet.balance_xaf, v_new,
          'parcel_quote_payment', v_pm.id,
          'Frais de transport · ' || CASE WHEN v_q.invoice_no IS NOT NULL THEN 'facture ' || v_q.invoice_no ELSE 'devis ' || v_q.quote_no END
            || ' · reçu ' || v_pm.receipt_no || ' · dépôt ' || v_dep.deposit_no,
          v_uid,
          jsonb_build_object('quote_id', v_q.id, 'quote_no', v_q.quote_no, 'invoice_no', v_q.invoice_no, 'receipt_no', v_pm.receipt_no, 'deposit_no', v_dep.deposit_no,
                             'overdraft_used_xaf', GREATEST(0, -v_new)));

  PERFORM public.cargo_quote_recompute(v_q.id);

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'collect_parcel_payment', 'parcel_quote', v_q.id,
          jsonb_build_object('description', 'Encaissement ' || v_pm.receipt_no || ' : ' || p_amount_xaf || ' XAF sur ' || COALESCE(v_q.invoice_no, v_q.quote_no) || ' depuis le solde du client',
                             'receipt_no', v_pm.receipt_no, 'payment_id', v_pm.id, 'quote_no', v_q.quote_no, 'invoice_no', v_q.invoice_no, 'deposit_id', v_q.deposit_id,
                             'amount_xaf', p_amount_xaf, 'method', 'wallet', 'wallet_balance_before', v_wallet.balance_xaf, 'wallet_balance_after', v_new));
  RETURN jsonb_build_object('success', true, 'payment_id', v_pm.id, 'receipt_no', v_pm.receipt_no,
                            'wallet_balance_xaf', v_new, 'quote', public.cargo_quote_json(v_q.id));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_pay_from_wallet(UUID, NUMERIC, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canCollectParcelPayments","confirm":true,"danger":true,"label":"Régler un devis ou une facture de colis depuis le solde (portefeuille) du client"}';

-- 2.7 Annuler un encaissement : refusé quand la facture est acquittée (comme avant), permis tant qu'elle reste due.
CREATE OR REPLACE FUNCTION public.cargo_quote_cancel_payment(p_payment_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_pm public.parcel_quote_payments; v_q public.parcel_quotes; v_wallet public.wallets;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canCollectParcelPayments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF NULLIF(TRIM(p_reason), '') IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez pourquoi vous annulez cet encaissement');
  END IF;
  SELECT * INTO v_pm FROM public.parcel_quote_payments WHERE id = p_payment_id;
  IF v_pm.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Encaissement introuvable'); END IF;
  SELECT * INTO v_q FROM public.parcel_quotes WHERE id = v_pm.quote_id FOR UPDATE;
  IF v_q.invoice_no IS NOT NULL AND v_q.amount_paid_xaf >= v_q.total_xaf THEN
    RETURN jsonb_build_object('success', false, 'error', 'La facture ' || v_q.invoice_no || ' est acquittée : les encaissements ne se modifient plus');
  END IF;
  IF EXISTS (SELECT 1 FROM public.parcels p WHERE p.deposit_id = v_q.deposit_id AND p.delivered_at IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Des colis de ce dépôt ont déjà été remis : l''encaissement ne s''annule plus');
  END IF;
  SELECT * INTO v_pm FROM public.parcel_quote_payments WHERE id = p_payment_id FOR UPDATE;
  IF v_pm.cancelled_at IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Cet encaissement est déjà annulé'); END IF;

  -- Venu du solde : on rembourse le portefeuille qui a été DÉBITÉ (lu dans son
  -- écriture CARGO_FEES), pas celui du client actuel du dépôt. Verrouillé et
  -- vérifié AVANT d'annuler : sinon l'encaissement serait annulé sans remboursement.
  IF v_pm.method = 'wallet' THEN
    SELECT w.* INTO v_wallet
      FROM public.wallets w
     WHERE w.id = (SELECT le.wallet_id FROM public.ledger_entries le
                    WHERE le.reference_type = 'parcel_quote_payment' AND le.reference_id = v_pm.id
                      AND le.entry_type = 'CARGO_FEES'
                    ORDER BY le.created_at LIMIT 1)
       FOR UPDATE;
    IF v_wallet.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Portefeuille débité introuvable : impossible de rembourser'); END IF;
  END IF;

  UPDATE public.parcel_quote_payments
     SET cancelled_at = now(), cancelled_by = v_uid, cancel_reason = TRIM(p_reason)
   WHERE id = v_pm.id;

  IF v_pm.method = 'wallet' THEN
    UPDATE public.wallets SET balance_xaf = balance_xaf + v_pm.amount_xaf, updated_at = now() WHERE id = v_wallet.id;
    INSERT INTO public.ledger_entries (wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
                                       reference_type, reference_id, description, created_by_admin_id, metadata)
    VALUES (v_wallet.id, v_wallet.user_id, 'PAYMENT_CANCELLED_REFUNDED', v_pm.amount_xaf, v_wallet.balance_xaf, v_wallet.balance_xaf + v_pm.amount_xaf,
            'parcel_quote_payment', v_pm.id,
            'Remboursement frais de transport · reçu ' || v_pm.receipt_no || ' annulé : ' || TRIM(p_reason),
            v_uid, jsonb_build_object('quote_no', v_q.quote_no, 'invoice_no', v_q.invoice_no, 'receipt_no', v_pm.receipt_no, 'reason', TRIM(p_reason)));
  END IF;

  PERFORM public.cargo_quote_recompute(v_q.id);

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'cancel_parcel_payment', 'parcel_quote', v_q.id,
          jsonb_build_object('description', 'Encaissement ' || v_pm.receipt_no || ' annulé (' || v_pm.amount_xaf || ' XAF) : ' || TRIM(p_reason),
                             'receipt_no', v_pm.receipt_no, 'payment_id', v_pm.id, 'quote_no', v_q.quote_no, 'invoice_no', v_q.invoice_no, 'deposit_id', v_q.deposit_id,
                             'amount_xaf', v_pm.amount_xaf, 'reason', TRIM(p_reason), 'refunded_to_wallet', v_pm.method = 'wallet'));
  RETURN jsonb_build_object('success', true, 'quote', public.cargo_quote_json(v_q.id));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_cancel_payment(UUID, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canCollectParcelPayments","confirm":true,"danger":true,"label":"Annuler un encaissement sur un devis de colis (motif obligatoire ; un encaissement au solde est remboursé au portefeuille)"}';

-- 2.8 Le client est prévenu : une facture à régler (à l'arrivée), ou acquittée (tout payé).
CREATE OR REPLACE FUNCTION public.parcel_quotes_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_user UUID; v_dep TEXT; v_n INTEGER; v_meta JSONB; v_balance NUMERIC;
BEGIN
  SELECT d.client_user_id, d.deposit_no, (SELECT count(*) FROM public.parcels p WHERE p.deposit_id = d.id) INTO v_user, v_dep, v_n
  FROM public.parcel_deposits d WHERE d.id = NEW.deposit_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;
  v_balance := GREATEST(NEW.total_xaf - NEW.amount_paid_xaf, 0);
  v_meta := jsonb_build_object('deposit_id', NEW.deposit_id, 'deposit_no', v_dep, 'quote_id', NEW.id, 'quote_no', NEW.quote_no,
                               'amount_xaf', NEW.total_xaf, 'paid_xaf', NEW.amount_paid_xaf, 'balance_xaf', v_balance,
                               'parcel_count', v_n, 'reference', NEW.quote_no);
  -- Envoyé (la première fois, ou renvoyé après modification).
  IF NEW.sent_at IS DISTINCT FROM OLD.sent_at AND NEW.sent_at IS NOT NULL THEN
    PERFORM public.cargo_notify_client(v_user, 'parcel_quote_sent',
      'Votre devis ' || NEW.quote_no,
      'Votre devis pour ' || v_n || ' colis (' || v_dep || ') est prêt : ' || public.cargo_fmt_xaf(NEW.total_xaf) || ' XAF. Réglez avant le départ de Chine ou au retrait à Douala.',
      v_meta);
  END IF;
  -- La facture.
  IF NEW.invoice_no IS NOT NULL AND OLD.invoice_no IS NULL THEN
    IF v_balance > 0 THEN
      PERFORM public.cargo_notify_client(v_user, 'parcel_invoice_issued',
        'Facture ' || NEW.invoice_no,
        'Vos ' || v_n || ' colis (' || v_dep || ') sont arrivés à Douala. Votre facture ' || NEW.invoice_no || ' est disponible : ' || public.cargo_fmt_xaf(v_balance) || ' XAF à régler avant le retrait.',
        v_meta || jsonb_build_object('invoice_no', NEW.invoice_no, 'reference', NEW.invoice_no));
    ELSE
      PERFORM public.cargo_notify_client(v_user, 'parcel_invoice_issued',
        'Facture acquittée ' || NEW.invoice_no,
        'Tout est réglé pour vos ' || v_n || ' colis (' || v_dep || ') : ' || public.cargo_fmt_xaf(NEW.total_xaf) || ' XAF. Votre facture acquittée ' || NEW.invoice_no || ' est disponible.',
        v_meta || jsonb_build_object('invoice_no', NEW.invoice_no, 'reference', NEW.invoice_no));
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Le relevé d'un client : chaque dépôt avec son devis et ses transports
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reception_client_deposits(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT (public.admin_has_permission(auth.uid(), 'canViewCargo') OR public.admin_has_permission(auth.uid(), 'canViewClients') OR public.admin_has_permission(auth.uid(), 'canReceiveParcels')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  RETURN jsonb_build_object('success', true, 'deposits', COALESCE((
    SELECT jsonb_agg(
      public.reception_deposit_json(d.id)
      || jsonb_build_object(
        'quote_status', q.status, 'quote_no', q.quote_no, 'quote_total_xaf', q.total_xaf,
        'quote_paid_xaf', q.amount_paid_xaf, 'invoice_no', q.invoice_no,
        -- Où voyagent ses colis, et quand ils arrivent : la date relevée, sinon celle de l'armateur, sinon la promesse.
        'containers', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'ref', cs.container_number, 'status', cs.status, 'vessel_name', cs.vessel_name,
            'etd', COALESCE((cs.etd_actual AT TIME ZONE 'Asia/Shanghai')::date, cs.etd_promised),
            'eta', COALESCE((cs.eta_manual AT TIME ZONE 'Africa/Douala')::date, (cs.eta_carrier AT TIME ZONE 'Africa/Douala')::date, cs.eta_promised)
          ) ORDER BY cs.container_number)
          FROM public.cargo_shipments cs
          WHERE cs.id IN (SELECT pc.shipment_id FROM public.parcels pc WHERE pc.deposit_id = d.id AND pc.shipment_id IS NOT NULL)), '[]'::jsonb),
        'flights', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'ref', a.awb_number, 'status', a.status, 'airline', a.airline, 'flight_no', a.flight_no,
            'etd', COALESCE((a.departed_at AT TIME ZONE 'Asia/Shanghai')::date, a.etd),
            'eta', COALESCE((a.arrived_at AT TIME ZONE 'Africa/Douala')::date, a.eta)
          ) ORDER BY a.awb_number)
          FROM public.air_shipments a
          WHERE a.id IN (SELECT pa.air_shipment_id FROM public.parcels pa WHERE pa.deposit_id = d.id AND pa.air_shipment_id IS NOT NULL)), '[]'::jsonb)
      )
      ORDER BY d.opened_at DESC)
    FROM public.parcel_deposits d
    LEFT JOIN public.parcel_quotes q ON q.deposit_id = d.id
    WHERE d.client_user_id = p_user_id AND d.status <> 'cancelled'
  ), '[]'::jsonb));
END;
$fn$;
COMMENT ON FUNCTION public.reception_client_deposits(UUID) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Les colis reçus d''un client (tous ses dépôts, avec devis, facture, conteneurs et vols)","resolve":{"p_user_id":"client"}}';
