import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
// Réutilise le routage des fixtures de tools/audit-mobile.mjs
const src = readFileSync('tools/audit-mobile.mjs', 'utf8');
const ROUTES = ['m', 'm/ops', 'm/deposits/d5', 'm/deposits/new', 'm/payments/p3', 'm/payments/new', 'm/clients', 'm/clients/u5', 'm/clients/u5/ledger', 'm/clients/scan', 'm/assistant', 'm/more', 'm/more/rates', 'm/more/shipping', 'm/dashboard', 'm/cargo', 'm/cargo/track', 'm/cargo/2', 'm/cargo/2/suivi', 'm/cargo/2/documents', 'm/cargo/2/couts', 'm/cargo/cout'];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const port = process.env.PORT ?? '8093';
for (const w of [320, 390]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 700 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR' });
  const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS,PATCH,DELETE,HEAD', 'access-control-expose-headers': 'content-range' };
  const mod = await import('../tools/adminFixtures.mjs').catch(() => null);
  if (mod) await ctx.route('**/*supabase.co/**', (route) => { const req = route.request(); if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS, body: '' }); const url = req.url(); if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { ...CORS, 'content-range': `0-0/${mod.headCount(url)}` }, body: '' }); if (req.method() === 'GET' && url.includes('/storage/v1/object/fake/')) return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'image/svg+xml' }, body: url.includes('qr') ? mod.qrSvg : mod.proofSvg }); let body = mod.respond(url); const accept = req.headers()['accept'] ?? ''; if (accept.includes('pgrst.object') && Array.isArray(body)) body = body[0] ?? null; return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json', 'content-range': `0-9/${Array.isArray(body) ? body.length : 1}` }, body: JSON.stringify(body ?? null) }); });
  await ctx.route(/openfreemap|tiles\./, (r) => r.fulfill({ status: 204, body: '' }));
  const bad = [];
  for (const r of ROUTES) {
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message.slice(0, 80)));
    await page.goto(`http://127.0.0.1:${port}/${r}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500);
    const m = await page.evaluate(() => { const sw = document.documentElement.scrollWidth, iw = window.innerWidth; const over = [...document.querySelectorAll('body *')].filter((el) => { const b = el.getBoundingClientRect(); return b.width > 0 && b.right > iw + 1 && getComputedStyle(el).position !== 'fixed'; }).slice(0, 3).map((el) => el.tagName + '.' + String(el.className).slice(0, 40) + ' "' + (el.textContent || '').trim().slice(0, 30) + '"'); const trunc = [...document.querySelectorAll('body *')].filter((el) => getComputedStyle(el).textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1).map((el) => (el.textContent || '').trim().slice(0, 30)).slice(0, 4); return { sw, iw, over, trunc }; });
    if (m.sw > m.iw + 1 || m.over.length || m.trunc.length || errs.length) bad.push(`${w} ${r}: sw=${m.sw}/${m.iw} over=[${m.over.join(' ; ')}] trunc=[${m.trunc.join(' ; ')}] err=${errs.join('|')}`);
    await page.close();
  }
  console.log(`== ${w}px : ${bad.length} écrans à problème`); bad.forEach((b) => console.log('  ' + b));
  await ctx.close();
}
await browser.close();
