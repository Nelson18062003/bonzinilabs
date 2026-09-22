-- ============================================================================
-- À passer SEUL dans le SQL Editor (projet fmhsohrgbznqmcvqktjw) : copie exacte de
-- supabase/migrations/20260921180000_warehouse_simplify.sql. Idempotent.
-- Suppose migrations/20260921_warehouse_destination.sql (phase 4) déjà passé.
-- ============================================================================
-- Cargo · Entrepôt de Douala — la refonte « une question par écran »
--
-- L'app « /w » a été simplifiée sur le modèle de la réception de Guangzhou :
-- pointer (liste → un colis → le bilan), remettre (scanner → les colis → qui
-- emporte → la signature → le bon). Le bilan du pointage a besoin d'UN geste
-- de plus : déclarer manquants, d'un coup, les colis jamais vus à l'arrivée.
--
-- Idempotent. Suppose 20260921170000_cargo_client_notifications.sql passée.
-- ============================================================================

-- Déclarer plusieurs colis manquants d'un coup (fin de pointage). Un colis
-- déjà remis ou déjà pointé présent n'est pas touché : on ne perd jamais un
-- pointage par un geste de masse.
CREATE OR REPLACE FUNCTION public.warehouse_flag_missing_many(p_parcel_ids UUID[], p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE v_uid UUID := auth.uid(); v_n INTEGER; v_nos TEXT;
BEGIN
  IF NOT public.admin_has_permission(v_uid, 'canReceiveAtDestination') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  IF p_parcel_ids IS NULL OR array_length(p_parcel_ids, 1) IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Aucun colis choisi'); END IF;
  SELECT array_agg(DISTINCT x) INTO p_parcel_ids FROM unnest(p_parcel_ids) x WHERE x IS NOT NULL;
  PERFORM 1 FROM public.parcels WHERE id = ANY(p_parcel_ids) FOR UPDATE;
  WITH done AS (
    UPDATE public.parcels SET condition = 'missing', condition_note = NULLIF(TRIM(p_note), ''), checked_in_at = NULL, checked_in_by = NULL, updated_at = now()
    WHERE id = ANY(p_parcel_ids)
      AND (shipment_id IS NOT NULL OR air_shipment_id IS NOT NULL)
      AND status IN ('shipped','arrived') AND checked_in_at IS NULL AND delivered_at IS NULL
      AND (EXISTS (SELECT 1 FROM public.air_shipments a WHERE a.id = parcels.air_shipment_id AND a.status IN ('ARRIVED','DELIVERED'))
        OR EXISTS (SELECT 1 FROM public.cargo_shipments cs WHERE cs.id = parcels.shipment_id AND cs.status IN ('ARRIVED','DELIVERED')))
    RETURNING id, parcel_no
  ) SELECT count(*), string_agg(parcel_no, ', ' ORDER BY parcel_no) INTO v_n, v_nos FROM done;
  IF v_n > 0 THEN
    INSERT INTO public.admin_audit_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (v_uid, 'warehouse_parcels_missing', 'parcel', p_parcel_ids[1],
            jsonb_build_object('description', v_n || ' colis manquant(s) à l''arrivée à Douala : ' || v_nos || COALESCE(' — ' || TRIM(p_note), ''), 'parcel_nos', v_nos, 'count', v_n, 'note', p_note));
  END IF;
  RETURN jsonb_build_object('success', true, 'flagged', v_n);
END;
$fn$;
COMMENT ON FUNCTION public.warehouse_flag_missing_many(UUID[], TEXT) IS
  '@mola:{"expose":true,"kind":"write","permission":"canReceiveAtDestination","confirm":true,"danger":true,"label":"Déclarer manquants, d''un coup, les colis jamais vus à l''arrivée à Douala"}';
