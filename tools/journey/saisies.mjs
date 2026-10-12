// ============================================================
// Captures du lot 10 (12/10/2026) — domaine « saisies » :
//   node tools/shoot-journey.mjs saisies [écran…]
// Les saisies en fenêtre (achat d'USDT, nouveau dépôt, nouveau paiement) à
// 1440 px, et l'assistant de paiement mobile à 390 px. Chaque capture est
// REMPLIE comme le ferait l'opérateur (clics et frappes réels).
// ============================================================

const accounts = [
  { id: 'acc1', label: 'Afriland — compte courant', currency: 'XAF', balance: 18_400_000, is_active: true, kind: 'bank' },
  { id: 'acc2', label: 'Orange Money (flotte)', currency: 'XAF', balance: 3_200_000, is_active: true, kind: 'mobile_money' },
  { id: 'acc3', label: 'Caisse Douala', currency: 'XAF', balance: 5_750_000, is_active: true, kind: 'cash' },
  { id: 'acc4', label: 'Binance', currency: 'USDT', balance: 18_250.5, is_active: true, kind: 'exchange' },
];
const suppliers = [
  { id: 'sup1', type: 'usdt_supplier', display_name: 'Eric — KASSUMAYE', short_id: 'F-001', phone: '+86 138 0219 4471', wechat_id: 'eric_gz', is_archived: false },
  { id: 'sup2', type: 'usdt_supplier', display_name: 'Wang Fang', short_id: 'F-002', phone: null, wechat_id: null, is_archived: false },
];

export const REST = (url) => {
  if (url.includes('/treasury_account_balances')) return accounts;
  if (url.includes('/treasury_accounts')) return accounts;
  if (url.includes('/treasury_counterparties')) return suppliers;
  if (url.includes('/usdt_purchases')) return [{ occurred_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), usdt_amount: 10_000, xaf_amount: 6_552_000 }];
  if (url.includes('/beneficiaries')) return [];
  return undefined;
};

export const RPC = {
  get_wac_usdt: 652.4,
  get_usdt_stock: 18_250.5,
};

const D = { desktop: true, wait: 1500 };
const M = { wait: 1500, fullPage: false };

async function pick(page, trigger, option) {
  await page.getByRole('button', { name: trigger, exact: true }).click();
  await page.getByRole('option', { name: option }).first().click();
}

export const SCREENS = [
  { key: 'j.saisies.achat', name: 'd-1-achat-fenetre', ...D },
  {
    key: 'j.saisies.achatplusieurs', name: 'd-2-achat-plusieurs-comptes', ...D,
    before: async (page) => {
      await pick(page, 'Fournisseur', /Eric/);
      await page.getByRole('button', { name: /Plusieurs comptes/ }).click();
      await pick(page, 'Compte 1', /Afriland/);
      await pick(page, 'Compte 2', /Orange Money/);
      await page.getByLabel('Montant payé par le compte 1').fill('6000000');
      await page.getByLabel('Montant payé par le compte 2').fill('2500000');
      await page.getByLabel(/^Taux/).fill('655,20');
      await page.getByRole('heading', { name: 'Nouvel achat d’USDT' }).click();
    },
  },
  {
    key: 'j.saisies.achatreste', name: 'd-3-achat-reste-automatique', ...D,
    before: async (page) => {
      await pick(page, 'Fournisseur', /Wang Fang/);
      await page.getByLabel(/^Montant payé \(total\)/).fill('10000000');
      await page.getByRole('button', { name: 'Reprendre ce taux' }).click();
      await page.getByRole('button', { name: /Plusieurs comptes/ }).click();
      await pick(page, 'Compte 1', /Afriland/);
      await pick(page, 'Compte 2', /Caisse Douala/);
      await page.getByLabel('Montant payé par le compte 1').fill('7500000');
      await page.getByRole('heading', { name: 'Nouvel achat d’USDT' }).click();
    },
  },
  {
    key: 'j.saisies.depot', name: 'd-4-depot-fenetre', ...D,
    before: async (page) => {
      await page.getByLabel('Montant du dépôt').fill('500000');
      await page.getByRole('button', { name: /Orange Money/ }).click();
      await page.getByRole('button', { name: /Code marchand/ }).click();
      await page.getByRole('button', { name: /Coordonnées à donner au client/ }).click();
    },
  },
  {
    key: 'j.saisies.paiement', name: 'd-5-paiement-alipay', ...D,
    before: async (page) => {
      await page.getByRole('button', { name: 'Client', exact: true }).click();
      await page.getByRole('option', { name: /Clarisse Ngo Bell/ }).click();
      await page.getByRole('button', { name: /Alipay/ }).click();
      await page.getByLabel('Le client paie (XAF)').fill('650000');
      await page.getByRole('tab', { name: 'Nouveau' }).click();
      await page.getByLabel('Nom du bénéficiaire').fill('Zhang Wei');
      await page.getByLabel('Compte Alipay (téléphone)').fill('13802194471');
      await page.getByLabel(/^Email/).fill('zhang.wei@163.com');
      await page.getByRole('heading', { name: 'Nouveau paiement' }).click();
    },
  },
  {
    key: 'j.saisies.paiementwechat', name: 'd-6-paiement-wechat-erreur', ...D,
    before: async (page) => {
      await page.getByRole('button', { name: 'Client', exact: true }).click();
      await page.getByRole('option', { name: /Jean-Paul Mbarga/ }).click();
      await page.getByRole('button', { name: /WeChat/ }).click();
      await page.getByLabel('Le client paie (XAF)').fill('800000');
      await page.getByRole('tab', { name: 'Nouveau' }).click();
      await page.getByLabel('Compte WeChat (ID WeChat)').fill('8linmei');
      await page.getByRole('heading', { name: 'Nouveau paiement' }).click();
      const body = page.locator('[data-scroll-root]');
      await body.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    },
  },
  {
    key: 'j.saisies.mobilepaiement', name: 'm-1-assistant-alipay', ...M,
    before: async (page) => {
      await page.getByText('Clarisse Ngo Bell').first().click();
      await page.getByRole('button', { name: 'Suivant' }).click().catch(() => undefined);
      await page.getByText('Alipay', { exact: true }).first().click();
      await page.getByRole('button', { name: 'Suivant' }).click().catch(() => undefined);
      await page.locator('input[inputmode="numeric"], input[inputmode="decimal"]').first().fill('500000');
      await page.getByRole('button', { name: 'Suivant' }).click();
      await page.getByRole('button', { name: /Nouveau/ }).first().click().catch(() => undefined);
      await page.getByLabel('Compte Alipay (téléphone)').fill('13802194471');
      await page.getByLabel(/^Email/).fill('Zhang.Wei@163.com');
      await page.getByLabel('Compte Alipay (téléphone)').scrollIntoViewIfNeeded();
    },
  },
];
