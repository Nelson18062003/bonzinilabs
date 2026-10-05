// L'expédition aérienne : la LTA formatée, le jalon suivant, les colis par client,
// les paquets de 32 kg (scannés au départ, reçus à Douala), la LTA provisoire.
import { describe, expect, it } from 'vitest';
import {
  airStatusMeta, awbFileRef, departureBlocker, flightSentence, formatAwb, groupByClient, nextAirStep, packageClientsFromParcels,
  packageProgress, parcelUnpaid, type AirParcel, type AirShipment,
} from '@/lib/airShipment';
import type { AirPackage, AirPackageStatus } from '@/lib/airPackage';

const p = (o: Partial<AirParcel>): AirParcel => ({
  id: 'p', seq: 1, parcel_no: 'RC-000121-01', kind: 'carton', weight_kg: 8.4, length_cm: 60, width_cm: 40, height_cm: 40, cbm: 0.096,
  description: null, courier_waybill: null, photo_path: null, status: 'loaded', created_at: '2026-09-21T00:00:00Z',
  deposit_id: 'dep', deposit_no: 'RC-000121', client: null, ...o,
});

describe('la LTA et le vol', () => {
  it('met le tiret après le code compagnie', () => {
    expect(formatAwb('07112345675')).toBe('071-12345675');
    expect(formatAwb('071-12345675')).toBe('071-12345675');
    expect(formatAwb('abc')).toBe('ABC');
  });
  it('dit le vol, ou « à préciser »', () => {
    expect(flightSentence({ flight_no: 'ET 607', airline: 'Ethiopian' })).toBe('ET 607 · Ethiopian');
    expect(flightSentence({ flight_no: null, airline: null })).toBe('Vol à préciser');
  });
  it('propose le jalon suivant, un cran à la fois', () => {
    expect(nextAirStep('PLANNED')?.to).toBe('DEPARTED');
    expect(nextAirStep('DEPARTED')?.to).toBe('ARRIVED');
    expect(nextAirStep('ARRIVED')).toBeNull();
    expect(airStatusMeta('n’importe quoi').label).toBe('En préparation');
  });
});

describe('les colis par client', () => {
  it('groupe, additionne, et signale un devis non soldé', () => {
    const c1 = { user_id: 'u1', customer_code: 'BZ-1', first_name: 'A', last_name: 'B', phone: null, email: null, company_name: null, city: null, country: null };
    const groups = groupByClient([
      p({ id: 'a', client: c1, weight_kg: 10, quote_total_xaf: 100, quote_paid_xaf: 100 }),
      p({ id: 'b', client: c1, weight_kg: 5, quote_total_xaf: 100, quote_paid_xaf: 40 }),
      p({ id: 'c', client: null, weight_kg: 1 }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].kg).toBe(15);
    expect(groups[0].unpaid).toBe(true);
    expect(groups[1].client).toBeNull();
  });
  it('sans prix = non soldé', () => {
    expect(parcelUnpaid({ quote_total_xaf: null, quote_paid_xaf: null })).toBe(true);
    expect(parcelUnpaid({ quote_total_xaf: 50, quote_paid_xaf: 50 })).toBe(false);
  });
});

const pkg = (id: string, status: AirPackageStatus): AirPackage => ({
  id, package_no: `PQ-00000${id}`, status, air_shipment_id: 'a1', awb_number: null, air_status: null, etd: null, flight_no: null,
  max_weight_kg: 32, gross_weight_kg: 30, length_cm: null, width_cm: null, height_cm: null, notes: null, net_weight_kg: 29,
  parcel_count: 3, client_count: 2, checked_count: 0, missing_count: 0, sealed_at: null, handed_over_at: null, refused_at: null,
  refusal_reason: null, refused_air_shipment_id: null, received_at: null, opened_at: null, created_at: '', updated_at: '',
});

describe('les paquets de l’expédition', () => {
  it('compte les scannés au départ depuis la liste (reçus et ouverts comptent comme partis)', () => {
    const a = { packages: [pkg('1', 'sealed'), pkg('2', 'handed_over'), pkg('3', 'received'), pkg('4', 'opened')] };
    expect(packageProgress(a)).toEqual({ total: 4, scanned: 3, received: 2, left: 1 });
  });
  it('sans la liste, lit les compteurs du serveur', () => {
    expect(packageProgress({ package_count: 5, packages_handed_over: 2, packages_received: 1 })).toEqual({ total: 5, scanned: 3, received: 1, left: 2 });
    expect(packageProgress({})).toEqual({ total: 0, scanned: 0, received: 0, left: 0 });
  });
  it('le départ attend tous les paquets scannés — et seulement en préparation', () => {
    const planned: Pick<AirShipment, 'status' | 'packages'> = { status: 'PLANNED', packages: [pkg('1', 'handed_over'), pkg('2', 'sealed'), pkg('3', 'sealed')] };
    expect(departureBlocker(planned)).toMatch(/^2 paquets pas encore scannés au départ/);
    expect(departureBlocker({ ...planned, packages: [pkg('1', 'sealed')] })).toMatch(/^1 paquet pas encore scanné au départ/);
    expect(departureBlocker({ ...planned, packages: [pkg('1', 'handed_over')] })).toBeNull();
    expect(departureBlocker({ status: 'PLANNED', packages: [] })).toBeNull();
    expect(departureBlocker({ ...planned, status: 'DEPARTED' })).toBeNull();
  });
  it('trouve les clients d’un paquet dans les colis de l’expédition', () => {
    const c = (code: string) => ({ user_id: code, customer_code: code, first_name: 'A', last_name: 'B', phone: null, email: null, company_name: null, city: null, country: null });
    const parcels = [
      p({ id: 'a', air_package_id: 'k1', package_no: 'PQ-000001', client: c('BZ-1') }),
      p({ id: 'b', air_package_id: 'k1', package_no: 'PQ-000001', client: c('BZ-2') }),
      p({ id: 'c', air_package_id: 'k1', package_no: 'PQ-000001', client: c('BZ-1') }),
      p({ id: 'd', air_package_id: 'k2', package_no: 'PQ-000002', client: c('BZ-3') }),
      p({ id: 'e', air_package_id: null, client: c('BZ-4') }),
    ];
    expect(packageClientsFromParcels('k1', parcels)).toEqual(['BZ-1', 'BZ-2']);
    expect(packageClientsFromParcels('k9', parcels)).toEqual([]);
  });
});

describe('la LTA provisoire ne se montre jamais', () => {
  it('nom de fichier : la vraie LTA, ou « lta-a-venir » (jamais PROV-…)', () => {
    expect(awbFileRef({ awb_number: '071 12345675', etd: null })).toBe('07112345675');
    expect(awbFileRef({ awb_number: 'PROV-AB12CD', etd: '2026-10-12' })).toBe('lta-a-venir-2026-10-12');
    expect(awbFileRef({ awb_number: 'PROV-AB12CD', etd: null })).toBe('lta-a-venir');
  });
});
