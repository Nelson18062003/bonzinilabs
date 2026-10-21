-- ============================================================================
-- Chaîne cash réelle, agent cash isolé, argent vérifié côté serveur (21/10/2026)
--
-- Les fonctions existantes sont redéfinies À PARTIR DE LEUR DÉFINITION EN
-- PRODUCTION (pg_get_functiondef du 21/10/2026), en ne changeant que ce qui
-- est décrit ici. Idempotente (CREATE … IF NOT EXISTS, CREATE OR REPLACE,
-- CREATE OR REPLACE TRIGGER, ALTER POLICY), sans aucune suppression.
--
-- 1. cancel_deposit reprenait `amount_xaf` (le montant DÉCLARÉ) au lieu du
--    montant réellement CRÉDITÉ par validate_deposit. Il reprend désormais
--    l'écriture DEPOSIT_VALIDATED du grand livre (à défaut :
--    COALESCE(confirmed_amount_xaf, amount_xaf)). Verrous, plancher de
--    découvert, audit et timeline inchangés. Étiquette Mola : canManageUsers
--    (c'est la garde réelle : super admin).
--
-- 2. Agent cash isolé. Permission `canHandleCash` (super_admin, ops,
--    cash_agent) ; cash_agent PERD `canProcessPayments`. Miroir dans
--    ROLE_PERMISSIONS et dans la passerelle Mola. is_cash_agent ignore un
--    compte désactivé.
--
-- 3. Chaîne cash réelle (décision : scan du QR ET signature OBLIGATOIRES).
--    Constat : 27 paiements cash effectués en 90 jours, 0 scanné, 0 signé.
--      · un paiement cash naît en `cash_pending` (create_admin_payment,
--        create_payment, create_payment_batch) avec un JETON SECRET
--        (payment_cash_tokens, ≥ 128 bits) que seul le client propriétaire
--        peut lire : son QR porte {id, t: jeton}. L'UUID seul ne suffit plus
--        (les écrans du staff l'affichaient) ;
--      · process_payment refuse start_processing / complete sur le cash ;
--      · scan_cash_payment(id, jeton) : cash_pending → cash_scanned, jeton
--        exact et montant réellement réservé au grand livre ;
--      · confirm_cash_payment(id, chemin, nom déclaré, pièce) : seulement
--        depuis cash_scanned, avec un fichier du bucket cash-signatures
--        déposé par l'appelant sous « <id>/ » après le scan ;
--      · les anciennes signatures de ces deux RPC refusent ; aucune n'est
--        exposée à Mola (la caméra et la signature sont devant le client) ;
--      · garde-fou (trigger) : un appel DIRECT de l'API ne crée, ne supprime
--        ni ne fait avancer aucun paiement, et ne change que les
--        coordonnées du bénéficiaire. La politique d'INSERT client est
--        fermée (WITH CHECK false) ;
--      · les paiements cash restés en ready_for_payment / processing passent
--        en cash_pending, et chaque cash ouvert reçoit son jeton ;
--      · le client est prévenu (« retrait disponible ») dès la création.
--
-- 4. L'argent vérifié côté serveur :
--      · create_payment (app client) recalcule le ¥ au taux publié (pays du
--        client, tranche du montant), refuse au-delà de 1 ¥ d'écart, garde
--        le taux du serveur, jamais « perso », vérifie que le bénéficiaire
--        est au client ; nouvelle signature avec les champs bénéficiaire
--        étendus (l'ancienne reste, en enveloppe) ;
--      · create_admin_payment et create_payment_batch refusent un taux ou un
--        montant ¥ nul ou négatif (plus de COALESCE à 0).
--
-- Après application : /gen-types (nouvelles surcharges de create_payment,
-- scan_cash_payment, confirm_cash_payment ; table payment_cash_tokens ;
-- colonne payments.cash_signer_id_number).
-- ============================================================================
-- ────────────────────────────────────────────────────────────────────────────
-- 1. cancel_deposit : reprendre exactement ce qui a été crédité
-- ────────────────────────────────────────────────────────────────────────────
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
  v_reversal  BIGINT;
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
    -- Ce que validate_deposit a VRAIMENT crédité : son écriture au grand
    -- livre ; à défaut, sa propre règle (le confirmé s'il diffère, sinon le
    -- déclaré). Jamais le seul montant déclaré.
    SELECT le.amount_xaf INTO v_reversal
      FROM public.ledger_entries le
     WHERE le.reference_type = 'deposit'
       AND le.reference_id = p_deposit_id
       AND le.entry_type = 'DEPOSIT_VALIDATED'
     ORDER BY le.created_at DESC
     LIMIT 1;
    v_reversal := COALESCE(v_reversal, v_deposit.confirmed_amount_xaf, v_deposit.amount_xaf);

    IF v_reversal IS NULL OR v_reversal <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Montant crédité introuvable : annulation impossible');
    END IF;

    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_deposit.user_id FOR UPDATE;

    IF v_wallet IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Wallet non trouvé');
    END IF;

    v_floor := -COALESCE(v_wallet.overdraft_limit_xaf, 0);
    IF v_wallet.balance_xaf - v_reversal < v_floor THEN
      RETURN jsonb_build_object('success', false, 'error',
        'Solde insuffisant pour annuler ce dépôt. Solde: ' || v_wallet.balance_xaf || ' XAF, à reverser: ' || v_reversal
        || ' XAF' || CASE WHEN COALESCE(v_wallet.overdraft_limit_xaf, 0) > 0
                          THEN ' (découvert autorisé: ' || v_wallet.overdraft_limit_xaf || ' XAF)' ELSE '' END);
    END IF;

    v_new_balance := v_wallet.balance_xaf - v_reversal;

    INSERT INTO public.ledger_entries (
      wallet_id, user_id, entry_type, amount_xaf,
      balance_before, balance_after,
      reference_type, reference_id,
      description, metadata, created_by_admin_id
    ) VALUES (
      v_wallet.id, v_deposit.user_id, 'ADMIN_DEBIT', v_reversal,
      v_wallet.balance_xaf, v_new_balance,
      'deposit', p_deposit_id,
      'Annulation dépôt - Réf: ' || COALESCE(v_deposit.reference, p_deposit_id::text),
      jsonb_build_object(
        'reason', 'cancelled_by_admin',
        'original_status', v_deposit.status,
        'method', v_deposit.method,
        'declared_amount_xaf', v_deposit.amount_xaf,
        'reversed_amount_xaf', v_reversal,
        'overdraft_used_xaf', GREATEST(0, -v_new_balance)
      ),
      v_admin_id
    );

    UPDATE public.wallets
    SET balance_xaf = balance_xaf - v_reversal, updated_at = now()
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
      'reversed_amount_xaf', v_reversal,
      'user_id',            v_deposit.user_id,
      'status_at_cancel',   v_deposit.status,
      'was_validated',      (v_deposit.status = 'validated'),
      'wallet_reversed',    (v_deposit.status = 'validated')
    )
  );

  RETURN jsonb_build_object('success', true, 'reversed_amount_xaf', v_reversal);
END;
$function$;

comment on function public.cancel_deposit(uuid) is
  '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","confirm":true,"danger":true,"label":"Annuler un dépôt (super admin)","resolve":{"p_deposit_id":"deposit"}}';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Matrice des permissions : canHandleCash, et cash_agent sans canProcessPayments
--    (miroir de ROLE_PERMISSIONS — src/tests/security/rolePermissionParity.test.ts)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_has_permission(_user_id UUID, _permission TEXT)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        WHEN 'canProcessPayments'   THEN ur.role::text IN ('super_admin','ops')
        WHEN 'canHandleCash'        THEN ur.role::text IN ('super_admin','ops','cash_agent')
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
        WHEN 'canCollectParcelPayments' THEN ur.role::text IN ('super_admin','ops','warehouse_agent')
        WHEN 'canReceiveAtDestination'  THEN ur.role::text IN ('super_admin','ops','warehouse_agent')
        WHEN 'canReleaseParcels'        THEN ur.role::text IN ('super_admin','ops','warehouse_agent')
        WHEN 'canViewCustoms'       THEN ur.role::text IN ('super_admin','ops','support','customer_success','customs_broker')
        WHEN 'canSignCustoms'       THEN ur.role::text IN ('customs_broker')
        WHEN 'canManageCustoms'     THEN ur.role::text IN ('super_admin','ops')
        WHEN 'canProspect'          THEN ur.role::text IN ('commercial')
        WHEN 'canManageSales'       THEN ur.role::text IN ('super_admin')
        ELSE false
      END
  );
$function$;

comment on function public.admin_has_permission(uuid, text) is
  '@mola:{"expose":false,"kind":"read","permission":"canViewLogs","label":"Verifier une permission admin (miroir SQL de ROLE_PERMISSIONS)"}';

-- Les politiques RLS « Cash agents can … » des paiements passent par ici :
-- un agent cash désactivé n'y a plus accès (son JWT peut encore vivre).
CREATE OR REPLACE FUNCTION public.is_cash_agent(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'cash_agent'::app_role
      AND (is_disabled = false OR is_disabled IS NULL)
  )
$function$;

comment on function public.is_cash_agent(uuid) is
  '@mola:{"expose":false,"kind":"read","permission":"canHandleCash","confirm":false,"danger":false,"label":"Est-ce un agent cash actif ? (interne, politiques RLS)"}';



-- ────────────────────────────────────────────────────────────────────────────
-- 2b. Fondations de la chaîne cash
--     · le jeton secret du QR (payment_cash_tokens), lisible par le SEUL
--       client propriétaire du paiement : le QR n'est plus l'UUID du
--       paiement (que les écrans du staff affichaient) ;
--     · la pièce d'identité déclarée par le signataire ;
--     · deux aides internes : la somme encore réservée au grand livre pour
--       un paiement, et la clé « pays » du taux d'un client.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS cash_signer_id_number text;

COMMENT ON COLUMN public.payments.cash_signer_id_number IS
  'Numéro de pièce d''identité DÉCLARÉ par la personne qui signe la remise du cash (facultatif).';

CREATE TABLE IF NOT EXISTS public.payment_cash_tokens (
  payment_id uuid PRIMARY KEY REFERENCES public.payments(id) ON DELETE CASCADE,
  token text NOT NULL CHECK (length(token) >= 32),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.payment_cash_tokens IS
  'Secret du QR d''un paiement cash (≥ 128 bits). Lu par le client propriétaire pour dessiner son QR ; aucune politique staff : seul scan_cash_payment (SECURITY DEFINER) le compare.';

ALTER TABLE public.payment_cash_tokens ENABLE ROW LEVEL SECURITY;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'payment_cash_tokens'
       AND policyname = 'Owner reads own cash token'
  ) THEN
    CREATE POLICY "Owner reads own cash token" ON public.payment_cash_tokens
      FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.payments p
                      WHERE p.id = payment_cash_tokens.payment_id
                        AND p.user_id = auth.uid()));
  END IF;
END
$do$;

REVOKE ALL ON public.payment_cash_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.payment_cash_tokens TO authenticated;

-- Le jeton naît avec le paiement cash, quelle que soit la RPC qui le crée.
CREATE OR REPLACE FUNCTION public.payments_issue_cash_token()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.method = 'cash' THEN
    INSERT INTO public.payment_cash_tokens (payment_id, token)
    VALUES (NEW.id, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
    ON CONFLICT (payment_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

comment on function public.payments_issue_cash_token() is
  '@mola:{"expose":false,"kind":"write","permission":"canHandleCash","confirm":false,"danger":false,"label":"Jeton secret du QR cash, posé à la création (trigger interne)"}';

REVOKE EXECUTE ON FUNCTION public.payments_issue_cash_token() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER payments_issue_cash_token
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.payments_issue_cash_token();

-- Ce que le paiement détient ENCORE sur le portefeuille, d'après le grand
-- livre : réservation (PAYMENT_RESERVED) + corrections (ADMIN_DEBIT /
-- ADMIN_CREDIT d'admin_correct_payment) − remboursement.
CREATE OR REPLACE FUNCTION public._payment_debit_held(p_payment_id uuid)
 RETURNS bigint
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(CASE le.entry_type::text
                        WHEN 'PAYMENT_RESERVED' THEN le.amount_xaf
                        WHEN 'ADMIN_DEBIT' THEN le.amount_xaf
                        WHEN 'ADMIN_CREDIT' THEN -le.amount_xaf
                        WHEN 'PAYMENT_CANCELLED_REFUNDED' THEN -le.amount_xaf
                        ELSE 0 END), 0)::bigint
    FROM public.ledger_entries le
   WHERE le.reference_type = 'payment'
     AND le.reference_id = p_payment_id
$function$;

comment on function public._payment_debit_held(uuid) is
  '@mola:{"expose":false,"kind":"read","permission":"canHandleCash","confirm":false,"danger":false,"label":"Montant encore réservé au grand livre pour un paiement (interne)"}';

REVOKE EXECUTE ON FUNCTION public._payment_debit_held(uuid) FROM PUBLIC, anon, authenticated;

-- La clé « pays » du taux d'un client : MÊME règle que
-- clientCountryToRateKey (src/components/payment-form/paymentRateLogic.ts).
-- La liste d'alias est vérifiée contre le TypeScript par
-- src/tests/security/cashChain.test.ts. Tout le reste vaut la référence.
CREATE OR REPLACE FUNCTION public._rate_country_key(p_country text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  WITH raw AS (
    SELECT lower(btrim(COALESCE(p_country, ''))) AS r
  ), norm AS (
    SELECT r,
           btrim(regexp_replace(replace(translate(btrim(split_part(r, '/', 1)),
             'àáâäãåçèéêëìíîïñòóôöõùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'), '.', ''), '\s+', ' ', 'g')) AS n
      FROM raw
  )
  SELECT COALESCE(
    (SELECT r FROM norm WHERE r IN ('cameroun', 'gabon', 'tchad', 'rca', 'congo', 'guinee')),
    (SELECT a.key FROM norm, (VALUES
        ('cm', 'cameroun'), ('cameroun', 'cameroun'), ('cameroon', 'cameroun'),
        ('ga', 'gabon'), ('gabon', 'gabon'),
        ('td', 'tchad'), ('tchad', 'tchad'), ('chad', 'tchad'),
        ('cf', 'rca'), ('rca', 'rca'), ('centrafrique', 'rca'), ('republique centrafricaine', 'rca'),
        ('cg', 'congo'), ('congo', 'congo'), ('congo brazzaville', 'congo'),
        ('gq', 'guinee'), ('guinee equatoriale', 'guinee')
      ) AS a(alias, key)
      WHERE a.alias = norm.n),
    'cameroun')
$function$;

comment on function public._rate_country_key(text) is
  '@mola:{"expose":false,"kind":"read","permission":"canViewClients","confirm":false,"danger":false,"label":"Clé pays du taux d''un client (interne, miroir de clientCountryToRateKey)"}';

-- ────────────────────────────────────────────────────────────────────────────
-- 3a. Création : un paiement cash naît en cash_pending
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_admin_payment(p_user_id uuid, p_amount_xaf bigint, p_amount_rmb numeric, p_exchange_rate numeric, p_method payment_method, p_beneficiary_name text DEFAULT NULL::text, p_beneficiary_phone text DEFAULT NULL::text, p_beneficiary_email text DEFAULT NULL::text, p_beneficiary_qr_code_url text DEFAULT NULL::text, p_beneficiary_bank_name text DEFAULT NULL::text, p_beneficiary_bank_account text DEFAULT NULL::text, p_beneficiary_notes text DEFAULT NULL::text, p_client_visible_comment text DEFAULT NULL::text, p_desired_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_beneficiary_id uuid DEFAULT NULL::uuid, p_beneficiary_details jsonb DEFAULT NULL::jsonb, p_rate_is_custom boolean DEFAULT false)
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

  -- Jamais de taux ni de montant ¥ nul ou négatif (plus de taux de secours).
  IF p_amount_rmb IS NULL OR p_amount_rmb <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant en ¥ doit être positif');
  END IF;
  IF p_exchange_rate IS NULL OR p_exchange_rate <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Taux invalide : le taux du jour doit être chargé');
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

  -- Cash : à remettre au bureau, contre scan du QR du client puis signature
  -- du bénéficiaire (scan_cash_payment → confirm_cash_payment).
  IF p_method = 'cash' THEN
    v_status := 'cash_pending';
  ELSIF v_has_beneficiary_info THEN
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

comment on function public.create_admin_payment(uuid, bigint, numeric, numeric, payment_method, text, text, text, text, text, text, text, text, timestamp with time zone, uuid, jsonb, boolean) is
  '@mola:{"expose":true,"kind":"write","permission":"canProcessPayments","confirm":true,"danger":true,"label":"Créer un paiement fournisseur","resolve":{"p_user_id":"client"},"tool":"create_payment"}';



-- Paiement créé par le CLIENT (app client). Le serveur ne croit plus le
-- client sur le prix : il recalcule le ¥ dû au taux publié, avec l'écart du
-- pays du client et la tranche du montant — la règle de computePaymentValues
-- (src/components/payment-form/paymentRateLogic.ts) — et refuse au-delà de
-- 1 ¥ d'écart. Le taux enregistré est celui du serveur ; jamais « perso ».
-- Les champs bénéficiaire étendus (identifiant, type, complément bancaire)
-- passent ici : un paiement cash naît en cash_pending, où la mise à jour
-- directe qui les écrivait n'est plus permise.
-- Nouvelle surcharge : ses trois derniers paramètres n'ont PAS de défaut,
-- pour que PostgREST ne la confonde jamais avec l'ancienne signature
-- (gardée en enveloppe pour le site déjà déployé).
CREATE OR REPLACE FUNCTION public.create_payment(p_amount_xaf bigint, p_amount_rmb numeric, p_exchange_rate numeric, p_method payment_method, p_beneficiary_name text, p_beneficiary_phone text, p_beneficiary_email text, p_beneficiary_qr_code_url text, p_beneficiary_bank_name text, p_beneficiary_bank_account text, p_beneficiary_notes text, p_cash_beneficiary_type text, p_cash_beneficiary_first_name text, p_cash_beneficiary_last_name text, p_cash_beneficiary_phone text, p_beneficiary_id uuid, p_beneficiary_details jsonb, p_rate_is_custom boolean, p_beneficiary_bank_extra text, p_beneficiary_identifier text, p_beneficiary_identifier_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_wallet RECORD;
  v_new_balance BIGINT;
  v_payment_id UUID;
  v_reference TEXT;
  v_status payment_status;
  v_has_beneficiary_info BOOLEAN;
  v_rates RECORD;
  v_base NUMERIC;
  v_country TEXT;
  v_c NUMERIC;
  v_t_xaf NUMERIC;
  v_t_prelim NUMERIC;
  v_prelim BIGINT;
  v_final_xaf NUMERIC;
  v_final_prelim NUMERIC;
  v_final NUMERIC;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  IF p_amount_xaf IS NULL OR p_amount_xaf <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant doit être positif');
  END IF;

  IF p_amount_rmb IS NULL OR p_amount_rmb <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant en ¥ doit être positif');
  END IF;

  IF p_beneficiary_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.beneficiaries b WHERE b.id = p_beneficiary_id AND b.client_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bénéficiaire introuvable');
  END IF;

  -- ── Le prix, recalculé au taux publié ──
  SELECT * INTO v_rates FROM public.daily_rates WHERE is_active = TRUE LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Taux du jour indisponible : réessayez dans un instant');
  END IF;

  v_base := CASE p_method::text
    WHEN 'cash' THEN v_rates.rate_cash
    WHEN 'alipay' THEN v_rates.rate_alipay
    WHEN 'wechat' THEN v_rates.rate_wechat
    WHEN 'bank_transfer' THEN v_rates.rate_virement
    ELSE NULL END;
  IF v_base IS NULL OR v_base <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Taux du jour indisponible pour ce mode de paiement');
  END IF;

  SELECT c.country INTO v_country FROM public.clients c WHERE c.user_id = v_user_id;
  SELECT COALESCE((SELECT ra.percentage FROM public.rate_adjustments ra
                    WHERE ra.type = 'country' AND ra.key = public._rate_country_key(v_country) LIMIT 1), 0) / 100.0
    INTO v_c;

  -- Tranche du montant XAF (saisie en XAF) …
  SELECT COALESCE((SELECT ra.percentage FROM public.rate_adjustments ra
                    WHERE ra.type = 'tier'
                      AND ra.key = CASE WHEN p_amount_xaf >= 1000000 THEN 't3' WHEN p_amount_xaf >= 400000 THEN 't2' ELSE 't1' END
                    LIMIT 1), 0) / 100.0
    INTO v_t_xaf;
  v_final_xaf := round(v_base * (1 + v_c) * (1 + v_t_xaf), 2);

  -- … ou tranche estimée depuis le ¥ (saisie en ¥), comme l'app.
  v_prelim := round(p_amount_rmb / (v_base * (1 + v_c) / 1000000.0));
  SELECT COALESCE((SELECT ra.percentage FROM public.rate_adjustments ra
                    WHERE ra.type = 'tier'
                      AND ra.key = CASE WHEN v_prelim >= 1000000 THEN 't3' WHEN v_prelim >= 400000 THEN 't2' ELSE 't1' END
                    LIMIT 1), 0) / 100.0
    INTO v_t_prelim;
  v_final_prelim := round(v_base * (1 + v_c) * (1 + v_t_prelim), 2);

  IF abs(p_amount_rmb - p_amount_xaf * v_final_xaf / 1000000.0) <= 1 THEN
    v_final := v_final_xaf;
  ELSIF abs(p_amount_rmb - p_amount_xaf * v_final_prelim / 1000000.0) <= 1 THEN
    v_final := v_final_prelim;
  ELSE
    RETURN jsonb_build_object('success', false, 'error',
      'Le montant en ¥ ne correspond pas au taux du jour : actualisez la page et réessayez',
      'expected_rmb', round(p_amount_xaf * v_final_xaf / 1000000.0, 2));
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_user_id FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille non trouvé');
  END IF;

  IF v_wallet.balance_xaf < p_amount_xaf THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant');
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

  -- Cash : le client présente son QR au bureau ; scan puis signature.
  IF p_method = 'cash' THEN
    v_status := 'cash_pending';
  ELSIF v_has_beneficiary_info THEN
    v_status := 'ready_for_payment';
  ELSE
    v_status := 'waiting_beneficiary_info';
  END IF;

  INSERT INTO public.payments (
    user_id, reference, amount_xaf, amount_rmb, exchange_rate, method, status,
    beneficiary_name, beneficiary_phone, beneficiary_email, beneficiary_qr_code_url,
    beneficiary_bank_name, beneficiary_bank_account, beneficiary_notes,
    beneficiary_bank_extra, beneficiary_identifier, beneficiary_identifier_type,
    cash_beneficiary_type, cash_beneficiary_first_name, cash_beneficiary_last_name, cash_beneficiary_phone,
    balance_before, balance_after,
    beneficiary_id, beneficiary_details, rate_is_custom
  ) VALUES (
    v_user_id, v_reference, p_amount_xaf, p_amount_rmb, round(v_final), p_method, v_status,
    p_beneficiary_name, p_beneficiary_phone, p_beneficiary_email, p_beneficiary_qr_code_url,
    p_beneficiary_bank_name, p_beneficiary_bank_account, p_beneficiary_notes,
    NULLIF(p_beneficiary_bank_extra, ''), NULLIF(p_beneficiary_identifier, ''), NULLIF(p_beneficiary_identifier_type, ''),
    p_cash_beneficiary_type, p_cash_beneficiary_first_name, p_cash_beneficiary_last_name, p_cash_beneficiary_phone,
    v_wallet.balance_xaf, v_new_balance,
    p_beneficiary_id, p_beneficiary_details, false
  ) RETURNING id INTO v_payment_id;

  UPDATE public.wallets
  SET balance_xaf = v_new_balance, updated_at = now()
  WHERE id = v_wallet.id;

  INSERT INTO public.ledger_entries (
    wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
    reference_type, reference_id, description, metadata
  ) VALUES (
    v_wallet.id, v_user_id, 'PAYMENT_RESERVED', p_amount_xaf,
    v_wallet.balance_xaf, v_new_balance, 'payment', v_payment_id,
    'Paiement ' || v_reference,
    jsonb_build_object(
      'method', p_method::text,
      'amount_rmb', p_amount_rmb,
      'exchange_rate', round(v_final),
      'client_exchange_rate', p_exchange_rate
    )
  );

  INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (v_payment_id, 'created', 'Paiement créé - Montant réservé', v_user_id);

  IF NOT v_has_beneficiary_info AND p_method != 'cash' THEN
    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (v_payment_id, 'waiting_info', 'En attente des informations du bénéficiaire', v_user_id);
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    v_user_id,
    'payment_created',
    'Paiement créé',
    format('Votre paiement %s de %s XAF (%s RMB) a été créé. Nouveau solde: %s XAF',
      v_reference,
      to_char(p_amount_xaf, 'FM999G999G999'),
      to_char(p_amount_rmb, 'FM999G999G990D00'),
      to_char(v_new_balance, 'FM999G999G999')),
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
    'new_balance', v_new_balance
  );
END;
$function$;

-- RPC de l'app CLIENT (auth.uid() = le client) : pas une action du staff.
comment on function public.create_payment(bigint, numeric, numeric, payment_method, text, text, text, text, text, text, text, text, text, text, text, uuid, jsonb, boolean, text, text, text) is
  '@mola:{"expose":false,"kind":"write","permission":"canProcessPayments","confirm":true,"danger":true,"label":"Créer un paiement depuis l''app client (le client lui-même, jamais le staff)"}';

-- L'ancienne signature (site déjà déployé) : même chemin, mêmes contrôles.
CREATE OR REPLACE FUNCTION public.create_payment(p_amount_xaf bigint, p_amount_rmb numeric, p_exchange_rate numeric, p_method payment_method, p_beneficiary_name text DEFAULT NULL::text, p_beneficiary_phone text DEFAULT NULL::text, p_beneficiary_email text DEFAULT NULL::text, p_beneficiary_qr_code_url text DEFAULT NULL::text, p_beneficiary_bank_name text DEFAULT NULL::text, p_beneficiary_bank_account text DEFAULT NULL::text, p_beneficiary_notes text DEFAULT NULL::text, p_cash_beneficiary_type text DEFAULT NULL::text, p_cash_beneficiary_first_name text DEFAULT NULL::text, p_cash_beneficiary_last_name text DEFAULT NULL::text, p_cash_beneficiary_phone text DEFAULT NULL::text, p_beneficiary_id uuid DEFAULT NULL::uuid, p_beneficiary_details jsonb DEFAULT NULL::jsonb, p_rate_is_custom boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  SELECT public.create_payment(
    p_amount_xaf => p_amount_xaf, p_amount_rmb => p_amount_rmb, p_exchange_rate => p_exchange_rate, p_method => p_method,
    p_beneficiary_name => p_beneficiary_name, p_beneficiary_phone => p_beneficiary_phone,
    p_beneficiary_email => p_beneficiary_email, p_beneficiary_qr_code_url => p_beneficiary_qr_code_url,
    p_beneficiary_bank_name => p_beneficiary_bank_name, p_beneficiary_bank_account => p_beneficiary_bank_account,
    p_beneficiary_notes => p_beneficiary_notes,
    p_cash_beneficiary_type => p_cash_beneficiary_type, p_cash_beneficiary_first_name => p_cash_beneficiary_first_name,
    p_cash_beneficiary_last_name => p_cash_beneficiary_last_name, p_cash_beneficiary_phone => p_cash_beneficiary_phone,
    p_beneficiary_id => p_beneficiary_id, p_beneficiary_details => p_beneficiary_details, p_rate_is_custom => false,
    p_beneficiary_bank_extra => NULL::text, p_beneficiary_identifier => NULL::text, p_beneficiary_identifier_type => NULL::text)
$function$;

comment on function public.create_payment(bigint, numeric, numeric, payment_method, text, text, text, text, text, text, text, text, text, text, text, uuid, jsonb, boolean) is
  '@mola:{"expose":false,"kind":"write","permission":"canProcessPayments","confirm":true,"danger":true,"label":"Créer un paiement depuis l''app client — ancienne signature, enveloppe de la nouvelle"}';


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
    IF COALESCE(NULLIF(v_line->>'exchange_rate', '')::numeric, 0) <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Chaque ligne doit avoir un taux positif (taux du jour chargé)');
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
    -- Cash : à remettre au bureau (scan du QR puis signature).
    v_status := CASE WHEN v_method = 'cash' THEN 'cash_pending'::payment_status
                     WHEN v_has_benef THEN 'ready_for_payment'::payment_status
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
      (v_line->>'exchange_rate')::numeric, v_method, v_status,
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
        'exchange_rate', (v_line->>'exchange_rate')::numeric,
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

comment on function public.create_payment_batch(uuid, jsonb, text) is
  '@mola:{"expose":true,"kind":"write","permission":"canProcessPayments","confirm":true,"danger":true,"label":"Créer un paiement groupé (plusieurs bénéficiaires, un seul client)","resolve":{"p_user_id":"client"}}';


-- ────────────────────────────────────────────────────────────────────────────
-- 3b. process_payment : le cash ne se commence ni ne se valide ici
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_payment(p_payment_id uuid, p_action text, p_comment text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_payment RECORD;
  v_admin_id UUID;
  v_new_balance BIGINT;
  v_wallet RECORD;
BEGIN
  v_admin_id := auth.uid();

  IF NOT public.admin_has_permission(v_admin_id, 'canProcessPayments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé');
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;

  IF v_payment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement non trouvé');
  END IF;

  -- Cash : scan du QR du client (scan_cash_payment) puis signature du
  -- bénéficiaire (confirm_cash_payment), obligatoires. Le refus reste ici.
  IF v_payment.method = 'cash' AND p_action IN ('start_processing', 'complete') THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Un paiement cash ne se traite pas ici : scannez le QR du client au bureau, puis faites signer le bénéficiaire à la remise des espèces.');
  END IF;

  IF p_action = 'start_processing' THEN
    IF v_payment.status NOT IN ('ready_for_payment') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Le paiement ne peut pas être traité');
    END IF;

    UPDATE public.payments
    SET status = 'processing', processed_by = v_admin_id, updated_at = now()
    WHERE id = p_payment_id;

    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (p_payment_id, 'processing', 'Paiement en cours de traitement', v_admin_id);

    -- Notification for processing started
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      v_payment.user_id,
      'payment_processing',
      'Paiement en cours',
      format('Votre paiement %s de %s RMB est en cours de traitement.',
        v_payment.reference,
        to_char(v_payment.amount_rmb, 'FM999G999G990D00')),
      jsonb_build_object(
        'payment_id', p_payment_id,
        'reference', v_payment.reference,
        'amount_rmb', v_payment.amount_rmb
      )
    );

  ELSIF p_action = 'complete' THEN
    IF v_payment.status NOT IN ('processing') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Le paiement doit être en cours de traitement');
    END IF;

    UPDATE public.payments
    SET status = 'completed', processed_at = now(), client_visible_comment = p_comment, updated_at = now()
    WHERE id = p_payment_id;

    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (p_payment_id, 'completed', 'Paiement effectué avec succès', v_admin_id);

    -- Ledger entry for executed payment
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_payment.user_id FOR UPDATE;
    IF v_wallet IS NOT NULL THEN
      INSERT INTO public.ledger_entries (
        wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
        reference_type, reference_id, description, created_by_admin_id,
        metadata
      ) VALUES (
        v_wallet.id, v_payment.user_id, 'PAYMENT_EXECUTED', v_payment.amount_xaf,
        v_wallet.balance_xaf, v_wallet.balance_xaf, 'payment', p_payment_id,
        format('Paiement exécuté - Réf: %s', v_payment.reference),
        v_admin_id,
        jsonb_build_object(
          'method', v_payment.method::text,
          'amount_rmb', v_payment.amount_rmb
        )
      );
    END IF;

    -- Add audit log
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (
      v_admin_id, 'complete_payment', 'payment', p_payment_id,
      jsonb_build_object(
        'amount_xaf', v_payment.amount_xaf,
        'amount_rmb', v_payment.amount_rmb,
        'user_id', v_payment.user_id
      )
    );

    -- Notification for payment completed
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      v_payment.user_id,
      'payment_completed',
      'Paiement effectué',
      format('Votre paiement %s de %s RMB a été effectué avec succès. Consultez la preuve dans l''application.',
        v_payment.reference,
        to_char(v_payment.amount_rmb, 'FM999G999G990D00')),
      jsonb_build_object(
        'payment_id', p_payment_id,
        'reference', v_payment.reference,
        'amount_rmb', v_payment.amount_rmb
      )
    );

  ELSIF p_action = 'reject' THEN
    -- Statuts TERMINAUX : 'rejected' et 'cancelled_by_admin' ont DÉJÀ recrédité le
    -- portefeuille — refuser à nouveau rembourserait une seconde fois.
    IF v_payment.status IN ('completed', 'rejected', 'cancelled_by_admin') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce paiement est clos (' || v_payment.status || ') : impossible de le refuser');
    END IF;

    IF p_comment IS NULL OR p_comment = '' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Une raison est requise pour le refus');
    END IF;

    -- Get wallet for ledger entry
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_payment.user_id FOR UPDATE;

    -- Refund the balance
    UPDATE public.wallets
    SET balance_xaf = balance_xaf + v_payment.amount_xaf, updated_at = now()
    WHERE user_id = v_payment.user_id
    RETURNING balance_xaf INTO v_new_balance;

    -- Create ledger entry for refund (replaces wallet_operations)
    IF v_wallet IS NOT NULL THEN
      INSERT INTO public.ledger_entries (
        wallet_id, user_id, entry_type, amount_xaf, balance_before, balance_after,
        reference_type, reference_id, description, created_by_admin_id,
        metadata
      ) VALUES (
        v_wallet.id, v_payment.user_id, 'PAYMENT_CANCELLED_REFUNDED', v_payment.amount_xaf,
        v_wallet.balance_xaf, v_new_balance, 'payment', p_payment_id,
        format('Remboursement paiement refusé - Réf: %s', v_payment.reference),
        v_admin_id,
        jsonb_build_object(
          'reason', p_comment,
          'method', v_payment.method::text,
          'amount_rmb', v_payment.amount_rmb
        )
      );
    END IF;

    UPDATE public.payments
    SET status = 'rejected', rejection_reason = p_comment, processed_by = v_admin_id, processed_at = now(), updated_at = now()
    WHERE id = p_payment_id;

    INSERT INTO public.payment_timeline_events (payment_id, event_type, description, performed_by)
    VALUES (p_payment_id, 'rejected', 'Paiement refusé: ' || p_comment, v_admin_id);

    -- Add audit log
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (
      v_admin_id, 'reject_payment', 'payment', p_payment_id,
      jsonb_build_object(
        'amount_xaf', v_payment.amount_xaf,
        'user_id', v_payment.user_id,
        'reason', p_comment,
        'refunded_balance', v_new_balance
      )
    );

    -- Notification for payment rejected
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      v_payment.user_id,
      'payment_rejected',
      'Paiement refusé',
      format('Votre paiement %s de %s XAF a été refusé. Motif: %s. Le montant a été recrédité sur votre solde.',
        v_payment.reference,
        to_char(v_payment.amount_xaf, 'FM999G999G999'),
        p_comment),
      jsonb_build_object(
        'payment_id', p_payment_id,
        'reference', v_payment.reference,
        'amount_xaf', v_payment.amount_xaf,
        'reason', p_comment,
        'new_balance', v_new_balance
      )
    );

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Action non reconnue');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$function$;

comment on function public.process_payment(uuid, text, text) is
  '@mola:{"expose":true,"kind":"write","permission":"canProcessPayments","confirm":true,"danger":true,"label":"Traiter un paiement (p_action: action; p_comment: commentaire)","resolve":{"p_payment_id":"payment"}}';


-- ────────────────────────────────────────────────────────────────────────────
-- 3c. scan_cash_payment(p_payment_id, p_qr_token) : cash_pending → cash_scanned
--     Le QR du client porte un SECRET (payment_cash_tokens) que seul le
--     client peut lire : le scan prouve que son téléphone (ou son QR
--     imprimé) est là. L'ancienne signature, sans jeton, refuse.
--     Exposée à Mola : NON — un agent IA n'a pas de caméra devant le client.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.scan_cash_payment(p_payment_id uuid, p_qr_token text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_payment payments%ROWTYPE;
  v_token   text;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canHandleCash') THEN
    RETURN json_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

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

  IF v_payment.status = 'cash_scanned' THEN
    RETURN json_build_object('success', false, 'error',
      'Ce QR a déjà été scanné : faites signer le bénéficiaire', 'status', 'cash_scanned');
  END IF;

  IF v_payment.status <> 'cash_pending' THEN
    RETURN json_build_object('success', false, 'error', 'Ce paiement cash n''est pas prêt à être remis');
  END IF;

  SELECT t.token INTO v_token FROM public.payment_cash_tokens t WHERE t.payment_id = p_payment_id;
  IF v_token IS NULL OR p_qr_token IS NULL OR btrim(p_qr_token) <> v_token THEN
    RETURN json_build_object('success', false, 'error',
      'QR invalide : scannez le QR affiché dans l''app du client');
  END IF;

  -- Le montant à remettre doit être réservé sur le portefeuille du client.
  IF public._payment_debit_held(p_payment_id) <> v_payment.amount_xaf THEN
    RETURN json_build_object('success', false, 'error',
      'Montant non réservé au grand livre : remise impossible, prévenez la direction');
  END IF;

  UPDATE payments
  SET
    status          = 'cash_scanned',
    cash_scanned_at = now(),
    cash_scanned_by = auth.uid(),
    updated_at      = now()
  WHERE id = p_payment_id;

  INSERT INTO payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (p_payment_id, 'cash_scanned', 'QR Code scanné au bureau', auth.uid());

  RETURN json_build_object(
    'success', true,
    'payment', row_to_json(v_payment)
  );
END;
$function$;

comment on function public.scan_cash_payment(uuid, text) is
  '@mola:{"expose":false,"kind":"write","permission":"canHandleCash","confirm":true,"danger":false,"label":"Scanner le QR d''un paiement cash (au bureau, devant le client — jamais par Mola)","resolve":{"p_payment_id":"payment"}}';

CREATE OR REPLACE FUNCTION public.scan_cash_payment(p_payment_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canHandleCash') THEN
    RETURN json_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  RETURN json_build_object('success', false, 'error',
    'Mettez l''application à jour : le scan exige le QR complet du client');
END;
$function$;

comment on function public.scan_cash_payment(uuid) is
  '@mola:{"expose":false,"kind":"write","permission":"canHandleCash","confirm":true,"danger":false,"label":"Ancienne signature du scan cash, sans jeton : refuse toujours"}';


-- ────────────────────────────────────────────────────────────────────────────
-- 3d. confirm_cash_payment(p_payment_id, p_signature_path, p_signed_by_name,
--     p_signer_id_number) : seulement après le scan, avec la signature
--     déposée PAR CETTE PERSONNE dans le bucket cash-signatures, sous
--     « <id du paiement>/ », après le scan. Le nom est celui que le
--     signataire DÉCLARE. L'ancienne signature (URL publique) refuse.
--     Exposée à Mola : NON — la signature se prend sur l'écran, devant le
--     bénéficiaire.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_cash_payment(p_payment_id uuid, p_signature_path text, p_signed_by_name text, p_signer_id_number text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_payment payments%ROWTYPE;
  v_wallet  wallets%ROWTYPE;
  v_path      text := NULLIF(btrim(COALESCE(p_signature_path, '')), '');
  v_signed_by text := NULLIF(btrim(COALESCE(p_signed_by_name, '')), '');
  v_id_number text := NULLIF(btrim(COALESCE(p_signer_id_number, '')), '');
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canHandleCash') THEN
    RETURN json_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

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

  -- Scan du QR du client OBLIGATOIRE avant la remise.
  IF v_payment.status <> 'cash_scanned' OR v_payment.cash_scanned_at IS NULL THEN
    RETURN json_build_object('success', false, 'error',
      'Scannez d''abord le QR du client : la remise se confirme seulement après le scan');
  END IF;

  IF v_signed_by IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Le nom déclaré par la personne qui signe est obligatoire');
  END IF;

  -- Signature du bénéficiaire OBLIGATOIRE : un vrai fichier, déposé par
  -- l'appelant, pour CE paiement, après le scan.
  IF v_path IS NULL
     OR left(v_path, length(p_payment_id::text) + 1) <> p_payment_id::text || '/'
     OR NOT EXISTS (
       SELECT 1 FROM storage.objects o
        WHERE o.bucket_id = 'cash-signatures'
          AND o.name = v_path
          AND COALESCE(o.owner_id, o.owner::text) = auth.uid()::text
          AND o.created_at >= v_payment.cash_scanned_at
     ) THEN
    RETURN json_build_object('success', false, 'error', 'La signature du bénéficiaire est obligatoire');
  END IF;

  IF public._payment_debit_held(p_payment_id) <> v_payment.amount_xaf THEN
    RETURN json_build_object('success', false, 'error',
      'Montant non réservé au grand livre : remise impossible, prévenez la direction');
  END IF;

  SELECT * INTO v_wallet FROM wallets WHERE user_id = v_payment.user_id FOR UPDATE;

  UPDATE payments
  SET
    status                   = 'completed',
    cash_signature_url       = v_path,
    cash_signature_timestamp = now(),
    cash_signed_by_name      = v_signed_by,
    cash_signer_id_number    = v_id_number,
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
        'method',         'cash',
        'amount_rmb',     v_payment.amount_rmb,
        'cash_signed_by', v_signed_by,
        'cash_signer_id_number', v_id_number
      )
    );
  END IF;

  INSERT INTO payment_timeline_events (payment_id, event_type, description, performed_by)
  VALUES (p_payment_id, 'cash_paid', 'Paiement cash effectué - Signé par ' || v_signed_by, auth.uid());

  RETURN json_build_object('success', true);
END;
$function$;

comment on function public.confirm_cash_payment(uuid, text, text, text) is
  '@mola:{"expose":false,"kind":"write","permission":"canHandleCash","confirm":true,"danger":true,"label":"Confirmer la remise d''un paiement cash (après scan, signature prise à l''écran — jamais par Mola)","resolve":{"p_payment_id":"payment"}}';

CREATE OR REPLACE FUNCTION public.confirm_cash_payment(p_payment_id uuid, p_signature_url text, p_signed_by_name text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canHandleCash') THEN
    RETURN json_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  RETURN json_build_object('success', false, 'error',
    'Mettez l''application à jour : la remise exige la signature déposée et le nom déclaré');
END;
$function$;

comment on function public.confirm_cash_payment(uuid, text, text) is
  '@mola:{"expose":false,"kind":"write","permission":"canHandleCash","confirm":true,"danger":false,"label":"Ancienne signature de la confirmation cash : refuse toujours"}';


-- ────────────────────────────────────────────────────────────────────────────
-- 3e. Garde-fou : hors RPC, un appel direct de l'API (rôles anon /
--     authenticated) ne crée, ne supprime ni ne fait avancer AUCUN
--     paiement, et ne touche qu'aux coordonnées du bénéficiaire.
--     Les politiques « Admins can update/delete payments » (is_admin),
--     « Cash agents can update cash payments » et « Users can update own
--     payments beneficiary info » ouvrent des lignes entières : ce trigger
--     ferme les colonnes. Dans une RPC SECURITY DEFINER, current_user est
--     le propriétaire de la fonction : non concerné ; service_role non plus.
--
--     Colonnes qu'un appel direct PEUT encore modifier (les écrans les
--     écrivent ainsi aujourd'hui, src/hooks/useAdminPayments.ts et
--     src/hooks/usePayments.ts) :
--       beneficiary_name, beneficiary_phone, beneficiary_email,
--       beneficiary_qr_code_url, beneficiary_bank_name,
--       beneficiary_bank_account, beneficiary_bank_extra, beneficiary_notes,
--       beneficiary_identifier, beneficiary_identifier_type,
--       beneficiary_id, beneficiary_details, updated_at.
--     Tout le reste (statut, montants, taux, rate_is_custom, client,
--     méthode, soldes, référence, lot, traitement, commentaires, cash_*) :
--     refusé s'il change — y compris la sortie d'un statut clos.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_cash_payment_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  c_direct_ok CONSTANT text[] := ARRAY[
    'beneficiary_name', 'beneficiary_phone', 'beneficiary_email',
    'beneficiary_qr_code_url', 'beneficiary_bank_name', 'beneficiary_bank_account',
    'beneficiary_bank_extra', 'beneficiary_notes', 'beneficiary_identifier',
    'beneficiary_identifier_type', 'beneficiary_id', 'beneficiary_details', 'updated_at'
  ];
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Un paiement se crée seulement par les RPC de création (le solde est réservé au grand livre)'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Un paiement ne se supprime pas : annulez-le (remboursement au grand livre)'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status IN ('completed', 'rejected', 'cancelled_by_admin') THEN
      RAISE EXCEPTION 'Un paiement clos (%) ne se rouvre pas', OLD.status USING ERRCODE = '42501';
    END IF;
    IF OLD.method = 'cash' OR NEW.method = 'cash' THEN
      RAISE EXCEPTION 'Un paiement cash avance seulement par le scan du QR du client puis la signature du bénéficiaire'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF (to_jsonb(NEW) - c_direct_ok) IS DISTINCT FROM (to_jsonb(OLD) - c_direct_ok) THEN
    RAISE EXCEPTION 'Seules les coordonnées du bénéficiaire se modifient directement ; le reste passe par les RPC'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

comment on function public.guard_cash_payment_status() is
  '@mola:{"expose":false,"kind":"write","permission":"canHandleCash","confirm":false,"danger":false,"label":"Garde-fou interne (trigger) : hors RPC, seules les coordonnées du bénéficiaire d''un paiement changent"}';

REVOKE EXECUTE ON FUNCTION public.guard_cash_payment_status() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER payments_cash_chain_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_cash_payment_status();

-- Un client n'insère plus de paiement à la main (aucun écran ne le fait :
-- tout passe par create_payment, qui réserve le solde).
ALTER POLICY "Users can create own payments" ON public.payments
  WITH CHECK (false);


-- ────────────────────────────────────────────────────────────────────────────
-- 4. Notifications : « cash à remettre » vers qui a canHandleCash
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._staff_push_kind(p_permission text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case p_permission
    when 'canProcessDeposits' then 'deposits'
    when 'canProcessPayments' then 'payments'
    when 'canHandleCash' then 'payments'
    when 'canAccessSupportChat' then 'support'
    when 'canReceiveAtDestination' then 'arrivals'
    when 'canSignCustoms' then 'customs'
    when 'canManageSales' then 'sales_admin'
    when 'canManageCargo' then 'cargo'
    when 'canReceiveParcels' then 'reception'
    else 'other'
  end
$function$;

comment on function public._staff_push_kind(text) is
  '@mola:{"expose":false,"kind":"read","permission":"canManageUsers","confirm":false,"danger":false,"label":"Type d''une notification d''après sa permission (interne)"}';

CREATE OR REPLACE FUNCTION public.staff_push_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_method text := case new.method::text when 'alipay' then 'Alipay' when 'wechat' then 'WeChat Pay' when 'bank_transfer' then 'Virement' when 'cash' then 'Cash' else new.method::text end;
  v_amount text := public.staff_push_amount(new.amount_rmb) || ' ¥';
  v_benef text;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;
  if new.status = 'ready_for_payment' and new.method::text <> 'cash' then
    perform public.send_staff_push('canProcessPayments', 'Paiement à traiter',
      coalesce(public.staff_push_client_name(new.user_id), 'Client') || ' · ' || v_amount || ' · ' || v_method || ' · ' || coalesce(new.reference, ''),
      '/m/payments/' || new.id, null, auth.uid());
  elsif new.status = 'cash_pending' then
    v_benef := coalesce(nullif(trim(coalesce(new.cash_beneficiary_first_name, '') || ' ' || coalesce(new.cash_beneficiary_last_name, '')), ''), new.beneficiary_name, 'Bénéficiaire');
    -- L'agent cash (son espace /a), et l'équipe habilitée à remettre le cash
    -- (sa fiche /m) : sans agent actif, le paiement n'attend pas en silence.
    perform public.send_staff_push_k('payments', 'canHandleCash', 'Paiement cash à remettre',
      v_benef || ' · ' || v_amount || ' · ' || coalesce(new.reference, ''),
      '/a/payment/' || new.id, array['cash_agent'], auth.uid());
    perform public.send_staff_push_k('payments', 'canHandleCash', 'Paiement cash à remettre',
      v_benef || ' · ' || v_amount || ' · ' || coalesce(new.reference, ''),
      '/m/payments/' || new.id, array['super_admin', 'ops'], auth.uid());
  elsif new.status = 'cash_scanned' then
    perform public.send_staff_push_k('payments', 'canHandleCash', 'Paiement cash scanné',
      'À faire signer · ' || v_amount || ' · ' || coalesce(new.reference, ''),
      '/m/payments/' || new.id, array['super_admin', 'ops'], auth.uid());
  end if;
  return new;
exception when others then
  raise warning 'staff_push_on_payment: %', sqlerrm;
  return new;
end;
$function$;

comment on function public.staff_push_on_payment() is
  '@mola:{"expose":false,"kind":"write","permission":"canManageUsers","confirm":false,"danger":false,"label":"Notification push du personnel à chaque étape d''un paiement (trigger interne)"}';

-- Le réglage « Paiements » de l'écran Moi : aussi pour qui remet le cash.
CREATE OR REPLACE FUNCTION public.staff_push_prefs_get()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  select r.role::text into v_role from public.user_roles r
   where r.user_id = v_uid and (r.is_disabled = false or r.is_disabled is null);
  if v_role is null then
    return jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  end if;
  return jsonb_build_object('success', true, 'kinds', coalesce((
    select jsonb_agg(jsonb_build_object('kind', k.kind, 'label', k.label, 'hint', k.hint,
                                        'enabled', public.staff_push_wants(v_uid, k.kind)) order by k.ord)
      from (values
        (1, 'deposits', 'Dépôts à valider', 'Un client a envoyé la preuve de son dépôt', public.admin_has_permission(v_uid, 'canProcessDeposits')),
        (2, 'payments', 'Paiements à traiter', 'Paiements prêts, cash à remettre ou à confirmer', public.admin_has_permission(v_uid, 'canProcessPayments') or public.admin_has_permission(v_uid, 'canHandleCash')),
        (3, 'support', 'Messages des clients', 'Un client écrit au support', public.admin_has_permission(v_uid, 'canAccessSupportChat')),
        (4, 'cargo', 'Conteneurs', 'En retard, ou qui arrivent sous 7 jours', public.admin_has_permission(v_uid, 'canManageCargo')),
        (5, 'arrivals', 'Arrivées à Douala', 'Un vol ou un conteneur est arrivé : colis à pointer', public.admin_has_permission(v_uid, 'canReceiveAtDestination')),
        (6, 'reception', 'Rappels de la réception', 'Colis à emballer le matin, dépôts sans client le soir', v_role = 'receptionist'),
        (7, 'customs', 'Douane', 'Dossiers à signer', public.admin_has_permission(v_uid, 'canSignCustoms')),
        (8, 'sales', 'Mes prospects et mes clients', 'Prospect devenu client, premier dépôt ou paiement, objectif atteint', v_role = 'commercial'),
        (9, 'sales_admin', 'Vérifications des commerciaux', 'Un commercial a saisi le numéro d’un client Bonzini', public.admin_has_permission(v_uid, 'canManageSales'))
      ) as k(ord, kind, label, hint, relevant)
     where k.relevant), '[]'::jsonb));
end;
$function$;

comment on function public.staff_push_prefs_get() is
  '@mola:{"expose":false,"kind":"read","permission":"canViewLogs","confirm":false,"danger":false,"label":"Mes types de notifications sur l''app BONZINI HQ (réglage personnel du téléphone)"}';


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Le client est prévenu dès la création d'un paiement cash
--    (notify_cash_payment_ready ne partait qu'au PASSAGE en cash_pending,
--    or un paiement cash naît désormais dans ce statut).
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE TRIGGER on_cash_payment_created
  AFTER INSERT ON public.payments
  FOR EACH ROW WHEN (NEW.status = 'cash_pending'::payment_status)
  EXECUTE FUNCTION public.notify_cash_payment_ready();


-- ────────────────────────────────────────────────────────────────────────────
-- 6. Reprise des paiements cash ouverts
--    · ceux restés en ready_for_payment / processing (l'ancien chemin)
--      passent en cash_pending : scan_cash_payment n'accepte plus que lui ;
--    · chaque paiement cash ouvert reçoit son jeton de QR.
--    Rejouable : la seconde fois, il n'y a plus rien à reprendre.
-- ────────────────────────────────────────────────────────────────────────────
WITH moved AS (
  UPDATE public.payments
     SET status = 'cash_pending', updated_at = now()
   WHERE method = 'cash'
     AND status IN ('ready_for_payment', 'processing')
  RETURNING id
)
INSERT INTO public.payment_timeline_events (payment_id, event_type, description)
SELECT id, 'cash_pending', 'Remise cash : scan du QR du client puis signature du bénéficiaire (reprise du 21/10/2026)'
  FROM moved;

INSERT INTO public.payment_cash_tokens (payment_id, token)
SELECT p.id, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
  FROM public.payments p
 WHERE p.method = 'cash'
   AND p.status NOT IN ('completed', 'rejected', 'cancelled_by_admin')
ON CONFLICT (payment_id) DO NOTHING;
