/**
 * Trésorerie — les données du reçu d'une opération (l'image qu'on envoie au
 * fournisseur ou à l'acheteur comme preuve).
 *
 * Le reçu ne montre que ce qui regarde la contrepartie : montants, taux,
 * compte utilisé, date, référence. Jamais la note interne, le coût moyen ni
 * le grand livre.
 */
import type { LedgerEntry, OperationRow } from '@/hooks/useTreasury';
import type { TreasuryCurrency } from './treasuryFormat';

export interface ReceiptData {
  kind: 'purchase' | 'sale';
  id: string;
  at: string;
  voided: boolean;
  voidReason: string | null;
  usdt: number;
  rate: number | null;
  counter: number;
  counterCur: TreasuryCurrency;
  counterparty: { name: string; short: string | null; phone: string | null; wechat: string | null } | null;
  accounts: Array<{ label: string; amount: number }>;
  ref: string | null;
}

/** « ACH-3F2C9B12 » / « VTE-… » : un numéro court et stable, tiré de l'identifiant. */
export function receiptNumber(kind: 'purchase' | 'sale', id: string): string {
  return `${kind === 'purchase' ? 'ACH' : 'VTE'}-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export function receiptFilename(data: Pick<ReceiptData, 'kind' | 'id'>): string {
  return `bonzini-${data.kind === 'purchase' ? 'achat' : 'vente'}-${receiptNumber(data.kind, data.id)}.png`;
}

/**
 * Le reçu d'une opération enregistrée. Les comptes viennent des écritures
 * quand on les a (un achat réparti en a plusieurs), sinon de la ligne.
 */
export function receiptFromOperation(op: OperationRow, entries?: LedgerEntry[]): ReceiptData {
  const fromEntries = (entries ?? [])
    .filter((e) => e.entry_kind !== 'void' && e.currency !== 'USDT')
    .map((e) => ({ label: e.account?.label ?? '—', amount: Math.abs(Number(e.amount)) }));

  if (op.kind === 'purchase') {
    const cp = op.supplier;
    const fallback =
      (op.debit_accounts ?? []).length > 0
        ? (op.debit_accounts ?? []).map((d) => ({ label: d.label, amount: d.amount }))
        : op.xaf_account
          ? [{ label: op.xaf_account.label, amount: Number(op.xaf_amount) }]
          : [];
    return {
      kind: 'purchase',
      id: op.id,
      at: op.occurred_at,
      voided: !!op.voided_at,
      voidReason: op.void_reason ?? null,
      usdt: Number(op.usdt_amount),
      rate: op.implicit_rate != null ? Number(op.implicit_rate) : null,
      counter: Number(op.xaf_amount),
      counterCur: 'XAF',
      counterparty: cp ? { name: cp.display_name, short: cp.short_id ?? null, phone: cp.phone ?? null, wechat: cp.wechat_id ?? null } : null,
      accounts: fromEntries.length > 0 ? fromEntries : fallback,
      ref: op.external_ref ?? null,
    };
  }
  const cp = op.buyer;
  return {
    kind: 'sale',
    id: op.id,
    at: op.occurred_at,
    voided: !!op.voided_at,
    voidReason: op.void_reason ?? null,
    usdt: Number(op.usdt_amount),
    rate: op.implicit_rate != null ? Number(op.implicit_rate) : null,
    counter: Number(op.cny_amount),
    counterCur: 'CNY',
    counterparty: cp ? { name: cp.display_name, short: cp.short_id ?? null, phone: cp.phone ?? null, wechat: cp.wechat_id ?? null } : null,
    accounts: fromEntries.length > 0 ? fromEntries : op.cny_account ? [{ label: op.cny_account.label, amount: Number(op.cny_amount) }] : [],
    ref: op.external_ref ?? null,
  };
}
