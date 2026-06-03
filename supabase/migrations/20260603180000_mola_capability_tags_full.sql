-- Mola — Étiquetage COMPLET du catalogue d'actions (rend la découverte exhaustive).
-- Objectif : que `find_capability` voie TOUTES les actions de la plateforme, pas seulement les
-- pilotes. Les actions adossées à un OUTIL DÉDIÉ riche portent un champ "tool" : `do_capability`
-- redirige alors vers cet outil (plus complet : calcul de taux, vérif de solde, carte de confirmation).
-- Les actions SANS "tool" restent exécutables directement par `do_capability`.
--
-- Méthode robuste : on commente par la SIGNATURE RÉELLE (oid::regprocedure) — pas besoin de
-- réécrire les types d'arguments, et ça gère les fonctions surchargées.

do $$
declare
  rec record;
  r record;
begin
  for rec in
    select * from (values
      -- ── Clients ──
      ('admin_create_client',              '@mola:{"expose":true,"kind":"write","permission":"canEditClients","label":"Créer un client","tool":"create_client"}'),
      ('admin_delete_client',              '@mola:{"expose":true,"kind":"write","permission":"canManageUsers","danger":true,"label":"Supprimer un client (définitif)","tool":"delete_client"}'),
      -- ── Dépôts ──
      ('create_client_deposit',            '@mola:{"expose":true,"kind":"write","permission":"canProcessDeposits","label":"Créer un dépôt","tool":"create_deposit"}'),
      ('validate_deposit',                 '@mola:{"expose":true,"kind":"write","permission":"canProcessDeposits","danger":true,"label":"Valider un dépôt (crédite le wallet)","tool":"validate_deposit"}'),
      ('reject_deposit',                   '@mola:{"expose":true,"kind":"write","permission":"canProcessDeposits","danger":true,"label":"Rejeter un dépôt","tool":"reject_deposit"}'),
      -- ── Paiements ──
      ('create_admin_payment',             '@mola:{"expose":true,"kind":"write","permission":"canProcessPayments","danger":true,"label":"Créer un paiement fournisseur","tool":"create_payment"}'),
      ('admin_update_payment_beneficiary', '@mola:{"expose":true,"kind":"write","permission":"canProcessPayments","label":"Compléter le bénéficiaire d''un paiement","tool":"update_payment_beneficiary"}'),
      ('cancel_payment',                   '@mola:{"expose":true,"kind":"write","permission":"canProcessPayments","danger":true,"label":"Annuler un paiement (rembourse)","tool":"cancel_payment"}'),
      -- ── Taux ──
      ('create_daily_rates',               '@mola:{"expose":true,"kind":"write","permission":"canManageRates","danger":true,"label":"Définir le taux du jour","tool":"set_daily_rate"}'),
      ('update_rate_adjustment',           '@mola:{"expose":true,"kind":"write","permission":"canManageRates","danger":true,"label":"Ajuster un taux par pays/palier","tool":"set_rate_adjustment"}'),
      -- ── Wallet ──
      ('admin_adjust_wallet',              '@mola:{"expose":true,"kind":"write","permission":"canProcessDeposits","danger":true,"label":"Créditer/débiter un wallet","tool":"adjust_wallet"}'),
      -- ── Trésorerie ──
      ('record_usdt_purchase',             '@mola:{"expose":true,"kind":"write","permission":"canViewTreasury","danger":true,"label":"Enregistrer un achat USDT","tool":"record_usdt_purchase"}'),
      ('record_usdt_sale',                 '@mola:{"expose":true,"kind":"write","permission":"canViewTreasury","danger":true,"label":"Enregistrer une vente USDT","tool":"record_usdt_sale"}'),
      ('create_treasury_counterparty',     '@mola:{"expose":true,"kind":"write","permission":"canViewTreasury","label":"Créer une contrepartie trésorerie","tool":"create_treasury_counterparty"}'),
      ('update_treasury_counterparty',     '@mola:{"expose":true,"kind":"write","permission":"canViewTreasury","label":"Modifier une contrepartie","tool":"update_treasury_counterparty"}'),
      ('delete_treasury_counterparty',     '@mola:{"expose":true,"kind":"write","permission":"canViewTreasury","danger":true,"label":"Supprimer une contrepartie","tool":"delete_treasury_counterparty"}'),
      ('adjust_treasury_account',          '@mola:{"expose":true,"kind":"write","permission":"canViewTreasury","danger":true,"label":"Ajuster un compte trésorerie","tool":"adjust_treasury_account"}'),
      ('void_treasury_operation',          '@mola:{"expose":true,"kind":"write","permission":"canViewTreasury","danger":true,"label":"Annuler une opération trésorerie","tool":"void_treasury_operation"}'),
      ('record_inventory_snapshot',        '@mola:{"expose":true,"kind":"write","permission":"canViewTreasury","danger":true,"label":"Enregistrer un inventaire","tool":"record_inventory_snapshot"}')
    ) as t(fn, meta)
  loop
    for r in
      select oid::regprocedure as sig
      from pg_proc
      where proname = rec.fn and pronamespace = 'public'::regnamespace
    loop
      execute format('comment on function %s is %L', r.sig::text, rec.meta);
    end loop;
  end loop;
end $$;
