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
// RC-000124 : un dépôt que Li Wei (un collègue) est en train de saisir — Kevin le voit en lecture.
const depLi = deposit({
  id: 'depLi', deposit_no: 'RC-000124', client: samuel, status: 'open', received_by: 'li', received_by_name: 'Li Wei', opened_at: gz(16, 2), ...noSupplier,
  parcels: [parcel('RC-000124', 1, 'carton', 'Pièces auto (amortisseurs)', 11.2, [60, 40, 30])],
});
// Le même dépôt terminé, devis déjà envoyé au client : le réceptionnaire ne corrige plus (l'équipe cargo, si).
const depQ = { ...dep3, id: 'depQ', quote_engaged: 'Le devis DV-000031 a déjà été envoyé au client' };
const DEPOSITS = { dep1, dep1c, dep2, dep3, dep4, pend1, depLi, depQ };
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
// Ouvert par Grace depuis l'ordinateur (« ouvert par Grace Ebogo ») ; c'est Kevin qui le remplit au bureau.
const pk45 = pkg({
  id: 'pk45', package_no: 'PQ-000045', created_at: gz(15, 2), updated_at: gz(16, 18), created_by: 'grace', created_by_name: 'Grace Ebogo',
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
// État du parcours (remis à zéro à chaque écran) : le paquet PQ-000045 se ferme pendant l'écran 8 ;
// sur l'ordinateur (écrans 18 et suivants), Grace crée des paquets (PQ-000046, 47…) et les remplit,
// puis met des paquets fermés sur un vol (existant ou ouvert pour l'occasion).
const state = { sealed: false, made: [], flights: [], assigned: {} };
const ALL_PARCELS = () => [...dep1c.parcels.map((p) => [p, dep1c]), ...[dep2, dep3, dep4].flatMap((d) => d.parcels.map((p) => [p, d]))];
/** Un paquet créé pendant l'écran : PQ-000046, 47… avec ses colis. */
const made = (m) => pkg({ id: m.id, package_no: m.no, created_at: m.by ? gz(8, 50) : gz(16, 43), updated_at: gz(16, 43 + m.parcels.length),
  created_by: m.by ? 'grace' : 'demo', created_by_name: m.by ? 'Grace Ebogo' : 'Kevin Nkolo',
  net_weight_kg: Math.round(sum(m.parcels, (p) => p.weight_kg) * 100) / 100, parcel_count: m.parcels.length,
  client_count: new Set(m.parcels.map((p) => p.client?.user_id)).size, parcels: m.parcels });
const madeById = (id) => state.made.find((m) => m.id === id);
// La réception voit dans quel paquet est chaque colis (reception_deposit_json : air_package_id, package_no).
const packedIn = (p) => {
  if (pk45Parcels.some((x) => x.id === p.id)) return { air_package_id: 'pk45', package_no: 'PQ-000045' };
  const m = state.made.find((x) => x.parcels.some((y) => y.id === p.id));
  return m ? { air_package_id: m.id, package_no: m.no } : {};
};
// Un vol en préparation (mercredi) et ceux ouverts pendant l'écran ; les paquets montés à bord.
const plannedAir = { id: 'air1', awb_number: '07112345675', airline: 'Ethiopian Airlines', flight_no: 'ET 607', origin: 'Guangzhou (CAN)', destination: 'Douala (DLA)', status: 'PLANNED',
  etd: '2026-10-07', eta: '2026-10-08', departed_at: null, arrived_at: null, delivered_at: null, freight_usd: null, notes: null, created_at: gz(9, 0, 3), updated_at: gz(9, 0, 3),
  parcel_count: 8, total_weight_kg: 30.6, total_cbm: 0.2, client_count: 3, unpaid_count: 0, package_count: 1, parcels: [] };
const withAssigned = (k) => (state.assigned[k.id] ? { ...k, air_shipment_id: state.assigned[k.id], awb_number: '07112345675', air_status: 'PLANNED', flight_no: 'ET 607', etd: '2026-10-07' } : k);
const withPackages = (d) => ({ ...d, parcels: d.parcels.map((p) => ({ ...p, ...packedIn(p) })) });

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
  reception_get_deposit: (b) => ({ success: true, deposit: withPackages(DEPOSITS[b?.p_deposit_id] ?? dep1) }),
  reception_pending_deposits: { success: true, deposits: [pend1] },
  reception_recent_clients: { success: true, clients: [aicha, samuel, nadia] },
  reception_client: (b) => { const c = [aicha, samuel, nadia].find((x) => x.user_id === b?.p_user_id); return c ? { success: true, client: c } : { success: false, error: 'Client introuvable' }; },
  reception_client_suppliers: { success: true, suppliers: [{ kind: 'supplier', name: supplierShoes.supplier_name, contact: supplierShoes.supplier_contact, phone: supplierShoes.supplier_phone, email: supplierShoes.supplier_email, wechat: supplierShoes.supplier_wechat, address: supplierShoes.supplier_address, last_at: gz(11, 10) }] },
  reception_close_deposit: { success: true, deposit: dep1c },

  // Paquets avion
  air_package_list: () => ({ success: true, packages: [...state.made.map(made), state.sealed ? pk45Sealed : pk45, pk41, pk44, pk43, pk42].map(withAssigned).map(listRow) }),
  air_package_get: (b) => {
    const byId = { pk45: state.sealed ? pk45Sealed : pk45, pk44, pk43, pk42, pk41, ...Object.fromEntries(state.made.map((m) => [m.id, made(m)])) };
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
    const m = madeById(b?.p_package_id);
    if (m) {
      const hit = ALL_PARCELS().find(([x]) => x.parcel_no === no);
      if (!hit) return { success: false, error: `Colis ${no} introuvable` };
      const [p, d] = hit;
      if (m.parcels.some((x) => x.id === p.id)) return { success: true, already: true, parcel_no: no, package: made(m) };
      const other = packedIn(p);
      if (other.package_no) return { success: false, error: `Le colis ${no} est déjà dans le paquet ${other.package_no}` };
      const next = Math.round((made(m).net_weight_kg + p.weight_kg) * 10) / 10;
      if (next > 32) return { success: false, error: `Le paquet passerait à ${next.toFixed(1)} kg : 32 kg au plus. Commencez un autre paquet.`, over: true };
      m.parcels = [...m.parcels, pkParcel(p, d)];
      return { success: true, already: false, parcel_no: no, weight_kg: p.weight_kg, client: d.client, package: made(m) };
    }
    const p = [...dep1.parcels, ...dep2.parcels, ...dep3.parcels, ...dep4.parcels].find((x) => x.parcel_no === no);
    if (!p) return { success: false, error: `Colis ${no} introuvable` };
    if (pk45Parcels.some((x) => x.parcel_no === no)) return { success: true, already: true, parcel_no: no, package: pk45 };
    const next = Math.round((pk45.net_weight_kg + p.weight_kg) * 10) / 10;
    if (next > 32) return { success: false, error: `Le paquet passerait à ${next.toFixed(1)} kg : 32 kg au plus. Commencez un autre paquet.`, over: true };
    return { success: false, error: `Le colis ${no} est déjà dans le paquet PQ-000044` };
  },
  air_package_seal: (b) => { state.sealed = true; return { success: true, package: { ...pk45Sealed, gross_weight_kg: b?.p_gross_weight_kg ?? 28.1, length_cm: b?.p_length_cm ?? null, width_cm: b?.p_width_cm ?? null, height_cm: b?.p_height_cm ?? null } }; },
  air_package_create: () => {
    const n = 46 + state.made.length;
    const m = { id: `pk${n}`, no: `PQ-0000${n}`, parcels: [] };
    state.made.push(m);
    return { success: true, package: made(m) };
  },
  air_package_remove_parcel: (b) => {
    const m = state.made.find((x) => x.parcels.some((y) => y.id === b?.p_parcel_id));
    if (!m) return { success: false, error: 'Ce colis n\'est dans aucun paquet' };
    m.parcels = m.parcels.filter((x) => x.id !== b?.p_parcel_id);
    return { success: true, package: made(m) };
  },
  air_package_delete: (b) => { state.made = state.made.filter((x) => x.id !== b?.p_package_id); return { success: true }; },
  // Les vols : celui de mercredi, et ceux ouverts pendant l'écran.
  cargo_air_list: () => ({ success: true, shipments: [plannedAir, ...state.flights] }),
  cargo_air_create: (b) => {
    const a = { ...plannedAir, id: `airN${state.flights.length + 1}`, awb_number: b?.p_awb_number || 'PROV-7K2Q9D', airline: b?.p_airline || null, flight_no: b?.p_flight_no || null, etd: b?.p_etd ?? null, eta: b?.p_eta ?? null, parcel_count: 0, total_weight_kg: 0, client_count: 0, package_count: 0, created_at: gz(17, 5), updated_at: gz(17, 5) };
    state.flights.push(a);
    return { success: true, shipment: a };
  },
  air_package_assign: (b) => {
    const ids = b?.p_package_ids ?? [];
    for (const id of ids) state.assigned[id] = b.p_air_id;
    const all = [pk41, pk44, pk43, ...state.made.map(made)];
    return { success: true, assigned: ids.length, parcels: sum(all.filter((k) => ids.includes(k.id)), (k) => k.parcel_count), skipped: [] };
  },

  // Bureau : la console cargo et le devis
  cargo_parts_summary: { success: true, containers: 1, containers_at_sea: 1, air_open: 1, air_in_flight: 0, parcels_waiting: 19, deposits_pending: 1, deposits_today: 4 },
  // Ce qui attend un paquet (air_package_packable) : les dépôts du bureau qui ont encore un colis libre.
  air_package_packable: (b) => {
    const free = (p) => !packedIn(p).air_package_id;
    const rows = [dep1c, dep2, dep3, dep4, pend1].filter((d) => d.location === 'office' && d.parcels.some(free)).map(withPackages);
    // Les compteurs, comme la RPC : prêts (dépôt terminé, attribué, 0 < poids ≤ 32) ; à compléter (le reste, hors plus de 32 kg).
    const all = rows.flatMap((d) => d.parcels.filter(free).map((p) => ({ p, d })));
    const ready = all.filter(({ p, d }) => d.status !== 'open' && d.client && p.weight_kg > 0 && p.weight_kg <= 32).length;
    const toFix = all.filter(({ p, d }) => d.status === 'open' || !d.client || !(p.weight_kg > 0)).length;
    return { success: true, total: rows.length, truncated: false, deposits: b?.p_limit === 0 ? [] : rows, ready_count: ready, to_fix_count: toFix };
  },
  reception_board: (b) => {
    const list = b?.p_scope === 'cancelled' ? [] : [dep1c, dep2, dep3, dep4, pend1];
    const rows = list.filter((d) => !b?.p_location || d.location === b.p_location).map(withPackages).map(withQuote);
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
  state.made = [];
  state.flights = [];
  state.assigned = {};
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
/** Ce matin, Grace a ouvert depuis l'ordinateur un paquet vide, PQ-000046, pour que Kevin le remplisse au bureau. */
const withGracePackage = async (page) => {
  await setup(page);
  state.made.push({ id: 'pk46', no: 'PQ-000046', parcels: [], by: 'grace' });
};
/** Un téléphone neuf : aucun lieu mémorisé (la coquille demande « Où êtes-vous ? »). */
const noPlace = async (page) => {
  await setup(page);
  await page.addInitScript(() => { try { localStorage.removeItem('bonzini-reception-location'); } catch { /* privé */ } });
};
/** « Colis à emballer » : tous les colis d'Aïcha cochés d'un geste (sa case de client). */
async function pickAicha(page) {
  await fontsReady(page);
  await page.getByRole('checkbox', { name: /BZ-482913/ }).first().click();
  await page.waitForTimeout(400);
}

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

/** Sur l'ordinateur, la vue Colis (ou Dépôts) de Cargo › Réception, au bureau. */
const deskView = (view) => async (page) => {
  await deskSetup(page);
  await page.addInitScript((v) => { try { localStorage.setItem('bonzini-reception-view', v); } catch { /* privé */ } }, view);
};
const tick = (page, name) => page.getByRole('checkbox', { name }).first().click();

/** Sur l'ordinateur : la vue « Paquets avion » de Cargo › Réception. */
const deskPackages = async (page) => {
  await deskSetup(page);
  await page.addInitScript(() => { try { localStorage.setItem('bonzini-reception-view', 'packages'); } catch { /* privé */ } });
};
/** « Nouveau paquet » : PQ-000046 commence ; la liste filtrée sur Aïcha, deux de ses colis y entrent d'un clic. */
async function packAicha(page, n = 2) {
  await fontsReady(page);
  await page.getByRole('button', { name: /^Nouveau paquet$/ }).first().click();
  await page.waitForSelector('#pk-scan', { timeout: 10000 });
  await page.getByRole('dialog').getByLabel('Filtrer les colis prêts').fill('BZ-482913');
  await page.waitForTimeout(700);
  for (let i = 0; i < n; i += 1) {
    await page.getByRole('dialog').getByRole('button', { name: /^Ajouter$/ }).first().click();
    await page.waitForTimeout(800);
  }
}

export const SCREENS = [
  // 25. Réception › Colis, au bureau : quatre colis d'Aïcha cochés (39,9 kg), « Mettre en paquet » : deux paquets de 32 kg au plus.
  { key: 'j.guangzhou.desk-office', name: '25-ordinateur-colis-coches-mettre-en-paquet', role: 'ops', desktop: true, viewport: '1440x1000', init: deskView('parcels'), wait: 2500,
    before: async (page) => {
      await fontsReady(page);
      await page.getByRole('button', { name: /Bureau · Air/ }).click();
      await page.waitForTimeout(500);
      for (const no of ['RC-000122-01', 'RC-000122-02', 'RC-000122-05', 'RC-000123-01']) await tick(page, `Sélectionner ${no}`);
      await page.getByRole('button', { name: /Mettre en paquet/ }).first().click();
      await page.waitForTimeout(800);
    } },
  // 26. …c'est fait : deux paquets créés, à remplir physiquement, « Ouvrir » sur chacun.
  { key: 'j.guangzhou.desk-office', name: '26-ordinateur-mise-en-paquet-faite', role: 'ops', desktop: true, viewport: '1440x1000', init: deskView('parcels'), wait: 2500,
    before: async (page) => {
      await fontsReady(page);
      await page.getByRole('button', { name: /Bureau · Air/ }).click();
      await page.waitForTimeout(500);
      for (const no of ['RC-000122-01', 'RC-000122-02', 'RC-000122-05', 'RC-000123-01']) await tick(page, `Sélectionner ${no}`);
      await page.getByRole('button', { name: /Mettre en paquet/ }).first().click();
      await page.waitForTimeout(600);
      await page.getByRole('dialog').getByRole('button', { name: /Répartir en 2 paquets/ }).click();
      await page.getByText('Colis mis en paquet').first().waitFor({ timeout: 10000 });
      await page.waitForTimeout(600);
    } },
  // 27. Réception › Dépôts : deux dépôts cochés d'un coup — la même barre (mettre en paquet, étiquettes).
  { key: 'j.guangzhou.desk-office', name: '27-ordinateur-depots-coches', role: 'ops', desktop: true, viewport: '1440x900', init: deskView('deposits'), wait: 2500,
    before: async (page) => {
      await fontsReady(page);
      await tick(page, 'Sélectionner RC-000123');
      await tick(page, 'Sélectionner RC-000121');
      await page.waitForTimeout(500);
    } },
  // 28. Paquets avion : les paquets fermés (et le refusé) cochés, « Mettre sur un vol » : le vol de mercredi.
  { key: 'j.guangzhou.desk-packages', name: '28-ordinateur-paquets-sur-un-vol', role: 'ops', desktop: true, viewport: '1440x1050', init: deskPackages, wait: 2500,
    before: async (page) => {
      await fontsReady(page);
      await tick(page, 'Cocher : Fermés, prêts à partir');
      await tick(page, "Cocher : Refusés à l'aéroport");
      await page.getByRole('button', { name: /Mettre sur un vol/ }).first().click();
      await page.waitForTimeout(900);
    } },
  // 29. …ou une nouvelle expédition, ouverte dans la même fenêtre.
  { key: 'j.guangzhou.desk-packages', name: '29-ordinateur-paquets-nouvelle-expedition', role: 'ops', desktop: true, viewport: '1440x1150', init: deskPackages, wait: 2500,
    before: async (page) => {
      await fontsReady(page);
      await tick(page, 'Cocher : Fermés, prêts à partir');
      await page.getByRole('button', { name: /Mettre sur un vol/ }).first().click();
      await page.waitForTimeout(700);
      await page.getByRole('radio', { name: /Nouvelle expédition/ }).click();
      await page.waitForTimeout(300);
      await page.getByRole('dialog').getByPlaceholder('071-12345675').fill('071-23456782');
      await page.getByRole('dialog').getByPlaceholder('Ethiopian, Turkish…').fill('Ethiopian Airlines');
      await page.getByRole('dialog').getByPlaceholder('ET 607').fill('ET 609');
      await page.waitForTimeout(400);
    } },
  // 18. Sur l'ordinateur du bureau : Cargo › Réception › Paquets avion — les paquets et les colis à emballer.
  { key: 'j.guangzhou.desk-packages', name: '18-ordinateur-paquets-avion', role: 'ops', desktop: true, viewport: '1440x1180', init: deskPackages, wait: 2500, before: fontsReady },
  // 19. La fiche de PQ-000045 : 27,4 kg sur 32, trois clients en couleur ; les colis prêts ne tiennent plus.
  { key: 'j.guangzhou.desk-package', name: '19-ordinateur-paquet-presque-plein', role: 'ops', desktop: true, viewport: '1440x1000', init: deskSetup, wait: 2500,
    before: async (page) => {
      await fontsReady(page);
      await page.getByRole('dialog').getByRole('button', { name: /Trop lourd/ }).first().locator('xpath=..').hover();
      await page.waitForTimeout(500);
    } },
  // 20. « Emballer » Aïcha : PQ-000046 commence, deux colis entrent d'un clic, le troisième se dessine au survol.
  { key: 'j.guangzhou.desk-packages', name: '20-ordinateur-nouveau-paquet-rempli', role: 'ops', desktop: true, viewport: '1440x1000', init: deskPackages, wait: 2500,
    before: async (page) => {
      await packAicha(page, 2);
      await page.getByRole('dialog').getByRole('button', { name: /^Ajouter$/ }).first().locator('xpath=..').hover();
      await page.waitForTimeout(500);
    } },
  // 21. La douchette sur un colis de trop : refusé, avec la raison, et « Fermer ce paquet ».
  { key: 'j.guangzhou.desk-packages', name: '21-ordinateur-colis-de-trop', role: 'ops', desktop: true, viewport: '1440x1000', init: deskPackages, wait: 2500,
    before: async (page) => {
      await packAicha(page, 2);
      await page.fill('#pk-scan', 'RC-000123-02');
      await page.press('#pk-scan', 'Enter');
      await page.waitForTimeout(900);
    } },
  // 22. Fermer le paquet : la pesée et les dimensions.
  { key: 'j.guangzhou.desk-package', name: '22-ordinateur-fermer-le-paquet', role: 'ops', desktop: true, viewport: '1440x1000', init: deskSetup, wait: 2500,
    before: async (page) => {
      await fontsReady(page);
      await page.getByRole('button', { name: /Fermer le paquet \(pesée\)/ }).click();
      await page.waitForTimeout(500);
      await page.fill('#pk-gross', '28,1');
      const dims = page.locator('input[aria-label$="(cm)"]');
      await dims.nth(0).fill('70'); await dims.nth(1).fill('50'); await dims.nth(2).fill('45');
      await page.waitForTimeout(400);
    } },
  // 23. Fermé : l'étiquette 100 × 150 mm tout de suite à côté, et « Commencer un nouveau paquet ».
  { key: 'j.guangzhou.desk-package', name: '23-ordinateur-paquet-ferme-etiquette', role: 'ops', desktop: true, viewport: '1440x1000', init: deskSetup, wait: 2500,
    before: async (page) => {
      await fontsReady(page);
      await page.getByRole('button', { name: /Fermer le paquet \(pesée\)/ }).click();
      await page.waitForTimeout(500);
      await page.fill('#pk-gross', '28,1');
      await page.getByRole('button', { name: /Fermer et préparer l.étiquette/ }).click();
      await page.waitForFunction(() => !!document.querySelector('[role=dialog] img[alt^="Étiquette PQ-"]'), null, { timeout: 15000 });
      await page.waitForTimeout(600);
    } },
  // 24. Dépôts, « Bureau · Air » : le chemin vers la mise en paquets, et le paquet de chaque colis emballé.
  { key: 'j.guangzhou.desk-office', name: '24-ordinateur-bureau-air', role: 'ops', desktop: true, viewport: '1440x1100', init: deskSetup, wait: 2500,
    before: async (page) => {
      await fontsReady(page);
      await page.getByRole('button', { name: /Bureau · Air/ }).click();
      await page.waitForTimeout(600);
      await page.getByRole('button', { name: 'Déplier les colis' }).nth(1).click();
      await page.waitForTimeout(600);
    } },
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
  { key: 'j.guangzhou.done', name: '03-depot-termine', role: 'receptionist', init: setup, wait: 1500, viewport: '390x1500', fullPage: false },
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
  // 5b. Colis à emballer : par client ; la case d'Aïcha coche ses 7 colis (66,9 kg).
  { key: 'j.guangzhou.pack-todo', name: '05b-colis-a-emballer', role: 'receptionist', init: withGracePackage, wait: 1500, viewport: '390x1900', before: pickAicha },
  // 5c. « Mettre en paquet » : PQ-000046, ouvert par Grace sur l'ordinateur, est proposé d'office ;
  //     le reste se répartit en paquets de 32 kg — trois paquets en tout.
  { key: 'j.guangzhou.pack-todo', name: '05c-colis-a-emballer-repartir', role: 'receptionist', init: withGracePackage, wait: 1500, viewport: '390x1500', fullPage: false,
    before: async (page) => {
      await pickAicha(page);
      await page.getByRole('button', { name: /^Mettre en paquet$/ }).click();
      await page.waitForTimeout(900);
    } },
  { key: 'j.guangzhou.pack-todo', name: '05d-colis-a-emballer-fait', role: 'receptionist', init: withGracePackage, wait: 1500, viewport: '390x1100', fullPage: false,
    before: async (page) => {
      await pickAicha(page);
      await page.getByRole('button', { name: /^Mettre en paquet$/ }).click();
      await page.waitForTimeout(800);
      await page.getByRole('dialog').getByRole('button', { name: /Répartir en 3 paquets/ }).click();
      await page.waitForTimeout(2500);
    } },
  // 5e. La même répartition, en chinois (le réceptionnaire peut travailler dans sa langue).
  { key: 'j.guangzhou.pack-todo', name: '05e-colis-a-emballer-repartir-zh', role: 'receptionist', lang: 'zh', init: withGracePackage, wait: 1500, viewport: '390x1500', fullPage: false,
    before: async (page) => {
      await fontsReady(page);
      await page.getByRole('checkbox', { name: /BZ-482913/ }).first().click();
      await page.waitForTimeout(400);
      await page.getByRole('button', { name: /^装包$/ }).click();
      await page.waitForTimeout(900);
    } },
  // 6b. PQ-000046, ouvert par Grace : les colis prêts qui y tiennent, « Ajouter » sans scanner.
  { key: 'j.guangzhou.package-grace', name: '06b-paquet-de-grace-colis-prets', role: 'receptionist', init: withGracePackage, wait: 1500, viewport: '390x1500', before: fontsReady },
  // 6c. Deux touches « Ajouter » : 20,5 kg, les colis d'Aïcha d'abord.
  { key: 'j.guangzhou.package-grace', name: '06c-paquet-de-grace-rempli', role: 'receptionist', init: withGracePackage, wait: 1500, viewport: '390x1700',
    before: async (page) => {
      await fontsReady(page);
      for (let i = 0; i < 2; i += 1) {
        await page.getByRole('button', { name: /^Ajouter RC-/ }).first().click();
        await page.waitForTimeout(1200);
      }
    } },
  // 15a. Téléphone neuf : le lieu se choisit avant tout (plus de « Continuer » grisé plus loin).
  { key: 'j.guangzhou.home', name: '15a-ou-etes-vous', role: 'receptionist', init: noPlace, wait: 1200, viewport: '390x844', fullPage: false, before: fontsReady },
  // 15b. Un dépôt terminé s'ouvre sur SA fiche : ses colis, leurs photos, les étiquettes sur place.
  { key: 'j.guangzhou.deposit-closed', name: '15b-depot-termine-sa-fiche', role: 'receptionist', init: setup, wait: 1500, viewport: '390x1000', before: fontsReady },
  // 15c. Le dépôt en cours d'un collègue : en lecture, avec qui le saisit.
  { key: 'j.guangzhou.deposit-other', name: '15c-depot-dun-collegue', role: 'receptionist', init: setup, wait: 1500, viewport: '390x900', before: fontsReady },
  // 15d. Retirer un colis demande confirmation.
  { key: 'j.guangzhou.deposit-quote', name: '15e-depot-devis-chez-le-client', role: 'receptionist', init: setup, wait: 1500, viewport: '390x1000', before: fontsReady },
  { key: 'j.guangzhou.deposit', name: '15d-retirer-un-colis-confirmation', role: 'receptionist', init: setup, wait: 1500, viewport: '390x900', fullPage: false,
    before: async (page) => { await fontsReady(page); await page.getByRole('button', { name: 'Retirer' }).first().click(); await page.waitForTimeout(700); } },
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
