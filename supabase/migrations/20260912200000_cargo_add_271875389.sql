-- ============================================================
-- Bonzini Cargo — ajout du conteneur MRSU9909331 (B/L 271875389).
--
-- Pourquoi à la main : la recherche dans l'app est restée bloquée sur
-- « on interroge Maersk… » le 12/09/2026. La référence était pourtant bonne —
-- l'API Maersk Track & Trace répond en HTTP 200 avec dix jalons. Ce qui
-- manquait, c'est l'edge function `cargo-lookup` côté serveur ; tant qu'elle
-- n'est pas déployée, `net.http_post` part dans le vide et la ligne de
-- recherche reste « pending » sans que personne ne le sache.
--
-- Données reprises TELLES QUELLES de l'API armateur (pas de saisie
-- approximative) : conteneur, navire, IMO, voyage, départ, arrivée.
--
-- ⚠ CE CONTENEUR EST DÉJÀ ARRIVÉ. Déchargé à Kribi le 27/08/2026 à 01:54.
-- Au 12/09 il est donc au port depuis seize jours. Avec la franchise de
-- treize jours constatée sur le dossier ECMU5839181, elle serait terminée
-- depuis le 09/09 — les surestaries courent. La date de fin de franchise
-- n'est PAS inscrite ici : elle se lit sur l'avis d'arrivée, et l'inventer
-- ferait mentir le compte à rebours. À saisir dans l'onglet Douane.
--
-- Idempotent : ON CONFLICT sur le numéro de conteneur.
-- ============================================================

INSERT INTO public.cargo_shipments
  (client_label, carrier, bl_number, container_number,
   pol_name, pol_unlocode, pod_name, pod_unlocode,
   etd_actual, eta_carrier,
   vessel_name, vessel_imo, voyage,
   status, last_event_at, last_event_label, notes)
VALUES
  ('À RENSEIGNER', 'MAERSK', '271875389', 'MRSU9909331',
   'Nansha', 'CNNSA', 'Kribi', 'CMKBI',
   '2026-06-20T00:49:00Z', '2026-08-26T13:05:00Z',
   'CMA CGM AMERIGO VESPUCCI', '9454395', '623W',
   'ARRIVED', '2026-08-27T01:54:00Z', 'Conteneur déchargé à Kribi',
   'Ajouté à la main le 12/09/2026 depuis l''API Maersk : la recherche dans l''app restait bloquée (edge function cargo-lookup non déployée). Déchargé le 27/08 — vérifier la fin de franchise sur l''avis d''arrivée.')
ON CONFLICT (container_number) DO NOTHING;

-- Les dix jalons de l'armateur, pour que l'onglet Suivi ne soit pas vide.
INSERT INTO public.cargo_events
  (shipment_id, carrier_event_id, event_type, event_code, classifier, event_time, location_name, unlocode, vessel_name, vessel_imo, voyage)
SELECT s.id, v.carrier_event_id, v.event_type, v.event_code, 'ACT', v.event_time::timestamptz, v.location_name, v.unlocode,
       'CMA CGM AMERIGO VESPUCCI', '9454395', '623W'
FROM public.cargo_shipments s
CROSS JOIN (VALUES
  ('271875389-CONF', 'SHIPMENT',  'CONF', '2026-06-09T08:45:00+08', NULL,                             NULL),
  ('271875389-GTOT', 'EQUIPMENT', 'GTOT', '2026-06-11T07:58:00+08', 'GZ Oceangate Container Terminal', 'CNNSA'),
  ('271875389-GTIN', 'EQUIPMENT', 'GTIN', '2026-06-12T08:47:00+08', 'GZ Oceangate Container Terminal', 'CNNSA'),
  ('271875389-LOAD', 'EQUIPMENT', 'LOAD', '2026-06-19T11:06:00+08', 'GZ Oceangate Container Terminal', 'CNNSA'),
  ('271875389-DEPA', 'TRANSPORT', 'DEPA', '2026-06-20T00:49:00+08', 'GZ Oceangate Container Terminal', 'CNNSA'),
  ('271875389-RECE', 'SHIPMENT',  'RECE', '2026-06-22T05:40:00+08', NULL,                             NULL),
  ('271875389-DRFT', 'SHIPMENT',  'DRFT', '2026-06-22T05:41:00+08', NULL,                             NULL),
  ('271875389-ISSU', 'SHIPMENT',  'ISSU', '2026-06-22T05:41:00+08', NULL,                             NULL),
  ('271875389-ARRI', 'TRANSPORT', 'ARRI', '2026-08-26T13:05:00+01', 'Kribi Port',                      'CMKBI'),
  ('271875389-DISC', 'EQUIPMENT', 'DISC', '2026-08-27T01:54:00+01', 'Kribi Port',                      'CMKBI')
) AS v(carrier_event_id, event_type, event_code, event_time, location_name, unlocode)
WHERE s.container_number = 'MRSU9909331'
ON CONFLICT (shipment_id, carrier_event_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
