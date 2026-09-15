\set ON_ERROR_STOP off
\echo === EN TANT QUE CLIENT 1 (authenticated)
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
\echo -- A1 insertion directe d un paiement « prêt à payer » sans débit :
insert into public.payments (user_id, amount_xaf, amount_rmb, status) values (auth.uid(), 1, 999999, 'ready_for_payment');
\echo -- A2 gonfler amount_rmb d un paiement existant :
update public.payments set amount_rmb = 999999 where id = '10000000-0000-0000-0000-000000000001';
\echo -- A3 écrire le bénéficiaire (chemin légitime de l app) :
update public.payments set beneficiary_name = 'Fournisseur', beneficiary_identifier = 'x' where id = '10000000-0000-0000-0000-000000000001';
reset role; reset request.jwt.claim.sub;
\echo === EN TANT QU AGENT CASH
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
\echo -- B1 clore un cash sans signature :
update public.payments set status = 'completed', amount_xaf = 1 where id = '10000000-0000-0000-0000-000000000002';
reset role; reset request.jwt.claim.sub;
\echo === EN TANT QU ADMIN OPS
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
\echo -- C1 mise à jour directe des colonnes bénéficiaire (useAdminPayments:392) :
update public.payments set beneficiary_qr_code_url = 'p/q.png', beneficiary_bank_extra = 'e' where id = '10000000-0000-0000-0000-000000000001';
\echo -- C2 changer un montant en direct :
update public.payments set amount_xaf = 5 where id = '10000000-0000-0000-0000-000000000001';
reset role; reset request.jwt.claim.sub;
select id, amount_xaf, amount_rmb, status, beneficiary_name from public.payments order by id;
