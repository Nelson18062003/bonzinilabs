-- ============================================================================
-- Cargo · Phase 2 — les encaissements, le reste à payer, la facture acquittée
--
-- Le devis (phase 1) dit combien. Ici on encaisse : un ou plusieurs
-- paiements, chacun avec sa preuve (photo du reçu Mobile Money, du bordereau
-- de virement, du billet), son reçu numéroté (RE-000123) et son lieu — avant
-- le départ de Chine (Guangzhou) ou au retrait (Douala). Le devis suit :
-- « reste à payer », puis « payé » quand la somme y est, puis « facturé » quand
-- on établit la FACTURE ACQUITTÉE (FA-000123), le document final du client.
--
-- Qui : canCollectParcelPayments (super_admin, ops). L'agent d'entrepôt du
-- Cameroun (phase 4) la recevra aussi : à Douala, la même personne remet les
-- colis et encaisse. Le réceptionnaire ne voit rien de tout ça.
--
--   1. permission canCollectParcelPayments (admin_has_permission)
--   2. table parcel_quote_payments + colonnes facture sur parcel_quotes
--   3. seau parcel-payment-proofs (privé)
--   4. helpers : recompute (total, encaissé, statut) et json (avec paiements)
--   5. RPC : cargo_quote_add_payment / cancel_payment / invoice
--   6. reception_overview porte l'encaissé par dépôt
--
-- Idempotent. Suppose 20260921130000_cargo_pricing_quotes.sql passée.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Permission — miroir de ROLE_PERMISSIONS (AdminAuthContext.tsx)
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
        WHEN 'canReceiveParcels'    THEN ur.role::text IN ('super_admin','ops','receptionist')
        WHEN 'canRegisterClients'   THEN ur.role::text IN ('super_admin','ops','support','customer_success','receptionist')
        WHEN 'canPriceParcels'      THEN ur.role::text IN ('super_admin','ops')
        WHEN 'canCollectParcelPayments' THEN ur.role::text IN ('super_admin','ops')
        ELSE false
      END
  );
$fn$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Les encaissements et la facture
-- ─────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.parcel_receipt_no_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.parcel_invoice_no_seq START 1;

CREATE TABLE IF NOT EXISTS public.parcel_quote_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id      UUID NOT NULL REFERENCES public.parcel_quotes(id) ON DELETE CASCADE,
  receipt_no    TEXT NOT NULL UNIQUE DEFAULT ('RE-' || lpad(nextval('public.parcel_receipt_no_seq')::text, 6, '0')),
  amount_xaf    NUMERIC(14,0) NOT NULL CHECK (amount_xaf > 0),
  -- cash : espèces · mobile_money : Orange Money, MTN MoMo, WeChat Pay, Alipay… · bank_transfer : virement · other
  method        TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','mobile_money','bank_transfer','other')),
  -- guangzhou : avant le départ · douala : au retrait · other : ailleurs (agence, en ligne)
  place         TEXT NOT NULL DEFAULT 'guangzhou' CHECK (place IN ('guangzhou','douala','other')),
  paid_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reference     TEXT,                       -- n° de transaction Mobile Money, référence de virement
  proof_path    TEXT,                       -- parcel-payment-proofs/<devis>/<horodatage>.jpg
  note          TEXT,
  received_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Un encaissement ne s'efface pas : il s'annule, avec un motif, et reste visible.
  cancelled_at  TIMESTAMPTZ,
  cancelled_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancel_reason TEXT
);
CREATE INDEX IF NOT EXISTS parcel_quote_payments_quote_idx ON public.parcel_quote_payments (quote_id, paid_at);

ALTER TABLE public.parcel_quotes ADD COLUMN IF NOT EXISTS paid_at     TIMESTAMPTZ;
ALTER TABLE public.parcel_quotes ADD COLUMN IF NOT EXISTS invoice_no  TEXT UNIQUE;
ALTER TABLE public.parcel_quotes ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;
ALTER TABLE public.parcel_quotes ADD COLUMN IF NOT EXISTS invoiced_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.parcel_quote_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS parcel_quote_payments_staff_read ON public.parcel_quote_payments;
CREATE POLICY parcel_quote_payments_staff_read ON public.parcel_quote_payments FOR SELECT TO authenticated
  USING (public.admin_has_permission(auth.uid(), 'canViewCargo'));
-- Aucune écriture directe : tout passe par les RPC ci-dessous.

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Les preuves de paiement (photos), seau privé
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('parcel-payment-proofs', 'parcel-payment-proofs', false, 10485760, ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Collectors can upload parcel payment proofs" ON storage.objects;
CREATE POLICY "Collectors can upload parcel payment proofs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'parcel-payment-proofs' AND public.admin_has_permission(auth.uid(), 'canCollectParcelPayments')
              AND name ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]+$');
DROP POLICY IF EXISTS "Staff can view parcel payment proofs" ON storage.objects;
CREATE POLICY "Staff can view parcel payment proofs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'parcel-payment-proofs' AND public.admin_has_permission(auth.uid(), 'canViewCargo'));

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Helpers internes
-- ─────────────────────────────────────────────────────────────────────────

-- 4.1 Recalculer un devis : le total (lignes), l'encaissé (paiements non
--     annulés) et le statut qui en découle.
--       invoiced : facture établie — définitif
--       paid     : encaissé ≥ total (> 0)
--       sent     : envoyé, pas encore soldé
--       draft    : jamais envoyé
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
    WHEN v_q.invoice_no IS NOT NULL THEN 'invoiced'
    WHEN v_total > 0 AND v_paid >= v_total THEN 'paid'
    WHEN v_q.sent_at IS NOT NULL THEN 'sent'
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

-- 4.2 Sérialiser un devis, désormais avec ses paiements, le reste à payer et la facture.
CREATE OR REPLACE FUNCTION public.cargo_quote_json(p_quote_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id', q.id, 'quote_no', q.quote_no, 'deposit_id', q.deposit_id, 'status', q.status, 'currency', q.currency,
    'total_xaf', q.total_xaf, 'amount_paid_xaf', q.amount_paid_xaf,
    'balance_xaf', GREATEST(q.total_xaf - q.amount_paid_xaf, 0),
    'notes', q.notes,
    'sent_at', q.sent_at, 'paid_at', q.paid_at,
    'invoice_no', q.invoice_no, 'invoiced_at', q.invoiced_at,
    'created_at', q.created_at, 'updated_at', q.updated_at,
    'deposit_no', d.deposit_no, 'location', d.location, 'opened_at', d.opened_at, 'closed_at', d.closed_at,
    'client', public.reception_client_card(d.client_user_id),
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'seq', l.seq, 'kind', l.kind, 'label', l.label, 'basis', l.basis,
        'quantity', l.quantity, 'unit_price_xaf', l.unit_price_xaf, 'amount_xaf', l.amount_xaf,
        'parcel_id', l.parcel_id, 'parcel_no', p.parcel_no, 'parcel_seq', p.seq, 'kind_of_parcel', p.kind,
        'description', p.description, 'weight_kg', p.weight_kg, 'cbm', p.cbm
      ) ORDER BY l.seq)
      FROM public.parcel_quote_lines l LEFT JOIN public.parcels p ON p.id = l.parcel_id
      WHERE l.quote_id = q.id), '[]'::jsonb),
    'payments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pm.id, 'receipt_no', pm.receipt_no, 'amount_xaf', pm.amount_xaf, 'method', pm.method, 'place', pm.place,
        'paid_at', pm.paid_at, 'reference', pm.reference, 'proof_path', pm.proof_path, 'note', pm.note,
        'received_by', pm.received_by,
        'received_by_name', (SELECT TRIM(COALESCE(ur.first_name,'') || ' ' || COALESCE(ur.last_name,'')) FROM public.user_roles ur WHERE ur.user_id = pm.received_by),
        'created_at', pm.created_at, 'cancelled_at', pm.cancelled_at, 'cancel_reason', pm.cancel_reason
      ) ORDER BY pm.paid_at, pm.created_at)
      FROM public.parcel_quote_payments pm WHERE pm.quote_id = q.id), '[]'::jsonb)
  )
  FROM public.parcel_quotes q JOIN public.parcel_deposits d ON d.id = q.deposit_id
  WHERE q.id = p_quote_id;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_json(UUID) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Sérialiser un devis avec ses paiements (helper interne)"}';
REVOKE ALL ON FUNCTION public.cargo_quote_json(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cargo_quote_json(UUID) FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. RPC
-- ─────────────────────────────────────────────────────────────────────────

-- 5.1 Encaisser : un paiement sur le devis, avec sa preuve. Montant entier
--     strictement positif, borné par le reste à payer (on ne prend pas plus
--     que le devis ; s'il faut plus, on corrige le devis). Refusé une fois la
--     facture établie. Verrou sur le devis : deux encaissements simultanés ne
--     dépassent pas le total.
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
  IF v_q.invoice_no IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'La facture ' || v_q.invoice_no || ' est établie : ce devis est clos'); END IF;
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
          jsonb_build_object('description', 'Encaissement ' || v_pm.receipt_no || ' : ' || p_amount_xaf || ' XAF sur ' || v_q.quote_no || ' (' || p_method || ', ' || p_place || ')',
                             'receipt_no', v_pm.receipt_no, 'payment_id', v_pm.id, 'quote_no', v_q.quote_no, 'deposit_id', v_q.deposit_id,
                             'amount_xaf', p_amount_xaf, 'method', p_method, 'place', p_place, 'proof', v_pm.proof_path IS NOT NULL));
  RETURN jsonb_build_object('success', true, 'payment_id', v_pm.id, 'receipt_no', v_pm.receipt_no, 'quote', public.cargo_quote_json(v_q.id));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_add_payment(UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canCollectParcelPayments","confirm":true,"danger":true,"label":"Encaisser un paiement sur un devis de colis (montant, mode, lieu, preuve)"}';

-- 5.2 Annuler un encaissement (erreur de saisie, double saisie). Motif
--     obligatoire ; le paiement reste visible, barré. Refusé une fois facturé.
CREATE OR REPLACE FUNCTION public.cargo_quote_cancel_payment(p_payment_id UUID, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_pm public.parcel_quote_payments; v_q public.parcel_quotes;
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
  IF v_q.invoice_no IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'La facture ' || v_q.invoice_no || ' est établie : les encaissements ne se modifient plus'); END IF;
  -- Statut terminal aussi : des colis déjà remis contre ce devis. L'annuler rouvrirait
  -- un « reste à payer » sur une marchandise partie.
  IF EXISTS (SELECT 1 FROM public.parcels p WHERE p.deposit_id = v_q.deposit_id AND p.delivered_at IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Des colis de ce dépôt ont déjà été remis : l''encaissement ne s''annule plus');
  END IF;
  SELECT * INTO v_pm FROM public.parcel_quote_payments WHERE id = p_payment_id FOR UPDATE;
  IF v_pm.cancelled_at IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Cet encaissement est déjà annulé'); END IF;

  UPDATE public.parcel_quote_payments
     SET cancelled_at = now(), cancelled_by = v_uid, cancel_reason = TRIM(p_reason)
   WHERE id = v_pm.id;
  PERFORM public.cargo_quote_recompute(v_q.id);

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'cancel_parcel_payment', 'parcel_quote', v_q.id,
          jsonb_build_object('description', 'Encaissement ' || v_pm.receipt_no || ' annulé (' || v_pm.amount_xaf || ' XAF) : ' || TRIM(p_reason),
                             'receipt_no', v_pm.receipt_no, 'payment_id', v_pm.id, 'quote_no', v_q.quote_no, 'deposit_id', v_q.deposit_id,
                             'amount_xaf', v_pm.amount_xaf, 'reason', TRIM(p_reason)));
  RETURN jsonb_build_object('success', true, 'quote', public.cargo_quote_json(v_q.id));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_cancel_payment(UUID, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canCollectParcelPayments","confirm":true,"danger":true,"label":"Annuler un encaissement (motif obligatoire ; le devis redevient à payer)"}';

-- 5.3 Établir la facture acquittée : seulement quand tout est encaissé.
--     Numéro FA-000123, définitif : plus aucune modification de prix ni
--     d'encaissement ensuite.
CREATE OR REPLACE FUNCTION public.cargo_quote_invoice(p_quote_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_q public.parcel_quotes; v_no TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canCollectParcelPayments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_q FROM public.parcel_quotes WHERE id = p_quote_id FOR UPDATE;
  IF v_q.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Devis introuvable'); END IF;
  IF v_q.invoice_no IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'quote', public.cargo_quote_json(v_q.id));
  END IF;
  PERFORM public.cargo_quote_recompute(v_q.id);
  SELECT * INTO v_q FROM public.parcel_quotes WHERE id = p_quote_id;
  IF v_q.total_xaf <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Le devis n''a pas de montant'); END IF;
  IF v_q.amount_paid_xaf < v_q.total_xaf THEN
    RETURN jsonb_build_object('success', false, 'error', 'Il reste ' || (v_q.total_xaf - v_q.amount_paid_xaf) || ' XAF à encaisser avant la facture');
  END IF;
  v_no := 'FA-' || lpad(nextval('public.parcel_invoice_no_seq')::text, 6, '0');
  UPDATE public.parcel_quotes SET invoice_no = v_no, invoiced_at = now(), invoiced_by = v_uid, status = 'invoiced', updated_at = now() WHERE id = v_q.id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'issue_parcel_invoice', 'parcel_quote', v_q.id,
          jsonb_build_object('description', 'Facture acquittée ' || v_no || ' établie : ' || v_q.total_xaf || ' XAF (' || v_q.quote_no || ')',
                             'invoice_no', v_no, 'quote_no', v_q.quote_no, 'deposit_id', v_q.deposit_id, 'total_xaf', v_q.total_xaf));
  RETURN jsonb_build_object('success', true, 'invoice_no', v_no, 'quote', public.cargo_quote_json(v_q.id));
END;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_invoice(UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canCollectParcelPayments","confirm":true,"danger":false,"label":"Établir la facture acquittée d''un devis entièrement encaissé"}';

-- ─────────────────────────────────────────────────────────────────────────
-- 6. La vue d'ensemble porte l'encaissé et le reste à payer par dépôt.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reception_overview(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canViewCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'by_receptionist', COALESCE((
      SELECT jsonb_agg(row_to_json(r)) FROM (
        SELECT d.received_by,
               (SELECT TRIM(COALESCE(ur.first_name,'') || ' ' || COALESCE(ur.last_name,'')) FROM public.user_roles ur WHERE ur.user_id = d.received_by) AS name,
               count(*) AS deposits,
               COALESCE(sum((SELECT count(*) FROM public.parcels p WHERE p.deposit_id = d.id)), 0) AS parcels,
               COALESCE(sum((SELECT COALESCE(sum(p.weight_kg),0) FROM public.parcels p WHERE p.deposit_id = d.id)), 0) AS weight_kg,
               COALESCE(sum((SELECT COALESCE(sum(p.cbm),0) FROM public.parcels p WHERE p.deposit_id = d.id)), 0) AS cbm,
               count(*) FILTER (WHERE d.client_user_id IS NULL) AS pending,
               COALESCE(sum((SELECT count(*) FROM public.parcels p WHERE p.deposit_id = d.id AND (p.weight_kg IS NULL OR p.cbm IS NULL OR p.photo_path IS NULL))), 0) AS incomplete
        FROM public.parcel_deposits d
        WHERE d.opened_at >= p_from AND d.opened_at < p_to AND d.status <> 'cancelled'
        GROUP BY d.received_by
        ORDER BY deposits DESC
      ) r), '[]'::jsonb),
    'deposits', COALESCE((
      SELECT jsonb_agg(
        public.reception_deposit_json(d.id)
        || jsonb_build_object('quote_status', q.status, 'quote_no', q.quote_no, 'quote_total_xaf', q.total_xaf,
                              'quote_paid_xaf', q.amount_paid_xaf, 'invoice_no', q.invoice_no)
        ORDER BY d.opened_at DESC)
      FROM public.parcel_deposits d LEFT JOIN public.parcel_quotes q ON q.deposit_id = d.id
      WHERE d.opened_at >= p_from AND d.opened_at < p_to AND d.status <> 'cancelled'
    ), '[]'::jsonb)
  );
END;
$fn$;
COMMENT ON FUNCTION public.reception_overview(TIMESTAMPTZ, TIMESTAMPTZ) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Vue d''ensemble de la réception des colis (par réceptionnaire, dépôts, devis et encaissements)"}';
