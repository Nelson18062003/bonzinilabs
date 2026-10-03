// ============================================================
// Atlas : distances, délais porte-à-porte, émissions, perturbations sur la
// route. Les ordres de grandeur sont vérifiés contre des repères connus
// (Nansha – Kribi par le Cap ≈ 18 000 km ; Guangzhou – Douala ≈ 11 400 km
// à vol d'oiseau).
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  AIR_DETOUR_KM, EMISSION_FACTORS, counterpart, greatCircleKm, laneKey, noticesOnRoute, pathKm, planRoute, railAvailable, routePlaces,
} from '@/lib/logistics/atlas';
import type { Notice } from '@/lib/customs/notices';

describe('distances', () => {
  it('grand cercle : Paris – New York ≈ 5 840 km', () => {
    expect(greatCircleKm([48.8566, 2.3522], [40.7128, -74.006])).toBeGreaterThan(5800);
    expect(greatCircleKm([48.8566, 2.3522], [40.7128, -74.006])).toBeLessThan(5880);
  });
  it('un chemin additionne ses segments', () => {
    const a: [number, number] = [0, 0], b: [number, number] = [0, 10], c: [number, number] = [0, 20];
    expect(pathKm([a, b, c])).toBeCloseTo(greatCircleKm(a, c), 6);
    expect(pathKm([a])).toBe(0);
  });
  it('mer : Nansha – Kribi par le Cap, entre 16 000 et 21 000 km', () => {
    const p = planRoute({ mode: 'sea', origin: 'CNNSA', destination: 'douala', port: 'CMKBI', weightKg: 1000 });
    const sea = p.legs.find((l) => l.kind === 'sea')!;
    expect(sea.km).toBeGreaterThan(16_000);
    expect(sea.km).toBeLessThan(21_000);
    // Qingdao est plus loin que Nansha.
    const q = planRoute({ mode: 'sea', origin: 'CNTAO', destination: 'douala', port: 'CMKBI', weightKg: 1000 });
    expect(q.legs.find((l) => l.kind === 'sea')!.km).toBeGreaterThan(sea.km + 1500);
  });
  it('air : grand cercle + 95 km (GLEC)', () => {
    const p = planRoute({ mode: 'air', origin: 'CAN', destination: 'douala', weightKg: 100 });
    const air = p.legs.find((l) => l.kind === 'air')!;
    expect(air.km).toBe(Math.round(greatCircleKm([23.39, 113.3], [4.006, 9.719]) + AIR_DETOUR_KM));
    expect(air.km).toBeGreaterThan(11_000);
    expect(air.km).toBeLessThan(12_200);
  });
});

describe('le trajet porte-à-porte', () => {
  it('mer vers Douala par Kribi : enlèvement, port de départ, traversée, port, route', () => {
    const p = planRoute({ mode: 'sea', origin: 'CNNSA', destination: 'douala', port: 'CMKBI', weightKg: 5000 });
    expect(p.legs.map((l) => l.kind)).toEqual(['pickup', 'origin_port', 'sea', 'port', 'road']);
    expect(p.transit).toBe(false);
    expect(p.days[0]).toBe(p.legs.reduce((n, l) => n + l.days[0], 0));
    expect(p.days[1]).toBe(p.legs.reduce((n, l) => n + l.days[1], 0));
    expect(p.days[0]).toBeLessThan(p.days[1]);
    expect(p.lane).toBe('CNNSA>CMKBI');
  });
  it('mer vers Douala par Douala : pas de route', () => {
    const p = planRoute({ mode: 'sea', origin: 'CNNSA', destination: 'douala', port: 'CMDLA', weightKg: 5000 });
    expect(p.legs.map((l) => l.kind)).toEqual(['pickup', 'origin_port', 'sea', 'port']);
    expect(p.path.at(-1)).toEqual([4.05, 9.7]);
  });
  it('N’Djamena : transit au port, dédouanement à destination', () => {
    const p = planRoute({ mode: 'sea', origin: 'CNSHA', destination: 'ndjamena', port: 'CMDLA', weightKg: 20_000 });
    expect(p.transit).toBe(true);
    expect(p.legs.map((l) => l.kind)).toEqual(['pickup', 'origin_port', 'sea', 'transit', 'road', 'final_clearance']);
    expect(p.path.at(-1)).toEqual([12.134, 15.055]);
  });
  it('rail : Douala – Ngaoundéré puis la route ; Kribi n’a pas de rail', () => {
    expect(railAvailable('CMDLA', 'ndjamena')).toBe(true);
    expect(railAvailable('CMKBI', 'ndjamena')).toBe(false);
    expect(railAvailable('CMDLA', 'bangui')).toBe(false);
    const p = planRoute({ mode: 'sea', origin: 'CNSHA', destination: 'ndjamena', port: 'CMDLA', inland: 'rail', weightKg: 20_000 });
    expect(p.inland).toBe('rail');
    expect(p.legs.map((l) => l.kind)).toEqual(['pickup', 'origin_port', 'sea', 'transit', 'rail', 'road', 'final_clearance']);
    expect(p.legs.find((l) => l.kind === 'rail')!.to.name).toBe('Ngaoundéré');
    // Demander le rail depuis Kribi retombe sur la route.
    const k = planRoute({ mode: 'sea', origin: 'CNSHA', destination: 'ndjamena', port: 'CMKBI', inland: 'rail', weightKg: 20_000 });
    expect(k.inland).toBe('road');
    expect(k.legs.some((l) => l.kind === 'rail')).toBe(false);
  });
  it('air vers Yaoundé : Nsimalen, sans route', () => {
    const p = planRoute({ mode: 'air', origin: 'CAN', destination: 'yaounde', weightKg: 300 });
    expect(p.arrival.code).toBe('NSI');
    expect(p.legs.map((l) => l.kind)).toEqual(['pickup', 'air', 'port']);
  });
  it('un code de départ inconnu ou un poids absurde ne cassent rien', () => {
    const p = planRoute({ mode: 'sea', origin: 'XXXXX', destination: 'yaounde', weightKg: Number.NaN });
    expect(p.origin.code).toBe('CNNSA');
    expect(p.co2eKg).toBe(0);
    expect(planRoute({ mode: 'air', origin: 'CAN', destination: 'douala', weightKg: -50 }).co2eKg).toBe(0);
  });
});

describe('délais observés', () => {
  it('nos expéditions remplacent la fourchette du marché, sur leur ligne seulement', () => {
    const observed = { 'CNNSA>CMKBI': { n: 7, median: 41, p25: 38, p75: 45, promised_median: 35, late_share: 0.71 } };
    const p = planRoute({ mode: 'sea', origin: 'CNNSA', destination: 'douala', port: 'CMKBI', weightKg: 1000, observed });
    const sea = p.legs.find((l) => l.kind === 'sea')!;
    expect(sea.days).toEqual([38, 45]);
    expect(sea.confidence).toBe('observe');
    expect(p.observed?.median).toBe(41);
    const other = planRoute({ mode: 'sea', origin: 'CNSHA', destination: 'douala', port: 'CMKBI', weightKg: 1000, observed });
    expect(other.legs.find((l) => l.kind === 'sea')!.days).toEqual([35, 50]);
    expect(other.observed).toBeNull();
  });
  it('la clé d’une ligne', () => {
    expect(laneKey('cnnsa', 'CMKBI')).toBe('CNNSA>CMKBI');
    expect(laneKey(null, 'CMKBI')).toBeNull();
  });
});

describe('émissions', () => {
  it('tonnes × km × facteur, tronçon par tronçon', () => {
    const p = planRoute({ mode: 'sea', origin: 'CNNSA', destination: 'yaounde', port: 'CMKBI', weightKg: 10_000 });
    const sea = p.legs.find((l) => l.kind === 'sea')!;
    const road = p.legs.find((l) => l.kind === 'road')!;
    expect(sea.co2eKg).toBe(Math.round(10 * sea.km * EMISSION_FACTORS.sea));
    expect(road.co2eKg).toBe(Math.round(10 * road.km * EMISSION_FACTORS.road));
    expect(p.co2eKg).toBe(sea.co2eKg + road.co2eKg);
  });
  it('l’avion émet des dizaines de fois plus que la mer, et va plusieurs fois plus vite', () => {
    const sea = planRoute({ mode: 'sea', origin: 'CNNSA', destination: 'douala', port: 'CMDLA', weightKg: 1000 });
    const air = counterpart(sea);
    expect(air.mode).toBe('air');
    expect(air.origin.code).toBe('CAN');
    expect(air.co2eKg / sea.co2eKg).toBeGreaterThan(30);
    expect(air.days[1]).toBeLessThan(sea.days[0]);
    // Et dans l'autre sens.
    expect(counterpart(air).mode).toBe('sea');
    expect(counterpart(air).origin.code).toBe('CNNSA');
  });
  it('le rail émet moins que la route sur le même corridor', () => {
    const road = planRoute({ mode: 'sea', origin: 'CNSHA', destination: 'ndjamena', port: 'CMDLA', inland: 'road', weightKg: 20_000 });
    const rail = planRoute({ mode: 'sea', origin: 'CNSHA', destination: 'ndjamena', port: 'CMDLA', inland: 'rail', weightKg: 20_000 });
    const inland = (p: typeof road) => p.legs.filter((l) => l.kind === 'road' || l.kind === 'rail').reduce((n, l) => n + l.co2eKg, 0);
    expect(inland(rail)).toBeLessThan(inland(road));
  });
});

describe('perturbations sur la route', () => {
  const base: Notice = {
    id: 'n', slug: 'n', kind: 'disruption', title: 'Avis', summary: '', advice: null, status: 'in_force', severity: 'medium',
    starts_on: '2026-10-01', ends_on: '2026-10-07', delay_days: 7, hs_specs: [], places: ['CN'], source_label: null, source_url: null,
    confidence: 'officiel', published: true, published_at: null, created_at: '', updated_at: '',
  };
  const today = new Date('2026-09-29T09:00:00Z');
  const toChad = planRoute({ mode: 'sea', origin: 'CNNSA', destination: 'ndjamena', port: 'CMDLA', weightKg: 1000 });
  const toDouala = planRoute({ mode: 'sea', origin: 'CNNSA', destination: 'douala', port: 'CMKBI', weightKg: 1000 });

  it('les lieux traversés, corridor compris', () => {
    expect(routePlaces(toChad)).toEqual(['CNNSA', 'CMDLA', 'TDNDJ', 'CM-TD']);
  });
  it('un pays couvre ses ports ; un corridor ne vise que son trajet ; le passé et les brouillons sont écartés', () => {
    const golden = { ...base, id: 'gw' };
    const kribi = { ...base, id: 'kbi', places: ['CMKBI'] };
    const corridor = { ...base, id: 'td', places: ['CM-TD'] };
    const past = { ...base, id: 'past', starts_on: '2026-01-01', ends_on: '2026-01-10' };
    const draft = { ...base, id: 'draft', published: false };
    const regulation = { ...base, id: 'reg', kind: 'regulation' as const };
    const all = [golden, kribi, corridor, past, draft, regulation];
    expect(noticesOnRoute(all, toChad, today).map((n) => n.id)).toEqual(['gw', 'td']);
    expect(noticesOnRoute(all, toDouala, today).map((n) => n.id)).toEqual(['gw', 'kbi']);
  });
});

describe('l’état dans l’URL', () => {
  it('aller-retour, et les valeurs douteuses retombent sur un défaut', async () => {
    const { parseRouteState, serializeRouteState, DEFAULT_ROUTE, weightKg, canRail, switchMode, MAX_WEIGHT_KG } = await import('@/lib/logistics/routeState');
    const s = { mode: 'sea' as const, origin: 'CNSHA', port: 'CMDLA' as const, destination: 'ndjamena' as const, inland: 'rail' as const, weight: '20000' };
    expect(parseRouteState(new URLSearchParams(serializeRouteState(s)))).toEqual(s);
    expect(parseRouteState(new URLSearchParams(''))).toEqual(DEFAULT_ROUTE);
    const bad = parseRouteState(new URLSearchParams('m=boat&o=<script>&p=XX&d=paris&i=teleport&w=12abc'));
    expect(bad).toEqual({ ...DEFAULT_ROUTE, weight: '12' });
    // Un aéroport n'est pas un port de départ maritime, et inversement.
    expect(parseRouteState(new URLSearchParams('m=air&o=CNNSA')).origin).toBe('CAN');
    expect(weightKg({ ...s, weight: '9999999' })).toBe(MAX_WEIGHT_KG);
    expect(weightKg({ ...s, weight: '' })).toBe(0);
    expect(canRail(s)).toBe(true);
    expect(canRail({ ...s, port: 'CMKBI' })).toBe(false);
    expect(canRail({ ...s, mode: 'air' })).toBe(true); // l'avion arrive à Douala
    expect(switchMode(s, 'air').origin).toBe('PVG');
    expect(switchMode(switchMode(s, 'air'), 'sea').origin).toBe('CNSHA');
  });
});

describe('les noms', () => {
  it('le chinois pour un lecteur chinois, le nom d’usage sinon', async () => {
    const { placeLabel, DESTINATIONS, SEA_ORIGINS } = await import('@/lib/logistics/atlas');
    expect(placeLabel(DESTINATIONS.yaounde, 'zh')).toBe('雅温得');
    expect(placeLabel(SEA_ORIGINS[0], 'zh-CN')).toBe('广州（南沙）');
    expect(placeLabel(DESTINATIONS.yaounde, 'en')).toBe('Yaoundé');
    expect(placeLabel({ name: 'Lomé' }, 'zh')).toBe('Lomé');
  });
});

describe('l’arc du vol sur la carte', () => {
  it('part et arrive aux bons points, et suit le grand cercle', async () => {
    const { greatCircleArc } = await import('@/lib/logistics/atlas');
    const a: [number, number] = [23.39, 113.3], b: [number, number] = [4.006, 9.719];
    const arc = greatCircleArc(a, b, 10);
    expect(arc).toHaveLength(11);
    expect(arc[0][0]).toBeCloseTo(a[0], 6); expect(arc[0][1]).toBeCloseTo(a[1], 6);
    expect(arc[10][0]).toBeCloseTo(b[0], 6); expect(arc[10][1]).toBeCloseTo(b[1], 6);
    // Chaque point est sur l'arc : les deux morceaux font la distance totale.
    expect(greatCircleKm(a, arc[4]) + greatCircleKm(arc[4], b)).toBeCloseTo(greatCircleKm(a, b), 3);
    expect(greatCircleArc(a, a)).toEqual([a, a]);
  });
});
