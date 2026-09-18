-- ============================================================
-- DÉCOUVERT AUTORISÉ (solde négatif) — décision du 18/09/2026
--
-- L'activité l'exige : un client dépose 500 000, règle ses factures, puis
-- une facture de 20 000 arrive alors que le solde ne suffit plus. Elle doit
-- pouvoir être payée QUAND MÊME, sur décision du super admin, et le solde
-- passer en négatif — visible partout (fiche client, relevé, app client).
--
-- Modèle : une AUTORISATION DE DÉCOUVERT portée par le portefeuille
-- (`wallets.overdraft_limit_xaf`, 0 par défaut = aucun découvert), posée par
-- une action du super admin (`admin_set_wallet_overdraft`, permission
-- `canGrantOverdraft`). Tous les débits ADMIN (paiement pour un client, lot,
-- débit manuel, correction de montant, annulation de dépôt) respectent le
-- plancher `balance_xaf >= -overdraft_limit_xaf`. Les paiements que le
-- client crée LUI-MÊME dans son app (`create_payment`) restent bornés par
-- son solde positif : seule une action de l'équipe consomme le découvert.
--
-- Ce que ça change côté schéma :
--   · `wallets` : 4 colonnes (plafond, note, qui, quand) ;
--   · la contrainte `balance_xaf >= 0` devient `balance_xaf >= -plafond` ;
--   · `payments.balance_before/after` peuvent être négatifs (instantanés) ;
--   · `admin_has_permission` connaît `canGrantOverdraft` (super_admin) —
--     la matrice `ROLE_PERMISSIONS` (AdminAuthContext.tsx) et celle de la
--     passerelle Mola sont mises à jour dans le même commit ;
--   · 6 RPC redéfinies COMPLÈTEMENT depuis leur corps VIVANT (les correctifs
--     posés « en place » — FOR UPDATE, montants > 0 — sont reconduits).
--
-- Aucun nouveau type d'écriture au grand livre : un paiement en découvert
-- reste un PAYMENT_RESERVED dont `balance_after` est négatif.
-- `check_wallet_reconciliation` reste donc juste. Idempotent.
-- ============================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Schéma
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS overdraft_limit_xaf BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overdraft_note TEXT,
  ADD COLUMN IF NOT EXISTS overdraft_set_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS overdraft_set_at TIMESTAMPTZ;

ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_balance_xaf_check;
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_overdraft_limit_check;
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_balance_floor_check;
ALTER TABLE public.wallets
  ADD CONSTRAINT wallets_overdraft_limit_check CHECK (overdraft_limit_xaf >= 0),
  -- Le plancher : jamais plus bas que le découvert autorisé. Les RPC le
  -- vérifient avant d'écrire (message lisible) ; la contrainte est le
  -- filet en cas d'oubli.
  ADD CONSTRAINT wallets_balance_floor_check CHECK (balance_xaf >= -overdraft_limit_xaf);

COMMENT ON COLUMN public.wallets.overdraft_limit_xaf IS
  'Découvert autorisé (XAF). 0 = aucun. Le solde peut descendre jusqu''à -overdraft_limit_xaf sur action de l''équipe uniquement.';

-- Les instantanés « solde avant / après » d'un paiement suivent le solde.
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS check_payments_balance_before_nonneg;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS check_payments_balance_after_nonneg;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Permission `canGrantOverdraft` (super_admin uniquement)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_has_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND (ur.is_disabled = false OR ur.is_disabled IS NULL)
      AND CASE _permission
        WHEN 'canViewClients'       THEN ur.role::text IN ('super_admin','ops','support','customer_success')
        WHEN 'canEditClients'       THEN ur.role::text IN ('super_admin','support','customer_success')
        WHEN 'canViewDeposits'      THEN ur.role::text IN ('super_admin','ops','support','customer_success')
        WHEN 'canProcessDeposits'   THEN ur.role::text IN ('super_admin','ops','customer_success')
        WHEN 'canViewPayments'      THEN ur.role::text IN ('super_admin','ops','support','customer_success','cash_agent')
        WHEN 'canProcessPayments'   THEN ur.role::text IN ('super_admin','ops','cash_agent')
        WHEN 'canManageRates'       THEN ur.role::text IN ('super_admin','ops')
        WHEN 'canViewLogs'          THEN ur.role::text IN ('super_admin','ops','support')
        WHEN 'canManageUsers'       THEN ur.role::text IN ('super_admin')
        WHEN 'canViewTreasury'      THEN ur.role::text IN ('super_admin','treasurer')
        WHEN 'canManageTreasury'    THEN ur.role::text IN ('super_admin','treasurer')
        WHEN 'canAccessSupportChat' THEN ur.role::text IN ('super_admin','ops','support','customer_success')
        WHEN 'canAdjustWallets'     THEN ur.role::text IN ('super_admin','ops')
        WHEN 'canViewCargo'         THEN ur.role::text IN ('super_admin','ops','support','customer_success')
        WHEN 'canManageCargo'       THEN ur.role::text IN ('super_admin','ops')
        WHEN 'canGrantOverdraft'    THEN ur.role::text IN ('super_admin')
        ELSE false
      END
  );
$fn$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Autoriser / modifier / retirer un découvert
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_wallet_overdraft(
  p_user_id UUID,
  p_limit_xaf BIGINT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_admin_id UUID := auth.uid();
  v_wallet   RECORD;
  v_used     BIGINT;
BEGIN
  IF NOT public.admin_has_permission(v_admin_id, 'canGrantOverdraft') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul le super admin peut autoriser un découvert');
  END IF;

  IF p_limit_xaf IS NULL OR p_limit_xaf < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le plafond de découvert doit être un montant positif ou nul');
  END IF;

  IF p_limit_xaf > 0 AND (p_reason IS NULL OR btrim(p_reason) = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un motif est obligatoire pour autoriser un découvert');
  END IF;

  -- Verrou AVANT lecture : le solde lu sert à décider.
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille non trouvé');
  END IF;

  v_used := GREATEST(0, -v_wallet.balance_xaf);
  IF p_limit_xaf < v_used THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Le client utilise déjà ' || replace(to_char(v_used, 'FM999G999G999G999'), ',', ' ') || ' XAF de découvert : le plafond ne peut pas descendre en dessous',
      'overdraft_used_xaf', v_used
    );
  END IF;

  UPDATE public.wallets
  SET overdraft_limit_xaf = p_limit_xaf,
      overdraft_note      = NULLIF(btrim(COALESCE(p_reason, '')), ''),
      overdraft_set_by    = v_admin_id,
      overdraft_set_at    = now(),
      updated_at          = now()
  WHERE id = v_wallet.id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'set_wallet_overdraft', 'wallet', v_wallet.id,
    jsonb_build_object(
      'user_id', p_user_id,
      'previous_limit_xaf', v_wallet.overdraft_limit_xaf,
      'new_limit_xaf', p_limit_xaf,
      'balance_xaf', v_wallet.balance_xaf,
      'overdraft_used_xaf', v_used,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'overdraft_limit_xaf', p_limit_xaf,
    'previous_limit_xaf', v_wallet.overdraft_limit_xaf,
    'balance_xaf', v_wallet.balance_xaf,
    'overdraft_used_xaf', v_used
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_wallet_overdraft(UUID, BIGINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_wallet_overdraft(UUID, BIGINT, TEXT) TO authenticated;

-- Étiquette Mola (convention AI-native) : action sensible → confirm + danger.
COMMENT ON FUNCTION public.admin_set_wallet_overdraft(UUID, BIGINT, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canGrantOverdraft","confirm":true,"danger":true,"label":"Autoriser ou modifier le découvert d''un client (p_limit_xaf: plafond, 0 = retirer)","resolve":{"p_user_id":"client"}}';

-- ─────────────────────────────────────────────────────────────────────────
-- 4. create_admin_payment — paiement pour un client, jusqu'au plancher
--    (= corps vivant du 18/09 + plancher de découvert)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_admin_payment(
  p_user_id uuid, p_amount_xaf bigint, p_amount_rmb numeric, p_exchange_rate numeric, p_method payment_method,
  p_beneficiary_name text DEFAULT NULL::text, p_beneficiary_phone text DEFAULT NULL::text,
  p_beneficiary_email text DEFAULT NULL::text, p_beneficiary_qr_code_url text DEFAULT NULL::text,
  p_beneficiary_bank_name text DEFAULT NULL::text, p_beneficiary_bank_account text DEFAULT NULL::text,
  p_beneficiary_notes text DEFAULT NULL::text, p_client_visible_comment text DEFAULT NULL::text,
  p_desired_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_beneficiary_id uuid DEFAULT NULL::uuid, p_beneficiary_details jsonb DEFAULT NULL::jsonb,
  p_rate_is_custom boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id UUID;
  v_wallet RECORD;
  v_new_balance BIGINT;
  v_floor BIGINT;
  v_payment_id UUID;
  v_reference TEXT;
  v_status payment_status;
  v_has_beneficiary_info BOOLEAN;
  v_created_at TIMESTAMP WITH TIME ZONE;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.admin_has_permission(v_admin_id, 'canProcessPayments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  IF p_amount_xaf IS NULL OR p_amount_xaf <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant doit être positif');
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille client non trouvé');
  END IF;

  -- Plancher : le solde, plus le découvert autorisé par le super admin.
  v_floor := -COALESCE(v_wallet.overdraft_limit_xaf, 0);
  IF v_wallet.balance_xaf - p_amount_xaf < v_floor THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', CASE WHEN COALESCE(v_wallet.overdraft_limit_xaf, 0) > 0
                    THEN 'Solde client insuffisant, découvert autorisé compris'
                    ELSE 'Solde client insuffisant' END,
      'available_xaf', v_wallet.balance_xaf - v_floor,
      'balance_xaf', v_wallet.balance_xaf,
      'overdraft_limit_xaf', COALESCE(v_wallet.overdraft_limit_xaf, 0)
    );
  END IF;

  v_new_balance := v_wallet.balance_xaf - p_amount_xaf;
  v_reference := generate_payment_reference();

  v_has_beneficiary_info := (
    p_beneficiary_id IS NOT NULL OR
    p_beneficiary_qr_code_url IS NOT NULL OR
    p_beneficiary_name IS NOT NULL OR
    p_beneficiary_bank_account IS NOT NULL OR
    p_method = 'cash'
  );

  IF v_has_beneficiary_info OR p_method = 'cash' THEN
    v_status := 'ready_for_payment';
  ELSE
    v_status := 'waiting_beneficiary_info';
  END IF;

  v_created_at := COALESCE(p_desired_date, now());

  INSERT INTO public.payments (
    user_id, reference, amount_xaf, amount_rmb, exchange_rate, method, status,
    beneficiary_name, beneficiary_phone, beneficiary_email, beneficiary_qr_code_url,
    beneficiary_bank_name, beneficiary_bank_account, beneficiary_notes,
    balance_before, balance_after, client_visible_comment, created_at,
    beneficiary_id, beneficiary_details, rate_is_custom
  ) VALUES (
    p_user_id, v_reference, p_amount_xaf, p_amount_rmb, p_exchange_rate, p_method, v_status,
    p_beneficiary_name, p_beneficiary_phone, p_beneficiary_email, p_beneficiary_qr_code_url,
    p_beneficiary_bank_name, p_beneficiary_bank_account, p_beneficiary_notes,
    v_wallet.balance_xaf, v_new_balance, p_client_visible_comment, v_created_at,
    p_beneficiary_id, p_beneficiary_details, p_rate_is_custom
  ) RETURNING id INTO v_payment_id;

  -- Écriture RELATIVE, sous le verrou pris plus haut.
  UPDATE public.wallets
  SET balance_xaf = balance_xaf - p_amount_xaf, updated_at = now()
  WHERE id = v_wallet.id;

  INSERT INTO public.ledger_entries (
    wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
    reference_type, reference_id, description, created_by_admin_id,
    metadata, created_at
  ) VALUES (
    v_wallet.id, p_user_id, 'PAYMENT_RESERVED', p_amount_xaf,
    v_wallet.balance_xaf, v_new_balance, 'payment', v_payment_id,
    'Paiement ' || v_reference,
    v_admin_id,
    jsonb_build_object(
      'method', p_method::text,
      'amount_rmb', p_amount_rmb,
      'exchange_rate', p_exchange_rate,
      'admin_created', true,
      'rate_is_custom', p_rate_is_custom,
      'overdraft_used_xaf', GREATEST(0, -v_new_balance)
    ),
    v_created_at
  );

  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by, created_at)
  VALUES (v_payment_id, 'created',
    CASE WHEN v_new_balance < 0
         THEN 'Paiement créé par l''équipe Bonzini - Montant réservé (découvert autorisé)'
         ELSE 'Paiement créé par l''équipe Bonzini - Montant réservé' END,
    v_admin_id, v_created_at);

  IF NOT v_has_beneficiary_info AND p_method != 'cash' THEN
    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by, created_at)
    VALUES (v_payment_id, 'waiting_info', 'En attente des informations du bénéficiaire', v_admin_id, v_created_at);
  END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'create_payment_for_client', 'payment', v_payment_id,
    jsonb_build_object(
      'client_user_id', p_user_id,
      'amount_xaf', p_amount_xaf,
      'amount_rmb', p_amount_rmb,
      'exchange_rate', p_exchange_rate,
      'method', p_method,
      'balance_before', v_wallet.balance_xaf,
      'balance_after', v_new_balance,
      'overdraft_used_xaf', GREATEST(0, -v_new_balance),
      'rate_is_custom', p_rate_is_custom,
      'beneficiary_id', p_beneficiary_id
    )
  );

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    p_user_id,
    'payment_created',
    'Nouveau paiement',
    format('Un paiement de %s XAF (%s RMB) a été créé pour vous. Référence: %s',
      to_char(p_amount_xaf, 'FM999G999G999'),
      to_char(p_amount_rmb, 'FM999G999G990D00'),
      v_reference),
    jsonb_build_object(
      'payment_id', v_payment_id,
      'reference', v_reference,
      'amount_xaf', p_amount_xaf,
      'amount_rmb', p_amount_rmb,
      'new_balance', v_new_balance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'reference', v_reference,
    'new_balance', v_new_balance,
    'overdraft_used_xaf', GREATEST(0, -v_new_balance)
  );
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. create_payment_batch — lot, plancher sur le TOTAL
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_payment_batch(p_user_id uuid, p_lines jsonb, p_note text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id UUID;
  v_wallet RECORD;
  v_line JSONB;
  v_line_count INT;
  v_total_xaf BIGINT := 0;
  v_total_rmb NUMERIC(15,2) := 0;
  v_amount_xaf BIGINT;
  v_amount_rmb NUMERIC;
  v_balance BIGINT;
  v_balance_before BIGINT;
  v_floor BIGINT;
  v_batch_id UUID;
  v_batch_reference TEXT;
  v_payment_id UUID;
  v_payment_reference TEXT;
  v_method payment_method;
  v_status payment_status;
  v_has_benef BOOLEAN;
  v_payment_ids UUID[] := '{}';
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.admin_has_permission(v_admin_id, 'canProcessPayments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Liste de paiements invalide');
  END IF;

  v_line_count := jsonb_array_length(p_lines);
  IF v_line_count < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Au moins un bénéficiaire est requis');
  END IF;

  -- Verrou pessimiste UNIQUE sur le wallet du client (anti double-dépense)
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille client non trouvé');
  END IF;

  -- ── PASSE 1 : valider chaque ligne + calculer le total (aucune écriture) ──
  FOR v_line IN SELECT line FROM jsonb_array_elements(p_lines) AS t(line)
  LOOP
    v_amount_xaf := NULLIF(v_line->>'amount_xaf', '')::bigint;
    v_amount_rmb := COALESCE(NULLIF(v_line->>'amount_rmb', '')::numeric, 0);

    IF v_amount_xaf IS NULL OR v_amount_xaf <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Chaque ligne doit avoir un montant XAF positif');
    END IF;
    IF v_amount_rmb <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Chaque ligne doit avoir un montant RMB positif');
    END IF;
    IF NOT (COALESCE(v_line->>'method','') IN ('alipay','wechat','bank_transfer','cash')) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Méthode de paiement invalide');
    END IF;

    v_total_xaf := v_total_xaf + v_amount_xaf;
    v_total_rmb := v_total_rmb + v_amount_rmb;
  END LOOP;

  -- Vérification UNIQUE du plancher pour le total du lot (atomique, sous le verrou)
  v_floor := -COALESCE(v_wallet.overdraft_limit_xaf, 0);
  IF v_wallet.balance_xaf - v_total_xaf < v_floor THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', CASE WHEN COALESCE(v_wallet.overdraft_limit_xaf, 0) > 0
                    THEN 'Solde client insuffisant, découvert autorisé compris'
                    ELSE 'Solde client insuffisant' END,
      'required_xaf', v_total_xaf,
      'available_xaf', v_wallet.balance_xaf - v_floor,
      'balance_xaf', v_wallet.balance_xaf,
      'overdraft_limit_xaf', COALESCE(v_wallet.overdraft_limit_xaf, 0)
    );
  END IF;

  -- En-tête de lot
  v_batch_reference := public.generate_payment_batch_reference();
  INSERT INTO public.payment_batches (
    reference, user_id, created_by, note, total_amount_xaf, total_amount_rmb, line_count
  ) VALUES (
    v_batch_reference, p_user_id, v_admin_id, NULLIF(btrim(COALESCE(p_note,'')), ''),
    v_total_xaf, v_total_rmb, v_line_count
  ) RETURNING id INTO v_batch_id;

  -- ── PASSE 2 : créer chaque paiement, en débitant le solde courant ──
  v_balance := v_wallet.balance_xaf;

  FOR v_line IN SELECT line FROM jsonb_array_elements(p_lines) AS t(line)
  LOOP
    v_amount_xaf := (v_line->>'amount_xaf')::bigint;
    v_amount_rmb := (v_line->>'amount_rmb')::numeric;
    v_method := (v_line->>'method')::payment_method;

    v_balance_before := v_balance;
    v_balance := v_balance - v_amount_xaf;

    v_payment_reference := public.generate_payment_reference();

    v_has_benef := (
      NULLIF(v_line->>'beneficiary_qr_code_url','') IS NOT NULL OR
      NULLIF(v_line->>'beneficiary_name','') IS NOT NULL OR
      NULLIF(v_line->>'beneficiary_bank_account','') IS NOT NULL OR
      NULLIF(v_line->>'beneficiary_identifier','') IS NOT NULL OR
      v_method = 'cash'
    );
    v_status := CASE WHEN v_has_benef THEN 'ready_for_payment'::payment_status
                     ELSE 'waiting_beneficiary_info'::payment_status END;

    INSERT INTO public.payments (
      user_id, batch_id, reference, amount_xaf, amount_rmb, exchange_rate, method, status,
      beneficiary_name, beneficiary_phone, beneficiary_email, beneficiary_qr_code_url,
      beneficiary_bank_name, beneficiary_bank_account, beneficiary_bank_extra, beneficiary_notes,
      beneficiary_identifier, beneficiary_identifier_type, beneficiary_id, beneficiary_details,
      cash_beneficiary_type, cash_beneficiary_first_name, cash_beneficiary_last_name, cash_beneficiary_phone,
      rate_is_custom, balance_before, balance_after, client_visible_comment
    ) VALUES (
      p_user_id, v_batch_id, v_payment_reference, v_amount_xaf, v_amount_rmb,
      COALESCE(NULLIF(v_line->>'exchange_rate','')::numeric, 0), v_method, v_status,
      NULLIF(v_line->>'beneficiary_name',''), NULLIF(v_line->>'beneficiary_phone',''),
      NULLIF(v_line->>'beneficiary_email',''), NULLIF(v_line->>'beneficiary_qr_code_url',''),
      NULLIF(v_line->>'beneficiary_bank_name',''), NULLIF(v_line->>'beneficiary_bank_account',''),
      NULLIF(v_line->>'beneficiary_bank_extra',''), NULLIF(v_line->>'beneficiary_notes',''),
      NULLIF(v_line->>'beneficiary_identifier',''), NULLIF(v_line->>'beneficiary_identifier_type',''),
      NULLIF(v_line->>'beneficiary_id','')::uuid,
      CASE WHEN v_line ? 'beneficiary_details' AND jsonb_typeof(v_line->'beneficiary_details') = 'object'
           THEN v_line->'beneficiary_details' ELSE NULL END,
      NULLIF(v_line->>'cash_beneficiary_type',''), NULLIF(v_line->>'cash_beneficiary_first_name',''),
      NULLIF(v_line->>'cash_beneficiary_last_name',''), NULLIF(v_line->>'cash_beneficiary_phone',''),
      COALESCE((v_line->>'rate_is_custom')::boolean, false),
      v_balance_before, v_balance, NULLIF(v_line->>'client_visible_comment','')
    ) RETURNING id INTO v_payment_id;

    v_payment_ids := array_append(v_payment_ids, v_payment_id);

    INSERT INTO public.ledger_entries (
      wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
      reference_type, reference_id, description, created_by_admin_id, metadata
    ) VALUES (
      v_wallet.id, p_user_id, 'PAYMENT_RESERVED', v_amount_xaf,
      v_balance_before, v_balance, 'payment', v_payment_id,
      'Paiement ' || v_payment_reference || ' (lot ' || v_batch_reference || ')',
      v_admin_id,
      jsonb_build_object(
        'method', v_method::text,
        'amount_rmb', v_amount_rmb,
        'exchange_rate', COALESCE(NULLIF(v_line->>'exchange_rate','')::numeric, 0),
        'admin_created', true,
        'batch_id', v_batch_id,
        'batch_reference', v_batch_reference,
        'overdraft_used_xaf', GREATEST(0, -v_balance)
      )
    );

    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (v_payment_id, 'created', 'Paiement créé (lot ' || v_batch_reference || ') - Montant réservé', v_admin_id);

    IF NOT v_has_benef AND v_method <> 'cash' THEN
      INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
      VALUES (v_payment_id, 'waiting_info', 'En attente des informations du bénéficiaire', v_admin_id);
    END IF;
  END LOOP;

  -- Débit UNIQUE du wallet (écriture relative, verrou tenu pendant tout le lot)
  UPDATE public.wallets
  SET balance_xaf = balance_xaf - v_total_xaf, updated_at = now()
  WHERE id = v_wallet.id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'create_payment_batch', 'payment_batch', v_batch_id,
    jsonb_build_object(
      'client_user_id', p_user_id,
      'batch_reference', v_batch_reference,
      'line_count', v_line_count,
      'total_amount_xaf', v_total_xaf,
      'total_amount_rmb', v_total_rmb,
      'balance_before', v_wallet.balance_xaf,
      'balance_after', v_balance,
      'overdraft_used_xaf', GREATEST(0, -v_balance)
    )
  );

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    p_user_id,
    'payment_created',
    'Nouveau paiement groupé',
    format('Un paiement groupé %s de %s bénéficiaire(s) pour un total de %s XAF a été créé.',
      v_batch_reference,
      v_line_count::text,
      to_char(v_total_xaf, 'FM999G999G999')),
    jsonb_build_object(
      'batch_id', v_batch_id,
      'batch_reference', v_batch_reference,
      'line_count', v_line_count,
      'total_amount_xaf', v_total_xaf,
      'new_balance', v_balance
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'batch_id', v_batch_id,
    'batch_reference', v_batch_reference,
    'line_count', v_line_count,
    'total_amount_xaf', v_total_xaf,
    'total_amount_rmb', v_total_rmb,
    'new_balance', v_balance,
    'payment_ids', to_jsonb(v_payment_ids)
  );
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. admin_adjust_wallet — débit manuel (Mola / ajustement rapide)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(p_user_id uuid, p_amount numeric, p_adjustment_type text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id UUID;
  v_wallet RECORD;
  v_new_balance BIGINT;
  v_amount_xaf BIGINT;
  v_floor BIGINT;
  v_entry_type public.ledger_entry_type;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.admin_has_permission(v_admin_id, 'canAdjustWallets') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille non trouvé');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Le montant doit être strictement positif');
  END IF;

  v_amount_xaf := p_amount::BIGINT;
  v_floor := -COALESCE(v_wallet.overdraft_limit_xaf, 0);

  IF p_adjustment_type = 'credit' THEN
    v_new_balance := v_wallet.balance_xaf + v_amount_xaf;
    v_entry_type := 'ADMIN_CREDIT';
  ELSIF p_adjustment_type = 'debit' THEN
    IF v_wallet.balance_xaf - v_amount_xaf < v_floor THEN
      RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant',
        'available_xaf', v_wallet.balance_xaf - v_floor,
        'overdraft_limit_xaf', COALESCE(v_wallet.overdraft_limit_xaf, 0));
    END IF;
    v_new_balance := v_wallet.balance_xaf - v_amount_xaf;
    v_entry_type := 'ADMIN_DEBIT';
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Type d''ajustement invalide');
  END IF;

  UPDATE wallets SET balance_xaf = v_new_balance, updated_at = now() WHERE id = v_wallet.id;

  INSERT INTO public.ledger_entries (
    wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
    reference_type, description, created_by_admin_id,
    metadata
  ) VALUES (
    v_wallet.id, p_user_id, v_entry_type, v_amount_xaf,
    v_wallet.balance_xaf, v_new_balance, 'adjustment',
    p_reason,
    v_admin_id,
    jsonb_build_object('adjustment_type', p_adjustment_type, 'overdraft_used_xaf', GREATEST(0, -v_new_balance))
  );

  INSERT INTO admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'admin_adjust_wallet', 'wallet', v_wallet.id,
    jsonb_build_object(
      'user_id', p_user_id,
      'adjustment_type', p_adjustment_type,
      'amount', v_amount_xaf,
      'balance_before', v_wallet.balance_xaf,
      'balance_after', v_new_balance,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'message', 'Ajustement effectué'
  );
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. create_wallet_adjustment — débit depuis la fiche client
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_wallet_adjustment(p_user_id uuid, p_adjustment_type character varying, p_amount_xaf bigint, p_reason text, p_proof_urls text[] DEFAULT '{}'::text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id UUID;
  v_wallet RECORD;
  v_balance_before BIGINT;
  v_balance_after BIGINT;
  v_floor BIGINT;
  v_entry_type ledger_entry_type;
  v_ledger_entry_id UUID;
  v_adjustment_id UUID;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.admin_has_permission(v_admin_id, 'canAdjustWallets') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  IF p_adjustment_type NOT IN ('CREDIT', 'DEBIT') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type d''ajustement invalide');
  END IF;

  IF p_amount_xaf IS NULL OR p_amount_xaf <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant doit être positif');
  END IF;

  IF p_reason IS NULL OR p_reason = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le motif est obligatoire');
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille non trouvé');
  END IF;

  v_balance_before := v_wallet.balance_xaf;
  v_floor := -COALESCE(v_wallet.overdraft_limit_xaf, 0);

  IF p_adjustment_type = 'CREDIT' THEN
    v_balance_after := v_balance_before + p_amount_xaf;
    v_entry_type := 'ADMIN_CREDIT';
  ELSE
    IF v_balance_before - p_amount_xaf < v_floor THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Solde insuffisant',
        'current_balance', v_balance_before,
        'requested_amount', p_amount_xaf,
        'available_xaf', v_balance_before - v_floor,
        'overdraft_limit_xaf', COALESCE(v_wallet.overdraft_limit_xaf, 0)
      );
    END IF;
    v_balance_after := v_balance_before - p_amount_xaf;
    v_entry_type := 'ADMIN_DEBIT';
  END IF;

  INSERT INTO public.ledger_entries (
    wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
    reference_type, description, metadata, created_by_admin_id
  ) VALUES (
    v_wallet.id, p_user_id, v_entry_type, p_amount_xaf, v_balance_before, v_balance_after,
    'adjustment', p_reason,
    jsonb_build_object('proof_urls', p_proof_urls, 'overdraft_used_xaf', GREATEST(0, -v_balance_after)),
    v_admin_id
  )
  RETURNING id INTO v_ledger_entry_id;

  INSERT INTO public.wallet_adjustments (
    wallet_id, user_id, adjustment_type, amount_xaf, reason, proof_urls, ledger_entry_id, created_by_admin_id
  ) VALUES (
    v_wallet.id, p_user_id, p_adjustment_type, p_amount_xaf, p_reason, p_proof_urls, v_ledger_entry_id, v_admin_id
  )
  RETURNING id INTO v_adjustment_id;

  UPDATE public.wallets
  SET balance_xaf = v_balance_after,
      updated_at = NOW()
  WHERE id = v_wallet.id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id,
    CASE WHEN p_adjustment_type = 'CREDIT' THEN 'WALLET_CREDITED' ELSE 'WALLET_DEBITED' END,
    'WALLET',
    v_wallet.id,
    jsonb_build_object(
      'adjustment_id', v_adjustment_id,
      'user_id', p_user_id,
      'adjustment_type', p_adjustment_type,
      'amount_xaf', p_amount_xaf,
      'balance_before', v_balance_before,
      'balance_after', v_balance_after,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'adjustment_id', v_adjustment_id,
    'ledger_entry_id', v_ledger_entry_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after
  );
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. cancel_deposit — reverser un dépôt validé, jusqu'au plancher
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_deposit(p_deposit_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id  UUID;
  v_deposit   RECORD;
  v_wallet    RECORD;
  v_floor     BIGINT;
  v_new_balance BIGINT;
BEGIN
  v_admin_id := auth.uid();

  -- Réservé au super admin : `canManageUsers` est la permission propre à ce rôle.
  IF NOT public.admin_has_permission(v_admin_id, 'canManageUsers') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul le super admin peut annuler des dépôts');
  END IF;

  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt non trouvé');
  END IF;

  IF v_deposit.status IN ('cancelled', 'cancelled_by_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est déjà annulé');
  END IF;

  IF v_deposit.status = 'validated' THEN
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_deposit.user_id FOR UPDATE;

    IF v_wallet IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Wallet non trouvé');
    END IF;

    v_floor := -COALESCE(v_wallet.overdraft_limit_xaf, 0);
    IF v_wallet.balance_xaf - v_deposit.amount_xaf < v_floor THEN
      RETURN jsonb_build_object('success', false, 'error',
        'Solde insuffisant pour annuler ce dépôt. Solde: ' || v_wallet.balance_xaf || ' XAF, à reverser: ' || v_deposit.amount_xaf
        || ' XAF' || CASE WHEN COALESCE(v_wallet.overdraft_limit_xaf, 0) > 0
                          THEN ' (découvert autorisé: ' || v_wallet.overdraft_limit_xaf || ' XAF)' ELSE '' END);
    END IF;

    v_new_balance := v_wallet.balance_xaf - v_deposit.amount_xaf;

    INSERT INTO public.ledger_entries (
      wallet_id, user_id, entry_type, amount_xaf,
      balance_before, balance_after,
      reference_type, reference_id,
      description, metadata, created_by_admin_id
    ) VALUES (
      v_wallet.id, v_deposit.user_id, 'ADMIN_DEBIT', v_deposit.amount_xaf,
      v_wallet.balance_xaf, v_new_balance,
      'deposit', p_deposit_id,
      'Annulation dépôt - Réf: ' || COALESCE(v_deposit.reference, p_deposit_id::text),
      jsonb_build_object(
        'reason', 'cancelled_by_admin',
        'original_status', v_deposit.status,
        'method', v_deposit.method,
        'overdraft_used_xaf', GREATEST(0, -v_new_balance)
      ),
      v_admin_id
    );

    UPDATE public.wallets
    SET balance_xaf = balance_xaf - v_deposit.amount_xaf, updated_at = now()
    WHERE id = v_wallet.id;
  END IF;

  UPDATE public.deposits
  SET status = 'cancelled_by_admin', updated_at = now()
  WHERE id = p_deposit_id;

  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description)
  VALUES (p_deposit_id, 'cancelled_by_admin', 'Dépôt annulé par le super admin');

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'cancel_deposit', 'deposit', p_deposit_id,
    jsonb_build_object(
      'reference',          v_deposit.reference,
      'amount_xaf',         v_deposit.amount_xaf,
      'user_id',            v_deposit.user_id,
      'status_at_cancel',   v_deposit.status,
      'was_validated',      (v_deposit.status = 'validated'),
      'wallet_reversed',    (v_deposit.status = 'validated')
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$function$;
