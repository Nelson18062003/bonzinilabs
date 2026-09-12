-- ============================================================
-- RAPPROCHEMENT BANCAIRE DES DÉPÔTS — un marqueur DISTINCT du statut.
--
-- Besoin réel : « les gens déposent sur nos différents comptes, et parfois je
-- paie avant d'avoir vérifié. Je crée un dépôt et je le valide ; plus tard,
-- en fin de journée, j'appelle mon partenaire et on regarde le compte
-- bancaire : est-ce que c'est bien arrivé ? »
--
-- C'est donc DEUX questions différentes, et il en faut deux réponses :
--   · `status = 'validated'` — le portefeuille du client a été crédité ;
--   · `verified_at`          — un administrateur a CONSTATÉ l'argent sur le
--                              compte bancaire.
-- La première peut précéder la seconde de plusieurs heures, et c'est
-- exactement le risque que ce marqueur rend visible. Ce n'est donc pas une
-- valeur de plus dans l'enum `deposit_status` : un dépôt rejeté n'est pas
-- « non vérifié », il est hors sujet, et mélanger les deux axes obligerait à
-- multiplier les statuts (validé-vérifié, validé-non-vérifié…).
--
-- Idempotent : `add column if not exists`, `create index if not exists`,
-- `create or replace function`.
-- ============================================================

-- ── 1. Les colonnes ──────────────────────────────────────────
-- `verified_by` reste un `uuid` nu, comme `validated_by` juste à côté : la
-- table ne référence pas `auth.users`, et introduire une clé étrangère ici
-- ferait diverger deux colonnes qui jouent le même rôle.
ALTER TABLE public.deposits
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID;

COMMENT ON COLUMN public.deposits.verified_at IS
  'Rapprochement bancaire : instant où un administrateur a CONSTATÉ l''argent sur le compte. Distinct de validated_at (crédit du portefeuille client), qui peut le précéder.';
COMMENT ON COLUMN public.deposits.verified_by IS
  'Administrateur ayant constaté l''argent sur le compte bancaire.';

-- Index PARTIEL : la question posée est toujours « lesquels restent à
-- vérifier ? », jamais « lesquels sont vérifiés ». Un index sur la totalité
-- de la table paierait pour des lignes qu'on ne cherche pas.
CREATE INDEX IF NOT EXISTS idx_deposits_unverified
  ON public.deposits (created_at DESC)
  WHERE verified_at IS NULL;

-- ── 2. La bascule ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_deposit_verified(
  p_deposit_id UUID,
  p_verified   BOOLEAN
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_deposit  RECORD;
  v_now      TIMESTAMPTZ := now();
BEGIN
  v_admin_id := auth.uid();

  -- `is_admin` ne teste AUCUN rôle : il dirait oui à tout membre du staff.
  -- Le rapprochement bancaire appartient à qui traite les dépôts.
  IF NOT public.admin_has_permission(v_admin_id, 'canProcessDeposits') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  IF p_verified IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valeur de vérification manquante');
  END IF;

  -- Verrou AVANT lecture : deux clics concurrents liraient sinon le même état
  -- et écriraient deux fois, dont un journal en double.
  SELECT * INTO v_deposit FROM public.deposits WHERE id = p_deposit_id FOR UPDATE;

  IF v_deposit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dépôt non trouvé');
  END IF;

  -- Idempotent : recocher un dépôt déjà vérifié ne réécrit ni l'auteur ni
  -- l'instant du constat — c'est une trace, elle appartient à qui l'a posée.
  IF p_verified AND v_deposit.verified_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 'verified', true, 'unchanged', true,
      'verified_at', v_deposit.verified_at, 'verified_by', v_deposit.verified_by
    );
  END IF;

  IF NOT p_verified AND v_deposit.verified_at IS NULL THEN
    RETURN jsonb_build_object('success', true, 'verified', false, 'unchanged', true);
  END IF;

  UPDATE public.deposits
     SET verified_at = CASE WHEN p_verified THEN v_now ELSE NULL END,
         verified_by = CASE WHEN p_verified THEN v_admin_id ELSE NULL END,
         updated_at  = v_now
   WHERE id = p_deposit_id;

  INSERT INTO public.deposit_timeline_events (deposit_id, event_type, description, performed_by)
  VALUES (
    p_deposit_id,
    CASE WHEN p_verified THEN 'bank_verified' ELSE 'bank_unverified' END,
    CASE WHEN p_verified
         THEN 'Dépôt vérifié sur le compte bancaire'
         ELSE 'Vérification bancaire retirée'
    END,
    v_admin_id
  );

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (
    v_admin_id,
    CASE WHEN p_verified THEN 'verify_deposit' ELSE 'unverify_deposit' END,
    'deposit',
    p_deposit_id,
    jsonb_build_object(
      'reference',  v_deposit.reference,
      'amount_xaf', v_deposit.amount_xaf,
      'status',     v_deposit.status,
      'verified',   p_verified
    )
  );

  RETURN jsonb_build_object(
    'success',     true,
    'verified',    p_verified,
    'verified_at', CASE WHEN p_verified THEN v_now ELSE NULL END,
    'verified_by', CASE WHEN p_verified THEN v_admin_id ELSE NULL END
  );
END;
$$;

-- Mola doit voir l'action, sinon elle n'existe pas pour l'assistant.
-- `confirm: false` : la bascule ne déplace pas d'argent et se défait d'un clic.
COMMENT ON FUNCTION public.set_deposit_verified(UUID, BOOLEAN) IS
  '@mola:{"expose":true,"kind":"write","permission":"canProcessDeposits","confirm":false,"danger":false,"label":"Marquer un dépôt vérifié en banque (ou retirer la vérification)","resolve":{"p_deposit_id":"deposit"}}';

NOTIFY pgrst, 'reload schema';
