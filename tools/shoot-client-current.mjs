// Capture les ÉCRANS RÉELS ACTUELS de l'app CLIENT (pas des maquettes) pour
// voir l'état présent. Aucune modif de source : on amorce une session client
// factice dans localStorage (storageKey bonzini-client-auth) puis on intercepte
// TOUT Supabase (domaine dummy → aucun réseau réel) avec des fixtures.
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

mkdirSync('shots', { recursive: true });
const PORT = process.env.PORT || '8080';
const iPhone = devices['iPhone 14'];

const USER_ID = '11111111-1111-1111-1111-111111111111';
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
const jwt = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: USER_ID, role: 'authenticated', aud: 'authenticated', exp })}.x`;
const USER = {
  id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'papa.nguemo@example.cm',
  email_confirmed_at: '2025-01-01T00:00:00Z', phone: '', app_metadata: { provider: 'email' },
  user_metadata: { first_name: 'Papa', last_name: 'Nguemo' }, identities: [], created_at: '2025-01-01T00:00:00Z',
};
const SESSION = { access_token: jwt, token_type: 'bearer', expires_in: 31536000, expires_at: exp, refresh_token: 'fake-refresh', user: USER };

const iso = (d) => new Date(Date.now() - d * 36e5).toISOString();
const CLIENT = {
  id: 'c1', user_id: USER_ID, first_name: 'Papa', last_name: 'Nguemo', email: 'papa.nguemo@example.cm',
  phone: '+237 652 236 856', avatar_url: null, date_of_birth: null, company_name: 'Nguemo Import',
  activity_sector: 'Textile', neighborhood: 'Akwa', city: 'Douala', country: 'Cameroun', country_key: 'cameroun',
  kyc_status: 'verified', created_at: iso(9000), updated_at: iso(10),
};
const WALLET = { id: 'w1', user_id: USER_ID, client_id: 'c1', balance_xaf: 4250000, currency: 'XAF', created_at: iso(9000), updated_at: iso(2) };
const PAYMENTS = [
  { id: 'p1', user_id: USER_ID, reference: 'BZ-PM-2401', status: 'processing', method: 'alipay', amount_xaf: 2500000, amount_rmb: 28825, exchange_rate: 11530, beneficiary_name: 'Guangzhou Textile Co.', created_at: iso(4), updated_at: iso(1) },
  { id: 'p2', user_id: USER_ID, reference: 'BZ-PM-2398', status: 'completed', method: 'wechat', amount_xaf: 850000, amount_rmb: 9648, exchange_rate: 11350, beneficiary_name: 'Shenzhen Electronics', created_at: iso(28), updated_at: iso(20) },
  { id: 'p3', user_id: USER_ID, reference: 'BZ-PM-2395', status: 'cash_pending', method: 'cash', amount_xaf: 1200000, amount_rmb: 13836, exchange_rate: 11530, beneficiary_name: null, created_at: iso(30), updated_at: iso(26) },
  { id: 'p4', user_id: USER_ID, reference: 'BZ-PM-2390', status: 'waiting_beneficiary_info', method: 'bank_transfer', amount_xaf: 4000000, amount_rmb: 44800, exchange_rate: 11200, beneficiary_name: null, created_at: iso(72), updated_at: iso(70) },
];
const DAILY_RATE = { id: 'r1', is_active: true, rate_cash: 11530, rate_alipay: 11480, rate_wechat: 11350, rate_virement: 11200, effective_at: iso(6), created_at: iso(6) };
const ADJUSTMENTS = [
  { id: 'a1', type: 'country', key: 'cameroun', label: 'Cameroun', percentage: 0, is_reference: true, sort_order: 0 },
  { id: 'a2', type: 'tier', key: 't3', label: '>= 1M', percentage: 0, is_reference: true, sort_order: 0 },
];
// Conversation chat « vide » → empêche l'auto-insert du hook (qui crashait BottomNav).
const CONV = { id: 'cv1', client_id: 'c1', subject: null, unread_count_client: 0, unread_count_admin: 0, last_message_at: null, status: 'open', created_at: iso(100), updated_at: iso(100) };

// Renvoie un objet (maybeSingle) ou un tableau selon la table + l'entête Accept.
function fixtureFor(url, headers) {
  const single = (headers['accept'] || '').includes('vnd.pgrst.object');
  const t = (name) => url.includes(`/rest/v1/${name}`);
  if (t('clients')) return single ? CLIENT : [CLIENT];
  if (t('wallets')) return single ? WALLET : [WALLET];
  if (t('payments')) return single ? PAYMENTS[0] : PAYMENTS;
  if (t('daily_rates')) return single ? DAILY_RATE : [DAILY_RATE];
  if (t('rate_adjustments')) return ADJUSTMENTS;
  if (t('chat_conversations')) return single ? CONV : [CONV];
  if (t('beneficiaries')) return [];
  if (t('notifications')) return [];
  if (url.includes('/rest/v1/rpc/')) return single ? {} : [];
  return single ? null : [];
}

const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ ...iPhone, colorScheme: theme, locale: 'fr-FR' });
    // Amorce session + thème AVANT le boot de l'app.
    await ctx.addInitScript(([session, th]) => {
      localStorage.setItem('bonzini-client-auth', JSON.stringify(session));
      localStorage.setItem('theme', th);
    }, [SESSION, theme]);

    // Intercepte tout Supabase (domaine dummy).
    await ctx.route('**/dummy.supabase.co/**', (route) => {
      const req = route.request();
      const url = req.url();
      const headers = req.headers();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
      if (url.includes('/auth/v1/')) {
        if (url.includes('/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USER) });
        if (url.includes('/token')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESSION) });
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
      const body = fixtureFor(url, headers);
      // Compteur de notifications non lues → 0 (sinon badge parasite).
      const range = url.includes('/rest/v1/notifications') ? '*/0' : '0-25/26';
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': range }, body: JSON.stringify(body) });
    });

    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') console.log('  [console.error]', m.text().slice(0, 140)); });

    for (const [slug, path] of [['list', '/payments'], ['new', '/payments/new'], ['detail', '/payments/p1']]) {
      await page.goto(`http://127.0.0.1:${PORT}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `shots/client-current-${slug}-${theme}.png`, fullPage: true });
      console.log(`✓ client-current-${slug}-${theme}.png`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log('done');
