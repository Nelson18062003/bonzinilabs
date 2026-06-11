// Pilote le wizard Nouveau paiement (chemin cash + moi-même → atteint toutes
// les étapes + succès) et capture chaque étape. Session + Supabase simulés.
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

mkdirSync('shots', { recursive: true });
const PORT = process.env.PORT || '8080';
const iPhone = devices['iPhone 14'];
const USER_ID = '11111111-1111-1111-1111-111111111111';
const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
const jwt = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: USER_ID, role: 'authenticated', aud: 'authenticated', exp })}.x`;
const USER = { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'papa@x.cm', app_metadata: { provider: 'email' }, user_metadata: {}, identities: [], created_at: '2025-01-01T00:00:00Z' };
const SESSION = { access_token: jwt, token_type: 'bearer', expires_in: 31536000, expires_at: exp, refresh_token: 'r', user: USER };
const CLIENT = { id: 'c1', user_id: USER_ID, first_name: 'Papa', last_name: 'Nguemo', email: 'papa@x.cm', phone: '+237 652 236 856', country: 'Cameroun', kyc_status: 'verified', created_at: '2025-01-01', updated_at: '2025-01-01' };
const WALLET = { id: 'w1', user_id: USER_ID, client_id: 'c1', balance_xaf: 4250000, currency: 'XAF' };
const DAILY_RATE = { id: 'r1', is_active: true, rate_cash: 11530, rate_alipay: 11480, rate_wechat: 11350, rate_virement: 11200, effective_at: '2026-06-10', created_at: '2026-06-10' };
const ADJ = [{ id: 'a1', type: 'country', key: 'cameroun', label: 'Cameroun', percentage: 0, is_reference: true, sort_order: 0 }, { id: 'a2', type: 'tier', key: 't3', label: '>=1M', percentage: 0, is_reference: true, sort_order: 0 }];
const CONV = { id: 'cv1', client_id: 'c1', subject: null, unread_count_client: 0, last_message_at: null, status: 'open', created_at: '2026-01-01', updated_at: '2026-01-01' };

function fixtureFor(url, headers) {
  const single = (headers['accept'] || '').includes('vnd.pgrst.object');
  const t = (n) => url.includes(`/rest/v1/${n}`);
  if (t('clients')) return single ? CLIENT : [CLIENT];
  if (t('wallets')) return single ? WALLET : [WALLET];
  if (t('daily_rates')) return single ? DAILY_RATE : [DAILY_RATE];
  if (t('rate_adjustments')) return ADJ;
  if (t('chat_conversations')) return single ? CONV : [CONV];
  if (t('beneficiaries')) return [];
  if (t('notifications')) return [];
  if (t('payments')) return single ? {} : [];
  if (url.includes('/rest/v1/rpc/')) return { success: true, payment_id: 'newp1', reference: 'BZ-PM-9999', new_balance: 1750000 };
  return single ? null : [];
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...iPhone, colorScheme: 'light', locale: 'fr-FR' });
await ctx.addInitScript((s) => { localStorage.setItem('bonzini-client-auth', JSON.stringify(s)); localStorage.setItem('theme', 'light'); }, SESSION);
await ctx.route('**/dummy.supabase.co/**', (route) => {
  const req = route.request(); const url = req.url();
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
  if (url.includes('/auth/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', body: url.includes('/user') ? JSON.stringify(USER) : JSON.stringify(SESSION) });
  return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': url.includes('notifications') ? '*/0' : '0-9/10' }, body: JSON.stringify(fixtureFor(url, req.headers())) });
});
const page = await ctx.newPage();
const shot = async (n) => { await page.waitForTimeout(500); await page.screenshot({ path: `shots/wizard-${n}.png`, fullPage: true }); console.log(`✓ wizard-${n}.png`); };

await page.goto(`http://127.0.0.1:${PORT}/payments/new`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(900);

// Étape MÉTHODE → Cash
await page.getByRole('button', { name: /Cash/ }).first().click();
await page.getByRole('button', { name: /Continuer/ }).click();
// Étape MONTANT
await page.locator('input[inputmode="numeric"]').first().fill('2500000');
await shot('2-montant');
await page.getByRole('button', { name: /Continuer/ }).click();
// Étape BÉNÉFICIAIRE (cash) → onglet Nouveau → Moi-même
await page.waitForTimeout(400);
await page.getByRole('button', { name: /Nouveau/ }).click().catch(() => {});
await page.getByRole('button', { name: /moi-même|Moi-même/ }).first().click().catch(() => {});
await shot('3-beneficiaire');
await page.getByRole('button', { name: /Continuer/ }).click();
// Étape CONFIRMATION
await shot('4-confirmation');
await page.getByRole('button', { name: /Confirmer le paiement/ }).click().catch(() => {});
await page.waitForTimeout(900);
await shot('5-succes');

await browser.close();
console.log('done');
