// Captures de la sous-app Réception (/r) — iPhone 390×844, fixtures des RPC
// reception_* servies par interception réseau (rien de réel n'est contacté).
//   VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=x VITE_SUPABASE_PROJECT_ID=x npx vite --host --port 8080
//   node tools/shoot-reception.mjs [out-dir] [screen…]
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { respond as adminRespond } from './adminFixtures.mjs';

const OUT = process.argv[2] ?? 'tools/out/reception';
const ONLY = process.argv.slice(3);
mkdirSync(OUT, { recursive: true });

const client = { user_id: 'u1', customer_code: 'BZ-482913', first_name: 'Aïcha', last_name: 'Mbarga', phone: '+237 677 12 34 56', email: 'aicha@mbarga-import.cm', company_name: 'Mbarga Import SARL', city: 'Douala', country: 'Cameroun', account_id: 'acc1', account_name: 'PRC', account_code: 'PRC' };
const client2 = { user_id: 'u2', customer_code: 'BZ-510224', first_name: 'Samuel', last_name: 'Ondo', phone: '+241 66 55 44 33', email: null, company_name: 'Ondo Distribution', city: 'Libreville', country: 'Gabon' };
const client3 = { user_id: 'u3', customer_code: 'BZ-207781', first_name: 'Nadia', last_name: 'Fotso', phone: '+237 699 88 77 66', email: null, company_name: null, city: 'Yaoundé', country: 'Cameroun' };
const parcel = (seq, no, o) => ({ id: `p${no}-${seq}`, seq, parcel_no: `${no}-${String(seq).padStart(2, '0')}`, kind: 'carton', weight_kg: 8.4, length_cm: 60, width_cm: 40, height_cm: 40, cbm: 0.096, description: null, courier_waybill: null, photo_path: null, status: 'received', created_at: '2026-09-20T06:32:00Z', ...o });
const today = (h, m) => `2026-09-20T${String(h - 8).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`;

const dep1 = {
  id: 'dep1', deposit_no: 'RC-000123', client, location: 'warehouse', brought_by: 'client', representative_name: null, representative_phone: null,
  status: 'open', received_by: 'demo', received_by_name: 'Kevin Nkolo', opened_at: today(14, 5), closed_at: null,
  parcel_count: 3, total_weight_kg: 26.7, total_cbm: 0.312, notes: null,
  parcels: [
    parcel(1, 'RC-000123', { description: 'Chaussures, 40 paires', weight_kg: 8.4 }),
    parcel(2, 'RC-000123', { description: 'Tissus wax', weight_kg: 12.1, length_cm: 80, width_cm: 50, height_cm: 30, cbm: 0.12 }),
    parcel(3, 'RC-000123', { description: 'Sacs à main, 30 pièces', weight_kg: 6.2, kind: 'bag', cbm: 0.096 }),
  ],
};
const dep0 = { ...dep1, id: 'dep0', deposit_no: 'RC-000124', client: null, brought_by: 'courier', parcels: [], parcel_count: 0, total_weight_kg: 0, total_cbm: 0, opened_at: today(14, 20) };
const supplier = { supplier_kind: 'supplier', supplier_name: '广州鞋业有限公司 Guangzhou Shoes Co.', supplier_contact: 'Li Wei 李伟', supplier_phone: '138 0000 1234', supplier_email: 'liwei@gzshoes.cn', supplier_wechat: 'gzshoes_li', supplier_address: '广州市白云区石井大道 168 号 3 栋' };
Object.assign(dep1, supplier);
const dep2 = {
  ...dep1, id: 'dep2', deposit_no: 'RC-000122', status: 'closed', closed_at: today(14, 32), opened_at: today(14, 1),
  parcel_count: 10, total_weight_kg: 84, total_cbm: 0.62,
  parcels: Array.from({ length: 10 }, (_, i) => parcel(i + 1, 'RC-000122', { description: ['Chaussures, 40 paires', 'Tissus wax', 'Sacs à main, 30 pièces'][i % 3], weight_kg: 8.4, photo_path: i < 7 ? `dep2/carton-${(i % 3) + 1}.jpg` : null })),
};
const dep3 = { ...dep2, id: 'dep3', deposit_no: 'RC-000121', client: client2, brought_by: 'courier', parcel_count: 3, total_weight_kg: 21, total_cbm: 0.18, opened_at: today(13, 10), closed_at: today(13, 18), parcels: dep2.parcels.slice(0, 3).map((p) => ({ ...p, parcel_no: p.parcel_no.replace('RC-000122', 'RC-000121') })) };
const dep4 = { ...dep2, id: 'dep4', deposit_no: 'RC-000120', client: client3, brought_by: 'representative', representative_name: 'Paul Fotso', parcel_count: 2, total_weight_kg: 9, total_cbm: 0.05, opened_at: today(11, 47), closed_at: today(11, 52), parcels: dep2.parcels.slice(0, 2).map((p) => ({ ...p, parcel_no: p.parcel_no.replace('RC-000122', 'RC-000120') })) };
const pend1 = { ...dep0, id: 'pend1', deposit_no: 'RC-000119', status: 'closed', closed_at: today(10, 24), opened_at: today(10, 20), parcel_count: 1, total_weight_kg: 12, total_cbm: 0.08, parcels: [parcel(1, 'RC-000119', { weight_kg: 12, length_cm: 50, width_cm: 40, height_cm: 40, cbm: 0.08, courier_waybill: 'SF2884193055221', description: 'Fournisseur Yiwu Hengda (sur le bordereau)' })] };
const pend2 = { ...pend1, id: 'pend2', deposit_no: 'RC-000117', location: 'office', opened_at: '2026-09-19T08:05:00Z', closed_at: '2026-09-19T08:09:00Z', parcel_count: 1, total_weight_kg: 4, total_cbm: 0.024, parcels: [parcel(1, 'RC-000117', { weight_kg: 4, length_cm: 40, width_cm: 30, height_cm: 20, cbm: 0.024, courier_waybill: 'YTO7731002588108', description: null })] };

// ── Côté admin : la réception dans Bonzini Cargo ──
const shipment = {
  id: 'ct1', client_label: 'Mbarga Import', client_id: 'c1', carrier: 'MAERSK', bl_number: 'MAEU 2261 8834', container_number: 'MSKU 482913-7', container_iso: '45G1',
  pol_name: 'Guangzhou (Nansha)', pol_unlocode: 'CNNSA', pod_name: 'Douala', pod_unlocode: 'CMDLA', etd_promised: '2026-09-28', eta_promised: '2026-11-05',
  etd_actual: null, eta_carrier: null, vessel_name: null, vessel_imo: null, vessel_mmsi: null, voyage: null, freight_usd: 3200, freight_paid: false, telex_released: false,
  status: 'AT_ORIGIN', last_event_at: null, last_event_label: null, last_synced_at: null, sync_error: null, notes: null, goods_description: 'Chaussures, tissus, sacs', packages_count: 12, gross_weight_kg: 96,
  created_at: '2026-09-18T02:00:00Z', updated_at: '2026-09-20T02:00:00Z',
};
const withDep = (p, d) => ({ ...p, deposit_id: d.id, deposit_no: d.deposit_no, location: d.location, opened_at: d.opened_at, client: d.client });
const loadedParcels = dep3.parcels.map((p) => withDep({ ...p, status: 'loaded', shipment_id: 'ct1', container_number: shipment.container_number }, { ...dep3, client }));
const dep2Loaded = { ...dep2, parcels: dep2.parcels.map((p, i) => (i < 4 ? { ...p, status: 'loaded', shipment_id: 'ct1', container_number: shipment.container_number } : p)) };


// ── Phase 1 : le devis d'un dépôt (prix par colis) ──
const pricing = { success: true, air_per_kg_xaf: 6500, sea_per_cbm_xaf: 180000, currency: 'XAF' };
const quoteLine = (p, i, o) => ({ id: `ql-${p.id}`, seq: i + 1, kind: 'parcel', label: p.parcel_no, basis: 'per_cbm', quantity: p.cbm, unit_price_xaf: 180000, amount_xaf: Math.round(p.cbm * 180000),
  parcel_id: p.id, parcel_no: p.parcel_no, parcel_seq: p.seq, kind_of_parcel: p.kind, description: p.description, weight_kg: p.weight_kg, cbm: p.cbm, ...o });
const quoteDep2 = {
  id: 'q1', quote_no: 'DV-000031', deposit_id: 'dep2', status: 'draft', currency: 'XAF', amount_paid_xaf: 0, notes: null, sent_at: null,
  created_at: today(14, 40), updated_at: today(14, 52), deposit_no: dep2.deposit_no, location: dep2.location, opened_at: dep2.opened_at, closed_at: dep2.closed_at, client: dep2.client,
  lines: [
    ...dep2.parcels.map((p, i) => quoteLine(p, i, i === 1 ? { basis: 'fixed', quantity: null, unit_price_xaf: null, amount_xaf: 25000 } : i === 4 ? { basis: 'per_kg', quantity: p.weight_kg, unit_price_xaf: 6500, amount_xaf: Math.round(p.weight_kg * 6500) } : {})),
    { id: 'ql-fee1', seq: 11, kind: 'fee', label: 'Emballage renforcé', basis: 'fixed', quantity: null, unit_price_xaf: null, amount_xaf: 12000, parcel_id: null },
    { id: 'ql-disc1', seq: 12, kind: 'discount', label: 'Geste commercial', basis: 'fixed', quantity: null, unit_price_xaf: null, amount_xaf: -10000, parcel_id: null },
  ],
};
quoteDep2.total_xaf = quoteDep2.lines.reduce((t, l) => t + l.amount_xaf, 0);
// Phase 2 : un acompte Mobile Money à Guangzhou sur dep2 ; dep3 réglé en deux fois et facturé.
const payment = (id, no, amount, o) => ({ id, receipt_no: no, amount_xaf: amount, method: 'mobile_money', place: 'guangzhou', paid_at: today(14, 58), reference: 'MP240921.1458.A7K2', proof_path: null, note: null, received_by: 'demo', received_by_name: 'Demo Admin', created_at: today(14, 58), cancelled_at: null, cancel_reason: null, ...o });
quoteDep2.payments = [payment('pm1', 'RE-000041', 120000), payment('pm0', 'RE-000040', 50000, { method: 'cash', reference: null, paid_at: today(14, 45), cancelled_at: today(14, 50), cancel_reason: 'Double saisie' })];
quoteDep2.amount_paid_xaf = 120000; quoteDep2.balance_xaf = quoteDep2.total_xaf - 120000; quoteDep2.status = 'sent'; quoteDep2.sent_at = today(14, 55);
const quoteDep3 = { ...quoteDep2, id: 'q2', quote_no: 'DV-000030', deposit_id: 'dep3', status: 'invoiced', sent_at: today(13, 30), deposit_no: dep3.deposit_no, client: dep3.client, lines: dep3.parcels.map((p, i) => quoteLine(p, i)) };
quoteDep3.total_xaf = quoteDep3.lines.reduce((t, l) => t + l.amount_xaf, 0);
quoteDep3.payments = [payment('pm2', 'RE-000038', 30000, { method: 'cash', reference: null, paid_at: today(13, 40) }), payment('pm3', 'RE-000039', quoteDep3.total_xaf - 30000, { method: 'bank_transfer', reference: 'VIR 2026-0921-118', paid_at: today(13, 52) })];
quoteDep3.amount_paid_xaf = quoteDep3.total_xaf; quoteDep3.balance_xaf = 0; quoteDep3.paid_at = today(13, 52); quoteDep3.invoice_no = 'FA-000012'; quoteDep3.invoiced_at = today(13, 55);
const QUOTES = { dep2: quoteDep2, dep3: quoteDep3 };
const withQuote = (d) => { const q = QUOTES[d.id]; return q ? { ...d, quote_status: q.status, quote_no: q.quote_no, quote_total_xaf: q.total_xaf, quote_paid_xaf: q.amount_paid_xaf, invoice_no: q.invoice_no ?? null } : { ...d, quote_status: null, quote_no: null, quote_total_xaf: null, quote_paid_xaf: null, invoice_no: null }; };

// ── Phase 3 : les expéditions aériennes ──
const airParcel = (p, d, q) => ({ ...withDep(p, d), status: 'loaded', air_shipment_id: 'air1', awb_number: '07112345675', quote_status: q?.status ?? null, quote_no: q?.quote_no ?? null, quote_total_xaf: q?.total_xaf ?? null, quote_paid_xaf: q?.amount_paid_xaf ?? null, invoice_no: q?.invoice_no ?? null });
const air1Parcels = [...dep3.parcels.map((p) => airParcel(p, dep3, quoteDep3)), ...dep2.parcels.slice(0, 4).map((p) => airParcel(p, dep2, quoteDep2)), airParcel(pend2.parcels[0], pend2, null)];
const air1 = { id: 'air1', awb_number: '07112345675', airline: 'Ethiopian Airlines', flight_no: 'ET 607', origin: 'Guangzhou (CAN)', destination: 'Douala (DLA)', status: 'PLANNED', etd: '2026-09-24', eta: '2026-09-25', departed_at: null, arrived_at: null, delivered_at: null, freight_usd: 1840, notes: 'Transitaire : Guangzhou Kaiyun. Remise à l\'aéroport avant 16 h la veille.', created_at: today(9, 10), updated_at: today(9, 10),
  parcel_count: air1Parcels.length, total_weight_kg: air1Parcels.reduce((t, p) => t + p.weight_kg, 0), total_cbm: air1Parcels.reduce((t, p) => t + p.cbm, 0), client_count: 3, unpaid_count: air1Parcels.filter((p) => !p.quote_total_xaf || p.quote_paid_xaf < p.quote_total_xaf).length, parcels: air1Parcels };
const air2 = { ...air1, id: 'air2', awb_number: '23598877210', airline: 'Turkish Cargo', flight_no: 'TK 6521', status: 'DEPARTED', etd: '2026-09-19', eta: '2026-09-21', departed_at: '2026-09-19T14:20:00Z', parcel_count: 12, total_weight_kg: 96.4, total_cbm: 0.58, client_count: 4, unpaid_count: 0, parcels: null };
const air3 = { ...air1, id: 'air3', awb_number: '07112340011', airline: 'Ethiopian Airlines', flight_no: 'ET 607', status: 'ARRIVED', etd: '2026-09-12', eta: '2026-09-13', departed_at: '2026-09-12T15:05:00Z', arrived_at: '2026-09-13T11:40:00Z', parcel_count: 7, total_weight_kg: 41, total_cbm: 0.22, client_count: 2, unpaid_count: 2, parcels: null };
const AIRS = { air1, air2, air3 };
const airLoadable = [...dep1.parcels.map((p) => ({ ...withDep(p, dep1), quote_status: null, quote_total_xaf: null, quote_paid_xaf: null })), ...dep4.parcels.map((p) => ({ ...withDep(p, dep4), quote_status: null, quote_total_xaf: null, quote_paid_xaf: null }))].map((p) => ({ ...p, location: p.deposit_no === 'RC-000123' ? 'office' : p.location }));

// ── Phase 4 : l'entrepôt de Douala ──
const whParcel = (p, d, q, o) => ({ ...withDep(p, d), id: `${d.id}-${p.seq}`, status: 'arrived', shipment_id: null, air_shipment_id: 'air3', awb_number: '07112340011', container_number: null,
  checked_in_at: null, warehouse_location: null, condition: null, condition_note: null, delivered_at: null, release_id: null, release_no: null,
  quote_id: q?.id ?? null, quote_status: q?.status ?? null, quote_no: q?.quote_no ?? null, quote_total_xaf: q?.total_xaf ?? null, quote_paid_xaf: q?.amount_paid_xaf ?? null, invoice_no: q?.invoice_no ?? null, ...o });
const whAir3 = [
  ...dep3.parcels.map((p, i) => whParcel(p, dep3, quoteDep3, i < 2 ? { checked_in_at: today(9, 40), warehouse_location: 'B3', condition: 'ok' } : {})),
  ...dep2.parcels.slice(0, 4).map((p, i) => whParcel(p, dep2, quoteDep2, i === 0 ? { checked_in_at: today(9, 42), warehouse_location: 'B4', condition: 'damaged', condition_note: 'Carton ouvert sur un coin' } : i === 3 ? { condition: 'missing', condition_note: null } : {})),
];
const whReady = [...dep3.parcels.map((p) => whParcel(p, dep3, quoteDep3, { checked_in_at: today(9, 40), warehouse_location: 'B3', condition: 'ok' })), whParcel(dep2.parcels[0], dep2, quoteDep2, { checked_in_at: today(9, 42), warehouse_location: 'B4', condition: 'damaged', condition_note: 'Carton ouvert' })];
const whRelease = { id: 'rel1', release_no: 'BR-000007', released_at: today(11, 5), picked_by_name: 'Samuel Ondo', picked_by_phone: '+241 66 55 44 33', signature_path: null, note: null, parcel_count: 3, released_by_name: 'Demo Admin', client: client2,
  parcels: dep3.parcels.map((p) => whParcel(p, dep3, quoteDep3, { checked_in_at: today(9, 40), warehouse_location: 'B3', condition: 'ok', delivered_at: today(11, 5), release_id: 'rel1', release_no: 'BR-000007' })) };
const clientsByCode = { [client.customer_code]: client, [client2.customer_code]: client2, [client3.customer_code]: client3 };
const accounts = [
  { id: 'acc1', name: 'PRC', code: 'PRC', contact_name: 'Prince', contact_phone: '+237 699 10 20 30', notes: null, is_active: true, client_count: 14, parcels_waiting: 62, created_at: '2026-09-01T08:00:00Z' },
  { id: 'acc2', name: 'Simon D1', code: 'D1', contact_name: 'Simon', contact_phone: '+237 677 40 50 60', notes: 'Zone D, charge un 40 pieds par mois', is_active: true, client_count: 9, parcels_waiting: 38, created_at: '2026-09-01T08:00:00Z' },
  { id: 'acc3', name: 'Fabrice B1', code: 'B1', contact_name: 'Fabrice', contact_phone: null, notes: null, is_active: true, client_count: 6, parcels_waiting: 0, created_at: '2026-09-01T08:00:00Z' },
  { id: 'acc4', name: 'Nkenkome F1', code: 'F1', contact_name: null, contact_phone: null, notes: null, is_active: true, client_count: 4, parcels_waiting: 11, created_at: '2026-09-01T08:00:00Z' },
  { id: 'acc5', name: '2L C1', code: 'C1', contact_name: null, contact_phone: null, notes: null, is_active: false, client_count: 2, parcels_waiting: 0, created_at: '2026-09-01T08:00:00Z' },
];
const RPC = {
  cargo_account_list: (b) => ({ success: true, accounts: b?.p_include_inactive ? accounts : accounts.filter((a) => a.is_active) }),
  cargo_account_clients: { success: true, clients: [{ client, parcels_waiting: 13 }, { client: { ...client3, account_id: 'acc1', account_name: 'PRC', account_code: 'PRC' }, parcels_waiting: 2 }] },
  cargo_account_upsert: (b) => ({ success: true, id: b?.p_id ?? 'acc9' }),
  cargo_account_assign: (b) => ({ success: true, client: { ...client2, account_id: b?.p_account_id, account_name: 'PRC', account_code: 'PRC' } }),
  reception_client_suppliers: { success: true, suppliers: [
    { kind: 'supplier', name: '广州鞋业有限公司 Guangzhou Shoes Co.', contact: 'Li Wei 李伟', phone: '138 0000 1234', email: 'liwei@gzshoes.cn', wechat: 'gzshoes_li', address: '广州市白云区石井大道 168 号 3 栋', last_at: today(9, 12) },
    { kind: 'buying_agent', name: 'Mme Chen 陈姐 (采购代理)', contact: null, phone: '186 5555 8888', email: null, wechat: 'chenjie88', address: null, last_at: '2026-09-02T03:10:00Z' },
    { kind: 'supplier', name: 'Yiwu Bags Factory 义乌箱包厂', contact: 'Zhang', phone: '159 1234 5678', email: null, wechat: null, address: null, last_at: '2026-08-20T03:10:00Z' },
  ] },
  reception_set_supplier: (b) => ({ success: true, deposit: { ...dep1, supplier_kind: b?.p_supplier_kind, supplier_name: b?.p_supplier_name, supplier_contact: b?.p_supplier_contact, supplier_phone: b?.p_supplier_phone } }),
  reception_recent_clients: { success: true, clients: [client, client2, client3] },
  reception_client: (b) => { const c = [client, client2, client3].find((x) => x.user_id === b.p_user_id); return c ? { success: true, client: c } : { success: false, error: 'Client introuvable' }; },
  reception_update_parcel: { success: true, deposit: dep1 },
  reception_client_by_code: (b) => { const code = /BZ-?(\d{6})/i.exec(b.p_code ?? '')?.[1]; const c = code ? clientsByCode['BZ-' + code] : null; return c ? { success: true, client: c } : { success: false, error: 'unknown_code', code: b.p_code }; },
  cargo_parts_summary: { success: true, containers: 1, containers_at_sea: 0, air_open: 3, air_in_flight: 1, parcels_waiting: 31, deposits_pending: 2, deposits_today: 3 },
  reception_overview: { success: true, by_receptionist: [
    { received_by: 'demo', name: 'Kevin Nkolo', deposits: 26, parcels: 158, weight_kg: 1210, cbm: 9.1, pending: 2, incomplete: 3 },
    { received_by: 'mei', name: 'Mei Lin', deposits: 12, parcels: 53, weight_kg: 430, cbm: 3.3, pending: 0, incomplete: 0 },
  ], deposits: [pend1, dep2, dep3, dep4, pend2].map(withQuote) },
  reception_stock: { success: true, stats: { parcels: 31, clients: 4, weight_kg: 248, cbm: 1.84, pending: 2 }, by_client: [
    { client, location: 'warehouse', parcels: 13, weight_kg: 110.7, cbm: 0.93, deposits: 2, last_at: today(14, 32) },
    { client: client2, location: 'warehouse', parcels: 3, weight_kg: 21, cbm: 0.18, deposits: 1, last_at: today(13, 18) },
    { client: client3, location: 'office', parcels: 2, weight_kg: 9, cbm: 0.05, deposits: 1, last_at: today(11, 52) },
    { client: null, location: 'warehouse', parcels: 2, weight_kg: 16, cbm: 0.104, deposits: 2, last_at: today(10, 24) },
  ] },
  reception_client_deposits: { success: true, deposits: [dep2Loaded, { ...dep1, status: 'closed', closed_at: today(14, 10) }, { ...dep3, client, deposit_no: 'RC-000098', opened_at: '2026-09-02T03:10:00Z', closed_at: '2026-09-02T03:18:00Z', parcels: loadedParcels.map((p) => ({ ...p, parcel_no: p.parcel_no.replace('RC-000121', 'RC-000098') })) }] },
  cargo_shipment_parcels: { success: true, parcels: loadedParcels },
  reception_loadable_parcels: { success: true, client_user_id: 'u1', parcels: [...dep2.parcels.slice(4).map((p) => withDep(p, dep2)), ...dep1.parcels.map((p) => withDep(p, dep1))] },
  reception_my_day: { success: true, day: '2026-09-20', stats: { deposits: 6, parcels: 31, weight_kg: 248, cbm: 1.84, open: 1 }, pending: 2, deposits: [dep0, dep1, dep2, dep3, dep4] },
  reception_pending_deposits: { success: true, deposits: [pend1, pend2] },
  reception_search_clients: { success: true, clients: [client, { ...client, user_id: 'u9', customer_code: 'BZ-119042', first_name: 'Paul', last_name: 'Mbarga', phone: '+237 699 00 11 22', company_name: null, city: 'Yaoundé' }] },
  cargo_pricing_get: pricing,
  cargo_pricing_set: (b) => ({ ...pricing, air_per_kg_xaf: b.p_air_per_kg_xaf, sea_per_cbm_xaf: b.p_sea_per_cbm_xaf }),
  cargo_quote_get: (b) => ({ success: true, quote: QUOTES[b.p_deposit_id] ?? null }),
  cargo_quote_ensure: (b) => ({ success: true, quote: QUOTES[b.p_deposit_id] ?? { ...quoteDep2, deposit_id: b.p_deposit_id } }),
  cargo_quote_set_line: { success: true, quote: quoteDep2 },
  cargo_quote_add_line: { success: true, quote: quoteDep2 },
  cargo_quote_remove_line: { success: true, quote: quoteDep2 },
  cargo_quote_send: { success: true, quote: { ...quoteDep2, status: 'sent', sent_at: today(15, 2) } },
  cargo_quote_add_payment: (b) => { const q = QUOTES[Object.keys(QUOTES).find((k) => QUOTES[k].id === b.p_quote_id) ?? 'dep2']; const pm = payment('pmN', 'RE-000042', b.p_amount_xaf, { method: b.p_method, place: b.p_place, reference: b.p_reference, proof_path: b.p_proof_path, note: b.p_note }); const paid = q.amount_paid_xaf + b.p_amount_xaf; return { success: true, payment_id: 'pmN', receipt_no: 'RE-000042', quote: { ...q, payments: [...q.payments, pm], amount_paid_xaf: paid, balance_xaf: Math.max(0, q.total_xaf - paid), status: paid >= q.total_xaf ? 'paid' : q.status } }; },
  cargo_quote_cancel_payment: { success: true, quote: quoteDep2 },
  cargo_quote_invoice: { success: true, invoice_no: 'FA-000013', quote: quoteDep3 },
  cargo_air_list: { success: true, shipments: [air2, air1, air3] },
  cargo_air_get: (b) => AIRS[b.p_air_id] ? { success: true, shipment: { ...AIRS[b.p_air_id], parcels: AIRS[b.p_air_id].parcels ?? air1Parcels } } : { success: false, error: 'Expédition introuvable' },
  cargo_air_loadable_parcels: { success: true, parcels: airLoadable },
  cargo_air_load_parcels: { success: true, loaded: 2, weight_kg: 16.8, cbm: 0.19 },
  cargo_air_set_status: (b) => ({ success: true, shipment: { ...air1, status: b.p_status, departed_at: b.p_status === 'DEPARTED' ? today(15, 30) : null } }),
  cargo_air_create: (b) => ({ success: true, shipment: { ...air1, id: 'airN', awb_number: b.p_awb_number, parcels: [], parcel_count: 0 } }),
  cargo_air_update: (b) => ({ success: true, shipment: { ...air1, flight_no: b.p_flight_no ?? air1.flight_no } }),
  cargo_air_unload_parcel: { success: true },
  warehouse_day: { success: true, day: '2026-09-21', stats: { to_checkin: 9, waiting: 5, missing: 1, delivered_today: 3 },
    arrivals: [{ kind: 'air', id: 'air3', ref: '07112340011', label: 'LTA 07112340011', sub: 'ET 607 · Ethiopian Airlines', arrived_at: '2026-09-13T11:40:00Z', expected: 7, checked: 3, missing: 1, delivered: 0 },
               { kind: 'sea', id: 'ct1', ref: 'MSKU 482913-7', label: 'MSKU 482913-7', sub: 'Mbarga Import · MAERSK SEMBAWANG', arrived_at: '2026-09-20T06:00:00Z', expected: 13, checked: 8, missing: 0, delivered: 0 }],
    waiting_by_client: [{ client: client2, parcels: 3, weight_kg: 25.2, since: today(9, 40), unpaid: false, balance_xaf: 0 }, { client, parcels: 5, weight_kg: 42, since: today(9, 42), unpaid: true, balance_xaf: 99840 }],
    releases_today: [{ id: 'rel1', release_no: 'BR-000007', released_at: today(11, 5), picked_by_name: 'Paul Fotso', parcel_count: 2, client: client3 }] },
  warehouse_arrival_parcels: (b) => ({ success: true, kind: b.p_kind, id: b.p_id, label: b.p_kind === 'air' ? 'LTA 07112340011' : 'MSKU 482913-7', sub: b.p_kind === 'air' ? 'ET 607 · Ethiopian Airlines' : 'Mbarga Import', parcels: whAir3 }),
  warehouse_checkin_parcel: (b) => ({ success: true, parcel: { ...whAir3[0], id: b.p_parcel_id, checked_in_at: today(15, 0), condition: b.p_condition } }),
  warehouse_checkin_many: (b) => ({ success: true, checked: (b.p_parcel_ids ?? []).length }),
  warehouse_flag_missing: (b) => ({ success: true, parcel: { ...whAir3[0], id: b.p_parcel_id, condition: b.p_missing ? 'missing' : null } }),
  warehouse_flag_missing_many: (b) => ({ success: true, flagged: (b.p_parcel_ids ?? []).length }),
  warehouse_find_parcel: (b) => ({ success: true, parcel: whAir3[0] }),
  warehouse_client_parcels: (b) => { const code = /BZ-?(\d{6})/i.exec(b.p_code ?? '')?.[1]; const c = code ? clientsByCode['BZ-' + code] : null; if (!c) return { success: false, error: 'unknown_code', code: b.p_code };
    const mine = c.user_id === 'u1' ? [whReady[3]] : c.user_id === 'u2' ? whReady.slice(0, 3) : []; const q = c.user_id === 'u1' ? quoteDep2 : quoteDep3;
    return { success: true, client: c, ready: mine, not_ready: c.user_id === 'u1' ? dep2.parcels.slice(1, 4).map((p) => whParcel(p, dep2, quoteDep2, { status: 'arrived' })) : [], releases: c.user_id === 'u2' ? [] : [],
      quotes: mine.length ? [{ id: q.id, quote_no: q.quote_no, deposit_id: q.deposit_id, deposit_no: q.deposit_no, status: q.status, total_xaf: q.total_xaf, amount_paid_xaf: q.amount_paid_xaf, balance_xaf: Math.max(0, q.total_xaf - q.amount_paid_xaf), invoice_no: q.invoice_no ?? null }] : [] }; },
  warehouse_release_parcels: { success: true, release: whRelease },
  warehouse_release_get: { success: true, release: whRelease },
  reception_get_deposit: (body) => ({ success: true, deposit: { dep0, dep1, dep2, dep3, dep4, pend1, pend2 }[body?.p_deposit_id] ?? dep1 }),
};

// DESKTOP=1 : 1440×900, sans émulation mobile — pour les écrans admin desktop dans le shell.
const DESKTOP = process.env.DESKTOP === '1';
// LANG=zh|en|fr : la langue de l'app pour les captures (fr par défaut).
const LANG = process.env.LANG_APP ?? 'fr';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
// VIEWPORT=320x568 (iPhone SE 1re gén.), 360x640 (petit Android), 375x667 (iPhone SE 2/3), 390x844 (défaut), 430x932 (grand iPhone).
const [VW, VH] = (process.env.VIEWPORT ?? '390x844').split('x').map(Number);
const ctx = await browser.newContext(DESKTOP
  ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, ignoreHTTPSErrors: true }
  : { viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, permissions: ['camera'], ignoreHTTPSErrors: true });
await ctx.addInitScript((lang) => {
  try { localStorage.setItem('bonzini-reception-location', 'warehouse'); localStorage.setItem('bonzini-language', lang); } catch { /* privé */ }
}, LANG);
// Polices : Google Fonts n'est pas joignable depuis le bac à sable ; FONTS_DIR
// (fonts.css + <md5(url+"\n")[0:16]>.woff2) les sert en local, sinon on capture avec la police système.
if (process.env.FONTS_DIR) {
  const { createHash } = await import('node:crypto');
  const css = readFileSync(join(process.env.FONTS_DIR, 'fonts.css'), 'utf8');
  const fontFile = (url) => join(process.env.FONTS_DIR, createHash('md5').update(url + '\n').digest('hex').slice(0, 16) + '.woff2');
  await ctx.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: css }));
  await ctx.route(/fonts\.gstatic\.com/, (r) => { try { r.fulfill({ status: 200, contentType: 'font/woff2', body: readFileSync(fontFile(r.request().url())) }); } catch { r.fulfill({ status: 404, body: '' }); } });
}
// Le générique d'abord : Playwright sert la DERNIÈRE route enregistrée qui correspond.
await ctx.route(/supabase\.co|\/rest\/v1|\/auth\/v1|\/storage\/v1/, (r) => {
  // Le shell desktop (barre latérale, fiche client) lit les fixtures admin ; le reste reçoit [].
  const req = r.request();
  if (req.method() === 'OPTIONS' || req.method() === 'HEAD') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-range': '0-0/0' }, body: '' });
  let body = [];
  try { body = adminRespond(req.url()) ?? []; } catch { body = []; }
  if ((req.headers()['accept'] ?? '').includes('pgrst.object') && Array.isArray(body)) body = body[0] ?? null;
  r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'content-range': `0-9/${Array.isArray(body) ? body.length : 1}` }, body: JSON.stringify(body) });
});
// Les photos des colis : createSignedUrl répond une URL locale, que l'on sert depuis PHOTOS_DIR (carton-1.jpg…).
await ctx.route(/\/storage\/v1\/object\/sign\/parcel-photos\//, (route) => {
  const req = route.request();
  const url = req.url();
  if (req.method() === 'POST') { const path = url.split('/object/sign/')[1]; return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ signedURL: `/object/sign/${path}?token=demo` }) }); }
  const m = /carton-(\d)\.jpg/.exec(url); const file = process.env.PHOTOS_DIR && m ? join(process.env.PHOTOS_DIR, `carton-${m[1]}.jpg`) : null;
  try { return route.fulfill({ status: 200, contentType: 'image/jpeg', headers: { 'access-control-allow-origin': '*' }, body: readFileSync(file) }); } catch { return route.fulfill({ status: 404, body: '' }); }
});
// Les réglages d'expédition RÉELS (copie de platform_settings.shipping, 21/09/2026) : l'étiquette capturée est celle que Tina reçoit.
await ctx.route(/\/rest\/v1\/platform_settings/, (route) => {
  const single = (route.request().headers()['accept'] ?? '').includes('pgrst.object');
  const row = { key: 'shipping', value: {
    company: { email: 'contact@bonzinilabs.com', phone: '+8618667439286', nameEn: 'NORTON GAUSS BONZINI', nameZh: '诺顿·高斯·邦齐尼', wechat: '+8618667439286', whatsapp: '+8618667439286' },
    warehouse: { email: 'contact@bonzinilabs.com', phone: '18667439286', wechat: '18667439286', whatsapp: '18667439286', recipient: 'Tina',
      addressEn: 'Bonzini Trading Cargo, an iron warehouse located directly opposite the sales department of Yunxi Song Garden Center in Shimen Street, Baiyun District, Guangzhou City, Guangdong Province',
      addressZh: '广东省广州市白云区石门街道云溪颂花园中心售楼部正对面铁皮仓库 Bonzini Trading Cargo' },
    office: { email: 'contact@bonzinilabs.com', phone: '18667439286', wechat: '18667439286', whatsapp: '18667439286', recipient: 'Tina',
      addressEn: '259, 2/F, Cameroon Building, No. 219 Guangyuan West Road, Guangzhou, China', addressZh: '广州市广园西路219号\n客麦隆大厦二楼 259' },
  } };
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(single ? row : [row]) });
});
await ctx.route(/\/rest\/v1\/cargo_shipments/, (route) => {
  const single = (route.request().headers()['accept'] ?? '').includes('pgrst.object');
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(single ? shipment : [shipment]) });
});
await ctx.route(/\/rest\/v1\/rpc\/(\w+)/, async (route) => {
  const name = /\/rpc\/(\w+)/.exec(route.request().url())?.[1];
  const body = route.request().postDataJSON?.() ?? {};
  const fx = RPC[name];
  const json = typeof fx === 'function' ? fx(body) : fx ?? { success: false, error: `fixture manquante : ${name}` };
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
});

const SCREENS = ['rc-location', 'rc-home', 'rc-identify', 'rc-search', 'rc-how', 'rc-client', 'rc-deposit', 'rc-deposit-empty', 'rc-parcel', 'rc-parcel-weight', 'rc-parcel-dims', 'rc-parcel-inside', 'rc-parcel-copies', 'rc-parcel-edit', 'rc-done', 'rc-pending', 'rc-clients', 'rc-client-card'];
for (const screen of ONLY.length ? ONLY : SCREENS) {
  const page = await ctx.newPage();
  // DEBUG_NET=1 : trace les requêtes vers Supabase (REST, storage) et leur réponse.
  if (process.env.DEBUG_NET) { page.on('requestfailed', (r) => console.log('FAILED', r.url().slice(0, 120), r.failure()?.errorText)); page.on('request', (r) => { if (/supabase|storage/.test(r.url())) console.log('REQ', r.method(), r.url().slice(0, 140)); }); page.on('response', (r) => { if (/supabase|storage/.test(r.url())) console.log('RES', r.status(), r.url().slice(0, 100)); }); }
  const key = screen === 'rc-location' ? 'rc-home' : screen === 'rc-client-card-label' ? 'rc-client-card' : screen;
  if (screen === 'rc-location') await page.addInitScript(() => { try { localStorage.removeItem('bonzini-reception-location'); } catch { /* privé */ } });
  if (screen === 'rc-identify') await page.addInitScript(() => { try { sessionStorage.setItem('bonzini-reception-draft', 'SF2884193055221'); } catch { /* privé */ } });
  if (screen === 'wh-who' || screen === 'wh-sign') await page.addInitScript(() => { try { sessionStorage.setItem('bonzini-warehouse-release', JSON.stringify({ code: 'BZ-510224', ids: ['dep3-1', 'dep3-2', 'dep3-3'], who: 'Samuel Ondo', phone: '+241 66 55 44 33' })); } catch { /* privé */ } });
  await page.goto(`http://localhost:8080/screenshot.html?screen=${key}&theme=light`, { waitUntil: 'networkidle' });
  if (screen === 'cargo-deposit-photo' || screen === 'rc-deposit-photo' || screen === 'wh-client-photo') { await page.click('button[aria-label="Voir la photo en grand"]'); await page.waitForTimeout(900); }
  if (screen === 'rc-search') { await page.fill('input[inputmode="search"]', 'Mbarga'); await page.waitForTimeout(600); }
  if (screen === 'rc-parcel-weight') await page.fill('#p-weight', '8,4');
  if (screen === 'rc-parcel-dims') { const dims = page.locator('input[inputmode="decimal"]'); await dims.nth(0).fill('60'); await dims.nth(1).fill('40'); await dims.nth(2).fill('40'); }
  if (screen === 'rc-parcel-inside') await page.fill('#p-desc', 'Chaussures, 40 paires');
  if (screen === 'wh-parcel-damaged') { await page.click('text=Oui, mais abîmé'); await page.waitForTimeout(400); }
  if (screen === 'cargo-desk-air-load') { await page.click('text=Charger des colis'); await page.waitForTimeout(600); }
  if (screen === 'cargo-quote-pay') { await page.click('text=Encaisser'); await page.waitForTimeout(500); }
  if (screen === 'rc-client-card-label') {
    // La feuille de l'étiquette : on l'ouvre et on laisse le peintre finir l'aperçu.
    await page.getByRole('button', { name: /Étiquette colis|Shipping label|货物标签/ }).first().click();
    await page.waitForTimeout(2500);
  }
  if (screen === 'client-desk-panel') {
    // Le panneau de la fiche client défile en interne : on amène le bloc « Colis reçus » à l'écran.
    const block = page.getByText('Colis reçus', { exact: true }).first();
    await block.scrollIntoViewIfNeeded().catch(() => {});
  }
  await page.evaluate(() => document.fonts.ready);
  if (process.env.DEBUG_NET) console.log('IMG', await page.evaluate(() => [...document.querySelectorAll('img')].map((i) => `${i.getAttribute('src')?.slice(0, 120)} ${i.naturalWidth}x${i.naturalHeight}`).slice(0, 4)));
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, `${screen}.png`), fullPage: !DESKTOP || screen.includes('reception') || screen.includes('chargement') });
  console.log(screen, 'ok');
  await page.close();
}
await browser.close();
