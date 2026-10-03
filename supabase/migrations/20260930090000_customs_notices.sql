-- ============================================================================
-- Douane, étape 6 — la veille réglementaire et les perturbations.
--
-- Le « regulatory watch » et la « disruptions layer » de Flexport, pour un
-- importateur camerounais : ce qui change dans les textes (TEC, loi de
-- finances, SGS, CIVIC…) et ce qui retarde la marchandise (congés en Chine,
-- port, corridor). Une seule table, deux sortes d'avis.
--
--   customs_notices          — lisible par tous une fois publié (le hub
--                              douane est public, comme le simulateur) ;
--                              l'équipe (canViewCustoms) voit aussi les brouillons.
--   customs_notice_upsert    — l'équipe douane (canManageCustoms) écrit ou
--                              corrige un avis ; à la première publication d'un
--                              avis réglementaire, les clients dont un produit
--                              classé est visé sont prévenus.
--   customs_notice_archive   — retirer un avis de la publication.
--
-- Les avis de départ ne viennent que de textes lus (docs/douane/01-sources.md)
-- ou du calendrier ; chaque avis porte sa source et sa confiance. Aucune
-- perturbation en cours n'est inventée : l'équipe les publie quand elles arrivent.
-- Idempotente : rejouable.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customs_notices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  kind          TEXT NOT NULL CHECK (kind IN ('regulation','disruption')),
  title         TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 160),
  summary       TEXT NOT NULL CHECK (length(trim(summary)) BETWEEN 3 AND 600),
  advice        TEXT CHECK (advice IS NULL OR length(advice) <= 1000),
  -- Réglementation : en vigueur, adoptée ou annoncée (pas encore appliquée), ou à confirmer.
  status        TEXT NOT NULL DEFAULT 'in_force' CHECK (status IN ('in_force','announced','watch')),
  severity      TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  starts_on     DATE,
  ends_on       DATE,
  -- Perturbation : le retard typique, en jours.
  delay_days    INTEGER CHECK (delay_days IS NULL OR delay_days BETWEEN 0 AND 120),
  -- Les codes SH visés, par préfixe (2 à 12 chiffres). Vide : tout le monde.
  hs_specs      TEXT[] NOT NULL DEFAULT '{}',
  -- Les lieux, en UN/LOCODE ou préfixe pays : CN, CNSHA, CMDLA, CMKBI…
  places        TEXT[] NOT NULL DEFAULT '{}',
  source_label  TEXT CHECK (source_label IS NULL OR length(source_label) <= 200),
  source_url    TEXT CHECK (source_url IS NULL OR source_url ~ '^https://[^\s]+$'),
  confidence    TEXT NOT NULL DEFAULT 'a_verifier' CHECK (confidence IN ('officiel','observe','marche','a_verifier')),
  published     BOOLEAN NOT NULL DEFAULT false,
  published_at  TIMESTAMPTZ,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customs_notices_dates_check CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on),
  CONSTRAINT customs_notices_specs_check CHECK (cardinality(hs_specs) <= 60 AND array_to_string(hs_specs, ',') ~ '^([0-9]{2,12}(,[0-9]{2,12})*)?$'),
  CONSTRAINT customs_notices_places_check CHECK (cardinality(places) <= 20 AND array_to_string(places, ',') ~ '^([A-Z]{2}([A-Z0-9]{3})?(-[A-Z]{2})?(,[A-Z]{2}([A-Z0-9]{3})?(-[A-Z]{2})?)*)?$')
);
CREATE INDEX IF NOT EXISTS customs_notices_feed_idx ON public.customs_notices (published, kind, starts_on DESC);

DROP TRIGGER IF EXISTS customs_notices_touch ON public.customs_notices;
CREATE TRIGGER customs_notices_touch BEFORE UPDATE ON public.customs_notices FOR EACH ROW EXECUTE FUNCTION public.customs_touch_updated_at();

ALTER TABLE public.customs_notices ENABLE ROW LEVEL SECURITY;
-- Deux politiques : anon ne doit jamais évaluer admin_has_permission.
DROP POLICY IF EXISTS customs_notices_public_read ON public.customs_notices;
CREATE POLICY customs_notices_public_read ON public.customs_notices FOR SELECT TO anon USING (published);
DROP POLICY IF EXISTS customs_notices_member_read ON public.customs_notices;
CREATE POLICY customs_notices_member_read ON public.customs_notices FOR SELECT TO authenticated
  USING (published OR public.admin_has_permission(auth.uid(), 'canViewCustoms'));
-- Aucune écriture directe : customs_notice_upsert / customs_notice_archive.
GRANT SELECT ON public.customs_notices TO anon, authenticated;

-- ─── Écrire ou corriger un avis ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.customs_notice_upsert(p_notice JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_slug TEXT := lower(trim(COALESCE(p_notice ->> 'slug', '')));
  v_prev public.customs_notices;
  v_row public.customs_notices;
  v_specs TEXT[];
  v_places TEXT[];
  v_publish BOOLEAN := COALESCE(p_notice ->> 'published', '') = 'true';
  v_notified INTEGER := 0;
  v_client UUID;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageCustoms') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_notice IS NULL OR jsonb_typeof(p_notice) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Avis invalide');
  END IF;
  IF v_slug !~ '^[a-z0-9][a-z0-9-]{2,79}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Identifiant invalide (minuscules, chiffres et tirets)');
  END IF;
  IF COALESCE(p_notice ->> 'kind', '') NOT IN ('regulation','disruption') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type d''avis inconnu');
  END IF;
  IF jsonb_typeof(COALESCE(p_notice -> 'hs_specs', '[]')) <> 'array' OR jsonb_typeof(COALESCE(p_notice -> 'places', '[]')) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Codes ou lieux invalides');
  END IF;
  SELECT COALESCE(array_agg(DISTINCT regexp_replace(x, '[^0-9]', '', 'g')), '{}') INTO v_specs
    FROM jsonb_array_elements_text(COALESCE(p_notice -> 'hs_specs', '[]')) x WHERE regexp_replace(x, '[^0-9]', '', 'g') <> '';
  SELECT COALESCE(array_agg(DISTINCT upper(trim(x))), '{}') INTO v_places
    FROM jsonb_array_elements_text(COALESCE(p_notice -> 'places', '[]')) x WHERE trim(x) <> '';

  SELECT * INTO v_prev FROM public.customs_notices WHERE slug = v_slug FOR UPDATE;
  BEGIN
    INSERT INTO public.customs_notices AS n (
      slug, kind, title, summary, advice, status, severity, starts_on, ends_on, delay_days, hs_specs, places,
      source_label, source_url, confidence, published, published_at, created_by)
    VALUES (
      v_slug, p_notice ->> 'kind', trim(p_notice ->> 'title'), trim(p_notice ->> 'summary'), NULLIF(trim(COALESCE(p_notice ->> 'advice', '')), ''),
      COALESCE(p_notice ->> 'status', 'in_force'), COALESCE(p_notice ->> 'severity', 'medium'),
      NULLIF(p_notice ->> 'starts_on', '')::date, NULLIF(p_notice ->> 'ends_on', '')::date, NULLIF(p_notice ->> 'delay_days', '')::integer,
      v_specs, v_places, NULLIF(trim(COALESCE(p_notice ->> 'source_label', '')), ''), NULLIF(trim(COALESCE(p_notice ->> 'source_url', '')), ''),
      COALESCE(p_notice ->> 'confidence', 'a_verifier'), v_publish, CASE WHEN v_publish THEN now() END, v_uid)
    ON CONFLICT (slug) DO UPDATE SET
      kind = EXCLUDED.kind, title = EXCLUDED.title, summary = EXCLUDED.summary, advice = EXCLUDED.advice,
      status = EXCLUDED.status, severity = EXCLUDED.severity, starts_on = EXCLUDED.starts_on, ends_on = EXCLUDED.ends_on,
      delay_days = EXCLUDED.delay_days, hs_specs = EXCLUDED.hs_specs, places = EXCLUDED.places,
      source_label = EXCLUDED.source_label, source_url = EXCLUDED.source_url, confidence = EXCLUDED.confidence,
      published = EXCLUDED.published,
      published_at = CASE WHEN EXCLUDED.published AND NOT n.published THEN now() ELSE n.published_at END
    RETURNING * INTO v_row;
  EXCEPTION
    WHEN check_violation OR not_null_violation OR invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN
      RETURN jsonb_build_object('success', false, 'error', 'Avis incomplet ou invalide : ' || SQLERRM);
  END;

  -- Première publication d'un avis réglementaire ciblé : les clients dont un produit
  -- classé (code signé, sinon proposé) est visé en sont prévenus, une fois chacun.
  IF v_row.published AND v_row.kind = 'regulation' AND cardinality(v_row.hs_specs) > 0
     AND (v_prev.id IS NULL OR NOT v_prev.published) THEN
    FOR v_client IN
      SELECT DISTINCT c.client_user_id FROM public.customs_classifications c
       WHERE c.status <> 'cancelled'
         AND EXISTS (SELECT 1 FROM unnest(v_row.hs_specs) s WHERE COALESCE(c.final_code, c.proposed_code) LIKE s || '%')
    LOOP
      PERFORM public.customs_notify_client(v_client, 'customs_notice', 'Veille douane — ' || v_row.title, v_row.summary,
        jsonb_build_object('notice_id', v_row.id, 'slug', v_row.slug));
      v_notified := v_notified + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_row.id, 'slug', v_row.slug, 'published', v_row.published, 'notified', v_notified);
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_notice_upsert(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_notice_upsert(JSONB) TO authenticated;
COMMENT ON FUNCTION public.customs_notice_upsert(JSONB) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCustoms","confirm":true,"danger":false,"label":"Publier ou corriger un avis de veille douane (changement réglementaire ou perturbation logistique)"}';

-- ─── Retirer un avis ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.customs_notice_archive(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canManageCustoms') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  UPDATE public.customs_notices SET published = false WHERE id = p_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Avis introuvable'); END IF;
  RETURN jsonb_build_object('success', true);
END;
$fn$;
REVOKE ALL ON FUNCTION public.customs_notice_archive(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customs_notice_archive(UUID) TO authenticated;
COMMENT ON FUNCTION public.customs_notice_archive(UUID) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCustoms","confirm":true,"danger":false,"label":"Retirer un avis de veille douane de la publication"}';

-- ─── Les avis de départ : des textes lus, le calendrier ─────────────────────
INSERT INTO public.customs_notices
  (slug, kind, title, summary, advice, status, severity, starts_on, ends_on, delay_days, hs_specs, places, source_label, source_url, confidence, published, published_at)
VALUES
  ('tec-ceeac-2026', 'regulation',
   'Le tarif extérieur commun de la CEEAC s''applique depuis le 1er janvier 2026',
   'Le TEC de la CEEAC remplace celui de la CEMAC. Certaines familles peuvent passer à 40 % : vêtements, mèches et perruques, tissus, chocolat, tabac, eaux et boissons. Le taux de chaque ligne reste à confirmer sur le tarif intégré CAMCIS.',
   'Avant de commander, faites confirmer le taux de vos lignes par votre commissionnaire. Le simulateur signale les familles concernées.',
   'in_force', 'high', DATE '2026-01-01', NULL, NULL,
   ARRAY['61','62','6703','6704','5208','5209','5210','5211','5212','5407','5408','5512','5513','5514','5515','5516','1805','1806','24','2201','2202'],
   '{}', 'Conseil national des chargeurs du Cameroun (CNCC)', 'https://www.cncc.cm/fr/article/le-tarif-exterieur-commun-tec-de-la-ceeac-s-applique-au-cameroun-1031', 'officiel', true, now()),
  ('lf2026-accises-vehicules', 'regulation',
   'Accises sur les véhicules : la nouvelle table de la loi de finances 2026',
   'La loi de finances 2026 (art. 10) change les seuils d''âge et de cylindrée des accises sur les véhicules. En septembre 2026, CAMCIS appliquait encore l''ancienne table : une Yaris de 2009 payait 25 %.',
   'Le simulateur chiffre les deux règles pour votre véhicule : comparez avant d''acheter.',
   'announced', 'medium', DATE '2026-01-01', NULL, NULL,
   ARRAY['8702','8703','8704'], '{}', 'Projet de loi de finances 2026 (DGB)', 'https://www.dgb.cm/wp-content/uploads/2025/11/PROJET-DE-LOI-FINANCES-2026_FR_26112025.pdf', 'a_verifier', true, now()),
  ('lf2026-taxe-environnementale', 'regulation',
   'Taxe environnementale à l''importation (loi de finances 2026)',
   'Perçue par la douane : ciment 2 500 F la tonne, fers à béton 5 000 F, carreaux et céramiques 15 000 F, articles en plastique 5 % de la valeur (1 000 F au plus par unité). Montants lus dans le projet de loi ; texte promulgué à vérifier.',
   'Donnez le poids net dans le simulateur pour l''estimer.',
   'announced', 'medium', DATE '2026-01-01', NULL, NULL,
   ARRAY['2523','7213','7214','6907','6908','39'], '{}', 'Projet de loi de finances 2026 (DGB)', 'https://www.dgb.cm/wp-content/uploads/2025/11/PROJET-DE-LOI-FINANCES-2026_FR_26112025.pdf', 'a_verifier', true, now()),
  ('civic-vehicules-occasion', 'regulation',
   'CIVIC : 29 813 F par véhicule d''occasion',
   'Depuis le 1er juillet 2025, chaque véhicule d''occasion importé paie le contrôle d''identification (CIVIC), en dehors de la DAU.',
   'Comptez-le dans le coût de revient : le simulateur l''ajoute pour un véhicule d''occasion.',
   'in_force', 'low', DATE '2025-07-01', NULL, NULL,
   ARRAY['8702','8703','8704'], '{}', 'Mesure du ministère des Finances (presse spécialisée)', NULL, 'marche', true, now()),
  ('pvi-sgs-facture-definitive', 'regulation',
   'Inspection SGS : 0,95 % dès 2 000 000 F FOB, et la facture définitive',
   'Toute importation de 2 000 000 F FOB ou plus est inspectée par la SGS : 0,95 % de la valeur FOB. Sans facture définitive déposée à temps, la valeur retenue peut être bien plus élevée — 2 311 829 F de trop sur une Toyota Fortuner.',
   'Demandez à votre fournisseur de déposer la facture définitive sur export-cm.sgs.com dès l''expédition.',
   'in_force', 'high', DATE '2016-11-30', NULL, NULL,
   '{}', '{}', 'Instruction 000625/MINFI/CAB ; guide de l''importateur SGS Cameroun',
   'https://www.sgs.com/fr-cm/-/media/SGSCorp/Documents/Corporate/Technical-Documents/Technical-Guidelines-and-Policies/Guide-des-Importateurs-Cameroun-FR.cdn.fr-cm.pdf', 'officiel', true, now()),
  ('code-douanes-ceeac-cemac-2026', 'regulation',
   'Nouveau code des douanes CEEAC-CEMAC',
   'Un code des douanes commun CEEAC-CEMAC est en vigueur depuis le 1er janvier 2026. Les délais et voies de recours cités par Bonzini (rectification, réclamation en trois ans) viennent du code CEMAC 2019 : leur numérotation est à confirmer dans le nouveau texte.',
   'Pour une réclamation, faites vérifier l''article et le délai par votre commissionnaire.',
   'watch', 'low', DATE '2026-01-01', NULL, NULL,
   '{}', '{}', NULL, NULL, 'a_verifier', true, now()),
  ('chine-fete-nationale-2026', 'disruption',
   'Chine : congés de la fête nationale, du 1er au 7 octobre 2026',
   'Usines, transporteurs routiers et bureaux chinois s''arrêtent une semaine. Les réservations se tendent juste avant ; la production et les départs reprennent lentement après.',
   'Validez commandes et paiements fournisseurs avant le 30 septembre ; comptez une à deux semaines de plus sur ce qui devait partir en octobre.',
   'in_force', 'medium', DATE '2026-10-01', DATE '2026-10-07', 7,
   '{}', ARRAY['CN'], 'Calendrier des congés officiels chinois', NULL, 'marche', true, now()),
  ('nouvel-an-chinois-2027', 'disruption',
   'Nouvel An chinois : le 6 février 2027',
   'La plupart des usines ferment deux à quatre semaines autour du 6 février 2027. La production s''arrête avant, les ouvriers reviennent lentement après : c''est la plus longue coupure de l''année.',
   'Commandez et réglez vos fournisseurs avant la mi-janvier ; comptez trois semaines de décalage sur ce qui devait partir en février.',
   'in_force', 'high', DATE '2027-01-30', DATE '2027-02-21', 21,
   '{}', ARRAY['CN'], 'Calendrier lunaire ; pratique des usines', NULL, 'marche', true, now())
ON CONFLICT (slug) DO NOTHING;
