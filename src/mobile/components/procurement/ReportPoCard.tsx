import { cn } from '@/lib/utils';
import { INSET, SOFT_CARD } from '@/components/treasury/ui';
import { PO_STATUS_LABEL } from '@/mobile/screens/procurement/shared';
import type { ProcReportPurchaseOrder } from '@/integrations/supabase/procurement';

/** Carte d'une commande dans le rapport mission (lignes, paiements, QC, commission). Cliquable. */
export function ReportPoCard({ po, onOpen }: { po: ProcReportPurchaseOrder; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className={cn(SOFT_CARD, 'block w-full p-4 text-left active:scale-[0.99]')}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-foreground">{po.reference}</span>
        <span className={cn(
          'rounded-full px-2 py-0.5 text-[10px] font-bold',
          po.status === 'open' ? 'bg-bonzini-amber/15 text-bonzini-amber'
            : po.status === 'cancelled' ? 'bg-red-500/10 text-red-600 dark:text-red-400'
            : 'bg-muted text-muted-foreground',
        )}>{PO_STATUS_LABEL[po.status]}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[12px]">
        <span className="text-muted-foreground">
          {po.incoterm ? `${po.incoterm} · ` : ''}{po.production_status ?? 'production ?'}
        </span>
        <span className="font-semibold tabular-nums text-foreground">
          {po.total_amount.toLocaleString('fr-FR')} {po.currency}
        </span>
      </div>

      {/* Lignes */}
      {po.order_lines.length > 0 && (
        <div className={cn(INSET, 'mt-3 divide-y divide-border/60')}>
          {po.order_lines.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0 truncate text-[12px] text-foreground">{l.description}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {l.quantity.toLocaleString('fr-FR')}{l.unit ? ` ${l.unit}` : ''} × {l.unit_price.toLocaleString('fr-FR')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Paiements */}
      <div className="mt-3 flex items-center justify-between text-[12px]">
        <span className="text-muted-foreground">Payé {po.paid_amount.toLocaleString('fr-FR')} {po.currency}</span>
        <span className={cn('font-bold tabular-nums', po.outstanding_amount > 0 ? 'text-bonzini-orange' : 'text-emerald-600 dark:text-emerald-400')}>
          reste {po.outstanding_amount.toLocaleString('fr-FR')} {po.currency}
        </span>
      </div>
      {po.payments.map((p) => (
        <div key={p.id} className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{p.leg} · {p.method} · {new Date(p.occurred_at).toLocaleDateString('fr-FR')}</span>
          <span className="tabular-nums">{p.amount.toLocaleString('fr-FR')} {p.currency}</span>
        </div>
      ))}

      {/* QC + commission */}
      {(po.qc.length > 0 || po.commission) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {po.qc.map((q) => (
            <span key={q.id} className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold',
              q.result === 'pass' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : q.result === 'fail' ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                : 'bg-bonzini-amber/15 text-bonzini-amber',
            )}>QC {q.inspection_type}: {q.result}</span>
          ))}
          {po.commission && (
            <span className="rounded-full bg-bonzini-violet/10 px-2 py-0.5 text-[10px] font-semibold text-bonzini-violet">
              Comm. {po.commission.computed_amount?.toLocaleString('fr-FR') ?? '—'} {po.commission.currency}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
