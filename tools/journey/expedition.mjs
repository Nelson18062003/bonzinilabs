// ============================================================
// Parcours — domaine « expedition » : l'organisation des départs, faite au
// bureau par Grace Ebogo (ops et cargo), sur ordinateur et sur téléphone.
//   node tools/shoot-journey.mjs expedition [écran…]
//
// L'histoire (lundi 05/10/2026) :
//   · le vol Ethiopian ET 607 du dimanche 04/10 (LTA 071-55120925) est parti ;
//     ce matin, le transitaire signale que l'aéroport a refusé le paquet
//     PQ-000039 : Grace le déclare et rappelle les deux clients prévenus ;
//   · le vol ET 607 du mardi 06/10 (LTA 071-55120936) se prépare : les
//     paquets PQ-000041 à PQ-000045 y sont affectés, 3 sont déjà remis au
//     transitaire (scannés), 2 restent — l'avion ne peut pas « partir » ;
//   · le vol ET 607 du 13/10 est ouvert sans LTA (« LTA à venir ») ;
//   · le conteneur MIEU3611115 est déchargé à Kribi, Maersk ne l'a pas dit.
// Les réponses ont la forme EXACTE des RPC (20261005170000_air_packages.sql :
// cargo_air_json, air_package_json ; 20261005150000 : cargo_mark_shipment_arrived).
// ============================================================
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const OUT_DIR = process.env.OUT ?? 'tools/out/journey/expedition';
// Un navigateur réglé en français, comme les téléphones et les ordinateurs du bureau : les
// champs date et heure s'affichent jj/mm/aaaa et 16:30 (et non 10/13/2026, 04:30 PM).
// Chromium lit ces variables à son lancement, que shoot-journey.mjs fait juste après l'import de ce module.
Object.assign(process.env, { LANG: 'fr_FR.UTF-8', LANGUAGE: 'fr_FR:fr', LC_ALL: 'fr_FR.UTF-8' });
/** Heure de Guangzhou (UTC+8) → ISO UTC. */
const gz = (month, day, h, m = 0) => new Date(Date.UTC(2026, month - 1, day, h - 8, m)).toISOString();

/* ── Les clients (fiche reception_client_card) ─────────────────────────── */
const card = (o) => ({ email: null, company_name: null, account_id: null, account_name: null, account_code: null, ...o });
const aicha = card({ user_id: 'u-aicha', customer_code: 'BZ-482913', first_name: 'Aïcha', last_name: 'Mbarga', phone: '+237 677 12 34 56', email: 'aicha@mbarga-import.cm', company_name: 'Mbarga Import SARL', city: 'Douala', country: 'Cameroun' });
const samuel = card({ user_id: 'u-samuel', customer_code: 'BZ-510224', first_name: 'Samuel', last_name: 'Ondo', phone: '+241 66 55 44 33', company_name: 'Ondo Distribution', city: 'Libreville', country: 'Gabon' });
const nadia = card({ user_id: 'u-nadia', customer_code: 'BZ-207781', first_name: 'Nadia', last_name: 'Fotso', phone: '+237 699 88 77 66', city: 'Yaoundé', country: 'Cameroun' });

/* ── Les dépôts et leurs devis (6 500 XAF le kilo en avion) ───────────── */
const deposits = {
  'RC-000114': { id: 'dep-114', client: samuel, opened_at: gz(9, 30, 10, 12), quote: { status: 'invoiced', quote_no: 'DV-000024', paid: 1, invoice_no: 'FA-000009' } },
  'RC-000115': { id: 'dep-115', client: aicha, opened_at: gz(10, 1, 9, 40), quote: { status: 'paid', quote_no: 'DV-000025', paid: 1 } },
  'RC-000116': { id: 'dep-116', client: aicha, opened_at: gz(10, 1, 15, 5), quote: { status: 'paid', quote_no: 'DV-000026', paid: 1 } },
  'RC-000117': { id: 'dep-117', client: nadia, opened_at: gz(10, 2, 9, 20), quote: { status: 'sent', quote_no: 'DV-000027', paid: 0.5 } },
  'RC-000118': { id: 'dep-118', client: samuel, opened_at: gz(10, 2, 10, 2), quote: { status: 'invoiced', quote_no: 'DV-000028', paid: 1, invoice_no: 'FA-000011' } },
  'RC-000120': { id: 'dep-120', client: nadia, opened_at: gz(10, 2, 11, 47), quote: { status: 'sent', quote_no: 'DV-000030', paid: 0 } },
  'RC-000121': { id: 'dep-121', client: samuel, opened_at: gz(10, 2, 13, 10), quote: { status: 'invoiced', quote_no: 'DV-000032', paid: 1, invoice_no: 'FA-000013' } },
  'RC-000122': { id: 'dep-122', client: aicha, opened_at: gz(10, 2, 14, 1), quote: { status: 'paid', quote_no: 'DV-000031', paid: 1 } },
  'RC-000123': { id: 'dep-123', client: aicha, opened_at: gz(10, 3, 10, 5), quote: { status: 'invoiced', quote_no: 'DV-000033', paid: 1, invoice_no: 'FA-000014' } },
};

/** [dépôt, n°, kg, contenu, [L, l, h], paquet] — un colis reçu au bureau de Guangzhou. */
const RAW = [
  // Vol ET 607 du 04/10 (parti) : PQ-000036 à PQ-000040
  ['RC-000115', 1, 9.2, 'Chaussures, 40 paires', [60, 40, 40], 36], ['RC-000115', 2, 11.8, 'Tissus wax', [80, 50, 30], 36], ['RC-000115', 3, 6.4, 'Sacs à main, 30 pièces', [60, 40, 35], 36],
  ['RC-000115', 4, 8.6, 'Chaussures, 40 paires', [60, 40, 40], 37], ['RC-000116', 1, 12.4, 'Tissus wax', [80, 50, 30], 37], ['RC-000116', 2, 7.1, 'Ceintures en cuir', [50, 35, 30], 37],
  ['RC-000114', 1, 13.5, 'Lunettes de soleil', [60, 45, 40], 38], ['RC-000114', 2, 12.9, 'Montres, 150 pièces', [55, 40, 40], 38],
  ['RC-000117', 1, 10.5, 'Perruques', [60, 40, 45], 39], ['RC-000118', 1, 8.0, 'Montres, 100 pièces', [50, 40, 35], 39], ['RC-000118', 2, 7.2, 'Lunettes de soleil', [50, 40, 30], 39],
  ['RC-000116', 3, 14.6, 'Tissus wax', [80, 50, 35], 40], ['RC-000117', 2, 9.8, 'Cosmétiques', [50, 40, 40], 40],
  // Vol ET 607 du 06/10 (en préparation) : PQ-000041 à PQ-000045
  ['RC-000122', 1, 8.4, 'Chaussures, 40 paires', [60, 40, 40], 41], ['RC-000122', 2, 12.1, 'Tissus wax', [80, 50, 30], 41], ['RC-000122', 3, 6.2, 'Sacs à main, 30 pièces', [60, 40, 35], 41],
  ['RC-000122', 4, 8.4, 'Chaussures, 40 paires', [60, 40, 40], 42], ['RC-000122', 5, 9.8, 'Tissus wax', [70, 50, 30], 42], ['RC-000123', 1, 5.6, 'Montres, 120 pièces', [40, 30, 30], 42],
  ['RC-000121', 1, 7.0, 'Coques et écouteurs', [50, 40, 35], 43], ['RC-000121', 2, 7.0, 'Montres, 100 pièces', [50, 40, 35], 43], ['RC-000121', 3, 7.0, 'Lunettes de soleil', [50, 40, 35], 43],
  ['RC-000120', 1, 9.6, 'Perruques', [60, 40, 45], 44], ['RC-000120', 2, 11.2, 'Cosmétiques', [50, 40, 40], 44], ['RC-000121', 4, 6.8, 'Chargeurs et câbles', [45, 35, 30], 44],
  ['RC-000123', 2, 12.1, 'Tissus wax', [80, 50, 30], 45], ['RC-000123', 3, 6.2, 'Sacs à main, 30 pièces', [60, 40, 35], 45], ['RC-000120', 3, 3.4, 'Bijoux fantaisie', [30, 25, 20], 45],
];

const pq = (n) => `PQ-${String(n).padStart(6, '0')}`;
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
/** Le devis d'un dépôt : le kilo × 6 500 XAF sur ses colis. */
const depositKg = (no) => RAW.filter((r) => r[0] === no).reduce((t, r) => t + r[2], 0);
const quoteOf = (no) => {
  const d = deposits[no]; const total = Math.round(depositKg(no) * 6500);
  const paid = d.quote.paid >= 1 ? total : Math.round((total * d.quote.paid) / 5000) * 5000;
  return { quote_status: d.quote.status, quote_no: d.quote.quote_no, quote_total_xaf: total, quote_paid_xaf: paid, invoice_no: d.quote.invoice_no ?? null };
};

/* ── Les vols ─────────────────────────────────────────────────────────── */
const FLIGHTS = {
  'et607-0404': { awb: '07155120925', status: 'DEPARTED', etd: '2026-10-04', eta: '2026-10-05', departed_at: gz(10, 4, 14, 35), created_at: gz(9, 29, 9, 30), freight_usd: 780, packages: [36, 37, 38, 39, 40], notes: 'Remise des paquets au transitaire la veille, avant 16 h.' },
  et607: { awb: '07155120936', status: 'PLANNED', etd: '2026-10-06', eta: '2026-10-07', departed_at: null, created_at: gz(10, 1, 9, 10), freight_usd: 740, packages: [41, 42, 43, 44, 45], notes: 'Remise des paquets au transitaire la veille, avant 16 h.' },
  'et607-vide': { awb: '07155120936', status: 'PLANNED', etd: '2026-10-06', eta: '2026-10-07', departed_at: null, created_at: gz(10, 1, 9, 10), freight_usd: 740, packages: [], notes: 'Remise des paquets au transitaire la veille, avant 16 h.' },
  'et607-1013': { awb: 'PROV-7KQ2D9', status: 'PLANNED', etd: '2026-10-13', eta: '2026-10-14', departed_at: null, created_at: gz(10, 5, 10, 20), freight_usd: null, packages: [], notes: 'LTA à demander au transitaire dès la réservation.' },
};
// « et607-vide » : le même vol du 06/10, plus tôt ce matin, avant l'affectation des paquets.
const realId = (id) => (id === 'et607-vide' ? 'et607' : id);

/* ── L'état simulé (scan au départ, refus) : remis à zéro avant chaque écran ── */
const state = { scanned: new Set(), refused: new Set() };

/**
 * DM Sans servie depuis node_modules/@fontsource (Google Fonts passe par le proxy et
 * échoue par moments : la page retombait alors sur une police de secours).
 */
const FONT_DIR = 'node_modules/@fontsource/dm-sans/files';
const FONT_CSS = [400, 500, 600, 700, 800, 900].flatMap((w) => ['latin', 'latin-ext'].map((sub) =>
  `@font-face{font-family:'DM Sans';font-style:normal;font-weight:${w};font-display:block;src:url(https://fonts.local/dm-sans-${sub}-${w}-normal.woff2) format('woff2');${sub === 'latin-ext' ? 'unicode-range:U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;' : ''}}`)).join('\n');
async function reset(page) {
  state.scanned = new Set(); state.refused = new Set();
  await page.route(/fonts\.googleapis\.com\/css2/, (r) => r.fulfill({ status: 200, contentType: 'text/css', headers: { 'access-control-allow-origin': '*' }, body: FONT_CSS }));
  await page.route(/fonts\.local\//, (r) => r.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' }, path: join(FONT_DIR, r.request().url().split('/').pop()) }));
}

/** Les paquets remis au transitaire (scannés au départ) avant l'écran : PQ-000041 à 43 ce matin, et tout le vol du 04/10. */
const HANDED = { 36: gz(10, 3, 14, 2), 37: gz(10, 3, 14, 4), 38: gz(10, 3, 14, 5), 39: gz(10, 3, 14, 7), 40: gz(10, 3, 14, 9), 41: gz(10, 5, 9, 12), 42: gz(10, 5, 9, 14), 43: gz(10, 5, 9, 15) };
const SEALED = { 36: gz(10, 2, 16, 40), 37: gz(10, 2, 17, 5), 38: gz(10, 2, 17, 20), 39: gz(10, 3, 9, 50), 40: gz(10, 3, 10, 30), 41: gz(10, 3, 16, 10), 42: gz(10, 3, 16, 45), 43: gz(10, 4, 10, 20), 44: gz(10, 4, 11, 5), 45: gz(10, 4, 15, 30), 46: null };
const GROSS = { 36: 28.6, 37: 29.4, 38: 27.6, 39: 26.9, 40: 25.7, 41: 27.9, 42: 25.0, 43: 22.3, 44: 28.9, 45: 23.0 };
const DIMS = { 36: [80, 60, 60], 37: [80, 60, 60], 38: [70, 60, 55], 39: [70, 60, 55], 40: [80, 60, 55], 41: [80, 60, 60], 42: [80, 60, 55], 43: [70, 55, 50], 44: [80, 60, 60], 45: [80, 60, 55] };
const REFUSAL = 'Emballage abîmé (carton écrasé au contrôle), à refaire';

/** Où se trouve un paquet, selon l'écran. */
function packageAir(n) {
  if (state.refused.has(n) || n === 46) return null;
  for (const [id, f] of Object.entries(FLIGHTS)) if (id !== 'et607-vide' && f.packages.includes(n)) return id;
  return null;
}

/* ── Les colis (forme cargo_air_json · parcels[]) ─────────────────────── */
function parcelRow(r, airId) {
  const [no, seq, kg, desc, [L, W, H], pk] = r;
  const d = deposits[no]; const f = airId ? FLIGHTS[airId] : null;
  return {
    id: `${no}-${seq}`, seq, parcel_no: `${no}-${String(seq).padStart(2, '0')}`, kind: 'carton', weight_kg: kg,
    length_cm: L, width_cm: W, height_cm: H, cbm: round((L * W * H) / 1e6, 3),
    description: desc, courier_waybill: null, photo_path: `${d.id}/carton-${seq}.jpg`,
    status: !f ? 'received' : f.status === 'DEPARTED' ? 'shipped' : 'loaded',
    shipment_id: null, air_shipment_id: airId ? realId(airId) : null, awb_number: f?.awb ?? null, created_at: d.opened_at,
    air_package_id: `pkg-${pk}`, package_no: pq(pk),
    checked_in_at: null, warehouse_location: null, condition: null, condition_note: null, delivered_at: null, release_id: null,
    deposit_no: no, deposit_id: d.id, location: 'office', opened_at: d.opened_at,
    client: d.client, ...quoteOf(no),
  };
}
const parcelsOfPackage = (n) => RAW.filter((r) => r[5] === n);

/* ── Les paquets (forme air_package_json) ─────────────────────────────── */
function packageJson(n, { withParcels = false, forAir } = {}) {
  const rows = parcelsOfPackage(n);
  const airId = forAir !== undefined ? forAir : packageAir(n);
  const f = airId ? FLIGHTS[airId] : null;
  const refused = state.refused.has(n) || (n === 39 && forAir === null);
  const handed = !refused && !!airId && (HANDED[n] && airId !== 'et607-vide' || state.scanned.has(n));
  const status = n === 46 ? 'open' : refused ? 'refused' : handed ? 'handed_over' : 'sealed';
  const clients = new Set(rows.map((r) => deposits[r[0]].client.user_id));
  return {
    id: `pkg-${n}`, package_no: pq(n), status,
    air_shipment_id: airId && !refused ? realId(airId) : null, awb_number: f && !refused ? f.awb : null, air_status: f && !refused ? f.status : null, etd: f && !refused ? f.etd : null, flight_no: f && !refused ? 'ET 607' : null,
    max_weight_kg: 32, gross_weight_kg: n === 46 ? null : GROSS[n], length_cm: DIMS[n]?.[0] ?? null, width_cm: DIMS[n]?.[1] ?? null, height_cm: DIMS[n]?.[2] ?? null, notes: null,
    net_weight_kg: round(rows.reduce((t, r) => t + r[2], 0)), parcel_count: rows.length, client_count: clients.size, checked_count: 0, missing_count: 0,
    sealed_at: SEALED[n] ?? null, handed_over_at: handed ? (HANDED[n] ?? gz(10, 5, 15, 2)) : null,
    refused_at: refused ? gz(10, 5, 9, 5) : null, refusal_reason: refused ? REFUSAL : null, refused_air_shipment_id: refused ? 'et607-0404' : null,
    received_at: null, opened_at: null, created_at: SEALED[n] ? new Date(Date.parse(SEALED[n]) - 3 * 3600_000).toISOString() : gz(10, 5, 11, 30), updated_at: gz(10, 5, 9, 15),
    parcels: withParcels ? rows.map((r) => {
      const p = parcelRow(r, null);
      return { id: p.id, seq: p.seq, parcel_no: p.parcel_no, kind: p.kind, weight_kg: p.weight_kg, cbm: p.cbm, description: p.description, status: p.status, photo_path: p.photo_path, checked_in_at: null, warehouse_location: null, condition: null, delivered_at: null, deposit_no: p.deposit_no, deposit_id: p.deposit_id, client: p.client };
    }) : null,
  };
}

/* ── Une expédition (forme cargo_air_json) ────────────────────────────── */
function airJson(id, withParcels = true) {
  const f = FLIGHTS[id];
  const pkgs = f.packages.filter((n) => !state.refused.has(n));
  const rows = RAW.filter((r) => pkgs.includes(r[5]));
  // L'ordre de la base : par client, puis dépôt, puis colis — Aïcha, Samuel, Nadia.
  const order = [aicha.user_id, samuel.user_id, nadia.user_id];
  const parcels = rows.map((r) => parcelRow(r, id)).sort((a, b) => order.indexOf(a.client.user_id) - order.indexOf(b.client.user_id) || a.opened_at.localeCompare(b.opened_at) || a.seq - b.seq);
  const packages = pkgs.map((n) => packageJson(n, { forAir: id }));
  return {
    id: realId(id), awb_number: f.awb, awb_provisional: f.awb.startsWith('PROV-'), airline: 'Ethiopian Airlines', flight_no: 'ET 607',
    origin: 'Guangzhou (CAN)', destination: 'Douala (DLA)', status: f.status,
    etd: f.etd, eta: f.eta, departed_at: f.departed_at, arrived_at: null, delivered_at: null,
    freight_usd: f.freight_usd, notes: f.notes, created_at: f.created_at, updated_at: gz(10, 5, 9, 15),
    parcel_count: parcels.length, total_weight_kg: round(parcels.reduce((t, p) => t + p.weight_kg, 0)), total_cbm: round(parcels.reduce((t, p) => t + p.cbm, 0), 3),
    client_count: new Set(parcels.map((p) => p.client.user_id)).size,
    unpaid_count: parcels.filter((p) => !p.quote_total_xaf || p.quote_paid_xaf < p.quote_total_xaf).length,
    checked_count: 0, missing_count: 0, delivered_count: 0,
    package_count: packages.length, packages_handed_over: packages.filter((k) => k.status === 'handed_over').length, packages_received: 0,
    packages, parcels: withParcels ? parcels : null,
  };
}

/** Le vol du 28/09, arrivé à Douala et en cours de remise (pour la liste). */
const arrived0928 = {
  id: 'et607-0928', awb_number: '07155120914', awb_provisional: false, airline: 'Ethiopian Airlines', flight_no: 'ET 607', origin: 'Guangzhou (CAN)', destination: 'Douala (DLA)', status: 'ARRIVED',
  etd: '2026-09-28', eta: '2026-09-29', departed_at: gz(9, 28, 14, 30), arrived_at: '2026-09-29T13:15:00Z', delivered_at: null, freight_usd: 690, notes: null, created_at: gz(9, 24, 9, 0), updated_at: '2026-10-02T10:00:00Z',
  parcel_count: 11, total_weight_kg: 96.2, total_cbm: 0.82, client_count: 3, unpaid_count: 0, checked_count: 11, missing_count: 0, delivered_count: 7,
  package_count: 4, packages_handed_over: 0, packages_received: 4, packages: [], parcels: null,
};

const listJson = () => [airJson('et607-0404', false), airJson('et607-1013', false), airJson('et607', false), arrived0928];

/* ── Le conteneur MIEU3611115 (table cargo_shipments, comme mockCargo.ts) ── */
const CONTAINER = {
  id: 'ct-mieu', client_label: 'GAUSS', client_id: null, carrier: 'MAERSK', bl_number: '274428633', container_number: 'MIEU3611115', container_iso: '45G1',
  pol_name: 'Nansha', pol_unlocode: 'CNNSA', pod_name: 'Kribi', pod_unlocode: 'CMKBI',
  etd_promised: '2026-08-15', eta_promised: '2026-09-27', etd_actual: '2026-08-15T23:38:00Z', eta_carrier: '2026-10-11T10:00:00Z',
  vessel_name: 'CMA CGM LAPEROUSE', vessel_imo: '9454412', vessel_mmsi: '215930000', voyage: '631W', freight_usd: 6550, freight_paid: true, telex_released: false,
  status: 'AT_SEA', last_event_at: '2026-08-15T23:38:00Z', last_event_label: 'Navire parti', last_synced_at: '2026-10-05T05:40:00Z', sync_error: null,
  notes: 'Groupage Bonzini : chargé par notre entrepôt de Guangzhou. Transitaire : Eric (KASSUMAYE PARTNER SARL), chargeur sur le B/L.',
  goods_description: 'Véhicules et effets (groupage)', gross_weight_kg: 22170, packages_count: 80, freight_note: null,
  arrival_notice_at: null, besc_number: 'MI2661716', customs_cleared_at: null, customs_declaration_ref: null, delivery_order_at: null, empty_returned_at: null, free_time_ends_on: null, gate_out_at: null,
  eta_manual: '2026-10-03T21:00:00Z', eta_manual_at: '2026-10-03T22:00:00Z',
  eta_manual_note: 'Au mouillage devant Kribi le 03/10 au soir (Flexport Atlas). Escale prévue du 03 au 04/10. Maersk annonce toujours le 11/10.',
  route_calls: [
    { id: 'nsa', name: 'Nansha', unlocode: 'CNNSA', atd: '2026-08-15T23:38:00Z', note: 'Départ du navire (Maersk).' },
    { id: 'abj', name: 'Abidjan', unlocode: 'CIABJ', atd: '2026-10-01T17:40:00Z', note: 'Départ relevé sur VesselFinder.' },
    { id: 'kbi', name: 'Kribi', unlocode: 'CMKBI', ata: '2026-10-03', eta: '2026-10-03', etd: '2026-10-04', note: 'Au mouillage le 03/10 au soir. Escale du 03 au 04/10 : notre conteneur est déchargé ici.' },
    { id: 'lkk', name: 'Lekki', unlocode: 'NGLKK', eta: '2026-10-07', etd: '2026-10-11', after: true, note: 'Escale suivante du navire.' },
  ],
  created_at: '2026-08-12T09:00:00Z', updated_at: '2026-10-05T05:40:00Z',
};
const ev = (id, code, type, time, classifier = 'ACT', location = 'GZ Oceangate Container Terminal', vessel = null, created = time) => ({
  id, shipment_id: 'ct-mieu', carrier_event_id: id, event_type: type, event_code: code, classifier, event_time: time, location_name: location,
  unlocode: location?.startsWith('Kribi') ? 'CMKBI' : 'CNNSA', latitude: null, longitude: null, vessel_name: vessel, vessel_imo: vessel ? '9454412' : null, voyage: vessel ? '631W' : null,
  raw: code === 'GTOT' ? { emptyIndicatorCode: 'EMPTY' } : code === 'GTIN' ? { emptyIndicatorCode: 'LADEN' } : null, created_at: created,
});
const EVENTS = [
  ev('e1', 'CONF', 'SHIPMENT', '2026-07-16T09:10:43Z', 'ACT', null),
  ev('e2', 'GTOT', 'EQUIPMENT', '2026-08-01T18:42:00Z'),
  ev('e3', 'GTIN', 'EQUIPMENT', '2026-08-02T18:24:00Z'),
  ev('e4', 'RECE', 'SHIPMENT', '2026-08-11T03:46:11Z', 'ACT', null),
  ev('e5', 'DRFT', 'SHIPMENT', '2026-08-11T03:46:22Z', 'ACT', null),
  ev('e6', 'LOAD', 'EQUIPMENT', '2026-08-15T15:25:00Z', 'ACT', 'GZ Oceangate Container Terminal', 'CMA CGM LAPEROUSE'),
  ev('e7', 'DEPA', 'TRANSPORT', '2026-08-15T23:38:00Z', 'ACT', 'GZ Oceangate Container Terminal', 'CMA CGM LAPEROUSE'),
  ev('e8', 'ARRI', 'TRANSPORT', '2026-10-03T08:00:00Z', 'EST', 'Kribi Port', 'CMA CGM LAPEROUSE', '2026-08-16T02:00:00Z'),
  ev('e9', 'ARRI', 'TRANSPORT', '2026-10-07T08:00:00Z', 'EST', 'Kribi Port', 'CMA CGM LAPEROUSE', '2026-09-20T02:00:00Z'),
  ev('e10', 'ARRI', 'TRANSPORT', '2026-10-11T10:00:00Z', 'EST', 'Kribi Port', 'CMA CGM LAPEROUSE', '2026-10-02T02:00:00Z'),
];

/* ── Les lectures directes (REST) ─────────────────────────────────────── */
export function REST(url, method) {
  if (method !== 'GET') return undefined;
  if (url.includes('/rest/v1/cargo_shipments')) return url.includes('id=eq.') && !url.includes('id=eq.ct-mieu') ? [] : [CONTAINER];
  if (url.includes('/rest/v1/cargo_events')) return EVENTS;
  if (url.includes('/rest/v1/cargo_vessel_positions')) return [{ vessel_imo: '9454412', vessel_mmsi: '215930000', vessel_name: 'CMA CGM LAPEROUSE', latitude: 2.79, longitude: 9.68, speed_kn: null, course_deg: null, destination: 'CMKBI', eta: null, reported_at: '2026-10-03T20:35:00Z', source: 'manual', updated_at: '2026-10-03T22:00:00Z', note: 'Au mouillage devant Kribi (Flexport Atlas, 03/10).' }];
  if (/\/rest\/v1\/cargo_(documents|doc_folders|shipment_parties|packages|costs|steps|lookups|parties)/.test(url)) return [];
  return undefined;
}

/* ── Les RPC ──────────────────────────────────────────────────────────── */
const scanCount = () => FLIGHTS.et607.packages.filter((n) => HANDED[n] || state.scanned.has(n)).length;

export const RPC = {
  cargo_parts_summary: { success: true, containers: 5, containers_at_sea: 4, air_open: 3, air_in_flight: 1, parcels_waiting: 42, deposits_pending: 2, deposits_today: 4 },
  cargo_air_list: () => ({ success: true, shipments: listJson() }),
  cargo_air_get: (b) => (FLIGHTS[b.p_air_id] ? { success: true, shipment: airJson(b.p_air_id) } : { success: false, error: 'Expédition introuvable' }),
  cargo_air_create: (b) => ({ success: true, shipment: { ...airJson('et607-1013'), etd: b.p_etd ?? '2026-10-13', eta: b.p_eta ?? null } }),
  cargo_air_update: (b) => ({ success: true, shipment: airJson(FLIGHTS[b.p_air_id] ? b.p_air_id : 'et607') }),
  // Le départ est refusé tant que des paquets ne sont pas scannés (cargo_air_set_status, 20261005170000).
  cargo_air_set_status: (b) => {
    const left = FLIGHTS.et607.packages.length - scanCount();
    if (b.p_status === 'DEPARTED' && left > 0) return { success: false, error: `${left} paquet(s) pas encore scanné(s) au départ : scannez-les, ou retirez-les de l'expédition` };
    return { success: true, shipment: { ...airJson('et607'), status: b.p_status, departed_at: b.p_status === 'DEPARTED' ? new Date().toISOString() : null } };
  },
  cargo_air_loadable_parcels: { success: true, parcels: [] },
  // Les paquets qui attendent au bureau : PQ-000039 refusé (à renvoyer), PQ-000041 à 45 fermés, PQ-000046 encore ouvert.
  air_package_list: () => ({ success: true, packages: [packageJson(46, { forAir: null }), packageJson(39, { forAir: null }), ...[45, 44, 43, 42, 41].map((n) => packageJson(n, { forAir: null }))] }),
  air_package_get: (b) => { const n = Number(/(\d+)$/.exec(b.p_package_id ?? b.p_code ?? '')?.[1]); return GROSS[n] ? { success: true, package: packageJson(n, { withParcels: true }) } : { success: false, error: 'Paquet introuvable' }; },
  air_package_assign: (b) => ({ success: true, assigned: (b.p_package_ids ?? []).length, parcels: (b.p_package_ids ?? []).reduce((t, id) => t + parcelsOfPackage(Number(id.slice(4))).length, 0), skipped: [] }),
  air_package_unassign: (b) => ({ success: true, package: packageJson(Number(String(b.p_package_id).slice(4)), { withParcels: true, forAir: null }) }),
  air_package_scan_departure: (b) => {
    const m = /PQ[\s-]?(\d{1,9})/i.exec(b.p_code ?? '');
    if (!m) return { success: false, error: "Ce n'est pas une étiquette de paquet (PQ-000000)" };
    const n = Number(m[1]);
    if (!FLIGHTS.et607.packages.includes(n)) return { success: false, error: `Le paquet ${pq(n)} est affecté à une autre expédition`, package_no: pq(n) };
    const already = !!HANDED[n] || state.scanned.has(n);
    state.scanned.add(n);
    return { success: true, already, package_no: pq(n), scanned: scanCount(), total: FLIGHTS.et607.packages.length };
  },
  air_package_refuse: (b) => {
    const n = Number(String(b.p_package_id).slice(4));
    const departed = FLIGHTS['et607-0404'].packages.includes(n);
    state.refused.add(n);
    return { success: true, parcels: parcelsOfPackage(n).length, clients_told_departed: departed, package: packageJson(n, { withParcels: true, forAir: null }) };
  },
  cargo_mark_shipment_arrived: (b) => ({ success: true, shipment_id: b.p_shipment_id, status: 'ARRIVED', parcels: 0, clients: 0 }),
};

/* ── Les gestes ───────────────────────────────────────────────────────── */
const settle = (page, ms = 500) => page.waitForTimeout(ms);
/** Le bloc d'un paquet dans la liste mobile du panneau « Les paquets ». */
const packageRow = (page, no) => page.locator('section div.py-3').filter({ has: page.getByText(no, { exact: true }) }).first();

/** Le manifeste : le PDF fabriqué dans la page, sa 1re page rastérisée par pdftoppm, affichée comme une feuille. */
async function showManifest(page) {
  await page.waitForFunction(() => !!window.__manifest, null, { timeout: 15000 });
  const { name, b64 } = await page.evaluate(() => window.__manifest);
  mkdirSync(OUT_DIR, { recursive: true });
  const pdfPath = join(OUT_DIR, name);
  writeFileSync(pdfPath, Buffer.from(b64, 'base64'));
  const base = join(mkdtempSync(join(tmpdir(), 'manifeste-')), 'page1');
  execFileSync('pdftoppm', ['-png', '-r', '170', '-f', '1', '-l', '1', '-singlefile', pdfPath, base]);
  const png = readFileSync(`${base}.png`).toString('base64');
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#e9e6ef;padding:24px;box-sizing:border-box">
    <img src="data:image/png;base64,${png}" style="display:block;width:100%;background:#fff;box-shadow:0 2px 14px rgba(0,0,0,.18)"></body></html>`);
  await page.waitForTimeout(300);
}

export const SCREENS = [
  // 1. Ouvrir le vol de la semaine prochaine sans LTA : « LTA pas encore connue ».
  {
    key: 'j.expedition.form', name: '01-nouveau-vol-sans-lta', role: 'ops', init: reset, viewport: '390x1010', fullPage: false,
    before: async (page) => {
      await page.locator('[role=switch]').click();
      await page.fill('#air-airline', 'Ethiopian Airlines');
      await page.fill('#air-flight', 'ET 607');
      await page.fill('#air-etd', '2026-10-13');
      await page.fill('#air-eta', '2026-10-14');
      await page.fill('#air-notes', 'LTA à demander au transitaire dès la réservation.');
      await page.locator('body').click({ position: { x: 5, y: 5 } });
    },
  },
  // 2. La liste des vols : celui du 13/10 apparaît « LTA à venir ».
  { key: 'j.expedition.list', name: '02-liste-lta-a-venir', role: 'ops', init: reset },
  // 3. Le vol du 06/10, ce matin, encore vide : « Ajouter des paquets », les 5 paquets fermés cochés.
  {
    key: 'j.expedition.add', name: '03-ajouter-des-paquets', role: 'ops', init: reset, viewport: '390x1450', fullPage: false,
    before: async (page) => {
      await page.getByRole('button', { name: /Ajouter des paquets/ }).click();
      await settle(page, 800);
      for (const n of [41, 42, 43, 44, 45]) await page.getByRole('checkbox').filter({ hasText: pq(n) }).click();
      await settle(page);
    },
  },
  // 4. Le vol du 06/10 avec ses 5 paquets : 3 scannés sur 5, l'avion ne peut pas encore partir.
  { key: 'j.expedition.detail', name: '04-vol-3-sur-5-scannes', role: 'ops', init: reset, viewport: '390x1500', fullPage: false },
  // 5. « L'avion est parti » : la feuille rappelle les 2 paquets non scannés ; la base refuse le départ.
  {
    key: 'j.expedition.detail', name: '05-depart-bloque', role: 'ops', init: reset, fullPage: false,
    before: async (page) => {
      await page.getByRole('button', { name: /L'avion est parti/ }).click();
      await settle(page, 800);
    },
  },
  // 6. Le scan au départ : PQ-000044 vient d'être scanné, 4/5.
  {
    key: 'j.expedition.detail', name: '06-scan-au-depart', role: 'ops', init: reset, viewport: '390x1400', fullPage: false,
    before: async (page) => {
      await page.getByRole('button', { name: /Scanner au départ/ }).click();
      await settle(page, 400);
      const input = page.getByPlaceholder('Scannez un paquet (PQ-…)');
      await input.fill('PQ-000044');
      await input.press('Enter');
      await settle(page, 1200);
      await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
      await page.getByRole('heading', { name: 'Les paquets' }).evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70));
      await settle(page, 400);
    },
  },
  // 7. Le vol du 04/10 est parti, l'aéroport a refusé PQ-000039 : le motif, et l'avertissement.
  {
    key: 'j.expedition.refuse', name: '07-refus-aeroport-motif', role: 'ops', init: reset, fullPage: false,
    before: async (page) => {
      await packageRow(page, 'PQ-000039').getByRole('button', { name: /Refusé à l'aéroport/ }).click();
      await settle(page, 600);
      await page.fill('#air-package-refusal', REFUSAL);
      await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
      await settle(page);
    },
  },
  // 8. Après le refus : les clients déjà prévenus du départ, à rappeler.
  {
    key: 'j.expedition.refuse', name: '08-refus-prevenir-clients', role: 'ops', init: reset, fullPage: false,
    before: async (page) => {
      await packageRow(page, 'PQ-000039').getByRole('button', { name: /Refusé à l'aéroport/ }).click();
      await settle(page, 600);
      await page.fill('#air-package-refusal', REFUSAL);
      await page.getByRole('button', { name: 'Déclarer le refus' }).click();
      await settle(page, 1200);
    },
  },
  // 9. Au bureau, sur ordinateur : le vol du 06/10, ses paquets, ses colis, le manifeste.
  {
    key: 'j.expedition.desk-detail', name: '09-bureau-vol-et-paquets', desktop: true, role: 'ops', init: reset, viewport: '1440x1300',
    // Le tableau des paquets défile dans 320 px : on le descend pour voir les deux paquets pas encore scannés.
    before: async (page) => {
      await page.getByText('PQ-000045', { exact: true }).first().evaluate((el) => { const box = el.closest('.overflow-auto'); if (box) box.scrollTop = box.scrollHeight; });
      await settle(page, 400);
    },
  },
  // 10. Le manifeste PDF du vol (colonne PAQUET), 1re page.
  { key: 'j.expedition.manifest', name: '10-manifeste-pdf', desktop: true, role: 'ops', init: reset, viewport: '900x1290', before: showManifest },
  // 11. La liste des vols sur ordinateur : « LTA à venir » en italique.
  { key: 'j.expedition.desk-list', name: '11-bureau-liste-vols', desktop: true, role: 'ops', init: reset },
  // 12. Maritime : MIEU3611115, déchargé à Kribi, que Maersk ne signale pas — « Marquer arrivé ».
  {
    key: 'j.expedition.container', name: '12-conteneur-suivi', desktop: true, role: 'ops', init: reset, viewport: '1440x1000', wait: 1500,
    before: async (page) => {
      await page.getByRole('button', { name: /Marquer arrivé/ }).waitFor({ state: 'visible', timeout: 15000 });
      await page.evaluate(() => document.fonts.ready);
      await settle(page, 600);
    },
  },
  // 13. Le dialogue « Marquer MIEU3611115 arrivé » rempli.
  {
    key: 'j.expedition.container', name: '13-conteneur-marquer-arrive', desktop: true, role: 'ops', init: reset, viewport: '1440x1000', wait: 1500,
    before: async (page) => {
      await page.getByRole('button', { name: /Marquer arrivé/ }).click({ timeout: 15000 });
      await settle(page, 500);
      await page.fill('#arr-when', '2026-10-04T16:30');
      await page.fill('#arr-note', "Avis d'arrivée du consignataire à Kribi (reçu le 05/10) : conteneur déchargé le 04/10.");
      await settle(page);
    },
  },
];
