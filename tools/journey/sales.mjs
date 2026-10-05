// ============================================================
// Parcours complet (05/10/2026) — domaine « sales » : l'espace du commercial
// Rodrigue Tchami sur son téléphone (« /v »), puis, au bureau, la création
// du compte de son prospect Paul Etoga, attribué d'office à Rodrigue.
//   node tools/shoot-journey.mjs sales [écran…]
//
// Formes des réponses : supabase/migrations/20261005160000_teams_commercials.sql
// (commercial_dashboard → _commercial_card, commercial_clients,
// prospect_lookup_phone, table prospects) et src/hooks/useSales.ts.
// Aujourd'hui : lundi 5 octobre 2026 (l'horloge de la machine), mois « 2026-10-01 ».
// ============================================================

// Un téléphone en français : le champ date natif suit la langue du navigateur
// (« 08/10/2026 », pas « 10/08/2026 »). Ce module est importé AVANT le
// lancement de Chromium, qui hérite de cet environnement.
process.env.LANG = 'fr_FR.UTF-8';
process.env.LANGUAGE = 'fr_FR:fr';

const MONTH = '2026-10-01';
const RODRIGUE_SRC = 'src-rodrigue';

// ── Les fiches d'origine (client_sources) ──
const src = (id, kind, label, phone, o = {}) => ({
  id, kind, label, phone, notes: null, is_active: true, is_system: false, staff_user_id: null,
  created_by: 'staff-nelson', created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-01T08:00:00Z', ...o,
});
const SOURCES = [
  src('src-rodrigue', 'commercial', 'Rodrigue Tchami', '+237690112233', { staff_user_id: 'staff-rodrigue' }),
  src('src-carine', 'commercial', 'Carine Ewane', '+237677456789', { staff_user_id: 'staff-carine' }),
  src('src-bao', 'referral', 'Bouche-à-oreille', null),
  src('src-facebook', 'social', 'Facebook', null),
  src('src-unknown', 'unknown', 'Je ne sais pas', null, { is_system: true }),
];

// ── Les prospects de Rodrigue (table prospects) ──
const prospect = (o) => ({
  source_id: RODRIGUE_SRC, last_name: null, company: null, city: null, interests: [], notes: null,
  lost_reason: null, next_action_at: null, converted_user_id: null, converted_at: null,
  ...o,
  status_changed_at: o.status_changed_at ?? o.created_at,
  updated_at: o.updated_at ?? o.status_changed_at ?? o.created_at,
});
const PROSPECTS = [
  prospect({ id: 'p-paul', first_name: 'Paul', last_name: 'Etoga', company: 'Etoga Quincaillerie', phone: '699 12 34 56', phone_e164: '+237699123456', city: 'Douala',
    interests: ['payments', 'sea'], notes: 'Quincaillerie à Akwa. Fait venir de l’outillage de Yiwu, un conteneur partagé tous les deux mois.',
    status: 'new', next_action_at: '2026-10-05T08:00:00Z', created_at: '2026-10-03T10:12:00Z' }),
  prospect({ id: 'p-rostand', first_name: 'Rostand', last_name: 'Kamdem', company: 'Kamdem Électronique', phone: '+237 670 98 76 54', phone_e164: '+237670987654', city: 'Bafoussam',
    interests: ['payments'], notes: 'Téléphones et accessoires, Shenzhen. Paie ses fournisseurs par Western Union.',
    status: 'contacted', next_action_at: '2026-10-04T08:00:00Z', created_at: '2026-09-28T09:00:00Z', status_changed_at: '2026-09-30T14:10:00Z' }),
  prospect({ id: 'p-mireille', first_name: 'Mireille', last_name: 'Abena', company: 'Abena Beauté', phone: '+237 655 43 21 09', phone_e164: '+237655432109', city: 'Yaoundé',
    interests: ['payments', 'air'],
    notes: 'Cosmétiques et perruques de Guangzhou, deux commandes par mois. Nos taux l’intéressent : veut tester avec un premier règlement de 3 M XAF.',
    status: 'interested', next_action_at: '2026-10-07T08:00:00Z', created_at: '2026-09-22T11:30:00Z', status_changed_at: '2026-10-01T15:20:00Z' }),
  prospect({ id: 'p-arnaud', first_name: 'Arnaud', last_name: 'Fouda', company: 'Fouda Pièces Auto', phone: '+237 678 23 45 61', phone_e164: '+237678234561', city: 'Douala',
    interests: ['payments', 'sea'], status: 'contacted', next_action_at: '2026-10-09T08:00:00Z', created_at: '2026-10-01T09:30:00Z', status_changed_at: '2026-10-02T10:00:00Z' }),
  prospect({ id: 'p-clarisse', first_name: 'Clarisse', last_name: 'Atangana', company: 'CA Mode', phone: '+237 691 34 12 78', phone_e164: '+237691341278', city: 'Yaoundé',
    interests: ['payments', 'air'], status: 'interested', next_action_at: '2026-10-12T08:00:00Z', created_at: '2026-09-15T13:00:00Z', status_changed_at: '2026-09-29T16:45:00Z' }),
  prospect({ id: 'p-sylvie', first_name: 'Sylvie', last_name: 'Manga', phone: '694 55 66 77', phone_e164: '+237694556677', city: 'Douala',
    interests: ['air'], status: 'new', created_at: '2026-10-04T16:40:00Z' }),
  prospect({ id: 'p-ibrahim', first_name: 'Ibrahim', last_name: 'Bello', company: 'Bello & Frères', phone: '+237 699 40 51 62', phone_e164: '+237699405162', city: 'Garoua',
    interests: ['air'], status: 'won', converted_user_id: 'cl-bello', converted_at: '2026-10-02T11:20:00Z', created_at: '2026-09-10T08:30:00Z', status_changed_at: '2026-10-02T11:20:00Z' }),
  prospect({ id: 'p-aicha', first_name: 'Aïcha', last_name: 'Mbarga', company: 'Mbarga Import SARL', phone: '+237 677 12 34 56', phone_e164: '+237677123456', city: 'Douala',
    interests: ['payments', 'air', 'sea'], status: 'won', converted_user_id: 'cl-aicha', converted_at: '2026-08-14T10:05:00Z', created_at: '2026-07-30T09:00:00Z', status_changed_at: '2026-08-14T10:05:00Z' }),
  prospect({ id: 'p-joseph', first_name: 'Joseph', last_name: 'Ndjock', phone: '+237 677 80 90 12', phone_e164: '+237677809012', city: 'Edéa',
    interests: ['sea'], status: 'lost', lost_reason: 'A déjà un transitaire à Yiwu', created_at: '2026-09-05T10:00:00Z', status_changed_at: '2026-09-26T17:05:00Z' }),
  prospect({ id: 'p-pauline', first_name: 'Pauline', last_name: 'Ewodo', company: 'Ewodo Déco', phone: '+237 696 71 82 93', phone_e164: '+237696718293', city: 'Kribi',
    interests: ['sea'], status: 'lost', lost_reason: 'Trouve le délai du bateau trop long', created_at: '2026-08-28T10:00:00Z', status_changed_at: '2026-09-18T12:00:00Z' }),
].sort((a, b) => b.status_changed_at.localeCompare(a.status_changed_at));

// ── Ses clients et leurs chiffres d'octobre (commercial_clients) ──
const CLIENT_ROWS = [
  { user_id: 'cl-aicha', name: 'Aïcha Mbarga', company: 'Mbarga Import SARL', customer_code: 'BZ-482913', phone: '+237 677 12 34 56', created_at: '2026-08-14T10:05:00Z', source_set_at: '2026-08-14T10:05:00Z',
    payments_xaf: 12450000, payments_count: 3, air_parcels: 4, air_kg: 33.6, sea_parcels: 10, sea_cbm: 0.62 },
  { user_id: 'cl-mvondo', name: 'Jean-Claude Mvondo', company: 'Mvondo Négoce', customer_code: 'BZ-366108', phone: '+237 699 27 81 44', created_at: '2026-06-03T09:40:00Z', source_set_at: '2026-06-03T09:40:00Z',
    payments_xaf: 4800000, payments_count: 2, air_parcels: 1, air_kg: 12, sea_parcels: 0, sea_cbm: 0 },
  { user_id: 'cl-ngono', name: 'Esther Ngono', company: 'Ets Ngono & Fils', customer_code: 'BZ-418532', phone: '+237 675 61 72 83', created_at: '2026-07-19T14:15:00Z', source_set_at: '2026-07-19T14:15:00Z',
    payments_xaf: 1250000, payments_count: 1, air_parcels: 0, air_kg: 0, sea_parcels: 3, sea_cbm: 0.45 },
  { user_id: 'cl-bello', name: 'Ibrahim Bello', company: 'Bello & Frères', customer_code: 'BZ-529907', phone: '+237 699 40 51 62', created_at: '2026-10-02T11:20:00Z', source_set_at: '2026-10-02T11:20:00Z',
    payments_xaf: 0, payments_count: 0, air_parcels: 2, air_kg: 18.5, sea_parcels: 0, sea_cbm: 0 },
  { user_id: 'cl-eyenga', name: 'Brigitte Eyenga', company: null, customer_code: 'BZ-301245', phone: '+237 696 14 25 36', created_at: '2026-05-11T10:00:00Z', source_set_at: '2026-05-11T10:00:00Z',
    payments_xaf: 0, payments_count: 0, air_parcels: 0, air_kg: 0, sea_parcels: 0, sea_cbm: 0 },
];

const sum = (k) => Math.round(CLIENT_ROWS.reduce((t, c) => t + c[k], 0) * 100) / 100;
const OPEN = ['new', 'contacted', 'interested'];
const NOW = Date.now();
const METRICS = {
  clients: CLIENT_ROWS.length,
  new_clients: CLIENT_ROWS.filter((c) => c.created_at >= MONTH).length,
  active_clients: CLIENT_ROWS.filter((c) => c.payments_count + c.air_parcels + c.sea_parcels > 0).length,
  payments_xaf: sum('payments_xaf'),
  payments_count: sum('payments_count'),
  deposits_xaf: 21500000,
  deposits_count: 5,
  air_parcels: sum('air_parcels'),
  air_kg: sum('air_kg'),
  sea_parcels: sum('sea_parcels'),
  sea_cbm: sum('sea_cbm'),
  prospects_open: PROSPECTS.filter((p) => OPEN.includes(p.status)).length,
  prospects_new: PROSPECTS.filter((p) => p.created_at >= MONTH).length,
  prospects_won: PROSPECTS.filter((p) => p.status === 'won' && p.converted_at >= MONTH).length,
  prospects_due: PROSPECTS.filter((p) => OPEN.includes(p.status) && p.next_action_at && Date.parse(p.next_action_at) <= NOW).length,
};
// Fixés par Nelson pour octobre ; `actual` suit les chiffres ci-dessus (ORDER BY o.metric côté SQL).
const OBJECTIVES = [
  { metric: 'air_kg', target: 250, actual: METRICS.air_kg },
  { metric: 'new_clients', target: 4, actual: METRICS.new_clients },
  { metric: 'payments_xaf', target: 60000000, actual: METRICS.payments_xaf },
  { metric: 'prospects_new', target: 12, actual: METRICS.prospects_new },
  { metric: 'sea_cbm', target: 5, actual: METRICS.sea_cbm },
];
const CARD = {
  source: { id: RODRIGUE_SRC, label: 'Rodrigue Tchami', phone: '+237690112233', is_active: true },
  staff: { user_id: 'staff-rodrigue', name: 'Rodrigue Tchami', is_disabled: false },
  metrics: METRICS,
  objectives: OBJECTIVES,
};

// ── Le bureau : la liste des clients derrière la fenêtre « Nouveau client » ──
const client = (user_id, customer_code, first_name, last_name, company_name, phone, city, country, created_at, source_id, o = {}) => ({
  user_id, customer_code, first_name, last_name, company_name, phone, phone_e164: phone.replace(/\s/g, ''), email: null, city, country,
  status: 'ACTIVE', kyc_status: 'verified', avatar_url: null, utm_source: null, utm_medium: null, utm_campaign: null,
  source_id, source_set_at: created_at, created_at, updated_at: '2026-10-05T09:00:00Z', ...o,
});
const OFFICE_CLIENTS = [
  client('cl-bello', 'BZ-529907', 'Ibrahim', 'Bello', 'Bello & Frères', '+237 699 40 51 62', 'Garoua', 'Cameroun', '2026-10-02T11:20:00Z', 'src-rodrigue'),
  client('cl-fotso', 'BZ-207781', 'Nadia', 'Fotso', null, '+237 699 88 77 66', 'Yaoundé', 'Cameroun', '2026-09-24T10:30:00Z', 'src-carine'),
  client('cl-ondo', 'BZ-510224', 'Samuel', 'Ondo', 'Ondo Distribution', '+241 66 55 44 33', 'Libreville', 'Gabon', '2026-09-02T08:45:00Z', 'src-facebook'),
  client('cl-aicha', 'BZ-482913', 'Aïcha', 'Mbarga', 'Mbarga Import SARL', '+237 677 12 34 56', 'Douala', 'Cameroun', '2026-08-14T10:05:00Z', 'src-rodrigue', { email: 'aicha@mbarga-import.cm' }),
  client('cl-ngono', 'BZ-418532', 'Esther', 'Ngono', 'Ets Ngono & Fils', '+237 675 61 72 83', 'Yaoundé', 'Cameroun', '2026-07-19T14:15:00Z', 'src-rodrigue'),
  client('cl-tchoupo', 'BZ-392610', 'Linda', 'Tchoupo', 'LT Cosmétiques', '+237 690 72 63 54', 'Douala', 'Cameroun', '2026-07-02T09:10:00Z', 'src-bao'),
  client('cl-mvondo', 'BZ-366108', 'Jean-Claude', 'Mvondo', 'Mvondo Négoce', '+237 699 27 81 44', 'Douala', 'Cameroun', '2026-06-03T09:40:00Z', 'src-rodrigue'),
  client('cl-eyenga', 'BZ-301245', 'Brigitte', 'Eyenga', null, '+237 696 14 25 36', 'Douala', 'Cameroun', '2026-05-11T10:00:00Z', 'src-rodrigue'),
];
const BALANCES = { 'cl-bello': 350000, 'cl-fotso': 1840000, 'cl-ondo': 2615000, 'cl-aicha': 4280000, 'cl-ngono': 690000, 'cl-tchoupo': 1125000, 'cl-mvondo': 2300000, 'cl-eyenga': 0 };
const WALLETS = OFFICE_CLIENTS.map((c) => ({ id: `w-${c.user_id}`, user_id: c.user_id, balance_xaf: BALANCES[c.user_id] ?? 0, overdraft_limit_xaf: 0, created_at: c.created_at, updated_at: '2026-10-05T09:00:00Z' }));
const DEPOSIT_TOTALS = { 'cl-fotso': 6500000, 'cl-ondo': 14200000, 'cl-aicha': 48750000, 'cl-ngono': 9300000, 'cl-tchoupo': 7400000, 'cl-mvondo': 21800000, 'cl-eyenga': 3000000, 'cl-bello': 350000 };
const PAYMENT_TOTALS = { 'cl-fotso': 4660000, 'cl-ondo': 11585000, 'cl-aicha': 44470000, 'cl-ngono': 8610000, 'cl-tchoupo': 6275000, 'cl-mvondo': 19500000, 'cl-eyenga': 3000000 };
const DEPOSITS = Object.entries(DEPOSIT_TOTALS).map(([user_id, amount_xaf]) => ({ user_id, amount_xaf, status: 'validated' }));
const PAYMENTS = Object.entries(PAYMENT_TOTALS).map(([user_id, amount_xaf]) => ({ user_id, amount_xaf, status: 'completed' }));

// ── Préparation d'une capture ──
// Les polices viennent de Google Fonts : un chargement raté laisse une police de secours. On recharge (6 essais).
async function fonts(page) {
  for (let i = 0; i < 6; i++) {
    const ok = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some((f) => /DM Sans/.test(f.family) && f.status === 'loaded');
    });
    if (ok) return;
    await page.waitForTimeout(500 * (i + 1));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
  }
}
// Capture de toute la page avec la barre d'onglets EN BAS : la fenêtre prend la hauteur du contenu
// (en pleine page, une barre fixe resterait à 844 px, au milieu de l'écran).
async function fitHeight(page) {
  const h = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
  const vp = page.viewportSize();
  if (vp && h > vp.height) await page.setViewportSize({ width: vp.width, height: h });
  await page.waitForTimeout(300);
}
const phone = (extra) => ({
  role: 'commercial',
  before: async (page) => {
    await fonts(page);
    if (extra) await extra(page);
    await fitHeight(page);
  },
});

export const SCREENS = [
  // 1. Lundi : son mois, ses objectifs, les chiffres de ses clients.
  { key: 'j.sales.home', name: '01-accueil-commercial', ...phone() },
  // 2. Ses prospects ouverts (à contacter, contacté, intéressé), relances échues en tête.
  { key: 'j.sales.prospects', name: '02-prospects', ...phone() },
  // 2 bis. Les puces de statut jusqu'au bout : « Devenus clients » choisi, « Perdus » à côté.
  {
    key: 'j.sales.prospects-closed', name: '03-prospects-devenus-clients',
    ...phone(async (page) => {
      await page.locator('[role="tablist"]').evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    }),
  },
  // 3. Un nouveau prospect, saisi sur le marché.
  {
    key: 'j.sales.prospect-new', name: '04-nouveau-prospect',
    ...phone(async (page) => {
      await page.fill('#pr-first', 'Gaëlle');
      await page.fill('#pr-last', 'Nkoulou');
      await page.fill('#pr-phone', '677 84 21 90');
      await page.fill('#pr-company', 'GN Textiles');
      await page.fill('#pr-city', 'Douala');
      await page.getByRole('button', { name: 'Payer ses fournisseurs' }).click();
      await page.getByRole('button', { name: 'Fret bateau' }).click();
      await page.getByRole('button', { name: 'Dans 3 jours' }).click();
      await page.fill('#pr-notes', 'Rencontrée au marché Mboppi. Importe du wax de Guangzhou, un conteneur partagé tous les deux mois. Paie ses fournisseurs par un cousin en Chine. Lui envoyer nos taux, la rappeler jeudi.');
      await page.locator('#pr-notes').blur();
    }),
  },
  // 4. La fiche de Mireille Abena : appeler, WhatsApp, où en est-on.
  { key: 'j.sales.prospect-card', name: '05-fiche-prospect', ...phone() },
  // 5. Ses clients et ce qu'ils ont fait en octobre.
  { key: 'j.sales.clients', name: '06-mes-clients', ...phone() },
  // 6. Au bureau : le numéro de Paul Etoga attribue le nouveau client à Rodrigue.
  {
    key: 'j.sales.office-new-client', name: '07-bureau-nouveau-client', desktop: true, viewport: '1440x1240',
    before: async (page) => {
      await fonts(page);
      await page.fill('#cc-first', 'Paul');
      await page.fill('#cc-last', 'Etoga');
      await page.fill('#cc-company', 'Etoga Quincaillerie');
      await page.locator('#cc-phone-0').pressSequentially('699 12 34 56', { delay: 40 });
      await page.fill('#cc-city', 'Douala');
      await page.locator('#cc-city').blur();
      // La recherche du prospect part 400 ms après la dernière frappe.
      await page.waitForTimeout(1100);
      await page.getByRole('status').filter({ hasText: 'Rodrigue Tchami' }).scrollIntoViewIfNeeded();
    },
  },
];

export const RPC = {
  commercial_dashboard: (b) => ({ success: true, month: b?.p_month ?? MONTH, ...CARD }),
  commercial_clients: (b) => ({ success: true, month: b?.p_month ?? MONTH, rows: CLIENT_ROWS }),
  prospect_lookup_phone: (b) => {
    const hit = PROSPECTS.find((p) => p.phone_e164 === String(b?.p_phone ?? '').replace(/[\s.()-]/g, '') && OPEN.includes(p.status));
    if (!hit) return { success: true, found: false };
    return { success: true, found: true, prospect_id: hit.id, prospect_name: `${hit.first_name} ${hit.last_name ?? ''}`.trim(), source_id: hit.source_id, source_label: 'Rodrigue Tchami', source_active: true };
  },
  prospect_create: () => ({ success: true, id: 'p-gaelle' }),
  prospect_update: { success: true },
  prospect_set_status: { success: true },
};

export function REST(url, method) {
  if (method !== 'GET') return undefined;
  if (url.includes('/rest/v1/prospects')) return PROSPECTS;
  if (url.includes('/rest/v1/client_sources')) return SOURCES;
  if (url.includes('/rest/v1/clients')) return OFFICE_CLIENTS;
  if (url.includes('/rest/v1/wallets')) return WALLETS;
  if (url.includes('/rest/v1/deposits')) return DEPOSITS;
  if (url.includes('/rest/v1/payments')) return PAYMENTS;
  return undefined;
}
