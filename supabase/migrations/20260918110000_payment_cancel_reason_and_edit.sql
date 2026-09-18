-- ============================================================
-- PAIEMENTS : annuler avec un motif (même « effectué »), corriger un
-- paiement EN COURS sans être super admin — 18/09/2026
--
-- Deux demandes du terrain :
--   1. « Un paiement créé par erreur doit pouvoir être annulé, même s'il a
--      été marqué effectué » — sinon il reste sur le relevé du client.
--      `cancel_payment` accepte déjà tout statut non remboursé ; il gagne
--      un MOTIF (obligatoire) conservé sur la ligne (`cancelled_reason`,
--      `cancelled_at`, `cancelled_by`), une notification au client et une
--      écriture relative du solde.
--   2. « Un paiement en cours doit pouvoir être modifié : bénéficiaire,
--      montant en yuans, montant en XAF, taux ». Le bénéficiaire passe déjà
--      par `admin_update_payment_beneficiary` ; les montants exigeaient le
--      rôle super_admin quel que soit le statut. Désormais :
--        · paiement NON terminal → `canProcessPayments` suffit (l'agent qui
--          a saisi le paiement corrige sa propre faute de frappe) ;
--        · paiement terminal (effectué / rejeté / annulé) → super_admin.
--      Le débit complémentaire respecte le plancher de découvert.
--
-- Idempotent. `cancel_payment(uuid)` est SUPPRIMÉE avant la nouvelle
-- signature (uuid, text) : un appel `{p_payment_id}` seul reste valide
-- grâce à la valeur par défaut, aucune surcharge ambiguë ne subsiste.
-- ============================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. cancel_payment(p_payment_id, p_reason)
-- ─────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.cancel_payment(uuid);

CREATE OR REPLACE FUNCTION public.cancel_payment(p_payment_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id    UUID;
  v_payment     RECORD;
  v_wallet      RECORD;
  v_new_balance BIGINT;
  v_reason      TEXT;
BEGIN
  v_admin_id := auth.uid();

  -- Réservé au super admin : `canManageUsers` est la permission propre à ce rôle.
  IF NOT public.admin_has_permission(v_admin_id, 'canManageUsers') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul le super admin peut annuler des paiements');
  END IF;

  v_reason := NULLIF(btrim(COALESCE(p_reason, '')), '');

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;

  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;

  -- Statuts déjà remboursés : les rouvrir laisserait le client garder le
  -- remboursement ET l'opération.
  IF v_payment.status IN ('rejected', 'cancelled_by_admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Impossible d''annuler un paiement en statut "' || v_payment.status || '" (déjà remboursé)'
    );
  END IF;

  -- Annuler un paiement déjà effectué est une décision comptable : le motif
  -- est obligatoire, il figure sur la timeline et dans l'audit.
  IF v_payment.status = 'completed' AND v_reason IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un motif est obligatoire pour annuler un paiement déjà effectué');
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_payment.user_id FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet non trouvé');
  END IF;

  v_new_balance := v_wallet.balance_xaf + v_payment.amount_xaf;

  INSERT INTO public.ledger_entries (
    wallet_id, user_id, entry_type, amount_xaf,
    balance_before, balance_after,
    reference_type, reference_id,
    description, metadata, created_by_admin_id
  ) VALUES (
    v_wallet.id, v_payment.user_id, 'PAYMENT_CANCELLED_REFUNDED', v_payment.amount_xaf,
    v_wallet.balance_xaf, v_new_balance,
    'payment', p_payment_id,
    'Annulation paiement - Réf: ' || COALESCE(v_payment.reference, p_payment_id::text)
      || CASE WHEN v_reason IS NOT NULL THEN ' - ' || v_reason ELSE '' END,
    jsonb_build_object(
      'reason', COALESCE(v_reason, 'cancelled_by_admin'),
      'original_status', v_payment.status,
      'method', v_payment.method,
      'amount_rmb', v_payment.amount_rmb,
      'was_completed', (v_payment.status = 'completed')
    ),
    v_admin_id
  );

  UPDATE public.wallets
  SET balance_xaf = balance_xaf + v_payment.amount_xaf, updated_at = now()
  WHERE id = v_wallet.id;

  UPDATE public.payments
  SET status = 'cancelled_by_admin',
      cancelled_reason = v_reason,
      cancelled_at = now(),
      cancelled_by = v_admin_id,
      updated_at = now()
  WHERE id = p_payment_id;

  -- Totaux du lot, s'il y en a un : la ligne annulée n'y compte plus.
  IF v_payment.batch_id IS NOT NULL THEN
    UPDATE public.payment_batches
    SET total_amount_xaf = GREATEST(0, total_amount_xaf - v_payment.amount_xaf),
        total_amount_rmb = GREATEST(0, total_amount_rmb - COALESCE(v_payment.amount_rmb, 0))
    WHERE id = v_payment.batch_id;
  END IF;

  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (
    p_payment_id, 'cancelled_by_admin',
    CASE WHEN v_payment.status = 'completed'
         THEN 'Paiement effectué annulé par le super admin — ' || v_reason
         ELSE 'Paiement annulé par le super admin' || CASE WHEN v_reason IS NOT NULL THEN ' — ' || v_reason ELSE '' END END,
    v_admin_id
  );

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'cancel_payment', 'payment', p_payment_id,
    jsonb_build_object(
      'reference',          v_payment.reference,
      'amount_xaf',         v_payment.amount_xaf,
      'amount_rmb',         v_payment.amount_rmb,
      'user_id',            v_payment.user_id,
      'status_at_cancel',   v_payment.status,
      'reason',             v_reason,
      'wallet_refunded',    true,
      'balance_before',     v_wallet.balance_xaf,
      'balance_after',      v_new_balance
    )
  );

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    v_payment.user_id,
    'payment_cancelled',
    'Paiement annulé',
    format('Le paiement %s de %s XAF a été annulé et le montant recrédité sur votre compte.',
      COALESCE(v_payment.reference, ''),
      to_char(v_payment.amount_xaf, 'FM999G999G999')),
    jsonb_build_object(
      'payment_id', p_payment_id,
      'reference', v_payment.reference,
      'amount_xaf', v_payment.amount_xaf,
      'new_balance', v_new_balance,
      'reason', v_reason
    )
  );

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance, 'was_completed', (v_payment.status = 'completed'));
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_payment(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.cancel_payment(uuid, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canProcessPayments","confirm":true,"danger":true,"label":"Annuler un paiement, même effectué (rembourse ; p_reason: motif)","resolve":{"p_payment_id":"payment"},"tool":"cancel_payment"}';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. admin_correct_payment — montants / taux, ouvert aux paiements en cours
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_correct_payment(
  p_payment_id uuid, p_reason text,
  p_amount_xaf bigint DEFAULT NULL::bigint, p_amount_rmb numeric DEFAULT NULL::numeric,
  p_exchange_rate numeric DEFAULT NULL::numeric, p_rate_is_custom boolean DEFAULT NULL::boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_id    UUID;
  v_payment     RECORD;
  v_wallet      RECORD;
  v_delta       BIGINT := 0;
  v_floor       BIGINT;
  v_debit_held  BOOLEAN;
  v_terminal    BOOLEAN;
  v_new_balance BIGINT;
  v_changes     jsonb := '{}'::jsonb;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.admin_has_permission(v_admin_id, 'canProcessPayments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un motif de correction est obligatoire');
  END IF;

  IF p_amount_xaf IS NULL AND p_amount_rmb IS NULL AND p_exchange_rate IS NULL AND p_rate_is_custom IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucune modification demandée');
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;

  -- Un paiement clos (effectué, rejeté, annulé) ne se corrige qu'en super admin.
  v_terminal := v_payment.status IN ('completed', 'rejected', 'cancelled_by_admin');
  IF v_terminal AND NOT public.admin_has_permission(v_admin_id, 'canManageUsers') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul le super admin peut corriger un paiement déjà clos');
  END IF;

  -- Garde-fous montant : entier positif, sans plafond (décision du 14/09/2026).
  IF p_amount_xaf IS NOT NULL AND p_amount_xaf <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant XAF invalide');
  END IF;
  IF p_amount_rmb IS NOT NULL AND p_amount_rmb <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant RMB invalide');
  END IF;
  IF p_exchange_rate IS NOT NULL AND p_exchange_rate <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Taux invalide');
  END IF;

  -- Le débit est-il encore « détenu » par ce paiement ?
  -- (rejected / cancelled_by_admin ont déjà été remboursés)
  v_debit_held := v_payment.status NOT IN ('rejected', 'cancelled_by_admin');

  -- ── Correction du montant XAF (mouvement d'argent) ─────────
  IF p_amount_xaf IS NOT NULL AND p_amount_xaf <> v_payment.amount_xaf THEN
    v_delta := p_amount_xaf - v_payment.amount_xaf;

    IF v_debit_held THEN
      SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_payment.user_id FOR UPDATE;
      IF v_wallet IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet non trouvé');
      END IF;

      v_floor := -COALESCE(v_wallet.overdraft_limit_xaf, 0);
      IF v_delta > 0 AND v_wallet.balance_xaf - v_delta < v_floor THEN
        RETURN jsonb_build_object('success', false, 'error',
          'Solde insuffisant pour le débit complémentaire de ' || v_delta || ' XAF (disponible: ' || (v_wallet.balance_xaf - v_floor) || ' XAF)',
          'available_xaf', v_wallet.balance_xaf - v_floor,
          'overdraft_limit_xaf', COALESCE(v_wallet.overdraft_limit_xaf, 0));
      END IF;

      v_new_balance := v_wallet.balance_xaf - v_delta;

      INSERT INTO public.ledger_entries (
        wallet_id, user_id, entry_type, amount_xaf,
        balance_before, balance_after,
        reference_type, reference_id,
        description, metadata, created_by_admin_id
      ) VALUES (
        v_wallet.id, v_payment.user_id,
        CASE WHEN v_delta > 0 THEN 'ADMIN_DEBIT' ELSE 'ADMIN_CREDIT' END,
        abs(v_delta),
        v_wallet.balance_xaf, v_new_balance,
        'payment', p_payment_id,
        'Correction paiement - Réf: ' || COALESCE(v_payment.reference, p_payment_id::text),
        jsonb_build_object(
          'reason', p_reason,
          'correction', true,
          'old_amount_xaf', v_payment.amount_xaf,
          'new_amount_xaf', p_amount_xaf,
          'payment_status', v_payment.status,
          'overdraft_used_xaf', GREATEST(0, -v_new_balance)
        ),
        v_admin_id
      );

      UPDATE public.wallets
      SET balance_xaf = balance_xaf - v_delta, updated_at = now()
      WHERE id = v_wallet.id;

      UPDATE public.payments
      SET balance_after = balance_after - v_delta
      WHERE id = p_payment_id AND balance_after IS NOT NULL;
    END IF;

    UPDATE public.payments SET amount_xaf = p_amount_xaf, updated_at = now() WHERE id = p_payment_id;
    v_changes := v_changes || jsonb_build_object('amount_xaf', jsonb_build_object('old', v_payment.amount_xaf, 'new', p_amount_xaf));

    IF v_payment.batch_id IS NOT NULL THEN
      UPDATE public.payment_batches
      SET total_amount_xaf = total_amount_xaf + v_delta
      WHERE id = v_payment.batch_id;
    END IF;
  END IF;

  -- ── Corrections d'affichage (aucun mouvement d'argent) ─────
  IF p_amount_rmb IS NOT NULL AND p_amount_rmb <> v_payment.amount_rmb THEN
    UPDATE public.payments SET amount_rmb = p_amount_rmb, updated_at = now() WHERE id = p_payment_id;
    v_changes := v_changes || jsonb_build_object('amount_rmb', jsonb_build_object('old', v_payment.amount_rmb, 'new', p_amount_rmb));
    IF v_payment.batch_id IS NOT NULL THEN
      UPDATE public.payment_batches
      SET total_amount_rmb = total_amount_rmb + (p_amount_rmb - v_payment.amount_rmb)
      WHERE id = v_payment.batch_id;
    END IF;
  END IF;

  IF p_exchange_rate IS NOT NULL AND p_exchange_rate <> v_payment.exchange_rate THEN
    UPDATE public.payments SET exchange_rate = p_exchange_rate, updated_at = now() WHERE id = p_payment_id;
    v_changes := v_changes || jsonb_build_object('exchange_rate', jsonb_build_object('old', v_payment.exchange_rate, 'new', p_exchange_rate));
  END IF;

  IF p_rate_is_custom IS NOT NULL AND p_rate_is_custom <> COALESCE(v_payment.rate_is_custom, false) THEN
    UPDATE public.payments SET rate_is_custom = p_rate_is_custom, updated_at = now() WHERE id = p_payment_id;
    v_changes := v_changes || jsonb_build_object('rate_is_custom', jsonb_build_object('old', v_payment.rate_is_custom, 'new', p_rate_is_custom));
  END IF;

  IF v_changes = '{}'::jsonb THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucune valeur ne change');
  END IF;

  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (
    p_payment_id, 'admin_corrected',
    CASE WHEN v_terminal THEN 'Paiement corrigé par le super admin — ' ELSE 'Paiement modifié par l''équipe — ' END || p_reason,
    v_admin_id
  );

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id, 'correct_payment', 'payment', p_payment_id,
    jsonb_build_object(
      'reference', v_payment.reference,
      'reason', p_reason,
      'status_at_correction', v_payment.status,
      'wallet_delta_xaf', CASE WHEN v_debit_held THEN v_delta ELSE 0 END,
      'changes', v_changes
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'changes', v_changes,
    'wallet_delta_xaf', CASE WHEN v_debit_held THEN v_delta ELSE 0 END
  );
END;
$function$;

COMMENT ON FUNCTION public.admin_correct_payment(UUID, TEXT, BIGINT, NUMERIC, NUMERIC, BOOLEAN) IS
  '@mola:{"expose":true,"kind":"write","permission":"canProcessPayments","confirm":true,"danger":true,"label":"Modifier les montants / le taux d''un paiement (p_reason: motif)","resolve":{"p_payment_id":"payment"}}';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. admin_update_payment_beneficiary — verrou avant lecture
--    (même corps que le vivant, + FOR UPDATE : deux modifications
--    simultanées se sérialisent au lieu de s'écraser)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_payment_beneficiary(
  p_payment_id uuid, p_beneficiary_name text DEFAULT NULL::text, p_beneficiary_phone text DEFAULT NULL::text,
  p_beneficiary_email text DEFAULT NULL::text, p_beneficiary_qr_code_url text DEFAULT NULL::text,
  p_beneficiary_bank_name text DEFAULT NULL::text, p_beneficiary_bank_account text DEFAULT NULL::text,
  p_beneficiary_notes text DEFAULT NULL::text, p_beneficiary_identifier text DEFAULT NULL::text,
  p_beneficiary_identifier_type text DEFAULT NULL::text, p_beneficiary_bank_extra text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id  UUID := auth.uid();
  v_payment    RECORD;
  v_new_status payment_status;
BEGIN
  IF NOT public.admin_has_permission(v_caller_id, 'canProcessPayments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission refusée');
  END IF;

  SELECT id, status, method INTO v_payment
  FROM payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement introuvable');
  END IF;

  IF v_payment.status IN (
    'completed'::payment_status,
    'rejected'::payment_status,
    'cancelled_by_admin'::payment_status
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Impossible de modifier un paiement finalisé');
  END IF;

  v_new_status := v_payment.status;

  IF v_payment.status = 'waiting_beneficiary_info'::payment_status THEN
    IF v_payment.method IN ('alipay', 'wechat')
       AND (p_beneficiary_qr_code_url IS NOT NULL
            OR p_beneficiary_phone IS NOT NULL
            OR p_beneficiary_email IS NOT NULL
            OR p_beneficiary_identifier IS NOT NULL) THEN
      v_new_status := 'ready_for_payment'::payment_status;
    ELSIF v_payment.method = 'bank_transfer'
          AND p_beneficiary_name IS NOT NULL
          AND p_beneficiary_bank_name IS NOT NULL
          AND p_beneficiary_bank_account IS NOT NULL THEN
      v_new_status := 'ready_for_payment'::payment_status;
    END IF;
  END IF;

  UPDATE payments SET
    beneficiary_name            = COALESCE(p_beneficiary_name,            beneficiary_name),
    beneficiary_phone           = COALESCE(p_beneficiary_phone,           beneficiary_phone),
    beneficiary_email           = COALESCE(p_beneficiary_email,           beneficiary_email),
    beneficiary_qr_code_url     = COALESCE(p_beneficiary_qr_code_url,     beneficiary_qr_code_url),
    beneficiary_bank_name       = COALESCE(p_beneficiary_bank_name,       beneficiary_bank_name),
    beneficiary_bank_account    = COALESCE(p_beneficiary_bank_account,    beneficiary_bank_account),
    beneficiary_notes           = COALESCE(p_beneficiary_notes,           beneficiary_notes),
    beneficiary_identifier      = COALESCE(p_beneficiary_identifier,      beneficiary_identifier),
    beneficiary_identifier_type = COALESCE(p_beneficiary_identifier_type, beneficiary_identifier_type),
    beneficiary_bank_extra      = COALESCE(p_beneficiary_bank_extra,      beneficiary_bank_extra),
    status                      = v_new_status,
    updated_at                  = NOW()
  WHERE id = p_payment_id;

  INSERT INTO payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (
    p_payment_id,
    'admin_beneficiary_update',
    'Infos bénéficiaire mises à jour par un administrateur',
    v_caller_id
  );

  IF v_new_status = 'ready_for_payment'::payment_status
     AND v_payment.status = 'waiting_beneficiary_info'::payment_status THEN
    INSERT INTO payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (
      p_payment_id,
      'info_provided',
      'Informations bénéficiaire complétées — paiement prêt',
      v_caller_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'new_status', v_new_status::text
  );
END;
$function$;
