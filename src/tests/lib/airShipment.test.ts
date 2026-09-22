// L'expédition aérienne : la LTA formatée, le jalon suivant, les colis par client.
import { describe, expect, it } from 'vitest';
import { airStatusMeta, flightSentence, formatAwb, groupByClient, nextAirStep, parcelUnpaid, type AirParcel } from '@/lib/airShipment';

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
