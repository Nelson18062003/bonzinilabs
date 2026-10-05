// ============================================================
// Parcours complet — domaine « teams » : « Mes équipes » vu par le propriétaire
// (Nelson Ngango, super admin). Lundi 05/10/2026, 15 h 30 à Douala.
//   node tools/shoot-journey.mjs teams [clé-ou-nom…]
// Formes des réponses : supabase/migrations/20261005160000_teams_commercials.sql
// (team_members, team_create_member, commercial_dashboard, commercial_clients,
// sales_overview), 20260921090000_admin_create_admin_any_role.sql (userId,
// email, tempPassword) et 20261006100000_staff_sites_phones_registration.sql
// (team_members.phones / .site, team_sites, team_create_site,
// team_set_member_profile). Lectures REST : client_sources, prospects.
// ============================================================

// L'heure figée des captures : « il y a 2 h », « jamais connecté »… restent stables.
const NOW = '2026-10-05T14:30:00Z';

// ── Les sites du personnel (team_sites ; ordre de la RPC : position, puis nom) ──
const site = (id, code, label, country_iso, members) => ({ id, code, label, country_iso, is_active: true, members });
const SITES = [
  site('site-gz-office', 'gz_office', 'Guangzhou · bureau', 'CN', 2),
  site('site-gz-warehouse', 'gz_warehouse', 'Guangzhou · entrepôt', 'CN', 0),
  site('site-douala', 'douala', 'Douala', 'CM', 5),
  site('site-yaounde', 'yaounde', 'Yaoundé', 'CM', 1),
];
const SITE = Object.fromEntries(SITES.map(({ id, code, label, country_iso }) => [code, { id, code, label, country_iso }]));

// ── L'équipe (team_members) ─────────────────────────────────────────────
// `phones` : principal d'abord ; `phone` en est la recopie (comme la RPC).
// `legacy` : une réponse d'avant le 06/10, sans `phones` ni `site` — la page doit tenir.
const tel = (phone_e164, country_iso, label = null) => ({ phone_e164, country_iso, label });
const member = (user_id, role, first_name, last_name, phones, created_at, last_sign_in_at, o = {}) => ({
  user_id, role,
  email: o.email ?? `${first_name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${last_name.toLowerCase()}@bonzinilabs.com`,
  first_name, last_name,
  phone: phones[0]?.phone_e164 ?? null,
  ...(o.legacy ? {} : { phones, site: o.site ?? null }),
  avatar_url: null,
  is_disabled: o.is_disabled ?? false,
  created_at, last_sign_in_at,
  source: o.source ?? null,
});
const SRC_RODRIGUE = { id: 'src-rodrigue', label: 'Rodrigue Tchami', phone: '+237 690 11 22 33', is_active: true };
const SRC_CARINE = { id: 'src-carine', label: 'Carine Ewane', phone: '+237 677 45 67 89', is_active: true };

// Trié comme la RPC : les actifs d'abord, puis par prénom et nom.
const TEAM = [
  member('u-ali', 'cash_agent', 'Ali', 'Moussa', [tel('+8615918724406', 'CN')], '2026-02-09T08:30:00Z', '2026-10-05T03:40:00Z', { site: SITE.gz_office }),
  member('u-brice', 'warehouse_agent', 'Brice', 'Ndzana', [tel('+237694523810', 'CM')], '2026-07-06T09:00:00Z', '2026-10-05T07:58:00Z', { site: SITE.douala }),
  member('u-carine', 'commercial', 'Carine', 'Ewane', [tel('+237677456789', 'CM')], '2026-10-05T14:12:00Z', null, { source: SRC_CARINE }),
  member('u-grace', 'ops', 'Grace', 'Ebogo', [tel('+237677210854', 'CM'), tel('+237696140877', 'CM', 'Orange')], '2026-01-19T09:00:00Z', '2026-10-05T13:52:00Z', { site: SITE.douala }),
  member('u-herve', 'customs_broker', 'Hervé', 'Kamga', [tel('+237699872105', 'CM')], '2026-09-21T10:00:00Z', '2026-10-03T09:20:00Z', { site: SITE.douala }),
  // Kevin vit à Guangzhou : son numéro chinois d'abord, son numéro camerounais ensuite.
  member('u-kevin', 'receptionist', 'Kevin', 'Nkolo', [tel('+8613826047731', 'CN'), tel('+237671513376', 'CM', 'MTN')], '2026-04-14T02:00:00Z', '2026-10-05T01:05:00Z', { site: SITE.gz_office }),
  member('u-nelson', 'super_admin', 'Nelson', 'Ngango', [tel('+237699401825', 'CM')], '2025-11-03T08:00:00Z', '2026-10-05T14:29:30Z', { email: 'nelson@bonzinilabs.com', site: SITE.douala }),
  member('u-rodrigue', 'commercial', 'Rodrigue', 'Tchami', [tel('+237690112233', 'CM')], '2026-10-05T08:40:00Z', '2026-10-05T12:47:00Z', { source: SRC_RODRIGUE, site: SITE.douala }),
  member('u-sandrine', 'treasurer', 'Sandrine', 'Mvogo', [tel('+237655307219', 'CM')], '2026-03-02T09:00:00Z', '2026-10-05T11:10:00Z', { site: SITE.yaounde }),
  // Désactivé avant le 06/10 : réponse ancienne, un seul numéro en texte libre.
  { ...member('u-paul', 'customer_success', 'Paul', 'Nana', [], '2026-03-23T09:00:00Z', '2026-08-27T16:20:00Z', { is_disabled: true, legacy: true }), phone: '+237 670 64 13 92' },
];

// ── Les fiches d'origine (client_sources, lues en REST) ─────────────────
// Avant la création de son accès, la fiche de Carine n'est reliée à aucun compte :
// le formulaire « Nouvel accès » la propose à reprendre (elle garde Nadia Fotso).
const source = (id, kind, label, phone, staff_user_id, o = {}) => ({
  id, kind, label, phone, staff_user_id, notes: null, is_active: true, is_system: o.is_system ?? false,
  created_by: 'u-nelson', created_at: o.created_at ?? '2026-08-01T08:00:00Z', updated_at: '2026-10-05T08:40:00Z',
});
const SOURCES = [
  source('src-rodrigue', 'commercial', 'Rodrigue Tchami', '+237 690 11 22 33', 'u-rodrigue'),
  source('src-carine', 'commercial', 'Carine Ewane', '+237 677 45 67 89', null),
  source('src-bao', 'referral', 'Bouche-à-oreille', null, null),
  source('src-facebook', 'social', 'Facebook', null, null),
  source('src-unknown', 'unknown', 'Je ne sais pas', null, null, { is_system: true }),
];

// ── Les commerciaux, octobre 2026 (5 jours écoulés) ─────────────────────
const metrics = (o) => ({
  clients: 0, new_clients: 0, active_clients: 0, payments_xaf: 0, payments_count: 0, deposits_xaf: 0, deposits_count: 0,
  air_parcels: 0, air_kg: 0, sea_parcels: 0, sea_cbm: 0, prospects_open: 0, prospects_new: 0, prospects_won: 0, prospects_due: 0, ...o,
});
const RODRIGUE_M = metrics({
  clients: 3, new_clients: 1, active_clients: 2, payments_xaf: 18750000, payments_count: 5, deposits_xaf: 20000000, deposits_count: 3,
  air_parcels: 7, air_kg: 64.5, sea_parcels: 12, sea_cbm: 2.36, prospects_open: 4, prospects_new: 3, prospects_won: 1, prospects_due: 1,
});
const CARINE_M = metrics({
  clients: 2, new_clients: 1, active_clients: 2, payments_xaf: 4200000, payments_count: 2, deposits_xaf: 5000000, deposits_count: 1,
  air_parcels: 3, air_kg: 18.6, prospects_open: 2, prospects_new: 2, prospects_due: 1,
});
// Les objectifs, triés par `metric` comme la RPC ; `actual` = le chiffre du mois.
const RODRIGUE_CARD = {
  source: SRC_RODRIGUE,
  staff: { user_id: 'u-rodrigue', name: 'Rodrigue Tchami', is_disabled: false },
  metrics: RODRIGUE_M,
  objectives: [
    { metric: 'air_kg', target: 200, actual: 64.5 },
    { metric: 'new_clients', target: 3, actual: 1 },
    { metric: 'payments_xaf', target: 50000000, actual: 18750000 },
    { metric: 'prospects_new', target: 3, actual: 3 },
    { metric: 'sea_cbm', target: 6, actual: 2.36 },
  ],
};
const CARINE_CARD = {
  source: SRC_CARINE,
  staff: { user_id: 'u-carine', name: 'Carine Ewane', is_disabled: false },
  metrics: CARINE_M,
  objectives: [
    { metric: 'new_clients', target: 2, actual: 1 },
    { metric: 'payments_xaf', target: 20000000, actual: 4200000 },
  ],
};
const CARDS = { 'src-rodrigue': RODRIGUE_CARD, 'src-carine': CARINE_CARD };

// Les clients que Rodrigue a apportés, triés par paiements du mois (commercial_clients).
const client = (user_id, name, company, customer_code, phone, created_at, o = {}) => ({
  user_id, name, company, customer_code, phone, created_at, source_set_at: created_at,
  payments_xaf: 0, payments_count: 0, air_parcels: 0, air_kg: 0, sea_parcels: 0, sea_cbm: 0, ...o,
});
const RODRIGUE_CLIENTS = [
  client('u1', 'Aïcha Mbarga', 'Mbarga Import SARL', 'BZ-482913', '+237 677 12 34 56', '2026-10-01T09:12:00Z',
    { payments_xaf: 12500000, payments_count: 3, air_parcels: 4, air_kg: 38.2, sea_parcels: 12, sea_cbm: 2.36 }),
  client('u-atangana', 'Joseph Atangana', 'Atangana Quincaillerie', 'BZ-318406', '+237 696 27 81 40', '2026-08-20T10:30:00Z',
    { payments_xaf: 6250000, payments_count: 2, air_parcels: 3, air_kg: 26.3 }),
  client('u-nkoa', 'Hélène Nkoa', 'Nkoa Beauté', 'BZ-266015', '+237 655 90 14 37', '2026-07-14T11:00:00Z'),
];
const CARINE_CLIENTS = [
  client('u3', 'Nadia Fotso', null, 'BZ-207781', '+237 699 88 77 66', '2026-10-01T13:40:00Z',
    { payments_xaf: 4200000, payments_count: 2, air_parcels: 3, air_kg: 18.6 }),
  client('u-ngono', 'Rose Ngono', 'Ngono Pagnes', 'BZ-241907', '+237 677 03 58 22', '2026-07-28T09:00:00Z'),
];

// ── Les prospects (lus en REST, filtrés par fiche) ──────────────────────
const prospect = (id, source_id, first_name, last_name, company, phone, phone_e164, city, status, created_at, o = {}) => ({
  id, source_id, first_name, last_name, company, phone, phone_e164, city,
  interests: o.interests ?? ['payments'], notes: o.notes ?? null, status,
  lost_reason: o.lost_reason ?? null, next_action_at: o.next_action_at ?? null,
  converted_user_id: o.converted_user_id ?? null, converted_at: o.converted_at ?? null,
  status_changed_at: o.status_changed_at ?? created_at, created_at, updated_at: o.status_changed_at ?? created_at,
});
const PROSPECTS = [
  prospect('pr-etoga', 'src-rodrigue', 'Paul', 'Etoga', 'Etoga Textiles', '+237 699 12 34 56', '+237699123456', 'Douala', 'new', '2026-10-03T10:15:00Z',
    { interests: ['payments', 'sea'], next_action_at: '2026-10-06T08:00:00Z' }),
  prospect('pr-tsala', 'src-rodrigue', 'Josiane', 'Tsala', null, '+237 650 33 71 08', '+237650337108', 'Bafoussam', 'new', '2026-10-02T15:40:00Z', { interests: ['air'] }),
  prospect('pr-mbida', 'src-rodrigue', 'Thierry', 'Mbida', 'Mbida Pièces Auto', '+237 691 40 22 75', '+237691402275', 'Douala', 'contacted', '2026-10-01T09:30:00Z',
    { interests: ['payments', 'sea'], next_action_at: '2026-10-08T09:00:00Z', status_changed_at: '2026-10-02T11:00:00Z' }),
  prospect('pr-abena', 'src-rodrigue', 'Mireille', 'Abena', 'Abena Cosmétiques', '+237 677 88 19 02', '+237677881902', 'Yaoundé', 'interested', '2026-09-24T14:00:00Z',
    { interests: ['payments', 'air'], next_action_at: '2026-10-05T09:00:00Z', status_changed_at: '2026-09-30T16:20:00Z' }),
  prospect('pr-mbarga', 'src-rodrigue', 'Aïcha', 'Mbarga', 'Mbarga Import SARL', '+237 677 12 34 56', '+237677123456', 'Douala', 'won', '2026-09-18T10:00:00Z',
    { interests: ['payments', 'air', 'sea'], converted_user_id: 'u1', converted_at: '2026-10-01T09:12:00Z', status_changed_at: '2026-10-01T09:12:00Z' }),
  prospect('pr-owona', 'src-rodrigue', 'Steve', 'Owona', 'Owona Électronique', '+237 698 05 46 21', '+237698054621', 'Douala', 'lost', '2026-09-10T09:00:00Z',
    { lost_reason: 'Travaille déjà avec un autre transitaire', status_changed_at: '2026-09-22T10:00:00Z' }),
  prospect('pr-bella', 'src-carine', 'Ornella', 'Bella', 'Bella Mode', '+237 696 14 52 80', '+237696145280', 'Yaoundé', 'new', '2026-10-05T14:20:00Z',
    { interests: ['payments', 'air'], next_action_at: '2026-10-05T14:20:00Z' }),
  prospect('pr-eto', 'src-carine', 'Martin', 'Eto', 'Eto Frères', '+237 677 61 09 33', '+237677610933', 'Douala', 'new', '2026-10-05T14:21:00Z', { interests: ['sea'] }),
];

// ── Écrans, dans l'ordre de l'histoire ──────────────────────────────────
// DM Sans servie en local (paquet @fontsource, via Vite) à la place de Google Fonts :
// sans cela, la feuille de Google échoue souvent derrière le proxy et la page
// retombe sur une police système.
const FONT_CSS = [400, 500, 600, 700, 800, 900]
  .map((w) => `@font-face{font-family:'DM Sans';font-style:normal;font-weight:${w};font-display:block;src:url(http://localhost:8080/node_modules/@fontsource/dm-sans/files/dm-sans-latin-${w}-normal.woff2) format('woff2');}`)
  .join('\n');

const init = async (page) => {
  await page.route(/fonts\.googleapis\.com\/css2/, (r) => r.fulfill({ status: 200, contentType: 'text/css', headers: { 'access-control-allow-origin': '*' }, body: FONT_CSS }));
  await page.clock.setFixedTime(new Date(NOW));
  // La proposition de clé d'accès ne doit pas couvrir l'écran.
  await page.addInitScript(() => {
    try { localStorage.setItem('bonzini-admin-passkey-snooze', String(Date.UTC(2027, 0, 1))); } catch { /* privé */ }
  });
};

// TextField pose l'id sur son <input> : l'étiquette est reliée au champ.
const field = (page, label) => page.getByLabel(label, { exact: true });

const blur = (page) => page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined));

/** Remplit le formulaire « Nouvel accès » pour Carine Ewane, en reprenant sa fiche existante. */
async function fillCarine(page) {
  await field(page, 'Prénom').fill('Carine');
  await field(page, 'Nom').fill('Ewane');
  await field(page, 'Email (sert à se connecter)').fill('carine.ewane@bonzinilabs.com');
  // L'éditeur de numéros : indicatif +237 (Cameroun) par défaut, le numéro se formate à la frappe.
  await page.locator('#team-phone-0').fill('677456789');
  await page.getByRole('button', { name: /Reprendre une fiche existante/ }).click();
  await page.getByRole('button', { name: /Carine Ewane/ }).click();
  await blur(page);
}

/** Choisit un pays dans le sélecteur ouvert (recherche, puis la ligne du pays). */
async function pickCountry(page, search, name) {
  await page.getByPlaceholder('Rechercher un pays, un code ou un indicatif…').fill(search);
  await page.getByRole('option', { name: new RegExp(name) }).first().click();
}

/**
 * « Nouvel accès » d'un réceptionnaire, Joël Essomba : le site proposé est
 * « Guangzhou · bureau » ; deux numéros — camerounais (principal) et chinois
 * (« WeChat »).
 */
async function fillJoel(page) {
  await field(page, 'Prénom').fill('Joël');
  await field(page, 'Nom').fill('Essomba');
  await field(page, 'Email (sert à se connecter)').fill('joel.essomba@bonzinilabs.com');
  await page.locator('#team-phone-0').fill('677214598');
  await page.getByRole('button', { name: 'Ajouter un numéro' }).click();
  await page.getByRole('button', { name: 'Indicatif' }).nth(1).click();
  await pickCountry(page, 'chine', 'Chine');
  await page.locator('#team-phone-1').fill('13922145530');
  await page.getByRole('button', { name: 'Autre…' }).click();
  await page.getByPlaceholder('Votre libellé : WeChat, Maison…').fill('WeChat');
  await blur(page);
}

async function createJoel(page) {
  await fillJoel(page);
  await page.getByRole('button', { name: 'Créer l’accès' }).click();
  await page.getByText('Mot de passe provisoire', { exact: true }).waitFor({ timeout: 5000 });
}

async function createCarine(page) {
  await fillCarine(page);
  await page.getByRole('button', { name: 'Créer l’accès' }).click();
  await page.getByText('Mot de passe provisoire', { exact: true }).waitFor({ timeout: 5000 });
}

// Les polices viennent de Google Fonts : si le chargement échoue (ERR_TOO_MANY_RETRIES),
// la page retombe sur une police système. On recharge alors, trois fois au plus.
async function ensureFonts(page) {
  for (let i = 0; i < 3; i += 1) {
    const ok = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some((f) => f.family.includes('DM Sans') && f.status === 'loaded');
    });
    if (ok) return;
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
  }
}

// Ordinateur : la hauteur de la fenêtre suit celle de l'écran, pour que la barre
// latérale (fixe) descende jusqu'en bas de la capture.
// Téléphone : 390 de large ; la liste prend toute sa hauteur, barre d'onglets en bas.
const LIST = [
  {
    key: 'j.teams.list-desk', name: '01-equipes-ordinateur', desktop: true, viewport: '1440x1682',
    before: async (page) => { await page.getByRole('button', { name: /Voir les désactivés/ }).click(); },
  },
  { key: 'j.teams.list-phone', name: '02-equipes-telephone', viewport: '390x2177' },
  { key: 'j.teams.new-roles', name: '03a-nouvel-acces-roles', desktop: true, viewport: '1440x1455' },
  { key: 'j.teams.new-desk', name: '03b-nouvel-acces-commercial', desktop: true, viewport: '1440x1265', before: fillCarine },
  { key: 'j.teams.new-reception-desk', name: '03c-nouvel-acces-reception-numeros-site', desktop: true, viewport: '1440x1260', before: fillJoel },
  { key: 'j.teams.new-reception-phone', name: '03d-nouvel-acces-reception-telephone', before: fillJoel },
  {
    key: 'j.teams.new-reception-desk', name: '03e-ajouter-un-site', desktop: true, viewport: '1440x1150',
    before: async (page) => {
      await page.getByRole('button', { name: 'Ajouter un site…' }).click();
      await field(page, 'Nom du site').fill('Bafoussam');
      await page.locator('#team-site-country').click();
      await pickCountry(page, 'camer', 'Cameroun');
      await blur(page);
    },
  },
  { key: 'j.teams.new-desk', name: '04-acces-cree', desktop: true, fullPage: false, before: createCarine },
  { key: 'j.teams.new-reception-desk', name: '04b-acces-cree-reception', desktop: true, fullPage: false, before: createJoel },
  {
    // Les numéros et le site n'ont pas suivi : l'accès existe, l'écran de fin le dit.
    key: 'j.teams.new-reception-desk', name: '04c-acces-cree-profil-en-echec', desktop: true, fullPage: false,
    before: async (page) => {
      await page.route(/\/rpc\/team_set_member_profile/, (r) => r.fulfill({
        status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ success: false, error: 'Numéro invalide' }),
      }));
      await createJoel(page);
    },
  },
  { key: 'j.teams.member-desk', name: '05a-fiche-rodrigue', desktop: true, viewport: '1440x1005' },
  { key: 'j.teams.member-kevin', name: '05b-fiche-kevin-telephone' },
  { key: 'j.teams.member-kevin-desk', name: '05c-fiche-kevin-ordinateur', desktop: true, viewport: '1440x920' },
  {
    key: 'j.teams.member-kevin', name: '05d-modifier-kevin-telephone', viewport: '390x1500', fullPage: false,
    before: async (page) => { await page.getByRole('button', { name: 'Modifier', exact: true }).click(); },
  },
  { key: 'j.teams.member-paul', name: '05e-fiche-paul-ancienne-reponse', viewport: '390x844' },
  { key: 'j.teams.sales-desk', name: '06a-chiffres-commerciaux-ordinateur', desktop: true, viewport: '1440x1140' },
  { key: 'j.teams.sales-phone', name: '06b-chiffres-commerciaux-telephone' },
  { key: 'j.teams.commercial-desk', name: '07a-commercial-rodrigue', desktop: true, viewport: '1440x1467' },
  {
    key: 'j.teams.commercial-desk', name: '07b-objectifs-rodrigue', desktop: true, fullPage: false,
    before: async (page) => { await page.getByRole('button', { name: 'Modifier', exact: true }).click(); },
  },
  { key: 'j.teams.commercial-phone', name: '07c-commercial-rodrigue-telephone' },
];

export const SCREENS = LIST.map((s) => ({
  fullPage: true,
  ...s,
  init,
  before: async (page) => {
    await ensureFonts(page);
    if (s.before) await s.before(page);
  },
}));

// ── Réponses des RPC ────────────────────────────────────────────────────
const MONTH = '2026-10-01';
export const RPC = {
  team_members: { success: true, rows: TEAM },
  team_sites: { success: true, sites: SITES },
  team_create_site: (b) => ({ success: true, id: 'site-new', label: String(b?.p_label ?? 'Bafoussam') }),
  team_set_member_profile: (b) => ({ success: true, phone: b?.p_phones?.[0]?.phone_e164 ?? null }),
  team_create_member: (b) => ({
    success: true,
    userId: String(b?.p_email ?? '').includes('essomba') ? 'u-joel' : 'u-carine',
    email: String(b?.p_email ?? 'carine.ewane@bonzinilabs.com').trim().toLowerCase(),
    tempPassword: '7c4e19ab52f0',
    message: `Admin ${b?.p_first_name ?? 'Carine'} ${b?.p_last_name ?? 'Ewane'} créé avec succès`,
    sourceId: b?.p_role === 'commercial' ? (b?.p_source_id ?? 'src-carine') : null,
  }),
  team_update_member: (b) => ({ success: true, role: b?.p_role ?? 'commercial' }),
  team_link_commercial: (b) => ({ success: true, source_id: b?.p_source_id ?? 'src-carine', label: 'Carine Ewane' }),
  commercial_dashboard: (b) => {
    const card = CARDS[b?.p_source_id ?? 'src-rodrigue'];
    return card ? { success: true, month: b?.p_month ?? MONTH, ...card } : { success: false, error: 'Commercial introuvable' };
  },
  commercial_clients: (b) => ({ success: true, month: b?.p_month ?? MONTH, rows: b?.p_source_id === 'src-carine' ? CARINE_CLIENTS : RODRIGUE_CLIENTS }),
  // Ordre de la RPC : fiches reliées d'abord, actives, puis par libellé.
  sales_overview: (b) => ({ success: true, month: b?.p_month ?? MONTH, rows: [CARINE_CARD, RODRIGUE_CARD] }),
  set_commercial_objective: { success: true },
  prospect_reassign: { success: true },
};

// ── Lectures directes des tables ────────────────────────────────────────
export function REST(url) {
  const u = decodeURIComponent(url);
  if (/\/rest\/v1\/client_sources\b/.test(u)) {
    return u.includes('is_active=eq.true') ? SOURCES.filter((s) => s.is_active) : SOURCES;
  }
  if (/\/rest\/v1\/prospects\b/.test(u)) {
    const src = /source_id=eq\.([\w-]+)/.exec(u)?.[1];
    const rows = src ? PROSPECTS.filter((p) => p.source_id === src) : PROSPECTS;
    return [...rows].sort((a, b) => b.status_changed_at.localeCompare(a.status_changed_at));
  }
  return undefined;
}
