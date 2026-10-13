-- ============================================================================
-- RÉCEPTION — DEUX GARDES QUE L'ÉCRAN NE POUVAIT PAS TENIR SEUL, ET DES POIDS À LA FRANÇAISE (13/10/2026)
--
-- Relecture de la navigation de l'app réception (/r) :
--
--   1. reception_deposit_json dit si le devis du dépôt est ENGAGÉ
--      (`quote_engaged` : envoyé au client, encaissé, réglé ou facturé — la
--      raison, ou NULL ; reception_quote_engaged). reception_update_parcel
--      refuse déjà au réceptionnaire de corriger un colis d'un dépôt terminé
--      dont le devis est engagé ; l'écran ne le savait pas et faisait remplir
--      quatre étapes pour finir sur ce refus. Il ouvre désormais les photos.
--      Même corps que 20261012100000_cargo_documents.sql, plus quote_engaged.
--
--   2. air_package_add_parcel refuse un colis dont le dépôt est encore EN
--      SAISIE (status = 'open'). La règle n'existait que dans les listes
--      (packRefusal → deposit_open, compteurs de air_package_packable) : la
--      douchette, ou Mola, emballait quand même — et le réceptionnaire qui
--      saisissait le dépôt trouvait son colis verrouillé. C'est la seule
--      fonction qui pose air_package_id. Même corps que
--      20261005170000_air_packages.sql, plus ce refus. Le dépôt reste lu sans
--      verrou, comme avant : le verrouiller après le colis inverserait l'ordre
--      de reception_update_parcel (dépôt puis colis) et risquerait un interblocage.
--      Le poids du refus « passerait à … kg » s'écrit avec une virgule.
--
--   3. air_package_seal : même corps, les poids de ses refus avec une virgule
--      (« Le paquet pèse 32,4 kg », plus « 32.4 kg »).
--
-- Aucune table, aucune donnée modifiée. Idempotent. Droits et étiquettes
-- Mola inchangés (réécrits à l'identique par sûreté). Après : /gen-types.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Le dépôt, tel que les écrans le lisent — et si son devis est engagé.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reception_deposit_json(p_deposit_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id',                   d.id,
    'deposit_no',           d.deposit_no,
    'client',               public.reception_client_card(d.client_user_id),
    'location',             d.location,
    'brought_by',           d.brought_by,
    'representative_name',  d.representative_name,
    'representative_phone', d.representative_phone,
    'supplier_kind',        d.supplier_kind,
    'supplier_name',        d.supplier_name,
    'supplier_contact',     d.supplier_contact,
    'supplier_phone',       d.supplier_phone,
    'supplier_email',       d.supplier_email,
    'supplier_wechat',      d.supplier_wechat,
    'supplier_address',     d.supplier_address,
    'status',               d.status,
    'received_by',          d.received_by,
    'received_by_name',     (SELECT TRIM(COALESCE(ur.first_name,'') || ' ' || COALESCE(ur.last_name,'')) FROM public.user_roles ur WHERE ur.user_id = d.received_by),
    'opened_at',            d.opened_at,
    'closed_at',            d.closed_at,
    'updated_at',           d.updated_at,
    'cancelled_at',         d.cancelled_at,
    'cancel_reason',        d.cancel_reason,
    'cancelled_by_name',    (SELECT TRIM(COALESCE(ur.first_name,'') || ' ' || COALESCE(ur.last_name,'')) FROM public.user_roles ur WHERE ur.user_id = d.cancelled_by),
    'parcel_count',         (SELECT count(*) FROM public.parcels p WHERE p.deposit_id = d.id),
    'total_weight_kg',      (SELECT COALESCE(sum(p.weight_kg), 0) FROM public.parcels p WHERE p.deposit_id = d.id),
    'total_cbm',            (SELECT COALESCE(sum(p.cbm), 0) FROM public.parcels p WHERE p.deposit_id = d.id),
    'notes',                d.notes,
    -- Le devis déjà vu par le client ou par l'argent (raison), ou NULL : le réceptionnaire ne corrige plus.
    'quote_engaged',        public.reception_quote_engaged(d.id),
    'parcels',              COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'seq', p.seq, 'parcel_no', p.parcel_no, 'kind', p.kind,
        'weight_kg', p.weight_kg, 'length_cm', p.length_cm, 'width_cm', p.width_cm, 'height_cm', p.height_cm,
        'cbm', p.cbm, 'description', p.description, 'courier_waybill', p.courier_waybill,
        'photo_path', p.photo_path,
        'photos', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', ph.id, 'path', ph.path, 'position', ph.position, 'created_at', ph.created_at)
                           ORDER BY ph.position, ph.created_at)
          FROM public.parcel_photos ph WHERE ph.parcel_id = p.id), '[]'::jsonb),
        'status', p.status, 'shipment_id', p.shipment_id,
        'container_number', (SELECT cs.container_number FROM public.cargo_shipments cs WHERE cs.id = p.shipment_id),
        'air_shipment_id', p.air_shipment_id,
        'air_package_id', p.air_package_id,
        'package_no', (SELECT k.package_no FROM public.air_packages k WHERE k.id = p.air_package_id),
        'awb_number', (SELECT a.awb_number FROM public.air_shipments a WHERE a.id = p.air_shipment_id),
        'reception_condition', p.reception_condition, 'reception_condition_note', p.reception_condition_note,
        'checked_in_at', p.checked_in_at, 'warehouse_location', p.warehouse_location, 'condition', p.condition, 'condition_note', p.condition_note,
        'delivered_at', p.delivered_at, 'release_id', p.release_id,
        'release_no', (SELECT r.release_no FROM public.parcel_releases r WHERE r.id = p.release_id),
        'created_at', p.created_at, 'updated_at', p.updated_at
      ) ORDER BY p.seq)
      FROM public.parcels p WHERE p.deposit_id = d.id), '[]'::jsonb)
  )
  FROM public.parcel_deposits d
  WHERE d.id = p_deposit_id;
$fn$;

REVOKE ALL ON FUNCTION public.reception_deposit_json(UUID) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.reception_deposit_json(uuid) IS
  '@mola:{"expose":false,"kind":"read","permission":"canReceiveParcels","confirm":false,"danger":false,"label":"Sérialiser un dépôt de colis, avec ses photos et le paquet de chaque colis (helper interne)"}';

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Mettre un colis dans un paquet : jamais celui d'un dépôt en saisie.
-- ─────────────────────────────────────────────────────────────────────────
-- Un colis avion (dépôt du bureau, TERMINÉ), pesé, avec son client, qui n'est
-- ni parti ni déjà emballé ; le paquet reste sous son poids maximal (32 kg).
CREATE OR REPLACE FUNCTION public.air_package_add_parcel(p_package_id UUID, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_k public.air_packages;
  v_p public.parcels;
  v_d public.parcel_deposits;
  v_no TEXT := public.parcel_code(p_code);
  v_net NUMERIC;
  v_other TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_k FROM public.air_packages WHERE id = p_package_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Paquet introuvable'); END IF;
  IF v_k.status <> 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le paquet ' || v_k.package_no || ' est fermé : rouvrez-le pour y ajouter un colis');
  END IF;
  IF v_no IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce n''est pas une étiquette de colis (RC-000000-00)');
  END IF;
  SELECT * INTO v_p FROM public.parcels WHERE parcel_no = v_no FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Colis ' || v_no || ' introuvable'); END IF;
  IF v_p.air_package_id = v_k.id THEN
    RETURN jsonb_build_object('success', true, 'already', true, 'parcel_no', v_no, 'package', public.air_package_json(v_k.id, true));
  END IF;
  IF v_p.air_package_id IS NOT NULL THEN
    SELECT package_no INTO v_other FROM public.air_packages WHERE id = v_p.air_package_id;
    RETURN jsonb_build_object('success', false, 'error', 'Le colis ' || v_no || ' est déjà dans le paquet ' || v_other);
  END IF;
  SELECT * INTO v_d FROM public.parcel_deposits WHERE id = v_p.deposit_id;
  IF v_d.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le dépôt ' || v_d.deposit_no || ' est supprimé : ce colis ne part pas');
  END IF;
  -- Un dépôt encore en saisie : son réceptionnaire peut encore peser, photographier,
  -- retirer ce colis. Emballé, le colis serait verrouillé sous ses doigts.
  IF v_d.status = 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le dépôt ' || v_d.deposit_no || ' est en cours de saisie : terminez-le d''abord');
  END IF;
  IF v_d.location <> 'office' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le colis ' || v_no || ' part en bateau (reçu à l''entrepôt) : il ne va pas dans un paquet avion');
  END IF;
  IF v_d.client_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le colis ' || v_no || ' n''a pas encore de client : attribuez son dépôt d''abord');
  END IF;
  IF v_p.weight_kg IS NULL OR v_p.weight_kg <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le colis ' || v_no || ' n''est pas pesé : pesez-le d''abord');
  END IF;
  IF v_p.shipment_id IS NOT NULL OR v_p.air_shipment_id IS NOT NULL OR v_p.status NOT IN ('received','stored')
     OR v_p.checked_in_at IS NOT NULL OR v_p.delivered_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le colis ' || v_no || ' est déjà chargé ou parti');
  END IF;
  SELECT COALESCE(sum(weight_kg), 0) INTO v_net FROM public.parcels WHERE air_package_id = v_k.id;
  IF v_net + v_p.weight_kg > v_k.max_weight_kg THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Le paquet passerait à ' || replace(trim(to_char(v_net + v_p.weight_kg, 'FM999990.0')), '.', ',') || ' kg : ' || trim(to_char(v_k.max_weight_kg, 'FM990')) || ' kg au plus. Commencez un autre paquet.',
      'over', true);
  END IF;

  UPDATE public.parcels SET air_package_id = v_k.id, updated_at = now() WHERE id = v_p.id;
  UPDATE public.air_packages SET updated_at = now() WHERE id = v_k.id;
  RETURN jsonb_build_object('success', true, 'already', false, 'parcel_no', v_no, 'weight_kg', v_p.weight_kg,
                            'client', public.reception_client_card(v_d.client_user_id),
                            'package', public.air_package_json(v_k.id, true));
END;
$fn$;

REVOKE ALL ON FUNCTION public.air_package_add_parcel(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.air_package_add_parcel(UUID, TEXT) TO authenticated, service_role;
COMMENT ON FUNCTION public.air_package_add_parcel(uuid, text) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Mettre un colis avion (RC-…) dans un paquet ouvert"}';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Fermer un paquet : même corps que 20261005170000, les poids des refus
--    écrits à la française (« 32,4 kg », plus « 32.4 kg »).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.air_package_seal(
  p_package_id UUID,
  p_gross_weight_kg NUMERIC,
  p_length_cm NUMERIC DEFAULT NULL,
  p_width_cm NUMERIC DEFAULT NULL,
  p_height_cm NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_k public.air_packages; v_net NUMERIC; v_n INTEGER;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_k FROM public.air_packages WHERE id = p_package_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Paquet introuvable'); END IF;
  IF v_k.status <> 'open' THEN RETURN jsonb_build_object('success', false, 'error', 'Ce paquet est déjà fermé'); END IF;
  SELECT count(*), COALESCE(sum(weight_kg), 0) INTO v_n, v_net FROM public.parcels WHERE air_package_id = v_k.id;
  IF v_n = 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Le paquet est vide'); END IF;
  IF p_gross_weight_kg IS NULL OR p_gross_weight_kg <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le poids pesé du paquet');
  END IF;
  IF p_gross_weight_kg > v_k.max_weight_kg THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Le paquet pèse ' || replace(trim(to_char(p_gross_weight_kg, 'FM999990.0')), '.', ',') || ' kg : ' || trim(to_char(v_k.max_weight_kg, 'FM990')) || ' kg au plus. Retirez un colis.');
  END IF;
  IF p_gross_weight_kg < v_net - 0.5 THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Le poids pesé (' || replace(trim(to_char(p_gross_weight_kg, 'FM999990.0')), '.', ',') || ' kg) est inférieur à celui des colis (' || replace(trim(to_char(v_net, 'FM999990.0')), '.', ',') || ' kg) : vérifiez la pesée');
  END IF;
  IF (p_length_cm IS NOT NULL AND (p_length_cm <= 0 OR p_length_cm > 400))
     OR (p_width_cm IS NOT NULL AND (p_width_cm <= 0 OR p_width_cm > 400))
     OR (p_height_cm IS NOT NULL AND (p_height_cm <= 0 OR p_height_cm > 400)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dimensions invalides');
  END IF;
  UPDATE public.air_packages
     SET status = 'sealed', gross_weight_kg = p_gross_weight_kg,
         length_cm = p_length_cm, width_cm = p_width_cm, height_cm = p_height_cm,
         sealed_at = now(), sealed_by = v_uid, updated_at = now()
   WHERE id = v_k.id;
  INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_uid, 'air_package_seal', 'air_package', v_k.id,
          jsonb_build_object('description', 'Paquet ' || v_k.package_no || ' fermé : ' || v_n || ' colis, ' || p_gross_weight_kg || ' kg', 'package_no', v_k.package_no, 'parcels', v_n, 'gross_weight_kg', p_gross_weight_kg, 'net_weight_kg', v_net));
  RETURN jsonb_build_object('success', true, 'package', public.air_package_json(v_k.id, true));
END;
$fn$;
REVOKE ALL ON FUNCTION public.air_package_seal(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.air_package_seal(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated, service_role;
COMMENT ON FUNCTION public.air_package_seal(uuid, numeric, numeric, numeric, numeric) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Fermer un paquet avion : poids pesé (32 kg au plus) et dimensions"}';

NOTIFY pgrst, 'reload schema';
