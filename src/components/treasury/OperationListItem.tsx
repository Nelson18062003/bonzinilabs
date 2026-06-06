import { ArrowDownToLine, ArrowUpFromLine, Ban, ChevronRight, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OperationRow } from '@/hooks/useTreasury';

const nf = (n: number, d = 2) =>
  Number(n).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });

/**
 * Single, shared list row for a treasury operation (purchase OR sale).
 * Replaces the 3 near-identical cards (history / purchases / sales).
 *
 * Craft: clear hierarchy — counterparty → meta → conversion (own line) →
 * rate (own muted line, never orphaned). `min-w-0` + truncation keep it tidy
 * down to 360px. Right slot is a delete action (super-admin, non-voided) or a
 * chevron affordance.
 */
export function OperationListItem({
  op,
  onClick,
  onDelete,
  canDelete = false,
}: {
  op: OperationRow;
  onClick: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
}) {
  const isPurchase = op.kind === 'purchase';
  const voided = !!op.voided_at;
  const name = (isPurchase ? op.supplier?.display_name : op.buyer?.display_name) ?? '—';

  const from = isPurchase
    ? { v: Number(op.xaf_amount), u: 'XAF', d: 0 }
    : { v: Number(op.usdt_amount), u: 'USDT', d: 2 };
  const to = isPurchase
    ? { v: Number(op.usdt_amount), u: 'USDT', d: 2 }
    : { v: Number(op.cny_amount), u: 'CNY', d: 2 };
  const rateUnit = isPurchase ? 'XAF/USDT' : 'CNY/USDT';
  const accountLabel = !isPurchase && op.cny_account?.label ? op.cny_account.label : null;
  const showDelete = canDelete && !voided && !!onDelete;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border bg-card p-3.5',
        voided
          ? 'border-border opacity-60'
          : isPurchase
            ? 'border-violet-200 dark:border-violet-500/30'
            : 'border-amber-200 dark:border-amber-500/30',
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white',
          voided ? 'bg-slate-400 dark:bg-slate-600' : isPurchase ? 'bg-violet-600' : 'bg-amber-500',
        )}
      >
        {voided ? <Ban className="h-4 w-4" /> : isPurchase ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
      </div>

      <button onClick={onClick} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold text-foreground">{name}</span>
          {voided && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
              Annulée
            </span>
          )}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {fmtDate(op.occurred_at)}
          {accountLabel ? ` · ${accountLabel}` : ''}
        </div>

        {/* Conversion — prominent, one line */}
        <div className="mt-1 text-[13px] font-bold tabular-nums text-foreground">
          {nf(from.v, from.d)}
          <span className="ml-0.5 text-[11px] font-medium text-muted-foreground">{from.u}</span>
          <span className="mx-1 font-normal text-muted-foreground">→</span>
          {nf(to.v, to.d)}
          <span className="ml-0.5 text-[11px] font-medium text-muted-foreground">{to.u}</span>
        </div>

        {/* Rate — secondary, muted, own line (never orphaned) */}
        <div className="text-[11px] tabular-nums text-muted-foreground">
          @ {nf(Number(op.implicit_rate), 4)} {rateUnit}
        </div>
      </button>

      {showDelete ? (
        <button
          onClick={onDelete}
          aria-label="Supprimer"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
    </div>
  );
}
