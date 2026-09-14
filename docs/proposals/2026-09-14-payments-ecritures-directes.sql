-- PROPOSITION (non appliquée) — audit produit, itération 1 « Paiements »
-- Findings F-022 (P0), F-024 (P1), F-021 (P2) du registre docs/registre-findings.md.
--
-- Constat (preuves) :
--   * 20251220211736 :84  CREATE POLICY "Users can create own payments" … FOR INSERT
--       WITH CHECK (auth.uid() = user_id)   — jamais retirée.
--       ⇒ un client authentifié peut INSÉRER une ligne `payments` par PostgREST
--         avec le statut, le montant XAF/RMB et le taux de son choix, SANS le
--         débit de portefeuille que fait `create_payment`. L'opérateur voit un
--         paiement « prêt à payer » et paie le fournisseur.
--   * 20260331000001      "Users can update own payments beneficiary info" (UPDATE)
--       USING/WITH CHECK : propriétaire + statut ∈ {created, waiting, ready}.
--       ⇒ RLS ne borne pas les COLONNES : amount_rmb, amount_xaf, exchange_rate,
--         method, cash_* sont modifiables tant que le paiement n'est pas traité.
--   * 20260107115520 :27  "Cash agents can update cash payments" (UPDATE, USING seul,
--       pas de WITH CHECK) ⇒ un agent cash peut passer un paiement cash à
--       `completed` sans signature, ou changer le montant.
--   * Aucun GRANT de colonnes sur public.payments (grep « GRANT UPDATE ( » vide) :
--       le rôle `authenticated` a tous les privilèges par défaut.
--
-- Ce que l'app écrit RÉELLEMENT en direct (relu) :
--   * client (src/hooks/usePayments.ts:270 et :364) : beneficiary_id, beneficiary_details,
--     rate_is_custom, beneficiary_identifier, beneficiary_identifier_type, beneficiary_bank_extra ;
--   * admin (src/hooks/useAdminPayments.ts:392) : beneficiary_name/phone/email/bank_name/
--     bank_account/notes/bank_extra/identifier/identifier_type/qr_code_url ;
--   * agent cash : aucune écriture directe (useAgentCashPayments ne fait que SELECT ;
--     scan/confirm passent par les RPC SECURITY DEFINER).
--   Aucune insertion directe côté client (grep `from('payments').insert` vide) —
--   `create_payment` (RPC) est le seul chemin de création.
--
-- Correction proposée (cause racine : privilèges trop larges, pas l'UI) :
begin;

-- 1. Plus d'insertion directe : la création passe par create_payment / create_admin_payment.
drop policy if exists "Users can create own payments" on public.payments;

-- 2. Plus de mise à jour libre par un agent cash : scan_cash_payment / confirm_cash_payment
--    (SECURITY DEFINER, gardées par admin_has_permission) sont les seuls chemins.
drop policy if exists "Cash agents can update cash payments" on public.payments;

-- 3. Les mises à jour directes restantes (client et admin) ne peuvent toucher
--    QUE les colonnes du bénéficiaire. Les RPC SECURITY DEFINER (propriétaire
--    postgres) ne sont pas concernées par ces grants.
revoke update on public.payments from authenticated;
grant update (
  beneficiary_id, beneficiary_details, beneficiary_name, beneficiary_phone,
  beneficiary_email, beneficiary_bank_name, beneficiary_bank_account,
  beneficiary_bank_extra, beneficiary_identifier, beneficiary_identifier_type,
  beneficiary_notes, beneficiary_qr_code_url, rate_is_custom, updated_at
) on public.payments to authenticated;

commit;

-- Vérification après application (à lancer connecté en tant que client) :
--   update public.payments set amount_rmb = 1 where user_id = auth.uid();   -- doit échouer : permission denied
--   insert into public.payments (user_id, amount_xaf, amount_rmb, status) values (auth.uid(), 1, 1, 'ready_for_payment'); -- doit échouer
-- Risque résiduel : `rate_is_custom` reste modifiable par le client (l'app l'écrit à la création) —
-- à retirer de la liste si le taux perso est réservé à l'admin.

-- ─────────────────────────────────────────────────────────────────────────
-- VÉRIFIÉ LOCALEMENT le 14 sept. 2026 (Postgres 16 jetable, docs/proposals/verif/) :
--   avant : client insère un paiement « prêt à payer » de 1 XAF / 999 999 ¥ (INSERT 0 1),
--           gonfle amount_rmb (UPDATE 1) ; agent cash clôt un cash sans signature (UPDATE 1) ;
--           admin change un montant en direct (UPDATE 1).
--   après : A1 « violates row-level security », A2/B1/C2 « permission denied » ;
--           A3 (client, colonnes bénéficiaire) et C1 (admin, colonnes bénéficiaire) passent ;
--           une RPC SECURITY DEFINER met toujours le statut à jour.
-- ─────────────────────────────────────────────────────────────────────────
