// ============================================================
// Parcours — domaine « guangzhou » : le bureau et l'entrepôt de Bonzini à Guangzhou.
//   node tools/shoot-journey.mjs guangzhou [clé-ou-nom…]
// Lundi 05/10/2026. Kevin Nkolo (réceptionnaire, téléphone, /r, au bureau = colis avion)
// reçoit le dépôt d'Aïcha Mbarga, l'étiquette, puis remplit le paquet avion PQ-000045
// (32 kg au plus) ; un colis de trop est refusé, il ferme le paquet (pesée) et imprime
// son étiquette. Au bureau, Grace Ebogo (ops, ordinateur) chiffre le fret et l'encaisse.
// Écrans : src/__screenshot__/journey/guangzhou.tsx. Formes : les RPC reception_*,
// air_package_* (20261005170000_air_packages.sql) et cargo_quote_*.
// PHOTOS_DIR : les photos des cartons (carton-1.jpg…) ; sans elles, des vignettes vides.
// ============================================================
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { respond as adminRespond } from '../adminFixtures.mjs';

const OUT = process.env.OUT ?? 'tools/out/journey/guangzhou';
const PHOTOS_DIR = process.env.PHOTOS_DIR ?? '/tmp/claude-0/-home-user-bonzinilabs/92f1802a-f3c0-56ac-9075-93a354e8c31d/scratchpad/photos';
// FONTS_DIR : DM Sans et Noto Sans SC (fonts.css + <md5(url)[0:16]>.woff2), servis en local — Google Fonts est capricieux
// depuis le bac à sable. Sans eux : la police CJK du système (wqy) pour le chinois des étiquettes.
const FONTS_DIR = process.env.FONTS_DIR ?? '/tmp/claude-0/-home-user-bonzinilabs/92f1802a-f3c0-56ac-9075-93a354e8c31d/scratchpad/gzfonts';
const CJK_FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc';

const pad = (n) => String(n).padStart(2, '0');
/** Une heure de Guangzhou (UTC+8), le 05/10/2026 — ou un autre jour d'octobre. */
const gz = (h, m, day = 5) => { const d = new Date(Date.UTC(2026, 9, day, h - 8, m)); return d.toISOString().replace('.000Z', 'Z'); };

// ── Les clients (reception_client_card) ──
const card = (o) => ({ email: null, company_name: null, account_id: null, account_name: null, account_code: null, ...o });
const aicha = card({ user_id: 'u1', customer_code: 'BZ-482913', first_name: 'Aïcha', last_name: 'Mbarga', phone: '+237 677 12 34 56', email: 'aicha@mbarga-import.cm', company_name: 'Mbarga Import SARL', city: 'Douala', country: 'Cameroun' });
const samuel = card({ user_id: 'u2', customer_code: 'BZ-510224', first_name: 'Samuel', last_name: 'Ondo', phone: '+241 66 55 44 33', company_name: 'Ondo Distribution', city: 'Libreville', country: 'Gabon' });
const nadia = card({ user_id: 'u3', customer_code: 'BZ-207781', first_name: 'Nadia', last_name: 'Fotso', phone: '+237 699 88 77 66', city: 'Yaoundé', country: 'Cameroun' });

// ── Les dépôts du jour, tous au bureau (avion) ──
const cbm = (l, w, h) => Math.round((l * w * h) / 1e6 * 10000) / 10000;
const parcel = (no, seq, kind, desc, kg, [l, w, h], o) => ({
  id: `p${no}-${seq}`, seq, parcel_no: `${no}-${pad(seq)}`, kind, weight_kg: kg, length_cm: l, width_cm: w, height_cm: h, cbm: cbm(l, w, h),
  description: desc, courier_waybill: null, photo_path: null, photos: [], status: 'received', shipment_id: null, container_number: null,
  air_shipment_id: null, awb_number: null, created_at: gz(14, 8), ...o,
});
const withPhoto = (p, n) => ({ ...p, photo_path: `rc123/carton-${n}.jpg`, photos: [{ id: `ph-${p.id}`, path: `rc123/carton-${n}.jpg`, position: 0, created_at: p.created_at }] });
const deposit = (o) => {
  const d = { location: 'office', brought_by: 'client', representative_name: null, representative_phone: null, status: 'closed', received_by: 'demo', received_by_name: 'Kevin Nkolo', closed_at: null, notes: null, updated_at: o.closed_at ?? o.opened_at, ...o };
  d.parcel_count = d.parcels.length;
  d.total_weight_kg = Math.round(d.parcels.reduce((s, p) => s + p.weight_kg, 0) * 10) / 10;
  d.total_cbm = Math.round(d.parcels.reduce((s, p) => s + p.cbm, 0) * 10000) / 10000;
  return d;
};
const supplierShoes = { supplier_kind: 'supplier', supplier_name: '广州鞋业有限公司 Guangzhou Shoes Co.', supplier_contact: 'Li Wei 李伟', supplier_phone: '138 0000 1234', supplier_email: 'liwei@gzshoes.cn', supplier_wechat: 'gzshoes_li', supplier_address: '广州市白云区石井大道 168 号 3 栋' };
const noSupplier = { supplier_kind: null, supplier_name: null, supplier_contact: null, supplier_phone: null, supplier_email: null, supplier_wechat: null, supplier_address: null };

// RC-000123 : le dépôt d'Aïcha en cours (3 colis pesés, mesurés, photographiés), puis terminé.
const dep1 = deposit({
  id: 'dep1', deposit_no: 'RC-000123', client: aicha, status: 'open', opened_at: gz(14, 5), ...supplierShoes,
  parcels: [
    withPhoto(parcel('RC-000123', 1, 'carton', 'Chaussures, 40 paires', 8.4, [60, 40, 40], { created_at: gz(14, 8) }), 1),
    withPhoto(parcel('RC-000123', 2, 'carton', 'Tissus wax, 12 pièces', 12.1, [60, 40, 35], { created_at: gz(14, 12) }), 2),
    withPhoto(parcel('RC-000123', 3, 'bag', 'Sacs à main, 30 pièces', 6.2, [50, 35, 30], { created_at: gz(14, 16) }), 3),
  ],
});
const dep1c = { ...dep1, id: 'dep1c', status: 'closed', closed_at: gz(14, 21), updated_at: gz(14, 21), parcels: dep1.parcels.map((p) => ({ ...p, id: p.id.replace('pRC', 'cRC') })) };
// Plus tôt dans la journée : Aïcha (RC-000122), Samuel par coursier (RC-000121), Nadia par son représentant (RC-000120).
const dep2 = deposit({
  id: 'dep2', deposit_no: 'RC-000122', client: aicha, opened_at: gz(11, 10), closed_at: gz(11, 24), ...supplierShoes,
  parcels: [
    parcel('RC-000122', 1, 'carton', 'Chaussures, 36 paires', 9.2, [55, 40, 35]),
    parcel('RC-000122', 2, 'carton', 'Tissus wax, 10 pièces', 11.5, [60, 40, 30]),
    parcel('RC-000122', 3, 'bag', 'Sacs à main, 25 pièces', 5.6, [45, 35, 25]),
    parcel('RC-000122', 4, 'carton', 'Coques de téléphone, 200 pièces', 3.2, [35, 25, 20]),
    parcel('RC-000122', 5, 'carton', 'Tissus wax, 9 pièces', 10.8, [60, 40, 30]),
    parcel('RC-000122', 6, 'carton', 'Chaussures, 34 paires', 8.7, [55, 40, 35]),
  ],
});
const dep3 = deposit({
  id: 'dep3', deposit_no: 'RC-000121', client: samuel, brought_by: 'courier', opened_at: gz(10, 2), closed_at: gz(10, 9), ...noSupplier,
  parcels: [
    parcel('RC-000121', 1, 'carton', 'Pièces auto (plaquettes de frein)', 7.5, [40, 30, 25], { courier_waybill: 'SF1427730918852' }),
    parcel('RC-000121', 2, 'carton', 'Pièces auto (filtres à huile)', 4.9, [30, 25, 20], { courier_waybill: 'SF1427730918852' }),
    parcel('RC-000121', 3, 'carton', 'Ampoules LED pour phares', 6.1, [40, 30, 25], { courier_waybill: 'SF1427730918869' }),
  ],
});
const dep4 = deposit({
  id: 'dep4', deposit_no: 'RC-000120', client: nadia, brought_by: 'representative', representative_name: 'Paul Fotso', representative_phone: '+86 135 0244 8812', opened_at: gz(9, 35), closed_at: gz(9, 41), ...noSupplier,
  parcels: [
    parcel('RC-000120', 1, 'bag', 'Perruques, 12 pièces', 3.6, [40, 30, 20]),
    parcel('RC-000120', 2, 'carton', 'Cosmétiques', 2.6, [30, 25, 20]),
  ],
});
// Un colis arrivé par coursier sans nom de client : il attend d'être attribué.
const pend1 = deposit({
  id: 'pend1', deposit_no: 'RC-000119', client: null, brought_by: 'courier', opened_at: gz(9, 12), closed_at: gz(9, 15), ...noSupplier,
  parcels: [parcel('RC-000119', 1, 'carton', 'Fournisseur Yiwu Hengda (sur le bordereau)', 4.4, [40, 30, 30], { courier_waybill: 'YT7731002588108' })],
});
const DEPOSITS = { dep1, dep1c, dep2, dep3, dep4, pend1 };
const dayDeposits = [dep1, dep2, dep3, dep4];
const sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);

// ── Les paquets avion (air_package_json) ──
const pkParcel = (p, d) => ({
  id: p.id, seq: p.seq, parcel_no: p.parcel_no, kind: p.kind, weight_kg: p.weight_kg, cbm: p.cbm, description: p.description, status: 'received', photo_path: p.photo_path,
  checked_in_at: null, warehouse_location: null, condition: null, delivered_at: null, deposit_no: d.deposit_no, deposit_id: d.id, client: d.client,
});
// PQ-000045 : 6 colis de 3 clients, 27,4 kg sur 32 (rangés comme la RPC : client, dépôt, n°).
const pk45Parcels = [
  pkParcel(dep2.parcels[2], dep2), pkParcel(dep2.parcels[3], dep2),
  pkParcel(dep3.parcels[0], dep3), pkParcel(dep3.parcels[1], dep3),
  pkParcel(dep4.parcels[0], dep4), pkParcel(dep4.parcels[1], dep4),
];
const pkg = (o) => ({
  id: 'pk', package_no: 'PQ-000000', status: 'open', air_shipment_id: null, awb_number: null, air_status: null, etd: null, flight_no: null,
  max_weight_kg: 32, gross_weight_kg: null, length_cm: null, width_cm: null, height_cm: null, notes: null,
  net_weight_kg: 0, parcel_count: 0, client_count: 0, checked_count: 0, missing_count: 0,
  sealed_at: null, handed_over_at: null, refused_at: null, refusal_reason: null, refused_air_shipment_id: null,
  received_at: null, opened_at: null, created_at: gz(9, 0), updated_at: gz(9, 0), parcels: null, ...o,
});
const pk45 = pkg({
  id: 'pk45', package_no: 'PQ-000045', created_at: gz(15, 2), updated_at: gz(16, 18),
  net_weight_kg: Math.round(sum(pk45Parcels, (p) => p.weight_kg) * 100) / 100, parcel_count: pk45Parcels.length, client_count: 3, parcels: pk45Parcels,
});
const pk45Sealed = { ...pk45, status: 'sealed', gross_weight_kg: 28.1, length_cm: 70, width_cm: 50, height_cm: 45, sealed_at: gz(16, 42), updated_at: gz(16, 42) };
const pk44 = pkg({ id: 'pk44', package_no: 'PQ-000044', status: 'sealed', net_weight_kg: 30.9, gross_weight_kg: 31.6, length_cm: 70, width_cm: 50, height_cm: 50, parcel_count: 9, client_count: 4, created_at: gz(10, 30), sealed_at: gz(14, 50), updated_at: gz(14, 50) });
const pk43 = pkg({ id: 'pk43', package_no: 'PQ-000043', status: 'sealed', net_weight_kg: 29.1, gross_weight_kg: 29.8, length_cm: 65, width_cm: 45, height_cm: 45, parcel_count: 7, client_count: 3, created_at: gz(16, 5, 3), sealed_at: gz(10, 15), updated_at: gz(10, 15) });
// PQ-000042 : affecté au vol ET 607 de mercredi (LTA connue).
const pk42 = pkg({ id: 'pk42', package_no: 'PQ-000042', status: 'sealed', air_shipment_id: 'air1', awb_number: '07112345675', air_status: 'PLANNED', etd: '2026-10-07', flight_no: 'ET 607',
  net_weight_kg: 30.6, gross_weight_kg: 31.2, length_cm: 70, width_cm: 50, height_cm: 45, parcel_count: 8, client_count: 3, created_at: gz(11, 0, 3), sealed_at: gz(15, 40, 3), updated_at: gz(9, 20) });
// PQ-000041 : refusé à l'aéroport vendredi (soute pleine) — revenu au bureau, à remettre sur un autre vol.
const pk41 = pkg({ id: 'pk41', package_no: 'PQ-000041', status: 'refused', refused_at: gz(18, 5, 2), refused_air_shipment_id: 'air0',
  refusal_reason: 'Soute pleine sur le vol ET 607 du 02/10 : à remettre sur le prochain vol',
  net_weight_kg: 29.8, gross_weight_kg: 30.4, length_cm: 70, width_cm: 50, height_cm: 45, parcel_count: 6, client_count: 2, created_at: gz(10, 0, 1), sealed_at: gz(17, 10, 1), updated_at: gz(18, 5, 2) });

const listRow = (p) => ({ ...p, parcels: null });
// État du parcours : le paquet PQ-000045 se ferme pendant l'écran 8 (remis à zéro à chaque écran).
const state = { sealed: false };

// ── Le devis du dépôt RC-000123 (au kilo, avion) et ses encaissements ──
const pricing = { success: true, air_per_kg_xaf: 6500, sea_per_cbm_xaf: 180000, currency: 'XAF' };
const quoteLine = (p, i) => ({
  id: `ql-${p.id}`, seq: i + 1, kind: 'parcel', label: p.parcel_no, basis: 'per_kg', quantity: p.weight_kg, unit_price_xaf: 6500, amount_xaf: Math.round(p.weight_kg * 6500),
  parcel_id: p.id, parcel_no: p.parcel_no, parcel_seq: p.seq, kind_of_parcel: p.kind, description: p.description, weight_kg: p.weight_kg, cbm: p.cbm,
  length_cm: p.length_cm, width_cm: p.width_cm, height_cm: p.height_cm, courier_waybill: p.courier_waybill, container_number: null, awb_number: null,
});
const payment = (id, no, amount, o) => ({ id, receipt_no: no, amount_xaf: amount, method: 'mobile_money', place: 'douala', paid_at: gz(16, 31), reference: 'OM251005.0931.K8F4', proof_path: null, note: null, received_by: 'grace', received_by_name: 'Grace Ebogo', created_at: gz(16, 31), cancelled_at: null, cancel_reason: null, ...o });
const quote = (() => {
  const lines = dep1c.parcels.map(quoteLine);
  const total = sum(lines, (l) => l.amount_xaf);
  const payments = [payment('pm1', 'RE-000044', 100000)];
  const paid = 100000;
  return {
    id: 'q32', quote_no: 'DV-000032', deposit_id: 'dep1c', status: 'sent', currency: 'XAF', total_xaf: total, amount_paid_xaf: paid, balance_xaf: total - paid, notes: null,
    sent_at: gz(14, 40), paid_at: null, invoice_no: null, invoiced_at: null, created_at: gz(14, 33), updated_at: gz(16, 31),
    deposit_no: dep1c.deposit_no, location: 'office', opened_at: dep1c.opened_at, closed_at: dep1c.closed_at, client: aicha,
    supplier_kind: dep1c.supplier_kind, supplier_name: dep1c.supplier_name, received_by_name: 'Kevin Nkolo', containers: [], flights: [], lines, payments,
  };
})();
const QUOTES = { dep1c: quote };
const withQuote = (d) => { const q = QUOTES[d.id]; return q ? { ...d, quote_status: q.status, quote_no: q.quote_no, quote_total_xaf: q.total_xaf, quote_paid_xaf: q.amount_paid_xaf, invoice_no: null } : { ...d, quote_status: null, quote_no: null, quote_total_xaf: null, quote_paid_xaf: null, invoice_no: null }; };
const quotePaid = (amount, b) => {
  const pm = payment('pm2', 'RE-000045', amount, { method: b.p_method ?? 'mobile_money', place: b.p_place ?? 'douala', reference: b.p_reference ?? null, paid_at: gz(16, 55), created_at: gz(16, 55) });
  const paid = quote.amount_paid_xaf + amount;
  return { ...quote, payments: [...quote.payments, pm], amount_paid_xaf: paid, balance_xaf: Math.max(0, quote.total_xaf - paid), status: paid >= quote.total_xaf ? 'paid' : quote.status, paid_at: paid >= quote.total_xaf ? gz(16, 55) : null };
};

// Le 655 44 33 22 est l'AUTRE numéro (Orange) d'un prospect de Rodrigue Tchami :
// sa fiche remplit d'office ce que Kevin n'a pas encore tapé (06/10).
const PROSPECT_BEATRICE = {
  success: true, found: true, prospect_id: 'pr-beatrice', prospect_name: 'Béatrice Ngo Mbock',
  source_id: 'src-rodrigue', source_label: 'Rodrigue Tchami', source_active: true,
  first_name: 'Béatrice', last_name: 'Ngo Mbock', company: 'Ngo Mbock Cosmétiques', city: 'Douala', email: 'beatrice@ngombock.cm',
  gender: 'FEMALE', birth_date: '1987-11-03', phone_e164: '+237677445566',
  phones: [{ phone_e164: '+237655443322', country_iso: 'CM', label: 'Orange' }, { phone_e164: '+8613822223333', country_iso: 'CN', label: 'Chine' }],
};

export const RPC = {
  // Nouveau client créé à la réception (06/10) : l'origine « colis reçu » se pose d'office.
  prospect_lookup_phone: (b) => (['+237655443322', '+237677445566'].includes(String(b?.p_phone ?? '').replace(/[\s.()-]/g, ''))
    ? PROSPECT_BEATRICE : { success: true, found: false }),
  admin_create_client: { success: true, clientId: 'u-new', walletId: 'w-new', authEmail: '237677998877@bonzini-client.local', tempPassword: 'k7d2m9q4', message: 'Client Joseph Etame créé avec succès' },
  reception_set_client_origin: { success: true, kept: false, source_id: 'src-parcel-office', label: 'Bureau de Guangzhou (avion)', kind: 'parcel' },
  // Réception (/r)
  reception_my_day: {
    success: true, day: '2026-10-05',
    stats: { deposits: dayDeposits.length, parcels: sum(dayDeposits, (d) => d.parcel_count), weight_kg: Math.round(sum(dayDeposits, (d) => d.total_weight_kg) * 10) / 10, cbm: Math.round(sum(dayDeposits, (d) => d.total_cbm) * 1000) / 1000, open: 1 },
    pending: 1, deposits: dayDeposits,
  },
  reception_get_deposit: (b) => ({ success: true, deposit: DEPOSITS[b?.p_deposit_id] ?? dep1 }),
  reception_pending_deposits: { success: true, deposits: [pend1] },
  reception_recent_clients: { success: true, clients: [aicha, samuel, nadia] },
  reception_client: (b) => { const c = [aicha, samuel, nadia].find((x) => x.user_id === b?.p_user_id); return c ? { success: true, client: c } : { success: false, error: 'Client introuvable' }; },
  reception_client_suppliers: { success: true, suppliers: [{ kind: 'supplier', name: supplierShoes.supplier_name, contact: supplierShoes.supplier_contact, phone: supplierShoes.supplier_phone, email: supplierShoes.supplier_email, wechat: supplierShoes.supplier_wechat, address: supplierShoes.supplier_address, last_at: gz(11, 10) }] },
  reception_close_deposit: { success: true, deposit: dep1c },

  // Paquets avion
  air_package_list: () => ({ success: true, packages: [state.sealed ? pk45Sealed : pk45, pk41, pk44, pk43, pk42].map(listRow) }),
  air_package_get: (b) => {
    const byId = { pk45: state.sealed ? pk45Sealed : pk45, pk44, pk43, pk42, pk41 };
    const m = /PQ[\s-]?(\d{1,9})/i.exec(b?.p_code ?? '');
    const code = m ? `PQ-${String(Number(m[1])).padStart(6, '0')}` : null;
    const p = b?.p_package_id ? byId[b.p_package_id] : Object.values(byId).find((x) => x.package_no === code);
    return p ? { success: true, package: { ...p, parcels: p.parcels ?? [] } } : { success: false, error: 'Paquet introuvable' };
  },
  // Le colis de trop : RC-000123-01 (8,4 kg) ferait passer PQ-000045 de 27,4 à 35,8 kg — réponse exacte de la RPC.
  air_package_add_parcel: (b) => {
    const code = /RC-?(\d{6})-?(\d{2,3})/i.exec(b?.p_code ?? '');
    if (!code) return { success: false, error: 'Ce n\'est pas une étiquette de colis (RC-000000-00)' };
    const no = `RC-${code[1]}-${code[2]}`;
    const p = [...dep1.parcels, ...dep2.parcels, ...dep3.parcels, ...dep4.parcels].find((x) => x.parcel_no === no);
    if (!p) return { success: false, error: `Colis ${no} introuvable` };
    if (pk45Parcels.some((x) => x.parcel_no === no)) return { success: true, already: true, parcel_no: no, package: pk45 };
    const next = Math.round((pk45.net_weight_kg + p.weight_kg) * 10) / 10;
    if (next > 32) return { success: false, error: `Le paquet passerait à ${next.toFixed(1)} kg : 32 kg au plus. Commencez un autre paquet.`, over: true };
    return { success: false, error: `Le colis ${no} est déjà dans le paquet PQ-000044` };
  },
  air_package_seal: (b) => { state.sealed = true; return { success: true, package: { ...pk45Sealed, gross_weight_kg: b?.p_gross_weight_kg ?? 28.1, length_cm: b?.p_length_cm ?? null, width_cm: b?.p_width_cm ?? null, height_cm: b?.p_height_cm ?? null } }; },
  air_package_create: { success: true, package: pkg({ id: 'pk46', package_no: 'PQ-000046', created_at: gz(16, 43), updated_at: gz(16, 43), parcels: [] }) },

  // Bureau : la console cargo et le devis
  cargo_parts_summary: { success: true, containers: 1, containers_at_sea: 1, air_open: 1, air_in_flight: 0, parcels_waiting: 19, deposits_pending: 1, deposits_today: 4 },
  reception_board: (b) => {
    const list = b?.p_scope === 'cancelled' ? [] : [dep1c, dep2, dep3, dep4, pend1];
    const rows = list.filter((d) => !b?.p_location || d.location === b.p_location).map(withQuote);
    return { success: true, scope: b?.p_scope ?? 'stock', total: rows.length, truncated: false, deposits: rows };
  },
  reception_stock: { success: true, stats: { parcels: 15, clients: 3, weight_kg: 104.8, cbm: 0.62, pending: 1 }, by_client: [
    { client: aicha, location: 'office', parcels: 9, weight_kg: 75.7, cbm: 0.47, deposits: 2, last_at: gz(14, 21) },
    { client: samuel, location: 'office', parcels: 3, weight_kg: 18.5, cbm: 0.09, deposits: 1, last_at: gz(10, 9) },
    { client: nadia, location: 'office', parcels: 2, weight_kg: 6.2, cbm: 0.04, deposits: 1, last_at: gz(9, 41) },
    { client: null, location: 'office', parcels: 1, weight_kg: 4.4, cbm: 0.036, deposits: 1, last_at: gz(9, 15) },
  ] },
  reception_overview: { success: true, by_receptionist: [{ received_by: 'demo', name: 'Kevin Nkolo', deposits: 5, parcels: 15, weight_kg: 104.8, cbm: 0.62, pending: 1, incomplete: 0 }], deposits: [dep1c, dep2, dep3, dep4, pend1].map(withQuote) },
  reception_search_clients: { success: true, clients: [aicha] },
  warehouse_day: { success: true, day: '2026-10-05', stats: { to_checkin: 0, waiting: 0, missing: 0, delivered_today: 0 }, arrivals: [], waiting_by_client: [], releases_today: [] },
  cargo_pricing_get: pricing,
  cargo_quote_get: (b) => ({ success: true, quote: QUOTES[b?.p_deposit_id] ?? null }),
  cargo_quote_ensure: (b) => ({ success: true, quote: QUOTES[b?.p_deposit_id] ?? quote }),
  cargo_quote_add_payment: (b) => { const q = quotePaid(Math.round(b?.p_amount_xaf ?? quote.balance_xaf), b ?? {}); return { success: true, payment_id: 'pm2', receipt_no: 'RE-000045', quote: q }; },
  air_package_unassign: { success: false, error: 'Non utilisé dans ce parcours' },
};

/** Les lectures directes : réglages d'expédition (étiquettes) et solde du client. */
export function REST(url) {
  // La fiche client : l'origine posée par la réception et « Enregistré par » (06/10).
  if (/\/rest\/v1\/clients\?select=source_id/.test(url)) {
    return [{ source_id: 'src-parcel-office', source_set_at: '2026-10-06T07:12:00Z', created_at: '2026-10-06T07:11:00Z',
      registered_by: 'kevin', registered_by_name: 'Kevin Nkolo', registered_role: 'receptionist', registered_site: 'Guangzhou · bureau', registered_at: '2026-10-06T07:11:00Z',
      source: { id: 'src-parcel-office', kind: 'parcel', label: 'Bureau de Guangzhou (avion)', phone: null } }];
  }
  // La fiche de Fatou Ndiaye (u5) : son sexe et sa date de naissance (06/10).
  if (/\/rest\/v1\/clients\?select=\*/.test(url) && /user_id=eq\.u5/.test(url)) {
    return (adminRespond(url) ?? []).map((c) => ({ ...c, gender: 'FEMALE', date_of_birth: '1988-04-21' }));
  }
  if (/\/rest\/v1\/platform_settings/.test(url)) {
    return [{ key: 'shipping', value: {
      company: { email: 'contact@bonzinilabs.com', phone: '+8618667439286', nameEn: 'NORTON GAUSS BONZINI', nameZh: '诺顿·高斯·邦齐尼', wechat: '+8618667439286', whatsapp: '+8618667439286' },
      warehouse: { email: 'contact@bonzinilabs.com', phone: '18667439286', wechat: '18667439286', whatsapp: '18667439286', recipient: 'Tina',
        addressEn: 'Bonzini Trading Cargo, an iron warehouse located directly opposite the sales department of Yunxi Song Garden Center in Shimen Street, Baiyun District, Guangzhou City, Guangdong Province',
        addressZh: '广东省广州市白云区石门街道云溪颂花园中心售楼部正对面铁皮仓库 Bonzini Trading Cargo' },
      office: { email: 'contact@bonzinilabs.com', phone: '18667439286', wechat: '18667439286', whatsapp: '18667439286', recipient: 'Tina',
        addressEn: '259, 2/F, Cameroon Building, No. 219 Guangyuan West Road, Guangzhou, China', addressZh: '广州市广园西路219号\n客麦隆大厦二楼 259' },
    } }];
  }
  if (/\/rest\/v1\/wallets\?/.test(url)) return [{ id: 'w1', user_id: 'u1', balance_xaf: 250000, created_at: '2026-09-01T08:00:00Z', updated_at: gz(9, 0) }];
  return undefined;
}

// ── Préparation de chaque page : heure de Guangzhou, lieu « bureau », photos, police chinoise ──
async function setup(page, { tz = 'Asia/Shanghai' } = {}) {
  state.sealed = false;
  try {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTimezoneOverride', { timezoneId: tz });
    await cdp.send('Emulation.setLocaleOverride', { locale: 'fr-FR' });
  } catch { /* fuseau et langue par défaut */ }
  await page.addInitScript(() => { try { localStorage.setItem('bonzini-reception-location', 'office'); localStorage.setItem('bonzini-reception-view', 'deposits'); } catch { /* privé */ } });
  // Les photos : createSignedUrl(s) répond une URL locale, servie depuis PHOTOS_DIR.
  await page.route(/\/storage\/v1\/object\/sign\/parcel-photos/, (route) => {
    const req = route.request();
    const url = req.url();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: cors, body: '' });
    if (req.method() === 'POST') {
      const tail = url.split('/object/sign/parcel-photos')[1].split('?')[0];
      if (!tail || tail === '/') {
        const paths = req.postDataJSON()?.paths ?? [];
        return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(paths.map((path) => ({ path, signedURL: `/object/sign/parcel-photos/${path}?token=demo`, error: null }))) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ signedURL: `/object/sign/parcel-photos${tail}?token=demo` }) });
    }
    const m = /carton-(\d)\.jpg/.exec(url);
    const file = m ? join(PHOTOS_DIR, `carton-${m[1]}.jpg`) : null;
    if (file && existsSync(file)) return route.fulfill({ status: 200, contentType: 'image/jpeg', headers: cors, body: readFileSync(file) });
    return route.fulfill({ status: 404, headers: cors, body: '' });
  });
  if (existsSync(join(FONTS_DIR, 'fonts.css'))) {
    const css = readFileSync(join(FONTS_DIR, 'fonts.css'), 'utf8');
    const fontFile = (url) => join(FONTS_DIR, `${createHash('md5').update(url).digest('hex').slice(0, 16)}.woff2`);
    await page.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', headers: { 'access-control-allow-origin': '*' }, body: css }));
    await page.route(/fonts\.gstatic\.com/, (r) => { const f = fontFile(r.request().url()); return existsSync(f) ? r.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' }, body: readFileSync(f) }) : r.fulfill({ status: 404, body: '' }); });
  } else if (existsSync(CJK_FONT)) {
    // Les caractères chinois des étiquettes (canvas) : la police CJK du système, servie comme « Noto Sans SC ».
    await page.route(/\/__gzfont\/cjk/, (route) => route.fulfill({ status: 200, contentType: 'font/collection', headers: { 'access-control-allow-origin': '*' }, body: readFileSync(CJK_FONT) }));
    await page.addInitScript(() => {
      const css = ['400', '700', '900'].map((w) => `@font-face{font-family:"Noto Sans SC";font-weight:${w};src:url(/__gzfont/cjk.ttc)}`).join('');
      const add = () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); };
      if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
    });
  }
}

const deskSetup = (page) => setup(page, { tz: 'Asia/Shanghai' });

/** Les polices (DM Sans, Noto Sans SC) sont chargées avant la capture. */
async function fontsReady(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
}

/** Dans le dialogue du dépôt (qui défile), amener une section en haut. */
async function scrollDialogTo(page, text) {
  const el = page.getByRole('dialog').getByText(text).first();
  await el.evaluate((n) => (n.closest('.px-5') ?? n).scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(400);
}

/** Saisir un code dans la boîte de scan, comme la douchette (Entrée). */
async function scan(page, code) {
  const box = page.locator('input[aria-label^="Scannez"]').first();
  await box.click();
  await box.fill(code);
  await box.press('Enter');
  await page.waitForTimeout(900);
}

async function openSeal(page) {
  await page.getByRole('button', { name: /^Fermer le paquet$/ }).click();
  await page.waitForTimeout(600);
  await page.fill('#pk-gross', '28,1');
  const dims = page.locator('input[aria-label="Longueur"], input[aria-label="Largeur"], input[aria-label="Hauteur"]');
  await dims.nth(0).fill('70');
  await dims.nth(1).fill('50');
  await dims.nth(2).fill('45');
  await page.locator('#pk-gross').blur();
  await page.waitForTimeout(400);
}

export const SCREENS = [
  // 14. Au bureau, la fiche du client : « Origine » et « Enregistré par », son sexe et sa date de naissance.
  { key: 'j.guangzhou.client-sheet', name: '14-fiche-client-enregistre-par', role: 'super_admin', desktop: true, viewport: '1440x1080', init: deskSetup, wait: 2500, before: fontsReady },
  // 15. « Modifier » : le sexe et la date de naissance se changent avec le reste du profil.
  { key: 'j.guangzhou.client-sheet', name: '15-fiche-client-modifier-identite', role: 'super_admin', desktop: true, viewport: '1440x1100', init: deskSetup, wait: 2500,
    before: async (page) => {
      await fontsReady(page);
      await page.getByRole('button', { name: /^Modifier$/ }).first().click();
      await page.waitForTimeout(700);
    } },
  // 16. La même fiche sur le téléphone de l'équipe : « Sexe : Femme. », « Date de naissance : … ».
  { key: 'j.guangzhou.client-mobile', name: '16-fiche-client-telephone', role: 'super_admin', init: setup, wait: 2000, viewport: '390x900', fullPage: false, before: fontsReady },
  // 17. « Modifier ses informations » au téléphone : le sexe et la date de naissance, sous le nom.
  { key: 'j.guangzhou.client-mobile', name: '17-fiche-client-telephone-modifier', role: 'super_admin', init: setup, wait: 2000, viewport: '390x1300', fullPage: false,
    before: async (page) => {
      await fontsReady(page);
      await page.getByRole('button', { name: /Modifier ses informations/ }).click();
      await page.waitForTimeout(700);
    } },
  // 12. Le propriétaire d'un colis n'existe pas encore : Kevin crée le client — l'origine ne se choisit pas,
  //     le sexe est facultatif (il ne voit souvent que l'étiquette), la date de naissance donne l'âge.
  { key: 'j.guangzhou.new-client', name: '12-nouveau-client-origine-auto', role: 'receptionist', init: setup, wait: 1500, viewport: '390x2040',
    before: async (page) => {
      await fontsReady(page);
      await page.locator('#cc-first').fill('Joseph');
      await page.locator('#cc-last').fill('Etame');
      await page.locator('#cc-birth').pressSequentially('14071983', { delay: 30 });
      await page.locator('input[type=tel]').first().fill('677998877');
      await page.waitForTimeout(900);
    } },
  // 12b. Le numéro est l'autre numéro d'un prospect de Rodrigue : sa fiche remplit les champs encore vides.
  { key: 'j.guangzhou.new-client', name: '12b-nouveau-client-repris-du-prospect', role: 'receptionist', init: setup, wait: 1500, viewport: '390x2520',
    before: async (page) => {
      await fontsReady(page);
      await page.locator('#cc-first').fill('Béa');
      await page.locator('input[type=tel]').first().fill('655443322');
      await page.waitForTimeout(1200);
    } },
  // 13. Créé : mot de passe à envoyer, et l'origine posée d'office (bureau de Guangzhou).
  { key: 'j.guangzhou.new-client', name: '13-nouveau-client-cree', role: 'receptionist', init: setup, wait: 1500,
    before: async (page) => {
      await fontsReady(page);
      await page.locator('#cc-first').fill('Joseph');
      await page.locator('#cc-last').fill('Etame');
      await page.locator('input[type=tel]').first().fill('677998877');
      await page.waitForTimeout(700);
      await page.getByRole('button', { name: /Créer|Create|创建/ }).last().click();
      await page.waitForTimeout(1500);
    } },
  // 1. L'accueil de Kevin, au bureau : « Nouveau dépôt », puis la carte « Paquets avion ».
  { key: 'j.guangzhou.home', name: '01-accueil-reception', role: 'receptionist', init: setup, wait: 1500, viewport: '390x1370', fullPage: false, before: fontsReady },
  // 2. Le dépôt d'Aïcha en cours : 3 colis pesés, mesurés, photographiés.
  { key: 'j.guangzhou.deposit', name: '02-depot-en-cours', role: 'receptionist', init: setup, wait: 1800, viewport: '390x1090', before: fontsReady },
  // 3. Le dépôt terminé : le reçu…
  { key: 'j.guangzhou.done', name: '03-depot-termine', role: 'receptionist', init: setup, wait: 1500 },
  // …et les étiquettes des colis (une par carton).
  { key: 'j.guangzhou.done', name: '04-etiquettes-colis', role: 'receptionist', init: setup, wait: 1500, fullPage: false, viewport: '390x1010',
    before: async (page) => { await page.getByRole('button', { name: /Imprimer les étiquettes/ }).click(); await page.waitForTimeout(3000); } },
  // 4. Les paquets avion du bureau.
  { key: 'j.guangzhou.packages', name: '05-paquets-avion', role: 'receptionist', init: setup, wait: 1500, viewport: '390x1370', fullPage: false, before: fontsReady },
  // 5. Le paquet PQ-000045 en cours : 27,4 kg sur 32, colis de trois clients.
  { key: 'j.guangzhou.package', name: '06-paquet-en-cours', role: 'receptionist', init: setup, wait: 1500, viewport: '390x1240' },
  // 6. Un colis de trop : refusé, avec la proposition de fermer et d'en commencer un autre.
  { key: 'j.guangzhou.package', name: '07-paquet-colis-refuse', role: 'receptionist', init: setup, wait: 1500,
    before: async (page) => { await scan(page, 'RC-000123-01'); } },
  // 7. Fermer le paquet : la pesée et les dimensions.
  { key: 'j.guangzhou.package', name: '08-fermer-le-paquet', role: 'receptionist', init: setup, wait: 1500, fullPage: false,
    before: openSeal },
  // 8. Le paquet fermé et son étiquette (l'image de l'étiquette est aussi enregistrée à part).
  { key: 'j.guangzhou.package', name: '09-etiquette-paquet', role: 'receptionist', init: setup, wait: 1500, fullPage: false, viewport: '390x1100',
    before: async (page) => {
      await openSeal(page);
      await page.getByRole('button', { name: /Fermer et imprimer l.étiquette/ }).click();
      await page.waitForFunction(() => !!document.querySelector('[role=dialog] img[alt^="PQ-"]'), null, { timeout: 15000 });
      await page.waitForTimeout(800);
      try {
        const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.getByRole('button', { name: /Télécharger l.image/ }).click()]);
        await dl.saveAs(join(OUT, '09b-etiquette-paquet-PQ-000045.png'));
        console.log(`  · étiquette enregistrée : ${join(OUT, '09b-etiquette-paquet-PQ-000045.png')} (${dl.suggestedFilename()})`);
      } catch (e) { console.log('  · étiquette non enregistrée :', e.message); }
      await page.waitForTimeout(800);
    } },
  // 9. Au bureau : le devis de fret du dépôt RC-000123 (au kilo, avion), envoyé, payé en partie…
  { key: 'j.guangzhou.quote', name: '10-devis-fret', role: 'ops', desktop: true, viewport: '1440x1200', init: deskSetup, wait: 2500, before: fontsReady },
  // …et l'encaissement du reste (Mobile Money reçu à Douala), qui fera le reçu.
  { key: 'j.guangzhou.quote', name: '11-devis-encaissement', role: 'ops', desktop: true, init: deskSetup, wait: 2500,
    before: async (page) => {
      await fontsReady(page);
      await page.getByRole('button', { name: /^Encaisser$/ }).first().click();
      await page.waitForTimeout(500);
      await page.selectOption('select[aria-label="Mode"]', 'mobile_money');
      await page.selectOption('select[aria-label="Lieu"]', 'douala');
      await page.fill('input[aria-label="Référence"]', 'OM251005.0954.P2X7');
      await scrollDialogTo(page, /^Paiement/);
      await page.waitForTimeout(400);
    } },
];
