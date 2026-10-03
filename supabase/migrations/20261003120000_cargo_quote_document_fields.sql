-- ============================================================================
-- Cargo · Le devis refait sur le modèle de la packing list client
--
-- Le devis PDF reprend la structure de la packing list client : dimensions,
-- fournisseur, conteneur ou vol. Le client y retrouve, colis par colis, ce
-- qu'il connaît déjà de sa packing list (L × l × h, bordereau du transporteur
-- chinois, conteneur ou LTA), et en tête du document qui a envoyé la
-- marchandise, qui l'a reçue à Guangzhou, et où elle est chargée.
--
-- `cargo_quote_json` ne disait rien de tout ça : seulement le poids et le
-- volume de chaque colis. Ce fichier la redéfinit en AJOUTANT des clés —
-- aucune clé existante ne change de nom, de valeur ni d'ordre de tri :
--
--   · en tête : supplier_kind, supplier_name (le fournisseur du dépôt),
--     received_by_name (le réceptionnaire, comme pour un encaissement) ;
--   · containers : les conteneurs (cargo_shipments) où sont chargés des colis
--     du dépôt, chacun une fois, triés par numéro — B/L, armateur, navire,
--     voyage, POL / POD, départ et arrivée (le réel si l'armateur l'a
--     mesuré, sinon l'annoncé) ;
--   · flights : les vols (air_shipments) de la même façon, triés par LTA ;
--   · par ligne : length_cm, width_cm, height_cm, courier_waybill,
--     container_number, awb_number (comme reception_deposit_json).
--
-- Un colis supprimé (reception_remove_parcel) est effacé de `parcels` avec
-- sa ligne de devis : il ne peut plus faire apparaître un conteneur ou un vol.
--
-- Même signature, même type de retour, même étiquette @mola (expose:false),
-- mêmes REVOKE : toutes les RPC cargo_quote_* qui la renvoient (devis,
-- encaissement, facture, portefeuille) portent les nouvelles clés sans
-- changer elles-mêmes.
--
-- Idempotent (CREATE OR REPLACE). Suppose 20260921150000_cargo_air_shipments.sql
-- et 20260922090000_cargo_suppliers_accounts.sql passées.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cargo_quote_json(p_quote_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id', q.id, 'quote_no', q.quote_no, 'deposit_id', q.deposit_id, 'status', q.status, 'currency', q.currency,
    'total_xaf', q.total_xaf, 'amount_paid_xaf', q.amount_paid_xaf,
    'balance_xaf', GREATEST(q.total_xaf - q.amount_paid_xaf, 0),
    'notes', q.notes,
    'sent_at', q.sent_at, 'paid_at', q.paid_at,
    'invoice_no', q.invoice_no, 'invoiced_at', q.invoiced_at,
    'created_at', q.created_at, 'updated_at', q.updated_at,
    'deposit_no', d.deposit_no, 'location', d.location, 'opened_at', d.opened_at, 'closed_at', d.closed_at,
    'client', public.reception_client_card(d.client_user_id),
    -- Le fournisseur et le réceptionnaire du dépôt.
    'supplier_kind', d.supplier_kind, 'supplier_name', d.supplier_name,
    'received_by_name', (SELECT TRIM(COALESCE(ur.first_name,'') || ' ' || COALESCE(ur.last_name,'')) FROM public.user_roles ur WHERE ur.user_id = d.received_by),
    -- Où sont chargés les colis du dépôt : chaque conteneur une fois, chaque vol une fois.
    'containers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'container_number', cs.container_number, 'bl_number', cs.bl_number, 'carrier', cs.carrier,
        'vessel_name', cs.vessel_name, 'voyage', cs.voyage, 'pol_name', cs.pol_name, 'pod_name', cs.pod_name,
        'etd', COALESCE(cs.etd_actual::date, cs.etd_promised),
        'eta', COALESCE(cs.eta_carrier::date, cs.eta_promised)
      ) ORDER BY cs.container_number)
      FROM public.cargo_shipments cs
      WHERE cs.id IN (SELECT pc.shipment_id FROM public.parcels pc WHERE pc.deposit_id = d.id AND pc.shipment_id IS NOT NULL)), '[]'::jsonb),
    'flights', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'awb_number', a.awb_number, 'airline', a.airline, 'flight_no', a.flight_no,
        'origin', a.origin, 'destination', a.destination,
        'etd', COALESCE(a.departed_at::date, a.etd),
        'eta', COALESCE(a.arrived_at::date, a.eta)
      ) ORDER BY a.awb_number)
      FROM public.air_shipments a
      WHERE a.id IN (SELECT pa.air_shipment_id FROM public.parcels pa WHERE pa.deposit_id = d.id AND pa.air_shipment_id IS NOT NULL)), '[]'::jsonb),
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'seq', l.seq, 'kind', l.kind, 'label', l.label, 'basis', l.basis,
        'quantity', l.quantity, 'unit_price_xaf', l.unit_price_xaf, 'amount_xaf', l.amount_xaf,
        'parcel_id', l.parcel_id, 'parcel_no', p.parcel_no, 'parcel_seq', p.seq, 'kind_of_parcel', p.kind,
        'description', p.description, 'weight_kg', p.weight_kg, 'cbm', p.cbm,
        -- Les mesures et le suivi du colis, comme sur la packing list.
        'length_cm', p.length_cm, 'width_cm', p.width_cm, 'height_cm', p.height_cm,
        'courier_waybill', p.courier_waybill,
        'container_number', (SELECT cs.container_number FROM public.cargo_shipments cs WHERE cs.id = p.shipment_id),
        'awb_number', (SELECT a.awb_number FROM public.air_shipments a WHERE a.id = p.air_shipment_id)
      ) ORDER BY l.seq)
      FROM public.parcel_quote_lines l LEFT JOIN public.parcels p ON p.id = l.parcel_id
      WHERE l.quote_id = q.id), '[]'::jsonb),
    'payments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pm.id, 'receipt_no', pm.receipt_no, 'amount_xaf', pm.amount_xaf, 'method', pm.method, 'place', pm.place,
        'paid_at', pm.paid_at, 'reference', pm.reference, 'proof_path', pm.proof_path, 'note', pm.note,
        'received_by', pm.received_by,
        'received_by_name', (SELECT TRIM(COALESCE(ur.first_name,'') || ' ' || COALESCE(ur.last_name,'')) FROM public.user_roles ur WHERE ur.user_id = pm.received_by),
        'created_at', pm.created_at, 'cancelled_at', pm.cancelled_at, 'cancel_reason', pm.cancel_reason
      ) ORDER BY pm.paid_at, pm.created_at)
      FROM public.parcel_quote_payments pm WHERE pm.quote_id = q.id), '[]'::jsonb)
  )
  FROM public.parcel_quotes q JOIN public.parcel_deposits d ON d.id = q.deposit_id
  WHERE q.id = p_quote_id;
$fn$;
COMMENT ON FUNCTION public.cargo_quote_json(UUID) IS
  '@mola:{"expose":false,"kind":"read","permission":"canViewCargo","confirm":false,"danger":false,"label":"Sérialiser un devis avec ses paiements (helper interne)"}';
REVOKE ALL ON FUNCTION public.cargo_quote_json(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cargo_quote_json(UUID) FROM anon, authenticated;
