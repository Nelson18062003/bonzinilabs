// Usage : node shot.cjs <fichier.html> <dossier-sortie>  → un PNG par écran (01.png, 02.png…)
const { chromium } = require('/home/user/bonzinilabs/node_modules/playwright');
const path = require('path'); const fs = require('fs');
(async () => {
  const [file, out] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 2100, height: 1200 }, deviceScaleFactor: 3 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(file), { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(600);
  const n = await p.locator('.shot').count();
  for (let i = 1; i <= n; i++) await p.locator('#s' + i + ' .ab').screenshot({ path: path.join(out, String(i).padStart(2, '0') + '.png') });
  console.log('screens', n, 'errors', JSON.stringify(errs));
  await b.close();
})();
