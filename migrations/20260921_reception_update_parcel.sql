-- ============================================================================
-- À passer SEUL dans le SQL Editor (projet fmhsohrgbznqmcvqktjw) : copie exacte de
-- supabase/migrations/20260921110000_reception_update_parcel.sql. Idempotent.
-- ============================================================================

-- ============================================================================
-- Réception : corriger ou compléter un colis
--
-- Un colis « incomplet » (sans poids, sans dimensions, sans photo) restait
-- incomplet pour toujours : on ne pouvait que l'ajouter ou le retirer, et
-- seulement tant que le dépôt était ouvert. Or la facture a besoin du poids
-- et du m³, et on pèse parfois après coup.
--
-- reception_update_parcel : le réceptionnaire qui a reçu le dépôt (ou le
-- cargo) modifie un colis, dépôt ouvert OU fermé, tant que le colis n'est
-- pas dans une boîte. Si le dépôt est fermé, ses totaux sont recalculés et
-- la correction est journalisée. Idempotent.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reception_update_parcel(
  p_parcel_id UUID,
  p_kind TEXT DEFAULT NULL,
  p_weight_kg NUMERIC DEFAULT NULL,
  p_length_cm NUMERIC DEFAULT NULL,
  p_width_cm NUMERIC DEFAULT NULL,
  p_height_cm NUMERIC DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_courier_waybill TEXT DEFAULT NULL,
  p_photo_path TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_dep public.parcel_deposits;
  v_par public.parcels;
  v_count INTEGER; v_kg NUMERIC; v_cbm NUMERIC;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveParcels') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_par FROM public.parcels WHERE id = p_parcel_id;
  IF v_par.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Colis introuvable'); END IF;
  SELECT * INTO v_dep FROM public.parcel_deposits WHERE id = v_par.deposit_id FOR UPDATE;
  -- Qui : l'auteur du dépôt, ou le cargo. Sur quelle ligne : un colis pas encore dans une boîte.
  IF NOT (v_dep.received_by = v_uid OR public.admin_has_permission(v_uid, 'canManageCargo')) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt ne vous appartient pas');
  END IF;
  IF v_dep.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce dépôt est annulé');
  END IF;
  IF v_par.shipment_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce colis est déjà dans une boîte : il ne se modifie plus ici');
  END IF;
  IF p_kind IS NOT NULL AND p_kind NOT IN ('carton','bag','bale','roll','pallet','other') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type de colis inconnu');
  END IF;
  IF COALESCE(p_weight_kg, 0) < 0 OR COALESCE(p_length_cm, 0) < 0 OR COALESCE(p_width_cm, 0) < 0 OR COALESCE(p_height_cm, 0) < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Poids et dimensions doivent être positifs');
  END IF;

  UPDATE public.parcels
     SET kind            = COALESCE(p_kind, kind),
         weight_kg       = p_weight_kg,
         length_cm       = p_length_cm,
         width_cm        = p_width_cm,
         height_cm       = p_height_cm,
         description     = NULLIF(TRIM(COALESCE(p_description, '')), ''),
         courier_waybill = NULLIF(TRIM(COALESCE(p_courier_waybill, '')), ''),
         photo_path      = COALESCE(NULLIF(TRIM(p_photo_path), ''), photo_path),
         updated_at      = now()
   WHERE id = v_par.id;

  IF v_dep.status = 'closed' THEN
    -- Les totaux figés à la fermeture suivent la correction, et on garde une trace.
    SELECT count(*), COALESCE(sum(weight_kg), 0), COALESCE(sum(cbm), 0) INTO v_count, v_kg, v_cbm
    FROM public.parcels WHERE deposit_id = v_dep.id;
    UPDATE public.parcel_deposits
       SET parcel_count = v_count, total_weight_kg = v_kg, total_cbm = v_cbm, updated_at = now()
     WHERE id = v_dep.id;
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (v_uid, 'update_parcel', 'parcel_deposit', v_dep.id,
            jsonb_build_object('description', 'Colis ' || v_par.parcel_no || ' corrigé après fermeture', 'parcel_id', v_par.id,
                               'before', jsonb_build_object('weight_kg', v_par.weight_kg, 'cbm', v_par.cbm, 'description', v_par.description),
                               'after', jsonb_build_object('weight_kg', p_weight_kg, 'length_cm', p_length_cm, 'width_cm', p_width_cm, 'height_cm', p_height_cm, 'description', p_description)));
  ELSE
    UPDATE public.parcel_deposits SET updated_at = now() WHERE id = v_dep.id;
  END IF;

  RETURN jsonb_build_object('success', true, 'deposit', public.reception_deposit_json(v_dep.id));
END;
$fn$;
COMMENT ON FUNCTION public.reception_update_parcel(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveParcels","confirm":true,"danger":false,"label":"Corriger ou compléter un colis reçu (poids, dimensions, description, photo)"}';
