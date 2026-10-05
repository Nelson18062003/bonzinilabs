/**
 * Trésorerie — une opération (achat ou vente) lue pour l'écran.
 *
 * Achat et vente n'ont pas les mêmes colonnes ; les écrans, eux, veulent la
 * même chose : la contrepartie, l'USDT, la contre-valeur DANS SA DEVISE, le
 * taux AVEC SON UNITÉ et les comptes touchés. L'ancienne table mélangeait
 * XAF/USDT (~600) et CNY/USDT (~7) dans une même colonne « Taux », sans unité.
 */
import type { OperationRow } from '@/hooks/useTreasury';
import { normalizeText } from '@/lib/clientSearch';
import { counterpartyLabel } from './treasuryLabels';
import type { TreasuryCurrency } from './treasuryFormat';

export interface OperationView {
  kind: 'purchase' | 'sale';
  id: string;
  at: string;
  voided: boolean;
  counterpartyId: string | null;
  counterparty: string;
  counterpartyShort: string | null;
  usdt: number;
  counter: number;
  counterCur: TreasuryCurrency;
  rate: number | null;
  rateUnit: string;
  rateDecimals: number;
  /** « Afriland », « MTN · UBA », ou « — » pour une vente sans compte CNY. */
  accounts: string;
  ref: string | null;
  notes: string | null;
}

export function viewOperation(op: OperationRow): OperationView {
  if (op.kind === 'purchase') {
    const debits = op.debit_accounts ?? [];
    const accounts = debits.length > 0 ? debits.map((d) => d.label).join(' · ') : (op.xaf_account?.label ?? '—');
    return {
      kind: 'purchase',
      id: op.id,
      at: op.occurred_at,
      voided: !!op.voided_at,
      counterpartyId: op.supplier?.id ?? op.supplier_id ?? null,
      counterparty: counterpartyLabel(op.supplier),
      counterpartyShort: op.supplier?.short_id ?? null,
      usdt: Number(op.usdt_amount),
      counter: Number(op.xaf_amount),
      counterCur: 'XAF',
      rate: op.implicit_rate != null ? Number(op.implicit_rate) : null,
      rateUnit: 'XAF / USDT',
      rateDecimals: 2,
      accounts,
      ref: op.external_ref ?? null,
      notes: op.notes ?? null,
    };
  }
  return {
    kind: 'sale',
    id: op.id,
    at: op.occurred_at,
    voided: !!op.voided_at,
    counterpartyId: op.buyer?.id ?? op.buyer_id ?? null,
    counterparty: counterpartyLabel(op.buyer),
    counterpartyShort: op.buyer?.short_id ?? null,
    usdt: Number(op.usdt_amount),
    counter: Number(op.cny_amount),
    counterCur: 'CNY',
    rate: op.implicit_rate != null ? Number(op.implicit_rate) : null,
    rateUnit: 'CNY / USDT',
    rateDecimals: 4,
    accounts: op.cny_account?.label ?? '—',
    ref: op.external_ref ?? null,
    notes: op.notes ?? null,
  };
}

/** Totaux d'une liste d'opérations actives d'un même sens. */
export function totalsOf(ops: OperationView[]) {
  const usdt = ops.reduce((s, o) => s + o.usdt, 0);
  const counter = ops.reduce((s, o) => s + o.counter, 0);
  return { count: ops.length, usdt, counter, avgRate: usdt > 0 ? counter / usdt : null };
}

/** Recherche plein texte d'une opération (contrepartie, comptes, référence, note, montants). */
export function matchesQuery(o: OperationView, q: string): boolean {
  if (!q) return true;
  const hay = normalizeText([o.counterparty, o.accounts, o.ref ?? '', o.notes ?? '', String(Math.round(o.usdt)), String(Math.round(o.counter))].join(' '));
  return normalizeText(q).split(' ').every((t) => hay.includes(t));
}
