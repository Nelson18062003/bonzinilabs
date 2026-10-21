// Données factices du module Cargo · Réception (Guangzhou) · Entrepôt (Douala),
// pour les captures (SCREENSHOT_MOCK=1, tools/audit-mobile.mjs). Noms inventés,
// calqués sur les maquettes v2 (docs/mobile-refonte/maquettes-v2/04-cargo et
// 10-complements, écrans 30–53). `respondCargo(url, body)` rend undefined pour
// ce qui n'est pas à lui ; toutes les RPC rendent `{ success: true, … }`.
const DAY = 86_400_000;
const T0 = Date.now();
const at = (days, hour = 10, min = 0) => { const d = new Date(T0 + days * DAY); d.setHours(hour, min, 0, 0); return d.toISOString(); };
const dayOnly = (days) => new Date(T0 + days * DAY).toISOString().slice(0, 10);

const client = (user_id, customer_code, first_name, last_name, phone, extra = {}) => ({ user_id, customer_code, first_name, last_name, phone, email: null, company_name: null, city: 'Douala', country: 'Cameroun', account_id: null, account_name: null, account_code: null, ...extra });
const C = {
  fatou: client('u5', 'BZ-4821', 'Fatou', 'Ndiaye', '+237 690 55 66 77'),
  jp: client('u3', 'BZ-1188', 'Jean-Paul', 'Mbarga', '+237 655 71 90 02'),
  aicha: client('u4', 'BZ-6044', 'Aïcha', 'Diallo', '+237 690 44 12 07'),
  ibrahim: client('u6', 'BZ-2291', 'Ibrahim', 'Touré', '+237 671 55 08 64'),
  rosine: client('r8', 'BZ-7712', 'Rosine', 'Tchoua', '+237 677 10 22 41'),
  samuel: client('r9', 'BZ-3307', 'Samuel', 'Nkoulou', '+237 699 30 12 55'),
  aminatou: client('r10', 'BZ-5130', 'Aminatou', 'Bello', '+237 694 81 03 27'),
  blaise: client('r11', 'BZ-5871', 'Blaise', 'Nana', '+237 690 12 40 77', { account_id: 'acc1', account_name: 'Simon Djiani', account_code: 'DJIANI' }),
  marie: client('r12', 'BZ-5904', 'Marie', 'Tamba', '+237 677 82 19 03', { account_id: 'acc1', account_name: 'Simon Djiani', account_code: 'DJIANI' }),
  olivier: client('r13', 'BZ-6122', 'Olivier', 'Essama', '+237 699 45 18 60', { account_id: 'acc1', account_name: 'Simon Djiani', account_code: 'DJIANI' }),
};
const CLIENTS = Object.values(C);
const cbm = (l, w, h) => Math.round((l * w * h) / 1_000_000 * 10_000) / 10_000;

let pid = 0;
function parcel(depositNo, seq, description, weight_kg, dims, extra = {}) {
  pid += 1;
  const [l, w, h] = dims ?? [null, null, null];
  return {
    id: `pc${pid}`, seq, parcel_no: `${depositNo}-${String(seq).padStart(2, '0')}`, kind: 'carton', weight_kg, length_cm: l, width_cm: w, height_cm: h,
    cbm: l ? cbm(l, w, h) : null, description, courier_waybill: null, photo_path: `parcel-photos/${depositNo}/${seq}.jpg`,
    photos: [{ id: `ph${pid}`, path: `parcel-photos/${depositNo}/${seq}.jpg`, position: 0, created_at: at(0, 9) }],
    status: 'received', shipment_id: null, container_number: null, air_shipment_id: null, awb_number: null, air_package_id: null, package_no: null,
    checked_in_at: null, warehouse_location: null, condition: null, condition_note: null, reception_condition: null, reception_condition_note: null,
    delivered_at: null, release_id: null, release_no: null, created_at: at(0, 9), updated_at: at(0, 9), ...extra,
  };
}
function deposit(id, deposit_no, cl, location, opened_at, parcels, extra = {}) {
  return {
    id, deposit_no, client: cl, location, brought_by: 'courier', representative_name: null, representative_phone: null,
    supplier_kind: 'supplier', supplier_name: 'Guangzhou Hengtai Trading', supplier_contact: 'M. Huang', supplier_phone: '+86 138 2244 9087', supplier_email: null, supplier_wechat: null, supplier_address: null,
    status: 'closed', received_by: 'screenshot-admin', received_by_name: 'Li Wei', opened_at, closed_at: opened_at, updated_at: opened_at,
    cancelled_at: null, cancel_reason: null, cancelled_by_name: null,
    parcel_count: parcels.length, total_weight_kg: Math.round(parcels.reduce((a, p) => a + (p.weight_kg ?? 0), 0) * 10) / 10,
    total_cbm: Math.round(parcels.reduce((a, p) => a + (p.cbm ?? 0), 0) * 1000) / 1000,
    notes: null, parcels, quote_engaged: null, quote_status: null, quote_no: null, quote_total_xaf: null, quote_paid_xaf: null, invoice_no: null,
    containers: [], flights: [], ...extra,
  };
}

const D418 = deposit('dp418', 'RC-000418', C.fatou, 'office', at(0, 11, 5), [
  parcel('RC-000418', 1, 'Chaussures', 18.2, [60, 45, 40]),
  parcel('RC-000418', 2, 'Sacs à main', 21.0, [80, 65, 60]),
  parcel('RC-000418', 3, 'Tissus wax', 23.2, [70, 60, 100]),
], { status: 'open', closed_at: null, quote_status: 'sent', quote_no: 'DV-000418', quote_total_xaf: 148000, quote_paid_xaf: 0, quote_engaged: 'sent' });
const D417 = deposit('dp417', 'RC-000417', null, 'office', at(0, 10, 42), [parcel('RC-000417', 1, 'Pièces détachées', 11.4, [50, 40, 30]), parcel('RC-000417', 2, null, 7.6, [40, 30, 30])], { notes: 'Marqué « Lin » au feutre' });
const D416 = deposit('dp416', 'RC-000416', C.aicha, 'office', at(0, 9, 18), [1, 2, 3, 4, 5].map((i) => parcel('RC-000416', i, i === 1 ? 'Cosmétiques' : 'Perruques', [22, 18, 16, 17, 15][i - 1], i === 5 ? null : [50, 40, 35])), { quote_status: null });
const D412 = deposit('dp412', 'RC-000412', C.jp, 'warehouse', at(-1, 15, 20), [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => parcel('RC-000412', i, 'Carrelage', 23.8, [60, 60, 40])), { quote_status: 'paid', quote_no: 'DV-000412', quote_total_xaf: 412500, quote_paid_xaf: 412500 });
const D411 = deposit('dp411', 'RC-000411', C.rosine, 'office', at(-1, 11, 2), [parcel('RC-000411', 1, 'Montres', 8.0, [40, 30, 20])]);
const D409 = deposit('dp409', 'RC-000409', null, 'warehouse', at(-7, 14, 0), [parcel('RC-000409', 1, null, 14.0, [55, 45, 40])]);
const DEPOSITS = [D418, D417, D416, D412, D411, D409];
const depositById = (id) => DEPOSITS.find((d) => d.id === id) ?? D418;

// ── Le conteneur MIEU3611115 (dossier « 2 ») : ses colis, par client ──────
const groupage = [[C.fatou, 'RC-000418', 3, 0.28], [C.jp, 'RC-000412', 9, 0.46], [C.samuel, 'RC-000402', 6, 0.5], [C.ibrahim, 'RC-000398', 5, 0.62], [C.rosine, 'RC-000395', 4, 0.31]];
const SHIP_PARCELS = groupage.flatMap(([cl, no, n, unit], gi) => Array.from({ length: n }, (_, i) => ({
  ...parcel(no, i + 1, ['Chaussures', 'Carrelage', 'Pneus', 'Tissus', 'Sacs'][gi], 20 + i, null), cbm: unit, shipment_id: '2', container_number: 'MIEU3611115', status: 'shipped',
  deposit_id: `dep-${no}`, deposit_no: no, location: 'warehouse', client: cl,
})));

// ── Paquets avion (32 kg) ─────────────────────────────────────────────────
const pkg = (id, package_no, status, net, parcel_count, client_count, extra = {}) => ({
  id, package_no, status, air_shipment_id: null, awb_number: null, air_status: null, etd: null, flight_no: null, max_weight_kg: 32,
  gross_weight_kg: status === 'open' ? null : Math.round((net + 0.4) * 10) / 10, length_cm: null, width_cm: null, height_cm: null, notes: null,
  net_weight_kg: net, parcel_count, client_count, checked_count: 0, missing_count: 0, sealed_at: status === 'open' ? null : at(-1, 16), handed_over_at: null,
  refused_at: null, refusal_reason: null, refused_air_shipment_id: null, received_at: null, opened_at: null, created_at: at(-1, 9), updated_at: at(0, 11),
  created_by: 'screenshot-admin', created_by_name: 'Li Wei', parcels: null, ...extra,
});
const pkParcel = (p, cl, depNo) => ({ id: p.id, seq: p.seq, parcel_no: p.parcel_no, kind: 'carton', weight_kg: p.weight_kg, cbm: p.cbm, description: p.description, status: 'received', photo_path: p.photo_path, checked_in_at: null, warehouse_location: null, condition: null, delivered_at: null, deposit_no: depNo, deposit_id: `dep-${depNo}`, client: cl });
const P234 = pkg('pk234', 'PQ-000234', 'open', 24.6, 7, 4, {
  parcels: [
    pkParcel(parcel('RC-000420', 1, 'Chaussures', 6.2, [40, 30, 25]), C.fatou, 'RC-000420'),
    pkParcel(parcel('RC-000421', 1, 'Cosmétiques', 3.4, [30, 20, 20]), C.aicha, 'RC-000421'),
    pkParcel(parcel('RC-000415', 3, 'Montres', 8.0, [40, 30, 20]), C.rosine, 'RC-000415'),
    pkParcel(parcel('RC-000415', 4, 'Montres', 7.0, [40, 30, 20]), C.rosine, 'RC-000415'),
  ],
});
const onAir = { air_shipment_id: 'a1', awb_number: '071-44829035', air_status: 'PLANNED', etd: at(2, 23), flight_no: 'ET 607' };
const AIR_PACKAGES = [
  P234,
  pkg('pk232', 'PQ-000232', 'sealed', 31.4, 8, 3),
  pkg('pk233', 'PQ-000233', 'sealed', 30.2, 6, 2),
  pkg('pk231', 'PQ-000231', 'handed_over', 31.6, 7, 3, { ...onAir, handed_over_at: at(0, 8) }),
  pkg('pk229', 'PQ-000229', 'handed_over', 29.8, 6, 2, { ...onAir, handed_over_at: at(0, 8) }),
  pkg('pk228', 'PQ-000228', 'handed_over', 31.1, 8, 3, { ...onAir, handed_over_at: at(0, 8) }),
  pkg('pk227', 'PQ-000227', 'handed_over', 30.9, 9, 4, { ...onAir, handed_over_at: at(0, 8) }),
  pkg('pk236', 'PQ-000236', 'sealed', 30.2, 6, 2, onAir),
  pkg('pk235', 'PQ-000235', 'sealed', 28.7, 5, 2, onAir),
];

// ── Expéditions avion ─────────────────────────────────────────────────────
const air = (id, awb_number, airline, flight_no, status, etd, eta, extra = {}) => ({
  id, awb_number, airline, flight_no, origin: 'Canton', destination: 'Douala', status, etd, eta, departed_at: null, arrived_at: null, delivered_at: null,
  freight_usd: 1240, notes: null, created_at: at(-4), updated_at: at(-1), parcel_count: 41, total_weight_kg: 186, total_cbm: 1.42, client_count: 9, unpaid_count: 3,
  checked_count: 0, missing_count: 0, delivered_count: 0, awb_provisional: false, package_count: 6, packages_handed_over: 4, packages_received: 0, packages: null, parcels: null, ...extra,
});
const A1 = air('a1', '071-44829035', 'Ethiopian', 'ET 607', 'PLANNED', at(2, 23), at(3, 14), { packages: AIR_PACKAGES.filter((p) => p.air_shipment_id === 'a1') });
const AIRS = [
  A1,
  air('a2', 'PROV-20261027', 'Turkish', 'TK 6271', 'PLANNED', at(6, 2), at(7, 10), { awb_provisional: true, parcel_count: 0, package_count: 0, packages_handed_over: 0, unpaid_count: 0, client_count: 0, total_weight_kg: 0 }),
  air('a3', '235-11804426', 'Turkish', 'TK 6265', 'DEPARTED', at(-2, 3), at(1, 9), { departed_at: at(-2, 3), packages_handed_over: 5, package_count: 5 }),
  air('a4', '071-44792210', 'Ethiopian', 'ET 605', 'ARRIVED', at(-7, 23), at(-6, 14), { arrived_at: at(-1, 14), unpaid_count: 2, packages_received: 6, checked_count: 38, parcel_count: 38 }),
];

// ── Entrepôt de Douala ────────────────────────────────────────────────────
const whParcel = (p, cl, depNo, extra = {}) => ({ ...p, deposit_id: `dp${depNo.slice(-3)}`, deposit_no: depNo, location: 'warehouse', client: cl, container_number: 'MIEU3611115', shipment_id: '2', status: 'arrived', quote_id: `q-${depNo}`, quote_status: 'paid', quote_no: `DV-${depNo.slice(3)}`, quote_total_xaf: 148000, quote_paid_xaf: 148000, invoice_no: null, ...extra });
const ARRIVAL_PARCELS = (() => {
  const list = [
    whParcel(parcel('RC-000418', 1, 'Chaussures', 18.2, [60, 45, 40]), C.fatou, 'RC-000418'),
    whParcel(parcel('RC-000418', 2, 'Sacs à main', 21.0, [80, 65, 60]), C.fatou, 'RC-000418'),
    whParcel(parcel('RC-000418', 3, 'Tissus wax', 23.2, [70, 60, 100]), C.fatou, 'RC-000418', { checked_in_at: at(0, 9), condition: 'ok', warehouse_location: 'B3' }),
    whParcel(parcel('RC-000412', 4, 'Carrelage', 23.8, [60, 60, 40]), C.jp, 'RC-000412', { checked_in_at: at(0, 9), condition: 'damaged', condition_note: 'coin écrasé', warehouse_location: 'A2' }),
    whParcel(parcel('RC-000409', 2, 'Pneus', 30, [70, 70, 30]), C.samuel, 'RC-000409', { condition: 'missing' }),
  ];
  for (let i = 0; i < 81; i++) {
    const checked = i < 59;
    const miss = i === 59;
    list.push(whParcel(parcel(`RC-0003${String(60 + Math.floor(i / 4)).padStart(2, '0')}`, (i % 4) + 1, 'Effets', 12 + (i % 7), [50, 40, 30]), [C.ibrahim, C.rosine, C.aminatou, C.jp][i % 4], `RC-0003${String(60 + Math.floor(i / 4)).padStart(2, '0')}`, checked ? { checked_in_at: at(0, 8), condition: 'ok', warehouse_location: `C${(i % 5) + 1}` } : miss ? { condition: 'missing' } : {}));
  }
  return list;
})();
const WH_DAY = {
  success: true, day: dayOnly(0),
  stats: { to_checkin: 25, waiting: 31, missing: 2, delivered_today: 3 },
  arrivals: [
    { kind: 'sea', id: '2', ref: 'MIEU3611115', label: 'MIEU 3611115', sub: '86 colis · 14 clients', arrived_at: at(-1, 7), expected: 86, checked: 61, missing: 2, delivered: 0 },
    { kind: 'air', id: 'a4', ref: '071-44792210', label: 'ET 605 · 6 paquets', sub: 'Arrivé hier · 38 colis', arrived_at: at(-1, 14), expected: 38, checked: 38, missing: 0, delivered: 12 },
    { kind: 'air', id: 'a3', ref: '235-11804426', label: 'TK 6265 · 5 paquets', sub: 'Arrive demain · 41 colis', arrived_at: null, expected: 41, checked: 0, missing: 0, delivered: 0 },
  ],
  waiting_by_client: [
    { client: C.fatou, parcels: 3, weight_kg: 62.4, since: at(-1, 9), unpaid: false, balance_xaf: 0 },
    { client: C.ibrahim, parcels: 5, weight_kg: 88, since: at(-1, 9), unpaid: true, balance_xaf: 86000 },
    { client: C.jp, parcels: 9, weight_kg: 214, since: at(-2, 9), unpaid: false, balance_xaf: 0 },
    { client: C.rosine, parcels: 1, weight_kg: 8, since: at(-2, 9), unpaid: true, balance_xaf: 0 },
  ],
  releases_today: [
    { id: 'rel189', release_no: 'BR-000189', released_at: at(0, 11, 40), picked_by_name: 'Fatou Ndiaye', parcel_count: 3, client: C.fatou },
    { id: 'rel188', release_no: 'BR-000188', released_at: at(0, 10, 5), picked_by_name: 'Moussa Bah', parcel_count: 2, client: C.aminatou },
  ],
};
const FATOU_READY = ARRIVAL_PARCELS.slice(0, 3).map((p, i) => ({ ...p, checked_in_at: at(0, 9), condition: 'ok', warehouse_location: ['B3', 'B3', 'B4'][i] }));
const RELEASE = { id: 'rel189', release_no: 'BR-000189', released_at: at(0, 11, 40), picked_by_name: 'Fatou Ndiaye', picked_by_phone: null, parcel_count: 3, signature_path: null, note: null, released_by_name: 'Armel', client: C.fatou, parcels: FATOU_READY.map((p) => ({ ...p, delivered_at: at(0, 11, 40), release_no: 'BR-000189' })) };

// ── Devis RC-000418 ───────────────────────────────────────────────────────
const QUOTE = {
  id: 'q418', quote_no: 'DV-000418', deposit_id: 'dp418', status: 'sent', currency: 'XAF', total_xaf: 148000, amount_paid_xaf: 0, balance_xaf: 148000, notes: null,
  sent_at: at(-2, 9), paid_at: null, invoice_no: null, invoiced_at: null, created_at: at(-2, 9), updated_at: at(-2, 9), deposit_no: 'RC-000418', location: 'warehouse',
  opened_at: at(-2, 9), closed_at: at(-2, 10), client: C.fatou, received_by_name: 'Li Wei', supplier_kind: 'supplier', supplier_name: 'Guangzhou Hengtai Trading', containers: [], flights: [],
  lines: [
    ...D418.parcels.map((p, i) => ({ id: `ql${i}`, seq: i + 1, kind: 'parcel', label: p.description, basis: 'per_cbm', quantity: p.cbm, unit_price_xaf: 165000, amount_xaf: [17820, 51480, 69300][i], parcel_id: p.id, parcel_no: p.parcel_no, parcel_seq: p.seq, kind_of_parcel: 'carton', description: p.description, weight_kg: p.weight_kg, cbm: p.cbm, length_cm: p.length_cm, width_cm: p.width_cm, height_cm: p.height_cm })),
    { id: 'qlf', seq: 4, kind: 'fee', label: 'Manutention', basis: 'fixed', quantity: null, unit_price_xaf: null, amount_xaf: 9400, parcel_id: null },
  ],
  payments: [],
};

const IBRAHIM_READY = ARRIVAL_PARCELS.slice(5, 10).map((p, i) => ({ ...p, client: C.ibrahim, deposit_id: 'dp409', deposit_no: 'RC-000409', parcel_no: `RC-000409-0${i + 1}`, seq: i + 1, quote_id: 'q409', quote_status: 'sent', quote_no: 'DV-000409', quote_total_xaf: 86000, quote_paid_xaf: 0, checked_in_at: at(0, 9), condition: 'ok', warehouse_location: ['C1', 'C1', 'C2', 'C2', 'C2'][i] }));
const QUOTE_IB = { ...QUOTE, id: 'q409', quote_no: 'DV-000409', deposit_id: 'dp409', deposit_no: 'RC-000409', total_xaf: 86000, amount_paid_xaf: 0, balance_xaf: 86000, client: C.ibrahim, lines: [] };

const ACCOUNTS = [
  { id: 'acc1', name: 'Simon Djiani', code: 'DJIANI', contact_name: 'Simon Djiani', contact_phone: '+237 699 21 44 10', notes: null, is_active: true, client_count: 12, parcels_waiting: 46, created_at: at(-90) },
  { id: 'acc2', name: 'Gauss Import', code: 'GAUSS', contact_name: null, contact_phone: null, notes: null, is_active: true, client_count: 8, parcels_waiting: 31, created_at: at(-80) },
  { id: 'acc3', name: 'Pierre Roger', code: 'PRC', contact_name: null, contact_phone: null, notes: null, is_active: true, client_count: 5, parcels_waiting: 12, created_at: at(-70) },
  { id: 'acc4', name: 'Kamdem & Frères', code: 'KMF', contact_name: null, contact_phone: null, notes: null, is_active: true, client_count: 3, parcels_waiting: 0, created_at: at(-60) },
];

function args(body) {
  if (!body) return {};
  try { return typeof body === 'string' ? JSON.parse(body) : body; } catch { return {}; }
}
const ok = (o) => ({ success: true, ...o });

export function respondCargo(url, body) {
  const m = url.match(/\/rpc\/([a-z_]+)/);
  if (!m) return undefined;
  const a = args(body);
  switch (m[1]) {
    case 'cargo_parts_summary': return ok({ containers: 7, containers_at_sea: 6, air_open: 3, air_in_flight: 1, parcels_waiting: 89, deposits_pending: 2, deposits_today: 8 });
    case 'reception_my_day': return ok({ day: dayOnly(0), stats: { deposits: 8, parcels: 37, weight_kg: 412, cbm: 3.12, open: 1 }, pending: 2, deposits: a.p_day ? [D412, D411] : [D418, D417, D416] });
    case 'reception_get_deposit': return ok({ deposit: depositById(a.p_deposit_id) });
    case 'reception_pending_deposits': return ok({ deposits: [D417, D409] });
    case 'reception_search_clients': return ok({ clients: CLIENTS.filter((c) => !a.p_query || `${c.first_name} ${c.last_name} ${c.customer_code}`.toLowerCase().includes(String(a.p_query).toLowerCase())) });
    case 'reception_recent_clients': return ok({ clients: [C.fatou, C.aminatou, C.samuel, C.ibrahim, C.aicha, C.jp] });
    case 'reception_client': return ok({ client: CLIENTS.find((c) => c.user_id === a.p_user_id) ?? C.fatou });
    case 'reception_client_by_code': return ok({ client: C.fatou });
    case 'reception_client_deposits': return ok({ deposits: DEPOSITS.filter((d) => d.client?.user_id === (a.p_user_id ?? 'u5')) });
    case 'reception_client_suppliers': return ok({ suppliers: [
      { kind: 'supplier', name: 'Guangzhou Hengtai Trading', contact: 'M. Huang', phone: '+86 138 2244 9087', last_at: at(-6) },
      { kind: 'buying_agent', name: '广州鞋业 · Guangzhou Shoes', contact: null, phone: null, last_at: at(-20) },
    ] });
    case 'reception_board': return ok({ total: DEPOSITS.length, truncated: false, deposits: DEPOSITS });
    case 'reception_overview': return ok({ by_receptionist: [{ received_by: 'r1', name: 'Li Wei', deposits: 6, parcels: 29, weight_kg: 312, cbm: 2.4, pending: 1, incomplete: 2 }, { received_by: 'r2', name: 'Lin', deposits: 2, parcels: 8, weight_kg: 100, cbm: 0.7, pending: 1, incomplete: 0 }], deposits: DEPOSITS });
    case 'reception_stock': return ok({ stats: { parcels: 89, clients: 14, weight_kg: 1240, cbm: 6.2, pending: 3 }, by_client: [C.fatou, C.jp, C.aicha, C.rosine].map((c, i) => ({ client: c, location: i % 2 ? 'warehouse' : 'office', parcels: [3, 9, 5, 1][i], weight_kg: [62.4, 214, 88, 8][i], cbm: [0.84, 1.3, 0.4, 0.02][i], deposits: 1, last_at: at(-i) })) });
    case 'cargo_shipment_parcels': return ok({ parcels: a.p_shipment_id === '2' || !a.p_shipment_id ? SHIP_PARCELS : [] });
    case 'reception_loadable_parcels': return ok({ client_user_id: null, parcels: [D412, D411].flatMap((d) => d.parcels.map((p) => ({ ...p, deposit_id: d.id, deposit_no: d.deposit_no, location: d.location, client: d.client }))) });
    case 'air_package_list': return ok({ packages: a.p_air_id ? AIR_PACKAGES.filter((p) => p.air_shipment_id === a.p_air_id) : a.p_scope === 'all' ? AIR_PACKAGES : AIR_PACKAGES.filter((p) => !p.air_shipment_id) });
    case 'air_package_get': return ok({ package: AIR_PACKAGES.find((p) => p.id === a.p_package_id) ?? P234 });
    case 'air_package_packable': return Number(a.p_limit) === 0 ? ok({ ready_count: 12, to_fix_count: 0 }) : ok({ total: 3, truncated: false, deposits: [D416, D411, { ...D418, status: 'closed', closed_at: at(0, 11, 30), quote_engaged: null }] });
    case 'cargo_air_list': return ok({ shipments: AIRS });
    case 'cargo_air_get': return ok({ shipment: AIRS.find((x) => x.id === a.p_air_id) ?? A1 });
    case 'cargo_air_loadable_parcels': return ok({ parcels: [{ ...D418, parcels: D418.parcels.slice(0, 2) }, { ...D416, parcels: D416.parcels.slice(0, 2) }].flatMap((d) => d.parcels.map((p) => ({ ...p, deposit_id: d.id, deposit_no: d.deposit_no, location: 'office', client: d.client }))) });
    case 'warehouse_day': return WH_DAY;
    case 'warehouse_arrival_parcels': return ok(a.p_kind === 'air' ? { kind: 'air', id: a.p_id ?? 'a4', label: 'ET 605', sub: 'LTA 071-4479 2210', packages: AIR_PACKAGES.slice(3, 7).map((p) => ({ ...p, status: 'received', received_at: at(-1, 15) })), parcels: ARRIVAL_PARCELS.slice(0, 12).map((p) => ({ ...p, air_shipment_id: 'a4', awb_number: '071-44792210', container_number: null })) } : { kind: 'sea', id: '2', label: 'MIEU 3611115', sub: 'Groupage · Maersk', packages: [], parcels: ARRIVAL_PARCELS });
    case 'warehouse_client_parcels': if (a.p_code === 'BZ-2291') return ok({ client: C.ibrahim, ready: IBRAHIM_READY, not_ready: ARRIVAL_PARCELS.slice(8, 9), quotes: [{ id: 'q409', quote_no: 'DV-000409', deposit_id: 'dp409', deposit_no: 'RC-000409', status: 'sent', total_xaf: 86000, amount_paid_xaf: 0, balance_xaf: 86000, invoice_no: null }], releases: [] });
      return ok({ client: C.fatou, ready: FATOU_READY, not_ready: [], quotes: [{ id: 'q418', quote_no: 'DV-000418', deposit_id: 'dp418', deposit_no: 'RC-000418', status: 'paid', total_xaf: 148000, amount_paid_xaf: 148000, balance_xaf: 0, invoice_no: null }], releases: [] });
    case 'warehouse_release_get': return ok({ release: RELEASE });
    case 'warehouse_find_parcel': return ok({ parcel: ARRIVAL_PARCELS[1] });
    case 'cargo_quote_get': return ok({ quote: a.p_deposit_id === 'dp409' ? QUOTE_IB : QUOTE });
    case 'cargo_quote_ensure': return ok({ quote: QUOTE });
    case 'cargo_pricing_get': return ok({ air_per_kg_xaf: 7500, sea_per_cbm_xaf: 165000, currency: 'XAF', updated_at: at(-30) });
    case 'cargo_account_list': return ok({ accounts: a.p_include_inactive ? [...ACCOUNTS, { ...ACCOUNTS[3], id: 'acc5', name: 'Ancien compte', code: 'OLD', is_active: false }] : ACCOUNTS });
    case 'cargo_account_clients': return ok({ clients: [{ client: C.blaise, parcels_waiting: 14 }, { client: C.marie, parcels_waiting: 9 }, { client: C.olivier, parcels_waiting: 6 }] });
    default: return undefined;
  }
}
