// ============================================================
// Cargo en français de tous les jours — les phrases que lit l'admin sur
// son téléphone. Une phrase fausse, c'est un client mal prévenu.
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  arrivalSentence, contentSentence, customsSentence, delaySentence, departureSentence, journeySentence,
  moneySentence, nextActionSentence, papersSentence, plural, todoSentence, whereSentence,
} from '@/lib/cargo/plain';
import type { CargoDocument, CargoShipment } from '@/lib/cargo/model';

/** fr-FR sépare les milliers par une espace fine insécable : on compare sans en tenir compte. */
const flat = (s: string) => s.replace(/[\u202F\u00A0]/g, ' ');

function ship(over: Partial<CargoShipment> = {}): CargoShipment {
  return {
    id: 'x', client_label: 'GAUSS', client_id: null, carrier: 'MAERSK', bl_number: '274428633', container_number: 'MIEU3611115',
    container_iso: '45G1', pol_name: 'Nansha', pol_unlocode: 'CNNSA', pod_name: 'Kribi', pod_unlocode: 'CMKBI',
    etd_promised: '2026-08-15', eta_promised: '2026-09-27', etd_actual: '2026-08-15T23:38:00Z', eta_carrier: '2026-10-11T10:00:00Z',
    vessel_name: 'CMA CGM LAPEROUSE', vessel_imo: '9454412', vessel_mmsi: null, voyage: '631W', freight_usd: 6550, freight_paid: false,
    telex_released: false, status: 'AT_SEA', last_event_at: null, last_event_label: null, last_synced_at: null, sync_error: null, notes: null,
    created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z', arrival_notice_at: null, free_time_ends_on: null,
    customs_declaration_ref: null, customs_cleared_at: null, delivery_order_at: null, gate_out_at: null, empty_returned_at: null,
    besc_number: null, goods_description: 'Téléphones et accessoires', gross_weight_kg: 18400, packages_count: 860,
    ...over,
  } as unknown as CargoShipment;
}
const NOW = new Date('2026-09-13T00:00:00Z');

describe('PHRASES — l’arrivée', () => {
  it('dit le port, le jour en toutes lettres et dans combien de jours', () => {
    expect(arrivalSentence(ship(), NOW)).toBe('Arrive à Kribi le 11 octobre, dans 28 jours');
  });
  it('accorde le singulier', () => {
    expect(arrivalSentence(ship({ eta_carrier: '2026-09-14T10:00:00Z' }), NOW)).toBe('Arrive à Kribi le 14 septembre, dans 1 jour');
    expect(plural(1, 'jour')).toBe('1 jour');
  });
  it('sait dire « aujourd’hui », « arrivé » et « livré »', () => {
    expect(arrivalSentence(ship({ eta_carrier: '2026-09-13T10:00:00Z' }), NOW)).toContain("aujourd'hui");
    expect(arrivalSentence(ship({ status: 'ARRIVED' }))).toBe('Arrivé à Kribi');
    expect(arrivalSentence(ship({ status: 'DELIVERED' }))).toBe('Livré');
  });
  it('avoue quand la date manque au lieu d’afficher un tiret', () => {
    expect(arrivalSentence(ship({ eta_carrier: null, eta_promised: null }))).toBe('Arrivée à Kribi : date inconnue');
  });
});

describe('PHRASES — le retard', () => {
  it('compte le retard sur la date promise, en jours', () => {
    expect(delaySentence(ship())).toBe('Retard de 14 jours sur la date promise');
  });
  it('se tait quand tout est à l’heure', () => {
    expect(delaySentence(ship({ eta_carrier: '2026-09-27T10:00:00Z' }))).toBeNull();
  });
});

describe('PHRASES — le voyage', () => {
  it('dit d’où et quand la boîte est partie', () => {
    expect(departureSentence(ship())).toBe('Parti de Nansha le 15 août');
  });
  it('dit le trajet et l’avancement', () => {
    expect(journeySentence(ship(), NOW)).toBe('Nansha → Kribi, jour 29 sur 57');
  });
  it('dit où est la boîte sans jargon', () => {
    expect(whereSentence(ship(), null)).toBe('En mer, sans position connue');
    expect(whereSentence(ship(), { reported_at: '2026-09-11T00:00:00Z' } as never, NOW)).toBe('En mer, position relevée il y a 2 jours');
    expect(whereSentence(ship(), { reported_at: '2026-09-12T21:00:00Z' } as never, NOW)).toBe('En mer, position relevée il y a 3 heures');
    expect(whereSentence(ship({ status: 'UNKNOWN' }), null)).toMatch(/Pas de suivi/);
  });
});

describe('PHRASES — ce qu’il reste à faire', () => {
  it('compte les choses à faire', () => {
    expect(todoSentence(ship(), [])).toMatch(/^6 choses à faire/);
  });
  it('donne la prochaine, en minuscule après « À faire : »', () => {
    expect(nextActionSentence(ship(), [])).toBe('À faire : régler le fret au transitaire');
  });
  it('dit « tout est prêt » quand la boîte est livrée', () => {
    expect(todoSentence(ship({ status: 'DELIVERED' }), [])).toBe('Rien à faire, tout est prêt');
    expect(nextActionSentence(ship({ status: 'DELIVERED' }), [])).toBeNull();
  });
});

describe('PHRASES — l’argent et les papiers', () => {
  it('dit le fret, s’il est payé, et l’état du télex', () => {
    expect(flat(moneySentence(ship()))).toBe('Fret 6 550 $, pas encore payé. Télex pas encore reçu.');
    expect(flat(moneySentence(ship({ freight_paid: true, telex_released: true })))).toBe('Fret 6 550 $, payé. Télex reçu.');
  });
  it('compte les pièces obligatoires manquantes', () => {
    expect(papersSentence([])).toBe('5 pièces manquantes sur 5');
    const all = ['BL', 'TELEX', 'INVOICE', 'PACKING_LIST', 'BESC'].map((kind) => ({ kind } as CargoDocument));
    expect(papersSentence(all)).toBe('Toutes les pièces obligatoires sont là');
  });
  it('décrit l’étape camerounaise en cours', () => {
    expect(customsSentence(ship())).toBe('Pas encore arrivé');
    expect(customsSentence(ship({ status: 'ARRIVED', arrival_notice_at: '2026-10-12' }))).toMatch(/douane en cours/);
    expect(customsSentence(ship({ gate_out_at: '2026-10-20' }))).toMatch(/Sorti du port/);
  });
  it('décrit le contenu', () => {
    expect(flat(contentSentence(ship()))).toBe('Téléphones et accessoires — 860 colis, 18 400 kg');
  });
});
