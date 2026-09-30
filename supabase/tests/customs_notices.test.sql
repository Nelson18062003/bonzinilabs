-- ============================================================================
-- Douane, étape 6 — la veille (20260930090000_customs_notices.sql) :
-- qui lit quoi, qui publie, qui est prévenu, et une seule fois.
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
  ('00000000-0000-0000-0000-00000000000d', 'support@bonzini');
INSERT INTO public.clients (user_id, first_name, last_name, company_name, customer_code) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'Awa', 'Ngo', 'Awa Import', 'BZ-AWA1'),
  ('00000000-0000-0000-0000-00000000000b', 'Jean', 'Kamga', NULL, 'BZ-JEA2');
INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-00000000000c', 'ops'),
  ('00000000-0000-0000-0000-00000000000d', 'support');
-- Awa a classé un régulateur (8504.40) ; Jean, des chaises (9401.80).
INSERT INTO public.customs_classifications (client_user_id, product_name, proposed_code, status) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'Régulateur 5 kVA', '850440', 'draft'),
  ('00000000-0000-0000-0000-00000000000a', 'Régulateur 10 kVA', '850440', 'submitted'),
  ('00000000-0000-0000-0000-00000000000b', 'Chaises', '940180', 'draft');

-- ── Les avis de départ, une fois (la migration a été jouée deux fois).
SELECT _assert((SELECT count(*) FROM public.customs_notices) = 8, 'huit avis de départ, sans doublon');
SELECT _assert((SELECT bool_and(published) FROM public.customs_notices), 'tous publiés');
SELECT _assert((SELECT count(*) FROM public.customs_notices WHERE source_url IS NOT NULL OR source_label IS NOT NULL OR confidence = 'a_verifier')
               = 8, 'chaque avis dit sa source, ou qu''il est à vérifier');
SELECT _assert((SELECT count(*) FROM public.customs_notices WHERE kind = 'disruption') = 2, 'deux perturbations de calendrier, aucune inventée');

-- ── Publier : l'équipe douane seulement.
SET ROLE authenticated;
SELECT _as('00000000-0000-0000-0000-00000000000a');
SELECT _assert((customs_notice_upsert('{"slug":"pirate","kind":"regulation","title":"Faux","summary":"Faux avis","published":true}') ->> 'success')::boolean = false, 'un client ne publie pas');
SELECT _as('00000000-0000-0000-0000-00000000000d');
SELECT _assert((customs_notice_upsert('{"slug":"support-avis","kind":"regulation","title":"Avis","summary":"Avis du support"}') ->> 'success')::boolean = false, 'le support lit mais ne publie pas');

SELECT _as('00000000-0000-0000-0000-00000000000c');
SELECT _assert((customs_notice_upsert('{"slug":"Mauvais Slug","kind":"regulation","title":"Avis","summary":"Résumé"}') ->> 'success')::boolean = false, 'identifiant invalide refusé');
SELECT _assert((customs_notice_upsert('{"slug":"type-inconnu","kind":"rumeur","title":"Avis","summary":"Résumé"}') ->> 'success')::boolean = false, 'type inconnu refusé');
SELECT _assert((customs_notice_upsert('{"slug":"dates-inversees","kind":"disruption","title":"Grève","summary":"Grève au port","starts_on":"2026-10-10","ends_on":"2026-10-01"}') ->> 'success')::boolean = false, 'dates inversées refusées');
SELECT _assert((customs_notice_upsert('{"slug":"lieu-faux","kind":"disruption","title":"Grève","summary":"Grève au port","places":["douala"]}') ->> 'success')::boolean = false, 'un lieu hors UN/LOCODE est refusé');
SELECT _assert((customs_notice_upsert('{"slug":"greve-port-douala","kind":"disruption","title":"Grève","summary":"Grève au port","places":["cmdla"],"delay_days":4}') ->> 'success')::boolean, 'un UN/LOCODE en minuscules est accepté');
SELECT _assert((SELECT places FROM customs_notices WHERE slug = 'greve-port-douala') = ARRAY['CMDLA'], 'et mis en majuscules');
SELECT _assert((customs_notice_upsert('{"slug":"source-http","kind":"regulation","title":"Avis","summary":"Résumé","source_url":"http://exemple.cm"}') ->> 'success')::boolean = false, 'une source non https est refusée');
SELECT _assert((customs_notice_upsert('{"slug":"statut-faux","kind":"regulation","title":"Avis","summary":"Résumé","status":"rumeur"}') ->> 'success')::boolean = false, 'statut inconnu refusé');

-- Un brouillon : visible de l'équipe, invisible des clients et du public.
SELECT _assert((customs_notice_upsert('{"slug":"accises-8504","kind":"regulation","title":"Accises sur les convertisseurs","summary":"Test","hs_specs":["8504.40"],"confidence":"a_verifier"}') ->> 'notified')::int = 0, 'un brouillon ne prévient personne');
SELECT _assert((SELECT hs_specs FROM customs_notices WHERE slug = 'accises-8504') = ARRAY['850440'], 'les codes sont réduits à leurs chiffres');
SELECT _assert((SELECT count(*) FROM customs_notices WHERE NOT published) >= 1, 'l''équipe voit les brouillons');
SELECT _as('00000000-0000-0000-0000-00000000000a');
SELECT _assert((SELECT count(*) FROM customs_notices WHERE slug = 'accises-8504') = 0, 'un client ne voit pas le brouillon');
RESET ROLE;
SET ROLE anon;
SELECT _assert((SELECT count(*) FROM public.customs_notices WHERE slug = 'accises-8504') = 0, 'le public ne voit pas le brouillon');
SELECT _assert((SELECT count(*) FROM public.customs_notices) >= 8, 'le public voit les avis publiés');
RESET ROLE;

-- La publication : Awa (deux fiches visées) est prévenue une fois ; Jean, pas du tout.
SET ROLE authenticated;
SELECT _as('00000000-0000-0000-0000-00000000000c');
SELECT _assert((customs_notice_upsert('{"slug":"accises-8504","kind":"regulation","title":"Accises sur les convertisseurs","summary":"Test","hs_specs":["850440"],"confidence":"a_verifier","published":true}') ->> 'notified')::int = 1, 'une cliente visée, prévenue une fois');
SELECT _assert((customs_notice_upsert('{"slug":"accises-8504","kind":"regulation","title":"Accises sur les convertisseurs (corrigé)","summary":"Test","hs_specs":["850440"],"confidence":"a_verifier","published":true}') ->> 'notified')::int = 0, 'une correction ne renvoie pas de notification');
RESET ROLE;
SELECT _assert((SELECT count(*) FROM public.notifications WHERE type = 'customs_notice' AND user_id = '00000000-0000-0000-0000-00000000000a') = 1, 'Awa : une notification');
SELECT _assert((SELECT count(*) FROM public.notifications WHERE type = 'customs_notice' AND user_id = '00000000-0000-0000-0000-00000000000b') = 0, 'Jean : aucune');
SELECT _assert((SELECT metadata ->> 'slug' FROM public.notifications WHERE type = 'customs_notice' LIMIT 1) = 'accises-8504', 'la notification mène à l''avis');

-- Retirer : le public ne le voit plus.
SET ROLE authenticated;
SELECT _as('00000000-0000-0000-0000-00000000000d');
SELECT _assert((customs_notice_archive((SELECT id FROM customs_notices WHERE slug = 'accises-8504')) ->> 'success')::boolean = false, 'le support ne retire pas');
SELECT _as('00000000-0000-0000-0000-00000000000c');
SELECT _assert((customs_notice_archive((SELECT id FROM customs_notices WHERE slug = 'accises-8504')) ->> 'success')::boolean, 'les opérations retirent');
RESET ROLE;
SET ROLE anon;
SELECT _assert((SELECT count(*) FROM public.customs_notices WHERE slug = 'accises-8504') = 0, 'retiré : invisible du public');
RESET ROLE;

-- ── Pas d'écriture directe, pas d'exécution anonyme, étiquettes Mola.
SET ROLE authenticated;
SELECT _as('00000000-0000-0000-0000-00000000000c');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.customs_notices (slug, kind, title, summary) VALUES ('direct', 'regulation', 'Direct', 'Direct');
    RAISE EXCEPTION 'ÉCHEC : écriture directe acceptée';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SELECT _assert(NOT has_function_privilege('anon', 'public.customs_notice_upsert(jsonb)', 'EXECUTE'), 'anon ne publie pas');
SELECT _assert(NOT has_function_privilege('anon', 'public.customs_notice_archive(uuid)', 'EXECUTE'), 'anon ne retire pas');
SELECT _assert(obj_description('public.customs_notice_upsert(jsonb)'::regprocedure, 'pg_proc') LIKE '@mola:%', 'étiquette @mola (upsert)');
SELECT _assert(obj_description('public.customs_notice_archive(uuid)'::regprocedure, 'pg_proc') LIKE '@mola:%', 'étiquette @mola (archive)');

\echo '✓ customs_notices : toutes les règles tiennent'
