-- ============================================================================
-- Dossier conteneur — le classeur (20261003140000_cargo_document_folders.sql) :
-- qui crée une pièce, ce qui ne bouge jamais, et rien ne passe d'un conteneur à l'autre.
-- ============================================================================
\set ON_ERROR_STOP on
SET client_min_messages = warning;

CREATE OR REPLACE FUNCTION public._assert(cond BOOLEAN, msg TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF cond IS NOT TRUE THEN RAISE EXCEPTION 'ÉCHEC : %', msg; END IF; END $$;
GRANT EXECUTE ON FUNCTION public._assert(BOOLEAN, TEXT) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public._as(uid UUID) RETURNS VOID LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', uid)::text, false)
$$;
GRANT EXECUTE ON FUNCTION public._as(UUID) TO anon, authenticated, service_role;

INSERT INTO auth.users (id) VALUES
  ('00000000-0000-0000-0000-0000000000a1'),  -- ops : gère
  ('00000000-0000-0000-0000-0000000000a2'),  -- support : lit
  ('00000000-0000-0000-0000-0000000000a3');  -- caissier : rien
INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'ops'),
  ('00000000-0000-0000-0000-0000000000a2', 'support'),
  ('00000000-0000-0000-0000-0000000000a3', 'cash_agent');
INSERT INTO public.cargo_shipments (id, container_number) VALUES
  ('00000000-0000-0000-0000-00000000000a', 'MIEU3611115'),
  ('00000000-0000-0000-0000-00000000000b', 'MRKU4617437');
INSERT INTO public.cargo_costs (id, shipment_id, label) VALUES
  ('00000000-0000-0000-0000-0000000000cb', '00000000-0000-0000-0000-00000000000b', 'fret B');

-- ── L'ops crée une pièce « B/L originaux » (3 attendus) et y range un fichier.
SET ROLE authenticated;
SELECT _as('00000000-0000-0000-0000-0000000000a1');
INSERT INTO public.cargo_doc_folders (id, shipment_id, title, category, expected_count)
  VALUES ('00000000-0000-0000-0000-0000000000fa', '00000000-0000-0000-0000-00000000000a', 'B/L originaux', 'BL', 3);
INSERT INTO public.cargo_documents (id, shipment_id, kind, file_name, storage_path, uploaded_by, folder_id)
  VALUES ('00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-00000000000a', 'BL', 'bl1.pdf', 'a/1-bl1.pdf',
          '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000fa');
-- Les nouvelles catégories passent.
INSERT INTO public.cargo_documents (shipment_id, kind, file_name, storage_path, uploaded_by)
  VALUES ('00000000-0000-0000-0000-00000000000a', 'CERTIFICATE', 'cicq.jpg', 'a/2-cicq.jpg', '00000000-0000-0000-0000-0000000000a1');

-- ── Renommer, annoter : oui. Changer de conteneur, de chemin ou d'auteur : rétabli en silence.
UPDATE public.cargo_documents
   SET title = 'B/L original 1/3', note = 'reçu de Kassumaye',
       shipment_id = '00000000-0000-0000-0000-00000000000b', storage_path = 'pirate', uploaded_by = '00000000-0000-0000-0000-0000000000a2'
 WHERE id = '00000000-0000-0000-0000-0000000000da';
DO $$ DECLARE d RECORD; BEGIN
  SELECT * INTO d FROM public.cargo_documents WHERE id = '00000000-0000-0000-0000-0000000000da';
  PERFORM _assert(d.title = 'B/L original 1/3' AND d.note = 'reçu de Kassumaye', 'titre et note modifiables');
  PERFORM _assert(d.shipment_id = '00000000-0000-0000-0000-00000000000a', 'le fichier reste dans son conteneur');
  PERFORM _assert(d.storage_path = 'a/1-bl1.pdf', 'le chemin de stockage ne bouge pas');
  PERFORM _assert(d.uploaded_by = '00000000-0000-0000-0000-0000000000a1', 'l''auteur ne bouge pas');
END $$;

-- ── Une pièce ou un coût d'un AUTRE conteneur est refusé.
DO $$ BEGIN
  INSERT INTO public.cargo_doc_folders (id, shipment_id, title) VALUES ('00000000-0000-0000-0000-0000000000fb', '00000000-0000-0000-0000-00000000000b', 'Pièce de B');
  BEGIN
    UPDATE public.cargo_documents SET folder_id = '00000000-0000-0000-0000-0000000000fb' WHERE id = '00000000-0000-0000-0000-0000000000da';
    PERFORM _assert(false, 'ranger un fichier dans la pièce d''un autre conteneur doit échouer');
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.cargo_documents SET cost_id = '00000000-0000-0000-0000-0000000000cb' WHERE id = '00000000-0000-0000-0000-0000000000da';
    PERFORM _assert(false, 'justifier le coût d''un autre conteneur doit échouer');
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- ── La pièce ne change ni de conteneur ni d'auteur.
UPDATE public.cargo_doc_folders SET title = 'B/L (3 originaux)', shipment_id = '00000000-0000-0000-0000-00000000000b', created_by = NULL
 WHERE id = '00000000-0000-0000-0000-0000000000fa';
DO $$ DECLARE f RECORD; BEGIN
  SELECT * INTO f FROM public.cargo_doc_folders WHERE id = '00000000-0000-0000-0000-0000000000fa';
  PERFORM _assert(f.title = 'B/L (3 originaux)', 'la pièce se renomme');
  PERFORM _assert(f.shipment_id = '00000000-0000-0000-0000-00000000000a' AND f.created_by = '00000000-0000-0000-0000-0000000000a1', 'dossier et auteur figés');
END $$;

-- ── Le support lit mais n'écrit pas ; le caissier ne voit rien.
SELECT _as('00000000-0000-0000-0000-0000000000a2');
DO $$ BEGIN
  PERFORM _assert((SELECT count(*) FROM public.cargo_doc_folders) = 2, 'le support voit les pièces');
  BEGIN
    INSERT INTO public.cargo_doc_folders (shipment_id, title) VALUES ('00000000-0000-0000-0000-00000000000a', 'intrus');
    PERFORM _assert(false, 'le support ne crée pas de pièce');
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.cargo_documents SET title = 'support' WHERE id = '00000000-0000-0000-0000-0000000000da';
  PERFORM _assert(NOT FOUND, 'le support ne renomme pas un fichier');
END $$;
SELECT _as('00000000-0000-0000-0000-0000000000a3');
DO $$ BEGIN
  PERFORM _assert((SELECT count(*) FROM public.cargo_doc_folders) = 0, 'le caissier ne voit aucune pièce');
  PERFORM _assert((SELECT count(*) FROM public.cargo_documents) = 0, 'le caissier ne voit aucun fichier');
END $$;

-- ── Supprimer la pièce laisse ses fichiers, « non classés ».
SELECT _as('00000000-0000-0000-0000-0000000000a1');
DELETE FROM public.cargo_doc_folders WHERE id = '00000000-0000-0000-0000-0000000000fa';
DO $$ BEGIN
  PERFORM _assert((SELECT folder_id FROM public.cargo_documents WHERE id = '00000000-0000-0000-0000-0000000000da') IS NULL, 'fichier conservé, non classé');
END $$;
RESET ROLE;

-- ============================================================================
-- Parties prenantes (20261003150000_cargo_parties.sql)
-- ============================================================================
SET ROLE authenticated;
SELECT _as('00000000-0000-0000-0000-0000000000a1');
INSERT INTO public.cargo_parties (id, name, contact_name) VALUES ('00000000-0000-0000-0000-0000000000e1', 'KASSUMAYE PARTNER SARL', 'Eric');
-- Une partie, deux rôles sur le même conteneur.
INSERT INTO public.cargo_shipment_parties (id, shipment_id, party_id, role) VALUES
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000e1', 'FORWARDER'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000e1', 'SHIPPER');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.cargo_shipment_parties (shipment_id, party_id, role) VALUES ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000e1', 'SHIPPER');
    PERFORM _assert(false, 'le même rôle deux fois doit échouer');
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.cargo_shipment_parties (shipment_id, party_id, role) VALUES ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000e1', 'PIRATE');
    PERFORM _assert(false, 'un rôle inconnu doit échouer');
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
-- Un rôle ne change pas de conteneur ; la note, si.
UPDATE public.cargo_shipment_parties SET note = 'détient les originaux', shipment_id = '00000000-0000-0000-0000-00000000000b' WHERE id = '00000000-0000-0000-0000-0000000000e3';
DO $$ BEGIN
  PERFORM _assert((SELECT shipment_id FROM public.cargo_shipment_parties WHERE id = '00000000-0000-0000-0000-0000000000e3') = '00000000-0000-0000-0000-00000000000a', 'rôle figé sur son conteneur');
  PERFORM _assert((SELECT note FROM public.cargo_shipment_parties WHERE id = '00000000-0000-0000-0000-0000000000e3') = 'détient les originaux', 'note modifiable');
END $$;
-- Le support lit, n'écrit pas ; le caissier ne voit rien.
SELECT _as('00000000-0000-0000-0000-0000000000a2');
DO $$ BEGIN
  PERFORM _assert((SELECT count(*) FROM public.cargo_shipment_parties) = 2, 'le support voit les rôles');
  BEGIN
    INSERT INTO public.cargo_parties (name) VALUES ('intrus');
    PERFORM _assert(false, 'le support ne crée pas de partie');
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT _as('00000000-0000-0000-0000-0000000000a3');
DO $$ BEGIN
  PERFORM _assert((SELECT count(*) FROM public.cargo_parties) = 0, 'le caissier ne voit pas l''annuaire');
END $$;
-- Supprimer la partie retire ses rôles.
SELECT _as('00000000-0000-0000-0000-0000000000a1');
DELETE FROM public.cargo_parties WHERE id = '00000000-0000-0000-0000-0000000000e1';
DO $$ BEGIN
  PERFORM _assert((SELECT count(*) FROM public.cargo_shipment_parties) = 0, 'rôles retirés avec la partie');
END $$;
RESET ROLE;

\echo '✓ cargo_dossier : toutes les règles tiennent'
