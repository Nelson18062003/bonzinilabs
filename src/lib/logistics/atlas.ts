/**
 * Atlas — routes, délais et émissions de la Chine au Cameroun (et au-delà :
 * N'Djamena, Bangui). La version Bonzini de l'« Atlas » de Flexport
 * (docs/douane/00-plan.md, étape 8).
 *
 * Trois règles :
 *   1. les DISTANCES se calculent : grand cercle pour l'avion (+ 95 km de
 *      détour, convention GLEC), points de passage réels pour la mer (la
 *      tournée Chine → Singapour → cap de Bonne-Espérance → golfe de Guinée de
 *      la carte Cargo, sans ses escales), distances connues pour l'arrière-pays ;
 *   2. les DÉLAIS observés sur nos expéditions (RPC logistics_observed_transit)
 *      passent avant les fourchettes du marché, qui sont dites « marché » ;
 *   3. les ÉMISSIONS suivent la logique ISO 14083 / GLEC : tonnes × km ×
 *      facteur par mode. Les facteurs sont des moyennes publiées (DESNZ 2023),
 *      à confirmer : un ordre de grandeur, pas un bilan carbone certifié.
 *
 * Aucun texte ici : l'écran traduit chaque tronçon par son `kind`.
 */
import type { Confidence } from '@/lib/customs/levies';
import { phaseOf, type Notice } from '@/lib/customs/notices';

export type LatLng = [number, number];
export type Mode = 'sea' | 'air';
export type Inland = 'road' | 'rail';
export type LegKind =
  | 'pickup' | 'origin_port' | 'sea' | 'air'
  /** Débarquement et dédouanement au Cameroun. */
  | 'port'
  /** Débarquement et formalités de transit (Tchad, Centrafrique : les droits se paient à destination). */
  | 'transit'
  | 'road' | 'rail'
  | 'final_clearance';

const R = 6371;
export function greatCircleKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const pathKm = (path: LatLng[]) => path.slice(1).reduce((n, p, i) => n + greatCircleKm(path[i], p), 0);

/** L'arc de grand cercle entre deux points (interpolation sphérique). */
export function greatCircleArc(a: LatLng, b: LatLng, steps = 48): LatLng[] {
  const rad = Math.PI / 180;
  const [lat1, lng1, lat2, lng2] = [a[0] * rad, a[1] * rad, b[0] * rad, b[1] * rad];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2));
  if (d === 0) return [a, b];
  const out: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    out.push([Math.atan2(z, Math.sqrt(x * x + y * y)) / rad, Math.atan2(y, x) / rad]);
  }
  return out;
}

// ─── Les lieux ──────────────────────────────────────────────────────────────

/**
 * `code` : UN/LOCODE pour un port, IATA pour un aéroport ; `locode` sert aux
 * avis de veille ; `zh` : le nom que lit un fournisseur ou un collègue chinois.
 */
export interface Place { code: string; locode: string; name: string; zh?: string; pos: LatLng }

/** Le nom d'un lieu dans la langue de l'écran (les noms propres ne changent qu'en chinois). */
export const placeLabel = (p: Pick<Place, 'name' | 'zh'>, lang: string) => (lang.startsWith('zh') && p.zh ? p.zh : p.name);

/** Les ports chinois d'où partent nos clients, et le chemin jusqu'au détroit de Singapour. */
export const SEA_ORIGINS: (Place & { toSingapore: LatLng[] })[] = [
  { code: 'CNNSA', locode: 'CNNSA', name: 'Guangzhou (Nansha)', zh: '广州（南沙）', pos: [22.637, 113.676], toSingapore: [[21.8, 113.6], [19.0, 112.5], [15.0, 110.5], [8.0, 107.5]] },
  { code: 'CNYTN', locode: 'CNYTN', name: 'Shenzhen (Yantian)', zh: '深圳（盐田）', pos: [22.57, 114.27], toSingapore: [[21.9, 114.5], [19.0, 112.8], [15.0, 110.5], [8.0, 107.5]] },
  { code: 'CNXMN', locode: 'CNXMN', name: 'Xiamen', zh: '厦门', pos: [24.45, 118.07], toSingapore: [[23.6, 117.9], [21.5, 115.5], [15.0, 110.8], [8.0, 107.5]] },
  { code: 'CNNGB', locode: 'CNNGB', name: 'Ningbo', zh: '宁波', pos: [29.87, 121.55], toSingapore: [[29.6, 122.4], [26.0, 121.0], [23.0, 118.5], [21.0, 115.5], [15.0, 110.8], [8.0, 107.5]] },
  { code: 'CNSHA', locode: 'CNSHA', name: 'Shanghai', zh: '上海', pos: [31.23, 121.49], toSingapore: [[31.0, 122.4], [29.5, 122.8], [26.0, 121.0], [23.0, 118.5], [21.0, 115.5], [15.0, 110.8], [8.0, 107.5]] },
  { code: 'CNTAO', locode: 'CNTAO', name: 'Qingdao', zh: '青岛', pos: [36.07, 120.32], toSingapore: [[35.6, 121.2], [33.0, 123.0], [29.5, 122.8], [26.0, 121.0], [23.0, 118.5], [21.0, 115.5], [15.0, 110.8], [8.0, 107.5]] },
];
/** Singapour → Malacca → océan Indien → cap de Bonne-Espérance → golfe de Guinée. */
export const TRUNK_TO_GULF: LatLng[] = [
  [1.5, 104.6], [2.8, 101.0], [5.5, 98.0], [5.0, 93.0], [0.0, 80.0], [-15.0, 60.0], [-28.0, 48.0], [-33.0, 35.0],
  [-36.0, 22.0], [-34.3, 17.5], [-28.0, 13.5], [-20.4, 9.9], [-12.0, 8.5], [-3.0, 6.0], [1.5, 8.0],
];
export type SeaPort = 'CMKBI' | 'CMDLA';
export const SEA_PORTS: Place[] = [
  { code: 'CMKBI', locode: 'CMKBI', name: 'Kribi', zh: '克里比', pos: [2.936, 9.909] },
  { code: 'CMDLA', locode: 'CMDLA', name: 'Douala', zh: '杜阿拉', pos: [4.05, 9.7] },
];

export const AIR_ORIGINS: Place[] = [
  { code: 'CAN', locode: 'CNCAN', name: 'Guangzhou (Baiyun)', zh: '广州（白云）', pos: [23.39, 113.3] },
  { code: 'SZX', locode: 'CNSZX', name: 'Shenzhen (Bao’an)', zh: '深圳（宝安）', pos: [22.64, 113.81] },
  { code: 'PVG', locode: 'CNSHA', name: 'Shanghai (Pudong)', zh: '上海（浦东）', pos: [31.14, 121.81] },
  { code: 'HKG', locode: 'HKHKG', name: 'Hong Kong', zh: '香港', pos: [22.31, 113.92] },
];
export const AIRPORTS: Place[] = [
  { code: 'DLA', locode: 'CMDLA', name: 'Douala', zh: '杜阿拉', pos: [4.006, 9.719] },
  { code: 'NSI', locode: 'CMNSI', name: 'Yaoundé-Nsimalen', zh: '雅温得（恩西马伦）', pos: [3.722, 11.553] },
];

/** Là où la marchandise va vraiment. */
export type Destination = 'douala' | 'yaounde' | 'ndjamena' | 'bangui';
export const DESTINATIONS: Record<Destination, Place & { country: 'CM' | 'TD' | 'CF' }> = {
  douala: { code: 'douala', locode: 'CMDLA', name: 'Douala', zh: '杜阿拉', pos: [4.05, 9.7], country: 'CM' },
  yaounde: { code: 'yaounde', locode: 'CMYAO', name: 'Yaoundé', zh: '雅温得', pos: [3.848, 11.502], country: 'CM' },
  ndjamena: { code: 'ndjamena', locode: 'TDNDJ', name: 'N’Djamena', zh: '恩贾梅纳', pos: [12.134, 15.055], country: 'TD' },
  bangui: { code: 'bangui', locode: 'CFBGF', name: 'Bangui', zh: '班吉', pos: [4.394, 18.558], country: 'CF' },
};
const NGAOUNDERE: Place = { code: 'ngaoundere', locode: 'CMNGE', name: 'Ngaoundéré', zh: '恩冈代雷', pos: [7.327, 13.584] };

/** Le corridor, pour les avis de veille (`CM-TD`, `CM-CF`). */
const CORRIDOR: Partial<Record<Destination, string>> = { ndjamena: 'CM-TD', bangui: 'CM-CF' };

interface Hop { km: number; days: [number, number]; via: string; path?: LatLng[] }
/**
 * L'arrière-pays, depuis le port ou l'aéroport d'arrivée. Distances et délais
 * indicatifs (corridors CEMAC ; le délai compte les arrêts et contrôles).
 */
const ROAD: Record<string, Hop> = {
  'CMDLA>yaounde': { km: 245, days: [1, 2], via: 'Edéa (N3)' },
  'CMKBI>yaounde': { km: 280, days: [1, 2], via: 'Edéa' },
  'CMKBI>douala': { km: 170, days: [1, 1], via: 'Edéa' },
  'CMDLA>ndjamena': { km: 1800, days: [7, 15], via: 'Ngaoundéré · Garoua · Kousseri', path: [[7.327, 13.584], [9.301, 13.397], [12.077, 15.03]] },
  'CMKBI>ndjamena': { km: 1850, days: [7, 15], via: 'Ngaoundéré · Garoua · Kousseri', path: [[7.327, 13.584], [9.301, 13.397], [12.077, 15.03]] },
  'CMDLA>bangui': { km: 1450, days: [10, 20], via: 'Yaoundé · Bertoua · Garoua-Boulaï', path: [[3.848, 11.502], [4.577, 13.685], [5.884, 14.548]] },
  'CMKBI>bangui': { km: 1500, days: [10, 20], via: 'Edéa · Yaoundé · Bertoua · Garoua-Boulaï', path: [[3.848, 11.502], [4.577, 13.685], [5.884, 14.548]] },
  'DLA>yaounde': { km: 245, days: [1, 2], via: 'Edéa (N3)' },
  'DLA>ndjamena': { km: 1800, days: [7, 15], via: 'Ngaoundéré · Garoua · Kousseri', path: [[7.327, 13.584], [9.301, 13.397], [12.077, 15.03]] },
  'DLA>bangui': { km: 1450, days: [10, 20], via: 'Yaoundé · Bertoua · Garoua-Boulaï', path: [[3.848, 11.502], [4.577, 13.685], [5.884, 14.548]] },
  'NSI>ndjamena': { km: 1560, days: [6, 14], via: 'Ngaoundéré · Garoua · Kousseri', path: [[7.327, 13.584], [9.301, 13.397], [12.077, 15.03]] },
  'NSI>bangui': { km: 1210, days: [8, 18], via: 'Bertoua · Garoua-Boulaï', path: [[4.577, 13.685], [5.884, 14.548]] },
};
/**
 * Le rail Camrail : Douala – Yaoundé, et Douala – Ngaoundéré puis la route
 * pour N'Djamena. Kribi n'est pas relié au rail.
 */
const RAIL: Record<string, { rail: Hop & { to: Place }; road?: Hop }> = {
  'CMDLA>yaounde': { rail: { km: 263, days: [1, 3], via: 'Camrail · Edéa', to: DESTINATIONS.yaounde } },
  'DLA>yaounde': { rail: { km: 263, days: [1, 3], via: 'Camrail · Edéa', to: DESTINATIONS.yaounde } },
  'CMDLA>ndjamena': {
    rail: { km: 885, days: [2, 5], via: 'Camrail · Yaoundé · Bélabo', to: NGAOUNDERE, path: [[3.848, 11.502], [4.93, 13.3]] },
    road: { km: 780, days: [4, 8], via: 'Garoua · Maroua · Kousseri', path: [[9.301, 13.397], [10.591, 14.316], [12.077, 15.03]] },
  },
  'DLA>ndjamena': {
    rail: { km: 885, days: [2, 5], via: 'Camrail · Yaoundé · Bélabo', to: NGAOUNDERE, path: [[3.848, 11.502], [4.93, 13.3]] },
    road: { km: 780, days: [4, 8], via: 'Garoua · Maroua · Kousseri', path: [[9.301, 13.397], [10.591, 14.316], [12.077, 15.03]] },
  },
};

/** Le rail existe-t-il entre cette arrivée et cette destination ? */
export const railAvailable = (arrival: string, destination: Destination) => `${arrival}>${destination}` in RAIL;

// ─── Les émissions ──────────────────────────────────────────────────────────

/**
 * kg CO2e par tonne·km, moyennes « freighting goods » DESNZ 2023 (ex-DEFRA),
 * arrondies. L'avion inclut les effets hors CO2 (forçage radiatif), comme le
 * recommande DESNZ : sans eux, compter environ la moitié.
 */
export const EMISSION_FACTORS: Record<'sea' | 'air' | 'road' | 'rail', number> = { sea: 0.016, air: 1.1, road: 0.107, rail: 0.028 };
export const EMISSIONS_SOURCE = 'DESNZ (ex-DEFRA) 2023, « freighting goods » · ISO 14083 / GLEC';
/** Convention GLEC : grand cercle + 95 km pour un vol. */
export const AIR_DETOUR_KM = 95;

// ─── Un trajet ──────────────────────────────────────────────────────────────

export interface Observed {
  n: number;
  median: number;
  p25: number;
  p75: number;
  /** Médiane du délai annoncé (ETA promise − ETD promise), quand on l'a. */
  promised_median?: number | null;
  /** Part des expéditions arrivées plus de 2 jours après la date promise. */
  late_share?: number | null;
}

export interface Leg {
  kind: LegKind;
  /** null : l'usine du fournisseur, qu'on ne situe pas. */
  from: Place | null;
  to: Place;
  km: number;
  days: [number, number];
  co2eKg: number;
  confidence: Confidence;
  path?: LatLng[];
  /** Le corridor ou la ligne (noms propres). */
  via?: string;
  observed?: Observed;
}

export interface RoutePlan {
  mode: Mode;
  inland: Inland;
  origin: Place;
  arrival: Place;
  destination: Place & { country: 'CM' | 'TD' | 'CF' };
  /** Marchandise en transit par le Cameroun : dédouanée à destination. */
  transit: boolean;
  legs: Leg[];
  days: [number, number];
  km: number;
  co2eKg: number;
  weightKg: number;
  /** Le tracé sur la carte : mer ou air, puis l'arrière-pays. */
  path: LatLng[];
  observed: Observed | null;
  /** La ligne observée : « CNNSA>CMKBI », « CAN>DLA ». */
  lane: string;
}

export interface RouteQuery {
  mode: Mode;
  /** UN/LOCODE du port (mer) ou code IATA de l'aéroport (air). */
  origin: string;
  destination: Destination;
  /** Port d'arrivée pour la mer. */
  port?: SeaPort;
  inland?: Inland;
  weightKg: number;
  observed?: Record<string, Observed>;
}

const co2 = (t: number, km: number, f: number) => Math.round(t * km * f);

/**
 * Le trajet porte-à-porte. `observed` (nos expéditions sur la même ligne)
 * remplace la fourchette de marché du tronçon principal.
 */
export function planRoute(q: RouteQuery): RoutePlan {
  const weightKg = Number.isFinite(q.weightKg) ? Math.max(0, q.weightKg) : 0;
  const t = weightKg / 1000;
  const dest = DESTINATIONS[q.destination];
  const transit = dest.country !== 'CM';
  const legs: Leg[] = [];
  let path: LatLng[];
  let origin: Place;
  let arrival: Place;

  if (q.mode === 'sea') {
    const o = SEA_ORIGINS.find((x) => x.code === q.origin) ?? SEA_ORIGINS[0];
    const port = SEA_PORTS.find((p) => p.code === q.port) ?? SEA_PORTS[0];
    origin = o; arrival = port;
    const seaPath: LatLng[] = [o.pos, ...o.toSingapore, ...TRUNK_TO_GULF, port.pos];
    const km = Math.round(pathKm(seaPath));
    const obs = q.observed?.[`${o.code}>${port.code}`];
    legs.push({ kind: 'pickup', from: null, to: o, km: 0, days: [1, 5], co2eKg: 0, confidence: 'marche' });
    legs.push({ kind: 'origin_port', from: o, to: o, km: 0, days: [3, 7], co2eKg: 0, confidence: 'marche' });
    legs.push({
      kind: 'sea', from: o, to: port, km, days: obs ? [obs.p25, obs.p75] : [35, 50], co2eKg: co2(t, km, EMISSION_FACTORS.sea),
      confidence: obs ? 'observe' : 'marche', path: seaPath, observed: obs,
    });
    legs.push({ kind: transit ? 'transit' : 'port', from: port, to: port, km: 0, days: transit ? [5, 12] : [7, 18], co2eKg: 0, confidence: 'marche' });
    path = seaPath;
  } else {
    const o = AIR_ORIGINS.find((x) => x.code === q.origin) ?? AIR_ORIGINS[0];
    const airport = q.destination === 'yaounde' ? AIRPORTS[1] : AIRPORTS[0];
    origin = o; arrival = airport;
    const km = Math.round(greatCircleKm(o.pos, airport.pos) + AIR_DETOUR_KM);
    const obs = q.observed?.[`${o.code}>${airport.code}`];
    legs.push({ kind: 'pickup', from: null, to: o, km: 0, days: [1, 3], co2eKg: 0, confidence: 'marche' });
    legs.push({
      kind: 'air', from: o, to: airport, km, days: obs ? [obs.p25, obs.p75] : [3, 8], co2eKg: co2(t, km, EMISSION_FACTORS.air),
      confidence: obs ? 'observe' : 'marche', path: [o.pos, airport.pos], observed: obs,
    });
    legs.push({ kind: transit ? 'transit' : 'port', from: airport, to: airport, km: 0, days: [2, 5], co2eKg: 0, confidence: 'marche' });
    path = [o.pos, airport.pos];
  }

  const key = `${arrival.code}>${q.destination}`;
  const byRail = q.inland === 'rail' && key in RAIL;
  if (byRail) {
    const { rail, road } = RAIL[key];
    legs.push({
      kind: 'rail', from: arrival, to: rail.to, km: rail.km, days: rail.days, co2eKg: co2(t, rail.km, EMISSION_FACTORS.rail),
      confidence: 'a_verifier', via: rail.via, path: [arrival.pos, ...(rail.path ?? []), rail.to.pos],
    });
    path = [...path, ...(rail.path ?? []), rail.to.pos];
    if (road) {
      legs.push({
        kind: 'road', from: rail.to, to: dest, km: road.km, days: road.days, co2eKg: co2(t, road.km, EMISSION_FACTORS.road),
        confidence: 'a_verifier', via: road.via, path: [rail.to.pos, ...(road.path ?? []), dest.pos],
      });
      path = [...path, ...(road.path ?? []), dest.pos];
    }
  } else if (ROAD[key]) {
    const road = ROAD[key];
    legs.push({
      kind: 'road', from: arrival, to: dest, km: road.km, days: road.days, co2eKg: co2(t, road.km, EMISSION_FACTORS.road),
      confidence: 'marche', via: road.via, path: [arrival.pos, ...(road.path ?? []), dest.pos],
    });
    path = [...path, ...(road.path ?? []), dest.pos];
  }
  if (transit) legs.push({ kind: 'final_clearance', from: dest, to: dest, km: 0, days: [3, 10], co2eKg: 0, confidence: 'marche' });

  const main = legs.find((l) => l.kind === 'sea' || l.kind === 'air')!;
  return {
    mode: q.mode, inland: byRail ? 'rail' : 'road', origin, arrival, destination: dest, transit, legs, weightKg,
    days: [legs.reduce((n, l) => n + l.days[0], 0), legs.reduce((n, l) => n + l.days[1], 0)],
    km: legs.reduce((n, l) => n + l.km, 0),
    co2eKg: legs.reduce((n, l) => n + l.co2eKg, 0),
    path,
    observed: main.observed ?? null,
    lane: `${origin.code}>${arrival.code}`,
  };
}

/** La même ville, dans l'autre mode (port ↔ aéroport). */
export const TO_AIR: Record<string, string> = { CNNSA: 'CAN', CNYTN: 'SZX', CNXMN: 'CAN', CNNGB: 'PVG', CNSHA: 'PVG', CNTAO: 'PVG' };
export const TO_SEA: Record<string, string> = { CAN: 'CNNSA', SZX: 'CNYTN', PVG: 'CNSHA', HKG: 'CNYTN' };

/** Le même envoi dans l'autre mode, pour comparer (même ville de départ, même destination, même poids). */
export function counterpart(plan: RoutePlan, observed?: Record<string, Observed>): RoutePlan {
  const destination = (Object.keys(DESTINATIONS) as Destination[]).find((k) => DESTINATIONS[k].code === plan.destination.code)!;
  return plan.mode === 'sea'
    ? planRoute({ mode: 'air', origin: TO_AIR[plan.origin.code] ?? 'CAN', destination, inland: 'road', weightKg: plan.weightKg, observed })
    : planRoute({ mode: 'sea', origin: TO_SEA[plan.origin.code] ?? 'CNNSA', destination, port: 'CMKBI', inland: 'road', weightKg: plan.weightKg, observed });
}

// ─── Les avis sur la route ──────────────────────────────────────────────────

/** Les lieux que le trajet traverse, en UN/LOCODE et en corridors (`CM-TD`). */
export function routePlaces(plan: RoutePlan): string[] {
  const out = [plan.origin.locode, plan.arrival.locode, plan.destination.locode];
  const corridor = CORRIDOR[plan.destination.code as Destination];
  if (corridor) out.push(corridor);
  return out;
}

const onRoute = (place: string, places: string[]) => places.some((p) =>
  p === place || (place.length === 2 && !p.includes('-') && p.startsWith(place)));

/** Les perturbations publiées, en cours ou à venir, sur ce trajet. */
export function noticesOnRoute(list: Notice[], plan: RoutePlan, today = new Date()): Notice[] {
  const places = routePlaces(plan);
  return list.filter((n) => n.kind === 'disruption' && n.published && phaseOf(n, today) !== 'past'
    && n.places.some((place) => onRoute(place.toUpperCase(), places)));
}

/** La ligne observée d'une expédition : port de départ > port d'arrivée. */
export const laneKey = (pol: string | null, pod: string | null) => (pol && pod ? `${pol.toUpperCase()}>${pod.toUpperCase()}` : null);
