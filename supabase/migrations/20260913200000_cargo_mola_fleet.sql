-- ============================================================
-- Bonzini Cargo — donner le module à Mola.
--
-- Avant : Mola voyait quatre actions cargo (chercher une référence, ajouter
-- une boîte, la retirer, lancer une synchro) mais n'avait aucune LECTURE
-- structurée de la flotte — « où en est la boîte de GAUSS ? » passait par
-- une requête SQL libre, sans les phrases ni les règles (retard, prochaine
-- chose à faire) que l'app calcule. Et marquer le fret payé ou le télex
-- reçu, les deux gestes du quotidien, n'existaient pas en RPC : la
-- politique FOR UPDATE laisse un UPDATE PostgREST direct, mais Mola
-- n'exécute que des RPC étiquetées.
--
-- Trois RPC, toutes gardées par admin_has_permission (jamais is_admin seul) :
--   cargo_fleet_status(p_client)          lecture, canViewCargo
--   cargo_set_freight_paid(p_id, p_paid)  écriture, canManageCargo, confirmation
--   cargo_set_telex(p_id, p_received)     écriture, canManageCargo, confirmation
-- Le résolveur « cargo » de la passerelle accepte un numéro de conteneur,
-- un bill of lading ou le nom du client à la place de l'UUID.
--
-- Après application : /gen-types.
-- ============================================================

-- ── Lecture : la flotte, dans les mots de l'app ─────────────────────────
CREATE OR REPLACE FUNCTION public.cargo_fleet_status(p_client text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.admin_has_permission(auth.uid(), 'canViewCargo')
      THEN jsonb_build_object('success', false, 'error', 'Accès non autorisé')
    ELSE jsonb_build_object(
      'success', true,
      'count', count(*),
      'shipments', coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id,
        'client', s.client_label,
        'container', s.container_number,
        'bl', s.bl_number,
        'carrier', s.carrier,
        'status', s.status,
        'from', s.pol_name,
        'to', s.pod_name,
        'vessel', s.vessel_name,
        'voyage', s.voyage,
        'departed_on', coalesce(s.etd_actual::date, s.etd_promised),
        'arrives_on', coalesce(s.eta_carrier::date, s.eta_promised),
        'arrival_source', CASE WHEN s.eta_carrier IS NOT NULL THEN 'armateur' WHEN s.eta_promised IS NOT NULL THEN 'transitaire' ELSE NULL END,
        'promised_on', s.eta_promised,
        'days_until_arrival', CASE WHEN coalesce(s.eta_carrier::date, s.eta_promised) IS NOT NULL
                                   THEN coalesce(s.eta_carrier::date, s.eta_promised) - current_date END,
        'delay_days', CASE WHEN s.eta_carrier IS NOT NULL AND s.eta_promised IS NOT NULL
                           THEN greatest(0, s.eta_carrier::date - s.eta_promised) ELSE 0 END,
        'freight_usd', s.freight_usd,
        'freight_paid', s.freight_paid,
        'telex_released', s.telex_released,
        'free_time_ends_on', s.free_time_ends_on,
        'arrival_notice_at', s.arrival_notice_at,
        'customs_cleared_at', s.customs_cleared_at,
        'delivery_order_at', s.delivery_order_at,
        'gate_out_at', s.gate_out_at,
        'empty_returned_at', s.empty_returned_at,
        'last_event', s.last_event_label,
        'last_event_at', s.last_event_at,
        'goods', s.goods_description,
        'packages_count', s.packages_count,
        'notes', s.notes,
        -- La prochaine chose à faire, dans l'ordre de l'app (src/lib/cargo/todo.ts).
        'next_action', CASE
          WHEN s.status = 'DELIVERED' THEN NULL
          WHEN NOT s.freight_paid THEN 'Régler le fret au transitaire'
          WHEN NOT s.telex_released THEN 'Obtenir le télex release'
          WHEN s.status = 'ARRIVED' AND s.customs_cleared_at IS NULL THEN 'Faire la douane'
          WHEN s.status = 'ARRIVED' AND s.gate_out_at IS NULL THEN 'Sortir la boîte du port'
          ELSE NULL END
      ) ORDER BY
        CASE WHEN s.status = 'DELIVERED' THEN 1 ELSE 0 END,
        coalesce(s.eta_carrier::date, s.eta_promised) NULLS LAST
      ), '[]'::jsonb)
    ) END
  FROM public.cargo_shipments s
  WHERE p_client IS NULL
     OR s.client_label ILIKE '%' || p_client || '%'
     OR s.container_number ILIKE '%' || p_client || '%'
     OR s.bl_number ILIKE '%' || p_client || '%';
$$;

REVOKE ALL ON FUNCTION public.cargo_fleet_status(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cargo_fleet_status(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.cargo_fleet_status(text) IS
  '@mola:{"expose":true,"kind":"read","permission":"canViewCargo","label":"Etat de la flotte cargo : ou en est chaque conteneur (arrivee, retard, fret, telex, prochaine chose a faire). p_client filtre par client, numero de conteneur ou B/L."}';

-- ── Écriture : le fret est payé / ne l'est pas ──────────────────────────
CREATE OR REPLACE FUNCTION public.cargo_set_freight_paid(p_shipment_id uuid, p_paid boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.cargo_shipments%ROWTYPE;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_row FROM public.cargo_shipments WHERE id = p_shipment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conteneur introuvable');
  END IF;
  UPDATE public.cargo_shipments SET freight_paid = coalesce(p_paid, true) WHERE id = p_shipment_id;
  RETURN jsonb_build_object(
    'success', true,
    'container', v_row.container_number,
    'client', v_row.client_label,
    'freight_usd', v_row.freight_usd,
    'freight_paid', coalesce(p_paid, true),
    'message', CASE WHEN coalesce(p_paid, true)
      THEN format('Fret marqué payé pour %s (%s).', v_row.container_number, v_row.client_label)
      ELSE format('Fret marqué non payé pour %s (%s).', v_row.container_number, v_row.client_label) END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cargo_set_freight_paid(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cargo_set_freight_paid(uuid, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.cargo_set_freight_paid(uuid, boolean) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Marquer le fret d''un conteneur paye (ou non paye avec p_paid=false)","resolve":{"p_shipment_id":"cargo"}}';

-- ── Écriture : le télex est reçu / ne l'est pas ─────────────────────────
CREATE OR REPLACE FUNCTION public.cargo_set_telex(p_shipment_id uuid, p_received boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.cargo_shipments%ROWTYPE;
BEGIN
  IF NOT public.admin_has_permission(auth.uid(), 'canManageCargo') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé');
  END IF;
  SELECT * INTO v_row FROM public.cargo_shipments WHERE id = p_shipment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conteneur introuvable');
  END IF;
  UPDATE public.cargo_shipments SET telex_released = coalesce(p_received, true) WHERE id = p_shipment_id;
  RETURN jsonb_build_object(
    'success', true,
    'container', v_row.container_number,
    'client', v_row.client_label,
    'telex_released', coalesce(p_received, true),
    'message', CASE WHEN coalesce(p_received, true)
      THEN format('Télex reçu pour %s (%s) : la boîte pourra sortir du port.', v_row.container_number, v_row.client_label)
      ELSE format('Télex marqué non reçu pour %s (%s).', v_row.container_number, v_row.client_label) END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cargo_set_telex(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cargo_set_telex(uuid, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.cargo_set_telex(uuid, boolean) IS
  '@mola:{"expose":true,"kind":"write","permission":"canManageCargo","confirm":true,"danger":false,"label":"Marquer le telex release d''un conteneur recu (ou non recu avec p_received=false)","resolve":{"p_shipment_id":"cargo"}}';

NOTIFY pgrst, 'reload schema';
