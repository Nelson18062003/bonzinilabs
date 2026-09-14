import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const OUT = process.env.OUT;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const fakeVV = () => {
  const target = new EventTarget(); const state = { height: 660, offsetTop: 0 };
  Object.defineProperty(window, 'visualViewport', { value: { get height() { return state.height; }, get offsetTop() { return state.offsetTop; }, get width() { return window.innerWidth; }, get offsetLeft() { return 0; }, get pageTop() { return state.offsetTop; }, get pageLeft() { return 0; }, get scale() { return 1; }, addEventListener: (...a) => target.addEventListener(...a), removeEventListener: (...a) => target.removeEventListener(...a), dispatchEvent: (e) => target.dispatchEvent(e) }, configurable: true });
  window.__vv = (h, t, events = []) => { state.height = h; state.offsetTop = t; for (const e of events) target.dispatchEvent(new Event(e)); };
};
const mk = async (w, h, init) => { const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR' }); if (init) await ctx.addInitScript(init); return ctx; };
async function shoot(port, tag) {
  // Mola, clavier refermé (bogue iOS)
  let ctx = await mk(390, 660, fakeVV); let page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/m/assistant`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500);
  await page.focus('textarea'); await page.keyboard.type('Znbb');
  await page.evaluate(() => window.__vv(310, 208, ['resize', 'scroll'])); await page.waitForTimeout(200);
  await page.evaluate(() => window.__vv(660, 208, ['resize'])); await page.evaluate(() => document.activeElement.blur()); await page.waitForTimeout(20);
  await page.evaluate(() => window.__vv(660, 0, [])); await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/mola-${tag}.png` }); await ctx.close();
  // Fiche client + feuille étiquette
  ctx = await mk(390, 844); page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/m/clients/u5`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/client-${tag}.png`, fullPage: true });
  const btn = page.getByText('Étiquette colis', { exact: true }).first(); await btn.scrollIntoViewIfNeeded(); await btn.click(); await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/sheet-${tag}.png` });
  await page.evaluate(() => { const p = document.querySelector('[role=dialog] .overflow-y-auto'); if (p) p.scrollTop = 420; }); await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/label-${tag}.png` });
  // Dossier cargo → Le client
  await page.goto(`http://127.0.0.1:${port}/m/cargo/2`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
  const fold = page.getByText('Le client', { exact: true }).first(); await fold.scrollIntoViewIfNeeded(); await fold.click(); await page.waitForTimeout(800); await fold.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/cargo-client-${tag}.png` });
  // Flotte à 320 px (iPhone SE)
  await ctx.close(); ctx = await mk(320, 568); page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/m/cargo`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/cargo320-${tag}.png` }); await ctx.close();
  // Desktop composeur
  ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } }); page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/screenshot.html?screen=label-composer-desktop&font=dm`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/desktop-${tag}.png` }); await ctx.close();
}
await shoot(8094, 'avant'); await shoot(8093, 'apres');
const pairs = [['mola', 'Mola — après fermeture du clavier iOS', 390], ['sheet', 'Étiquette colis — la feuille', 390], ['label', 'Étiquette colis — l’aperçu (= l’image envoyée)', 390], ['client', 'Fiche client', 390], ['cargo-client', 'Dossier cargo — « Le client »', 390], ['cargo320', 'Flotte cargo à 320 px (iPhone SE)', 320], ['desktop', 'Étiquette colis — desktop', 1280]];
for (const [key, title, w] of pairs) {
  const html = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#f4f4f5;font-family:DM Sans,system-ui,sans-serif;color:#1e1e1e}h1{margin:0;padding:18px 24px 8px;font-size:22px}.row{display:flex;gap:24px;padding:12px 24px 24px;align-items:flex-start}.col{display:flex;flex-direction:column;gap:8px}.col h2{margin:0;font-size:16px;font-weight:600;color:#5a5a5a}.col img{width:${w}px;border:1px solid #d9d9d9;border-radius:12px;background:#fff}.b{color:#c00f0c}.a{color:#009951}</style><h1>${title}</h1><div class=row><div class=col><h2 class=b>Avant (version en ligne, 3063bad)</h2><img src="${key}-avant.png"></div><div class=col><h2 class=a>Après (branche)</h2><img src="${key}-apres.png"></div></div>`;
  writeFileSync(`${OUT}/${key}.html`, html);
  const ctx = await browser.newContext({ viewport: { width: w * 2 + 72, height: 600 } }); const page = await ctx.newPage();
  await page.goto(`file://${OUT}/${key}.html`); await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/avant-apres-${key}.png`, fullPage: true }); await ctx.close();
}
await browser.close(); console.log('done');
