import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const OUT = process.env.OUT;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
async function exportLabel(port, tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/m/clients/u5`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000);
  const btn = page.getByText('Étiquette colis', { exact: true }).first(); await btn.scrollIntoViewIfNeeded(); await btn.click(); await page.waitForTimeout(3000);
  const dl = page.waitForEvent('download', { timeout: 60000 });
  await page.getByText(/Télécharger l.image/).first().click();
  const d = await dl; await d.saveAs(`${OUT}/export-${tag}.png`); console.log(tag, d.suggestedFilename());
  await ctx.close();
}
await exportLabel(8094, 'avant'); await exportLabel(8093, 'apres');
const html = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#f4f4f5;font-family:DM Sans,system-ui,sans-serif;color:#1e1e1e}h1{margin:0;padding:18px 24px 8px;font-size:22px}p{margin:0 24px 8px;color:#5a5a5a;font-size:15px}.row{display:flex;gap:24px;padding:12px 24px 24px;align-items:flex-start}.col{display:flex;flex-direction:column;gap:8px}.col h2{margin:0;font-size:16px;font-weight:600;color:#5a5a5a}.col img{width:480px;border:1px solid #d9d9d9;background:#fff}.b{color:#c00f0c}.a{color:#009951}</style>
<h1>Étiquette colis — le FICHIER exporté depuis le téléphone</h1><p>Même environnement pour les deux (polices web indisponibles, comme sur un iPhone en 5G qui n’a pas fini de les charger).</p>
<div class=row><div class=col><h2 class=b>Avant (version en ligne)</h2><img src="export-avant.png"></div><div class=col><h2 class=a>Après (branche)</h2><img src="export-apres.png"></div></div>`;
writeFileSync(`${OUT}/export.html`, html);
const metrics = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#f4f4f5;font-family:DM Sans,system-ui,sans-serif;color:#1e1e1e;padding:24px}h1{margin:0 0 14px;font-size:22px}table{border-collapse:collapse;background:#fff;border:1px solid #d9d9d9;border-radius:12px;overflow:hidden;font-size:16px}th,td{padding:12px 16px;text-align:left;border-bottom:1px solid #eee}th{background:#f7f7f7;color:#5a5a5a;font-weight:600}td.b{color:#c00f0c}td.a{color:#009951;font-weight:700}</style>
<h1>Ce qui se mesure — version en ligne (3063bad) → branche</h1><table><tr><th>Mesure</th><th>Avant</th><th>Après</th></tr>
<tr><td>JavaScript au premier chargement de l’app admin (dist/m/index.html)</td><td class=b>4 690 kB</td><td class=a>1 168 kB (−75 %)</td></tr>
<tr><td>Mascotte Mola dans la barre d’onglets</td><td class=b>315 kB (PNG 512 px)</td><td class=a>8 kB (WebP 160 px)</td></tr>
<tr><td>Feuille de polices Google (poids demandés)</td><td class=b>Syne ×5 + DM Sans ×6 + Noto SC ×3, bloquante</td><td class=a>DM Sans variable + Noto SC, non bloquante</td></tr>
<tr><td>Mola : écran après fermeture du clavier iOS</td><td class=b>décalé de 208 px, coupé</td><td class=a>en place</td></tr>
<tr><td>Étiquette colis : temps d’export sur téléphone</td><td class=b>jusqu’à 5 s + gel (polices embarquées)</td><td class=a>≈ 0 s (pré-peinte, canvas)</td></tr>
<tr><td>Partage du PDF sur iPhone</td><td class=b>lien blob: dans un onglet</td><td class=a>fichier dans la feuille de partage</td></tr>
<tr><td>Dépôt annulé validable / paiement annulé « refusable » (2e remboursement)</td><td class=b>oui (serveur et écran)</td><td class=a>non (garde RPC + écran)</td></tr>
<tr><td>Temps réel après un rafraîchissement de jeton</td><td class=b>mort (canal réutilisé en partance)</td><td class=a>vivant (canal unique, dépend de l’id)</td></tr>
<tr><td>Tables cargo dans le temps réel</td><td class=b>aucune</td><td class=a>6 (publication + invalidation)</td></tr>
<tr><td>Cibles tactiles du kit (boutons, puces, champs)</td><td class=b>40 px</td><td class=a>44 px</td></tr>
<tr><td>Débordements / troncatures à 320 px (22 écrans)</td><td class=b>7 écrans</td><td class=a>0</td></tr>
<tr><td>Tests unitaires</td><td class=b>601</td><td class=a>621</td></tr>
</table>`;
writeFileSync(`${OUT}/metrics.html`, metrics);
for (const [f, w] of [['export', 1032], ['metrics', 980]]) { const ctx = await browser.newContext({ viewport: { width: w, height: 600 } }); const page = await ctx.newPage(); await page.goto(`file://${OUT}/${f}.html`); await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/avant-apres-${f}.png`, fullPage: true }); await ctx.close(); }
await browser.close(); console.log('done');
