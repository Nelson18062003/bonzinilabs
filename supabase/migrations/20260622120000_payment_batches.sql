-- ============================================================
-- Paiements groupés (bulk payments) — fondation
--
-- Un « lot » (payment_batch) regroupe plusieurs paiements réels (une ligne par
-- bénéficiaire), payés ensemble depuis le wallet d'UN client (étape 1 : mono-client).
-- Chaque ligne reste un paiement à part entière : statut, bénéficiaire figé,
-- preuves, reçu, remboursement — tout réutilise le module paiement existant.
-- Le wallet est débité à la création (modèle de réservation, PAYMENT_RESERVED),
-- comme pour un paiement unique ; chaque ligne se rembourse indépendamment au refus.
--
-- Sécurité : UN seul verrou FOR UPDATE sur le wallet + UNE seule vérification de
-- solde pour le total du lot (anti double-dépense), création tout-ou-rien.
-- ============================================================

-- ============================================
-- 1. Table payment_batches (en-tête de lot)
-- ============================================
CREATE TABLE IF NOT EXISTS public.payment_batches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference        TEXT NOT NULL,                 -- BZ-PB-YYYY-NNNN
  user_id          UUID NOT NULL,                 -- client dont le wallet finance le lot
  created_by       UUID,                          -- admin créateur
  note             TEXT,
  total_amount_xaf BIGINT NOT NULL DEFAULT 0 CHECK (total_amount_xaf >= 0),
  total_amount_rmb NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (total_amount_rmb >= 0),
  line_count       INT NOT NULL DEFAULT 0 CHECK (line_count >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_batches_user_id ON public.payment_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_batches_created_at ON public.payment_batches(created_at DESC);

ALTER TABLE public.payment_batches ENABLE ROW LEVEL SECURITY;

-- Admins : accès complet (l'app admin lit/écrit via supabaseAdmin).
DROP POLICY IF EXISTS payment_batches_admin_all ON public.payment_batches;
CREATE POLICY payment_batches_admin_all ON public.payment_batches
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Clients : lecture de leurs propres lots (app client).
DROP POLICY IF EXISTS payment_batches_client_select ON public.payment_batches;
CREATE POLICY payment_batches_client_select ON public.payment_batches
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 2. Lien payments.batch_id (nullable : les paiements unitaires existants ne changent pas)
--    ON DELETE SET NULL : on ne cascade JAMAIS la suppression sur des paiements (argent).
-- ============================================
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.payment_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_batch_id ON public.payments(batch_id);

-- ============================================
-- 3. generate_payment_reference() — passe en génération ATOMIQUE
--    (corrige la course du compteur COUNT(*) — réf. dupliquées possibles).
--    Même motif éprouvé que generate_deposit_reference() : verrou de table
--    SHARE UPDATE EXCLUSIVE (sérialise UNIQUEMENT la génération de réf., ne
--    bloque ni les INSERT/UPDATE ni les SELECT ... FOR UPDATE concurrents).
--    Format de sortie INCHANGÉ : BZ-PY-YYYY-NNNN.
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_payment_reference()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_max_num INT;
  v_reference TEXT;
BEGIN
  v_year := to_char(now(), 'YYYY');

  LOCK TABLE public.payments IN SHARE UPDATE EXCLUSIVE MODE;

  SELECT COALESCE(
    MAX(NULLIF(regexp_replace(reference, '^BZ-PY-' || v_year || '-', ''), reference)::int),
    0
  ) + 1 INTO v_max_num
  FROM public.payments
  WHERE reference LIKE 'BZ-PY-' || v_year || '-%';

  v_reference := 'BZ-PY-' || v_year || '-' || lpad(v_max_num::text, 4, '0');
  RETURN v_reference;
END;
$$;

-- ============================================
-- 4. generate_payment_batch_reference() — réf. de lot atomique (BZ-PB-YYYY-NNNN)
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_payment_batch_reference()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_max_num INT;
  v_reference TEXT;
BEGIN
  v_year := to_char(now(), 'YYYY');

  LOCK TABLE public.payment_batches IN SHARE UPDATE EXCLUSIVE MODE;

  SELECT COALESCE(
    MAX(NULLIF(regexp_replace(reference, '^BZ-PB-' || v_year || '-', ''), reference)::int),
    0
  ) + 1 INTO v_max_num
  FROM public.payment_batches
  WHERE reference LIKE 'BZ-PB-' || v_year || '-%';

  v_reference := 'BZ-PB-' || v_year || '-' || lpad(v_max_num::text, 4, '0');
  RETURN v_reference;
END;
$$;

-- ============================================
-- 5. create_payment_batch() — crée un lot mono-client, tout-ou-rien
--    p_lines : tableau JSONB. Chaque ligne :
--      { method, amount_xaf, amount_rmb, exchange_rate, rate_is_custom,
--        beneficiary_name, beneficiary_phone, beneficiary_email,
--        beneficiary_qr_code_url, beneficiary_bank_name, beneficiary_bank_account,
--        beneficiary_bank_extra, beneficiary_notes, beneficiary_identifier,
--        beneficiary_identifier_type, beneficiary_id, beneficiary_details,
--        cash_beneficiary_type, cash_beneficiary_first_name,
--        cash_beneficiary_last_name, cash_beneficiary_phone, client_visible_comment }
-- ============================================
CREATE OR REPLACE FUNCTION public.create_payment_batch(
  p_user_id UUID,
  p_lines JSONB,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Autorisation : admin uniquement
  IF NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  -- Payload de lignes valide ?
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

  -- Vérification UNIQUE du solde pour le total du lot (atomique, sous le verrou)
  IF v_wallet.balance_xaf < v_total_xaf THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Solde client insuffisant',
      'required_xaf', v_total_xaf,
      'available_xaf', v_wallet.balance_xaf
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

    -- Réservation des fonds de la ligne (ledger)
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
        'batch_reference', v_batch_reference
      )
    );

    -- Timeline
    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (v_payment_id, 'created', 'Paiement créé (lot ' || v_batch_reference || ') - Montant réservé', v_admin_id);

    IF NOT v_has_benef AND v_method <> 'cash' THEN
      INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
      VALUES (v_payment_id, 'waiting_info', 'En attente des informations du bénéficiaire', v_admin_id);
    END IF;
  END LOOP;

  -- Débit UNIQUE du wallet vers le solde final (verrou tenu pendant tout le lot)
  UPDATE public.wallets
  SET balance_xaf = v_balance, updated_at = now()
  WHERE id = v_wallet.id;

  -- Journal d'audit (un seul pour le lot)
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
      'balance_after', v_balance
    )
  );

  -- Notification client (une seule pour le lot)
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
$$;

COMMENT ON FUNCTION public.create_payment_batch(UUID, JSONB, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canProcessPayments","confirm":true,"danger":true,"label":"Créer un paiement groupé (plusieurs bénéficiaires, un seul client)","resolve":{"p_user_id":"client"}}';

NOTIFY pgrst, 'reload schema';
