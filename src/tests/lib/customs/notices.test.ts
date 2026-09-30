// ============================================================
// La veille douane : où en est un avis, quels produits il vise, quels
// conteneurs il touche.
// ============================================================
import { describe, it, expect } from 'vitest';
import { affectedShipments, daysUntilStart, noticeMatchesCode, noticesForCodes, phaseOf, shipmentHit, sortNotices, type Notice, type ShipmentLike } from '@/lib/customs/notices';

const base: Notice = {
  id: 'n', slug: 'n', kind: 'regulation', title: 'Avis', summary: 'Résumé', advice: null, status: 'in_force', severity: 'medium',
  starts_on: null, ends_on: null, delay_days: null, hs_specs: [], places: [], source_label: null, source_url: null,
  confidence: 'officiel', published: true, published_at: null, created_at: '', updated_at: '',
};
const tec: Notice = { ...base, id: 'tec', slug: 'tec-ceeac-2026', starts_on: '2026-01-01', hs_specs: ['61', '62', '6704', '1806'], severity: 'high' };
const vehicles: Notice = { ...base, id: 'veh', slug: 'lf2026-accises-vehicules', status: 'announced', hs_specs: ['8703'] };
const goldenWeek: Notice = { ...base, id: 'gw', slug: 'chine-fete-nationale-2026', kind: 'disruption', starts_on: '2026-10-01', ends_on: '2026-10-07', delay_days: 7, places: ['CN'] };
const douala: Notice = { ...base, id: 'dla', slug: 'congestion-douala', kind: 'disruption', starts_on: '2026-09-20', ends_on: '2026-10-20', delay_days: 5, places: ['CMDLA'], severity: 'high' };
const today = new Date('2026-09-29T09:00:00Z');

const ship = (id: string, over: Partial<ShipmentLike>): ShipmentLike => ({
  id, container_number: `MSKU${id}`, pol_unlocode: 'CNSHA', pod_unlocode: 'CMKBI', status: 'BOOKED', etd: null, eta: null, ...over,
});

describe('où en est un avis', () => {
  it('réglementation : en vigueur, annoncée, ou future (donc annoncée)', () => {
    expect(phaseOf(tec, today)).toBe('in_force');
    expect(phaseOf(vehicles, today)).toBe('announced');
    expect(phaseOf({ ...tec, starts_on: '2027-01-01' }, today)).toBe('announced');
  });
  it('perturbation : à venir, en cours, passée', () => {
    expect(phaseOf(goldenWeek, today)).toBe('upcoming');
    expect(daysUntilStart(goldenWeek, today)).toBe(2);
    expect(phaseOf(goldenWeek, new Date('2026-10-07T20:00:00Z'))).toBe('ongoing');
    expect(phaseOf(goldenWeek, new Date('2026-10-08T01:00:00Z'))).toBe('past');
  });
  it('le fil : en cours, puis à venir, puis les textes ; le passé à la fin', () => {
    const past = { ...goldenWeek, id: 'old', starts_on: '2025-10-01', ends_on: '2025-10-07' };
    expect(sortNotices([past, tec, goldenWeek, douala, vehicles], today).map((n) => n.id)).toEqual(['dla', 'gw', 'veh', 'tec', 'old']);
  });
});

describe('les produits visés', () => {
  it('par préfixe : des mèches 6704.20 sont visées par le TEC, un régulateur non', () => {
    expect(noticeMatchesCode(tec, '670420')).toBe(true);
    expect(noticeMatchesCode(tec, '6704.20.00.000')).toBe(true);
    expect(noticeMatchesCode(tec, '850440')).toBe(false);
    expect(noticeMatchesCode(base, '850440')).toBe(false); // sans code : pour tout le monde, pas pour un produit
  });
  it('les avis qui concernent les fiches d’un client, avec les codes visés', () => {
    const hits = noticesForCodes([tec, vehicles, goldenWeek], ['670420', '870323', '850440', null, '670420']);
    expect(hits.map((h) => [h.notice.id, h.codes])).toEqual([['tec', ['670420']], ['veh', ['870323']]]);
  });
});

describe('les conteneurs touchés', () => {
  it('congés en Chine : un conteneur qui part de Shanghai pendant la semaine, ou juste après', () => {
    const inWeek = ship('1', { etd: new Date('2026-10-04T00:00:00Z') });
    const justAfter = ship('2', { etd: new Date('2026-10-09T00:00:00Z') });
    const later = ship('3', { etd: new Date('2026-10-25T00:00:00Z') });
    const atSea = ship('4', { status: 'AT_SEA', etd: new Date('2026-10-03T00:00:00Z') });
    expect(affectedShipments(goldenWeek, [inWeek, justAfter, later, atSea], today).map((h) => [h.shipment.id, h.where])).toEqual([['1', 'origin'], ['2', 'origin']]);
  });
  it('au port d’arrivée : ce qui arrive à Douala pendant la congestion, pas à Kribi', () => {
    const toDouala = ship('5', { status: 'AT_SEA', pod_unlocode: 'CMDLA', eta: new Date('2026-10-12T00:00:00Z') });
    const toKribi = ship('6', { status: 'AT_SEA', pod_unlocode: 'CMKBI', eta: new Date('2026-10-12T00:00:00Z') });
    const arrived = ship('7', { status: 'ARRIVED', pod_unlocode: 'CMDLA', eta: new Date('2026-10-01T00:00:00Z') });
    expect(shipmentHit(douala, toDouala, today)).toBe('destination');
    expect(shipmentHit(douala, toKribi, today)).toBeNull();
    expect(shipmentHit(douala, arrived, today)).toBeNull();
  });
  it('une perturbation passée ne touche plus personne ; un avis réglementaire jamais', () => {
    const s = ship('8', { etd: new Date('2025-10-03T00:00:00Z') });
    expect(shipmentHit({ ...goldenWeek, starts_on: '2025-10-01', ends_on: '2025-10-07' }, s, today)).toBeNull();
    expect(shipmentHit(tec, s, today)).toBeNull();
  });
});
