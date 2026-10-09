// ============================================================
// Données de démonstration de sales_series (08/10) — un générateur
// DÉTERMINISTE : mêmes paramètres, même réponse, au franc près, sans
// Math.random ni horloge (aujourd'hui = 9 octobre 2026 par défaut).
//
// Trois fiches commercial :
//   · Rodrigue Tchami  (src-rodrigue, active) — premier client en décembre 2025,
//     puis une montée régulière : 20 à 55 M XAF de paiements par mois ;
//   · Carine Ewane     (src-carine, active)   — arrivée en mars 2026, plus petite ;
//   · Hervé Nkoulou    (src-herve, ARCHIVÉE)  — déjà là en 2025, en recul, partie
//     fin juin 2026 : ses mois suivants sont vides.
// Saisonnalité de l'import Chine–Cameroun : creux du Nouvel An chinois (février)
// et d'août, pointe avant les fêtes (octobre–novembre) ; dimanches calmes.
//
// La simulation se fait JOUR par JOUR (paiements, dépôts, colis avion et
// bateau, vols du mardi et du vendredi, prospects et leur sort, clients) puis
// se regroupe par mois ou par semaine : les semaines et les mois racontent la
// même histoire, et les définitions sont celles du contrat (src/hooks/useSales.ts).
//
// Usage dans un module de captures (tools/journey/<domaine>.mjs) :
//   import { salesSeriesRpc } from './salesSeriesFixture.mjs';
//   export const RPC = { sales_series: (b) => salesSeriesRpc(b) };
// ou, pour un état précis : salesSeriesResponse({ p_from, p_to, p_grain, p_source_id }, { now, sources })
//   presetBody('12m')                → le corps de la requête d'un préréglage
//   emptySalesSeries(body)           → une fiche toute neuve, sans activité
// ============================================================

export const SALES_SERIES_NOW = '2026-10-09';

/**
 * Les fiches et leur « tempérament » : début et fin d'activité, montée en
 * charge, rythmes quotidiens à plein régime, montants moyens (XAF), tendance
 * mensuelle (croissance > 1, recul < 1).
 */
export const SALES_SOURCES = [
  {
    source_id: 'src-rodrigue', label: 'Rodrigue Tchami', is_active: true, staff_user_id: 'u-rodrigue',
    start: '2025-12-01', end: null, ramp: 100, trend: 1.03,
    pay: 0.62, payMean: 1_950_000, depMean: 2_150_000, air: 0.55, sea: 0.11, prospects: 0.42, direct: 0.08,
  },
  {
    source_id: 'src-carine', label: 'Carine Ewane', is_active: true, staff_user_id: 'u-carine',
    start: '2026-03-02', end: null, ramp: 75, trend: 1.06,
    pay: 0.3, payMean: 1_350_000, depMean: 1_500_000, air: 0.32, sea: 0.05, prospects: 0.48, direct: 0.03,
  },
  {
    source_id: 'src-herve', label: 'Hervé Nkoulou', is_active: false, staff_user_id: null,
    start: '2025-03-03', end: '2026-06-26', ramp: 60, trend: 0.93,
    pay: 0.34, payMean: 1_600_000, depMean: 1_750_000, air: 0.22, sea: 0.08, prospects: 0.2, direct: 0.04,
  },
];

const DAY = 86_400_000;
const toDate = (iso) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => iso(new Date(toDate(s).getTime() + n * DAY));

export function periodStart(day, grain) {
  const d = toDate(day);
  if (grain === 'month') return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  return iso(new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY));
}
export function addPeriods(p, grain, n) {
  const d = toDate(p);
  if (grain === 'month') return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)));
  return iso(new Date(d.getTime() + n * 7 * DAY));
}
function periodsBetween(from, to, grain) {
  const out = [];
  for (let p = periodStart(from, grain); p < to && out.length < 520; p = addPeriods(p, grain, 1)) out.push(p);
  return out;
}

/** Le corps de requête d'un préréglage, période en cours comprise (comme rangeForPreset de src/lib/salesSeries.ts). */
export function presetBody(preset, { now = SALES_SERIES_NOW, sourceId = null } = {}) {
  const [grain, count] = { '3m': ['month', 3], '6m': ['month', 6], '12m': ['month', 12], '12w': ['week', 12] }[preset] ?? ['month', 12];
  const current = periodStart(now, grain);
  return { p_from: addPeriods(current, grain, -(count - 1)), p_to: addPeriods(current, grain, 1), p_grain: grain, p_source_id: sourceId };
}

// ── Hasard reproductible : une graine par (fiche, jour) ──
function fnv(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function poisson(r, lambda) {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do { k++; p *= r(); } while (p > L && k < 50);
  return k - 1;
}
/** Une loi log-normale autour de `mean` (écart `spread`), bornée. */
function around(r, mean, spread, lo, hi) {
  const g = Math.sqrt(-2 * Math.log(Math.max(r(), 1e-9))) * Math.cos(2 * Math.PI * r());
  return Math.min(hi, Math.max(lo, mean * Math.exp(spread * g - (spread * spread) / 2)));
}

// Janvier … décembre : Nouvel An chinois en février, août calme, pointe avant les fêtes.
const SEASON = [0.95, 0.5, 0.88, 1.0, 1.05, 1.0, 0.86, 0.58, 1.08, 1.18, 1.22, 1.02];
// Dimanche … samedi.
const WEEKDAY = [0.18, 1.08, 1.12, 1.1, 1.08, 1.05, 0.62];

function level(src, day) {
  if (day < src.start || (src.end && day > src.end)) return 0;
  const d = toDate(day);
  const since = (d - toDate(src.start)) / DAY;
  const ramp = Math.min(1, 0.25 + 0.75 * (since / src.ramp));
  const months = since / 30.4;
  return ramp * src.trend ** months * SEASON[d.getUTCMonth()] * WEEKDAY[d.getUTCDay()];
}

const isFlightDay = (day) => [2, 5].includes(toDate(day).getUTCDay()); // mardi, vendredi

/** La vie d'une fiche, jour par jour, de son début jusqu'à `now` (mise en cache). */
const CACHE = new Map();
function simulate(src, now) {
  const k = `${src.source_id}|${now}|${src.start}|${src.end}`;
  if (CACHE.has(k)) return CACHE.get(k);
  const days = [];
  const prospects = [];
  const conversions = new Map(); // jour → nombre de prospects devenus clients
  // 1er passage : les prospects et leur sort (le sort peut tomber après `now` : ils restent ouverts).
  for (let day = src.start; day <= now; day = addDays(day, 1)) {
    const r = rng(fnv(`${src.source_id}|p|${day}`));
    const n = poisson(r, level(src, day) * src.prospects);
    for (let i = 0; i < n; i++) {
      const u = r();
      let status;
      let at = null;
      if (u < 0.24) { status = 'won'; at = addDays(day, 8 + Math.floor(r() * 50)); }
      else if (u < 0.52) { status = 'lost'; at = addDays(day, 6 + Math.floor(r() * 40)); }
      else if (u < 0.56) status = 'to_verify';
      else status = ['new', 'contacted', 'contacted', 'interested', 'interested'][Math.floor(r() * 5)];
      if (at && at > now) status = r() < 0.5 ? 'contacted' : 'interested';
      if (src.end && at && at > src.end) status = 'lost';
      prospects.push({ created: day, status, at: status === 'won' || status === 'lost' ? at : null });
      if (status === 'won') conversions.set(at, (conversions.get(at) ?? 0) + 1);
    }
  }
  // 2e passage : clients, paiements, dépôts, colis.
  let clients = 0;
  for (let day = src.start; day <= now; day = addDays(day, 1)) {
    const r = rng(fnv(`${src.source_id}|d|${day}`));
    const lv = level(src, day);
    const newClients = poisson(r, lv * src.direct) + (conversions.get(day) ?? 0) + (day === src.start ? 2 : 0);
    clients += newClients;
    const e = { day, newClients, clientsEnd: clients, pay: [], dep: [], air: [], sea: [], who: new Set() };
    if (clients > 0) {
      const pick = () => Math.floor(r() * clients);
      for (let i = poisson(r, lv * src.pay); i > 0; i--) { e.pay.push(Math.round(around(r, src.payMean, 0.55, 180_000, 9_500_000) / 5000) * 5000); e.who.add(pick()); }
      for (let i = poisson(r, lv * src.pay * 0.82); i > 0; i--) { e.dep.push(Math.round(around(r, src.depMean, 0.5, 200_000, 12_000_000) / 5000) * 5000); e.who.add(pick()); }
      for (let i = poisson(r, lv * src.air); i > 0; i--) { e.air.push(Math.round(around(r, 17, 0.55, 3, 48) * 2) / 2); e.who.add(pick()); }
      for (let i = poisson(r, lv * src.sea); i > 0; i--) { e.sea.push(Math.round(around(r, 1.4, 0.6, 0.25, 4.5) * 100) / 100); e.who.add(pick()); }
    }
    days.push(e);
  }
  const byDay = new Map(days.map((d) => [d.day, d]));
  // Un vol emporte les colis enregistrés depuis le vol précédent (jour du vol précédent compris).
  const flights = new Set();
  for (const d of days) {
    if (!isFlightDay(d.day)) continue;
    for (let back = 1; back <= 4; back++) {
      const prev = addDays(d.day, -back);
      if (byDay.get(prev)?.air.length) flights.add(d.day);
      if (isFlightDay(prev)) break;
    }
  }
  const out = { byDay, prospects, flights };
  CACHE.set(k, out);
  return out;
}

const KEYS = ['clients_total', 'new_clients', 'active_clients', 'prospects_new', 'prospects_won', 'prospects_lost', 'payments_xaf', 'payments_count',
  'deposits_xaf', 'deposits_count', 'air_parcels', 'air_kg', 'flights', 'sea_parcels', 'sea_cbm'];
const zero = () => Object.fromEntries(KEYS.map((k) => [k, 0]));
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

/** Les chiffres de [from, to[ pour une fiche simulée (définitions du contrat). */
function aggregate(sim, src, from, to, now) {
  const t = zero();
  const who = new Set();
  let lastClients = 0;
  for (let day = src.start < from ? from : src.start; day < to && day <= now; day = addDays(day, 1)) {
    const e = sim.byDay.get(day);
    if (!e) continue;
    t.new_clients += e.newClients;
    t.payments_count += e.pay.length;
    t.payments_xaf += e.pay.reduce((a, b) => a + b, 0);
    t.deposits_count += e.dep.length;
    t.deposits_xaf += e.dep.reduce((a, b) => a + b, 0);
    t.air_parcels += e.air.length;
    t.air_kg += e.air.reduce((a, b) => a + b, 0);
    t.sea_parcels += e.sea.length;
    t.sea_cbm += e.sea.reduce((a, b) => a + b, 0);
    for (const w of e.who) who.add(w);
    if (sim.flights.has(day)) t.flights += 1;
  }
  // Le parc à la fin de la période (ou aujourd'hui pour la période en cours).
  const lastDay = addDays(to, -1) < now ? addDays(to, -1) : now;
  for (let day = lastDay; day >= src.start; day = addDays(day, -1)) {
    const e = sim.byDay.get(day);
    if (e) { lastClients = e.clientsEnd; break; }
  }
  t.clients_total = lastDay < src.start ? 0 : lastClients;
  t.active_clients = who.size;
  for (const p of sim.prospects) {
    if (p.created >= from && p.created < to) t.prospects_new += 1;
    if (p.status === 'won' && p.at >= from && p.at < to && p.at <= now) t.prospects_won += 1;
    if (p.status === 'lost' && p.at >= from && p.at < to && p.at <= now) t.prospects_lost += 1;
  }
  t.air_kg = round(t.air_kg, 1);
  t.sea_cbm = round(t.sea_cbm, 2);
  return t;
}

function funnel(sim, from, to) {
  const f = { total: 0, new: 0, contacted: 0, interested: 0, to_verify: 0, won: 0, lost: 0 };
  for (const p of sim.prospects) {
    if (p.created < from || p.created >= to) continue;
    f.total += 1;
    f[p.status] += 1;
  }
  return f;
}

const sum = (list) => {
  const t = zero();
  for (const x of list) for (const k of KEYS) t[k] += x[k] ?? 0;
  t.air_kg = round(t.air_kg, 1);
  t.sea_cbm = round(t.sea_cbm, 2);
  return t;
};

/**
 * La réponse de sales_series(p_from, p_to, p_grain, p_source_id) :
 * { success: true, grain, from, to, periods, sources, team }.
 * Options : `now` (« AAAA-MM-JJ »), `sources` (d'autres fiches, même forme que SALES_SOURCES).
 */
export function salesSeriesResponse(body = {}, { now = SALES_SERIES_NOW, sources = SALES_SOURCES } = {}) {
  const grain = body.p_grain === 'week' ? 'week' : body.p_grain === 'month' || body.p_grain == null ? 'month' : null;
  if (!grain) return { success: false, error: 'Grain inconnu : month ou week' };
  const def = presetBody('12m', { now });
  const from = periodStart(body.p_from ?? def.p_from, grain);
  const to = body.p_to ?? def.p_to;
  if (!(from < to)) return { success: false, error: 'Plage vide' };
  const periods = periodsBetween(from, to, grain);
  const prevFrom = addPeriods(from, grain, -periods.length);
  const chosen = body.p_source_id ? sources.filter((s) => s.source_id === body.p_source_id) : sources;
  if (body.p_source_id && !chosen.length) return { success: false, error: 'Fiche commercial introuvable' };
  const out = chosen.map((src) => {
    const sim = simulate(src, now);
    return {
      source_id: src.source_id,
      label: src.label,
      is_active: src.is_active,
      staff_user_id: src.staff_user_id ?? null,
      points: periods.map((p) => ({ period: p, ...aggregate(sim, src, p, addPeriods(p, grain, 1), now) })),
      totals: aggregate(sim, src, from, to, now),
      previous_totals: aggregate(sim, src, prevFrom, from, now),
      funnel: funnel(sim, from, to),
    };
  });
  const sumFunnel = (list) => list.reduce((f, x) => { for (const k of Object.keys(f)) f[k] += x[k]; return f; }, { total: 0, new: 0, contacted: 0, interested: 0, to_verify: 0, won: 0, lost: 0 });
  return {
    success: true,
    grain,
    from,
    to,
    periods,
    sources: out,
    team: {
      points: periods.map((p, i) => ({ period: p, ...sum(out.map((s) => s.points[i])) })),
      totals: sum(out.map((s) => s.totals)),
      previous_totals: sum(out.map((s) => s.previous_totals)),
      funnel: sumFunnel(out.map((s) => s.funnel)),
    },
  };
}

/** Le gestionnaire de RPC pour tools/shoot-journey.mjs : `RPC.sales_series = salesSeriesRpc`. */
export const salesSeriesRpc = (body) => salesSeriesResponse(body);

/** Une fiche toute neuve (créée aujourd'hui) : tout à zéro — l'état « Pas encore d'activité ». */
export function emptySalesSeries(body = {}, { now = SALES_SERIES_NOW } = {}) {
  return salesSeriesResponse({ ...body, p_source_id: null }, {
    now,
    sources: [{ ...SALES_SOURCES[0], source_id: 'src-bertrand', label: 'Bertrand Fouda', staff_user_id: 'u-bertrand', start: addDays(now, 1), end: null }],
  });
}
