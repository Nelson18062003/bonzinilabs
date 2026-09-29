// Render the TEASER overlay layer to RGBA PNGs (adapted from v1 render.mjs).
// usage: node render.mjs [startFrame=0] [endFrame=554] [--pages 2] [--out ../layers/overlay] [--frames 12,45,300]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const V = path.resolve(HERE, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const tl = JSON.parse(fs.readFileSync(path.join(V, 'data/timeline.json'), 'utf8'));
const start = +(pos[0] ?? 0), end = +(pos[1] ?? (tl.nframes - 1));
const PAGES = +opt('--pages', 2);
const OUT = path.resolve(HERE, opt('--out', '../layers/overlay'));
const only = opt('--frames', null);
fs.mkdirSync(OUT, { recursive: true });

const svg = fs.readFileSync(path.join(V, 'assets/logo.svg'), 'utf8');
const logo = [...svg.matchAll(/<path\s+d="([^"]+)"[^>]*fill="([^"]+)"/g)].map(m => {
  const ys = [...m[1].matchAll(/[-\d.]+,([-\d.]+)/g)].map(q => +q[1]);
  return { d: m[1], fill: m[2], cy: ys.reduce((a, b) => a + b, 0) / ys.length };
});
if (logo.length !== 4) throw new Error('expected 4 logo paths, got ' + logo.length);

const frames = only ? only.split(',').map(Number) : Array.from({ length: end - start + 1 }, (_, i) => start + i);
const browser = await chromium.launch({ args: ['--disable-gpu', '--font-render-hinting=none'] });
const t0 = Date.now();
let done = 0;
await Promise.all(Array.from({ length: PAGES }, async (_, w) => {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto(url.pathToFileURL(path.join(HERE, 'overlay.html')).href);
  await page.evaluate(async () => { await document.fonts.load('900 10px Orbitron'); await document.fonts.load('700 10px Orbitron');
    for (const w of [500, 600, 700]) await document.fonts.load(`${w} 10px Chakra`); await document.fonts.load('500 10px Mono'); await document.fonts.load('700 10px Mono'); await document.fonts.ready; });
  const ok = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').length);
  if (ok < 7) throw new Error('fonts not loaded: ' + ok);
  await page.evaluate(([c, lg]) => window.setup(c, lg), [tl, logo]);
  const canvas = await page.$('canvas');
  for (let i = w; i < frames.length; i += PAGES) {
    const n = frames[i];
    await page.evaluate(n => window.renderFrame(n), n);
    await canvas.screenshot({ path: path.join(OUT, String(n).padStart(5, '0') + '.png'), omitBackground: true });
    if (++done % 100 === 0) console.log(`${done}/${frames.length}  ${((Date.now() - t0) / done).toFixed(0)} ms/frame`);
  }
}));
await browser.close();
console.log(`DONE ${done} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${OUT}`);
