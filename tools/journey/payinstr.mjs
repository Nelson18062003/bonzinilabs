// ============================================================
// Captures du lot 9 (12/10/2026) — domaine « payinstr » :
//   node tools/shoot-journey.mjs payinstr [écran…]
// L'instruction de paiement sur téléphone (390 px) et le menu latéral
// repliable de l'ordinateur (1440 px). Données : tools/adminFixtures.mjs.
// ============================================================
import { qrSvg } from '../adminFixtures.mjs';

/** Le QR signé du paiement p5 : une image, pas le JSON du module générique. */
async function qrImage(page) {
  await page.route(/\/storage\/v1\/object\/fake\//, (r) =>
    r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'image/svg+xml' }, body: qrSvg }),
  );
}
const rail = (collapsed) => async (page) => {
  await page.addInitScript((v) => { try { localStorage.setItem('bz.desktop.sidebar', v); } catch { /* privé */ } }, collapsed ? 'collapsed' : 'expanded');
};

export const SCREENS = [
  { key: 'j.payinstr.detail', name: 'm-1-fiche-alipay', init: qrImage, wait: 1200 },
  { key: 'j.payinstr.sheet', name: 'm-2-feuille-alipay', init: qrImage, wait: 2500, fullPage: false },
  { key: 'j.payinstr.sheet', name: 'm-3-feuille-alipay-bas', init: qrImage, wait: 2500, fullPage: false,
    before: async (page) => { await page.evaluate(() => { const el = [...document.querySelectorAll('[role="dialog"] *')].find((n) => n.scrollHeight > n.clientHeight + 20 && getComputedStyle(n).overflowY !== 'visible'); el?.scrollTo(0, el.scrollHeight); }); await page.waitForTimeout(300); } },
  { key: 'j.payinstr.sheetbank', name: 'm-4-feuille-virement', wait: 2500, fullPage: false },
  { key: 'j.payinstr.deskopen', name: 'd-1-menu-deplie', desktop: true, init: rail(false), wait: 1500 },
  { key: 'j.payinstr.deskrail', name: 'd-2-menu-reduit', desktop: true, init: rail(true), wait: 1500 },
  { key: 'j.payinstr.desktip', name: 'd-3-menu-reduit-infobulle', desktop: true, init: rail(true), wait: 1500,
    before: async (page) => { await page.hover('a[href="/m/payments"]'); await page.waitForTimeout(500); } },
];
