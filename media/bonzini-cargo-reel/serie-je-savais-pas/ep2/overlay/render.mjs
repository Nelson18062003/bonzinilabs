// « TU PAIES DE L'AIR. » (ep2) — copied from « PAS REÇU. » (v3) as is, font preload list extended to every family declared in engine.html.
// usage: node render.mjs [start end] [--times a,b] [--frames a,b] [--out ../out/frames] [--pages 3] [--mb 3] [--jpg] [--scenes 20_billet,30_costs]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
const HERE = path.dirname(url.fileURLToPath(import.meta.url)); const F = path.resolve(HERE, '..');
const args = process.argv.slice(2); const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const CUT = (() => { const i = process.argv.indexOf('--cut'); return i >= 0 ? process.argv[i + 1] : 'main'; })();
const tl = JSON.parse(fs.readFileSync(path.join(F, `data/timeline_${CUT}.json`), 'utf8'));
const GRID = fs.existsSync(path.join(F, `data/grid_${CUT}.json`)) ? JSON.parse(fs.readFileSync(path.join(F, `data/grid_${CUT}.json`), 'utf8')) : [];
const CAPMETA = fs.existsSync(path.join(F, 'data/cap_meta.json')) ? JSON.parse(fs.readFileSync(path.join(F, 'data/cap_meta.json'), 'utf8')) : {};
let frames = Array.from({ length: (+(pos[1] ?? tl.frames - 1)) - (+(pos[0] ?? 0)) + 1 }, (_, i) => +(pos[0] ?? 0) + i);
if (opt('--frames')) frames = opt('--frames').split(',').map(Number);
if (opt('--times')) frames = opt('--times').split(',').map(x => Math.round(+x * 30));
const OUT = path.resolve(HERE, opt('--out', '../out/frames')); fs.mkdirSync(OUT, { recursive: true });
const PAGES = +opt('--pages', 3), MB = +opt('--mb', 1), JPG = args.includes('--jpg');
const svg = fs.readFileSync(path.join(F, 'assets/logo.svg'), 'utf8');
const logo = [...svg.matchAll(/<path\s+d="([^"]+)"[^>]*fill="([^"]+)"/g)].map(m => { const ys = [...m[1].matchAll(/[-\d.]+,([-\d.]+)/g)].map(q => +q[1]); return { d: m[1], fill: m[2], cy: ys.reduce((a, b) => a + b, 0) / ys.length }; });
let files = fs.readdirSync(path.join(HERE, 'scenes')).filter(f => f.endsWith('.js') && !f.startsWith('zz_')).sort();
// --scenes 30_costs,15_junior : load only the shared kit (0x_), the listed scenes, wipes (80_) and captions (90_)
if (opt('--scenes')) { const want = opt('--scenes').split(','); files = files.filter(f => /^[01]\d_|^80_|^90_/.test(f) || want.some(w => f.includes(w))); }
// illustrations: every image under assets/img (recursive) is handed to the page as a data URL (keeps the canvas untainted),
// keyed by its relative path without extension, e.g. IMG['bg/mboppi_rue'], IMG['cast/junior_2']
const IDIR = path.join(F, 'assets/img');
const walk = d => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]) : [];
const photos = walk(IDIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).map(f => ({ name: path.relative(IDIR, f).replace(/\.[^.]+$/, '').split(path.sep).join('/'),
  url: `data:image/${/png$/i.test(f) ? 'png' : /webp$/i.test(f) ? 'webp' : 'jpeg'};base64,` + fs.readFileSync(f).toString('base64') }));
const TIMING = fs.existsSync(path.join(F, 'data/timing.json')) ? JSON.parse(fs.readFileSync(path.join(F, 'data/timing.json'), 'utf8')) : null;
const GEO = fs.existsSync(path.join(F, 'data/geo_cmr.json')) ? JSON.parse(fs.readFileSync(path.join(F, 'data/geo_cmr.json'), 'utf8')) : null;
const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });
const t0 = Date.now(); let done = 0;
const CUES = {};
await Promise.all(Array.from({ length: PAGES }, async (_, w) => {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message)); page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await page.goto(url.pathToFileURL(path.join(HERE, 'engine.html')).href);
  if (TIMING) await page.evaluate(tm => { window.TIMING = tm; }, TIMING);          // voice-retimed key moments, read by 01_score.js at load
  for (const f of files) await page.addScriptTag({ path: path.join(HERE, 'scenes', f) });
  await page.evaluate(async () => { for (const f of ['400 10px CaveatBrush', '700 10px Brico', '800 10px Brico', '400 10px Martian', '700 10px Martian', '800 10px Stencil', '900 10px Stencil', '400 10px Satoshi', '500 10px Satoshi', '700 10px Satoshi', '900 10px Satoshi', '800 10px DMSans', '700 10px Shantell', '800 10px Shantell', '400 10px Kalam', '700 10px Kalam', '400 10px PatrickHand', '400 10px GochiHand', '400 10px Bangers']) await document.fonts.load(f); await document.fonts.ready; });
  await page.evaluate(g => { window.GEO_CMR = g; }, GEO);
  for (const p of photos) {                        // one by one: decoding ~40 large photos at once fails under memory pressure
    const err = await page.evaluate(async (p) => { window.IMG = window.IMG || {}; const im = new Image(); im.src = p.url;
      for (let k = 0; k < 3; k++) { try { await im.decode(); window.IMG[p.name] = im; return null; } catch (e) { await new Promise(r => setTimeout(r, 200)); } } return 'cannot decode'; }, p);
    if (err && w === 0) console.error('IMG', p.name, err);
  }
  const ids = await page.evaluate(([a, b, mb, c]) => { window.MB = mb; return window.setup(a, b, c); }, [tl, logo, MB, { CUT, GRID, CAPMETA }]);
  if (w === 0) console.log('scenes:', ids.join(', '));
  const canvas = await page.$('canvas');
  for (let i = w; i < frames.length; i += PAGES) {
    const n = frames[i]; await page.evaluate(n => window.renderFrame(n), n);
    await canvas.screenshot({ path: path.join(OUT, String(n).padStart(5, '0') + (JPG ? '.jpg' : '.png')), type: JPG ? 'jpeg' : 'png', quality: JPG ? 92 : undefined });
    if (++done % 150 === 0) console.log(`${done}/${frames.length} ${((Date.now() - t0) / done).toFixed(0)} ms/f`);
  }
  if (opt('--dump-imbalance') && w === 0) console.log('IMB', await page.evaluate(() => JSON.stringify(window.__imb || {})));
  if (opt('--dump-cues')) Object.assign(CUES, await page.evaluate(() => window.__cues || {}));
  if (opt('--dump-shakes') && w === 0) fs.writeFileSync(path.resolve(HERE, opt('--dump-shakes')), await page.evaluate(() => JSON.stringify(typeof _shakes !== 'undefined' ? _shakes : [])));   // impacts → sound cues
}));
if (opt('--dump-cues')) fs.writeFileSync(path.resolve(HERE, opt('--dump-cues')), JSON.stringify(Object.values(CUES).sort((a, b) => a.t - b.t)));
await browser.close(); console.log(`DONE ${done} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
