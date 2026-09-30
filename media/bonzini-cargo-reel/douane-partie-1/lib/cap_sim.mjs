// Screenshot the real Bonzini customs simulator (branch claude/bonzini-cameroon-tariff-3b9uli, local dev server, no data) for the video.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const OUT = process.argv[2]; const BASE = 'http://127.0.0.1:8093';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: 'fr-FR' });
const page = await ctx.newPage();
page.on('pageerror', e => console.error('PAGEERR', e.message.slice(0, 160)));
const hideFloaters = async () => page.evaluate(() => { for (const el of document.querySelectorAll('body *')) { const s = getComputedStyle(el); if (s.position === 'fixed' && el.getBoundingClientRect().bottom > innerHeight - 140 && el.getBoundingClientRect().width < 120) el.style.display = 'none'; } });
await page.goto(BASE + '/douane/simulateur', { waitUntil: 'networkidle' }); await page.waitForTimeout(2000); await hideFloaters();
await page.screenshot({ path: OUT + '/sim_01_empty.png' });
// type the market word letter by letter
const box = page.locator('input').first(); await box.click();
for (const [i, ch] of [...'mèches'].entries()) { await box.type(ch, { delay: 30 }); if (i === 2 || i === 5) { await page.waitForTimeout(500); await hideFloaters(); await page.screenshot({ path: OUT + `/sim_02_typing_${i}.png` }); } }
await page.waitForTimeout(800); await hideFloaters(); await page.screenshot({ path: OUT + '/sim_03_suggestions.png' });
await page.getByText('6704.19', { exact: false }).first().click(); await page.waitForTimeout(800); await hideFloaters();
await page.screenshot({ path: OUT + '/sim_04_product.png' });
await page.getByRole('button', { name: 'XAF', exact: true }).first().click().catch(() => page.getByText('XAF', { exact: true }).first().click());
const amt = page.locator('#sim-amount'); await amt.click(); await amt.type('1 000 000', { delay: 25 });
const fr = page.locator('#sim-freight'); if (await fr.count()) { await fr.click(); await fr.type('150 000', { delay: 20 }); }
await page.waitForTimeout(1200); await hideFloaters();
await page.screenshot({ path: OUT + '/sim_05_filled.png' });
await page.screenshot({ path: OUT + '/sim_06_full.png', fullPage: true });
console.log('RESULT TEXT:', (await page.innerText('body')).split('4.')[1]?.slice(0, 1600));
await browser.close();
