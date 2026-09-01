/**
 * Trésorerie — formatage partagé (docs/admin-redesign/07).
 *
 * Une seule source pour les décimales et l'écriture des montants : les trois
 * devises n'ont pas la même précision (le XAF n'a pas de centimes, l'USDT et
 * le CNY si), et un même montant doit s'écrire pareil dans la table, le
 * panneau et le récapitulatif de saisie.
 */

export type TreasuryCurrency = 'XAF' | 'USDT' | 'CNY';

/** Décimales d'affichage par devise. Le XAF n'a pas de subdivision en usage. */
export const CURRENCY_DECIMALS: Record<TreasuryCurrency, number> = {
  XAF: 0,
  USDT: 2,
  CNY: 2,
};

/** Décimales d'un taux : XAF/USDT tient en 2, CNY/USDT a besoin de 4. */
export const RATE_DECIMALS = { xafPerUsdt: 2, cnyPerUsdt: 4, xafPerCny: 2 } as const;

export function fmtNum(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtAmount(n: number | null | undefined, currency: TreasuryCurrency): string {
  return fmtNum(n, CURRENCY_DECIMALS[currency]);
}

/*
 * PAS d'abréviation M / k dans ce module.
 *
 * « 18,4 M XAF » perd les 42 000 francs qui séparent deux soldes, et une
 * trésorerie se lit au franc près : le chiffre s'écrit en entier partout,
 * y compris dans la barre d'état. `fmtAmount` est la seule écriture.
 */

/** Signe explicite — un écart ou une marge se lit à son signe avant son chiffre. */
export function withSign(n: number, decimals = 2): string {
  return `${n >= 0 ? '+' : ''}${fmtNum(n, decimals)}`;
}

/**
 * Libellés des natures de compte. L'enum `treasury_account_kind` sortait
 * brut à l'écran (« MOBILE_MONEY », « CRYPTO_POOL ») : une valeur de base de
 * données n'est pas un libellé d'interface.
 */
const ACCOUNT_KIND_LABELS: Record<string, string> = {
  cash: 'Espèces',
  bank: 'Banque',
  mobile_money: 'Mobile money',
  alipay: 'Alipay',
  wechat: 'WeChat',
  crypto_pool: 'Pool crypto',
};

export function accountKindLabel(kind: string | null | undefined): string {
  if (!kind) return '';
  return ACCOUNT_KIND_LABELS[kind] ?? kind.replace(/_/g, ' ');
}
