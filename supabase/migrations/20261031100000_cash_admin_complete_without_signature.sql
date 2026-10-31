-- ============================================================================
-- Paiement cash : l'administration valide la remise SANS scan ni signature
-- (demande du propriétaire, 31/10/2026).
--
-- Constat : le 21/10, la chaîne cash a été durcie (scan du QR puis signature
-- déposée obligatoires, ancienne confirmation à 3 arguments refusée). Le site
-- en ligne appelle encore l'ancienne confirmation (3 arguments) : un admin
-- qui fait signer reçoit « Mettez l'application à jour… » et ne peut plus
-- valider. Et le propriétaire veut pouvoir valider même si le client ne
-- signe pas.
--
-- Règle désormais :
--   · ADMINISTRATION (canProcessPayments : super_admin, ops) — valide la
--     remise d'un paiement cash non clos, avec ou sans scan, avec ou sans
--     signature, avec ou sans nom déclaré. Ce qui est fourni est enregistré.
--   · AGENT CASH (canHandleCash sans canProcessPayments) — inchangé : scan du
--     QR du client, puis signature déposée et nom déclaré.
-- Ce qui ne bouge pas : le verrou de la ligne (FOR UPDATE), le refus des
-- statuts clos (completed, rejected, cancelled_by_admin), le contrôle que le
-- montant est bien réservé au grand livre, l'écriture PAYMENT_EXECUTED.
-- ============================================================================

-- ── 1. Le cœur commun : clôturer un paiement cash (appelé par les RPC) ─────
CREATE OR REPLACE FUNCTION public._cash_payment_complete(
  p_payment_id uuid,
  p_signature  text,
  p_signed_by  text,
  p_id_number  text,
  p_by_admin   boolean
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_payment payments%ROWTYPE;
  v_wallet  wallets%ROWTYPE;
BEGIN
  SELECT * INTO v_payment FROM payments WHERE id = p_payment_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Paiement introuvable');
  END IF;
  IF v_payment.method != 'cash' THEN
    RETURN json_build_object('success', false, 'error', 'Ce n''est pas un paiement cash');
  END IF;
  IF v_payment.status = 'completed' THEN
    RETURN json_build_object('success', false, 'error', 'Ce paiement a déjà été effectué');
  END IF;
  IF v_payment.status IN ('rejected', 'cancelled_by_admin') THEN
    RETURN json_build_object('success', false, 'error',
      'Ce paiement a été annulé ou rejeté : il ne peut plus être encaissé');
  END IF;

  IF public._payment_debit_held(p_payment_id) <> v_payment.amount_xaf THEN
    RETURN json_build_object('success', false, 'error',
      'Montant non réservé au grand livre : remise impossible, prévenez la direction');
  END IF;

  SELECT * INTO v_wallet FROM wallets WHERE user_id = v_payment.user_id FOR UPDATE;

  UPDATE payments
  SET
    status                   = 'completed',
    cash_signature_url       = COALESCE(p_signature, cash_signature_url),
    cash_signature_timestamp = CASE WHEN p_signature IS NOT NULL THEN now() ELSE cash_signature_timestamp END,
    cash_signed_by_name      = COALESCE(p_signed_by, cash_signed_by_name),
    cash_signer_id_number    = COALESCE(p_id_number, cash_signer_id_number),
    cash_paid_at             = now(),
    cash_paid_by             = auth.uid(),
    processed_at             = now(),
    processed_by             = auth.uid(),
    updated_at               = now()
  WHERE id = p_payment_id;

  IF v_wallet IS NOT NULL THEN
    INSERT INTO public.ledger_entries (
      wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
      reference_type, reference_id, description, created_by_admin_id, metadata
    ) VALUES (
      v_wallet.id,
      v_payment.user_id,
      'PAYMENT_EXECUTED',
      v_payment.amount_xaf,
      v_wallet.balance_xaf,
      v_wallet.balance_xaf,
      'payment',
      p_payment_id,
      format('Paiement exécuté - Réf: %s', v_payment.reference),
      auth.uid(),
      jsonb_build_object(
        'method',                'cash',
        'amount_rmb',            v_payment.amount_rmb,
        'cash_signed_by',        p_signed_by,
        'cash_signer_id_number', p_id_number,
        'validated_by_admin',    p_by_admin,
        'without_signature',     p_signature IS NULL,
        'without_scan',          v_payment.cash_scanned_at IS NULL
      )
    );
  END IF;

  INSERT INTO payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (
    p_payment_id,
    'cash_paid',
    CASE
      WHEN p_signed_by IS NOT NULL THEN 'Paiement cash effectué - Signé par ' || p_signed_by
      ELSE 'Paiement cash effectué - Validé par l''administration, sans signature'
    END,
    auth.uid()
  );

  RETURN json_build_object('success', true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public._cash_payment_complete(uuid, text, text, text, boolean) FROM PUBLIC, anon, authenticated;

comment on function public._cash_payment_complete(uuid, text, text, text, boolean) is
  '@mola:{"expose":false,"kind":"write","permission":"canHandleCash","confirm":true,"danger":true,"label":"Interne : clôture d''un paiement cash (appelée par confirm_cash_payment)"}';

-- ── 2. Confirmation actuelle (4 arguments) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_cash_payment(p_payment_id uuid, p_signature_path text, p_signed_by_name text, p_signer_id_number text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_payment   payments%ROWTYPE;
  v_admin     boolean := public.admin_has_permission(auth.uid(), 'canProcessPayments');
  v_path      text := NULLIF(btrim(COALESCE(p_signature_path, '')), '');
  v_signed_by text := NULLIF(btrim(COALESCE(p_signed_by_name, '')), '');
  v_id_number text := NULLIF(btrim(COALESCE(p_signer_id_number, '')), '');
BEGIN
  IF NOT (v_admin OR public.admin_has_permission(auth.uid(), 'canHandleCash')) THEN
    RETURN json_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  -- La signature fournie doit être un vrai fichier de CE paiement, déposé par l'appelant.
  IF v_path IS NOT NULL AND (
       left(v_path, length(p_payment_id::text) + 1) <> p_payment_id::text || '/'
       OR NOT EXISTS (
         SELECT 1 FROM storage.objects o
          WHERE o.bucket_id = 'cash-signatures'
            AND o.name = v_path
            AND COALESCE(o.owner_id, o.owner::text) = auth.uid()::text
       )
     ) THEN
    RETURN json_build_object('success', false, 'error', 'Signature introuvable : refaites signer');
  END IF;

  IF NOT v_admin THEN
    -- Agent cash : chaîne complète (scan, puis signature déposée après le scan, nom déclaré).
    SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;
    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'Paiement introuvable');
    END IF;
    IF v_payment.status IN ('completed', 'rejected', 'cancelled_by_admin') THEN
      -- Le message exact vient du cœur commun.
      RETURN public._cash_payment_complete(p_payment_id, v_path, v_signed_by, v_id_number, false);
    END IF;
    IF v_payment.status <> 'cash_scanned' OR v_payment.cash_scanned_at IS NULL THEN
      RETURN json_build_object('success', false, 'error',
        'Scannez d''abord le QR du client : la remise se confirme seulement après le scan');
    END IF;
    IF v_signed_by IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Le nom déclaré par la personne qui signe est obligatoire');
    END IF;
    IF v_path IS NULL OR NOT EXISTS (
         SELECT 1 FROM storage.objects o
          WHERE o.bucket_id = 'cash-signatures' AND o.name = v_path
            AND o.created_at >= v_payment.cash_scanned_at
       ) THEN
      RETURN json_build_object('success', false, 'error', 'La signature du bénéficiaire est obligatoire');
    END IF;
  END IF;

  RETURN public._cash_payment_complete(p_payment_id, v_path, v_signed_by, v_id_number, v_admin);
END;
$function$;

comment on function public.confirm_cash_payment(uuid, text, text, text) is
  '@mola:{"expose":false,"kind":"write","permission":"canHandleCash","confirm":true,"danger":true,"label":"Confirmer la remise d''un paiement cash (agent : après scan et signature ; administration : signature facultative) — jamais par Mola","resolve":{"p_payment_id":"payment"}}';

-- ── 3. Ancienne confirmation (3 arguments, site encore en ligne) ───────────
-- L'administration valide avec la signature et le nom qu'elle envoie (l'URL
-- publique de la signature, comme avant le 21/10). L'agent cash doit passer
-- par la confirmation à 4 arguments.
CREATE OR REPLACE FUNCTION public.confirm_cash_payment(p_payment_id uuid, p_signature_url text, p_signed_by_name text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canProcessPayments') THEN
    IF public.admin_has_permission(auth.uid(), 'canHandleCash') THEN
      RETURN json_build_object('success', false, 'error',
        'Mettez l''application à jour : la remise exige la signature déposée et le nom déclaré');
    END IF;
    RETURN json_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  RETURN public._cash_payment_complete(
    p_payment_id,
    NULLIF(btrim(COALESCE(p_signature_url, '')), ''),
    NULLIF(btrim(COALESCE(p_signed_by_name, '')), ''),
    NULL,
    true
  );
END;
$function$;

comment on function public.confirm_cash_payment(uuid, text, text) is
  '@mola:{"expose":false,"kind":"write","permission":"canProcessPayments","confirm":true,"danger":true,"label":"Ancienne confirmation cash (site d''avant la refonte) : réservée à l''administration, signature facultative"}';
