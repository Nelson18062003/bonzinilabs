-- ============================================================================
-- LES PAQUETS AVION SUR LE TÉLÉPHONE DU RÉCEPTIONNAIRE (12/10/2026)
--
-- Le réceptionnaire du bureau (Guangzhou, avion) crée déjà ses paquets de
-- 32 kg et y scanne les colis. Ce qui lui manquait : SAVOIR ce qui attend un
-- paquet. La liste de la console (reception_board) exige canViewCargo, qu'il
-- n'a pas — il n'avait donc que la douchette, colis par colis, de mémoire.
--
--   1. air_package_packable() : les dépôts du BUREAU qui ont encore au moins un
--      colis à emballer (ni dans un paquet, ni chargé, ni parti), au même
--      format que la console (reception_deposit_json). L'écran en tire les
--      colis prêts et ceux à compléter (sans client, pas pesé, dépôt en cours
--      de saisie) avec les mêmes règles que air_package_add_parcel, qui
--      revérifie chaque colis. Et deux compteurs légers pour la pastille de
--      l'onglet Paquets (p_limit = 0 : les compteurs seuls, sans les dépôts).
--      Lecture : canReceiveParcels (la réception) ou canViewCargo (le cargo).
--   2. air_package_json dit QUI a ouvert le paquet (created_by,
--      created_by_name) : un paquet préparé depuis l'ordinateur se reconnaît
--      sur le téléphone, et inversement.
--
-- Aucune table, aucune donnée modifiée. Idempotent. Suppose passée
-- 20261005170000_air_packages.sql. Après : /gen-types.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Un paquet au format JSON : la fiche, ses poids, son expédition, ses colis
--    — et désormais qui l'a ouvert. Même corps que 20261005170000, plus
--    created_by / created_by_name.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.air_package_json(p_package_id UUID, p_with_parcels BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id', k.id, 'package_no', k.package_no, 'status', k.status,
    'air_shipment_id', k.air_shipment_id, 'awb_number', a.awb_number, 'air_status', a.status, 'etd', a.etd, 'flight_no', a.flight_no,
    'max_weight_kg', k.max_weight_kg, 'gross_weight_kg', k.gross_weight_kg,
    'length_cm', k.length_cm, 'width_cm', k.width_cm, 'height_cm', k.height_cm, 'notes', k.notes,
    'net_weight_kg', (SELECT COALESCE(sum(p.weight_kg), 0) FROM public.parcels p WHERE p.air_package_id = k.id),
    'parcel_count',  (SELECT count(*) FROM public.parcels p WHERE p.air_package_id = k.id),
    'client_count',  (SELECT count(DISTINCT d.client_user_id) FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id WHERE p.air_package_id = k.id),
    'checked_count', (SELECT count(*) FROM public.parcels p WHERE p.air_package_id = k.id AND p.checked_in_at IS NOT NULL),
    'missing_count', (SELECT count(*) FROM public.parcels p WHERE p.air_package_id = k.id AND p.condition = 'missing'),
    'sealed_at', k.sealed_at, 'handed_over_at', k.handed_over_at,
    'refused_at', k.refused_at, 'refusal_reason', k.refusal_reason, 'refused_air_shipment_id', k.refused_air_shipment_id,
    'received_at', k.received_at, 'opened_at', k.opened_at, 'created_at', k.created_at, 'updated_at', k.updated_at,
    'created_by', k.created_by,
    -- Une personne a parfois deux lignes de rôle : un seul nom, le même à chaque lecture.
    'created_by_name', (SELECT NULLIF(TRIM(COALESCE(ur.first_name, '') || ' ' || COALESCE(ur.last_name, '')), '')
                          FROM public.user_roles ur WHERE ur.user_id = k.created_by
                         ORDER BY NULLIF(TRIM(COALESCE(ur.first_name, '') || ' ' || COALESCE(ur.last_name, '')), '') NULLS LAST
                         LIMIT 1),
    'parcels', CASE WHEN p_with_parcels THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'seq', p.seq, 'parcel_no', p.parcel_no, 'kind', p.kind, 'weight_kg', p.weight_kg, 'cbm', p.cbm,
        'description', p.description, 'status', p.status, 'photo_path', p.photo_path,
        'checked_in_at', p.checked_in_at, 'warehouse_location', p.warehouse_location, 'condition', p.condition, 'delivered_at', p.delivered_at,
        'deposit_no', d.deposit_no, 'deposit_id', d.id,
        'client', public.reception_client_card(d.client_user_id)
      ) ORDER BY d.client_user_id, d.opened_at, p.seq)
      FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id
      WHERE p.air_package_id = k.id), '[]'::jsonb) ELSE NULL END
  )
  FROM public.air_packages k LEFT JOIN public.air_shipments a ON a.id = k.air_shipment_id
  WHERE k.id = p_package_id;
$fn$;
REVOKE ALL ON FUNCTION public.air_package_json(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.air_package_json(uuid, boolean) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCargo","label":"Sérialiser un paquet avion (helper interne)"}';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Ce qui attend un paquet : les dépôts du bureau qui ont encore un colis à
--    emballer, du plus récent au plus ancien. Un dépôt en cours de saisie en
--    fait partie (ses colis déjà pesés peuvent partir), un dépôt supprimé non.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.air_package_packable(p_limit INTEGER DEFAULT 300)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid   UUID := auth.uid();
  v_limit INTEGER := GREATEST(0, LEAST(COALESCE(p_limit, 300), 1000));
  v_total INTEGER;
  v_rows  JSONB;
  v_ready INTEGER;
  v_fix   INTEGER;
BEGIN
  IF NOT (public.admin_has_permission(v_uid, 'canReceiveParcels') OR public.admin_has_permission(v_uid, 'canViewCargo')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;

  WITH picked AS (
    SELECT d.id, COALESCE(d.closed_at, d.opened_at) AS at
      FROM public.parcel_deposits d
     WHERE d.location = 'office' AND d.status <> 'cancelled'
       AND EXISTS (SELECT 1 FROM public.parcels p
                    WHERE p.deposit_id = d.id AND p.air_package_id IS NULL
                      AND p.shipment_id IS NULL AND p.air_shipment_id IS NULL
                      AND p.status IN ('received','stored')
                      AND p.checked_in_at IS NULL AND p.delivered_at IS NULL)
  ), page AS (
    SELECT id, at FROM picked ORDER BY at DESC LIMIT v_limit
  )
  SELECT (SELECT count(*) FROM picked),
         COALESCE((SELECT jsonb_agg(public.reception_deposit_json(pg.id) ORDER BY pg.at DESC) FROM page pg), '[]'::jsonb)
    INTO v_total, v_rows;

  -- Les compteurs, colis par colis, mêmes règles que l'écran (packRefusal) : prêts = dépôt terminé,
  -- attribué, colis pesé de 32 kg au plus ; à compléter = dépôt en cours, sans client ou colis pas
  -- pesé. Un colis de plus de 32 kg part seul : il n'est ni l'un ni l'autre.
  SELECT count(*) FILTER (WHERE d.status <> 'open' AND d.client_user_id IS NOT NULL AND p.weight_kg > 0 AND p.weight_kg <= 32),
         count(*) FILTER (WHERE d.status = 'open' OR d.client_user_id IS NULL OR p.weight_kg IS NULL OR p.weight_kg <= 0)
    INTO v_ready, v_fix
    FROM public.parcels p JOIN public.parcel_deposits d ON d.id = p.deposit_id
   WHERE d.location = 'office' AND d.status <> 'cancelled' AND p.air_package_id IS NULL
     AND p.shipment_id IS NULL AND p.air_shipment_id IS NULL AND p.status IN ('received','stored')
     AND p.checked_in_at IS NULL AND p.delivered_at IS NULL;

  RETURN jsonb_build_object('success', true, 'total', COALESCE(v_total, 0),
                            'truncated', COALESCE(v_total, 0) > v_limit, 'deposits', v_rows,
                            'ready_count', COALESCE(v_ready, 0), 'to_fix_count', COALESCE(v_fix, 0));
END;
$fn$;
REVOKE ALL ON FUNCTION public.air_package_packable(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.air_package_packable(INTEGER) TO authenticated, service_role;
COMMENT ON FUNCTION public.air_package_packable(integer) IS
  '@mola:{"expose":true,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Les colis avion du bureau qui attendent un paquet de 32 kg (par dépôt : prêts, sans client, pas pesés)"}';

NOTIFY pgrst, 'reload schema';
