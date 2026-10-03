-- ============================================================================
-- Douane, étape 7 — les invitations fournisseur
-- (20260930120000_customs_supplier_invites.sql) : un lien sans compte, qui
-- n'ouvre que ce qu'il doit, et que seule l'edge function écrit.
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
CREATE TABLE IF NOT EXISTS public._tok (name TEXT PRIMARY KEY, token TEXT);
GRANT ALL ON public._tok TO anon, authenticated, service_role;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'awa@client.cm'),
  ('00000000-0000-0000-0000-00000000000b', 'jean@client.cm'),
  ('00000000-0000-0000-0000-00000000000c', 'ops@bonzini');
INSERT INTO public.clients (user_id, first_name, last_name, company_name, customer_code) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'Awa', 'Ngo', 'Awa Import', 'BZ-AWA1'),
  ('00000000-0000-0000-0000-00000000000b', 'Jean', 'Kamga', NULL, 'BZ-JEA2');
INSERT INTO public.user_roles (user_id, role) VALUES ('00000000-0000-0000-0000-00000000000c', 'ops');
INSERT INTO public.customs_classifications (id, client_user_id, product_name, status)
  VALUES ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'Régulateur 5 kVA', 'draft');

SET ROLE authenticated;
-- ── Inviter : un client, pour ses propres fiches, avec des documents connus.
SELECT _as('00000000-0000-0000-0000-00000000000c');
SELECT _assert((customs_invite_create('Shenzhen Power', ARRAY['final_invoice']) ->> 'success')::boolean = false, 'l''équipe n''invite pas au nom d''un client');
SELECT _as('00000000-0000-0000-0000-00000000000b');
SELECT _assert((customs_invite_create('Shenzhen Power', ARRAY['final_invoice'], NULL, 'zh', NULL, NULL, '00000000-0000-0000-0000-0000000000f1') ->> 'success')::boolean = false,
               'Jean ne rattache pas une fiche d''Awa');
SELECT _as('00000000-0000-0000-0000-00000000000a');
SELECT _assert((customs_invite_create('Shenzhen Power', '{}') ->> 'success')::boolean = false, 'au moins un document demandé');
SELECT _assert((customs_invite_create('Shenzhen Power', ARRAY['passeport']) ->> 'success')::boolean = false, 'un document inconnu est refusé');
SELECT _assert((customs_invite_create('Shenzhen Power', ARRAY['final_invoice'], NULL, 'de') ->> 'success')::boolean = false, 'langue inconnue refusée');
SELECT _assert((customs_invite_create('Shenzhen Power', ARRAY['final_invoice'], NULL, 'zh', NULL, current_date - 1) ->> 'success')::boolean = false, 'échéance passée refusée');

INSERT INTO public._tok SELECT 'awa', customs_invite_create('Shenzhen Power Co.', ARRAY['final_invoice','packing_list','final_invoice'], 'WeChat: szpower', 'zh',
  'Merci de déposer la facture définitive de la commande PO-118.', current_date + 7, '00000000-0000-0000-0000-0000000000f1') ->> 'token';
SELECT _assert((SELECT token FROM public._tok WHERE name = 'awa') ~ '^[0-9a-f]{64}$', 'un jeton de 64 caractères hexadécimaux');
RESET ROLE;
SELECT _assert((SELECT token_hash FROM customs_supplier_invites) <> (SELECT token FROM _tok WHERE name = 'awa'), 'le jeton n''est pas gardé en clair');
SELECT _assert((SELECT requested FROM customs_supplier_invites) = ARRAY['final_invoice','packing_list'], 'les documents demandés, sans doublon');

-- ── La page du fournisseur : ce qu'il doit savoir, rien de plus.
SET ROLE anon;
SELECT _assert((customs_invite_public((SELECT token FROM public._tok WHERE name = 'awa')) -> 'invite' ->> 'importer') = 'Awa Import', 'le fournisseur voit le nom de l''importateur');
SELECT _assert(NOT (customs_invite_public((SELECT token FROM public._tok WHERE name = 'awa')) -> 'invite' ?| ARRAY['client_user_id','id','token_hash','supplier_contact']),
               'ni identifiant, ni haché, ni contact');
SELECT _assert((customs_invite_public(repeat('a', 64)) ->> 'success')::boolean = false, 'un faux jeton ne mène à rien');
SELECT _assert((customs_invite_public('x'' OR 1=1 --') ->> 'success')::boolean = false, 'une chaîne quelconque non plus');
RESET ROLE;
SELECT _assert(NOT has_function_privilege('anon', 'public.customs_invite_upload_target(text, text, text, integer)', 'EXECUTE'), 'anon ne contrôle pas un dépôt');
SELECT _assert(NOT has_function_privilege('authenticated', 'public.customs_invite_record_document(text, text, text, text, text, integer, text)', 'EXECUTE'), 'un compte connecté n''inscrit pas un dépôt');
SELECT _assert(NOT has_function_privilege('anon', 'public.customs_invite_hash(text)', 'EXECUTE') AND NOT has_function_privilege('authenticated', 'public.customs_invite_by_token(text)', 'EXECUTE'), 'les aides internes restent internes');

-- ── Le dépôt, par l'edge function (clé de service).
SET ROLE service_role;
SELECT _assert((customs_invite_upload_target((SELECT token FROM public._tok WHERE name = 'awa'), 'final_invoice', 'application/pdf', 120000) ->> 'folder') = '00000000-0000-0000-0000-00000000000a', 'le dépôt va dans le dossier d''Awa');
SELECT _assert((customs_invite_upload_target((SELECT token FROM public._tok WHERE name = 'awa'), 'photos', 'image/jpeg', 1000) ->> 'error') = 'kind_not_requested', 'un document non demandé est refusé');
SELECT _assert((customs_invite_upload_target((SELECT token FROM public._tok WHERE name = 'awa'), 'other', 'image/jpeg', 1000) ->> 'success')::boolean, '« autre » est toujours permis');
SELECT _assert((customs_invite_upload_target((SELECT token FROM public._tok WHERE name = 'awa'), 'final_invoice', 'application/zip', 1000) ->> 'error') = 'file_type', 'type de fichier refusé');
SELECT _assert((customs_invite_upload_target((SELECT token FROM public._tok WHERE name = 'awa'), 'final_invoice', 'application/pdf', 11000000) ->> 'error') = 'file_size', 'plus de 10 Mo refusé');
SELECT _assert((customs_invite_record_document((SELECT token FROM public._tok WHERE name = 'awa'), 'final_invoice',
  '00000000-0000-0000-0000-00000000000b/supplier-11111111-1111-1111-1111-111111111111.pdf', 'facture.pdf', 'application/pdf', 120000) ->> 'error') = 'bad_path',
  'un fichier hors du dossier d''Awa n''est pas inscrit');
SELECT _assert((customs_invite_record_document((SELECT token FROM public._tok WHERE name = 'awa'), 'final_invoice',
  '00000000-0000-0000-0000-00000000000a/../supplier-11111111-1111-1111-1111-111111111111.pdf', 'facture.pdf', 'application/pdf', 120000) ->> 'error') = 'bad_path',
  'pas de remontée de dossier');
SELECT _assert((customs_invite_record_document((SELECT token FROM public._tok WHERE name = 'awa'), 'final_invoice',
  '00000000-0000-0000-0000-00000000000a/supplier-11111111-1111-1111-1111-111111111111.pdf', 'Commercial invoice PO-118.pdf', 'application/pdf', 120000, 'Final') ->> 'success')::boolean,
  'la facture définitive est inscrite');
RESET ROLE;
SELECT _assert((SELECT count(*) FROM public.notifications WHERE user_id = '00000000-0000-0000-0000-00000000000a' AND type = 'customs_supplier_document') = 1, 'Awa est prévenue');
SELECT _assert((SELECT title FROM public.notifications WHERE type = 'customs_supplier_document') = 'Document reçu de Shenzhen Power Co.', 'avec le nom du fournisseur');

-- ── Ce que chacun voit.
SET ROLE authenticated;
SELECT _as('00000000-0000-0000-0000-00000000000a');
SELECT _assert(jsonb_array_length(customs_my_invites() -> 'invites' -> 0 -> 'documents') = 1, 'Awa voit le document reçu');
SELECT _assert((SELECT count(*) FROM customs_supplier_documents) = 1, 'et peut le lire');
SELECT _as('00000000-0000-0000-0000-00000000000b');
SELECT _assert(jsonb_array_length(customs_my_invites() -> 'invites') = 0 AND (SELECT count(*) FROM customs_supplier_documents) = 0, 'Jean ne voit rien d''Awa');
SELECT _as('00000000-0000-0000-0000-00000000000c');
SELECT _assert(jsonb_array_length(customs_client_supplier_documents('00000000-0000-0000-0000-00000000000a') -> 'documents') = 1, 'l''équipe douane voit les documents d''Awa');
SELECT _as('00000000-0000-0000-0000-00000000000b');
SELECT _assert((customs_client_supplier_documents('00000000-0000-0000-0000-00000000000a') ->> 'success')::boolean = false, 'un client ne lit pas ceux d''un autre');

-- ── Un nouveau lien : l'ancien cesse de marcher, le nouveau ouvre la même invitation.
RESET ROLE;
INSERT INTO public._tok SELECT 'awa-id0', id::text FROM public.customs_supplier_invites WHERE supplier_name = 'Shenzhen Power Co.';
SET ROLE authenticated;
SELECT _as('00000000-0000-0000-0000-00000000000b');
SELECT _assert((customs_invite_rotate((SELECT token::uuid FROM public._tok WHERE name = 'awa-id0')) ->> 'success')::boolean = false, 'Jean ne renouvelle pas le lien d''Awa');
SELECT _as('00000000-0000-0000-0000-00000000000a');
INSERT INTO public._tok SELECT 'awa2', customs_invite_rotate((SELECT token::uuid FROM public._tok WHERE name = 'awa-id0')) ->> 'token';
RESET ROLE;
SET ROLE anon;
SELECT _assert((customs_invite_public((SELECT token FROM public._tok WHERE name = 'awa')) ->> 'success')::boolean = false, 'l''ancien lien ne marche plus');
SELECT _assert(jsonb_array_length(customs_invite_public((SELECT token FROM public._tok WHERE name = 'awa2')) -> 'invite' -> 'documents') = 1, 'le nouveau ouvre la même invitation, avec ses dépôts');
RESET ROLE;
UPDATE public._tok SET token = (SELECT token FROM public._tok WHERE name = 'awa2') WHERE name = 'awa';
SET ROLE authenticated;

-- ── Fermer le lien : Awa seule ; ensuite, plus rien ne passe.
RESET ROLE;
INSERT INTO public._tok SELECT 'awa-id', id::text FROM public.customs_supplier_invites WHERE supplier_name = 'Shenzhen Power Co.';
SET ROLE authenticated;
SELECT _as('00000000-0000-0000-0000-00000000000b');
SELECT _assert((customs_invite_revoke((SELECT token::uuid FROM public._tok WHERE name = 'awa-id')) ->> 'success')::boolean = false, 'Jean ne ferme pas le lien d''Awa, même avec son identifiant');
SELECT _as('00000000-0000-0000-0000-00000000000a');
SELECT _assert((customs_invite_revoke((SELECT token::uuid FROM public._tok WHERE name = 'awa-id')) ->> 'success')::boolean, 'Awa ferme le lien');
RESET ROLE;
SET ROLE anon;
SELECT _assert((customs_invite_public((SELECT token FROM public._tok WHERE name = 'awa')) ->> 'success')::boolean = false, 'lien fermé : la page ne s''ouvre plus');
RESET ROLE;
SET ROLE service_role;
SELECT _assert((customs_invite_upload_target((SELECT token FROM public._tok WHERE name = 'awa'), 'final_invoice', 'application/pdf', 1000) ->> 'success')::boolean = false, 'ni le dépôt');
RESET ROLE;

-- ── Un lien expire ; on le dit au client.
SET ROLE authenticated;
SELECT _as('00000000-0000-0000-0000-00000000000a');
INSERT INTO public._tok SELECT 'old', customs_invite_create('Yiwu Trading', ARRAY['photos']) ->> 'token';
RESET ROLE;
UPDATE public.customs_supplier_invites SET expires_at = now() - interval '1 minute' WHERE supplier_name = 'Yiwu Trading';
SET ROLE anon;
SELECT _assert((customs_invite_public((SELECT token FROM public._tok WHERE name = 'old')) ->> 'success')::boolean = false, 'un lien expiré ne s''ouvre plus');
RESET ROLE;
SET ROLE authenticated;
SELECT _as('00000000-0000-0000-0000-00000000000a');
SELECT _assert((SELECT x ->> 'status' FROM jsonb_array_elements(customs_my_invites() -> 'invites') x WHERE x ->> 'supplier_name' = 'Yiwu Trading') = 'expired', 'le client voit « expiré »');

-- ── Vingt liens par jour, pas plus.
DO $$ BEGIN
  FOR k IN 1..18 LOOP PERFORM public.customs_invite_create('Fournisseur ' || k, ARRAY['other']); END LOOP;
END $$;
SELECT _assert((customs_invite_create('Le vingt et unième', ARRAY['other']) ->> 'success')::boolean = false, 'le 21e lien du jour est refusé');
RESET ROLE;

SELECT _assert((SELECT bool_and(obj_description(p.oid, 'pg_proc') LIKE '@mola:%') FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND (p.proname LIKE 'customs_invite%' OR p.proname IN ('customs_my_invites','customs_client_supplier_documents'))),
               'chaque fonction porte son étiquette @mola');

\echo '✓ customs_supplier_invites : toutes les règles tiennent'
