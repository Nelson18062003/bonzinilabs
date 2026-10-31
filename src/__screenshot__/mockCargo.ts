/**
 * Données Cargo figées pour le harnais de capture (SCREENSHOT_MOCK=1) :
 * les cinq dossiers du 11/09/2026, les trois navires, une recherche.
 */
import type { CargoCost, CargoDocument, CargoEvent, CargoLookup, CargoPackage, CargoShipment, CargoVesselPosition } from '@/lib/cargo/model';
import type { Json } from '@/integrations/supabase/types';
import type { CargoDocFolder } from '@/lib/cargo/documents';
import type { CargoParty, CargoShipmentPartyWithParty } from '@/lib/cargo/parties';
import type { CargoStep } from '@/lib/cargo/steps';

const base = {
  client_id: null, container_iso: '45G1', pol_name: 'Nansha', pol_unlocode: 'CNNSA', pod_name: 'Kribi', pod_unlocode: 'CMKBI',
  freight_paid: false, telex_released: false, last_synced_at: '2026-09-11T20:40:00Z', sync_error: null, notes: null,
  created_at: '2026-09-11T20:00:00Z', updated_at: '2026-09-11T20:00:00Z', last_event_label: 'Navire parti',
  arrival_notice_at: null, besc_number: null, customs_cleared_at: null, customs_declaration_ref: null,
  delivery_order_at: null, empty_returned_at: null, free_time_ends_on: null, gate_out_at: null,
  goods_description: 'Téléphones et accessoires', gross_weight_kg: 22170, packages_count: 80, freight_note: null,
  eta_manual: null, eta_manual_at: null, eta_manual_note: null, route_calls: [] as Json[],
} as const;

/* Dates relatives au jour de la capture : la flotte est toujours « en mer » (maquettes v2, lot 04). */
const DAY = 86_400_000;
const T0 = Date.now();
const iso = (days: number) => new Date(T0 + days * DAY).toISOString();
const day = (days: number) => iso(days).slice(0, 10);

const SHIPMENTS: CargoShipment[] = [
  { ...base, id: '1', client_label: 'Aïcha Diallo', carrier: 'COSCO', bl_number: 'COSU6120974', container_number: 'CSNU6120974', pol_name: 'Nansha', pol_unlocode: 'CNNSA', pod_name: 'Douala', pod_unlocode: 'CMDLA', etd_promised: day(6), eta_promised: day(48), etd_actual: null, eta_carrier: null, vessel_name: null, vessel_imo: null, vessel_mmsi: null, voyage: null, freight_usd: 4650, status: 'UNKNOWN', last_event_at: null, last_event_label: null, last_synced_at: null },
  { ...base, freight_note: null, freight_paid: true,
    eta_manual: null, besc_number: null,
    route_calls: [
      { id: 'nsa', name: 'Nansha', unlocode: 'CNNSA', atd: iso(-19), note: null },
      { id: 'tpp', name: 'Tanjung Pelepas', unlocode: 'MYTPP', ata: iso(-12), atd: iso(-11), note: null },
      { id: 'lfw', name: 'Lomé', unlocode: 'TGLFW', ata: iso(-1), eta: day(-1), etd: day(3), note: null },
      { id: 'dla', name: 'Douala', unlocode: 'CMDLA', eta: day(7), note: null },
    ],
    id: '2', client_label: 'Groupage', client_id: 'u5', carrier: 'MAERSK', bl_number: '274428633', container_number: 'MIEU3611115', pod_name: 'Douala', pod_unlocode: 'CMDLA', etd_promised: day(-19), eta_promised: day(3), etd_actual: iso(-19), eta_carrier: iso(7), vessel_name: 'MAERSK KENSINGTON', vessel_imo: '9454412', vessel_mmsi: '215930000', voyage: '642W', freight_usd: 6550, status: 'AT_SEA', last_event_at: iso(-1), last_event_label: 'Arrivé à Lomé', last_synced_at: iso(-0.12) },
  { ...base, id: '3', client_label: 'Samuel Nkoulou', carrier: 'MSC', bl_number: 'MEDUJ8812044', container_number: 'MSCU4417092', pod_name: 'Douala', pod_unlocode: 'CMDLA', etd_promised: day(-25), eta_promised: day(11), etd_actual: iso(-25), eta_carrier: iso(13), vessel_name: 'MSC AURORA', vessel_imo: '9938121', vessel_mmsi: '256615000', voyage: '633W', freight_usd: 5950, freight_paid: true, telex_released: false, status: 'AT_SEA', last_event_at: iso(-25) },
  { ...base, id: '4', client_label: 'Groupage', carrier: 'CMA_CGM', bl_number: 'GGZ3133535', container_number: 'CMAU5530218', pod_name: 'Kribi', pod_unlocode: 'CMKBI', etd_promised: day(-30), eta_promised: day(5), etd_actual: iso(-30), eta_carrier: iso(5), vessel_name: 'CMA CGM PRIDE', vessel_imo: '9924429', vessel_mmsi: '229997000', voyage: '634W', freight_usd: 5650, freight_paid: true, telex_released: true, besc_number: 'MI2661716', status: 'AT_SEA', last_event_at: iso(-30) },
  { ...base, id: '5', client_label: 'Ibrahim Touré', carrier: 'MAERSK', bl_number: '275926916', container_number: 'MRKU2208671', pod_name: 'Douala', pod_unlocode: 'CMDLA', etd_promised: day(-22), eta_promised: day(9), etd_actual: iso(-22), eta_carrier: iso(9), vessel_name: 'MAERSK KENSINGTON', vessel_imo: '9454412', vessel_mmsi: '215930000', voyage: '642W', freight_usd: 5750, freight_paid: true, telex_released: false, status: 'AT_SEA', last_event_at: iso(-22) },
  { ...base, id: '6', client_label: 'Jean-Paul Mbarga', carrier: 'CMA_CGM', bl_number: 'GGZ3140118', container_number: 'CMAU7741026', pod_name: 'Douala', pod_unlocode: 'CMDLA', etd_promised: day(-14), eta_promised: day(20), etd_actual: iso(-14), eta_carrier: iso(20), vessel_name: 'CMA CGM PRIDE', vessel_imo: '9924429', vessel_mmsi: '229997000', voyage: '634W', freight_usd: 6100, freight_paid: false, status: 'AT_SEA', last_event_at: iso(-14) },
  { ...base, id: '7', client_label: 'Groupage', carrier: 'MAERSK', bl_number: '276001523', container_number: 'MRKU7730415', pod_name: 'Douala', pod_unlocode: 'CMDLA', etd_promised: day(-3), eta_promised: day(31), etd_actual: iso(-3), eta_carrier: iso(31), vessel_name: 'MAERSK KOLKATA', vessel_imo: '9938122', vessel_mmsi: '256615001', voyage: '642W', freight_usd: 6300, freight_paid: true, telex_released: false, status: 'AT_SEA', last_event_at: iso(-3) },
];

const POSITIONS: CargoVesselPosition[] = [
  { vessel_imo: '9454412', vessel_mmsi: '215930000', vessel_name: 'MAERSK KENSINGTON', latitude: 6.13, longitude: 1.28, speed_kn: 0.2, course_deg: null, destination: 'TGLFW', eta: null, reported_at: iso(-0.12), source: 'manual', updated_at: iso(-0.12), note: 'Port de Lomé' },
  { vessel_imo: '9938121', vessel_mmsi: '256615000', vessel_name: 'MSC AURORA', latitude: 4.9, longitude: -2.1, speed_kn: 15.1, course_deg: 92, destination: 'CMDLA', eta: iso(13), reported_at: iso(-0.3), source: 'manual', updated_at: iso(-0.3), note: null },
  { vessel_imo: '9924429', vessel_mmsi: '229997000', vessel_name: 'CMA CGM PRIDE', latitude: 3.4, longitude: 6.2, speed_kn: 17.4, course_deg: 120, destination: 'CMKBI', eta: iso(5), reported_at: iso(-0.2), source: 'manual', updated_at: iso(-0.2), note: null },
];

const ev = (id: string, code: string, type: string, time: string, classifier = 'ACT', location: string | null = 'GZ Oceangate Container Terminal', vessel: string | null = null): CargoEvent => ({
  id, shipment_id: '2', carrier_event_id: id, event_type: type, event_code: code, classifier, event_time: time, location_name: location,
  unlocode: 'CNNSA', latitude: null, longitude: null, vessel_name: vessel, vessel_imo: vessel ? '9454412' : null, voyage: vessel ? '631W' : null, raw: code === 'GTOT' ? { emptyIndicatorCode: 'EMPTY' } : code === 'GTIN' ? { emptyIndicatorCode: 'LADEN' } : null, created_at: time,
});
const EVENTS: CargoEvent[] = [
  ev('e1', 'CONF', 'SHIPMENT', '2026-07-16T09:10:43Z', 'ACT', null),
  ev('e2', 'GTOT', 'EQUIPMENT', '2026-08-01T18:42:00Z'),
  ev('e3', 'GTIN', 'EQUIPMENT', '2026-08-02T18:24:00Z'),
  ev('e4', 'RECE', 'SHIPMENT', '2026-08-11T03:46:11Z', 'ACT', null),
  ev('e5', 'DRFT', 'SHIPMENT', '2026-08-11T03:46:22Z', 'ACT', null),
  ev('e6', 'LOAD', 'EQUIPMENT', '2026-08-15T15:25:00Z', 'ACT', 'GZ Oceangate Container Terminal', 'CMA CGM LAPEROUSE'),
  ev('e7', 'DEPA', 'TRANSPORT', '2026-08-15T23:38:00Z', 'ACT', 'GZ Oceangate Container Terminal', 'CMA CGM LAPEROUSE'),
  ev('e8', 'ARRI', 'TRANSPORT', '2026-10-03T08:00:00Z', 'EST', 'Kribi Port', 'CMA CGM LAPEROUSE'),
  ev('e9', 'ARRI', 'TRANSPORT', '2026-10-07T08:00:00Z', 'EST', 'Kribi Port', 'CMA CGM LAPEROUSE'),
  ev('e10', 'DEPA', 'TRANSPORT', '2026-08-15T23:38:00Z', 'ACT', 'GZ Oceangate Container Terminal', 'CMA CGM LAPEROUSE'),
];

const LOOKUP: CargoLookup = {
  id: 'lk1', reference: '274428633', reference_type: 'BL', carrier: 'MAERSK', status: 'done', error: null, requested_by: null,
  created_at: '2026-09-11T22:00:00Z', completed_at: '2026-09-11T22:00:04Z',
  result: {
    carrier: 'MAERSK', reference: '274428633', bl_number: '274428633', fetched_at: '2026-09-11T22:00:04Z',
    containers: [{
      number: 'MIEU3611115', iso: '45G1', status: 'AT_SEA', vessel: { name: 'CMA CGM LAPEROUSE', imo: '9454412' }, voyage: '631W',
      pol: { name: 'GZ Oceangate Container Terminal', unlocode: 'CNNSA' }, pod: { name: 'Kribi Port', unlocode: 'CMKBI' },
      etd_actual: '2026-08-15T23:38:00Z', eta_carrier: '2026-10-11T10:00:00Z', last_event_at: '2026-08-15T23:38:00Z', last_event_label: 'Navire parti',
      events: EVENTS.map((e) => ({ id: e.id, type: e.event_type, code: e.event_code, classifier: e.classifier, time: e.event_time, label: e.event_code === 'DEPA' ? 'Navire parti' : e.event_code === 'ARRI' ? 'Arrivée prévue du navire' : e.event_code === 'LOAD' ? 'Chargé à bord' : e.event_code === 'GTIN' ? 'Boîte pleine rendue au terminal' : e.event_code === 'GTOT' ? 'Boîte vide retirée du terminal' : e.event_code === 'CONF' ? 'Réservation confirmée' : e.event_code === 'RECE' ? "Instructions d'expédition reçues" : 'Bill of lading en brouillon', location: e.location_name, unlocode: e.unlocode, lat: null, lon: null, vessel: e.vessel_name, imo: e.vessel_imo, voyage: e.voyage })),
    }],
  },
};

const ok = <T,>(data: T) => ({ data, isLoading: false, error: null, refetch: async () => undefined });

/** Colis d'exemple : une packing list plausible pour un 40' High Cube. */
const lotBase = { shipment_id: '2', weight_kg: null, supplier: null, created_by: null, created_at: '2026-10-03T10:00:00Z', updated_at: '2026-10-03T10:00:00Z', client_id: null } as const;
const veh = (id: string, label: string, L: number, W: number, H: number, cbm: number, position: number, hs: string): CargoPackage => ({
  ...lotBase, id, label, kind: 'VEHICLE', qty: 1, length_cm: L, width_cm: W, height_cm: H, cbm, stackable: false, note: null, position, owner_label: null, hs_code: hs,
});
const vol = (id: string, label: string, kind: string, qty: number, cbm: number, position: number, owner: string | null = null): CargoPackage => ({
  ...lotBase, id, label, kind, qty, length_cm: null, width_cm: null, height_cm: null, cbm, stackable: true, note: null, position, owner_label: owner, hs_code: null,
});
/** Le vrai contenu de MIEU3611115 : 3 véhicules + 11 lignes d'effets connues au volume. */
const PACKAGES: CargoPackage[] = [
  veh('p1', 'Toyota Yaris 2009', 375, 169.5, 154.5, 9.82, 1, '8703.23.10.9900'),
  veh('p2', 'Toyota RAV4 2014', 457, 184.5, 171.5, 14.081, 2, '8703.23.90.9100'),
  veh('p3', 'Haval H6 2016', 464.9, 185.2, 171, 14.723, 3, '8703.22.10.9100'),
  vol('p4', 'Verres de lunettes (眼镜片)', 'CARTON', 13, 4, 4), vol('p5', 'Climatiseur (空调)', 'CARTON', 1, 0.25, 5),
  vol('p6', 'Chaises (椅子)', 'CARTON', 5, 0.345, 6), vol('p7', 'Pièces mécaniques', 'CARTON', 1, 0.245, 7),
  vol('p8', 'Machine à laver (洗衣机)', 'CARTON', 1, 1.56, 8), vol('p9', 'Meuble de rangement (柜子)', 'CARTON', 1, 2.5, 9),
  vol('p10', 'Étendoirs à linge (晾衣架)', 'BUNDLE', 50, 0.9, 10), vol('p11', 'Vêtements (衣服)', 'BAG', 1, 5.98, 11),
  vol('p12', 'Tôles (锌板)', 'BUNDLE', 7, 3.2, 12, 'Olivier Yaoundé'), vol('p13', 'Chaussures (鞋子)', 'CARTON', 1, 0.94, 13),
  vol('p14', 'Hauts, vestes (上衣)', 'CARTON', 1, 0.015, 14),
];

const noop = () => ({ mutate: () => undefined, mutateAsync: async () => undefined, isPending: false });

export const useCargoShipments = () => ok(SHIPMENTS);
export const useCargoShipment = (id: string | null) => ok(SHIPMENTS.find((s) => s.id === id) ?? null);
export const useCargoVesselPositions = () => ok(POSITIONS);
export const useCargoEvents = (id: string | null) => ok(id === '2' ? EVENTS : []);
export const useUpdateCargoShipment = noop;
export const useRemoveCargoShipment = noop;
export const useMarkShipmentArrived = noop;
export const useUnmarkShipmentArrived = noop;
export const useRequestCargoSync = noop;
export const useSetVesselPosition = noop;
export const useRequestCargoLookup = noop;
export const useCargoLookup = (id: string | null) => ok(id ? LOOKUP : undefined);
export const useRecentCargoLookups = () => ok([LOOKUP]);
export const useAddCargoShipment = noop;
export const useCreateCargoShipmentManual = noop;
const COSTS: CargoCost[] = [
  { id: 'c1', shipment_id: '2', kind: 'FREIGHT', amount: 6550, currency: 'USD', label: null, incurred_on: '2026-08-12', invoice_ref: 'FAC-2026-0812', note: null, paid: true, paid_on: '2026-08-14', payee: 'KASSUMAYE PARTNER SARL', created_by: null, created_at: '2026-08-12T09:00:00Z', updated_at: '2026-08-12T09:00:00Z' },
  { id: 'c2', shipment_id: '2', kind: 'BESC', amount: 85_000, currency: 'XAF', label: null, incurred_on: '2026-08-20', invoice_ref: null, note: null, paid: true, paid_on: '2026-09-30', payee: 'SOFT CENTRAL LAB', created_by: null, created_at: '2026-08-20T09:00:00Z', updated_at: '2026-08-20T09:00:00Z' },
  { id: 'c3', shipment_id: '2', kind: 'TRANSIT', amount: 450_000, currency: 'XAF', label: 'Honoraires Transimex', incurred_on: null, invoice_ref: null, note: null, paid: false, paid_on: null, payee: 'Cynthia AKAH', created_by: null, created_at: '2026-09-01T09:00:00Z', updated_at: '2026-09-01T09:00:00Z' },
];
export const useCargoCosts = (id: string | null) => ok(id === '2' ? COSTS : ([] as CargoCost[]));
export const useCargoPackages = (id: string | null) => ok(id === '2' ? PACKAGES : []);
export const useAddCargoPackage = noop;
export const useUpdateCargoPackage = noop;
export const useDeleteCargoPackage = noop;
export const useAddCargoCost = noop;
export const useUpdateCargoCost = noop;
export const useDeleteCargoCost = noop;
export const useCargoClient = (id: string | null) => ok(id === 'u5' ? { id: 'u5', first_name: 'Fatou', last_name: 'Ndiaye', company_name: 'Ndiaye & Fils', phone: '+237 690 55 66 77', email: 'fatou@ndiaye-fils.cm', city: 'Douala', country: 'Cameroun', kyc_verified: true, customer_code: 'BZ-135561' } : null);
export const useCargoFleetDocuments = () => ok({} as Record<string, never[]>);
export const useCargoClientOptions = () => ok([] as { id: string; first_name: string; last_name: string; company_name: string | null }[]);
export const useUploadCargoDocument = noop;
export const useDeleteCargoDocument = noop;
export const openCargoDocument = async () => undefined;

/* ── Classeur (refonte du 03/10/2026) ── */
const folder = (id: string, title: string, category: string, expected_count: number | null, position: number, note: string | null = null): CargoDocFolder => ({
  id, shipment_id: '2', title, category, expected_count, position, note, created_by: null, created_at: '2026-10-03T10:00:00Z', updated_at: '2026-10-03T10:00:00Z',
});
const FOLDERS: CargoDocFolder[] = [
  folder('f1', 'Bill of lading Maersk 274428633 (originaux)', 'BL', 3, 1, 'Chargeur : KASSUMAYE PARTNER SARL'),
  folder('f2', 'Télex release', 'TELEX', 1, 2, 'Pas encore reçu'),
  folder('f3', 'BESC MI2661716', 'BESC', 1, 3, 'Validé le 30/09/2026'),
  folder('f4', "Certificats d'identification CICQ", 'CERTIFICATE', 3, 4),
  folder('f5', "Attestation d'immatriculation DGI", 'TAX', 1, 5),
];
const doc = (id: string, folder_id: string | null, kind: string, file_name: string, mime: string, title: string | null = null, note: string | null = null): CargoDocument => ({
  id, shipment_id: '2', kind, file_name, storage_path: `2/${id}-${file_name}`, mime_type: mime, size_bytes: 180_000 + id.length * 9000,
  uploaded_by: null, created_at: '2026-10-01T18:34:00Z', updated_at: '2026-10-01T18:34:00Z', folder_id, cost_id: null, title, note,
});
const DOCS: CargoDocument[] = [
  doc('d1', 'f1', 'BL', 'bl-verify-copy.jpg', 'image/jpeg', 'B/L, copie « verify »', 'Photo reçue le 01/10'),
  doc('d2', 'f3', 'BESC', 'MI2661716_20261001.pdf', 'application/pdf', 'BESC validé'),
  doc('d3', 'f4', 'CERTIFICATE', 'cicq-4025-haval.jpg', 'image/jpeg', 'A/4025 · Haval H6'),
  doc('d4', 'f4', 'CERTIFICATE', 'cicq-4026-rav4.jpg', 'image/jpeg', 'A/4026 · Toyota RAV4'),
  doc('d5', 'f4', 'CERTIFICATE', 'cicq-4027-yaris.jpg', 'image/jpeg', 'A/4027 · Toyota Yaris'),
  doc('d6', null, 'OTHER', 'capture-atlas.png', 'image/png'),
  { ...doc('d7', null, 'COST', 'recu-besc.jpg', 'image/jpeg', 'Reçu BESC'), cost_id: 'c2' },
  { ...doc('d8', null, 'COST', 'facture-fret.pdf', 'application/pdf', 'Facture de fret'), cost_id: 'c1' },
];
export const useCargoDocuments = (id: string | null) => ok(id === '2' ? DOCS : ([] as CargoDocument[]));
export const useCargoDocFolders = (id: string | null) => ok(id === '2' ? FOLDERS : ([] as CargoDocFolder[]));
export const useCargoDocumentUrls = () => ok({} as Record<string, string>);
export const useCreateCargoDocFolders = noop;
export const useUpdateCargoDocFolder = noop;
export const useDeleteCargoDocFolder = noop;
export const useUpdateCargoDocument = noop;
export const useUploadCargoDocuments = noop;
export const downloadCargoDocument = async () => undefined;

/* ── Intervenants ── */
const party = (id: string, name: string, extra: Partial<CargoParty> = {}): CargoParty => ({
  id, name, contact_name: null, phone: null, whatsapp: null, email: null, city: null, country: null, note: null,
  created_by: null, created_at: '2026-10-03T10:00:00Z', updated_at: '2026-10-03T10:00:00Z', ...extra,
});
const link = (id: string, role: string, p: CargoParty, note: string | null, position: number): CargoShipmentPartyWithParty => ({
  id, shipment_id: '2', party_id: p.id, role, note, position, created_by: null, created_at: '2026-10-03T10:00:00Z', updated_at: '2026-10-03T10:00:00Z', party: p,
});
const KASS = party('pa1', 'KASSUMAYE PARTNER SARL', { contact_name: 'Eric', whatsapp: '+86 138 0000 0000' });
const CYN = party('pa2', 'Cynthia AKAH', { country: 'Cameroun', phone: '+237 690 00 00 00' });
const NGB = party('pa3', 'NORTON GAUSS BONZINI SARL', { city: 'Douala (Bépanda)', country: 'Cameroun' });
const LINKS: CargoShipmentPartyWithParty[] = [
  link('l1', 'FORWARDER', KASS, 'Booking, camion et douane d’export à Nansha.', 1),
  link('l2', 'SHIPPER', KASS, 'Détient les 3 originaux du B/L : le télex doit venir de lui.', 2),
  link('l3', 'DECLARANT', CYN, 'Mandatée pour BESC, CIVIC et déclaration.', 3),
  link('l4', 'CONSIGNEE', NGB, null, 4),
];
export const useCargoShipmentParties = (id: string | null) => ok(id === '2' ? LINKS : ([] as CargoShipmentPartyWithParty[]));
export const useCargoParties = () => ok([KASS, CYN, NGB]);
export const useAddShipmentParty = noop;
export const useUpdateShipmentParty = noop;
export const useRemoveShipmentParty = noop;

/* ── Étapes de douane ── */
const step = (id: string, key: string, title: string, phase: string, position: number, extra: Partial<CargoStep> = {}): CargoStep => ({
  id, shipment_id: '2', key, title, phase, status: 'todo', due_on: null, done_on: null, reference: null, note: null, folder_id: null, position,
  created_by: null, created_at: '2026-10-04T08:00:00Z', updated_at: '2026-10-04T08:00:00Z', ...extra,
});
const STEPS: CargoStep[] = [
  step('s1', 'BESC', 'BESC', 'before', 1, { status: 'done', done_on: '2026-09-30', reference: 'MI2661716', folder_id: 'f3', note: 'Validé par SOFT CENTRAL LAB. Corrections demandées (RAV4, Yaris, code du Haval).' }),
  step('s2', 'CIVIC', 'CIVIC des véhicules (SGS)', 'before', 2, { status: 'doing', note: 'À lancer : copie du B/L, carte contribuable, certificats CICQ du 01/10.', folder_id: 'f4' }),
  step('s3', 'TELEX', 'Télex release (ou B/L original endossé)', 'before', 3, { due_on: '2026-10-03', folder_id: 'f2', note: 'À obtenir d’Eric (KASSUMAYE).' }),
  step('s4', 'ARRIVAL_NOTICE', 'Avis d’arrivée', 'arrival', 4),
  step('s5', 'CARRIER_RELEASE', 'Bon à délivrer du consignataire', 'arrival', 5),
  step('s6', 'DECLARATION', 'Déclaration en douane', 'clearance', 6, { note: 'Déclarante : Cynthia AKAH.' }),
  step('s7', 'INSPECTION', 'Visite ou scanner', 'clearance', 7),
  step('s8', 'LIQUIDATION', 'Liquidation et paiement des droits', 'clearance', 8),
  step('s9', 'BAE', 'Bon à enlever', 'exit', 9),
  step('s10', 'GATE_OUT', 'Sortie du port', 'exit', 10),
  step('s11', 'EMPTY_RETURN', 'Restitution du vide', 'exit', 11),
];
export const useCargoSteps = (id: string | null) => ok(id === '2' ? STEPS : ([] as CargoStep[]));
export const useCreateCargoSteps = noop;
export const useUpdateCargoStep = noop;
export const useDeleteCargoStep = noop;
export const useCargoClientsByIds = () => ok([] as { id: string; first_name: string; last_name: string; company_name: string | null; phone: string | null; customer_code: string | null; city: string | null }[]);
export const useAssignLotsOwner = noop;
