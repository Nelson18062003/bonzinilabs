// Multi-clip engine — deterministic Chromium renderer (rush1/prod/overlay/render.mjs generalised).
// usage: node render.mjs [start end] [--times a,b] [--frames a,b] [--out ../out/frames] [--pages 2] [--mb 4] [--jpg]
//                        [--scenes 05_footage,60_type] [--variant fx] [--allow-missing]
//   • frames default = 0 … SCORE.N − 1 (data/timeline.json is rewritten: {frames, dur, fps, variant})
//   • data/timing.json → window.TIMING, data/clips.json → window.CLIPS, data/voice_env.json → window.VOICE_ENV,
//     --variant → window.VARIANT (and BZ_VARIANT for the node score), all BEFORE the scene scripts load
//   • the page is served on a private origin (http://bz.local/ → this production folder, Playwright routes): no tainted
//     canvas; /assets/clips/<clip>/f_NNNN.jpg are the frames made by tools/prep_clips.py
//   • before each film frame the page hook window.PRELOAD(SCORE.shutter(n, MB)) decodes the frames those sub-samples
//     need (SCORE.need(t): every visible shot, transitions and split screens included, + the blended neighbour frame of
//     a slow motion) into an LRU of ImageBitmaps; the draw itself stays synchronous (window.clipImg(clip, f))
//   • pre-flight: every frame the requested range needs must exist on disk (else exit 2 with the list, unless
//     --allow-missing); after the run: decodes, cache misses (must be 0), decode failures (must be 0), cache peak
//   • --scenes A,B: load only the shared files (0x_), the composer (50_) and the listed scenes
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const HERE = path.dirname(url.fileURLToPath(import.meta.url)); const F = path.resolve(HERE, '..');
const args = process.argv.slice(2); const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BOOL = ['--jpg', '--allow-missing'];                         // flags without a value (a number after them is a frame)
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !BOOL.includes(args[i - 1])));
const VARIANT = opt('--variant', 'main'); process.env.BZ_VARIANT = VARIANT;
const SCORE = require(path.join(HERE, 'scenes', '01_score.js'));   // node reads data/timing.json + data/clips.json itself
const N = SCORE.N;
try { fs.writeFileSync(path.join(F, 'data', VARIANT === 'main' ? 'timeline.json' : `timeline_${VARIANT}.json`), JSON.stringify({ frames: N, dur: SCORE.T.end, fps: SCORE.FPS, variant: VARIANT, note: 'written by overlay/render.mjs from SCORE.N' }) + '\n'); } catch (e) { }
let frames = Array.from({ length: (+(pos[1] ?? N - 1)) - (+(pos[0] ?? 0)) + 1 }, (_, i) => +(pos[0] ?? 0) + i);
if (opt('--frames')) frames = opt('--frames').split(',').map(Number);
if (opt('--times')) frames = opt('--times').split(',').map(x => Math.round(+x * SCORE.FPS));
{ const over = frames.filter(f => f < 0 || f >= N); if (over.length) { console.warn(`WARNING: ${over.length} frame(s) outside 0…${N - 1} dropped (the film is N = ${N} frames)`); frames = frames.filter(f => f >= 0 && f < N); } }
const OUT = path.resolve(HERE, opt('--out', '../out/frames')); fs.mkdirSync(OUT, { recursive: true });
const PAGES = +opt('--pages', 2), MB = +opt('--mb', 1), JPG = args.includes('--jpg');
// ---- pre-flight: the frames on disk ----
{
  const want = {};
  for (const n of frames) for (const t of SCORE.shutter(n, MB)) for (const q of SCORE.need(t)) (want[q.clip] = want[q.clip] || new Set()).add(q.f);
  const miss = [];
  for (const [clip, fs_] of Object.entries(want)) for (const f of fs_) { const p = path.join(F, 'assets', 'clips', clip, `f_${String(f).padStart(4, '0')}.jpg`); if (!fs.existsSync(p)) miss.push(`${clip}/${f}`); }
  const tot = Object.values(want).reduce((a, s) => a + s.size, 0);
  if (miss.length) {
    console.error(`MISSING ${miss.length}/${tot} footage frame(s) on disk (first: ${miss.slice(0, 8).join(' ')}): python3 tools/prep_clips.py --score`);
    if (!args.includes('--allow-missing')) process.exit(2);
  } else console.log(`pre-flight: ${tot} footage frame(s) needed, all on disk (${Object.entries(want).map(([c, s]) => `${c} ${s.size}`).join(' · ')})`);
}
const svg = fs.readFileSync(path.join(F, 'assets/logo.svg'), 'utf8');
const logo = [...svg.matchAll(/<path\s+d="([^"]+)"[^>]*fill="([^"]+)"/g)].map(m => { const ys = [...m[1].matchAll(/[-\d.]+,([-\d.]+)/g)].map(q => +q[1]); return { d: m[1], fill: m[2], cy: ys.reduce((a, b) => a + b, 0) / ys.length }; });
let files = fs.readdirSync(path.join(HERE, 'scenes')).filter(f => f.endsWith('.js') && !f.startsWith('zz_')).sort();
if (opt('--scenes')) { const want = opt('--scenes').split(','); files = files.filter(f => /^0\d_|^50_/.test(f) || want.some(w => f.includes(w))); }
const readJ = f => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
const INJECT = { TIMING: readJ(path.join(F, 'data/timing.json')), CLIPS: readJ(path.join(F, 'data/clips.json')),
  VOICE_ENV: readJ(path.join(F, 'data/voice_env.json')), HIDES: readJ(path.join(F, 'data/hides.json')),
  TAKES: readJ(path.join(F, '..', 'voice', 'takes.json')), REAL_WORDS: readJ(path.join(F, '..', 'voice', 'real_words.json')),
  NARR_WORDS: readJ(path.join(F, '..', 'voice', 'words.json')), VARIANT };
if (!INJECT.VOICE_ENV) console.warn('WARNING: data/voice_env.json missing (python3 tools/voice_env.py): the « vraie voix » waveform idles');
const ORIGIN = 'http://bz.local';
const inside = (f, root) => { const r = path.relative(root, f); return r && !r.startsWith('..') && !path.isAbsolute(r); };
const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });
const t0 = Date.now(); let done = 0; const STATS = [];
console.log(`N = ${N} (T.end ${SCORE.T.end}s) · ${frames.length} frame(s) · MB ${MB} · variant ${VARIANT} · ${SCORE.shots.length} shots`);
await Promise.all(Array.from({ length: Math.min(PAGES, frames.length) }, async (_, w) => {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message)); page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await page.route(ORIGIN + '/**', async route => {
    const p = decodeURIComponent(new URL(route.request().url()).pathname), file = path.join(F, p);
    if (!inside(file, F) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ status: 200, path: file, headers: { 'cache-control': 'no-store' } });
  });
  await page.goto(ORIGIN + '/overlay/engine.html');
  await page.evaluate(o => Object.assign(window, o), INJECT);           // read by 01_score.js / 60_type.js at load
  for (const f of files) await page.addScriptTag({ path: path.join(HERE, 'scenes', f) });
  await page.evaluate(async () => { for (const f of ['400 10px CaveatBrush', '700 10px Brico', '800 10px Brico', '400 10px Martian', '700 10px Martian', '800 10px Stencil', '900 10px Stencil', '400 10px Satoshi', '500 10px Satoshi', '700 10px Satoshi', '900 10px Satoshi', '800 10px DMSans', '700 10px Shantell', '800 10px Shantell', '400 10px Kalam', '700 10px Kalam', '400 10px PatrickHand', '400 10px GochiHand', '400 10px Bangers']) await document.fonts.load(f); await document.fonts.ready; });
  const ids = await page.evaluate(([a, b, mb]) => { window.MB = mb; return window.setup(a, b, {}); }, [{ frames: N }, logo, MB]);
  if (w === 0) console.log('scenes:', ids.join(', '), '| files:', files.join(' '));
  const canvas = await page.$('canvas');
  for (let i = w; i < frames.length; i += PAGES) {
    const n = frames[i];
    const ts = SCORE.shutter(n, MB);                                 // the same sub-samples the engine draws (cuts respected)
    await page.evaluate(ts => window.PRELOAD(ts), ts);              // decode what this frame needs (LRU), then draw synchronously
    await page.evaluate(n => window.renderFrame(n), n);
    await canvas.screenshot({ path: path.join(OUT, String(n).padStart(5, '0') + (JPG ? '.jpg' : '.png')), type: JPG ? 'jpeg' : 'png', quality: JPG ? 92 : undefined });
    if (++done % 60 === 0) console.log(`${done}/${frames.length} ${((Date.now() - t0) / done).toFixed(0)} ms/f`);
  }
  STATS.push(await page.evaluate(() => { const C = window.CLIPCACHE; return { miss: C.miss, loads: C.loads, fails: C.fails, peak: C.peak, peakPx: C.peakPx }; }));
  await page.close();
}));
await browser.close();
const tot = STATS.reduce((a, s) => ({ miss: a.miss + s.miss, loads: a.loads + s.loads, fails: a.fails + s.fails, peak: Math.max(a.peak, s.peak), peakPx: Math.max(a.peakPx, s.peakPx) }), { miss: 0, loads: 0, fails: 0, peak: 0, peakPx: 0 });
console.log(`DONE ${done} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s (${((Date.now() - t0) / Math.max(1, done)).toFixed(0)} ms/f) · decodes ${tot.loads} · cache misses ${tot.miss} · decode failures ${tot.fails} · cache peak ${tot.peak} frames / ${(tot.peakPx / 1e6).toFixed(0)} MP`);
if (tot.miss || tot.fails) { console.error('WARNING: footage cache misses / decode failures (a frame was drawn with the nearest cached image)'); process.exitCode = 3; }
