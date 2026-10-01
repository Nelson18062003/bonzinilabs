// Captures for the teaser (storyboard §5): C1a/C1b phone (Mèches state, digits → •), C2 search pill typing « baskets »,
// C3 hero title with « Ni plus, ni moins. » (+ word boxes), C4a/C4b header brand link (with / without « Douane »).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--proxy-server=' + process.env.HTTPS_PROXY, '--proxy-bypass-list=<local>;localhost;127.0.0.1'] });
const ctx = await b.newContext({ viewport: { width: 760, height: 1351 }, deviceScaleFactor: 3, locale: 'fr-FR', colorScheme: 'light' });
await ctx.addInitScript(() => { const si = window.setInterval.bind(window); window.setInterval = (fn, ms, ...a) => (ms === 4500 ? window.setTimeout(fn, 300) : si(fn, ms, ...a)); });
const p = await ctx.newPage(); p.on('pageerror', e => console.error('PAGEERR', e.message));
await p.goto('http://localhost:8080/douane', { waitUntil: 'networkidle', timeout: 90000 });
await p.addStyleTag({ content: '.tsqd-open-btn-container{display:none!important} #dz-hero-q::placeholder{color:transparent!important} #dz-hero-q:focus,#dz-hero-q:focus-visible{outline:none!important;box-shadow:none!important}' });
await p.waitForSelector('text=Mèches synthétiques'); await p.waitForTimeout(2500);
await p.evaluate(() => {
  const scr = document.querySelector('.rounded-\\[42px\\]');
  const w = document.createTreeWalker(scr, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) n.nodeValue = n.nodeValue.replace(/\d/g, '•');
  document.querySelector('main h1 span').textContent = 'Ni plus, ni moins.';
});
await p.waitForTimeout(800);
const meta = {};
// ---- C1: the phone and the boxes of its inner rows (relative to the phone element, CSS px)
const phone = await p.$('.rounded-\\[52px\\]');
meta.phone = await p.evaluate(() => {
  const ph = document.querySelector('.rounded-\\[52px\\]'), r0 = ph.getBoundingClientRect();
  const rel = el => { const r = el.getBoundingClientRect(); return { x: r.left - r0.left, y: r.top - r0.top, w: r.width, h: r.height, text: (el.textContent || '').trim().slice(0, 60) }; };
  const scr = ph.querySelector('.rounded-\\[42px\\]');
  const all = [...scr.querySelectorAll('*')].filter(e => e.children.length === 0 && (e.textContent || '').trim()).map(rel);
  const bar = scr.querySelector('div.flex.h-2'); const btn = [...scr.querySelectorAll('a,button')].map(rel);
  return { size: { w: r0.width, h: r0.height }, screen: rel(scr), leaves: all, bar: bar ? rel(bar) : null, buttons: btn,
    barSegs: bar ? [...bar.children].map(rel) : [] };
});
await phone.screenshot({ path: `${OUT}/C1a.png`, omitBackground: true });
await p.addStyleTag({ content: '.rounded-\\[42px\\] div.flex.h-2>*{opacity:0!important}' });
await p.waitForTimeout(200);
await phone.screenshot({ path: `${OUT}/C1b.png`, omitBackground: true });
await p.addStyleTag({ content: '.rounded-\\[42px\\] div.flex.h-2>*{opacity:1!important}' });
// ---- C3: the hero title (and the box of each word group)
const h1 = await p.$('main h1');
meta.h1 = await p.evaluate(() => {
  const h = document.querySelector('main h1'), r0 = h.getBoundingClientRect();
  const words = []; const w = document.createTreeWalker(h, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const t = n.nodeValue; let i = 0;
    for (const m of t.matchAll(/\S+/g)) { const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length); const r = rg.getBoundingClientRect();
      words.push({ w: m[0], x: r.left - r0.left, y: r.top - r0.top, w_: r.width, h: r.height }); } }
  return { size: { w: r0.width, h: r0.height }, words, font: getComputedStyle(h).fontSize };
});
await h1.screenshot({ path: `${OUT}/C3.png`, omitBackground: true });
// ---- C4: header brand link
const brand = await p.$('header a[href="/douane"]');
meta.brand = await p.evaluate(() => { const a = document.querySelector('header a[href="/douane"]'), r = a.getBoundingClientRect();
  return { w: r.width, h: r.height, kids: [...a.querySelectorAll('*')].map(e => { const q = e.getBoundingClientRect(); return { tag: e.tagName, x: q.left - r.left, y: q.top - r.top, w: q.width, h: q.height, text: (e.textContent || '').trim() }; }) }; });
await brand.screenshot({ path: `${OUT}/C4a.png`, omitBackground: true });
await p.evaluate(() => { const a = document.querySelector('header a[href="/douane"]'); [...a.querySelectorAll('span')].filter(s => s.textContent.trim() === 'Douane').forEach(s => s.style.opacity = '0'); });
await p.waitForTimeout(150);
await brand.screenshot({ path: `${OUT}/C4b.png`, omitBackground: true });
await p.evaluate(() => { const a = document.querySelector('header a[href="/douane"]'); [...a.querySelectorAll('span')].forEach(s => s.style.opacity = ''); });
// ---- C2: the search pill, typing « baskets » one letter at a time (focus, never Enter)
const form = await p.$('#dz-hero-q');
const box = await p.evaluate(() => { const f = document.querySelector('#dz-hero-q').closest('form') || document.querySelector('#dz-hero-q').parentElement; const r = f.getBoundingClientRect(); return { x: r.left - 24, y: r.top - 24 + window.scrollY, w: r.width + 48, h: r.height + 48 }; });
meta.pill = box;
await p.click('#dz-hero-q'); await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/C2_0.png`, clip: { x: box.x, y: box.y, width: box.w, height: box.h }, omitBackground: true });
const word = 'baskets';
for (let i = 0; i < word.length; i++) { await p.keyboard.type(word[i]); await p.waitForTimeout(120);
  await p.screenshot({ path: `${OUT}/C2_${i + 1}.png`, clip: { x: box.x, y: box.y, width: box.w, height: box.h }, omitBackground: true }); }
// full-page reference
await p.screenshot({ path: `${OUT}/ref_760.png` });
fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify(meta, null, 1));
console.log('done', Object.keys(meta));
await b.close();
