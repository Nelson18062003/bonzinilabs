/**
 * Trois montants liés — USDT, taux, contre-valeur (XAF ou CNY) — dont on tape
 * DEUX : le troisième se calcule. Plus de « mode » à choisir avant de taper :
 * le champ calculé est simplement celui qu'on a touché en dernier… le moins
 * récemment. Taper dans le champ calculé le reprend en main, et c'est le plus
 * ancien des deux autres qui se calcule à son tour.
 *
 *   contre-valeur = USDT × taux
 *
 * Arrondis : l'USDT à 2 décimales, la contre-valeur à ses décimales (XAF
 * entier, CNY 2), le taux n'est jamais arrondi dans le calcul.
 */
import { useState } from 'react';

export type AmountField = 'usdt' | 'rate' | 'counter';

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

export function useLinkedAmounts(counterDecimals: number) {
  const [typed, setTyped] = useState<Record<AmountField, number | null>>({ usdt: null, rate: null, counter: null });
  const [order, setOrder] = useState<AmountField[]>([]);

  const lastTwo = order.slice(-2);
  const computed: AmountField = (['counter', 'usdt', 'rate'] as const).find((f) => !lastTwo.includes(f)) ?? 'counter';

  const { usdt, rate, counter } = typed;
  let r: Record<AmountField, number | null>;
  if (computed === 'counter') r = { usdt, rate, counter: usdt && rate ? round(usdt * rate, counterDecimals) : null };
  else if (computed === 'usdt') r = { usdt: counter && rate ? round(counter / rate, 2) : null, rate, counter };
  else r = { usdt, rate: usdt && counter ? counter / usdt : null, counter };

  const set = (field: AmountField, v: number | null) => {
    setTyped((t) => ({ ...t, [field]: v }));
    setOrder((o) => [...o.filter((f) => f !== field), field]);
  };

  return { ...r, computed, set, touched: order.length > 0 };
}
