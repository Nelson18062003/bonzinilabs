// ============================================================
// Captures du kit du tableau de bord des ventes (08/10) — domaine « salesdash » :
//   node tools/shoot-journey.mjs salesdash [écran…]
// Une planche par brique (src/__screenshot__/journey/salesdash.tsx), chacune
// dans les deux matières (administration, puis « /v »), en clair et en sombre,
// sur ordinateur (1440 px) et sur téléphone (390 px).
// Données : sales_series servie par le générateur déterministe
// tools/journey/salesSeriesFixture.mjs (trois fiches dont une archivée).
// Fiches spéciales des planches : « src-vide » (aucune activité), « src-erreur » (refus du serveur).
// ============================================================
import { emptySalesSeries, salesSeriesResponse } from './salesSeriesFixture.mjs';

export const RPC = {
  sales_series: (b) => {
    if (b.p_source_id === 'src-vide') return emptySalesSeries(b);
    if (b.p_source_id === 'src-erreur') return { success: false, error: 'Accès non autorisé' };
    return salesSeriesResponse(b);
  },
};

async function fonts(page) {
  for (let i = 0; i < 6; i++) {
    const ok = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some((f) => /DM Sans/.test(f.family) && f.status === 'loaded');
    });
    if (ok) return;
    // La police vient de Google Fonts, par le mandataire : parfois elle échoue, on recharge.
    await page.waitForTimeout(400 * (i + 1));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
  }
}
const dark = async (page) => {
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(250);
};
/** Laisse finir les animations d'entrée des graphiques (450 à 600 ms). */
const settle = (page) => page.waitForTimeout(900);

const BOARDS = [
  ['kpis', '01-tuiles'],
  ['evolution', '02-evolution'],
  ['cargo', '03-fret-avion'],
  ['funnel', '04-prospects'],
  ['leaderboard', '05-classement'],
  ['states', '06-etats'],
];

const variants = (key, name, extra) => [
  { key, name: `${name}-ordinateur-clair`, desktop: true, fullPage: true, before: async (p) => { await fonts(p); if (extra) await extra(p); await settle(p); } },
  { key, name: `${name}-ordinateur-sombre`, desktop: true, fullPage: true, before: async (p) => { await fonts(p); await dark(p); if (extra) await extra(p); await settle(p); } },
  { key, name: `${name}-telephone-clair`, fullPage: true, before: async (p) => { await fonts(p); if (extra) await extra(p); await settle(p); } },
  { key, name: `${name}-telephone-sombre`, fullPage: true, before: async (p) => { await fonts(p); await dark(p); if (extra) await extra(p); await settle(p); } },
];

/** Survole une barre du graphique d'évolution : l'info-bulle, la valeur de chaque commercial et le total. */
async function hoverEvolution(page) {
  const chart = page.locator('[data-chart="evolution"] .recharts-surface').first();
  await chart.waitFor();
  const box = await chart.boundingBox();
  if (!box) return;
  // L'avant-dernière période (septembre), à 80 % de la largeur du tracé environ.
  await page.mouse.move(box.x + box.width * 0.86, box.y + box.height * 0.5);
  await page.waitForTimeout(300);
}

export const SCREENS = [
  ...BOARDS.flatMap(([b, name]) => variants(`j.salesdash.${b}`, name)),
  // L'info-bulle du graphique d'évolution (ordinateur, clair et sombre ; téléphone, clair).
  ...variants('j.salesdash.evolution', '07-info-bulle', hoverEvolution).filter((v) => !v.name.endsWith('telephone-sombre')).map((v) => ({ ...v, fullPage: false })),
  // La vue tableau et une série masquée dans la légende.
  {
    key: 'j.salesdash.evolution', name: '08-tableau-et-legende-ordinateur-clair', desktop: true, fullPage: true,
    before: async (p) => {
      await fonts(p);
      await p.getByRole('button', { name: /^Hervé Nkoulou/ }).first().click();
      await p.getByRole('button', { name: 'Tableau' }).first().click();
      await settle(p);
    },
  },
  // Les tuiles sur 12 semaines (le segmenté a glissé).
  {
    key: 'j.salesdash.kpis', name: '09-tuiles-12-semaines-telephone-clair', fullPage: true,
    before: async (p) => {
      await fonts(p);
      await p.getByRole('radio', { name: '12 semaines' }).first().click();
      await settle(p);
    },
  },
];
