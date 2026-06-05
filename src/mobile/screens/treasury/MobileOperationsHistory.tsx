import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, ArrowDownToLine, ArrowUpFromLine, Ban, ChevronRight } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useTreasuryOperations, type OperationRow } from '@/hooks/useTreasury';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'purchase' | 'sale' | 'voided';
type Preset = '7d' | '30d' | '90d';

function getRange(preset: Preset): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  from.setDate(to.getDate() - days);
  return { from, to };
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function MobileOperationsHistory() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const [preset, setPreset] = useState<Preset>('30d');
  const [filter, setFilter] = useState<Filter>('all');
  const range = useMemo(() => getRange(preset), [preset]);
  const { data, isLoading } = useTreasuryOperations(range.from.toISOString(), range.to.toISOString());

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m/more" replace />;
  }

  const filtered = (data ?? []).filter((op) => {
    if (filter === 'all') return true;
    if (filter === 'voided') return !!op.voided_at;
    if (filter === 'purchase') return op.kind === 'purchase';
    if (filter === 'sale') return op.kind === 'sale';
    return true;
  });

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Historique opérations" showBack backTo="/m/more/treasury" />

      <div className="px-4 py-3 space-y-3">
        {/* Period */}
        <div className="flex bg-muted rounded-xl p-1">
          {([
            { value: '7d' as const, label: '7 j' },
            { value: '30d' as const, label: '30 j' },
            { value: '90d' as const, label: '90 j' },
          ]).map((p) => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={cn(
                'flex-1 h-9 rounded-lg text-[13px] font-semibold transition-colors',
                preset === p.value ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-1.5 overflow-x-auto">
          {([
            { value: 'all' as const, label: 'Tout' },
            { value: 'purchase' as const, label: 'Achats' },
            { value: 'sale' as const, label: 'Ventes' },
            { value: 'voided' as const, label: 'Annulées' },
          ]).map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'flex-shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold border-2 transition-colors',
                filter === f.value
                  ? 'border-violet-600 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300'
                  : 'border-border bg-card text-muted-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground text-[13px] py-8">
            Aucune opération sur cette période.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((op) => (
              <OperationCard
                key={`${op.kind}-${op.id}`}
                op={op}
                onClick={() =>
                  navigate(
                    op.kind === 'purchase'
                      ? `/m/more/treasury/purchases/${op.id}`
                      : `/m/more/treasury/sales/${op.id}`,
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OperationCard({ op, onClick }: { op: OperationRow; onClick: () => void }) {
  const isPurchase = op.kind === 'purchase';
  const voided = !!op.voided_at;
  const counterparty = isPurchase ? op.supplier?.display_name : op.buyer?.display_name;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left bg-card rounded-2xl border p-3.5 active:bg-muted/40 transition-colors flex items-center gap-3',
        voided ? 'border-border opacity-60' : isPurchase ? 'border-violet-200 dark:border-violet-500/30' : 'border-amber-200 dark:border-amber-500/30',
      )}
    >
      <div
        className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0',
          voided ? 'bg-slate-400 dark:bg-slate-600' : isPurchase ? 'bg-violet-600' : 'bg-amber-500',
        )}
      >
        {voided ? <Ban className="w-4 h-4" /> : isPurchase ? <ArrowDownToLine className="w-4 h-4" /> : <ArrowUpFromLine className="w-4 h-4" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-[14px] truncate">
            {counterparty ?? '—'}
          </span>
          {voided && (
            <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
              Annulée
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground">{fmtDate(op.occurred_at)}</div>
        <div className="text-[12px] mt-0.5 tabular-nums">
          {isPurchase ? (
            <>
              <span className="font-bold">{fmt(Number(op.xaf_amount), 0)} XAF</span>
              <span className="text-muted-foreground"> → </span>
              <span className="font-bold">{fmt(Number(op.usdt_amount), 2)} USDT</span>
              <span className="text-muted-foreground ml-1">@ {fmt(Number(op.implicit_rate), 4)}</span>
            </>
          ) : (
            <>
              <span className="font-bold">{fmt(Number(op.usdt_amount), 2)} USDT</span>
              <span className="text-muted-foreground"> → </span>
              <span className="font-bold">{fmt(Number(op.cny_amount), 2)} CNY</span>
              <span className="text-muted-foreground ml-1">@ {fmt(Number(op.implicit_rate), 4)}</span>
            </>
          )}
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </button>
  );
}
