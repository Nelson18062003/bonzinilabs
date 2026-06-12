// Crisp, READABLE captures of the real Taux module (MobileRatesScreen).
// Fix for "images too tall to read": shoot each section as its own
// element screenshot at deviceScaleFactor 3 (iPhone 14) → naturally sized,
// sharp. Data comes from the SCREENSHOT_MOCK fixtures (mockDailyRates.ts),
// so the simulator shows a real computed result. Run with vite started as:
//   SCREENSHOT_MOCK=1 npx vite --host 127.0.0.1 --port 8080
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

mkdirSync('shots', { recursive: true });
const PORT = process.env.PORT || '8080';
const iPhone = devices['iPhone 14']; // 390px wide, deviceScaleFactor 3
const URL = (theme) => `http://127.0.0.1:${PORT}/screenshot.html?screen=rates&theme=${theme}&font=dm`;

// Sections to capture, by their exact Caption heading text.
const SECTIONS = [
  ['definir', 'Définir les taux du jour'],
  ['simulateur', 'Simulateur'],
  ['historique', 'Historique'],
];

const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ ...iPhone, colorScheme: theme, locale: 'fr-FR' });
    const page = await ctx.newPage();
    await page.goto(URL(theme), { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(900); // let fonts + layout settle
    // Hide the sticky header so it doesn't overlap the top section in element shots.
    await page.addStyleTag({ content: 'header{display:none !important}' });

    // Per-section crisp element shots.
    for (const [slug, heading] of SECTIONS) {
      const section = page.locator('section', {
        has: page.getByRole('heading', { name: heading, exact: true }),
      });
      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      await section.screenshot({ path: `shots/rates-${slug}-${theme}.png` });
      console.log(`✓ rates-${slug}-${theme}.png`);
    }

    // Simulateur with the calculation detail expanded (proves nothing was lost).
    const simSection = page.locator('section', {
      has: page.getByRole('heading', { name: 'Simulateur', exact: true }),
    });
    const detailBtn = simSection.getByRole('button', { name: /Voir le détail du calcul/ });
    if (await detailBtn.count()) {
      await detailBtn.first().click();
      await page.waitForTimeout(250);
      await simSection.screenshot({ path: `shots/rates-simulateur-detail-${theme}.png` });
      console.log(`✓ rates-simulateur-detail-${theme}.png`);
    }

    // Réglages — expand "Ajustements pays & tranches", shoot the whole section.
    const reglagesBtn = page.getByRole('button', { name: /Ajustements pays/ });
    if (await reglagesBtn.count()) {
      await reglagesBtn.first().scrollIntoViewIfNeeded();
      await reglagesBtn.first().click();
      await page.waitForTimeout(450);
      const reglagesSection = page.locator('section', {
        has: page.getByRole('heading', { name: 'Réglages', exact: true }),
      });
      await reglagesSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
      await reglagesSection.screenshot({ path: `shots/rates-reglages-${theme}.png` });
      console.log(`✓ rates-reglages-${theme}.png`);
    }

    // Graphique d'évolution — expand, shoot just the chart content.
    const chartBtn = page.getByRole('button', { name: /Graphique d/ });
    if (await chartBtn.count()) {
      await chartBtn.first().scrollIntoViewIfNeeded();
      await chartBtn.first().click();
      await page.waitForTimeout(600);
      const chartContent = chartBtn.first().locator('xpath=following-sibling::div[1]');
      await chartContent.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      await chartContent.screenshot({ path: `shots/rates-graphique-${theme}.png` });
      console.log(`✓ rates-graphique-${theme}.png`);
    }

    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log('done');
