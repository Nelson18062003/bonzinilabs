import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'node:path'; import url from 'node:url';
const HERE = '/tmp/claude-0/-home-user-bonzinilabs/5fd5d24c-f443-5c7d-8c0d-137b9d5733f0/scratchpad/explainer/overlay';
const b = await chromium.launch({ args: ['--disable-gpu'] }); const p = await b.newPage();
await p.goto(url.pathToFileURL(path.join(HERE, 'engine.html')).href);
const r = await p.evaluate(async () => {
  for (const f of ['900 10px Orbitron', '700 10px Orbitron', '700 10px Chakra', '800 10px DMSans', '700 10px DMSans']) await document.fonts.load(f);
  const out = {};
  const T = [['NOTRE ENTREPÔT', '800 54px DMSans', 1], ['PAR BATEAU', '700 52px Chakra', 3], ['PAR CAMION', '700 52px Chakra', 3], ['CHINE', '800 60px DMSans', 4],
    ['Déchargement', '800 60px DMSans', 0], ['Déchargement', '700 60px Chakra', 0], ['6 ÉTAPES', '900 110px Orbitron', 0], ['ÉTAPES', '900 104px Orbitron', 0], ['EN TOUTE SÉCURITÉ', '800 50px DMSans', 0], ['SÉCURITÉ', '800 56px DMSans', 1], ['06', '900 50px Orbitron', 0]];
  for (const [s, f, ls] of T) out[s + ' | ' + f] = Math.round(measure(s, f, ls));
  return out;
});
console.log(r); await b.close();
