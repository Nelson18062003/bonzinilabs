// ============================================================
// Parcours complet (05/10/2026) — domaine « sales » : l'espace du commercial
// Rodrigue Tchami sur son téléphone (« /v »), puis, au bureau, la création
// du compte de son prospect Paul Etoga, attribué d'office à Rodrigue.
//   node tools/shoot-journey.mjs sales [écran…]
//
// Formes des réponses : supabase/migrations/20261005160000_teams_commercials.sql
// (commercial_dashboard → _commercial_card, commercial_clients,
// prospect_lookup_phone, table prospects) et src/hooks/useSales.ts
// (prospect_phone_check et prospect_create → to_verify, contrat du 07/10).
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

// ── Les prospects de Rodrigue (table prospects + prospect_phones, lus d'un coup par useProspects) ──
// Depuis le 06/10 : sexe, date de naissance, email, autres numéros (avec libellé), « ses plus gros
// problèmes » et « ce que nous pouvons faire » (champs libres). Sylvie Manga est une fiche d'avant :
// ni sexe ni ville (bandeau « Fiche incomplète »).
const phones = (...list) => list.map(([phone_e164, country_iso, label], position) => ({ phone_e164, country_iso, label, position }));
const prospect = (o) => ({
  source_id: RODRIGUE_SRC, last_name: null, company: null, city: null, interests: [], notes: null,
  lost_reason: null, next_action_at: null, converted_user_id: null, converted_at: null,
  gender: null, birth_date: null, email: null, pain_points: null, help_needed: null, phones: [],
  ...o,
  status_changed_at: o.status_changed_at ?? o.created_at,
  updated_at: o.updated_at ?? o.status_changed_at ?? o.created_at,
});
const PROSPECTS = [
  prospect({ id: 'p-paul', first_name: 'Paul', last_name: 'Etoga', company: 'Etoga Quincaillerie', phone: '699 12 34 56', phone_e164: '+237699123456', city: 'Douala',
    gender: 'MALE', birth_date: '1979-04-18', email: 'paul.etoga@yahoo.fr', phones: phones(['+237677551209', 'CM', 'WhatsApp']),
    pain_points: 'Payer ses fournisseurs en Chine : passe par un cousin à Yiwu, deux semaines de délai à chaque commande.\nLa douane et sa procédure : ne sait jamais à l’avance combien il paiera au port de Douala.',
    help_needed: 'Régler ses fournisseurs de Yiwu directement, et un devis de fret bateau clair avant le départ.',
    interests: ['payments', 'sea'], notes: 'Quincaillerie à Akwa. Fait venir de l’outillage de Yiwu, un conteneur partagé tous les deux mois.',
    status: 'new', next_action_at: '2026-10-05T08:00:00Z', created_at: '2026-10-03T10:12:00Z' }),
  prospect({ id: 'p-rostand', first_name: 'Rostand', last_name: 'Kamdem', company: 'Kamdem Électronique', phone: '+237 670 98 76 54', phone_e164: '+237670987654', city: 'Bafoussam',
    gender: 'MALE', birth_date: '1988-09-30', phones: phones(['+237655001122', 'CM', 'Boutique']),
    pain_points: 'Payer ses fournisseurs en Chine : Western Union lui coûte cher et plafonne les montants.\nFixer ses prix de vente : ses marges fondent quand le yuan monte.',
    help_needed: 'Lui montrer nos taux du jour et un règlement à Shenzhen en 48 h.',
    interests: ['payments'], notes: 'Téléphones et accessoires, Shenzhen. Paie ses fournisseurs par Western Union.',
    status: 'contacted', next_action_at: '2026-10-04T08:00:00Z', created_at: '2026-09-28T09:00:00Z', status_changed_at: '2026-09-30T14:10:00Z' }),
  prospect({ id: 'p-mireille', first_name: 'Mireille', last_name: 'Abena', company: 'Abena Beauté', phone: '+237 655 43 21 09', phone_e164: '+237655432109', city: 'Yaoundé',
    gender: 'FEMALE', birth_date: '1990-06-23', email: 'mireille.abena@gmail.com',
    phones: phones(['+237699314420', 'CM', 'WhatsApp'], ['+8613560127788', 'CN', 'WeChat']),
    pain_points: 'Payer ses fournisseurs en Chine : ses fournisseurs de Guangzhou veulent être payés avant l’expédition, et sa banque met dix jours.\nManque de capital : trois mois de stock immobilisés.\nTransport avion : des perruques arrivées abîmées dans des colis regroupés.',
    help_needed: 'Régler ses fournisseurs en 48 h depuis Yaoundé, en commençant par un premier règlement test de 3 M XAF. Lui montrer le suivi des colis avion.',
    interests: ['payments', 'air'],
    notes: 'Cosmétiques et perruques de Guangzhou, deux commandes par mois. Nos taux l’intéressent : veut tester avec un premier règlement de 3 M XAF.',
    status: 'interested', next_action_at: '2026-10-07T08:00:00Z', created_at: '2026-09-22T11:30:00Z', status_changed_at: '2026-10-01T15:20:00Z' }),
  prospect({ id: 'p-arnaud', first_name: 'Arnaud', last_name: 'Fouda', company: 'Fouda Pièces Auto', phone: '+237 678 23 45 61', phone_e164: '+237678234561', city: 'Douala',
    gender: 'MALE', birth_date: '1985-11-02', email: 'contact@fouda-pieces.cm',
    pain_points: 'Trouver les bons fournisseurs : deux lots de plaquettes de frein refusés cette année.\nTransport bateau : ne sait pas grouper avec d’autres importateurs.',
    interests: ['payments', 'sea'], status: 'contacted', next_action_at: '2026-10-09T08:00:00Z', created_at: '2026-10-01T09:30:00Z', status_changed_at: '2026-10-02T10:00:00Z' }),
  prospect({ id: 'p-clarisse', first_name: 'Clarisse', last_name: 'Atangana', company: 'CA Mode', phone: '+237 691 34 12 78', phone_e164: '+237691341278', city: 'Yaoundé',
    gender: 'FEMALE', birth_date: '1994-02-14', email: 'clarisse@camode.cm', phones: phones(['+8615920448811', 'CN', 'WeChat']),
    pain_points: 'Gérer son capital : tout passe par la caisse de la boutique, rien n’est mis de côté pour les commandes.',
    help_needed: 'Un suivi de ses règlements fournisseurs, mois par mois.',
    interests: ['payments', 'air'], status: 'interested', next_action_at: '2026-10-12T08:00:00Z', created_at: '2026-09-15T13:00:00Z', status_changed_at: '2026-09-29T16:45:00Z' }),
  prospect({ id: 'p-sylvie', first_name: 'Sylvie', last_name: 'Manga', phone: '694 55 66 77', phone_e164: '+237694556677',
    interests: ['air'], notes: 'Rencontrée à la foire de l’Akwa. Vend des sacs.', status: 'new', created_at: '2026-10-04T16:40:00Z' }),
  prospect({ id: 'p-ibrahim', first_name: 'Ibrahim', last_name: 'Bello', company: 'Bello & Frères', phone: '+237 699 40 51 62', phone_e164: '+237699405162', city: 'Garoua',
    gender: 'MALE', birth_date: '1976-01-09', phones: phones(['+237677405162', 'CM', 'Bureau']),
    pain_points: 'Transport avion : ne trouvait personne pour du fret avion depuis Guangzhou vers Garoua.',
    interests: ['air'], status: 'won', converted_user_id: 'cl-bello', converted_at: '2026-10-02T11:20:00Z', created_at: '2026-09-10T08:30:00Z', status_changed_at: '2026-10-02T11:20:00Z' }),
  prospect({ id: 'p-aicha', first_name: 'Aïcha', last_name: 'Mbarga', company: 'Mbarga Import SARL', phone: '+237 677 12 34 56', phone_e164: '+237677123456', city: 'Douala',
    gender: 'FEMALE', email: 'aicha@mbarga-import.cm',
    interests: ['payments', 'air', 'sea'], status: 'won', converted_user_id: 'cl-aicha', converted_at: '2026-08-14T10:05:00Z', created_at: '2026-07-30T09:00:00Z', status_changed_at: '2026-08-14T10:05:00Z' }),
  prospect({ id: 'p-joseph', first_name: 'Joseph', last_name: 'Ndjock', phone: '+237 677 80 90 12', phone_e164: '+237677809012', city: 'Edéa', gender: 'MALE',
    interests: ['sea'], status: 'lost', lost_reason: 'A déjà un transitaire à Yiwu', created_at: '2026-09-05T10:00:00Z', status_changed_at: '2026-09-26T17:05:00Z' }),
  prospect({ id: 'p-pauline', first_name: 'Pauline', last_name: 'Ewodo', company: 'Ewodo Déco', phone: '+237 696 71 82 93', phone_e164: '+237696718293', city: 'Kribi', gender: 'FEMALE',
    interests: ['sea'], status: 'lost', lost_reason: 'Trouve le délai du bateau trop long', created_at: '2026-08-28T10:00:00Z', status_changed_at: '2026-09-18T12:00:00Z' }),
  // 07/10 (relecture) : « Nadège Fotso », saisie fin septembre — son numéro est celui d'une cliente Bonzini ; la
  // direction a refusé (motif fixe : le commercial ne lit rien d'autre). « Rouvrir » n'est pas proposé : le serveur le refuserait.
  prospect({ id: 'p-nadege', first_name: 'Nadège', last_name: 'Fotso', company: 'Fotso Cosmétiques', phone: '+237 699 88 77 66', phone_e164: '+237699887766', city: 'Yaoundé',
    gender: 'FEMALE', pain_points: 'Ses paiements en Chine mettent une semaine à arriver.',
    interests: ['payments'], status: 'lost', lost_reason: 'Déjà client de Bonzini', created_at: '2026-09-29T09:00:00Z', status_changed_at: '2026-10-03T10:30:00Z' }),
  // 07/10 : rencontrée au marché Sandaga, son numéro est celui d'une cliente Bonzini (Linda Tchoupo, LT Cosmétiques,
  // venue par le bouche-à-oreille) — le nom saisi n'est pas tout à fait le même. Fiche « À vérifier » : la direction décide.
  prospect({ id: 'p-linda', first_name: 'Linda', last_name: 'Tchoupou', company: 'LT Cosmétiques', phone: '+237 690 72 63 54', phone_e164: '+237690726354', city: 'Douala',
    gender: 'FEMALE', phones: phones(['+8613711224455', 'CN', 'WeChat']),
    pain_points: 'Payer ses fournisseurs en Chine : passe par une collègue à Guangzhou, les règlements prennent dix jours.\nTransport avion : ses colis de cosmétiques arrivent sans suivi.',
    help_needed: 'Régler ses fournisseurs de Guangzhou en 48 h et suivre ses colis avion.',
    interests: ['payments', 'air'], notes: 'Dit avoir déjà « essayé Bonzini une fois ».',
    status: 'to_verify', next_action_at: '2026-10-08T08:00:00Z', created_at: '2026-10-05T15:40:00Z' }),
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

// Les prospects d'une collègue (Carine Ewane) : leurs numéros sont « suivis par un autre commercial ».
const OTHER_COMMERCIAL_NUMBERS = ['+237655887766', '+237677990011'];

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

// L'assistant « Nouveau prospect » (et la modification d'une fiche) garde ce qui est tapé dans localStorage,
// sous le compte du commercial (« bonzini.v.prospect-draft:<compte> », « …-edit:… »), et le contexte du
// navigateur est partagé entre les captures : chacune repart de rien.
const DRAFT_PREFIX = 'bonzini.v.prospect-';
const freshDraft = async (page) => {
  await page.addInitScript((prefix) => {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith(prefix)) localStorage.removeItem(k);
    } catch { /* privé */ }
  }, DRAFT_PREFIX);
};
const dark = async (page) => { await page.evaluate(() => document.documentElement.classList.add('dark')); await page.waitForTimeout(300); };
// Le récapitulatif défile dans le cadre de l'assistant (ViewportShell) : la fenêtre prend la hauteur
// de l'en-tête, du contenu entier et du pied.
async function fitShell(page) {
  const h = await page.evaluate(() => {
    const sc = document.getElementById('prospect-wizard')?.parentElement;
    const shell = sc?.parentElement;
    return sc && shell ? Math.ceil(shell.clientHeight - sc.clientHeight + sc.scrollHeight) : 0;
  });
  const vp = page.viewportSize();
  if (vp && h > vp.height) await page.setViewportSize({ width: vp.width, height: h });
  await page.waitForTimeout(300);
}
const settle = (page) => page.waitForTimeout(520); // la transition d'une étape (420 ms)
const cont = async (page) => { await page.getByRole('button', { name: /^Continuer/ }).click(); await settle(page); };

// Gaëlle Nkoulou, rencontrée au marché Mboppi : chaque étape remplie comme sur le terrain.
const W = {
  async who(page) {
    await page.fill('#pr-first', 'gaëlle');
    await page.fill('#pr-last', 'nkoulou');
    await page.locator('#pr-last').blur();
    await page.getByRole('radio', { name: 'Femme' }).click();
    await page.locator('#pr-birth').pressSequentially('14021988', { delay: 25 });
    await page.locator('#pr-birth').blur();
  },
  async reach(page) {
    await page.locator('#pr-phone').pressSequentially('677842190', { delay: 25 });
    await page.getByRole('button', { name: /Ajouter un numéro/ }).click();
    await page.getByRole('button', { name: 'Indicatif' }).nth(1).click();
    await page.getByRole('option', { name: /Chine/ }).click();
    await page.locator('input[id^="pr-phone-"]').first().pressSequentially('13826014477', { delay: 20 });
    await page.getByRole('button', { name: 'WeChat', exact: true }).click();
    await page.locator('#pr-email').pressSequentially('gaelle.nkoulou', { delay: 15 });
  },
  // Le numéro principal est celui d'une cliente Bonzini (Nadia Fotso) : Rodrigue ne le sait pas.
  async reachClient(page) {
    await page.locator('#pr-phone').pressSequentially('699887766', { delay: 25 });
    await page.getByRole('button', { name: /Ajouter un numéro/ }).click();
    await page.getByRole('button', { name: 'Indicatif' }).nth(1).click();
    await page.getByRole('option', { name: /Chine/ }).click();
    await page.locator('input[id^="pr-phone-"]').first().pressSequentially('13826014477', { delay: 20 });
    await page.getByRole('button', { name: 'WeChat', exact: true }).click();
    await page.locator('#pr-email').pressSequentially('gaelle.nkoulou', { delay: 15 });
    await page.getByRole('button', { name: 'Compléter : gaelle.nkoulou@gmail.com' }).click();
    await page.locator('#pr-email').blur();
    // La vérification part 400 ms après la dernière frappe.
    await page.getByText('Ce numéro est déjà celui d’un client Bonzini.').waitFor();
  },
  async reachDone(page) {
    await page.getByRole('button', { name: 'Compléter : gaelle.nkoulou@gmail.com' }).click();
    await page.locator('#pr-email').blur();
  },
  async business(page) {
    await page.getByRole('button', { name: 'Douala', exact: true }).click();
    await page.fill('#pr-company', 'GN Textiles');
    await page.locator('#pr-company').blur();
  },
  async needs(page) {
    await page.getByRole('button', { name: 'Payer ses fournisseurs en Chine' }).click();
    await page.getByRole('button', { name: 'La douane et sa procédure' }).click();
    await page.getByRole('button', { name: 'Fixer ses prix de vente' }).click();
    await page.fill('#pr-pain',
      'Payer ses fournisseurs en Chine : passe par un cousin à Guangzhou, une semaine pour chaque règlement.\n'
      + 'La douane et sa procédure : ne comprend pas ce qu’on lui facture au port de Douala.\n'
      + 'Fixer ses prix de vente : ne connaît le coût réel de son wax qu’après le dédouanement.');
    await page.locator('#pr-pain').blur();
  },
  async help(page) {
    await page.fill('#pr-help', 'Régler ses fournisseurs directement, et un devis de fret bateau avec la douane comprise avant le départ.');
    await page.locator('#pr-help').blur();
    await page.getByRole('button', { name: 'Payer ses fournisseurs', exact: true }).click();
    await page.getByRole('button', { name: 'Fret bateau', exact: true }).click();
  },
  async next(page) {
    await page.getByRole('button', { name: 'Dans 3 jours' }).click();
    await page.fill('#pr-notes', 'Rencontrée au marché Mboppi. Importe du wax de Guangzhou, un conteneur partagé tous les deux mois. Lui envoyer nos taux, la rappeler jeudi.');
    await page.locator('#pr-notes').blur();
  },
};
/** Les étapes 1 à n remplies, l'assistant posé sur l'étape n (remplie si `fill`). `client` : son numéro est celui d'une cliente. */
const wizardAt = (n, { fill = true, after, full = true, theme, client = false } = {}) => ({
  role: 'commercial',
  init: freshDraft,
  before: async (page) => {
    await fonts(page);
    // Les étapes passées, remplies jusqu'au bout ; celle où l'on s'arrête, telle qu'en cours de saisie.
    const reach = client ? W.reachClient : async (pg) => { await W.reach(pg); await W.reachDone(pg); };
    const done = [W.who, reach, W.business, W.needs, W.help, W.next];
    const current = [W.who, client ? W.reachClient : W.reach, W.business, W.needs, W.help, W.next];
    for (let i = 0; i < n - 1; i++) { await done[i](page); await cont(page); }
    if (fill && current[n - 1]) await current[n - 1](page);
    if (after) await after(page);
    if (theme === 'dark') await dark(page);
    await settle(page);
    if (full) {
      // L'étape entière, défilée en haut : la fenêtre prend la hauteur du cadre.
      await page.evaluate(() => document.getElementById('prospect-wizard')?.parentElement?.scrollTo(0, 0));
      await fitShell(page);
    }
  },
});

export const SCREENS = [
  // 0. Sa connexion, « /v/login » : son email (souvent inventé) puis son mot de passe — aucun code email.
  { key: 'j.sales.login', name: '00a-connexion-commercial', ...phone() },
  {
    key: 'j.sales.login', name: '00b-connexion-commercial-mot-de-passe',
    ...phone(async (page) => {
      await page.fill('#v-email', 'aristidelandry@bonzini.com');
      await page.locator('form button[type="submit"]').click();
      await page.locator('#v-password').waitFor();
      await page.fill('#v-password', '7c4e19ab52f0');
    }),
  },
  // 1. Lundi : son mois, ses objectifs, les chiffres de ses clients.
  { key: 'j.sales.home', name: '01-accueil-commercial', ...phone() },
  // 1 bis. Le menu de son compte : changer son mot de passe, se déconnecter.
  {
    key: 'j.sales.home', name: '01b-menu-du-compte', role: 'commercial', fullPage: false,
    before: async (page) => {
      await fonts(page);
      await page.getByRole('button', { name: 'Mon compte' }).click();
      await page.getByRole('menuitem', { name: /Changer mon mot de passe/ }).waitFor();
    },
  },
  // 1 bis bis. Le même mois, le téléphone en thème sombre.
  { key: 'j.sales.home', name: '01d-accueil-sombre', ...phone(dark) },
  // 1 ter. Changer son mot de passe provisoire.
  { key: 'j.sales.password', name: '01c-changer-mot-de-passe', ...phone() },
  // 2. Ses prospects ouverts (à contacter, contacté, intéressé), relances échues en tête ; « À vérifier » a sa puce.
  { key: 'j.sales.prospects', name: '02-prospects', ...phone() },
  // 2 ter. « À vérifier » : la fiche dont le numéro est celui d'une cliente, en attente de la direction.
  { key: 'j.sales.prospects-verify', name: '02b-prospects-a-verifier', ...phone() },
  // 2 bis. Les puces de statut jusqu'au bout : « Devenus clients » choisi, « Perdus » à côté.
  {
    key: 'j.sales.prospects-closed', name: '03-prospects-devenus-clients',
    ...phone(async (page) => {
      await page.locator('[aria-label="Filtrer par statut"]').evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    }),
  },
  // 3. Un nouveau prospect, saisi sur le marché : l'assistant, une idée par écran.
  { key: 'j.sales.prospect-new', name: '04a-nouveau-prospect-1-qui-est-ce', ...wizardAt(1) },
  { key: 'j.sales.prospect-new', name: '04b-nouveau-prospect-2-le-joindre', ...wizardAt(2, { after: W.reachDone }) },
  // 3 bis. L'email en cours de frappe : les fins d'adresse proposées.
  { key: 'j.sales.prospect-new', name: '04b2-nouveau-prospect-email-propose', ...wizardAt(2) },
  { key: 'j.sales.prospect-new', name: '04c-nouveau-prospect-3-activite', ...wizardAt(3) },
  // 3 ter. Une ville tapée : les villes du Cameroun proposées.
  {
    key: 'j.sales.prospect-new', name: '04c2-nouveau-prospect-ville-suggeree',
    ...wizardAt(3, { fill: false, full: false, after: async (page) => { await page.locator('#pr-city').pressSequentially('ba', { delay: 40 }); } }),
  },
  { key: 'j.sales.prospect-new', name: '04d-nouveau-prospect-4-problemes', ...wizardAt(4) },
  // 3 ter bis. La même étape, téléphone en thème sombre (idées retenues, champ long).
  { key: 'j.sales.prospect-new', name: '04d2-nouveau-prospect-4-problemes-sombre', ...wizardAt(4, { theme: 'dark' }) },
  { key: 'j.sales.prospect-new', name: '04e-nouveau-prospect-5-comment-l-aider', ...wizardAt(5) },
  { key: 'j.sales.prospect-new', name: '04f-nouveau-prospect-6-la-suite', ...wizardAt(6) },
  {
    key: 'j.sales.prospect-new', name: '04g-nouveau-prospect-7-recapitulatif',
    ...wizardAt(7, { fill: false }),
  },
  // 3 quater. « Continuer » sans rien remplir : chaque champ obligatoire le dit, le focus va au premier.
  {
    key: 'j.sales.prospect-new', name: '04h-nouveau-prospect-champs-requis',
    ...wizardAt(1, { fill: false, full: false, after: async (page) => { await page.getByRole('button', { name: /^Continuer/ }).click(); } }),
  },
  // 3 quinquies. Un importateur installé à Guangzhou : touche le drapeau, la feuille des pays s'ouvre.
  {
    key: 'j.sales.prospect-new', name: '04i-nouveau-prospect-choix-du-pays', fullPage: false,
    ...wizardAt(2, { fill: false, full: false, after: async (page) => {
      await page.getByRole('button', { name: 'Indicatif' }).first().click();
      await page.getByRole('option', { name: /Chine/ }).waitFor();
    } }),
  },
  // 3 sexies bis. Son numéro est celui d'une cliente Bonzini : une note ambre, sans nom ni blocage.
  { key: 'j.sales.prospect-new', name: '04k-nouveau-prospect-2-numero-deja-client', ...wizardAt(2, { client: true }) },
  // 3 sexies ter. Un numéro déjà dans SES prospects : refusé, avec le lien vers la fiche.
  {
    key: 'j.sales.prospect-new', name: '04l-nouveau-prospect-2-deja-un-de-ses-prospects',
    ...wizardAt(2, { fill: false, after: async (page) => {
      await page.locator('#pr-phone').pressSequentially('655432109', { delay: 25 });
      await page.getByText('Ce numéro est déjà celui d’un de vos prospects').waitFor();
    } }),
  },
  // 3 sexies quater. Le récapitulatif le redit avant d'enregistrer : la fiche partira « À vérifier ».
  { key: 'j.sales.prospect-new', name: '04m-nouveau-prospect-7-recapitulatif-a-verifier', ...wizardAt(7, { fill: false, client: true }) },
  // 3 sexies. L'application fermée en pleine saisie : le brouillon est repris à la réouverture.
  {
    key: 'j.sales.prospect-new', name: '04j-nouveau-prospect-brouillon-repris',
    ...wizardAt(2, { fill: false, full: false, after: async (page) => {
      await page.locator('#pr-phone').pressSequentially('677842190', { delay: 20 });
      await page.waitForTimeout(200);
      // Le rechargement ne doit PAS effacer le brouillon : on passe par une nouvelle page du même contexte.
      const again = await page.context().newPage();
      await again.goto(page.url(), { waitUntil: 'networkidle' });
      await fonts(again);
      await again.waitForTimeout(900);
      const shot = await again.screenshot();
      await again.close();
      await page.setContent(`<html><body style="margin:0"><img src="data:image/png;base64,${shot.toString('base64')}" style="display:block;width:390px"></body></html>`);
    } }),
  },
  // 4. La fiche de Mireille Abena : ses numéros (appeler, WhatsApp pour chacun), où on en est, ses besoins.
  { key: 'j.sales.prospect-card', name: '05-fiche-prospect', ...phone() },
  // 4. bis La même fiche, téléphone en thème sombre (filet violet, encarts, étiquettes).
  { key: 'j.sales.prospect-card', name: '05a-fiche-prospect-sombre', ...phone(dark) },
  // 4 bis. Une fiche d'avant le 06/10, sans sexe, ville ni problèmes : le bandeau « Fiche incomplète ».
  { key: 'j.sales.prospect-incomplete', name: '05b-fiche-incomplete', ...phone() },
  // 4 ter. « Modifier » sur « Ses plus gros problèmes » : la même étape de l'assistant, pré-remplie.
  { key: 'j.sales.prospect-edit-needs', name: '05c-modifier-besoins', role: 'commercial', init: freshDraft, before: async (page) => { await fonts(page); await settle(page); await fitShell(page); } },
  // 4 ter bis. Des changements, puis la croix : « Abandonner vos modifications ? ».
  {
    key: 'j.sales.prospect-edit-needs', name: '05c2-modifier-abandonner', role: 'commercial', init: freshDraft, fullPage: false,
    before: async (page) => {
      await fonts(page);
      await settle(page);
      await page.locator('#pr-pain').press('Control+End');
      await page.locator('#pr-pain').pressSequentially('\nManque de capital : veut aussi un crédit fournisseur.', { delay: 10 });
      await page.getByRole('button', { name: 'Fermer' }).first().click();
      await page.getByText('Abandonner vos modifications ?').waitFor();
      await page.waitForTimeout(500);
    },
  },
  // 4 quater. « Compléter » la fiche incomplète : l'identité, la ville, puis ses problèmes, exigés pour enregistrer.
  {
    key: 'j.sales.prospect-edit-incomplete', name: '05d-completer-fiche', role: 'commercial', init: freshDraft,
    before: async (page) => { await fonts(page); await page.getByRole('button', { name: /^Continuer/ }).click(); await settle(page); },
  },
  // 4 quinquies. « Marquer perdu » : le motif d'un toucher.
  {
    key: 'j.sales.prospect-card', name: '05e-fiche-perdu-motif', role: 'commercial', fullPage: false,
    before: async (page) => {
      await fonts(page);
      await page.getByRole('button', { name: /Marquer perdu/ }).click();
      await page.getByRole('button', { name: 'A déjà un transitaire' }).click();
      await page.waitForTimeout(400);
    },
  },
  // 4 sexies. Une fiche « À vérifier » : le bandeau, pas d'actions de statut, le reste modifiable.
  { key: 'j.sales.prospect-verify', name: '05f-fiche-a-verifier', ...phone() },
  // 4 septies. Une fiche refusée par la direction (son numéro est celui d'un client) : pas de « Rouvrir », une phrase le dit.
  { key: 'j.sales.prospect-refused', name: '05g-fiche-refusee-sans-rouvrir', ...phone() },
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
  // 7. (en dernier : l'enregistrement ajoute Gaëlle à la liste lue) « Enregistrer » avec le numéro d'une cliente :
  // la fiche s'ouvre « À vérifier », en le disant.
  {
    key: 'j.sales.prospect-flow', name: '04n-nouveau-prospect-enregistre-a-verifier', role: 'commercial',
    init: async (page) => { created = null; await freshDraft(page); },
    before: async (page) => {
      await wizardAt(7, { fill: false, client: true, full: false }).before(page);
      await page.getByRole('button', { name: 'Enregistrer le prospect' }).click();
      await page.getByText('Prospect enregistré, à vérifier').waitFor();
      await page.waitForTimeout(600);
      await fitHeight(page);
    },
  },
];

// Le prospect que l'assistant vient d'enregistrer (capture 04n) : relu ensuite par la liste.
let created = null;
const norm = (x) => String(x ?? '').replace(/[\s.()-]/g, '');
const isClientNumber = (e164) => OFFICE_CLIENTS.some((c) => c.phone_e164 === e164);

export const RPC = {
  commercial_dashboard: (b) => ({ success: true, month: b?.p_month ?? MONTH, ...CARD }),
  commercial_clients: (b) => ({ success: true, month: b?.p_month ?? MONTH, rows: CLIENT_ROWS }),
  // Par le numéro principal OU l'un des autres (le principal d'abord), parmi les prospects ouverts.
  prospect_lookup_phone: (b) => {
    const want = String(b?.p_phone ?? '').replace(/[\s.()-]/g, '');
    const open = PROSPECTS.filter((p) => OPEN.includes(p.status));
    const hit = open.find((p) => p.phone_e164 === want) ?? open.find((p) => p.phones.some((x) => x.phone_e164 === want));
    if (!hit) return { success: true, found: false };
    return {
      success: true, found: true, prospect_id: hit.id, prospect_name: `${hit.first_name} ${hit.last_name ?? ''}`.trim(),
      source_id: hit.source_id, source_label: 'Rodrigue Tchami', source_active: true,
      first_name: hit.first_name, last_name: hit.last_name, company: hit.company, city: hit.city, email: hit.email,
      gender: hit.gender, birth_date: hit.birth_date, phone_e164: hit.phone_e164,
      phones: hit.phones.map(({ phone_e164, country_iso, label }) => ({ phone_e164, country_iso, label })),
    };
  },
  // Ce que le commercial peut savoir d'un numéro (contrat du 07/10) : un de SES clients, un de SES prospects
  // (hors la fiche modifiée), suivi par un autre commercial, celui d'un client Bonzini (sans dire lequel), libre.
  prospect_phone_check: (b) => {
    const want = norm(b?.p_phone);
    if (!/^\+\d{8,15}$/.test(want)) return { success: true, status: 'invalid' };
    if (CLIENT_ROWS.some((c) => norm(c.phone) === want)) return { success: true, status: 'own_client' };
    const mine = PROSPECTS.filter((p) => p.id !== b?.p_exclude_prospect_id && [...OPEN, 'to_verify'].includes(p.status))
      .find((p) => p.phone_e164 === want || p.phones.some((x) => x.phone_e164 === want));
    if (mine) return { success: true, status: 'mine', prospect_id: mine.id };
    if (OTHER_COMMERCIAL_NUMBERS.includes(want)) return { success: true, status: 'other' };
    if (isClientNumber(want)) return { success: true, status: 'client' };
    return { success: true, status: 'free' };
  },
  // Un des numéros est celui d'un client : la fiche part « À vérifier » (la direction est prévenue).
  prospect_create: (b) => {
    const numbers = [b?.p_phone, ...(b?.p_phones ?? []).map((x) => x.phone_e164)].map(norm);
    const toVerify = numbers.some(isClientNumber);
    const now = new Date().toISOString();
    created = prospect({
      id: 'p-gaelle', first_name: b?.p_first_name, last_name: b?.p_last_name, company: b?.p_company, phone: b?.p_phone, phone_e164: b?.p_phone,
      city: b?.p_city, gender: b?.p_gender, birth_date: b?.p_birth_date, email: b?.p_email, pain_points: b?.p_pain_points, help_needed: b?.p_help_needed,
      phones: (b?.p_phones ?? []).map((x, position) => ({ ...x, position })), interests: b?.p_interests ?? [], notes: b?.p_notes,
      next_action_at: b?.p_next_action_at, status: toVerify ? 'to_verify' : 'new', created_at: now,
    });
    return { success: true, id: 'p-gaelle', to_verify: toVerify };
  },
  prospect_update: { success: true },
  // La cloche de la direction (bureau) lit les fiches « À vérifier » en attente : aucune dans la capture du bureau.
  prospect_claims_pending: { success: true, rows: [] },
  prospect_set_status: { success: true },
};

export function REST(url, method) {
  if (method !== 'GET') return undefined;
  if (url.includes('/rest/v1/prospects')) return created ? [created, ...PROSPECTS] : PROSPECTS;
  if (url.includes('/rest/v1/client_sources')) return SOURCES;
  if (url.includes('/rest/v1/clients')) return OFFICE_CLIENTS;
  if (url.includes('/rest/v1/wallets')) return WALLETS;
  if (url.includes('/rest/v1/deposits')) return DEPOSITS;
  if (url.includes('/rest/v1/payments')) return PAYMENTS;
  return undefined;
}
