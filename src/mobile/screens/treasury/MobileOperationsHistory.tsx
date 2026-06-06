import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { OperationListItem } from '@/components/treasury/OperationListItem';
import { Segmented } from '@/components/treasury/Segmented';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useTreasuryOperations } from '@/hooks/useTreasury';
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

      <div className="px-5 py-4 space-y-3">
        {/* Period */}
        <Segmented
          value={preset}
          onChange={setPreset}
          options={[
            { value: '7d', label: '7 jours' },
            { value: '30d', label: '30 jours' },
            { value: '90d', label: '90 jours' },
          ]}
        />

        {/* Filter */}
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5">
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
                'h-9 shrink-0 rounded-full px-4 text-[12px] font-semibold transition-colors',
                filter === f.value ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
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
              <OperationListItem
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
