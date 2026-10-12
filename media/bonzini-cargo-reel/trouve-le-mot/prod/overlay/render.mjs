// « TROUVE LE MOT. » — Bonsoir, bonsoir. Deterministic Chromium renderer (serie/ep2 render.mjs adapted to real footage).
// usage: node render.mjs [start end] [--times a,b] [--frames a,b] [--out ../out/frames] [--pages 2] [--mb 6] [--jpg]
//                        [--scenes 05_rush,60_type] [--src DIR] [--n6w]   (--n6w: the WhatsApp variant → ../out/frames_wa)
//   • frames default = 0 … SCORE.N − 1 (the score computes N from data/timing.json; data/timeline_main.json is rewritten)
//   • data/timing.json → window.TIMING, data/label_track.json → window.LABEL_TRACK, before the scene scripts load
//   • the page is served on a private origin (http://bz.local/ → this production folder, Playwright routes): no tainted
//     canvas, images decoded natively. /assets/rush/f_NNNN.jpg falls back to the source PNG (rush1/src_frames/NNNN.png,
//     or --src DIR) while the prepared frame does not exist; /src/NNNN.png = the source PNG.
//   • before each film frame (and its motion-blur sub-samples) the page hook window.PRELOAD(times) decodes the rush frames
//     those times need (SCORE.rushNeed) into an LRU cache (~24): the draw itself stays synchronous and pure.
//   • the HD zoom layer assets/zoom/r100_x4.png (+ r100_x4.json geometry) is decoded once at setup when it exists.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = path.dirname(url.fileURLToPath(import.meta.url)); const F = path.resolve(HERE, '..');
const args = process.argv.slice(2); const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BOOL = ['--jpg', '--n6w'];                                   // flags without a value (a number after them is a frame)
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !BOOL.includes(args[i - 1])));
const SRC = path.resolve(opt('--src', path.resolve(F, '..', 'src_frames')));
// --n6w = the WhatsApp-status variant (STORYBOARD §6: pill « Réponds-lui en message : », timed on N6w; its sound is
// lib/audio_rush.py --n6w → audio_wa/mix.wav). The score reads BZ_VARIANT (node) / window.VARIANT (page).
const WA = args.includes('--n6w'); if (WA) process.env.BZ_VARIANT = 'wa';
const SCORE = require(path.join(HERE, 'scenes', '01_score.js'));   // node reads data/timing.json + label_track.json itself
const N = SCORE.N;
try { fs.writeFileSync(path.join(F, 'data', WA ? 'timeline_wa.json' : 'timeline_main.json'), JSON.stringify({ frames: N, dur: SCORE.T.end, fps: SCORE.FPS, variant: SCORE.VARIANT, note: 'written by overlay/render.mjs from SCORE.N' }) + '\n'); } catch (e) { }
let frames = Array.from({ length: (+(pos[1] ?? N - 1)) - (+(pos[0] ?? 0)) + 1 }, (_, i) => +(pos[0] ?? 0) + i);
if (opt('--frames')) frames = opt('--frames').split(',').map(Number);
if (opt('--times')) frames = opt('--times').split(',').map(x => Math.round(+x * SCORE.FPS));
{ const over = frames.filter(f => f < 0 || f >= N); if (over.length) { console.warn(`WARNING: ${over.length} frame(s) outside 0…${N - 1} dropped (the film is N = ${N} frames; mix.wav = T.end)`); frames = frames.filter(f => f >= 0 && f < N); } }
const OUT = path.resolve(HERE, opt('--out', WA ? '../out/frames_wa' : '../out/frames')); fs.mkdirSync(OUT, { recursive: true });
const PAGES = +opt('--pages', 2), MB = +opt('--mb', 1), JPG = args.includes('--jpg');
const svg = fs.readFileSync(path.join(F, 'assets/logo.svg'), 'utf8');
const logo = [...svg.matchAll(/<path\s+d="([^"]+)"[^>]*fill="([^"]+)"/g)].map(m => { const ys = [...m[1].matchAll(/[-\d.]+,([-\d.]+)/g)].map(q => +q[1]); return { d: m[1], fill: m[2], cy: ys.reduce((a, b) => a + b, 0) / ys.length }; });
let files = fs.readdirSync(path.join(HERE, 'scenes')).filter(f => f.endsWith('.js') && !f.startsWith('zz_')).sort();
// --scenes 05_rush,60_type : load only the shared files (0x_, 1x_), the gecko shim pair (39/41), the composer (50_) and the listed scenes
if (opt('--scenes')) { const want = opt('--scenes').split(','); files = files.filter(f => /^[01]\d_|^39_|^41_|^50_/.test(f) || want.some(w => f.includes(w))); }
const readJ = f => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
const TIMING = readJ(path.join(F, 'data/timing.json'));
const LABEL = readJ(path.join(F, 'data/label_track.json')) || readJ(path.resolve(F, '..', 'work', 'label_track.json'));
const ZPNG = path.join(F, 'assets/zoom/r100_x4.png');
const ZOOM = fs.existsSync(ZPNG) ? { url: 'http://bz.local/assets/zoom/r100_x4.png', geo: readJ(path.join(F, 'assets/zoom/r100_x4.json')) } : null;
const ORIGIN = 'http://bz.local';
const inside = (f, root) => { const r = path.relative(root, f); return r && !r.startsWith('..') && !path.isAbsolute(r); };
const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });
const t0 = Date.now(); let done = 0; const STATS = [];
console.log(`N = ${N} (T.end ${SCORE.T.end}s) · ${frames.length} frame(s) · MB ${MB} · zoom layer ${ZOOM ? 'yes' : 'no (fallback: full frame + mosaic)'} · prepared frames ${fs.existsSync(path.join(F, 'assets/rush')) ? fs.readdirSync(path.join(F, 'assets/rush')).filter(f => /^f_\d{4}\.jpg$/.test(f)).length : 0}/299`);
await Promise.all(Array.from({ length: Math.min(PAGES, frames.length) }, async (_, w) => {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message)); page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await page.route(ORIGIN + '/**', async route => {
    const p = decodeURIComponent(new URL(route.request().url()).pathname);
    let file = path.join(F, p);
    const mr = p.match(/^\/assets\/rush\/f_(\d{4})\.jpg$/), ms = p.match(/^\/src\/(\d{4})\.png$/);
    if (ms) file = path.join(SRC, ms[1] + '.png');
    else if (mr) {                                                   // not there yet, empty, or being written right now → source PNG
      let ok = false; try { const st = fs.statSync(file); ok = st.size > 1024 && Date.now() - st.mtimeMs > 3000; } catch (e) { }
      if (!ok) file = path.join(SRC, mr[1] + '.png');
    }
    if (!(inside(file, F) || inside(file, SRC)) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ status: 200, path: file, headers: { 'cache-control': 'no-store' } });
  });
  await page.goto(ORIGIN + '/overlay/engine.html');
  await page.evaluate(([tm, lt, z, v]) => { window.TIMING = tm; window.LABEL_TRACK = lt; window.ZOOM = z; window.VARIANT = v; }, [TIMING, LABEL, ZOOM, WA ? 'wa' : 'main']);   // read by 01_score.js at load
  for (const f of files) await page.addScriptTag({ path: path.join(HERE, 'scenes', f) });
  await page.evaluate(async () => { for (const f of ['400 10px CaveatBrush', '700 10px Brico', '800 10px Brico', '400 10px Martian', '700 10px Martian', '800 10px Stencil', '900 10px Stencil', '400 10px Satoshi', '500 10px Satoshi', '700 10px Satoshi', '900 10px Satoshi', '800 10px DMSans', '700 10px Shantell', '800 10px Shantell', '400 10px Kalam', '700 10px Kalam', '400 10px PatrickHand', '400 10px GochiHand', '400 10px Bangers']) await document.fonts.load(f); await document.fonts.ready; });
  if (ZOOM) { const ok = await page.evaluate(() => window.loadZoom()); if (!ok && w === 0) console.error('ZOOM layer: cannot decode', ZPNG); }
  { const nb = await page.evaluate(() => window.loadBagShades ? window.loadBagShades() : 0); if (nb < 2 && w === 0) console.error('bag shades: only', nb, 'of 2 decoded (assets/rush/shade_bag_f0060/0228.png)'); }
  const ids = await page.evaluate(([a, b, mb]) => { window.MB = mb; return window.setup(a, b, {}); }, [{ frames: N }, logo, MB]);
  if (w === 0) console.log('scenes:', ids.join(', '), '| files:', files.join(' '));
  const canvas = await page.$('canvas');
  for (let i = w; i < frames.length; i += PAGES) {
    const n = frames[i];
    const ts = SCORE.shutter(n, MB);                                 // the same sub-samples the engine draws (cuts respected)
    await page.evaluate(ts => window.PRELOAD(ts), ts);              // decode what this frame needs (LRU), then draw synchronously
    await page.evaluate(n => window.renderFrame(n), n);
    await canvas.screenshot({ path: path.join(OUT, String(n).padStart(5, '0') + (JPG ? '.jpg' : '.png')), type: JPG ? 'jpeg' : 'png', quality: JPG ? 92 : undefined });
    if (++done % 150 === 0) console.log(`${done}/${frames.length} ${((Date.now() - t0) / done).toFixed(0)} ms/f`);
  }
  STATS.push(await page.evaluate(() => ({ miss: RUSH.miss, loads: RUSH.loads, fallbacks: RUSH.fallbacks, cached: RUSH.cache.size })));
  await page.close();
}));
await browser.close();
const tot = STATS.reduce((a, s) => ({ miss: a.miss + s.miss, loads: a.loads + s.loads, fallbacks: a.fallbacks + s.fallbacks }), { miss: 0, loads: 0, fallbacks: 0 });
console.log(`DONE ${done} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s · rush decodes ${tot.loads} · cache misses ${tot.miss} · decode fallbacks ${tot.fallbacks}`);
if (tot.miss) console.error('WARNING: rush cache misses (a frame was drawn with the nearest cached image)');
