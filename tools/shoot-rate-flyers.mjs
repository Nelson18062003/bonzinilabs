// Maquettes du flyer « Taux du jour » v2 (phase 13) — PNG 2160×2700.
//   node tools/shoot-rate-flyers.mjs <out-dir> [variant:country[:diverge|:flat] …]
//   variant « app » = le vrai flyer de l'app ; les autres = maquettes de rateFlyerV2.tsx.
// Serveur : npx vite --host --port 8080 (variables Supabase factices suffisent).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] ?? 'tools/out/rate-flyers';
const SHOTS = process.argv.slice(3);
const PORT = process.env.PORT || '8080';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2, locale: 'fr-FR' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
for (const s of SHOTS) {
  const [variant, country, flag] = s.split(':');
  const q = new URLSearchParams({ variant, country });
  if (flag) q.set(flag, '1');
  if (variant === 'app') {
    // app:<pays>[:flat] — le VRAI flyer de l'app (RateFlyer + buildFlyerData).
    await page.goto(`http://127.0.0.1:${PORT}/flyer-real-preview.html?country=${country}${flag === 'flat' ? '&flat=1' : ''}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const name = `app-${country}${flag ? '-' + flag : ''}.png`;
    await page.locator('#flyer').screenshot({ path: join(OUT, name) });
    console.log('OK', name);
    continue;
  }
  await page.goto(`http://127.0.0.1:${PORT}/rate-flyer-v2.html?${q}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const name = `${variant}-${country}${flag ? '-' + flag : ''}.png`;
  await page.locator('#flyer').screenshot({ path: join(OUT, name) });
  console.log('OK', name);
}
if (errors.length) console.log('ERRORS', errors.slice(0, 5));
await b.close();
