// ============================================================
// Parcours du 05/10/2026 — domaine « douala » : l'entrepôt de Douala (/w),
// sur le téléphone de Brice Ndzana (agent d'entrepôt).
//   node tools/shoot-journey.mjs douala [écran…]
//
// L'histoire : le vol Ethiopian Airlines ET 607 (Guangzhou CAN → Douala DLA,
// LTA 071-12345675) arrive ce matin avec 5 paquets PQ-000041 à PQ-000045 et
// 17 colis de trois clients. Brice reçoit les paquets (3 / 5, puis PQ-000044
// → 4 / 5), les ouvre, pointe chaque colis (RC-000122-03 est abîmé), fait le
// bilan : PQ-000045 n'est jamais arrivé. L'après-midi, Samuel Ondo retire ses
// 3 colis (signature, bon BR-000012) ; Aïcha Mbarga doit d'abord solder son fret.
//
// Les réponses ont la forme des RPC de 20261005170000_air_packages.sql
// (warehouse_arrival_parcels avec `packages`, warehouse_parcel_json avec
// `package_no`, air_package_receive / air_package_open, air_package_json) et de
// 20260921160000_warehouse_destination.sql / 20261005150000 (journée, client,
// bon de retrait). L'état des paquets dépend de l'écran (PHASE, posée par init).
// ============================================================

/** Une heure du jour, affichée telle quelle (le navigateur des captures est en UTC). */
const at = (h, m, day = 5, month = 10) => `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`;

/* ── Les clients (reception_client_card) ─────────────────────────────────── */
const card = (o) => ({ email: null, company_name: null, account_id: null, account_name: null, account_code: null, ...o });
const AICHA = card({ user_id: 'u-aicha', customer_code: 'BZ-482913', first_name: 'Aïcha', last_name: 'Mbarga', phone: '+237 677 12 34 56', email: 'aicha@mbarga-import.cm', company_name: 'Mbarga Import SARL', city: 'Douala', country: 'Cameroun' });
const SAMUEL = card({ user_id: 'u-samuel', customer_code: 'BZ-510224', first_name: 'Samuel', last_name: 'Ondo', phone: '+241 66 55 44 33', company_name: 'Ondo Distribution', city: 'Libreville', country: 'Gabon' });
const NADIA = card({ user_id: 'u-nadia', customer_code: 'BZ-207781', first_name: 'Nadia', last_name: 'Fotso', phone: '+237 699 88 77 66', city: 'Yaoundé', country: 'Cameroun' });
const CLIENTS = { [AICHA.customer_code]: AICHA, [SAMUEL.customer_code]: SAMUEL, [NADIA.customer_code]: NADIA };

/* ── Les dépôts avion (bureau de Guangzhou) et leurs devis au kilo ───────── */
const AIR_PER_KG = 6500;
const DEPOSITS = {
  'dep-120': { id: 'dep-120', deposit_no: 'RC-000120', client: NADIA, opened_at: at(9, 20, 28, 9) },
  'dep-121': { id: 'dep-121', deposit_no: 'RC-000121', client: SAMUEL, opened_at: at(10, 5, 29, 9) },
  'dep-122': { id: 'dep-122', deposit_no: 'RC-000122', client: AICHA, opened_at: at(11, 40, 30, 9) },
  'dep-123': { id: 'dep-123', deposit_no: 'RC-000123', client: AICHA, opened_at: at(9, 15, 1, 10) },
};

/* ── Le vol ET 607 ───────────────────────────────────────────────────────── */
const AIR_ID = 'et607';
const AWB = '07112345675';
const AIR = { id: AIR_ID, awb_number: AWB, airline: 'Ethiopian Airlines', flight_no: 'ET 607', status: 'ARRIVED', etd: '2026-10-04', eta: '2026-10-05', arrived_at: at(7, 40) };

// Les 17 colis, paquet par paquet : [n° de colis, dépôt, paquet, poids, L, l, h, contenu, mot de l'étiquette (photo)].
const RAW = [
  ['RC-000121-01', 'dep-121', 41, 8.4, 50, 40, 35, 'Coques et chargeurs de téléphone', 'PHONE 手机'],
  ['RC-000121-02', 'dep-121', 41, 7.2, 45, 35, 30, 'Écouteurs Bluetooth, 80 pièces', 'AUDIO 耳机'],
  ['RC-000120-01', 'dep-120', 41, 6.5, 40, 30, 30, 'Cosmétiques (crèmes, sérums)', 'BEAUTY 美容'],
  ['RC-000120-02', 'dep-120', 41, 5.8, 40, 30, 25, 'Faux cils et ongles', 'BEAUTY 美容'],
  ['RC-000122-01', 'dep-122', 42, 9.6, 55, 40, 35, 'Perruques et mèches', 'HAIR 假发'],
  ['RC-000122-02', 'dep-122', 42, 8.1, 50, 40, 30, 'Perruques et mèches', 'HAIR 假发'],
  ['RC-000122-03', 'dep-122', 42, 7.4, 50, 35, 35, 'Sacs à main, 30 pièces', 'BAGS 包'],
  ['RC-000121-03', 'dep-121', 42, 5.3, 40, 30, 25, 'Montres connectées, 40 pièces', 'WATCH 手表'],
  ['RC-000122-04', 'dep-122', 43, 11.2, 60, 40, 40, 'Chaussures femme, 24 paires', 'SHOES 鞋'],
  ['RC-000122-05', 'dep-122', 43, 10.5, 60, 40, 35, 'Chaussures femme, 24 paires', 'SHOES 鞋'],
  ['RC-000122-06', 'dep-122', 43, 8.8, 55, 40, 30, 'Sacs à main, 25 pièces', 'BAGS 包'],
  ['RC-000120-03', 'dep-120', 44, 6.0, 40, 30, 30, 'Cosmétiques (crèmes, sérums)', 'BEAUTY 美容'],
  ['RC-000123-01', 'dep-123', 44, 12.4, 60, 45, 40, 'Robes et ensembles', 'DRESS 衣服'],
  ['RC-000123-02', 'dep-123', 44, 9.9, 55, 40, 35, 'Bijoux fantaisie', 'JEWELRY 饰品'],
  ['RC-000123-03', 'dep-123', 45, 14.0, 60, 50, 40, 'Robes et ensembles', 'DRESS 衣服'],
  ['RC-000121-04', 'dep-121', 45, 7.7, 50, 40, 30, 'Coques et chargeurs de téléphone', 'PHONE 手机'],
  ['RC-000121-05', 'dep-121', 45, 6.1, 45, 35, 30, 'Écouteurs Bluetooth, 60 pièces', 'AUDIO 耳机'],
];
const PARCELS = RAW.map(([no, depId, pk, kg, l, w, h, description, tag]) => {
  const seq = Number(no.slice(-2));
  return { id: `p-${no.slice(6, 9)}-${no.slice(-2)}`, seq, parcel_no: no, deposit_id: depId, pkg: pk, weight_kg: kg, length_cm: l, width_cm: w, height_cm: h, cbm: Math.round((l * w * h) / 10_000) / 100, description, tag };
});
const byNo = Object.fromEntries(PARCELS.map((p) => [p.parcel_no, p]));
const kgOf = (depId) => PARCELS.filter((p) => p.deposit_id === depId).reduce((s, p) => s + p.weight_kg, 0);

const QUOTES = {
  'dep-120': { id: 'q-120', quote_no: 'DV-000029', status: 'paid', total: Math.round(kgOf('dep-120') * AIR_PER_KG), paid: Math.round(kgOf('dep-120') * AIR_PER_KG), invoice_no: null },
  'dep-121': { id: 'q-121', quote_no: 'DV-000030', status: 'invoiced', total: Math.round(kgOf('dep-121') * AIR_PER_KG), paid: Math.round(kgOf('dep-121') * AIR_PER_KG), invoice_no: 'FA-000012' },
  'dep-122': { id: 'q-122', quote_no: 'DV-000031', status: 'sent', total: Math.round(kgOf('dep-122') * AIR_PER_KG), paid: 200000, invoice_no: null },
  'dep-123': { id: 'q-123', quote_no: 'DV-000033', status: 'invoiced', total: Math.round(kgOf('dep-123') * AIR_PER_KG), paid: Math.round(kgOf('dep-123') * AIR_PER_KG), invoice_no: 'FA-000015' },
};

/* ── Où en est l'arrivée : chaque écran pose sa phase (init) ─────────────────
 *  start  : PQ-000041/42/43 reçus, 44/45 attendus, aucun colis pointé
 *  scan   : idem ; le scan de PQ-000044 le reçoit (air_package_receive)
 *  open   : 41 ouvert et pointé, 42 ouvert (2 / 4 pointés), 43 et 44 reçus, 45 attendu
 *  bilan  : 41 à 44 ouverts et pointés (RC-000122-03 abîmé), 45 jamais reçu
 *  remise : l'après-midi — les colis des paquets 41 à 44 attendent leurs clients */
let PHASE = 'start';
const scanned = new Set();
const setPhase = (p) => { PHASE = p; scanned.clear(); };

const PKG_TIMES = { 41: [at(7, 52), at(8, 8)], 42: [at(7, 53), at(8, 18)], 43: [at(7, 55), at(8, 31)], 44: [at(8, 6), at(8, 40)], 45: [null, null] };
function pkgStage(n) {
  const received = n <= 43 || (n === 44 && (PHASE !== 'start' && PHASE !== 'scan' || scanned.has(44)));
  if (!received) return 'expected';
  const opened = PHASE === 'bilan' || PHASE === 'remise' ? n <= 44 : PHASE === 'open' ? n <= 42 : false;
  return opened ? 'opened' : 'received';
}
// Pointé à quelle heure, et dans quel état, selon la phase.
const CHECK = {
  'RC-000121-01': at(8, 10), 'RC-000121-02': at(8, 11), 'RC-000120-01': at(8, 12), 'RC-000120-02': at(8, 14),
  'RC-000122-01': at(8, 20), 'RC-000122-02': at(8, 22), 'RC-000122-03': at(8, 24), 'RC-000121-03': at(8, 25),
  'RC-000122-04': at(8, 33), 'RC-000122-05': at(8, 34), 'RC-000122-06': at(8, 35),
  'RC-000120-03': at(8, 42), 'RC-000123-01': at(8, 43), 'RC-000123-02': at(8, 44),
};
const DAMAGE = { 'RC-000122-03': 'Carton écrasé sur un coin, contenu intact' };
function checkState(p) {
  const no = p.parcel_no;
  const done = PHASE === 'bilan' || PHASE === 'remise' ? p.pkg <= 44
    : PHASE === 'open' ? p.pkg === 41 || no === 'RC-000122-01' || no === 'RC-000122-02'
    : false;
  if (PHASE === 'remise' && p.pkg === 45) return { checked_in_at: null, warehouse_location: null, condition: 'missing', condition_note: null };
  if (!done) return { checked_in_at: null, warehouse_location: null, condition: null, condition_note: null };
  return { checked_in_at: CHECK[no], warehouse_location: p.pkg <= 42 ? 'B3' : 'B4', condition: DAMAGE[no] ? 'damaged' : 'ok', condition_note: DAMAGE[no] ?? null };
}

/* ── Les formes des RPC ──────────────────────────────────────────────────── */
const photoPath = (p) => `${p.deposit_id}/${p.parcel_no}.jpg`;
/** warehouse_parcel_json (20261005170000) : le colis vu de Douala, avec son paquet et son devis. */
function parcelJson(p, o = {}) {
  const d = DEPOSITS[p.deposit_id];
  const q = QUOTES[p.deposit_id];
  return {
    id: p.id, seq: p.seq, parcel_no: p.parcel_no, kind: 'carton', weight_kg: p.weight_kg,
    length_cm: p.length_cm, width_cm: p.width_cm, height_cm: p.height_cm, cbm: p.cbm,
    description: p.description, courier_waybill: null, photo_path: photoPath(p),
    status: 'arrived', shipment_id: null, air_shipment_id: AIR_ID, created_at: d.opened_at,
    container_number: null, awb_number: AWB,
    air_package_id: `pkg-${p.pkg}`, package_no: `PQ-0000${p.pkg}`,
    ...checkState(p),
    delivered_at: null, release_id: null, release_no: null,
    deposit_no: d.deposit_no, deposit_id: d.id, location: 'office', opened_at: d.opened_at,
    client: d.client,
    quote_id: q.id, quote_status: q.status, quote_no: q.quote_no, quote_total_xaf: q.total, quote_paid_xaf: q.paid, invoice_no: q.invoice_no,
    ...o,
  };
}
/** air_package_json (20261005170000) : le paquet, ses poids, son expédition ; ses colis sur demande. */
function packageJson(n, withParcels = false) {
  const stage = pkgStage(n);
  const mine = PARCELS.filter((p) => p.pkg === n);
  const states = mine.map(checkState);
  const net = Math.round(mine.reduce((s, p) => s + p.weight_kg, 0) * 10) / 10;
  const [rec, opn] = PKG_TIMES[n];
  return {
    id: `pkg-${n}`, package_no: `PQ-0000${n}`, status: stage === 'opened' ? 'opened' : stage === 'received' ? 'received' : 'handed_over',
    air_shipment_id: AIR_ID, awb_number: AWB, air_status: 'ARRIVED', etd: AIR.etd, flight_no: AIR.flight_no,
    max_weight_kg: 32, gross_weight_kg: Math.round((net + 0.8) * 10) / 10, length_cm: 60, width_cm: 50, height_cm: 50, notes: null,
    net_weight_kg: net, parcel_count: mine.length, client_count: new Set(mine.map((p) => DEPOSITS[p.deposit_id].client.user_id)).size,
    checked_count: states.filter((s) => s.checked_in_at).length, missing_count: states.filter((s) => s.condition === 'missing').length,
    sealed_at: at(16, 30, 2), handed_over_at: at(13, 10, 4), refused_at: null, refusal_reason: null, refused_air_shipment_id: null,
    received_at: stage === 'expected' ? null : (n === 44 && scanned.has(44) ? new Date().toISOString() : rec),
    opened_at: stage === 'opened' ? opn : null,
    created_at: at(10, 0, 2), updated_at: at(8, 40),
    parcels: withParcels ? mine.map((p) => {
      const w = parcelJson(p);
      return { id: w.id, seq: w.seq, parcel_no: w.parcel_no, kind: w.kind, weight_kg: w.weight_kg, cbm: w.cbm, description: w.description, status: w.status, photo_path: w.photo_path,
        checked_in_at: w.checked_in_at, warehouse_location: w.warehouse_location, condition: w.condition, delivered_at: w.delivered_at, deposit_no: w.deposit_no, deposit_id: w.deposit_id, client: w.client };
    }) : null,
  };
}
const PKG_NOS = [41, 42, 43, 44, 45];
const arrivalDetail = () => ({
  success: true, kind: 'air', id: AIR_ID, label: `LTA ${AWB}`, sub: `${AIR.flight_no} · ${AIR.airline}`,
  packages: PKG_NOS.map((n) => packageJson(n)),
  // ORDER BY d.client_user_id, d.opened_at, p.seq
  parcels: [...PARCELS].sort((a, b) => DEPOSITS[a.deposit_id].client.user_id.localeCompare(DEPOSITS[b.deposit_id].client.user_id) || DEPOSITS[a.deposit_id].opened_at.localeCompare(DEPOSITS[b.deposit_id].opened_at) || a.seq - b.seq).map((p) => parcelJson(p)),
});

/* ── La journée (warehouse_day) ──────────────────────────────────────────── */
const seaArrival = { kind: 'sea', id: 'ct-mieu', ref: 'MIEU3611115', label: 'MIEU3611115', sub: 'GAUSS · CMA CGM LAPEROUSE', arrived_at: at(10, 0, 3), expected: 46, checked: 39, missing: 0, delivered: 0 };
function warehouseDay() {
  const parcels = PARCELS.map((p) => ({ p, s: checkState(p) }));
  const checked = parcels.filter((x) => x.s.checked_in_at).length;
  const missing = parcels.filter((x) => x.s.condition === 'missing').length;
  const air = { kind: 'air', id: AIR_ID, ref: AWB, label: `LTA ${AWB}`, sub: `${AIR.flight_no} · ${AIR.airline}`, arrived_at: AIR.arrived_at, expected: PARCELS.length, checked, missing, delivered: 0 };
  const waiting = PHASE === 'remise' ? [
    { client: SAMUEL, parcels: 3, weight_kg: 20.9, since: at(8, 10), unpaid: false, balance_xaf: 0 },
    { client: NADIA, parcels: 3, weight_kg: 18.3, since: at(8, 12), unpaid: false, balance_xaf: 0 },
    { client: AICHA, parcels: 8, weight_kg: 77.9, since: at(8, 20), unpaid: true, balance_xaf: QUOTES['dep-122'].total - QUOTES['dep-122'].paid },
  ] : [];
  return {
    success: true, day: '2026-10-05',
    stats: { to_checkin: PARCELS.length - checked - missing + (seaArrival.expected - seaArrival.checked), waiting: waiting.reduce((s, w) => s + w.parcels, 0), missing, delivered_today: 0 },
    arrivals: [air, seaArrival],
    waiting_by_client: waiting,
    releases_today: [],
  };
}

/* ── La remise (warehouse_client_parcels, warehouse_release_json) ────────── */
const READY = { 'BZ-510224': ['RC-000121-01', 'RC-000121-02', 'RC-000121-03'], 'BZ-482913': ['RC-000122-01', 'RC-000122-02', 'RC-000122-03', 'RC-000122-04', 'RC-000122-05', 'RC-000122-06', 'RC-000123-01', 'RC-000123-02'], 'BZ-207781': ['RC-000120-01', 'RC-000120-02', 'RC-000120-03'] };
const NOT_READY = { 'BZ-510224': ['RC-000121-04', 'RC-000121-05'], 'BZ-482913': ['RC-000123-03'], 'BZ-207781': [] };
const quoteSummary = (depId) => { const q = QUOTES[depId]; return { id: q.id, quote_no: q.quote_no, deposit_id: depId, deposit_no: DEPOSITS[depId].deposit_no, status: q.status, total_xaf: q.total, amount_paid_xaf: q.paid, balance_xaf: Math.max(0, q.total - q.paid), invoice_no: q.invoice_no }; };
function clientParcels(b) {
  const m = /BZ[^0-9]{0,3}([1-9][0-9]{5})/i.exec(b?.p_code ?? '');
  const code = m ? `BZ-${m[1]}` : null;
  const client = code ? CLIENTS[code] : null;
  if (!client) return { success: false, error: 'unknown_code', code: b?.p_code ?? '' };
  const prev = PHASE; PHASE = 'remise';
  const ready = READY[code].map((no) => parcelJson(byNo[no]));
  const notReady = NOT_READY[code].map((no) => parcelJson(byNo[no]));
  PHASE = prev;
  const deps = [...new Set(READY[code].map((no) => byNo[no].deposit_id))];
  return { success: true, client, ready, not_ready: notReady, quotes: deps.map(quoteSummary), releases: [] };
}
const SIGNATURE_PATH = '2026-10-05/1759679520114-k3x9qa.png';
function releaseJson() {
  const prev = PHASE; PHASE = 'remise';
  const parcels = READY['BZ-510224'].map((no) => parcelJson(byNo[no], { status: 'delivered', delivered_at: at(15, 42), release_id: 'rel-012', release_no: 'BR-000012' }));
  PHASE = prev;
  return { id: 'rel-012', release_no: 'BR-000012', released_at: at(15, 42), picked_by_name: 'Samuel Ondo', picked_by_phone: '+241 66 55 44 33', signature_path: SIGNATURE_PATH, note: null, parcel_count: 3, released_by_name: 'Brice Ndzana', client: SAMUEL, parcels };
}

/* ── Le devis de RC-000122 (cargo_quote_get), pour l'encaissement ─────────── */
function quoteGet(b) {
  const depId = b?.p_deposit_id;
  const d = DEPOSITS[depId];
  const q = QUOTES[depId];
  if (!d || !q) return { success: true, quote: null };
  const lines = PARCELS.filter((p) => p.deposit_id === depId).map((p, i) => ({
    id: `ql-${p.id}`, seq: i + 1, kind: 'parcel', label: p.parcel_no, basis: 'per_kg', quantity: p.weight_kg, unit_price_xaf: AIR_PER_KG, amount_xaf: Math.round(p.weight_kg * AIR_PER_KG),
    parcel_id: p.id, parcel_no: p.parcel_no, parcel_seq: p.seq, kind_of_parcel: 'carton', description: p.description, weight_kg: p.weight_kg, cbm: p.cbm,
    length_cm: p.length_cm, width_cm: p.width_cm, height_cm: p.height_cm, courier_waybill: null, container_number: null, awb_number: AWB,
  }));
  const payments = q.paid > 0 ? [{ id: `pm-${depId}`, receipt_no: depId === 'dep-122' ? 'RE-000052' : 'RE-000050', amount_xaf: q.paid, method: 'mobile_money', place: 'guangzhou', paid_at: at(10, 30, 2), reference: 'MP261002.1030.B4X1', proof_path: null, note: null, received_by: 'u-kevin', received_by_name: 'Kevin Nkolo', created_at: at(10, 30, 2), cancelled_at: null, cancel_reason: null }] : [];
  return { success: true, quote: {
    id: q.id, quote_no: q.quote_no, deposit_id: depId, status: q.status, currency: 'XAF', total_xaf: q.total, amount_paid_xaf: q.paid, balance_xaf: Math.max(0, q.total - q.paid),
    notes: null, sent_at: at(16, 0, 2), paid_at: q.paid >= q.total ? at(10, 30, 2) : null, invoice_no: q.invoice_no, invoiced_at: q.invoice_no ? at(10, 35, 2) : null,
    created_at: at(15, 40, 2), updated_at: at(10, 30, 2), deposit_no: d.deposit_no, location: 'office', opened_at: d.opened_at, closed_at: d.opened_at, client: d.client,
    supplier_kind: null, supplier_name: null, received_by_name: 'Kevin Nkolo', containers: [],
    flights: [{ awb_number: AWB, airline: AIR.airline, flight_no: AIR.flight_no, origin: 'Guangzhou (CAN)', destination: 'Douala (DLA)', etd: AIR.etd, eta: AIR.eta }],
    lines, payments,
  } };
}

export const RPC = {
  warehouse_day: () => warehouseDay(),
  warehouse_arrival_parcels: (b) => (b?.p_kind === 'air' && b?.p_id === AIR_ID ? arrivalDetail() : { success: false, error: 'Arrivée introuvable' }),
  air_package_list: (b) => ({ success: true, packages: b?.p_air_id === AIR_ID ? PKG_NOS.map((n) => packageJson(n)) : [] }),
  air_package_receive: (b) => {
    const m = /PQ[\s-]?(\d{1,9})/i.exec(b?.p_code ?? '');
    const n = m ? Number(m[1]) : NaN;
    if (!PKG_NOS.includes(n)) return { success: false, error: m ? `Paquet PQ-${String(n).padStart(6, '0')} introuvable` : 'Ce n\'est pas une étiquette de paquet (PQ-000000)' };
    const already = pkgStage(n) !== 'expected';
    if (!already) scanned.add(n);
    return { success: true, already, package_no: `PQ-0000${n}`, received: PKG_NOS.filter((k) => pkgStage(k) !== 'expected').length, total: PKG_NOS.length, package: packageJson(n, true) };
  },
  air_package_open: (b) => { const n = Number(/pkg-(\d+)/.exec(b?.p_package_id ?? '')?.[1]); return PKG_NOS.includes(n) ? { success: true, package: { ...packageJson(n, true), status: 'opened', opened_at: new Date().toISOString() } } : { success: false, error: 'Paquet introuvable' }; },
  warehouse_checkin_parcel: (b) => { const p = PARCELS.find((x) => x.id === b?.p_parcel_id); return p ? { success: true, parcel: parcelJson(p, { checked_in_at: new Date().toISOString(), warehouse_location: b.p_location ?? null, condition: b.p_condition ?? 'ok', condition_note: b.p_note ?? null }) } : { success: false, error: 'Colis introuvable' }; },
  warehouse_checkin_many: (b) => ({ success: true, checked: (b?.p_parcel_ids ?? []).length }),
  warehouse_flag_missing: (b) => { const p = PARCELS.find((x) => x.id === b?.p_parcel_id); return p ? { success: true, parcel: parcelJson(p, { condition: b.p_missing ? 'missing' : null }) } : { success: false, error: 'Colis introuvable' }; },
  warehouse_flag_missing_many: (b) => ({ success: true, flagged: (b?.p_parcel_ids ?? []).length }),
  warehouse_find_parcel: (b) => { const no = /RC[^0-9]{0,3}(\d{6})[^0-9]{0,3}(\d{2})/i.exec(b?.p_query ?? ''); const p = no ? byNo[`RC-${no[1]}-${no[2]}`] : null; return p ? { success: true, parcel: parcelJson(p) } : { success: false, error: 'Colis introuvable' }; },
  warehouse_client_parcels: (b) => clientParcels(b),
  warehouse_release_parcels: () => ({ success: true, release: releaseJson() }),
  warehouse_release_get: () => ({ success: true, release: releaseJson() }),
  cargo_quote_get: (b) => quoteGet(b),
};

/* ── Les images : photos des cartons (prises à Guangzhou) et signature ───── */
const PALETTES = [['#c8a27a', '#a77d52'], ['#d9b38c', '#b38b5d'], ['#bf9a6b', '#94703f'], ['#cfae84', '#a8845a'], ['#d4b896', '#ad8f69'], ['#c49e72', '#9b7548']];
function cartonSvg(p) {
  const [a, c] = PALETTES[(p.seq + p.pkg) % PALETTES.length];
  const code = DEPOSITS[p.deposit_id].client.customer_code;
  const bx = 230 + (p.seq % 3) * 25, by = 170, bw = 700, bh = 540;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b6f75"/><stop offset="1" stop-color="#3d4046"/></linearGradient></defs>
<rect width="1200" height="900" fill="url(#g)"/><rect y="700" width="1200" height="200" fill="#55595f"/>
<polygon points="${bx},${by} ${bx + 120},${by - 90} ${bx + bw + 120},${by - 90} ${bx + bw},${by}" fill="${c}"/>
<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${a}"/>
<polygon points="${bx + bw},${by} ${bx + bw + 120},${by - 90} ${bx + bw + 120},${by + bh - 90} ${bx + bw},${by + bh}" fill="${c}"/>
<rect x="${bx + bw / 2 - 40}" y="${by}" width="80" height="${bh}" fill="rgba(160,140,90,.55)"/>
<rect x="${bx + 60}" y="${by + 290}" width="330" height="200" fill="#fff"/>
<text x="${bx + 80}" y="${by + 358}" font-family="sans-serif" font-weight="700" font-size="42" fill="#222">${p.tag}</text>
<text x="${bx + 80}" y="${by + 410}" font-family="monospace" font-size="28" fill="#222">${code}</text>
<text x="${bx + 80}" y="${by + 452}" font-family="monospace" font-size="28" fill="#222">${p.parcel_no}</text>
</svg>`;
}
/** « S. Ondo », trait par trait (repère 600 × 240) : tracée au doigt à l'écran 12, servie en image sur le bon. */
const ellipse = (cx, cy, rx, ry, from = -90, turn = 380, n = 16) => Array.from({ length: n + 1 }, (_, i) => { const a = ((from - (turn * i) / n) * Math.PI) / 180; return [Math.round(cx + rx * Math.cos(a)), Math.round(cy + ry * Math.sin(a))]; });
const SIGNATURE_STROKES = [
  [[158, 96], [140, 84], [112, 84], [92, 98], [94, 120], [116, 134], [142, 146], [156, 166], [148, 188], [120, 198], [92, 192], [78, 178]],
  [[176, 194], [180, 196]],
  ellipse(232, 150, 26, 44),
  [[278, 196], [282, 166], [290, 146], [304, 140], [314, 154], [316, 178], [320, 196]],
  [[378, 168], [362, 150], [342, 154], [334, 176], [344, 196], [364, 192], [376, 172], [380, 130], [384, 76]],
  ellipse(418, 174, 20, 24, -60, 390, 14),
  [[86, 222], [180, 214], [300, 212], [420, 206], [540, 196]],
].map((stroke) => stroke.map(([px, py]) => [Math.round(px + (200 - py) * 0.28) - 10, py])); // penchée, comme à la main
/** Un trait lissé : des courbes passant par le milieu de chaque segment. */
const smooth = (pts) => pts.length < 3 ? `M${pts.map((q) => q.join(' ')).join(' L')}` : `M${pts[0].join(' ')} ` + pts.slice(1, -1).map((q, i) => `Q${q.join(' ')} ${(q[0] + pts[i + 2][0]) / 2} ${(q[1] + pts[i + 2][1]) / 2}`).join(' ') + ` L${pts[pts.length - 1].join(' ')}`;
const SIGNATURE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="240" viewBox="0 0 600 240"><path d="${SIGNATURE_STROKES.map(smooth).join(' ')}" fill="none" stroke="#1E1E1E" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const FONTS_CSS = [400, 500, 600, 700, 800, 900].map((w) => `@font-face{font-family:'DM Sans';font-style:normal;font-weight:${w};font-display:block;src:url(http://localhost:8080/fonts/dm-sans-latin-${w}-normal.woff) format('woff');}`).join('\n')
  + "\n@font-face{font-family:'Noto Sans SC';font-style:normal;font-weight:400 900;font-display:swap;src:url(http://localhost:8080/fonts/noto-sans-sc-chinese-simplified-400-normal.woff) format('woff');}";

/** Les seaux privés (photos de colis, signatures) : URL signées puis images servies sur place. */
async function media(page) {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
  // Les polices : Google Fonts répond mal depuis le bac à sable ; on sert DM Sans depuis public/fonts.
  await page.route(/fonts\.googleapis\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', headers: cors, body: FONTS_CSS }));
  await page.route(/fonts\.gstatic\.com/, (route) => route.fulfill({ status: 404, headers: cors, body: '' }));
  await page.route(/\/storage\/v1\/object\/sign\/(parcel-photos|parcel-signatures)/, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: cors, body: '' });
    const url = new URL(req.url());
    const rest = decodeURIComponent(url.pathname.split('/object/sign/')[1] ?? '');
    const [bucket, ...parts] = rest.split('/');
    const path = parts.join('/');
    if (req.method() === 'POST') {
      // createSignedUrls (lot) : { paths } → [{ path, signedURL }] ; createSignedUrl (un) : { signedURL }.
      if (!path) {
        const paths = req.postDataJSON()?.paths ?? [];
        return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(paths.map((p) => ({ path: p, signedURL: `/object/sign/${bucket}/${p}?token=demo`, error: null }))) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ signedURL: `/object/sign/${bucket}/${path}?token=demo` }) });
    }
    if (bucket === 'parcel-signatures') return route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: cors, body: SIGNATURE_SVG });
    const no = /(RC-\d{6}-\d{2})/.exec(path)?.[1];
    const p = no ? byNo[no] : null;
    return p ? route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: cors, body: cartonSvg(p) }) : route.fulfill({ status: 404, headers: cors, body: '' });
  });
}

/** La place notée pour la session (« B3 ») et le brouillon de remise (sessionStorage). */
const session = (page, entries) => page.addInitScript((e) => { try { for (const [k, v] of Object.entries(e)) sessionStorage.setItem(k, v); } catch { /* privé */ } }, entries);
const SAMUEL_IDS = READY['BZ-510224'].map((no) => byNo[no].id);

/**
 * La caméra du téléphone, simulée : la carte Bonzini de Samuel Ondo tenue devant l'objectif,
 * dans la pénombre de l'entrepôt (au lieu de la mire verte de Chromium). Le QR est un faux
 * motif : il ne se décode pas, l'écran reste sur le cadre.
 */
const fakeCamera = (page) => page.addInitScript(() => {
  if (!navigator.mediaDevices) return;
  navigator.mediaDevices.enumerateDevices = async () => [{ deviceId: 'back', groupId: 'g', kind: 'videoinput', label: 'Caméra arrière', toJSON() { return this; } }];
  navigator.mediaDevices.getUserMedia = async () => {
    const W = 720, H = 720;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    let seed = 20261005;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const N = 25;
    const mods = Array.from({ length: N * N }, () => rnd() > 0.52);
    const finder = (r, q) => { const d = Math.max(Math.abs(r - 3), Math.abs(q - 3)); return d !== 2 && d <= 3; };
    const dark = (r, q) => (r < 7 && q < 7 ? finder(r, q) : r < 7 && q >= N - 7 ? finder(r, q - (N - 7)) : r >= N - 7 && q < 7 ? finder(r - (N - 7), q) : (r === 7 || q === 7 || r === N - 8 || q === N - 8) && (r < 8 || q < 8 || r > N - 9 || q > N - 9) ? false : mods[r * N + q]);
    const round = (X, Y, w, h, rad) => { x.beginPath(); x.moveTo(X + rad, Y); x.arcTo(X + w, Y, X + w, Y + h, rad); x.arcTo(X + w, Y + h, X, Y + h, rad); x.arcTo(X, Y + h, X, Y, rad); x.arcTo(X, Y, X + w, Y, rad); x.closePath(); };
    let t = 0;
    const draw = () => {
      t += 1;
      // L'entrepôt, flou : étagères et cartons.
      x.filter = 'blur(10px)';
      const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#4a463f'); g.addColorStop(1, '#24211d'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.fillStyle = '#6b5a44'; for (let i = 0; i < 5; i += 1) x.fillRect(-20 + i * 160, 40, 120, 90);
      x.fillStyle = '#8a6d4b'; for (let i = 0; i < 4; i += 1) x.fillRect(10 + i * 190, 520, 150, 170);
      x.fillStyle = '#3a352f'; x.fillRect(0, 150, W, 18); x.fillRect(0, 480, W, 18);
      x.filter = 'none';
      // La carte, tenue à la main (léger tremblement).
      const jx = Math.sin(t / 7) * 3, jy = Math.cos(t / 9) * 3;
      x.save(); x.translate(W / 2 + jx, H / 2 + jy); x.rotate(-0.05 + Math.sin(t / 11) * 0.006);
      x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 30; x.shadowOffsetY = 12;
      x.fillStyle = '#ffffff'; round(-190, -250, 380, 500, 22); x.fill();
      x.shadowColor = 'transparent';
      x.fillStyle = '#7a33ff'; round(-190, -250, 380, 78, 22); x.fill(); x.fillRect(-190, -200, 380, 28);
      x.fillStyle = '#ffffff'; x.font = '700 30px sans-serif'; x.textAlign = 'center'; x.fillText('BONZINI', 0, -200);
      const m = 10, q0 = -(N * m) / 2, top = -150;
      x.fillStyle = '#111111';
      for (let r = 0; r < N; r += 1) for (let q = 0; q < N; q += 1) if (dark(r, q)) x.fillRect(q0 + q * m, top + r * m, m, m);
      x.fillStyle = '#1e1e1e'; x.font = '700 30px sans-serif'; x.fillText('Samuel Ondo', 0, 152);
      x.fillStyle = '#555555'; x.font = '26px monospace'; x.fillText('BZ-510224', 0, 194);
      x.restore();
      // Un voile de lumière, comme sur une vraie prise de vue.
      const v = x.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 520); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.35)'); x.fillStyle = v; x.fillRect(0, 0, W, H);
    };
    draw();
    setInterval(draw, 66);
    return c.captureStream(15);
  };
});

/** Une signature tracée au doigt dans le cadre (souris de Playwright). */
async function drawSignature(page) {
  const box = await page.locator('canvas').first().boundingBox();
  if (!box) throw new Error('cadre de signature introuvable');
  const sx = box.width / 600, sy = box.height / 240;
  const strokes = SIGNATURE_STROKES;
  for (const s of strokes) {
    await page.mouse.move(box.x + s[0][0] * sx, box.y + s[0][1] * sy);
    await page.mouse.down();
    for (const [x, y] of s.slice(1)) await page.mouse.move(box.x + x * sx, box.y + y * sy, { steps: 4 });
    await page.mouse.up();
  }
}

/**
 * La page entière, barre du bas comprise : la fenêtre prend la hauteur du contenu, pour que
 * la barre fixée en bas (« Terminer le pointage », « Remettre 3 colis ») tombe sous le
 * contenu au lieu de le couvrir au milieu de la capture pleine page.
 */
async function fit(page) {
  await page.evaluate(() => document.fonts.ready);
  const vp = page.viewportSize();
  const h = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
  if (vp && h > vp.height) {
    await page.setViewportSize({ width: vp.width, height: h });
    await page.waitForTimeout(500);
    const h2 = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
    if (h2 > h) { await page.setViewportSize({ width: vp.width, height: h2 }); await page.waitForTimeout(400); }
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

const phase = (p, extra) => async (page) => { setPhase(p); await media(page); if (extra) await extra(page); };

const STORY = [
  // 1. Les arrivées : le vol ET 607 (5 paquets, 3 déjà reçus) et le conteneur MIEU3611115.
  { key: 'j.douala.arrivals', name: '01-arrivees', init: phase('start'), wait: 1200 },
  // 2. Le vol : « Paquets reçus 3 / 5 », ceux qui manquent en rouge, la boîte de scan.
  { key: 'j.douala.checkin', name: '02-paquets-3-sur-5', init: phase('start'), wait: 1000 },
  // 3. PQ-000044 scanné : « reçu · 4 / 5 ».
  { key: 'j.douala.checkin', name: '03-paquet-scanne', init: phase('scan'), wait: 1000,
    before: async (page) => {
      const input = page.locator('input[placeholder^="Scannez un paquet"]');
      await input.fill('PQ-000044');
      await input.press('Enter');
      await page.waitForTimeout(1200);
      await page.evaluate(() => window.scrollTo(0, 0));
    } },
  // 4. Le paquet PQ-000042 ouvert : 2 colis sur 4 pointés.
  { key: 'j.douala.package', name: '04-paquet-ouvert', init: phase('open', (page) => session(page, { 'bonzini-warehouse-place': 'B3' })), wait: 1000 },
  // 5. La fiche d'un colis du paquet : là ? abîmé ? manquant ? — rangé en B3.
  { key: 'j.douala.parcel', name: '05-colis-question', init: phase('open', (page) => session(page, { 'bonzini-warehouse-place': 'B3' })), wait: 1200 },
  // 6. La variante « abîmé » : une remarque, puis « Pointer abîmé ».
  { key: 'j.douala.parcel', name: '06-colis-abime', init: phase('open', (page) => session(page, { 'bonzini-warehouse-place': 'B3' })), wait: 1200,
    before: async (page) => {
      await page.click('text=Oui, mais abîmé');
      await page.waitForTimeout(400);
      await page.fill('#ck-note', 'Carton écrasé sur un coin, contenu intact');
      await page.locator('#ck-note').blur();
    } },
  // 7. Le bilan : 14 colis sur 17, PQ-000045 jamais reçu, un colis abîmé.
  { key: 'j.douala.bilan', name: '07-bilan', init: phase('bilan'), wait: 1000 },
  // 8. La remise, l'après-midi : scanner le code du client…
  { key: 'j.douala.pickup', name: '08-remise-scanner', init: phase('remise', fakeCamera), wait: 2500, fit: false, fullPage: false, viewport: '390x930',
    before: async (page) => { await page.fill('input[aria-label="Code client ou numéro de colis"]', 'BZ-510224'); await page.locator('input[aria-label="Code client ou numéro de colis"]').blur(); } },
  // 9. … ou le choisir parmi ceux qui attendent.
  { key: 'j.douala.waiting', name: '09-qui-attend', init: phase('remise'), wait: 1000 },
  // 10. Samuel Ondo : ses 3 colis, payés, cochés.
  { key: 'j.douala.client', name: '10-client-pret', init: phase('remise'), wait: 1400 },
  // 11. Qui emporte : le client lui-même.
  { key: 'j.douala.who', name: '11-qui-emporte', wait: 1000,
    init: phase('remise', (page) => session(page, { 'bonzini-warehouse-release': JSON.stringify({ code: 'BZ-510224', ids: SAMUEL_IDS, who: 'Samuel Ondo', phone: '+241 66 55 44 33' }) })) },
  // 12. La signature, au doigt.
  { key: 'j.douala.sign', name: '12-signature', wait: 1000,
    init: phase('remise', (page) => session(page, { 'bonzini-warehouse-release': JSON.stringify({ code: 'BZ-510224', ids: SAMUEL_IDS, who: 'Samuel Ondo', phone: '+241 66 55 44 33' }) })),
    before: async (page) => { await drawSignature(page); await page.waitForTimeout(300); } },
  // 13. Le bon de retrait BR-000012, détail déplié.
  { key: 'j.douala.done', name: '13-bon-de-retrait', init: phase('remise'), wait: 1400,
    before: async (page) => { await page.click('text=Le détail'); await page.waitForTimeout(500); } },
  // 14. Aïcha Mbarga : 8 colis prêts, mais 161 400 XAF de fret restent à payer.
  { key: 'j.douala.blocked', name: '14-client-bloque', init: phase('remise'), wait: 1400 },
  // 15. L'encaissement à Douala, au retrait.
  { key: 'j.douala.pay', name: '15-encaisser', init: phase('remise'), wait: 1400 },
];

export const SCREENS = STORY.map((s) => ({ ...s, before: async (page) => { await page.evaluate(() => document.fonts.ready); if (s.before) await s.before(page); if (s.fit !== false) await fit(page); } }));
