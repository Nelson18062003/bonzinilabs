-- ============================================================================
-- Douane, étape 5 — le circuit de l'audit (20260929130000_customs_audit_workflow.sql),
-- rejoué après le socle : prendre, abandonner, notifier au bon endroit.
-- ============================================================================
\set ON_ERROR_STOP on
SET client_min_messages = warning;

CREATE OR REPLACE FUNCTION public._assert(cond BOOLEAN, msg TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF cond IS NOT TRUE THEN RAISE EXCEPTION 'ÉCHEC : %', msg; END IF; END $$;
GRANT EXECUTE ON FUNCTION public._assert(BOOLEAN, TEXT) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public._as(p_uid UUID) RETURNS VOID LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_uid)::text, false);
$$;
GRANT EXECUTE ON FUNCTION public._as(UUID) TO anon, authenticated, service_role;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'awa@client.cm'),
  ('00000000-0000-0000-0000-00000000000b', 'jean@client.cm'),
  ('00000000-0000-0000-0000-00000000000c', 'ops@bonzini'),
  ('00000000-0000-0000-0000-00000000000e', 'cad@citra.cm'),
  ('00000000-0000-0000-0000-000000000012', 'cad2@citra.cm'),
  ('00000000-0000-0000-0000-000000000010', 'fondateur@bonzini');
INSERT INTO public.clients (user_id, first_name, last_name, company_name, customer_code) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'Awa', 'Ngo', 'Awa Import', 'BZ-AWA1'),
  ('00000000-0000-0000-0000-00000000000b', 'Jean', 'Kamga', NULL, 'BZ-JEA2');
INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-00000000000c', 'ops'),
  ('00000000-0000-0000-0000-00000000000e', 'customs_broker'),
  ('00000000-0000-0000-0000-000000000012', 'customs_broker'),
  ('00000000-0000-0000-0000-000000000010', 'super_admin');

SET ROLE authenticated;
SELECT _as('00000000-0000-0000-0000-000000000010');
SELECT _assert((customs_broker_register('00000000-0000-0000-0000-00000000000e', 'CITRA SARL', 'CAD-0451') ->> 'success')::boolean, 'CAD 1 enregistré');
SELECT _assert((customs_broker_register('00000000-0000-0000-0000-000000000012', 'CITRA SARL', 'CAD-0452') ->> 'success')::boolean, 'CAD 2 enregistré');

-- Awa dépose deux DAU.
SELECT _as('00000000-0000-0000-0000-00000000000a');
SELECT _assert((customs_audit_create(ARRAY['00000000-0000-0000-0000-00000000000a/dau1.pdf'], 'SDSD2-2026-IMP-020399-I', DATE '2026-09-17') ->> 'ref') = 'AU-000001', 'AU-000001');
SELECT _assert((customs_audit_create(ARRAY['00000000-0000-0000-0000-00000000000a/dau2.pdf']) ->> 'ref') = 'AU-000002', 'AU-000002');

-- ── Prendre : pas avant l'envoi, seulement un CAD enregistré, un seul à la fois.
SELECT _as('00000000-0000-0000-0000-00000000000e');
SELECT _assert((customs_audit_claim((SELECT id FROM public.customs_audits WHERE ref = 'AU-000001')) ->> 'success')::boolean = false, 'pas de relecture avant l''envoi');

SELECT _as('00000000-0000-0000-0000-00000000000a');
SELECT _assert((customs_audit_save_findings((SELECT id FROM customs_audits WHERE ref = 'AU-000001'), '[]', 1749209, 307078) ->> 'success')::boolean, 'constats');
SELECT _assert((customs_audit_submit((SELECT id FROM customs_audits WHERE ref = 'AU-000001')) ->> 'status') = 'submitted', 'envoyé');
SELECT _assert((SELECT path FROM public._staff_push_log ORDER BY at DESC LIMIT 1) = '/m/douane/audit/' || (SELECT id FROM public.customs_audits WHERE ref = 'AU-000001')::text,
               'la notification mène à l''écran de l''audit, pas à celui des fiches');
SELECT _assert((SELECT body FROM public._staff_push_log ORDER BY at DESC LIMIT 1) LIKE '%307078 XAF%', 'la notification dit l''enjeu');

SELECT _as('00000000-0000-0000-0000-00000000000c');
SELECT _assert((customs_audit_claim((SELECT id FROM customs_audits WHERE ref = 'AU-000001')) ->> 'success')::boolean = false, 'les opérations ne prennent pas un audit');

SELECT _as('00000000-0000-0000-0000-00000000000e');
SELECT _assert((customs_audit_claim((SELECT id FROM customs_audits WHERE ref = 'AU-000001')) ->> 'status') = 'in_review', 'le CAD 1 prend l''audit');
SELECT _assert((customs_review_queue() -> 'audits' -> 0 ->> 'mine')::boolean, 'la file le marque « à vous »');
SELECT _as('00000000-0000-0000-0000-000000000012');
SELECT _assert((customs_audit_claim((SELECT id FROM customs_audits WHERE ref = 'AU-000001')) ->> 'success')::boolean = false, 'le CAD 2 ne le reprend pas');
SELECT _assert((customs_audit_review((SELECT id FROM customs_audits WHERE ref = 'AU-000001'), 'mon avis', 1) ->> 'success')::boolean = false, 'ni ne rend l''avis à sa place');

-- ── Abandonner : le client seul, jamais après l'avis.
SELECT _as('00000000-0000-0000-0000-00000000000b');
SELECT _assert((customs_audit_cancel((SELECT id FROM public.customs_audits WHERE ref = 'AU-000002')) ->> 'success')::boolean = false, 'Jean n''abandonne pas l''audit d''Awa');
SELECT _as('00000000-0000-0000-0000-00000000000a');
SELECT _assert((customs_audit_cancel((SELECT id FROM customs_audits WHERE ref = 'AU-000002')) ->> 'success')::boolean, 'Awa abandonne AU-000002');
SELECT _assert((customs_audit_cancel((SELECT id FROM customs_audits WHERE ref = 'AU-000002')) ->> 'success')::boolean = false, 'deux fois : non');
SELECT _assert(jsonb_array_length(customs_my_files() -> 'audits') = 1, 'l''audit abandonné sort de la liste');

SELECT _as('00000000-0000-0000-0000-00000000000e');
SELECT _assert((customs_audit_review((SELECT id FROM customs_audits WHERE ref = 'AU-000001'),
  'Art. 5 : réclamation (accise hors annexe II). Art. 8, 9, 10 : mainlevée accordée, gain sur les prochains conteneurs.', 58136) ->> 'status') = 'reviewed', 'le CAD 1 rend son avis');
SELECT _assert((customs_review_queue() -> 'recent' -> 0 ->> 'kind') = 'audit' AND (customs_review_queue() -> 'recent' -> 0 ->> 'amount_xaf')::bigint = 58136,
               'l''audit relu rejoint l''historique, avec le montant récupérable');

SELECT _as('00000000-0000-0000-0000-00000000000a');
SELECT _assert((customs_audit_cancel((SELECT id FROM customs_audits WHERE ref = 'AU-000001')) ->> 'success')::boolean = false, 'un avis rendu ne s''abandonne pas');
SELECT _assert((SELECT type FROM public.notifications ORDER BY created_at DESC LIMIT 1) = 'customs_audit_reviewed', 'Awa est prévenue');

RESET ROLE;

-- ── Les droits d'exécution : ni anon, ni PUBLIC.
SELECT _assert(NOT has_function_privilege('anon', 'public.customs_audit_claim(uuid)', 'EXECUTE'), 'anon ne prend pas d''audit');
SELECT _assert(NOT has_function_privilege('anon', 'public.customs_audit_cancel(uuid)', 'EXECUTE'), 'anon n''abandonne rien');
SELECT _assert(obj_description('public.customs_audit_claim(uuid)'::regprocedure, 'pg_proc') LIKE '@mola:%', 'étiquette @mola sur claim');
SELECT _assert(obj_description('public.customs_audit_cancel(uuid)'::regprocedure, 'pg_proc') LIKE '@mola:%', 'étiquette @mola sur cancel');

\echo '✓ customs_audit_workflow : toutes les règles tiennent'
