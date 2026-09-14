// DEV-ONLY — audit de l'APP CLIENT (/wallet, /deposits, /payments…) telle
// qu'un importateur la voit : session client factice (bonzini-client-auth)
// posée dans localStorage, /auth/v1/user et /auth/v1/token répondus en local,
// tables Supabase répondues par les fixtures partagées (u5 = Fatou Ndiaye).
// À lancer contre un serveur Vite SANS alias de mock (npx vite --port 8094) :
//   PORT=8094 OUT=… node tools/audit-client.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { respond, headCount, qrSvg, proofSvg } from './adminFixtures.mjs';

const PORT = process.env.PORT ?? '8094';
const OUT = process.env.OUT ?? 'shots/audit-client';
mkdirSync(OUT, { recursive: true });
const BASE = `http://127.0.0.1:${PORT}`;
const SCREENS = process.env.ONLY ? process.env.ONLY.split(',') : [
  'wallet', 'deposits', 'deposits/new', 'deposits/d5', 'payments', 'payments/new', 'payments/p3',
  'beneficiaries', 'history', 'my-code', 'notifications', 'profile', 'support', 'rates',
];
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS,PATCH,DELETE,HEAD', 'access-control-expose-headers': 'content-range' };

// Un JWT « de forme » : supabase-js ne vérifie pas la signature, seulement exp.
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const USER = { id: 'u5', aud: 'authenticated', role: 'authenticated', email: 'fatou@fnimport.com', email_confirmed_at: '2025-05-06T10:00:00Z', app_metadata: { provider: 'email' }, user_metadata: { is_client: true }, created_at: '2025-05-06T10:00:00Z' };
const EXP = Math.floor(Date.now() / 1000) + 6 * 3600;
const TOKEN = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, aud: 'authenticated', role: 'authenticated', email: USER.email, exp: EXP })}.sig`;
const SESSION = { access_token: TOKEN, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 6 * 3600, expires_at: EXP, user: USER };

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', colorScheme: (process.env.THEME === 'dark' ? 'dark' : 'light') });
await ctx.addInitScript((session) => { try { localStorage.setItem('bonzini-client-auth', JSON.stringify(session)); } catch {} }, SESSION);
await ctx.route('**/*supabase.co/**', (route) => {
  const req = route.request();
  if (req.url().includes('/auth/v1/user')) return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(USER) });
  if (req.url().includes('/auth/v1/token')) return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(SESSION) });
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
