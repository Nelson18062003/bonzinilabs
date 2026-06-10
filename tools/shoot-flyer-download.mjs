// Preuve de bout en bout : clique réellement « Télécharger le flyer » dans le
// panneau du module Taux et sauvegarde le FICHIER TÉLÉCHARGÉ (PNG sombre +
// clair, et un PDF). Vérifie que export == aperçu (nouveau design).
import { chromium, devices } from '@playwright/test';
import { mkdirSync, statSync } from 'node:fs';

mkdirSync('shots', { recursive: true });
const PORT = process.env.PORT || '8080';
const iPhone = devices['iPhone 14'];

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...iPhone, locale: 'fr-FR', acceptDownloads: true });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${PORT}/screenshot.html?screen=rates&theme=light&font=dm`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(800);

// Ouvre le panneau flyer
await page.getByRole('button', { name: /Voir le flyer du jour/ }).click();
await page.waitForTimeout(1200); // sheet + logo + fonts

async function grab(btnName, outPath) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.getByRole('button', { name: btnName }).click(),
  ]);
  await download.saveAs(outPath);
  const kb = Math.round(statSync(outPath).size / 1024);
  console.log(`✓ ${outPath} (${kb} KB, nom suggéré: ${download.suggestedFilename()})`);
}

// PNG sombre (état par défaut du toggle)
await grab(/Télécharger le flyer/, 'shots/flyer-DL-dark.png');

// PNG clair
await page.getByRole('button', { name: 'Clair', exact: true }).click();
await page.waitForTimeout(700);
await grab(/Télécharger le flyer/, 'shots/flyer-DL-light.png');

// PDF (clair)
await grab(/^PDF$/, 'shots/flyer-DL-light.pdf');

await browser.close();
console.log('done');
