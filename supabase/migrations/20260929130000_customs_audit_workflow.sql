-- ============================================================================
-- Douane, étape 5 — vérifier une déclaration (DAU) : le circuit de l'audit.
--
-- Le socle (20260929120000_customs_foundation.sql) créait l'audit, ses constats
-- et l'avis du commissionnaire. Il manquait :
--   1. customs_audit_claim  — le CAD prend un audit (il quitte la file des autres),
--      comme pour les fiches de classement ;
--   2. customs_audit_cancel — le client abandonne un audit tant qu'aucun avis
--      n'est rendu ;
--   3. le lien de la notification aux CAD : /m/douane/audit/<id> (il pointait vers
--      l'écran des fiches de classement) ;
--   4. la file garde aussi les audits relus dans « récents ».
--
-- La LECTURE de la DAU est faite par l'edge function customs-ai (action
-- read_dau, clé de service) : statut reading → read ou failed, extraction,
-- numéro, bureau, dates. Les constats sont calculés par l'app
-- (src/lib/customs/audit.ts) et enregistrés par customs_audit_save_findings.
-- Idempotente : rejouable.
-- ============================================================================

-- 1. Le CAD prend l'audit.
CREATE OR REPLACE FUNCTION public.customs_audit_claim(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_row public.customs_audits;
BEGIN
  IF (public.customs_active_broker(v_uid)).user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Réservé à un commissionnaire agréé enregistré');
  END IF;
  SELECT * INTO v_row FROM public.customs_audits WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Audit introuvable'); END IF;
  IF v_row.status NOT IN ('submitted','in_review') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cet audit n''attend pas de relecture');
  END IF;
  IF v_row.status = 'in_review' AND v_row.claimed_by IS NOT NULL AND v_row.claimed_by <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un autre commissionnaire a pris cet audit');
  END IF;
  UPDATE public.customs_audits SET status = 'in_review', claimed_by = v_uid WHERE id = p_id;
  RETURN jsonb_build_object('success', true, 'status', 'in_review');
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_audit_claim(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_audit_claim(UUID) TO authenticated;
COMMENT ON FUNCTION public.customs_audit_claim(UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canSignCustoms","confirm":true,"danger":false,"label":"Prendre un audit de déclaration en relecture (CAD)"}';

-- 2. Le client abandonne son audit — jamais après l'avis du CAD.
CREATE OR REPLACE FUNCTION public.customs_audit_cancel(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_row public.customs_audits;
BEGIN
  SELECT * INTO v_row FROM public.customs_audits WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.client_user_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Audit introuvable');
  END IF;
  -- Statuts terminaux : un avis rendu ne s'annule pas.
  IF v_row.status IN ('reviewed','cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Audit déjà clos');
  END IF;
  UPDATE public.customs_audits SET status = 'cancelled' WHERE id = p_id;
  RETURN jsonb_build_object('success', true);
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_audit_cancel(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_audit_cancel(UUID) TO authenticated;
COMMENT ON FUNCTION public.customs_audit_cancel(UUID) IS
  '@mola:{"expose":false,"kind":"write","permission":"canViewCustoms","confirm":true,"danger":false,"label":"Le client abandonne son audit de déclaration (action du client)"}';

-- 3. L'envoi au CAD : même règle, bon lien.
CREATE OR REPLACE FUNCTION public.customs_audit_submit(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_row public.customs_audits;
BEGIN
  SELECT * INTO v_row FROM public.customs_audits WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL OR NOT (v_row.client_user_id = v_uid OR public.admin_has_permission(v_uid, 'canViewCustoms')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Audit introuvable');
  END IF;
  IF v_row.status NOT IN ('uploaded','read','failed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Audit déjà envoyé');
  END IF;
  UPDATE public.customs_audits SET status = 'submitted', submitted_at = now(), claimed_by = NULL WHERE id = p_id;
  PERFORM public.customs_notify_brokers(
    'DAU à relire — ' || v_row.ref,
    COALESCE(v_row.dau_number, 'Déclaration') || COALESCE(' · économie estimée ' || v_row.overpaid_xaf::text || ' XAF', ''),
    '/m/douane/audit/' || p_id::text);
  RETURN jsonb_build_object('success', true, 'status', 'submitted');
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_audit_submit(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_audit_submit(UUID) TO authenticated;
COMMENT ON FUNCTION public.customs_audit_submit(UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canViewCustoms","confirm":true,"danger":false,"label":"Envoyer un audit de déclaration au commissionnaire agréé"}';

-- 4. La file : les audits relus rejoignent l'historique.
CREATE OR REPLACE FUNCTION public.customs_review_queue()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canViewCustoms') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  RETURN jsonb_build_object(
    'success', true,
    'is_broker', (public.customs_active_broker(v_uid)).user_id IS NOT NULL,
    'classifications', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'ref', c.ref, 'product_name', c.product_name, 'proposed_code', c.proposed_code, 'status', c.status,
        'submitted_at', c.submitted_at, 'claimed_by', c.claimed_by, 'mine', c.claimed_by = v_uid,
        'client', (SELECT jsonb_build_object('first_name', cl.first_name, 'last_name', cl.last_name, 'company_name', cl.company_name, 'customer_code', cl.customer_code)
                   FROM public.clients cl WHERE cl.user_id = c.client_user_id)
      ) ORDER BY c.submitted_at)
      FROM public.customs_classifications c WHERE c.status IN ('submitted','in_review')), '[]'::jsonb),
    'audits', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'ref', a.ref, 'dau_number', a.dau_number, 'overpaid_xaf', a.overpaid_xaf, 'claim_deadline', a.claim_deadline,
        'status', a.status, 'submitted_at', a.submitted_at, 'claimed_by', a.claimed_by, 'mine', a.claimed_by = v_uid,
        'client', (SELECT jsonb_build_object('first_name', cl.first_name, 'last_name', cl.last_name, 'company_name', cl.company_name, 'customer_code', cl.customer_code)
                   FROM public.clients cl WHERE cl.user_id = a.client_user_id)
      ) ORDER BY a.claim_deadline NULLS LAST, a.submitted_at)
      FROM public.customs_audits a WHERE a.status IN ('submitted','in_review')), '[]'::jsonb),
    'recent', COALESCE((
      SELECT jsonb_agg(row ORDER BY (row->>'reviewed_at') DESC) FROM (
        (SELECT jsonb_build_object('kind', 'classification', 'id', c.id, 'ref', c.ref, 'label', c.product_name, 'status', c.status,
                                   'final_code', c.final_code, 'amount_xaf', NULL, 'reviewed_at', c.reviewed_at) AS row
           FROM public.customs_classifications c WHERE c.reviewed_at IS NOT NULL ORDER BY c.reviewed_at DESC LIMIT 20)
        UNION ALL
        (SELECT jsonb_build_object('kind', 'audit', 'id', a.id, 'ref', a.ref, 'label', COALESCE(a.dau_number, 'Déclaration'), 'status', a.status,
                                   'final_code', NULL, 'amount_xaf', a.recoverable_xaf, 'reviewed_at', a.reviewed_at) AS row
           FROM public.customs_audits a WHERE a.reviewed_at IS NOT NULL ORDER BY a.reviewed_at DESC LIMIT 20)
      ) r), '[]'::jsonb)
  );
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_review_queue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_review_queue() TO authenticated;
COMMENT ON FUNCTION public.customs_review_queue() IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCustoms","confirm":false,"danger":false,"label":"La file du commissionnaire agréé : classements et déclarations à valider"}';
