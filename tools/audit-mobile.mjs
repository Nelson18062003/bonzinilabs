// DEV-ONLY — audit de l'app admin MOBILE telle qu'elle est : capture chaque
// écran à 390×844 (iPhone 14) sur le VRAI routeur (/m/…), avec Supabase
// répondu par les fixtures partagées. Sort aussi des mesures de dérive kit :
// tailles de police < 14 px, rayons hors {4,8,16,9999}, cibles < 44 px,
// débordement horizontal, hauteur d'en-tête avant le premier contenu.
// Lancer vite avec SCREENSHOT_MOCK=1 ; PORT=8093 OUT=… [ROLE=cash_agent] node tools/audit-mobile.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { respond, headCount, qrSvg, proofSvg } from './adminFixtures.mjs';

const PORT = process.env.PORT ?? '8080';
const OUT = process.env.OUT ?? 'shots/audit-mobile';
mkdirSync(OUT, { recursive: true });
const BASE = `http://127.0.0.1:${PORT}`;
const SCREENS = process.env.ONLY ? process.env.ONLY.split(',') : [
  'm', 'm/deposits', 'm/deposits/d5', 'm/deposits/new', 'm/payments', 'm/payments/p3', 'm/payments/new',
  'm/clients', 'm/clients/u5', 'm/assistant', 'm/more', 'm/more/rates', 'm/dashboard',
  'm/cargo', 'm/cargo/map', 'm/cargo/track', 'm/cargo/2', 'm/cargo/2/suivi', 'm/cargo/2/chargement', 'm/cargo/2/documents', 'm/cargo/2/couts',
];
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS,PATCH,DELETE,HEAD', 'access-control-expose-headers': 'content-range' };

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', colorScheme: (process.env.THEME === 'dark' ? 'dark' : 'light') });
// ROLE=cash_agent : le contexte admin simulé (mockAdminAuth) lit ce rôle et
// ouvre la chaîne agent cash (/a/…), fermée aux autres rôles.
if (process.env.ROLE) await ctx.addInitScript((r) => { try { localStorage.setItem('screenshot-role', r); } catch { /* privé */ } }, process.env.ROLE);
await ctx.route('**/*supabase.co/**', (route) => {
  const req = route.request();
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS, body: '' });
  const url = req.url();
  if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { ...CORS, 'content-range': `0-0/${headCount(url)}` }, body: '' });
  if (req.method() === 'GET' && url.includes('/storage/v1/object/fake/')) return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'image/svg+xml' }, body: url.includes('qr') ? qrSvg : proofSvg });
  let body = respond(url);
  const accept = req.headers()['accept'] ?? '';
  if (accept.includes('pgrst.object') && Array.isArray(body)) body = body[0] ?? null;
  return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json', 'content-range': `0-9/${Array.isArray(body) ? body.length : 1}` }, body: JSON.stringify(body ?? null) });
});
// Tuiles de carte : hors réseau dans ce bac à sable — on répond vide pour ne pas attendre.
await ctx.route(/openfreemap|tiles\./, (r) => r.fulfill({ status: 204, body: '' }));

const report = {};
for (const screen of SCREENS) {
  const page = await ctx.newPage();
  if (process.env.LANG_APP) await page.addInitScript((l) => localStorage.setItem('bonzini-language', l), process.env.LANG_APP);
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
  try {
    await page.goto(`${BASE}/${screen}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3500);
    const m = await page.evaluate(() => {
      const vw = window.innerWidth;
      const all = [...document.querySelectorAll('body *')];
      const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
      const fonts = {}; const radii = {}; const bgs = {}; const families = {};
      let small = 0, tiny = 0, texts = 0; const smallTexts = [];
      for (const el of all) {
        if (!vis(el)) continue;
        const cs = getComputedStyle(el);
        const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (hasText) { texts++; const fs = Math.round(parseFloat(cs.fontSize) * 10) / 10; fonts[fs] = (fonts[fs] || 0) + 1; if (fs < 14) { small++; if (smallTexts.length < 40) smallTexts.push(`${fs}px <${el.tagName.toLowerCase()} ${String(el.className).slice(0, 50)}> "${el.textContent.trim().slice(0, 30)}"`); } if (fs < 12) tiny++; families[cs.fontFamily.split(',')[0].replace(/"/g, '')] = 1; }
        const br = cs.borderTopLeftRadius; if (br && br !== '0px' && (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.borderTopWidth !== '0px')) radii[br] = (radii[br] || 0) + 1;
        const bg = cs.backgroundColor; if (bg && bg !== 'rgba(0, 0, 0, 0)') bgs[bg] = (bgs[bg] || 0) + 1;
      }
      const targets = [...document.querySelectorAll('button, a[href], [role=button], input, select, textarea')].filter(vis);
      const smallTargets = targets.filter((el) => { const r = el.getBoundingClientRect(); return Math.min(r.width, r.height) < 40; }).map((el) => `${el.tagName.toLowerCase()} ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 18)}"`);
      const roundButtons = targets.filter((el) => el.tagName === 'BUTTON' && parseFloat(getComputedStyle(el).borderTopLeftRadius) >= 20).length;
      const buttons = targets.filter((el) => el.tagName === 'BUTTON').length;
      const overflow = all.filter((el) => vis(el) && el.scrollWidth > el.clientWidth + 4 && getComputedStyle(el).overflowX !== 'visible').map((el) => (el.className || el.tagName).toString().slice(0, 50));
      const header = document.querySelector('header'); const hh = header ? Math.round(header.getBoundingClientRect().height) : 0;
      const main = document.querySelector('main'); let firstY = null;
      if (main) { for (const el of main.querySelectorAll('*')) { if (!vis(el)) continue; const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()); if (hasText && !(header && header.contains(el))) { firstY = Math.round(el.getBoundingClientRect().top); break; } } }
      const nav = document.querySelector('nav'); const navH = nav ? Math.round(nav.getBoundingClientRect().height) : 0;
      const navLabels = nav ? [...nav.querySelectorAll('a')].map((a) => a.textContent.trim()) : [];
      const h1 = document.querySelector('h1')?.textContent?.trim();
      const shadows = all.filter((el) => vis(el) && getComputedStyle(el).boxShadow !== 'none').length;
      const blur = all.filter((el) => vis(el) && (getComputedStyle(el).backdropFilter || 'none') !== 'none').length;
      return { docW: document.documentElement.scrollWidth, vw, docH: document.documentElement.scrollHeight, h1, headerH: hh, firstContentY: firstY, navH, navLabels, texts, small, tiny, fonts, families: Object.keys(families), radii, bgs: Object.entries(bgs).sort((a, b) => b[1] - a[1]).slice(0, 8), buttons, roundButtons, smallTargets: smallTargets.slice(0, 30), smallTargetCount: smallTargets.length, smallTexts, overflow: overflow.slice(0, 6), shadows, blur };
    });
    const name = screen.replace(/\//g, '_');
    await page.screenshot({ path: `${OUT}/${name}.png` });
    await page.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true });
    report[screen] = { ...m, errs };
    console.log(`OK  ${screen.padEnd(24)} h1=${JSON.stringify(m.h1)} header=${m.headerH} first=${m.firstContentY} doc=${m.docW}/${m.vw} ${m.docW > m.vw + 2 ? 'DEBORDE' : ''} texts=${m.texts} <14px=${m.small} <12px=${m.tiny} btn=${m.buttons} ronds=${m.roundButtons} cibles<40=${m.smallTargetCount} ombres=${m.shadows} blur=${m.blur} ${errs[0] ? 'ERR ' + errs[0] : ''}`);
  } catch (e) { console.log(`ERR ${screen}: ${e.message.slice(0, 160)}`); report[screen] = { error: e.message, errs }; }
  await page.close();
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
await browser.close();
console.log('done');
