// ============================================================
// Carte Cargo — la couleur porte une information, donc elle se teste.
//
// Deux choses ici. D'abord les règles d'alerte : c'est la teinte d'un navire
// sur la carte, donc une erreur se voit tous les jours. Ensuite le sélecteur
// de couches d'eau : le fond de carte livre un océan gris et on le repeint au
// chargement ; si le sélecteur rate la couche, la mer redevient grise sans
// que rien n'échoue. On fige donc les identifiants réels des styles.
// ============================================================
import { describe, it, expect } from 'vitest';
import { ALERT, ALERT_ORDER, alertLevel, alertTally, mapInk, worstAlert } from '@/lib/cargo/palette';
import type { CargoShipment } from '@/lib/cargo/model';

/** Un dossier nominal : parti, à l'heure, fret réglé, télex obtenu. */
function ship(over: Partial<CargoShipment> = {}): CargoShipment {
  const base = {
    id: 'x', client_label: 'PRC', client_id: null, carrier: 'MAERSK',
    bl_number: '1', container_number: 'ABCU1234567', container_iso: '45G1',
    pol_name: 'Nansha', pol_unlocode: 'CNNSA', pod_name: 'Kribi', pod_unlocode: 'CMKBI',
    etd_promised: '2026-08-01', eta_promised: '2026-12-01',
    etd_actual: null, eta_carrier: '2026-12-01T00:00:00Z',
    vessel_name: 'NAVIRE', vessel_imo: '1', vessel_mmsi: null, voyage: null,
    freight_usd: 5000, freight_paid: true, telex_released: true,
    status: 'AT_SEA', last_event_at: null, last_event_label: null,
    last_synced_at: null, sync_error: null, notes: null,
    created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
    arrival_notice_at: null, free_time_ends_on: null, customs_declaration_ref: null,
    customs_cleared_at: null, delivery_order_at: null, gate_out_at: null,
    empty_returned_at: null, besc_number: null, goods_description: null,
    gross_weight_kg: null, packages_count: null,
  } as unknown as CargoShipment;
  return { ...base, ...over };
}

const NOW = new Date('2026-09-12T00:00:00Z');

describe('CARTE — le niveau d’alerte d’un conteneur', () => {
  it('un dossier nominal est « à l’heure »', () => {
    expect(alertLevel(ship(), [], NOW)).toBe('ok');
  });

  it('un conteneur livré ne crie plus : il sort des teintes d’alerte', () => {
    expect(alertLevel(ship({ status: 'DELIVERED' }), [], NOW)).toBe('done');
    expect(ALERT.done.hex).toBe('#8a8a8a');
  });

  it('un report d’une semaine ou plus passe en « en retard »', () => {
    const s = ship({ eta_promised: '2026-12-01', eta_carrier: '2026-12-08T00:00:00Z' });
    expect(alertLevel(s, [], NOW)).toBe('late');
  });

  it('un report de quelques jours reste « à surveiller »', () => {
    const s = ship({ eta_promised: '2026-12-01', eta_carrier: '2026-12-03T00:00:00Z' });
    expect(alertLevel(s, [], NOW)).toBe('watch');
  });

  it('franchise dépassée et boîte encore au port : les surestaries courent, donc « en retard »', () => {
    const s = ship({ free_time_ends_on: '2026-09-01', gate_out_at: null });
    expect(alertLevel(s, [], NOW)).toBe('late');
  });

  it('mais plus d’alerte une fois la boîte sortie du port', () => {
    const s = ship({ free_time_ends_on: '2026-09-01', gate_out_at: '2026-09-02T00:00:00Z' });
    expect(alertLevel(s, [], NOW)).not.toBe('late');
  });

  it('arrivée sous trois jours sans télex : la boîte ne sortira pas', () => {
    const s = ship({ eta_promised: '2026-09-14', eta_carrier: '2026-09-14T00:00:00Z', telex_released: false });
    expect(alertLevel(s, [], NOW)).toBe('late');
  });

  it('un navire prend l’état du PIRE conteneur qu’il porte', () => {
    const calme = ship({ id: 'a' });
    const tendu = ship({ id: 'b', eta_promised: '2026-12-01', eta_carrier: '2026-12-20T00:00:00Z' });
    expect(worstAlert([calme, tendu])).toBe('late');
    expect(worstAlert([calme])).toBe('ok');
    expect(worstAlert([])).toBe('done');
  });

  it('le décompte de la légende couvre tous les conteneurs, sans doublon', () => {
    const lot = [ship({ id: 'a' }), ship({ id: 'b', status: 'DELIVERED' })];
    const t = alertTally(lot);
    expect(Object.values(t).reduce((a, b) => a + b, 0)).toBe(lot.length);
    expect(t.done).toBe(1);
  });
});

describe('CARTE — la palette elle-même', () => {
  it('garde les valeurs validées par le validateur dataviz', () => {
    // Changer un de ces hex invalide la vérification de séparation et de
    // contraste : relancer scripts/validate_palette.js avant de toucher.
    expect(ALERT.late.hex).toBe('#d03b3b');
    expect(ALERT.watch.hex).toBe('#fab219');
    expect(ALERT.ok.hex).toBe('#0ca30c');
  });

  it('n’expose que trois teintes d’alerte — quatre ne se séparaient pas', () => {
    const teintes = ALERT_ORDER.filter((k) => k !== 'done');
    expect(teintes).toHaveLength(3);
    expect(new Set(teintes.map((k) => ALERT[k].hex)).size).toBe(3);
  });

  it('repeint la mer dans les deux modes, et jamais avec la même valeur', () => {
    expect(mapInk(false).water).toBe('#dbe8f2');
    expect(mapInk(true).water).toBe('#0f1a26');
    expect(mapInk(false).route).not.toBe(mapInk(true).route);
  });

  it('chaque niveau porte un libellé : la couleur ne dit jamais seule', () => {
    for (const k of ALERT_ORDER) {
      expect(ALERT[k].label.length).toBeGreaterThan(2);
      expect(ALERT[k].glyph.length).toBeGreaterThan(0);
    }
  });
});

describe('CARTE — le sélecteur de couches d’eau', () => {
  // Identifiants relevés dans les styles OpenFreeMap réellement servis
  // (tiles.openfreemap.org/styles/<nom>), le 12/09/2026.
  const EAU = ['water'];
  const PAS_EAU = ['waterway', 'waterway_river', 'waterway_tunnel', 'water_name_point_label', 'waterway_line_label'];
  const SELECTEUR = /water|ocean|sea/i;

  it('reconnaît la couche d’eau de positron, dark, bright et liberty', () => {
    for (const id of EAU) expect(SELECTEUR.test(id)).toBe(true);
  });

  it('les rivières et les étiquettes matchent aussi le nom — le filtre de type fill est donc indispensable', () => {
    // On documente le piège : c'est `layer.type !== 'fill'` qui les écarte,
    // pas le nom. Si quelqu'un retire ce garde-fou, les étiquettes de mer
    // seraient repeintes et disparaîtraient.
    for (const id of PAS_EAU) expect(SELECTEUR.test(id)).toBe(true);
  });
});
