/**
 * Mesure les axes X du tableau de bord desktop sur huit plages, en pilotant
 * le VRAI sélecteur (clics sur les presets, jours cliqués dans le calendrier).
 *
 * Pour chaque scénario : nombre de barres et d'étiquettes, chevauchements
 * détectés (rectangles de texte qui se croisent), première et dernière
 * étiquette, et une capture pleine page. C'est ce qui a chiffré le défaut
 * « axes bizarres » (« Cette année » = 730 barres journalières, « Aujourd'hui »
 * = 1 seul seau) et prouvé la correction (24 mois / 24 heures).
 *
 * Prérequis : SCREENSHOT_MOCK=1 npx vite --port 8100
 * Usage     : OUT=shots/axes/after ONLY=today,this-year node tools/axes-check.mjs 8100
 */
import { chromium } from '@playwright/test';
import { respond, headCount, qrSvg, proofSvg } from '/home/user/bonzinilabs/tools/adminFixtures.mjs';

const PORT = process.argv[2] ?? '8100';
const OUT = process.env.OUT ?? '/home/user/bonzinilabs/shots/axes';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS,PATCH,DELETE,HEAD', 'access-control-expose-headers': 'content-range' };

// Scénarios : le NOM du preset tel qu'affiché dans le sélecteur, ou une
// plage personnalisée { from, to } en 'yyyy-MM-dd'.
const SCENARIOS = [
  { key: 'today', preset: "Aujourd'hui" },
  { key: 'this-week', preset: 'Cette semaine' },
  { key: 'this-month', preset: 'Ce mois' },
  { key: 'last-90', preset: '90 derniers jours' },
  { key: 'this-year', preset: 'Cette année' },
  { key: 'custom-aug', custom: { from: '2026-08-01', to: '2026-08-31' } },
  { key: 'custom-6m', custom: { from: '2026-03-01', to: '2026-08-31' } },
  // Le pire cas rapporté : « Aujourd'hui » (par heure) PUIS une longue plage.
  { key: 'today-then-6m', preset: "Aujourd'hui", then: { from: '2026-03-01', to: '2026-08-31' } },
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, timezoneId: 'Africa/Douala' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route('**/*supabase.co/**', (route) => {
  const req = route.request(); const url = req.url();
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS, body: '' });
  if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { ...CORS, 'content-range': `0-0/${headCount(url)}` }, body: '' });
  if (req.method() === 'GET' && url.includes('/storage/v1/object/fake/')) return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'image/svg+xml' }, body: url.includes('qr') ? qrSvg : proofSvg });
  let body = respond(url);
  if ((req.headers()['accept'] ?? '').includes('pgrst.object') && Array.isArray(body)) body = body[0] ?? null;
  return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json', 'content-range': `0-9/${Array.isArray(body) ? body.length : 1}` }, body: JSON.stringify(body) });
});

async function openPicker() {
  // Le déclencheur porte l'icône calendrier + le libellé de la période.
  await page.locator('button:has(svg.lucide-calendar-days)').first().click();
  await page.waitForTimeout(250);
}

async function choosePreset(label) {
  await openPicker();
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(1200);
}

async function chooseCustom({ from, to }) {
  await openPicker();
  const fromD = new Date(from + 'T12:00:00'); const toD = new Date(to + 'T12:00:00');
  await clickDay(fromD); await clickDay(toD);
  // Le popover peut dépasser la fenêtre : on clique OK dans le DOM, sans
  // exiger qu'il soit dans la zone visible.
  const state = await page.evaluate(() => {
    const ok = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'OK');
    if (!ok) return 'absent';
    if (ok.disabled) return 'désactivé';
    ok.click();
    return 'cliqué';
  });
  if (state !== 'cliqué') throw new Error(`bouton OK ${state} : les deux bornes ne sont pas posées`);
  await page.waitForTimeout(1200);
}

// Amène le calendrier sur (année, mois) puis clique le jour DU MOIS AFFICHÉ
// (les jours hors-mois portent la classe opacity-35).
async function clickDay(d) {
  const MONTHS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  const wantIdx = d.getMonth() + 12 * d.getFullYear();
  for (let i = 0; i < 36; i++) {
    const header = await page.evaluate(() => {
      const prev = document.querySelector('button[aria-label="Mois précédent"]');
      const span = prev?.parentElement?.querySelector('span');
      return span?.textContent?.trim() ?? '';
    });
    const m = header.toLowerCase().match(/^([a-zéû]+)\.?\s+(\d{4})$/);
    if (!m) throw new Error(`en-tête de mois illisible : « ${header} »`);
    const shownMonth = MONTHS.findIndex((x) => m[1].startsWith(x));
    if (shownMonth < 0) throw new Error(`mois inconnu : « ${m[1]} »`);
    const shownIdx = shownMonth + 12 * Number(m[2]);
    if (shownIdx === wantIdx) break;
    await page.locator(`button[aria-label="${wantIdx < shownIdx ? 'Mois précédent' : 'Mois suivant'}"]`).click();
    await page.waitForTimeout(60);
  }
  const clicked = await page.evaluate((dayNum) => {
    const prev = document.querySelector('button[aria-label="Mois précédent"]');
    const card = prev?.closest('.rounded-2xl');
    const btns = [...(card?.querySelectorAll('button') ?? [])].filter((b) =>
      b.textContent.trim() === String(dayNum) && !b.className.includes('opacity-35') && !b.disabled);
    if (!btns.length) return false;
    btns[0].click();
    return true;
  }, d.getDate());
  if (!clicked) throw new Error(`jour ${d.getDate()} introuvable ou désactivé`);
  await page.waitForTimeout(150);
}

// Mesure les étiquettes de l'axe X de chaque graphique Recharts.
async function measureAxes() {
  return page.evaluate(() => {
    const charts = [...document.querySelectorAll('.recharts-wrapper')];
    return charts.map((c, i) => {
      const ticks = [...c.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick-value')];
      const rects = ticks.map((t) => t.getBoundingClientRect());
      let overlaps = 0;
      for (let a = 0; a < rects.length; a++) for (let b = a + 1; b < rects.length; b++) {
        const A = rects[a], B = rects[b];
        if (A.left < B.right && B.left < A.right && A.top < B.bottom && B.top < A.bottom) overlaps++;
      }
      const bars = c.querySelectorAll('.recharts-bar-rectangle').length;
      const first = ticks[0]?.textContent ?? '';
      const last = ticks[ticks.length - 1]?.textContent ?? '';
      const title = c.closest('[class*="rounded"]')?.querySelector('h3,[class*="CardTitle"],.text-sm.font-semibold')?.textContent?.trim() ?? `chart#${i}`;
      return { title, labels: ticks.length, overlaps, bars, first, last };
    });
  });
}

const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const results = [];
for (const s of SCENARIOS.filter((x) => !ONLY || ONLY.includes(x.key))) {
  await page.goto(`http://127.0.0.1:${PORT}/screenshot.html?screen=real-dashboard&theme=light&font=dm`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Flux financier'), null, { timeout: 20000 });
  await page.waitForTimeout(800);
  try {
    if (s.preset) await choosePreset(s.preset);
    if (s.custom) await chooseCustom(s.custom);
    if (s.then) await chooseCustom(s.then);
  } catch (e) {
    await page.screenshot({ path: `${OUT}/${s.key}-ERREUR.png`, fullPage: false }).catch(() => {});
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 400)).catch(() => '');
    results.push({ key: s.key, error: String(e).split('\n').slice(0, 3).join(' ⏎ '), bodyText });
    continue;
  }
  const periodLabel = await page.locator('button:has(svg.lucide-calendar-days)').first().textContent();
  const axes = await measureAxes();
  await page.screenshot({ path: `${OUT}/${s.key}.png`, fullPage: true });
  results.push({ key: s.key, periodLabel: periodLabel?.trim(), axes });
}
const fs = await import('node:fs');
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors: errors.slice(0, 5) }, null, 2));
for (const r of results) {
  if (r.error) { console.log(`${r.key.padEnd(16)} ERREUR ${r.error.slice(0, 220)}`); continue; }
  const flux = r.axes.find((a) => a.title.startsWith('Flux')) ?? r.axes[0];
  console.log(`${r.key.padEnd(16)} « ${r.periodLabel} »  flux: ${String(flux?.bars).padStart(4)} barres, ${String(flux?.labels).padStart(3)} étiquettes, ${flux?.overlaps} chevauch., ${flux?.first} → ${flux?.last}`);
}
if (errors.length) console.log('erreurs JS:', errors.slice(0, 3).join(' | '));
await browser.close();
