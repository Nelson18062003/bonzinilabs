import { chromium } from 'playwright';
const OUT = process.env.OUT; const mod = await import('../tools/adminFixtures.mjs');
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS,PATCH,DELETE,HEAD', 'access-control-expose-headers': 'content-range' };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
for (const [route, w, dark, name] of [['m/more/rates', 320, false, 'rates320'], ['m/cargo/2/documents', 320, false, 'docs320'], ['m/payments/new', 390, true, 'paynew-dark'], ['m/clients/u5', 320, false, 'client320'], ['m/cargo/2', 390, true, 'cargo-dark']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', colorScheme: dark ? 'dark' : 'light' });
  await ctx.route('**/*supabase.co/**', (route) => { const req = route.request(); if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS, body: '' }); const url = req.url(); if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { ...CORS, 'content-range': `0-0/${mod.headCount(url)}` }, body: '' }); if (req.method() === 'GET' && url.includes('/storage/v1/object/fake/')) return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'image/svg+xml' }, body: url.includes('qr') ? mod.qrSvg : mod.proofSvg }); let body = mod.respond(url); const accept = req.headers()['accept'] ?? ''; if (accept.includes('pgrst.object') && Array.isArray(body)) body = body[0] ?? null; return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json', 'content-range': `0-9/${Array.isArray(body) ? body.length : 1}` }, body: JSON.stringify(body ?? null) }); });
  const page = await ctx.newPage(); await page.goto(`http://127.0.0.1:8093/${route}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
  if (name === 'docs320') { const f = page.getByText('Les papiers', { exact: true }).first(); await f.scrollIntoViewIfNeeded().catch(() => null); }
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: name !== 'paynew-dark' && name !== 'cargo-dark' }); await ctx.close();
}
await browser.close(); console.log('ok');
