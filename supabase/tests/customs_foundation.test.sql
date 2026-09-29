-- ============================================================================
-- Douane — le socle (20260929120000_customs_foundation.sql), rejoué :
-- qui peut quoi, sur quelle ligne, depuis quel statut.
-- Lancé par supabase/tests/run.sh, après stub_supabase.sql et la migration
-- (appliquée deux fois : elle doit être idempotente).
-- ============================================================================
\set ON_ERROR_STOP on
SET client_min_messages = warning;

CREATE OR REPLACE FUNCTION public._assert(cond BOOLEAN, msg TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF cond IS NOT TRUE THEN RAISE EXCEPTION 'ÉCHEC : %', msg; END IF; END $$;
GRANT EXECUTE ON FUNCTION public._assert(BOOLEAN, TEXT) TO anon, authenticated, service_role;

-- Jouer le rôle de quelqu'un : authenticated + le sub du JWT.
CREATE OR REPLACE FUNCTION public._as(p_uid UUID) RETURNS VOID LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_uid)::text, false);
$$;
GRANT EXECUTE ON FUNCTION public._as(UUID) TO anon, authenticated, service_role;

-- ── Les personnes ──────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'awa@client.cm'),
  ('00000000-0000-0000-0000-00000000000b', 'jean@client.cm'),
  ('00000000-0000-0000-0000-00000000000c', 'ops@bonzini'),
  ('00000000-0000-0000-0000-00000000000d', 'support@bonzini'),
  ('00000000-0000-0000-0000-00000000000e', 'cad@citra.cm'),
  ('00000000-0000-0000-0000-00000000000f', 'cad-sans-agrement@citra.cm'),
  ('00000000-0000-0000-0000-000000000010', 'fondateur@bonzini'),
  ('00000000-0000-0000-0000-000000000011', 'cash@bonzini');
INSERT INTO public.clients (user_id, first_name, last_name, company_name, customer_code) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'Awa', 'Ngo', 'Awa Import', 'BZ-AWA1'),
  ('00000000-0000-0000-0000-00000000000b', 'Jean', 'Kamga', NULL, 'BZ-JEA2');
INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-00000000000c', 'ops'),
  ('00000000-0000-0000-0000-00000000000d', 'support'),
  ('00000000-0000-0000-0000-00000000000e', 'customs_broker'),
  ('00000000-0000-0000-0000-00000000000f', 'customs_broker'),
  ('00000000-0000-0000-0000-000000000010', 'super_admin'),
  ('00000000-0000-0000-0000-000000000011', 'cash_agent');

-- ── 1. La matrice ──────────────────────────────────────────────────────────
SELECT _assert(admin_has_permission('00000000-0000-0000-0000-00000000000e', 'canSignCustoms'), 'le CAD signe');
SELECT _assert(NOT admin_has_permission('00000000-0000-0000-0000-000000000010', 'canSignCustoms'), 'le super admin ne signe pas');
SELECT _assert(NOT admin_has_permission('00000000-0000-0000-0000-00000000000c', 'canSignCustoms'), 'les opérations ne signent pas');
SELECT _assert(admin_has_permission('00000000-0000-0000-0000-00000000000d', 'canViewCustoms'), 'le support voit la douane');
SELECT _assert(NOT admin_has_permission('00000000-0000-0000-0000-000000000011', 'canViewCustoms'), 'l''agent cash ne voit pas la douane');
SELECT _assert(admin_has_permission('00000000-0000-0000-0000-000000000010', 'canViewClients'), 'les anciennes permissions sont intactes');

-- ── 2. L'agrément ──────────────────────────────────────────────────────────
SET ROLE authenticated;
SELECT _as('00000000-0000-0000-0000-00000000000c');
SELECT _assert((customs_broker_register('00000000-0000-0000-0000-00000000000e', 'CITRA SARL', 'CAD-0451') ->> 'success')::boolean = false, 'les opérations n''enregistrent pas un CAD');
SELECT _as('00000000-0000-0000-0000-000000000010');
SELECT _assert((customs_broker_register('00000000-0000-0000-0000-00000000000b', 'X', 'Y12') ->> 'success')::boolean = false, 'un client n''est pas un CAD');
SELECT _assert((customs_broker_register('00000000-0000-0000-0000-00000000000e', 'CITRA SARL', 'CAD-0451') ->> 'success')::boolean, 'le fondateur enregistre le CAD');

-- ── 3. La fiche : création, isolement ──────────────────────────────────────
SELECT _as('00000000-0000-0000-0000-00000000000a');
SELECT _assert((customs_classification_create('Régulateur', NULL, '{}', ARRAY['00000000-0000-0000-0000-00000000000b/x.jpg']) ->> 'success')::boolean = false,
               'une photo hors du dossier du client est refusée');
SELECT _assert((customs_classification_create('R') ->> 'success')::boolean = false, 'nom trop court refusé');
SELECT _assert((customs_classification_create('Stabilisateur de tension 5 kVA', 'Régulateur de tension pour la maison, 30 kg', '{"usage":"domestique"}',
                ARRAY['00000000-0000-0000-0000-00000000000a/photo1.jpg']) ->> 'ref') = 'CL-000001', 'Awa ouvre CL-000001');
SELECT _assert((SELECT count(*) FROM customs_classification_messages) = 1, 'la description devient le premier message');
SELECT _assert((customs_classification_create('Chaises', NULL, '{}', '{}', '00000000-0000-0000-0000-00000000000b') ->> 'success')::boolean = false,
               'un client n''ouvre pas de fiche pour un autre');

SELECT _as('00000000-0000-0000-0000-00000000000b');
SELECT _assert((SELECT count(*) FROM customs_classifications) = 0, 'Jean ne voit pas la fiche d''Awa');
SELECT _assert((SELECT count(*) FROM customs_classification_messages) = 0, 'ni ses messages');
SELECT _assert((customs_classification_get((SELECT id FROM public.customs_classifications LIMIT 1)) ->> 'success') IS NOT NULL, 'get répond');
SELECT _as('00000000-0000-0000-0000-000000000011');
SELECT _assert((SELECT count(*) FROM customs_classifications) = 0, 'l''agent cash ne voit rien');
SELECT _as('00000000-0000-0000-0000-00000000000d');
SELECT _assert((SELECT count(*) FROM customs_classifications) = 1, 'le support voit la fiche');

-- Contourner les RPC : impossible.
SELECT _as('00000000-0000-0000-0000-00000000000a');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.customs_classifications (client_user_id, product_name, status, final_code, reviewed_by, reviewed_at, broker_license_no)
    VALUES ('00000000-0000-0000-0000-00000000000a', 'Faux', 'approved', '850440', '00000000-0000-0000-0000-00000000000a', now(), 'X');
    RAISE EXCEPTION 'ÉCHEC : un client a écrit directement dans la table';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
UPDATE public.customs_classifications SET status = 'approved', final_code = '850440';
SELECT _assert((SELECT status FROM public.customs_classifications WHERE ref = 'CL-000001') = 'draft', 'un UPDATE direct ne change rien');

-- ── 4. Le cycle : répondre, soumettre, prendre, signer ─────────────────────
SELECT _assert((customs_classification_post((SELECT id FROM customs_classifications WHERE ref = 'CL-000001'), 'C''est un stabilisateur à servomoteur', '{"type":"servo"}') ->> 'success')::boolean, 'Awa répond');
SELECT _assert((SELECT facts ->> 'type' FROM customs_classifications WHERE ref = 'CL-000001') = 'servo', 'les faits s''accumulent');
SELECT _assert((customs_classification_submit((SELECT id FROM customs_classifications WHERE ref = 'CL-000001')) ->> 'status') = 'submitted', 'Awa soumet');
SELECT _assert((customs_classification_post((SELECT id FROM customs_classifications WHERE ref = 'CL-000001'), 'encore') ->> 'success')::boolean = false, 'plus de message pendant la revue');
RESET ROLE;
SELECT _assert((SELECT count(*) FROM public._staff_push_log WHERE permission = 'canSignCustoms') = 1, 'les CAD sont prévenus');
SET ROLE authenticated;

-- Personne d'autre qu'un CAD enregistré ne signe.
SELECT _as('00000000-0000-0000-0000-000000000010');
SELECT _assert((customs_classification_decide((SELECT id FROM customs_classifications WHERE ref = 'CL-000001'), 'approved', '850440') ->> 'success')::boolean = false, 'le super admin ne signe pas');
SELECT _as('00000000-0000-0000-0000-00000000000c');
SELECT _assert((customs_classification_claim((SELECT id FROM customs_classifications WHERE ref = 'CL-000001')) ->> 'success')::boolean = false, 'les opérations ne prennent pas de fiche');
SELECT _as('00000000-0000-0000-0000-00000000000f');
SELECT _assert((customs_classification_decide((SELECT id FROM customs_classifications WHERE ref = 'CL-000001'), 'approved', '850440') ->> 'success')::boolean = false, 'un CAD sans agrément enregistré ne signe pas');

SELECT _as('00000000-0000-0000-0000-00000000000e');
SELECT _assert((customs_classification_claim((SELECT id FROM customs_classifications WHERE ref = 'CL-000001')) ->> 'status') = 'in_review', 'le CAD prend la fiche');
SELECT _assert((customs_classification_decide((SELECT id FROM customs_classifications WHERE ref = 'CL-000001'), 'approved') ->> 'success')::boolean = false, 'valider sans code proposé ni saisi : refusé');
SELECT _assert((customs_classification_decide((SELECT id FROM customs_classifications WHERE ref = 'CL-000001'), 'changed', '850440') ->> 'success')::boolean = false, 'changer sans dire pourquoi : refusé');
SELECT _assert((customs_classification_decide((SELECT id FROM customs_classifications WHERE ref = 'CL-000001'), 'approved', '84182') ->> 'success')::boolean = false, 'code de 5 chiffres refusé');
RESET ROLE;
-- L'IA a proposé 8504.40 (écrit par l'edge function, clé de service).
UPDATE public.customs_classifications SET proposed_code = '850440' WHERE ref = 'CL-000001';
SET ROLE authenticated;
SELECT _as('00000000-0000-0000-0000-00000000000e');
SELECT _assert((customs_classification_decide((SELECT id FROM customs_classifications WHERE ref = 'CL-000001'), 'approved', NULL, 'Stabilisateur à servomoteur : 85.04, pas 84.18.') ->> 'final_code') = '850440', 'le CAD valide 8504.40');
SELECT _assert((SELECT broker_license_no FROM customs_classifications WHERE ref = 'CL-000001') = 'CAD-0451', 'l''agrément est figé sur la fiche');
SELECT _assert((customs_classification_decide((SELECT id FROM customs_classifications WHERE ref = 'CL-000001'), 'changed', '841821', 'x') ->> 'success')::boolean = false, 'une fiche signée ne se re-signe pas');

SELECT _as('00000000-0000-0000-0000-00000000000a');
SELECT _assert((customs_classification_cancel((SELECT id FROM customs_classifications WHERE ref = 'CL-000001')) ->> 'success')::boolean = false, 'une fiche signée ne s''annule pas');
SELECT _assert((customs_classification_get((SELECT id FROM customs_classifications WHERE ref = 'CL-000001')) -> 'classification' ->> 'status') = 'approved', 'Awa lit sa fiche signée');
SELECT _assert(jsonb_array_length(customs_classification_get((SELECT id FROM customs_classifications WHERE ref = 'CL-000001')) -> 'classification' -> 'messages') = 4,
               'la conversation : description, réponse, envoi, décision');
RESET ROLE;
SELECT _assert((SELECT count(*) FROM public.notifications WHERE user_id = '00000000-0000-0000-0000-00000000000a' AND metadata ->> 'kind' = 'customs' AND type = 'customs_classification_signed') = 1,
               'Awa est prévenue de la signature');

-- Le CHECK tient même pour la clé de service : pas de « signé » sans signataire.
DO $$ BEGIN
  BEGIN
    UPDATE public.customs_classifications SET status = 'approved', final_code = NULL WHERE ref = 'CL-000001';
    RAISE EXCEPTION 'ÉCHEC : une fiche signée sans code';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- ── 5. La question du CAD, et le retour du client ──────────────────────────
SET ROLE authenticated;
SELECT _as('00000000-0000-0000-0000-00000000000a');
SELECT customs_classification_create('Chaises de salle à manger');
SELECT _assert((customs_classification_submit((SELECT id FROM customs_classifications WHERE product_name = 'Chaises de salle à manger')) ->> 'success')::boolean, 'Awa soumet la fiche des chaises');
SELECT _as('00000000-0000-0000-0000-00000000000e');
SELECT _assert((customs_classification_decide((SELECT id FROM customs_classifications WHERE product_name = 'Chaises de salle à manger'), 'needs_info') ->> 'success')::boolean = false, 'une question vide est refusée');
SELECT _assert((customs_classification_decide((SELECT id FROM customs_classifications WHERE product_name = 'Chaises de salle à manger'), 'needs_info', NULL, 'En quelle matière ? Rembourrées ?') ->> 'status') = 'needs_info', 'le CAD demande la matière');
SELECT _as('00000000-0000-0000-0000-00000000000a');
SELECT _assert((customs_classification_post((SELECT id FROM customs_classifications WHERE product_name = 'Chaises de salle à manger'), 'Plastique, non rembourrées') ->> 'success')::boolean, 'Awa répond au CAD');
SELECT _assert((customs_classification_submit((SELECT id FROM customs_classifications WHERE product_name = 'Chaises de salle à manger')) ->> 'success')::boolean, 'et renvoie');
SELECT _as('00000000-0000-0000-0000-00000000000e');
SELECT _assert((customs_classification_decide((SELECT id FROM customs_classifications WHERE product_name = 'Chaises de salle à manger'), 'changed', '9401.80', 'Un siège relève du 94.01, jamais du 94.03.') ->> 'final_code') = '940180', 'le CAD signe 9401.80 (les points sont retirés)');
SELECT _assert((customs_review_queue() -> 'recent' -> 0 ->> 'final_code') IN ('940180','850440'), 'la file garde l''historique');
SELECT _assert((customs_review_queue() ->> 'is_broker')::boolean, 'la file sait que c''est un CAD (même sans n° de représentant)');

-- ── 6. Les audits ──────────────────────────────────────────────────────────
SELECT _as('00000000-0000-0000-0000-00000000000a');
SELECT _assert((customs_audit_create(ARRAY['00000000-0000-0000-0000-00000000000b/dau.pdf']) ->> 'success')::boolean = false, 'DAU hors dossier refusée');
SELECT _assert((customs_audit_create('{}') ->> 'success')::boolean = false, 'au moins une pièce');
SELECT _assert((customs_audit_create(ARRAY['00000000-0000-0000-0000-00000000000a/dau.pdf'], 'SDSD2-2026-IMP-020399-I', (current_date + 1)) ->> 'success')::boolean = false, 'paiement dans le futur refusé');
SELECT _assert((customs_audit_create(ARRAY['00000000-0000-0000-0000-00000000000a/dau.pdf'], 'SDSD2-2026-IMP-020399-I', DATE '2026-09-17') ->> 'ref') = 'AU-000001', 'Awa dépose AU-000001');
SELECT _assert((SELECT claim_deadline FROM customs_audits WHERE ref = 'AU-000001') = DATE '2029-09-17', 'délai de réclamation : 3 ans (art. 396)');
SELECT _assert((customs_audit_save_findings((SELECT id FROM customs_audits WHERE ref = 'AU-000001'), '[]', -1) ->> 'success')::boolean = false, 'montant négatif refusé');
SELECT _assert((customs_audit_save_findings((SELECT id FROM customs_audits WHERE ref = 'AU-000001'), '[{"kind":"misclassified","article":9,"amount_xaf":35779}]', 12043834, 307078) ->> 'success')::boolean, 'les constats sont enregistrés');
SELECT _assert((customs_audit_submit((SELECT id FROM customs_audits WHERE ref = 'AU-000001')) ->> 'status') = 'submitted', 'Awa envoie l''audit');
SELECT _assert((customs_audit_save_findings((SELECT id FROM customs_audits WHERE ref = 'AU-000001'), '[]') ->> 'success')::boolean = false, 'plus de retouche après envoi');
SELECT _as('00000000-0000-0000-0000-00000000000b');
SELECT _assert((SELECT count(*) FROM customs_audits) = 0, 'Jean ne voit pas l''audit d''Awa');
SELECT _assert((customs_audit_get((SELECT id FROM public.customs_audits LIMIT 1)) ->> 'success') IS NOT NULL, 'get répond');
SELECT _as('00000000-0000-0000-0000-00000000000c');
SELECT _assert((customs_audit_review((SELECT id FROM customs_audits WHERE ref = 'AU-000001'), 'ok', 1) ->> 'success')::boolean = false, 'les opérations ne rendent pas l''avis');
SELECT _assert(jsonb_array_length(customs_review_queue() -> 'audits') = 1, 'l''audit est dans la file');
SELECT _as('00000000-0000-0000-0000-00000000000e');
SELECT _assert((customs_audit_review((SELECT id FROM customs_audits WHERE ref = 'AU-000001'), NULL) ->> 'success')::boolean = false, 'un avis vide est refusé');
SELECT _assert((customs_audit_review((SELECT id FROM customs_audits WHERE ref = 'AU-000001'), 'Articles 5, 8, 9, 10 : récupérables sur les prochains conteneurs ; mainlevée à vérifier.', 307078) ->> 'status') = 'reviewed', 'le CAD rend son avis');
SELECT _assert((customs_audit_review((SELECT id FROM customs_audits WHERE ref = 'AU-000001'), 'encore', 1) ->> 'success')::boolean = false, 'un avis rendu ne se refait pas');

-- ── 7. Les pièces dans le stockage ─────────────────────────────────────────
SELECT _as('00000000-0000-0000-0000-00000000000a');
INSERT INTO storage.objects (bucket_id, name) VALUES ('customs-documents', '00000000-0000-0000-0000-00000000000a/dau.pdf');
DO $$ BEGIN
  BEGIN
    INSERT INTO storage.objects (bucket_id, name) VALUES ('customs-documents', '00000000-0000-0000-0000-00000000000b/pirate.pdf');
    RAISE EXCEPTION 'ÉCHEC : Awa a écrit dans le dossier de Jean';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SELECT _assert((SELECT count(*) FROM storage.objects WHERE bucket_id = 'customs-documents') = 1, 'Awa voit sa DAU');
SELECT _as('00000000-0000-0000-0000-00000000000b');
SELECT _assert((SELECT count(*) FROM storage.objects WHERE bucket_id = 'customs-documents') = 0, 'Jean ne la voit pas');
SELECT _as('00000000-0000-0000-0000-00000000000d');
SELECT _assert((SELECT count(*) FROM storage.objects WHERE bucket_id = 'customs-documents') = 1, 'le support la voit');

-- ── 8. Anonyme : rien ──────────────────────────────────────────────────────
RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claims', '{}', false);
DO $$ BEGIN
  BEGIN
    PERFORM public.customs_classification_create('Test');
    RAISE EXCEPTION 'ÉCHEC : un anonyme a ouvert une fiche';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SELECT _assert((SELECT count(*) FROM public.customs_classifications) = 0, 'un anonyme ne lit rien');
RESET ROLE;

-- Les helpers internes ne sont pas appelables depuis l'app.
SET ROLE authenticated;
SELECT _as('00000000-0000-0000-0000-00000000000a');
DO $$ BEGIN
  BEGIN
    PERFORM public.customs_notify_client('00000000-0000-0000-0000-00000000000b', 'x', 'spam', 'spam');
    RAISE EXCEPTION 'ÉCHEC : un client a appelé un helper interne';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

\echo '✓ customs_foundation : toutes les règles tiennent'
