/**
 * Données Cargo figées pour le harnais de capture (SCREENSHOT_MOCK=1) :
 * les cinq dossiers du 11/09/2026, les trois navires, une recherche.
 */
import type { CargoDocument, CargoEvent, CargoLookup, CargoShipment, CargoVesselPosition } from '@/lib/cargo/model';

const base = {
  client_id: null, container_iso: '45G1', pol_name: 'Nansha', pol_unlocode: 'CNNSA', pod_name: 'Kribi', pod_unlocode: 'CMKBI',
  freight_paid: false, telex_released: false, last_synced_at: '2026-09-11T20:40:00Z', sync_error: null, notes: null,
  created_at: '2026-09-11T20:00:00Z', updated_at: '2026-09-11T20:00:00Z', last_event_label: 'Navire parti',
} as const;

const SHIPMENTS: CargoShipment[] = [
  { ...base, id: '1', client_label: 'PRC', carrier: 'CMA_CGM', bl_number: 'GGZ3133535', container_number: 'CMAU6126032', container_iso: null, pol_name: null, pol_unlocode: null, pod_name: 'Douala', pod_unlocode: 'CMDLA', etd_promised: '2026-08-04', eta_promised: '2026-09-17', etd_actual: null, eta_carrier: null, vessel_name: null, vessel_imo: null, vessel_mmsi: null, voyage: null, freight_usd: 6650, status: 'UNKNOWN', last_event_at: null, last_event_label: null, last_synced_at: null },
  { ...base, id: '2', client_label: 'GAUSS', carrier: 'MAERSK', bl_number: '274428633', container_number: 'MIEU3611115', etd_promised: '2026-08-15', eta_promised: '2026-09-27', etd_actual: '2026-08-15T23:38:00Z', eta_carrier: '2026-10-11T10:00:00Z', vessel_name: 'CMA CGM LAPEROUSE', vessel_imo: '9454412', vessel_mmsi: '215930000', voyage: '631W', freight_usd: 6550, status: 'AT_SEA', last_event_at: '2026-08-15T23:38:00Z' },
  { ...base, id: '3', client_label: 'PRC', carrier: 'MAERSK', bl_number: '275558999', container_number: 'MRKU4617437', etd_promised: '2026-08-23', eta_promised: '2026-10-05', etd_actual: '2026-08-24T02:26:00Z', eta_carrier: '2026-10-15T01:00:00Z', vessel_name: 'CMA CGM CEDRUS', vessel_imo: '9938121', vessel_mmsi: '256615000', voyage: '633W', freight_usd: 5950, status: 'AT_SEA', last_event_at: '2026-08-24T02:26:00Z' },
  { ...base, id: '4', client_label: 'PRC', carrier: 'MAERSK', bl_number: '275926835', container_number: 'MRSU7972968', etd_promised: '2026-09-05', eta_promised: '2026-10-12', etd_actual: '2026-09-04T18:31:00Z', eta_carrier: '2026-10-18T11:00:00Z', vessel_name: 'CMA CGM PRIDE', vessel_imo: '9924429', vessel_mmsi: '229997000', voyage: '634W', freight_usd: 5650, status: 'AT_SEA', last_event_at: '2026-09-04T18:31:00Z' },
  { ...base, id: '5', client_label: 'DJIANI', carrier: 'MAERSK', bl_number: '275926916', container_number: 'CAJU5023560', etd_promised: '2026-09-05', eta_promised: '2026-10-12', etd_actual: '2026-09-04T18:31:00Z', eta_carrier: '2026-10-18T11:00:00Z', vessel_name: 'CMA CGM PRIDE', vessel_imo: '9924429', vessel_mmsi: '229997000', voyage: '634W', freight_usd: 5750, status: 'AT_SEA', last_event_at: '2026-09-04T18:31:00Z' },
];

const POSITIONS: CargoVesselPosition[] = [
  { vessel_imo: '9454412', vessel_mmsi: '215930000', vessel_name: 'CMA CGM LAPEROUSE', latitude: -20.42261, longitude: 9.9197, speed_kn: 12.4, course_deg: 333.2, destination: 'CIABJ', eta: '2026-09-17T06:00:00Z', reported_at: '2026-09-10T22:47:00Z', source: 'manual', updated_at: '2026-09-11T20:00:00Z' },
  { vessel_imo: '9938121', vessel_mmsi: '256615000', vessel_name: 'CMA CGM CEDRUS', latitude: 2.56352, longitude: 101.51508, speed_kn: 13.6, course_deg: 310.6, destination: 'CIABJ', eta: '2026-09-27T17:00:00Z', reported_at: '2026-09-01T12:46:00Z', source: 'manual', updated_at: '2026-09-11T20:00:00Z' },
  { vessel_imo: '9924429', vessel_mmsi: '229997000', vessel_name: 'CMA CGM PRIDE', latitude: 1.78142, longitude: 102.62114, speed_kn: 17.4, course_deg: 301.6, destination: 'CIABJ', eta: '2026-10-04T07:00:00Z', reported_at: '2026-09-11T21:49:00Z', source: 'manual', updated_at: '2026-09-11T20:00:00Z' },
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
  ev('e8', 'ARRI', 'TRANSPORT', '2026-10-11T10:00:00Z', 'EST', 'Kribi Port', 'CMA CGM LAPEROUSE'),
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
const noop = () => ({ mutate: () => undefined, mutateAsync: async () => undefined, isPending: false });

export const useCargoShipments = () => ok(SHIPMENTS);
export const useCargoShipment = (id: string | null) => ok(SHIPMENTS.find((s) => s.id === id) ?? null);
export const useCargoVesselPositions = () => ok(POSITIONS);
export const useCargoEvents = (id: string | null) => ok(id === '2' ? EVENTS : []);
export const useUpdateCargoShipment = noop;
export const useRemoveCargoShipment = noop;
export const useRequestCargoSync = noop;
export const useRequestCargoLookup = noop;
export const useCargoLookup = (id: string | null) => ok(id ? LOOKUP : undefined);
export const useRecentCargoLookups = () => ok([LOOKUP]);
export const useAddCargoShipment = noop;
export const useCargoDocuments = () => ok([] as CargoDocument[]);
export const useUploadCargoDocument = noop;
export const useDeleteCargoDocument = noop;
export const openCargoDocument = async () => undefined;
