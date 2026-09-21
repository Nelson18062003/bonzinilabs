// Captures de la sous-app Réception (/r) — iPhone 390×844, fixtures des RPC
// reception_* servies par interception réseau (rien de réel n'est contacté).
//   VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=x VITE_SUPABASE_PROJECT_ID=x npx vite --host --port 8080
//   node tools/shoot-reception.mjs [out-dir] [screen…]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { respond as adminRespond } from './adminFixtures.mjs';

const OUT = process.argv[2] ?? 'tools/out/reception';
const ONLY = process.argv.slice(3);
mkdirSync(OUT, { recursive: true });

const client = { user_id: 'u1', customer_code: 'BZ-482913', first_name: 'Aïcha', last_name: 'Mbarga', phone: '+237 677 12 34 56', email: 'aicha@mbarga-import.cm', company_name: 'Mbarga Import SARL', city: 'Douala', country: 'Cameroun' };
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
const dep2 = {
  ...dep1, id: 'dep2', deposit_no: 'RC-000122', status: 'closed', closed_at: today(14, 32), opened_at: today(14, 1),
  parcel_count: 10, total_weight_kg: 84, total_cbm: 0.62,
  parcels: Array.from({ length: 10 }, (_, i) => parcel(i + 1, 'RC-000122', { description: ['Chaussures, 40 paires', 'Tissus wax', 'Sacs à main, 30 pièces'][i % 3], weight_kg: 8.4 })),
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

const clientsByCode = { [client.customer_code]: client, [client2.customer_code]: client2, [client3.customer_code]: client3 };
const RPC = {
  reception_recent_clients: { success: true, clients: [client, client2, client3] },
  reception_client: (b) => { const c = [client, client2, client3].find((x) => x.user_id === b.p_user_id); return c ? { success: true, client: c } : { success: false, error: 'Client introuvable' }; },
  reception_update_parcel: { success: true, deposit: dep1 },
  reception_client_by_code: (b) => { const code = /BZ-?(\d{6})/i.exec(b.p_code ?? '')?.[1]; const c = code ? clientsByCode['BZ-' + code] : null; return c ? { success: true, client: c } : { success: false, error: 'unknown_code', code: b.p_code }; },
  cargo_parts_summary: { success: true, containers: 1, containers_at_sea: 0, parcels_waiting: 31, deposits_pending: 2, deposits_today: 3 },
  reception_overview: { success: true, by_receptionist: [
    { received_by: 'demo', name: 'Kevin Nkolo', deposits: 26, parcels: 158, weight_kg: 1210, cbm: 9.1, pending: 2, incomplete: 3 },
    { received_by: 'mei', name: 'Mei Lin', deposits: 12, parcels: 53, weight_kg: 430, cbm: 3.3, pending: 0, incomplete: 0 },
  ], deposits: [pend1, dep2, dep3, dep4, pend2] },
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
  const { readFileSync } = await import('node:fs');
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

const SCREENS = ['rc-location', 'rc-home', 'rc-identify', 'rc-how', 'rc-client', 'rc-deposit', 'rc-deposit-empty', 'rc-parcel', 'rc-parcel-edit', 'rc-done', 'rc-pending', 'rc-clients', 'rc-client-card'];
for (const screen of ONLY.length ? ONLY : SCREENS) {
  const page = await ctx.newPage();
  const key = screen === 'rc-location' ? 'rc-home' : screen === 'rc-client-card-label' ? 'rc-client-card' : screen;
  if (screen === 'rc-location') await page.addInitScript(() => { try { localStorage.removeItem('bonzini-reception-location'); } catch { /* privé */ } });
  if (screen === 'rc-identify') await page.addInitScript(() => { try { sessionStorage.setItem('bonzini-reception-draft', 'SF2884193055221'); } catch { /* privé */ } });
  await page.goto(`http://localhost:8080/screenshot.html?screen=${key}&theme=light`, { waitUntil: 'networkidle' });
  if (screen === 'rc-identify') { await page.fill('input[inputmode="search"]', 'Mbarga'); await page.waitForTimeout(600); }
  if (screen === 'rc-parcel') {
    await page.fill('#p-weight', '8,4');
    const dims = page.locator('input[inputmode="decimal"]');
    await dims.nth(1).fill('60'); await dims.nth(2).fill('40'); await dims.nth(3).fill('40');
    await page.fill('#p-desc', 'Chaussures, 40 paires');
  }
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
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, `${screen}.png`), fullPage: !DESKTOP || screen.includes('reception') || screen.includes('chargement') });
  console.log(screen, 'ok');
  await page.close();
}
await browser.close();
