// Render the explainer overlay (all scenes) to RGBA PNGs.
// usage: node render.mjs [start=0] [end=last] [--pages 2] [--out ../layers/overlay] [--frames a,b,c] [--times 1.5,20.2] [--only s1_achat,captions]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
const HERE = path.dirname(url.fileURLToPath(import.meta.url)); const E = path.resolve(HERE, '..'); const S = path.resolve(E, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const tl = JSON.parse(fs.readFileSync(path.join(E, 'data/timeline.json'), 'utf8'));
const config = fs.existsSync(path.join(E, 'data/config.json')) ? JSON.parse(fs.readFileSync(path.join(E, 'data/config.json'), 'utf8')) : {};
const start = +(pos[0] ?? 0), end = +(pos[1] ?? tl.frames - 1);
const PAGES = +opt('--pages', 2); const OUT = path.resolve(HERE, opt('--out', '../layers/overlay'));
let frames = Array.from({ length: end - start + 1 }, (_, i) => start + i);
if (opt('--frames', null)) frames = opt('--frames').split(',').map(Number);
if (opt('--times', null)) frames = opt('--times').split(',').map(x => Math.round(+x * 30));
const only = opt('--only', null);
fs.mkdirSync(OUT, { recursive: true });
const svg = fs.readFileSync(path.join(S, 'reel/assets/logo.svg'), 'utf8');
const logo = [...svg.matchAll(/<path\s+d="([^"]+)"[^>]*fill="([^"]+)"/g)].map(m => {
  const ys = [...m[1].matchAll(/[-\d.]+,([-\d.]+)/g)].map(q => +q[1]); return { d: m[1], fill: m[2], cy: ys.reduce((a, b) => a + b, 0) / ys.length }; });
const sceneFiles = fs.readdirSync(path.join(HERE, 'scenes')).filter(f => f.endsWith('.js')).sort();
const browser = await chromium.launch({ args: ['--disable-gpu', '--font-render-hinting=none'] });
const t0 = Date.now(); let done = 0;
await Promise.all(Array.from({ length: PAGES }, async (_, w) => {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGE ERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await page.goto(url.pathToFileURL(path.join(HERE, 'engine.html')).href);
  for (const f of sceneFiles) await page.addScriptTag({ path: path.join(HERE, 'scenes', f) });
  await page.evaluate(async () => { for (const f of ['900 10px Orbitron', '700 10px Orbitron', '500 10px Chakra', '600 10px Chakra', '700 10px Chakra', '500 10px Mono', '700 10px Mono',
    '500 10px Grotesk', '700 10px Grotesk', '500 10px DMSans', '700 10px DMSans', '800 10px DMSans']) await document.fonts.load(f); await document.fonts.ready; });
  const ids = await page.evaluate(([a, b, c]) => window.setup(a, b, c), [tl, config, logo]);
  if (w === 0) console.log('scenes:', ids.join(', '));
  if (only) await page.evaluate(o => { const keep = new Set(o.split(',')); for (let i = SCENES.length - 1; i >= 0; i--) if (!keep.has(SCENES[i].id)) SCENES.splice(i, 1); }, only);
  const canvas = await page.$('canvas');
  for (let i = w; i < frames.length; i += PAGES) {
    const n = frames[i];
    await page.evaluate(n => window.renderFrame(n), n);
    await canvas.screenshot({ path: path.join(OUT, String(n).padStart(5, '0') + '.png'), omitBackground: true });
    if (++done % 200 === 0) console.log(`${done}/${frames.length} ${((Date.now() - t0) / done).toFixed(0)} ms/frame`);
  }
}));
await browser.close();
console.log(`DONE ${done} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${OUT}`);
