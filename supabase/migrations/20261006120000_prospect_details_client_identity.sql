-- ============================================================================
-- Prospects : la fiche complète · Clients : sexe et date de naissance
--
-- Le 06/10/2026, le directeur veut une vraie différence entre le PROSPECT
-- (quelqu'un que le commercial démarche, sans compte) et le CLIENT (compte
-- Bonzini), et une fiche prospect qui serve vraiment à vendre :
--
--   1. LA FICHE PROSPECT — en plus du prénom et du numéro : le NOM, le SEXE
--      (homme / femme) et la VILLE où il est installé au Cameroun deviennent
--      obligatoires ; la date de naissance, l'email et l'entreprise restent
--      facultatifs. Surtout, deux champs libres, le cœur de l'entretien :
--      « ses plus gros problèmes aujourd'hui » (payer ses fournisseurs et
--      faire arriver l'argent en Chine, manque de capital, gestion du
--      capital, transport avion ou bateau, trouver les bons fournisseurs, la
--      douane et sa procédure, fixer ses prix de vente…) et « ce que nous
--      pouvons faire pour l'aider ». Le formulaire exige le premier ; le
--      serveur les accepte vides (un prospect saisi avant ce jour n'en a pas).
--   2. TOUS SES NUMÉROS — un importateur a souvent deux ou trois numéros
--      (Orange, MTN, WhatsApp chinois…). Le principal reste prospects.phone /
--      phone_e164 ; les autres vont dans prospect_phones (neuf au plus). Un
--      numéro n'est suivi que par UN prospect ouvert à la fois, qu'il soit
--      principal ou non, et jamais s'il est déjà celui d'un client : la
--      règle du 05/10 est étendue aux autres numéros, des deux côtés.
--      Le compte client créé avec l'UN de ces numéros est attribué à son
--      commercial (déclencheur clients_match_prospect), et la recherche par
--      numéro du formulaire « Nouveau client » renvoie toute la fiche (nom,
--      entreprise, ville, email, sexe, date de naissance, numéros) pour la
--      reprendre d'office — sauf l'email, seulement PROPOSÉ à l'écran : il
--      deviendrait l'adresse de connexion (confirmée) du client, et c'est
--      un commercial qui l'a saisi, sans vérification.
--   3. CÔTÉ CLIENT — le sexe et la date de naissance existent déjà en base
--      (clients.gender MALE / FEMALE / OTHER, clients.date_of_birth) mais
--      aucune RPC de l'équipe ne les écrivait. admin_set_client_identity :
--      canEditClients, ou canRegisterClients pour un client qu'on a
--      soi-même enregistré (« Enregistré par » = soi), sans limite de temps
--      — comme reception_set_client_origin ; journalisée.
--
-- Mêmes règles partout (et dans src/lib/people.ts) : sexe MALE / FEMALE,
-- date de naissance de 16 à 110 ans, email en minuscules et de forme
-- x@y.z, numéros au format international. Tout est vérifié AVANT d'écrire :
-- un numéro refusé ne laisse jamais une fiche à moitié enregistrée.
--
-- Idempotente (rejouable sans dégât). Suppose 20261005160000 (Mes équipes +
-- commerciaux) et 20261006100000 (« Enregistré par ») passées.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. La fiche prospect : sexe, date de naissance, email, problèmes, aide
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS gender      TEXT;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS birth_date  DATE;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS email       TEXT;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS pain_points TEXT;
ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS help_needed TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prospects_gender_check' AND conrelid = 'public.prospects'::regclass) THEN
    ALTER TABLE public.prospects ADD CONSTRAINT prospects_gender_check
      CHECK (gender IS NULL OR gender IN ('MALE', 'FEMALE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prospects_email_check' AND conrelid = 'public.prospects'::regclass) THEN
    ALTER TABLE public.prospects ADD CONSTRAINT prospects_email_check
      CHECK (email IS NULL OR (length(email) <= 254 AND email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prospects_pain_points_length' AND conrelid = 'public.prospects'::regclass) THEN
    ALTER TABLE public.prospects ADD CONSTRAINT prospects_pain_points_length
      CHECK (pain_points IS NULL OR length(pain_points) <= 2000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prospects_help_needed_length' AND conrelid = 'public.prospects'::regclass) THEN
    ALTER TABLE public.prospects ADD CONSTRAINT prospects_help_needed_length
      CHECK (help_needed IS NULL OR length(help_needed) <= 2000);
  END IF;
END $$;

COMMENT ON COLUMN public.prospects.gender IS 'MALE / FEMALE. Obligatoire à la création depuis le 06/10 ; NULL pour un prospect saisi avant.';
COMMENT ON COLUMN public.prospects.birth_date IS 'Facultative ; de 16 à 110 ans au jour de la saisie.';
COMMENT ON COLUMN public.prospects.email IS 'Facultatif ; en minuscules.';
COMMENT ON COLUMN public.prospects.pain_points IS 'Ses plus gros problèmes aujourd''hui (champ libre) : payer ses fournisseurs, capital, transport, fournisseurs, douane, prix de vente…';
COMMENT ON COLUMN public.prospects.help_needed IS 'Ce que nous pouvons faire pour l''aider (champ libre).';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Ses autres numéros
-- ─────────────────────────────────────────────────────────────────────────
-- Le principal reste prospects.phone / phone_e164 (index unique des
-- prospects ouverts, lu par les écrans du 05/10). Ici : les AUTRES.
CREATE TABLE IF NOT EXISTS public.prospect_phones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  phone_e164  TEXT NOT NULL CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  country_iso TEXT CHECK (country_iso IS NULL OR country_iso ~ '^[A-Z]{2}$'),
  label       TEXT CHECK (label IS NULL OR length(label) <= 40),
  position    INTEGER NOT NULL DEFAULT 1 CHECK (position >= 1),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (prospect_id, phone_e164)
);
-- « Ce numéro est-il suivi ? » se pose à chaque saisie et à chaque création de client.
CREATE INDEX IF NOT EXISTS prospect_phones_phone_idx ON public.prospect_phones (phone_e164);

-- Lecture : comme la fiche (le commercial lit les numéros de SES prospects,
-- le responsable tous). Aucune politique d'écriture : tout passe par
-- prospect_create / prospect_update.
ALTER TABLE public.prospect_phones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Commercial reads own prospect phones" ON public.prospect_phones;
CREATE POLICY "Commercial reads own prospect phones" ON public.prospect_phones
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.prospects p
     WHERE p.id = prospect_phones.prospect_id
       AND (p.source_id = public.current_commercial_source_id()
            OR public.admin_has_permission(auth.uid(), 'canManageSales'))
  ));

-- Mêmes droits que prospects : aucune ligne GRANT n'y est écrite (droits par
-- défaut de Supabase sur le schéma public) ; la lecture par `authenticated`
-- est rappelée ici pour que la jointure `phones:prospect_phones(…)` de
-- l'espace commercial ne dépende pas de ces droits par défaut. Les écritures
-- restent fermées par la RLS (aucune politique).
GRANT SELECT ON TABLE public.prospect_phones TO authenticated;
GRANT ALL ON TABLE public.prospect_phones TO service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Règles communes (internes)
-- ─────────────────────────────────────────────────────────────────────────
-- Date de naissance : NULL si elle est absente ou bonne, sinon le message.
-- Âge révolu entre 16 et 110 ans au jour même (même règle que people.ts).
CREATE OR REPLACE FUNCTION public._birth_date_error(p_date DATE)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
           WHEN p_date IS NULL THEN NULL
           WHEN extract(year FROM age(current_date, p_date)) BETWEEN 16 AND 110 THEN NULL
           ELSE 'Date de naissance invalide (âge entre 16 et 110 ans)'
         END
$$;

-- Email DÉJÀ nettoyé (btrim, minuscules, '' → NULL) : NULL s'il est absent
-- ou bon, sinon le message.
CREATE OR REPLACE FUNCTION public._email_error(p_email TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
           WHEN p_email IS NULL THEN NULL
           WHEN length(p_email) <= 254 AND p_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN NULL
           ELSE 'Adresse email invalide'
         END
$$;

-- La liste des AUTRES numéros envoyée par l'écran : [{phone_e164,
-- country_iso?, label?}] (une simple chaîne est aussi acceptée). Rien n'est
-- lu en base : forme seulement. Renvoie {"phones": [...]} nettoyée (format
-- international, pays en majuscules, libellé sans espaces autour, le
-- principal et les doubles retirés), ou {"error": "..."}.
CREATE OR REPLACE FUNCTION public._prospect_phone_list(p_phones JSONB, p_primary TEXT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_item  JSONB;
  v_raw   TEXT;
  v_e164  TEXT;
  v_iso   TEXT;
  v_label TEXT;
  v_seen  TEXT[] := ARRAY[]::TEXT[];
  v_out   JSONB := '[]'::jsonb;
BEGIN
  IF p_phones IS NULL OR jsonb_typeof(p_phones) = 'null' THEN
    RETURN jsonb_build_object('phones', v_out);
  END IF;
  IF jsonb_typeof(p_phones) <> 'array' THEN
    RETURN jsonb_build_object('error', 'Liste de numéros invalide');
  END IF;
  IF jsonb_array_length(p_phones) > 20 THEN
    RETURN jsonb_build_object('error', 'Dix numéros au plus (le principal et neuf autres)');
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_phones) LOOP
    v_raw := btrim(coalesce(CASE jsonb_typeof(v_item)
                              WHEN 'object' THEN v_item ->> 'phone_e164'
                              WHEN 'string' THEN v_item #>> '{}'
                            END, ''));
    v_e164 := public._phone_e164(v_raw);
    IF v_e164 IS NULL THEN
      RETURN jsonb_build_object('error', 'Numéro invalide : ' || coalesce(nullif(left(v_raw, 32), ''), '(vide)'));
    END IF;
    v_iso := CASE WHEN jsonb_typeof(v_item) = 'object'
                  THEN nullif(upper(btrim(coalesce(v_item ->> 'country_iso', ''))), '') END;
    IF v_iso IS NOT NULL AND v_iso !~ '^[A-Z]{2}$' THEN
      RETURN jsonb_build_object('error', 'Pays inconnu pour le numéro ' || v_e164);
    END IF;
    v_label := CASE WHEN jsonb_typeof(v_item) = 'object'
                    THEN nullif(btrim(coalesce(v_item ->> 'label', '')), '') END;
    IF length(v_label) > 40 THEN
      RETURN jsonb_build_object('error', 'Libellé trop long (40 caractères au plus)');
    END IF;
    -- Le principal, ou un numéro déjà dans la liste : ignoré.
    IF v_e164 = p_primary OR v_e164 = ANY(v_seen) THEN
      CONTINUE;
    END IF;
    v_seen := v_seen || v_e164;
    v_out := v_out || jsonb_build_array(jsonb_build_object('phone_e164', v_e164, 'country_iso', v_iso, 'label', v_label));
  END LOOP;

  IF coalesce(array_length(v_seen, 1), 0) > 9 THEN
    RETURN jsonb_build_object('error', 'Dix numéros au plus (le principal et neuf autres)');
  END IF;
  RETURN jsonb_build_object('phones', v_out);
END;
$$;

-- Deux saisies simultanées du même numéro (deux commerciaux, ou le même deux
-- fois) passent l'une après l'autre : sans ce verrou, toutes deux vérifient
-- avant que l'une ait écrit (aucun index unique ne couvre les AUTRES numéros).
-- Ordre trié : pas d'interblocage. Relâché à la fin de la transaction.
CREATE OR REPLACE FUNCTION public._prospect_lock_numbers(p_numbers TEXT[])
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_n TEXT;
BEGIN
  FOR v_n IN SELECT DISTINCT n FROM unnest(coalesce(p_numbers, ARRAY[]::TEXT[])) AS n WHERE n IS NOT NULL ORDER BY n LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('bonzini.prospect_phone:' || v_n, 0));
  END LOOP;
END;
$$;

-- Ce numéro est-il pris ? 'client' (celui d'un client Bonzini), 'other'
-- (suivi — principal OU autre numéro — par un prospect ouvert d'une autre
-- fiche commercial), 'mine' (par un autre prospect ouvert de la même fiche),
-- NULL s'il est libre. p_except : le prospect qu'on modifie.
CREATE OR REPLACE FUNCTION public._prospect_number_conflict(p_e164 TEXT, p_source_id UUID, p_except UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
           WHEN public._phone_is_client(p_e164) THEN 'client'
           WHEN bool_or(h.source_id IS DISTINCT FROM p_source_id) THEN 'other'
           WHEN count(h.source_id) > 0 THEN 'mine'
         END
    FROM (
      SELECT p.source_id
        FROM public.prospects p
       WHERE p.phone_e164 = p_e164
         AND p.status IN ('new','contacted','interested')
         AND p.id IS DISTINCT FROM p_except
      UNION ALL
      SELECT p.source_id
        FROM public.prospect_phones pp
        JOIN public.prospects p ON p.id = pp.prospect_id
       WHERE pp.phone_e164 = p_e164
         AND p.status IN ('new','contacted','interested')
         AND p.id IS DISTINCT FROM p_except
    ) h
$$;

-- Le premier des AUTRES numéros qui est pris, dit en clair ; NULL si tous
-- sont libres.
CREATE OR REPLACE FUNCTION public._prospect_numbers_error(p_numbers TEXT[], p_source_id UUID, p_except UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n TEXT;
  v_c TEXT;
BEGIN
  FOREACH v_n IN ARRAY coalesce(p_numbers, ARRAY[]::TEXT[]) LOOP
    v_c := public._prospect_number_conflict(v_n, p_source_id, p_except);
    IF v_c = 'client' THEN
      RETURN 'Le numéro ' || v_n || ' est déjà celui d''un client Bonzini';
    ELSIF v_c = 'other' THEN
      RETURN 'Le numéro ' || v_n || ' est déjà suivi par un autre commercial';
    ELSIF v_c = 'mine' THEN
      RETURN 'Le numéro ' || v_n || ' est déjà dans votre liste';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Ajouter un prospect
-- ─────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.prospect_create(text, text, text, text, text, text, timestamptz, text[], uuid);

CREATE OR REPLACE FUNCTION public.prospect_create(
  p_first_name TEXT,
  p_phone TEXT,
  p_last_name TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_next_action_at TIMESTAMPTZ DEFAULT NULL,
  p_interests TEXT[] DEFAULT NULL,
  p_source_id UUID DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_birth_date DATE DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_phones JSONB DEFAULT NULL,
  p_pain_points TEXT DEFAULT NULL,
  p_help_needed TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_src UUID := public._sales_scope(p_source_id);
  v_e164 TEXT := public._phone_e164(p_phone);
  v_gender TEXT := upper(btrim(coalesce(p_gender, '')));
  v_email TEXT := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_pain TEXT := nullif(btrim(coalesce(p_pain_points, '')), '');
  v_help TEXT := nullif(btrim(coalesce(p_help_needed, '')), '');
  v_list JSONB;
  v_others TEXT[];
  v_conflict TEXT;
  v_err TEXT;
  v_id UUID;
BEGIN
  IF v_src IS NULL THEN
    RETURN public._sales_scope_error();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.client_sources WHERE id = v_src AND kind = 'commercial' AND is_active) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette fiche commercial est archivée ou introuvable');
  END IF;

  -- Qui : prénom, nom, sexe, ville — obligatoires.
  IF length(btrim(coalesce(p_first_name, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le prénom est requis');
  END IF;
  IF length(btrim(coalesce(p_last_name, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le nom est requis');
  END IF;
  IF v_gender NOT IN ('MALE', 'FEMALE') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le sexe : homme ou femme');
  END IF;
  IF length(btrim(coalesce(p_city, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'La ville est requise');
  END IF;
  -- Facultatifs, mais justes s'ils sont donnés.
  v_err := coalesce(public._birth_date_error(p_birth_date), public._email_error(v_email));
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_err);
  END IF;
  IF length(v_pain) > 2000 OR length(v_help) > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un champ est trop long');
  END IF;

  -- Les numéros : la forme d'abord, tous.
  IF v_e164 IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Numéro invalide : indiquez l''indicatif (+237…)');
  END IF;
  v_list := public._prospect_phone_list(p_phones, v_e164);
  IF v_list ? 'error' THEN
    RETURN jsonb_build_object('success', false, 'error', v_list ->> 'error');
  END IF;
  SELECT coalesce(array_agg(e ->> 'phone_e164' ORDER BY o), ARRAY[]::TEXT[])
    INTO v_others
    FROM jsonb_array_elements(v_list -> 'phones') WITH ORDINALITY AS t(e, o);

  -- Puis, verrouillés, s'ils sont libres : le principal, puis les autres.
  PERFORM public._prospect_lock_numbers(v_e164 || v_others);
  v_conflict := public._prospect_number_conflict(v_e164, v_src, NULL);
  IF v_conflict IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error',
      CASE v_conflict WHEN 'client' THEN 'Ce numéro est déjà celui d''un client Bonzini'
                      WHEN 'mine'   THEN 'Ce prospect est déjà dans votre liste'
                      ELSE 'Ce numéro est déjà suivi par un autre commercial' END);
  END IF;
  v_err := public._prospect_numbers_error(v_others, v_src, NULL);
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_err);
  END IF;

  -- Tout est bon : on écrit.
  INSERT INTO public.prospects (source_id, first_name, last_name, company, phone, phone_e164, city, interests, notes, next_action_at, created_by,
                                gender, birth_date, email, pain_points, help_needed)
  VALUES (v_src, btrim(p_first_name), btrim(p_last_name), nullif(btrim(coalesce(p_company, '')), ''),
          btrim(p_phone), v_e164, btrim(p_city),
          coalesce((SELECT array_agg(DISTINCT i) FROM unnest(p_interests) i WHERE i IN ('payments','air','sea')), '{}'),
          nullif(btrim(coalesce(p_notes, '')), ''), p_next_action_at, v_uid,
          v_gender, p_birth_date, v_email, v_pain, v_help)
  RETURNING id INTO v_id;

  INSERT INTO public.prospect_phones (prospect_id, phone_e164, country_iso, label, position)
  SELECT v_id, e ->> 'phone_e164', e ->> 'country_iso', e ->> 'label', o
    FROM jsonb_array_elements(v_list -> 'phones') WITH ORDINALITY AS t(e, o);

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est déjà suivi par un commercial');
  WHEN check_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un champ est trop long');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Modifier un prospect
-- ─────────────────────────────────────────────────────────────────────────
-- NULL = inchangé, partout. Nom, ville, sexe : '' est refusé (obligatoires),
-- mais un prospect saisi avant le 06/10 sans eux reste modifiable tant
-- qu'on ne les envoie pas vides. '' efface un champ facultatif (entreprise,
-- email, notes, problèmes, aide) ; p_clear_birth_date efface la date de
-- naissance, p_clear_next_action la relance. p_phones non NULL = la liste
-- COMPLÈTE des autres numéros ([] = aucun). Un prospect « devenu client »
-- garde ses numéros (le compte client a été reconnu par l'un d'eux).
DROP FUNCTION IF EXISTS public.prospect_update(uuid, text, text, text, text, text, text, timestamptz, boolean, text[]);

CREATE OR REPLACE FUNCTION public.prospect_update(
  p_id UUID,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_company TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_next_action_at TIMESTAMPTZ DEFAULT NULL,
  p_clear_next_action BOOLEAN DEFAULT false,
  p_interests TEXT[] DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_birth_date DATE DEFAULT NULL,
  p_clear_birth_date BOOLEAN DEFAULT false,
  p_email TEXT DEFAULT NULL,
  p_phones JSONB DEFAULT NULL,
  p_pain_points TEXT DEFAULT NULL,
  p_help_needed TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.prospects;
  v_e164 TEXT;
  v_email TEXT := CASE WHEN p_email IS NULL THEN NULL ELSE nullif(lower(btrim(p_email)), '') END;
  v_clear_birth BOOLEAN := coalesce(p_clear_birth_date, false);
  v_current TEXT[];
  v_existing TEXT[];
  v_others TEXT[];
  v_new_others TEXT[];
  v_list JSONB;
  v_conflict TEXT;
  v_err TEXT;
BEGIN
  -- Verrouillée AVANT d'être lue : deux modifications simultanées passent l'une après l'autre.
  SELECT * INTO v_p FROM public.prospects WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR public._sales_scope(v_p.source_id) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Prospect introuvable');
  END IF;

  IF p_first_name IS NOT NULL AND btrim(p_first_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le prénom est requis');
  END IF;
  IF p_last_name IS NOT NULL AND btrim(p_last_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le nom est requis');
  END IF;
  IF p_gender IS NOT NULL AND upper(btrim(p_gender)) NOT IN ('MALE', 'FEMALE') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le sexe : homme ou femme');
  END IF;
  IF p_city IS NOT NULL AND btrim(p_city) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La ville est requise');
  END IF;
  v_err := coalesce(CASE WHEN v_clear_birth THEN NULL ELSE public._birth_date_error(p_birth_date) END,
                    public._email_error(v_email));
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_err);
  END IF;
  IF length(btrim(coalesce(p_pain_points, ''))) > 2000 OR length(btrim(coalesce(p_help_needed, ''))) > 2000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un champ est trop long');
  END IF;

  -- Ses numéros d'avant : le principal, puis les autres.
  SELECT coalesce(array_agg(phone_e164 ORDER BY position, created_at), ARRAY[]::TEXT[])
    INTO v_current
    FROM public.prospect_phones WHERE prospect_id = p_id;
  v_existing := v_p.phone_e164 || v_current;

  -- Le principal.
  v_e164 := v_p.phone_e164;
  IF p_phone IS NOT NULL AND public._phone_e164(p_phone) IS DISTINCT FROM v_p.phone_e164 THEN
    IF v_p.status = 'won' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce prospect est devenu client : ses numéros ne changent plus ici');
    END IF;
    v_e164 := public._phone_e164(p_phone);
    IF v_e164 IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Numéro invalide : indiquez l''indicatif (+237…)');
    END IF;
  END IF;

  -- Les autres (liste complète), s'ils sont envoyés.
  IF p_phones IS NOT NULL THEN
    v_list := public._prospect_phone_list(p_phones, v_e164);
    IF v_list ? 'error' THEN
      RETURN jsonb_build_object('success', false, 'error', v_list ->> 'error');
    END IF;
    SELECT coalesce(array_agg(e ->> 'phone_e164' ORDER BY o), ARRAY[]::TEXT[])
      INTO v_others
      FROM jsonb_array_elements(v_list -> 'phones') WITH ORDINALITY AS t(e, o);
    -- Devenu client : la même liste (libellés et ordre mis à part) est acceptée, pas une autre.
    IF v_p.status = 'won'
       AND ARRAY(SELECT x FROM unnest(v_others) x ORDER BY x) IS DISTINCT FROM ARRAY(SELECT x FROM unnest(v_current) x ORDER BY x) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce prospect est devenu client : ses numéros ne changent plus ici');
    END IF;
  END IF;

  -- Seuls les numéros NOUVEAUX pour cette fiche sont vérifiés (comme le
  -- principal avant le 06/10 : vérifié quand il change), après verrou.
  v_new_others := ARRAY(SELECT n FROM unnest(coalesce(v_others, ARRAY[]::TEXT[])) n WHERE NOT n = ANY(v_existing));
  PERFORM public._prospect_lock_numbers(
    CASE WHEN v_e164 = ANY(v_existing) THEN ARRAY[]::TEXT[] ELSE ARRAY[v_e164] END || v_new_others);
  IF NOT v_e164 = ANY(v_existing) THEN
    v_conflict := public._prospect_number_conflict(v_e164, v_p.source_id, p_id);
    IF v_conflict IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error',
        CASE v_conflict WHEN 'client' THEN 'Ce numéro est déjà celui d''un client Bonzini'
                        WHEN 'mine'   THEN 'Ce numéro est déjà dans votre liste'
                        ELSE 'Ce numéro est déjà suivi par un autre commercial' END);
    END IF;
  END IF;
  v_err := public._prospect_numbers_error(v_new_others, v_p.source_id, p_id);
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_err);
  END IF;

  -- Tout est bon : on écrit.
  UPDATE public.prospects
     SET first_name  = coalesce(btrim(p_first_name), first_name),
         last_name   = CASE WHEN p_last_name IS NULL THEN last_name ELSE btrim(p_last_name) END,
         company     = CASE WHEN p_company IS NULL THEN company ELSE nullif(btrim(p_company), '') END,
         city        = CASE WHEN p_city IS NULL THEN city ELSE btrim(p_city) END,
         notes       = CASE WHEN p_notes IS NULL THEN notes ELSE nullif(btrim(p_notes), '') END,
         phone       = CASE WHEN p_phone IS NULL THEN phone ELSE btrim(p_phone) END,
         phone_e164  = v_e164,
         interests   = CASE WHEN p_interests IS NULL THEN interests
                            ELSE coalesce((SELECT array_agg(DISTINCT i) FROM unnest(p_interests) i WHERE i IN ('payments','air','sea')), '{}') END,
         next_action_at = CASE WHEN p_clear_next_action THEN NULL ELSE coalesce(p_next_action_at, next_action_at) END,
         gender      = CASE WHEN p_gender IS NULL THEN gender ELSE upper(btrim(p_gender)) END,
         birth_date  = CASE WHEN v_clear_birth THEN NULL ELSE coalesce(p_birth_date, birth_date) END,
         email       = CASE WHEN p_email IS NULL THEN email ELSE v_email END,
         pain_points = CASE WHEN p_pain_points IS NULL THEN pain_points ELSE nullif(btrim(p_pain_points), '') END,
         help_needed = CASE WHEN p_help_needed IS NULL THEN help_needed ELSE nullif(btrim(p_help_needed), '') END,
         updated_at  = now()
   WHERE id = p_id;

  IF p_phones IS NOT NULL THEN
    DELETE FROM public.prospect_phones WHERE prospect_id = p_id;
    INSERT INTO public.prospect_phones (prospect_id, phone_e164, country_iso, label, position)
    SELECT p_id, e ->> 'phone_e164', e ->> 'country_iso', e ->> 'label', o
      FROM jsonb_array_elements(v_list -> 'phones') WITH ORDINALITY AS t(e, o);
  ELSIF v_e164 IS DISTINCT FROM v_p.phone_e164 THEN
    -- Un autre numéro devenu le principal ne reste pas en double dans la liste.
    DELETE FROM public.prospect_phones WHERE prospect_id = p_id AND phone_e164 = v_e164;
  END IF;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est déjà suivi par un commercial');
  WHEN check_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un champ est trop long');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Rouvrir un prospect perdu : ses AUTRES numéros aussi
-- ─────────────────────────────────────────────────────────────────────────
-- Même fonction qu'au 05/10. En plus : un prospect « perdu » qu'on rouvre ne
-- doit pas reprendre un numéro (principal ou autre) devenu entre-temps celui
-- d'un client, ou suivi par un autre prospect ouvert.
CREATE OR REPLACE FUNCTION public.prospect_set_status(p_id UUID, p_status TEXT, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.prospects;
  v_reason TEXT := nullif(btrim(coalesce(p_reason, '')), '');
  v_others TEXT[];
  v_conflict TEXT;
  v_err TEXT;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('new','contacted','interested','lost') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Statut inconnu');
  END IF;
  SELECT * INTO v_p FROM public.prospects WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR public._sales_scope(v_p.source_id) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Prospect introuvable');
  END IF;
  IF v_p.status = 'won' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce prospect est déjà devenu client');
  END IF;
  IF p_status = 'lost' AND (v_reason IS NULL OR length(v_reason) < 3) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dites en quelques mots pourquoi il est perdu');
  END IF;
  IF v_p.status = 'lost' AND p_status <> 'lost' THEN
    SELECT coalesce(array_agg(phone_e164 ORDER BY position, created_at), ARRAY[]::TEXT[])
      INTO v_others
      FROM public.prospect_phones WHERE prospect_id = p_id;
    PERFORM public._prospect_lock_numbers(v_p.phone_e164 || v_others);
    v_conflict := public._prospect_number_conflict(v_p.phone_e164, v_p.source_id, p_id);
    IF v_conflict = 'client' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est devenu celui d''un client Bonzini');
    ELSIF v_conflict = 'mine' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est déjà celui d''un autre de vos prospects');
    ELSIF v_conflict IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est de nouveau suivi par un autre commercial');
    END IF;
    v_err := public._prospect_numbers_error(v_others, v_p.source_id, p_id);
    IF v_err IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', v_err);
    END IF;
  END IF;

  UPDATE public.prospects
     SET status = p_status,
         lost_reason = CASE WHEN p_status = 'lost' THEN v_reason ELSE NULL END,
         status_changed_at = CASE WHEN status = p_status THEN status_changed_at ELSE now() END,
         updated_at = now()
   WHERE id = p_id;
  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce numéro est de nouveau suivi par un autre commercial');
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. « Ce numéro est-il un prospect ? » — et toute sa fiche
-- ─────────────────────────────────────────────────────────────────────────
-- Pour le formulaire « Nouveau client » : le numéro tapé peut être le
-- principal du prospect OU l'un de ses autres numéros. La fiche revient
-- entière pour être reprise d'office (nom, numéros, entreprise, ville,
-- email, sexe, date de naissance). Même garde qu'au 05/10.
CREATE OR REPLACE FUNCTION public.prospect_lookup_phone(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_e164 TEXT := public._phone_e164(p_phone);
  v_p public.prospects;
  v_src public.client_sources;
BEGIN
  IF NOT (public.admin_has_permission(v_uid, 'canRegisterClients')
          OR public.admin_has_permission(v_uid, 'canEditClients')
          OR public.admin_has_permission(v_uid, 'canManageSales')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF v_e164 IS NULL THEN
    RETURN jsonb_build_object('success', true, 'found', false);
  END IF;
  SELECT p.* INTO v_p
    FROM public.prospects p
   WHERE p.status IN ('new','contacted','interested')
     AND (p.phone_e164 = v_e164
          OR EXISTS (SELECT 1 FROM public.prospect_phones pp WHERE pp.prospect_id = p.id AND pp.phone_e164 = v_e164))
   ORDER BY (p.phone_e164 = v_e164) DESC, p.created_at
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'found', false);
  END IF;
  SELECT * INTO v_src FROM public.client_sources WHERE id = v_p.source_id;

  RETURN jsonb_build_object('success', true, 'found', true,
    'prospect_id', v_p.id,
    'prospect_name', btrim(v_p.first_name || ' ' || coalesce(v_p.last_name, '')),
    'source_id', v_p.source_id, 'source_label', v_src.label, 'source_active', v_src.is_active,
    'first_name', v_p.first_name,
    'last_name', v_p.last_name,
    'company', v_p.company,
    'city', v_p.city,
    'email', v_p.email,
    'gender', v_p.gender,
    'birth_date', to_char(v_p.birth_date, 'YYYY-MM-DD'),
    'phone_e164', v_p.phone_e164,
    'phones', coalesce((
      SELECT jsonb_agg(jsonb_build_object('phone_e164', pp.phone_e164, 'country_iso', pp.country_iso, 'label', pp.label)
                       ORDER BY pp.position, pp.created_at)
        FROM public.prospect_phones pp WHERE pp.prospect_id = v_p.id), '[]'::jsonb));
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Attribution automatique : par l'un QUELCONQUE de ses numéros
-- ─────────────────────────────────────────────────────────────────────────
-- Dernière définition (20261005160000), à l'identique, sauf la recherche du
-- prospect : son principal OU l'un de ses autres numéros (le principal
-- d'abord). Toujours sans erreur ; le déclencheur prospect_match_client
-- (BEFORE INSERT OR UPDATE OF phone, source_id) et son nom, qui le font
-- passer après clients_guard_source et on_client_phone_sync_e164, ne
-- changent pas.
CREATE OR REPLACE FUNCTION public.clients_match_prospect()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.prospects;
BEGIN
  IF NEW.phone_e164 IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.phone_e164 IS NOT DISTINCT FROM OLD.phone_e164
     AND NEW.source_id IS NOT DISTINCT FROM OLD.source_id THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT p.* INTO v_p
      FROM public.prospects p
     WHERE p.status IN ('new','contacted','interested')
       AND (p.phone_e164 = NEW.phone_e164
            OR EXISTS (SELECT 1 FROM public.prospect_phones pp WHERE pp.prospect_id = p.id AND pp.phone_e164 = NEW.phone_e164))
     ORDER BY (p.phone_e164 = NEW.phone_e164) DESC, p.created_at
     LIMIT 1;
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    -- Première origine seulement : à la création, ou quand le compte reçoit
    -- son tout premier numéro. Un client qui change de numéro plus tard ne
    -- se ré-attribue pas.
    IF NEW.source_id IS NULL AND (TG_OP = 'INSERT' OR OLD.phone_e164 IS NULL) THEN
      NEW.source_id := v_p.source_id;
      NEW.source_set_at := now();
      NEW.source_set_by := NULL;
    END IF;

    IF NEW.source_id = v_p.source_id THEN
      UPDATE public.prospects
         SET status = 'won', converted_user_id = NEW.user_id, converted_at = now(),
             status_changed_at = now(), updated_at = now()
       WHERE id = v_p.id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'clients_match_prospect: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Client : sexe et date de naissance
-- ─────────────────────────────────────────────────────────────────────────
-- canEditClients : tout client. canRegisterClients seul (réception,
-- opérations) : seulement le client qu'on a soi-même enregistré
-- (« Enregistré par », posé par la session à la création, jamais réécrit),
-- sans limite de temps — deux champs, journalisés, comme l'origine posée par
-- la réception.
-- p_gender NULL = inchangé, sinon MALE / FEMALE ; p_date_of_birth NULL =
-- inchangée, p_clear_birth_date l'efface. Journalisée.
CREATE OR REPLACE FUNCTION public.admin_set_client_identity(
  p_user_id UUID,
  p_gender TEXT DEFAULT NULL,
  p_date_of_birth DATE DEFAULT NULL,
  p_clear_birth_date BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_can_edit BOOLEAN := public.admin_has_permission(v_uid, 'canEditClients');
  v_clear BOOLEAN := coalesce(p_clear_birth_date, false);
  v_client public.clients;
  v_gender TEXT;
  v_dob DATE;
  v_err TEXT;
BEGIN
  -- Sans aucun des deux droits : refusé avant même de chercher le client.
  IF NOT (v_can_edit OR public.admin_has_permission(v_uid, 'canRegisterClients')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_gender IS NOT NULL AND upper(btrim(p_gender)) NOT IN ('MALE', 'FEMALE') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le sexe : homme ou femme');
  END IF;
  IF NOT v_clear THEN
    v_err := public._birth_date_error(p_date_of_birth);
    IF v_err IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', v_err);
    END IF;
  END IF;

  -- Verrouillée AVANT d'être lue.
  SELECT * INTO v_client FROM public.clients WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client introuvable');
  END IF;
  IF NOT v_can_edit AND v_client.registered_by IS DISTINCT FROM v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  v_gender := CASE WHEN p_gender IS NULL THEN v_client.gender ELSE upper(btrim(p_gender)) END;
  v_dob := CASE WHEN v_clear THEN NULL ELSE coalesce(p_date_of_birth, v_client.date_of_birth) END;

  IF v_gender IS NOT DISTINCT FROM v_client.gender AND v_dob IS NOT DISTINCT FROM v_client.date_of_birth THEN
    RETURN jsonb_build_object('success', true, 'unchanged', true,
                              'gender', v_gender, 'date_of_birth', to_char(v_dob, 'YYYY-MM-DD'));
  END IF;

  UPDATE public.clients
     SET gender = v_gender, date_of_birth = v_dob, updated_at = now()
   WHERE user_id = p_user_id;

  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'set_client_identity', 'client', p_user_id, jsonb_build_object(
    'before', jsonb_build_object('gender', v_client.gender, 'date_of_birth', v_client.date_of_birth),
    'after',  jsonb_build_object('gender', v_gender, 'date_of_birth', v_dob)));

  RETURN jsonb_build_object('success', true, 'gender', v_gender, 'date_of_birth', to_char(v_dob, 'YYYY-MM-DD'));
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 10. Droits
-- ─────────────────────────────────────────────────────────────────────────
-- Internes : jamais appelables depuis l'API (les RPC ci-dessous, SECURITY
-- DEFINER, les appellent avec les droits de leur propriétaire).
REVOKE ALL ON FUNCTION public._birth_date_error(DATE) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._email_error(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._prospect_phone_list(JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._prospect_lock_numbers(TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._prospect_number_conflict(TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._prospect_numbers_error(TEXT[], UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clients_match_prospect() FROM PUBLIC, anon, authenticated;

-- Les actions : membres du personnel connectés ; chaque RPC vérifie la permission.
DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.prospect_create(text, text, text, text, text, text, timestamptz, text[], uuid, text, date, text, jsonb, text, text)',
    'public.prospect_update(uuid, text, text, text, text, text, text, timestamptz, boolean, text[], text, date, boolean, text, jsonb, text, text)',
    'public.prospect_set_status(uuid, text, text)',
    'public.prospect_lookup_phone(text)',
    'public.admin_set_client_identity(uuid, text, date, boolean)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 11. Étiquettes Mola
-- ─────────────────────────────────────────────────────────────────────────
-- Les anciennes signatures de prospect_create / prospect_update ont été
-- supprimées avec leur étiquette : les nouvelles en reçoivent une à jour.
COMMENT ON FUNCTION public.prospect_create(text, text, text, text, text, text, timestamptz, text[], uuid, text, date, text, jsonb, text, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Ajouter un prospect pour un commercial — obligatoires : prénom, nom, sexe (p_gender MALE ou FEMALE), ville au Cameroun, numéro principal (+237…) ; facultatifs : autres numéros (p_phones [{phone_e164, country_iso, label}], neuf au plus), entreprise, date de naissance (AAAA-MM-JJ, 16 à 110 ans), email, intérêts (payments / air / sea), ses plus gros problèmes aujourd''hui (p_pain_points), ce que nous pouvons faire pour l''aider (p_help_needed)"}';
COMMENT ON FUNCTION public.prospect_update(uuid, text, text, text, text, text, text, timestamptz, boolean, text[], text, date, boolean, text, jsonb, text, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Modifier un prospect (NULL = inchangé) : nom, sexe (MALE / FEMALE) et ville ne se vident pas ; numéro principal, autres numéros (p_phones = la liste complète, [] = aucun), entreprise, date de naissance (p_clear_birth_date l''efface), email, ses plus gros problèmes (p_pain_points), ce que nous pouvons faire pour l''aider (p_help_needed), notes, date de relance"}';
COMMENT ON FUNCTION public.prospect_set_status(uuid, text, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageSales","confirm":true,"danger":false,"label":"Changer le statut d''un prospect (new, contacted, interested, lost avec motif)"}';
COMMENT ON FUNCTION public.prospect_lookup_phone(text) IS
  '@mola:{"expose":true,"kind":"read","permission":"canRegisterClients","label":"Ce numéro (principal ou autre) est-il le prospect d''un commercial ? Renvoie son commercial et sa fiche (nom, entreprise, ville, email, sexe, date de naissance, numéros) pour un nouveau client"}';
COMMENT ON FUNCTION public.admin_set_client_identity(uuid, text, date, boolean) IS
  '@mola:{"expose":true,"kind":"write","permission":"canEditClients","confirm":true,"danger":false,"label":"Renseigner le sexe et la date de naissance d''un client","resolve":{"p_user_id":"client"}}';
COMMENT ON FUNCTION public.clients_match_prospect() IS
  '@mola:{"expose":false,"kind":"write","permission":"canEditClients","label":"Interne : attribution d''un nouveau client au commercial qui l''a prospecté (par l''un de ses numéros)"}';
COMMENT ON FUNCTION public._birth_date_error(date) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : date de naissance (16 à 110 ans)"}';
COMMENT ON FUNCTION public._email_error(text) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : forme d''une adresse email"}';
COMMENT ON FUNCTION public._prospect_phone_list(jsonb, text) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : la liste des autres numéros d''un prospect, nettoyée"}';
COMMENT ON FUNCTION public._prospect_lock_numbers(text[]) IS
  '@mola:{"expose":false,"kind":"write","permission":"canProspect","label":"Interne : verrou des numéros saisis (deux saisies simultanées)"}';
COMMENT ON FUNCTION public._prospect_number_conflict(text, uuid, uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : ce numéro est-il celui d''un client ou d''un prospect ouvert"}';
COMMENT ON FUNCTION public._prospect_numbers_error(text[], uuid, uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canProspect","label":"Interne : le premier des autres numéros déjà pris, dit en clair"}';

NOTIFY pgrst, 'reload schema';
