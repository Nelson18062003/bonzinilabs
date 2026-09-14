\set ON_ERROR_STOP off
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
\echo -- D1 client 1 : solde 1 213 450 XAF → doit être refusé
select public.admin_delete_client('00000000-0000-0000-0000-000000000001');
\echo -- D2 client 2 : solde 0 mais un paiement en cours → refusé
select public.admin_delete_client('00000000-0000-0000-0000-000000000002');
\echo -- D3 client 3 : solde 0, rien en cours → supprimé
select public.admin_delete_client('00000000-0000-0000-0000-000000000003');
select count(*) as wallets_restants from public.wallets;
reset role; reset request.jwt.claim.sub;
\echo -- E1 client 1 déclare un dépôt sur le compte du client 2 → refusé
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select public.stub_create_client_deposit('00000000-0000-0000-0000-000000000002', 50000);
\echo -- E2 client 1 déclare sur son propre compte → accepté
select public.stub_create_client_deposit('00000000-0000-0000-0000-000000000001', 50000);
reset role; reset request.jwt.claim.sub;
\echo -- E3 l admin ops déclare pour le client 2 (canProcessDeposits) → accepté
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.stub_create_client_deposit('00000000-0000-0000-0000-000000000002', 50000);
reset role; reset request.jwt.claim.sub;
