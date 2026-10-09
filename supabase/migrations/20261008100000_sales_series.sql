-- ============================================================================
-- Ventes : l'ÉVOLUTION mois par mois (ou semaine par semaine)
--
-- Le 08/10/2026, le directeur : les tableaux de bord des commerciaux ne
-- montrent qu'UN mois, sans aucune évolution. Il veut voir, pour chaque
-- commercial et pour l'équipe, comment évoluent les clients, les prospects,
-- les paiements, les dépôts, le fret avion, les vols et le bateau.
--
-- sales_series(p_from, p_to, p_grain, p_source_id) → une série SANS TROU de
-- périodes (une valeur par mois ou par semaine, zéro compris), les totaux de
-- la plage, ceux de la plage de même longueur juste avant (pour les
-- tendances) et l'entonnoir des prospects — par fiche commercial et pour
-- l'équipe. Lecture seule ; rien n'est modifié.
--
-- PORTÉE (même règle que les tableaux du mois) :
--   · le commercial ne reçoit QUE sa fiche (current_commercial_source_id) ;
--     p_source_id est ignoré — passer la fiche d'un collègue ne lui donne
--     rien de plus ;
--   · la direction (canManageSales) : toutes les fiches « commercial » —
--     les actives, plus les archivées qui ont une activité dans la plage
--     (un chiffre non nul : client arrivé, paiement, dépôt, colis, vol,
--     prospect ajouté, gagné ou perdu) — ou seulement p_source_id (même
--     archivée, même sans activité : elle est demandée) ;
--   · tout autre appelant : refusé, avec le message de _sales_scope_error
--     (« Accès non autorisé », ou « pas encore relié à votre fiche » pour un
--     commercial sans fiche) ; anon n'a pas l'EXECUTE.
--
-- PÉRIODES, à l'heure de Douala (Africa/Douala, UTC+1, sans heure d'été) :
--   'month' = du 1er au 1er, 'week' = du lundi au lundi. p_from est ramené
--   au début de sa période ; p_to est EXCLUSIF, ramené au début de la
--   période suivante s'il tombe au milieu d'une période (p_to = 09/10 en
--   mois → jusqu'au 01/11, octobre compris). Au plus 24 mois ou 26
--   semaines (« Plage trop longue ») ; p_from < p_to ; dates entre 2000 et
--   2100 (une date extrême ne déborde jamais en erreur SQL) ; grain month |
--   week (NULL = month).
--   Un paiement du 30/09 à 23 h 30 UTC est le 1er octobre à Douala : il
--   compte en octobre.
--
-- LES CHIFFRES, par période et par fiche (mêmes définitions que le tableau
-- du mois, _commercial_metrics, pour les mêmes noms) :
--   clients_total   clients dont la fiche est l'origine (clients.source_id),
--                   créés AVANT la fin de la période (un cumul). C'est
--                   l'attribution ACTUELLE : un client confié à un autre
--                   commercial part avec tout son historique (il n'existe
--                   pas d'historique des attributions) ; un client sans
--                   date de création compte depuis toujours.
--   new_clients     clients de la fiche créés dans la période.
--   active_clients  clients de la fiche qui ont, dans la période, un
--                   paiement terminé, un dépôt validé ou un colis reçu.
--   prospects_new   prospects ajoutés (created_at), quel que soit leur
--                   statut aujourd'hui (« À vérifier » compris).
--   prospects_won   devenus clients (status = won, daté par converted_at).
--   prospects_lost  perdus (status = lost, daté par status_changed_at).
--   payments_*      paiements TERMINÉS (completed) de ses clients, datés par
--                   coalesce(processed_at, cash_paid_at, updated_at) ;
--                   montant amount_xaf.
--   deposits_*      dépôts VALIDÉS, datés par validated_at ; montant
--                   coalesce(confirmed_amount_xaf, amount_xaf).
--   air_*           colis reçus au BUREAU de Guangzhou (dépôt « office ») :
--                   nombre et kg ; sea_* : à l'ENTREPÔT (« warehouse ») :
--                   nombre et m³. Datés par parcels.created_at ; colis des
--                   dépôts annulés exclus.
--   flights         vols (air_shipments) DISTINCTS qui emportent au moins
--                   un colis d'un client de la fiche (parcels.air_shipment_id,
--                   colis des dépôts annulés exclus). Un vol est daté par
--                   son DÉPART RÉEL (departed_at), à défaut par la création
--                   de l'expédition (vol encore en préparation) : il compte
--                   dans une seule période, et passe à celle de son départ
--                   quand il part. C'est l'état ACTUEL des chargements : un
--                   paquet refusé à l'aéroport ou retiré de l'expédition
--                   (colis détachés) ne compte plus pour ce vol.
--
-- totals          la plage entière : sommes, sauf clients_total (à la fin
--                 de la plage) et active_clients (clients distincts actifs
--                 au moins une fois dans la plage) ; flights = vols
--                 distincts (un vol n'a qu'une date : c'est aussi la somme).
-- previous_totals même calcul sur la plage de même longueur juste avant
--                 (12 mois → les 12 mois précédents).
-- funnel          les prospects AJOUTÉS dans la plage, par statut ACTUEL
--                 (aucun historique des statuts n'est tenu).
-- team            l'équipe : la somme des fiches RENVOYÉES (points, totals,
--                 previous_totals, funnel). Deux exceptions, pour ne rien
--                 compter deux fois : active_clients compte des clients
--                 distincts (un client n'a qu'une origine : c'est la somme),
--                 et flights des vols DISTINCTS — un même avion qui emporte
--                 les colis des clients de trois commerciaux est UN vol
--                 pour l'équipe.
--
-- Une seule requête ensembliste : les événements de la fenêtre (plage
-- précédente + plage) sont lus une fois, rangés dans leur période par
-- date_trunc à l'heure de Douala, puis agrégés par GROUPING SETS (fiche ×
-- période, fiche × plage, équipe × période, équipe × plage) ; une ligne
-- vide par (fiche, période) garantit les zéros. Aucune boucle par période.
-- Index utilisés (tous existants, aucun à créer) : clients_source_id_idx
-- (les clients des fiches), idx_payments_user_status, idx_deposits_user_status,
-- parcel_deposits_client_idx, parcels_deposit_idx, air_shipments_pkey,
-- prospects_source_status_idx.
--
-- Idempotente (CREATE OR REPLACE ; rejouable, y compris deux fois dans une
-- même transaction). Suppose 20261005160000 (Mes équipes + commerciaux :
-- current_commercial_source_id, _sales_scope_error, admin_has_permission
-- avec canManageSales, prospects), 20261007100000 (statut « À vérifier »)
-- et 20260921150000 (expéditions aériennes, parcels.air_shipment_id).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sales_series(
  p_from DATE,
  p_to DATE,
  p_grain TEXT DEFAULT 'month',
  p_source_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manager BOOLEAN := public.admin_has_permission(auth.uid(), 'canManageSales');
  v_own     UUID := public.current_commercial_source_id();
  v_grain   TEXT := lower(btrim(coalesce(p_grain, 'month')));
  v_all     BOOLEAN := false;   -- la direction, sans fiche choisie
  v_ids     UUID[];
  v_step    INTERVAL;
  v_max     INT;
  v_n       INT;
  v_from    DATE;
  v_to      DATE;
  v_prev    DATE;
  v_from_at TIMESTAMPTZ;
  v_to_at   TIMESTAMPTZ;
  v_prev_at TIMESTAMPTZ;
  v_res     JSONB;
BEGIN
  -- 1. Qui voit quoi. Le commercial : sa fiche, quoi qu'il demande.
  IF v_manager THEN
    IF p_source_id IS NULL THEN
      v_all := true;
      SELECT coalesce(array_agg(s.id), ARRAY[]::UUID[]) INTO v_ids
        FROM public.client_sources s
       WHERE s.kind = 'commercial';
    ELSIF EXISTS (SELECT 1 FROM public.client_sources WHERE id = p_source_id AND kind = 'commercial') THEN
      v_ids := ARRAY[p_source_id];
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Commercial introuvable');
    END IF;
  ELSIF v_own IS NOT NULL THEN
    v_ids := ARRAY[v_own];
  ELSE
    RETURN public._sales_scope_error();
  END IF;

  -- 2. La plage, en périodes entières de Douala.
  IF v_grain NOT IN ('month', 'week') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Découpage inconnu : « month » (mois) ou « week » (semaine)');
  END IF;
  IF p_from IS NULL OR p_to IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le début et la fin de la plage');
  END IF;
  -- Dates extrêmes (infinity, an 300 000…) : refusées avant tout calcul de date.
  IF p_from < DATE '2000-01-01' OR p_to > DATE '2100-01-01' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plage hors limites : entre 2000 et 2100');
  END IF;
  IF p_from >= p_to THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le début de la plage doit précéder sa fin');
  END IF;

  v_step := CASE v_grain WHEN 'month' THEN interval '1 month' ELSE interval '7 days' END;
  v_max  := CASE v_grain WHEN 'month' THEN 24 ELSE 26 END;
  v_from := date_trunc(v_grain, p_from::timestamp)::date;
  v_to   := date_trunc(v_grain, p_to::timestamp)::date;
  IF v_to < p_to THEN
    v_to := (v_to + v_step)::date;
  END IF;
  v_n := CASE v_grain
           WHEN 'month' THEN (extract(year FROM v_to)::int - extract(year FROM v_from)::int) * 12
                             + extract(month FROM v_to)::int - extract(month FROM v_from)::int
           ELSE (v_to - v_from) / 7 END;
  IF v_n > v_max THEN
    RETURN jsonb_build_object('success', false, 'error',
      CASE v_grain WHEN 'month' THEN 'Plage trop longue : 24 mois au plus' ELSE 'Plage trop longue : 26 semaines au plus' END);
  END IF;
  v_prev    := (v_from - v_step * v_n)::date;
  v_from_at := v_from::timestamp AT TIME ZONE 'Africa/Douala';
  v_to_at   := v_to::timestamp AT TIME ZONE 'Africa/Douala';
  v_prev_at := v_prev::timestamp AT TIME ZONE 'Africa/Douala';

  -- 3. Les chiffres.
  WITH src AS (
    SELECT s.id, s.label, s.is_active, s.staff_user_id
      FROM public.client_sources s
     WHERE s.id = ANY(v_ids)
  ), cl AS (
    SELECT c.user_id, c.source_id, c.created_at
      FROM public.clients c
     WHERE c.source_id = ANY(v_ids)
  ), ev AS (
    -- Tout ce qui s'est passé dans la fenêtre [plage précédente, fin de la plage[ :
    -- une ligne par événement (un vol : une ligne par fiche).
    SELECT cl.source_id, NULL::uuid AS user_id, cl.created_at AS at, 'client'::text AS kind,
           NULL::numeric AS qty, NULL::uuid AS flight_id
      FROM cl
     WHERE cl.created_at >= v_prev_at AND cl.created_at < v_to_at
    UNION ALL
    SELECT cl.source_id, p.user_id, coalesce(p.processed_at, p.cash_paid_at, p.updated_at), 'pay',
           p.amount_xaf::numeric, NULL
      FROM public.payments p
      JOIN cl ON cl.user_id = p.user_id
     WHERE p.status = 'completed'
       AND coalesce(p.processed_at, p.cash_paid_at, p.updated_at) >= v_prev_at
       AND coalesce(p.processed_at, p.cash_paid_at, p.updated_at) <  v_to_at
    UNION ALL
    SELECT cl.source_id, d.user_id, d.validated_at, 'dep',
           coalesce(d.confirmed_amount_xaf, d.amount_xaf)::numeric, NULL
      FROM public.deposits d
      JOIN cl ON cl.user_id = d.user_id
     WHERE d.status = 'validated' AND d.validated_at >= v_prev_at AND d.validated_at < v_to_at
    UNION ALL
    SELECT cl.source_id, pd.client_user_id, pa.created_at,
           CASE pd.location WHEN 'office' THEN 'air' ELSE 'sea' END,
           CASE pd.location WHEN 'office' THEN pa.weight_kg ELSE pa.cbm END, NULL
      FROM public.parcels pa
      JOIN public.parcel_deposits pd ON pd.id = pa.deposit_id
      JOIN cl ON cl.user_id = pd.client_user_id
     WHERE pd.status <> 'cancelled' AND pd.location IN ('office', 'warehouse')
       AND pa.created_at >= v_prev_at AND pa.created_at < v_to_at
    UNION ALL
    SELECT DISTINCT cl.source_id, NULL::uuid, coalesce(a.departed_at, a.created_at), 'flight',
           NULL::numeric, a.id
      FROM public.parcels pa
      JOIN public.parcel_deposits pd ON pd.id = pa.deposit_id
      JOIN cl ON cl.user_id = pd.client_user_id
      JOIN public.air_shipments a ON a.id = pa.air_shipment_id
     WHERE pd.status <> 'cancelled'
       AND coalesce(a.departed_at, a.created_at) >= v_prev_at
       AND coalesce(a.departed_at, a.created_at) <  v_to_at
    UNION ALL
    SELECT p.source_id, NULL, p.created_at, 'p_new', NULL, NULL
      FROM public.prospects p
     WHERE p.source_id = ANY(v_ids) AND p.created_at >= v_prev_at AND p.created_at < v_to_at
    UNION ALL
    SELECT p.source_id, NULL, p.converted_at, 'p_won', NULL, NULL
      FROM public.prospects p
     WHERE p.source_id = ANY(v_ids) AND p.status = 'won'
       AND p.converted_at >= v_prev_at AND p.converted_at < v_to_at
    UNION ALL
    SELECT p.source_id, NULL, p.status_changed_at, 'p_lost', NULL, NULL
      FROM public.prospects p
     WHERE p.source_id = ANY(v_ids) AND p.status = 'lost'
       AND p.status_changed_at >= v_prev_at AND p.status_changed_at < v_to_at
  ), keep AS (
    -- Les fiches renvoyées : toutes celles demandées ; sans fiche choisie, les
    -- actives et les archivées qui ont une activité dans la plage.
    SELECT src.*
      FROM src
     WHERE NOT v_all OR src.is_active
        OR src.id IN (SELECT ev.source_id FROM ev WHERE ev.at >= v_from_at)
  ), wper AS (
    SELECT g::date AS period
      FROM generate_series(v_prev::timestamp, v_to::timestamp - v_step, v_step) g
  ), w AS (
    SELECT ev.source_id, ev.user_id, ev.kind, ev.qty, ev.flight_id,
           date_trunc(v_grain, ev.at AT TIME ZONE 'Africa/Douala')::date AS period
      FROM ev
     WHERE ev.source_id IN (SELECT id FROM keep)
    UNION ALL
    -- Une ligne vide par (fiche renvoyée, période) et par période pour
    -- l'équipe (fiche NULL) : chaque groupe existe, à zéro s'il le faut.
    SELECT k.id, NULL, 'tick', NULL, NULL, wper.period
      FROM (SELECT id FROM keep UNION ALL SELECT NULL::uuid) k
      CROSS JOIN wper
  ), agg AS (
    SELECT GROUPING(x.source_id, x.period, x.cur) AS g, x.source_id, x.period, x.cur,
           count(*) FILTER (WHERE x.kind = 'client')::int                                AS new_clients,
           count(DISTINCT x.user_id) FILTER (WHERE x.kind IN ('pay', 'dep', 'air', 'sea'))::int AS active_clients,
           count(*) FILTER (WHERE x.kind = 'p_new')::int                                 AS prospects_new,
           count(*) FILTER (WHERE x.kind = 'p_won')::int                                 AS prospects_won,
           count(*) FILTER (WHERE x.kind = 'p_lost')::int                                AS prospects_lost,
           coalesce(sum(x.qty) FILTER (WHERE x.kind = 'pay'), 0)::bigint                 AS payments_xaf,
           count(*) FILTER (WHERE x.kind = 'pay')::int                                   AS payments_count,
           coalesce(sum(x.qty) FILTER (WHERE x.kind = 'dep'), 0)::bigint                 AS deposits_xaf,
           count(*) FILTER (WHERE x.kind = 'dep')::int                                   AS deposits_count,
           count(*) FILTER (WHERE x.kind = 'air')::int                                   AS air_parcels,
           coalesce(sum(x.qty) FILTER (WHERE x.kind = 'air'), 0)                         AS air_kg,
           count(DISTINCT x.flight_id) FILTER (WHERE x.kind = 'flight')::int             AS flights,
           count(*) FILTER (WHERE x.kind = 'sea')::int                                   AS sea_parcels,
           coalesce(sum(x.qty) FILTER (WHERE x.kind = 'sea'), 0)                         AS sea_cbm
      FROM (SELECT w.*, w.period >= v_from AS cur FROM w) x
     -- g = 0 : fiche × période · 2 : fiche × plage (cur) ou plage précédente ·
     -- 4 : équipe × période · 6 : équipe × plage ou plage précédente.
     -- active_clients et flights comptent des clients et des vols DISTINCTS
     -- à chaque niveau (un client actif en janvier et en mars = 1 sur la plage).
     GROUP BY GROUPING SETS ((x.source_id, x.period, x.cur), (x.source_id, x.cur), (x.period, x.cur), (x.cur))
  ), base AS (
    -- Les clients de chaque fiche renvoyée arrivés AVANT la plage (ou sans date).
    SELECT k.id AS source_id, count(cl.user_id)::int AS n
      FROM keep k
      LEFT JOIN cl ON cl.source_id = k.id AND (cl.created_at IS NULL OR cl.created_at < v_from_at)
     GROUP BY k.id
  ), fig AS (
    SELECT a.g, a.source_id, a.cur,
           to_char(a.period, 'YYYY-MM-DD') AS period,
           (CASE WHEN a.g IN (0, 2) THEN (SELECT b.n FROM base b WHERE b.source_id = a.source_id)
                 ELSE (SELECT coalesce(sum(b.n), 0) FROM base b) END)
           + CASE WHEN a.g IN (0, 4) THEN sum(a.new_clients) OVER (PARTITION BY a.g, a.source_id ORDER BY a.period)
                  WHEN a.cur THEN a.new_clients
                  ELSE 0 END AS clients_total,
           a.new_clients, a.active_clients,
           a.prospects_new, a.prospects_won, a.prospects_lost,
           a.payments_xaf, a.payments_count, a.deposits_xaf, a.deposits_count,
           a.air_parcels, a.air_kg, a.flights, a.sea_parcels, a.sea_cbm
      FROM agg a
     WHERE (a.g = 0 AND a.source_id IS NOT NULL AND a.cur)
        OR (a.g = 2 AND a.source_id IS NOT NULL)
        OR (a.g = 4 AND a.cur)
        OR a.g = 6
  ), fun AS (
    SELECT k.id AS source_id,
           count(p.id)::int                                            AS total,
           count(p.id) FILTER (WHERE p.status = 'new')::int            AS "new",
           count(p.id) FILTER (WHERE p.status = 'contacted')::int      AS contacted,
           count(p.id) FILTER (WHERE p.status = 'interested')::int     AS interested,
           count(p.id) FILTER (WHERE p.status = 'to_verify')::int      AS to_verify,
           count(p.id) FILTER (WHERE p.status = 'won')::int            AS won,
           count(p.id) FILTER (WHERE p.status = 'lost')::int           AS lost
      FROM keep k
      LEFT JOIN public.prospects p
        ON p.source_id = k.id AND p.created_at >= v_from_at AND p.created_at < v_to_at
     GROUP BY k.id
  )
  SELECT jsonb_build_object(
           'success', true,
           'grain', v_grain,
           'from', to_char(v_from, 'YYYY-MM-DD'),
           'to', to_char(v_to, 'YYYY-MM-DD'),
           'periods', (SELECT jsonb_agg(to_char(g::date, 'YYYY-MM-DD') ORDER BY g)
                         FROM generate_series(v_from::timestamp, v_to::timestamp - v_step, v_step) g),
           'sources', coalesce((
             SELECT jsonb_agg(jsonb_build_object(
                      'source_id', k.id,
                      'label', k.label,
                      'is_active', k.is_active,
                      'staff_user_id', k.staff_user_id,
                      'points', (SELECT jsonb_agg(to_jsonb(f) - ARRAY['g', 'source_id', 'cur'] ORDER BY f.period)
                                   FROM fig f WHERE f.g = 0 AND f.source_id = k.id),
                      'totals', (SELECT to_jsonb(f) - ARRAY['g', 'source_id', 'cur', 'period']
                                   FROM fig f WHERE f.g = 2 AND f.source_id = k.id AND f.cur),
                      'previous_totals', (SELECT to_jsonb(f) - ARRAY['g', 'source_id', 'cur', 'period']
                                            FROM fig f WHERE f.g = 2 AND f.source_id = k.id AND NOT f.cur),
                      'funnel', (SELECT to_jsonb(u) - 'source_id' FROM fun u WHERE u.source_id = k.id))
                    ORDER BY (k.staff_user_id IS NULL), k.is_active DESC, lower(k.label), k.id)
               FROM keep k), '[]'::jsonb),
           'team', jsonb_build_object(
             'points', (SELECT jsonb_agg(to_jsonb(f) - ARRAY['g', 'source_id', 'cur'] ORDER BY f.period)
                          FROM fig f WHERE f.g = 4),
             'totals', (SELECT to_jsonb(f) - ARRAY['g', 'source_id', 'cur', 'period']
                          FROM fig f WHERE f.g = 6 AND f.cur),
             'previous_totals', (SELECT to_jsonb(f) - ARRAY['g', 'source_id', 'cur', 'period']
                                   FROM fig f WHERE f.g = 6 AND NOT f.cur),
             'funnel', (SELECT to_jsonb(t) FROM (
                          SELECT coalesce(sum(u.total), 0)::int      AS total,
                                 coalesce(sum(u."new"), 0)::int      AS "new",
                                 coalesce(sum(u.contacted), 0)::int  AS contacted,
                                 coalesce(sum(u.interested), 0)::int AS interested,
                                 coalesce(sum(u.to_verify), 0)::int  AS to_verify,
                                 coalesce(sum(u.won), 0)::int        AS won,
                                 coalesce(sum(u.lost), 0)::int       AS lost
                            FROM fun u) t)))
    INTO v_res;

  RETURN v_res;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Droits : membres du personnel connectés ; la fonction vérifie elle-même
-- le périmètre (commercial : sa fiche ; direction : canManageSales).
-- ─────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.sales_series(DATE, DATE, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sales_series(DATE, DATE, TEXT, UUID) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- Étiquette Mola (le commercial n'a pas Mola : la direction seulement)
-- ─────────────────────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.sales_series(date, date, text, uuid) IS
  '@mola:{"expose":true,"kind":"read","permission":"canManageSales","label":"Évolution des ventes par commercial, mois par mois ou semaine par semaine (clients, prospects, paiements, dépôts, fret avion, vols, bateau)"}';

NOTIFY pgrst, 'reload schema';
