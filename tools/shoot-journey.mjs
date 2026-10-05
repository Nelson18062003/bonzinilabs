// ============================================================
// Captures du parcours complet (05/10/2026) — un domaine à la fois :
//   node tools/shoot-journey.mjs <domaine> [écran…]
// Domaines : teams, sales, guangzhou, expedition, douala (tools/journey/<domaine>.mjs).
// Serveur à lancer d'abord (données de démonstration, rien de réel contacté) :
//   VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=x VITE_SUPABASE_PROJECT_ID=x npx vite --host --port 8080
//
// Le module de domaine exporte :
//   SCREENS : [{ key, name?, desktop?, role?, lang?, viewport?, fullPage?, init?(page), before?(page), wait? }]
//             key = « j.<domaine>.<écran> », entrée de src/__screenshot__/journey/<domaine>.tsx ;
//             name = nom du fichier (défaut : key)
//   RPC     : { nom_rpc: objet | (corps) => objet }   — réponses des RPC (POST /rest/v1/rpc/<nom>)
//   REST?   : (url, méthode) => lignes | undefined   — lectures directes des tables (GET /rest/v1/<table>)
// Les captures vont dans tools/out/journey/<domaine>/<name>.png (OUT pour changer).
// ============================================================
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { respond as adminRespond } from './adminFixtures.mjs';

const DOMAIN = process.argv[2];
if (!DOMAIN) { console.error('usage : node tools/shoot-journey.mjs <domaine> [écran…]'); process.exit(1); }
const ONLY = process.argv.slice(3);
const mod = await import(`./journey/${DOMAIN}.mjs`);
const OUT = process.env.OUT ?? join('tools/out/journey', DOMAIN);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const contexts = new Map();

async function contextFor(s) {
  const k = `${s.desktop ? 'd' : 'm'}:${s.viewport ?? ''}:${s.lang ?? 'fr'}`;
  if (contexts.has(k)) return contexts.get(k);
  const [vw, vh] = (s.viewport ?? (s.desktop ? '1440x900' : '390x844')).split('x').map(Number);
  const ctx = await browser.newContext(s.desktop
    ? { viewport: { width: vw, height: vh }, deviceScaleFactor: 1.5, ignoreHTTPSErrors: true, permissions: ['clipboard-read', 'clipboard-write'] }
    : { viewport: { width: vw, height: vh }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true, permissions: ['camera', 'clipboard-read', 'clipboard-write'] });
  await ctx.addInitScript((lang) => { try { localStorage.setItem('bonzini-language', lang); } catch { /* privé */ } }, s.lang ?? 'fr');
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
  // Le générique d'abord : Playwright sert la DERNIÈRE route enregistrée qui correspond.
  await ctx.route(/supabase\.co|\/rest\/v1|\/auth\/v1|\/storage\/v1|\/functions\/v1/, (r) => {
    const req = r.request();
    if (req.method() === 'OPTIONS' || req.method() === 'HEAD') return r.fulfill({ status: 200, headers: { ...cors, 'content-range': '0-0/0' }, body: '' });
    let body;
    try { body = mod.REST?.(req.url(), req.method()); } catch (e) { console.log('REST fixture error', e.message); }
    if (body === undefined) { try { body = adminRespond(req.url()) ?? []; } catch { body = []; } }
    if ((req.headers()['accept'] ?? '').includes('pgrst.object') && Array.isArray(body)) body = body[0] ?? null;
    r.fulfill({ status: 200, contentType: 'application/json', headers: { ...cors, 'content-range': `0-9/${Array.isArray(body) ? body.length : 1}` }, body: JSON.stringify(body) });
  });
  await ctx.route(/\/rest\/v1\/rpc\/(\w+)/, async (route) => {
    const name = /\/rpc\/(\w+)/.exec(route.request().url())?.[1];
    let body = {};
    try { body = route.request().postDataJSON?.() ?? {}; } catch { body = {}; }
    const fx = mod.RPC?.[name];
    let json;
    try { json = typeof fx === 'function' ? await fx(body) : fx; } catch (e) { json = { success: false, error: `fixture en erreur : ${name} (${e.message})` }; }
    if (json === undefined) { console.log(`  · RPC sans données : ${name}`); json = { success: false, error: `fixture manquante : ${name}` }; }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(json) });
  });
  contexts.set(k, ctx);
  return ctx;
}

const list = (mod.SCREENS ?? []).filter((s) => !ONLY.length || ONLY.includes(s.key) || ONLY.includes(s.name));
for (const s of list) {
  const ctx = await contextFor(s);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  if (s.init) await s.init(page);
  const url = `http://localhost:8080/screenshot.html?screen=${encodeURIComponent(s.key)}&theme=light${s.role ? `&role=${s.role}` : ''}${s.query ?? ''}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(s.wait ?? 700);
  if (s.before) { try { await s.before(page); } catch (e) { errors.push(`before(): ${e.message}`); } }
  await page.waitForTimeout(300);
  const file = join(OUT, `${s.name ?? s.key}.png`);
  await page.screenshot({ path: file, fullPage: s.fullPage ?? !s.desktop });
  console.log(`${file}${errors.length ? `   ⚠ ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await page.close();
}
await browser.close();
