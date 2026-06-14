/**
 * Desktop admin — Treasury operations history.
 * Same data/filters as MobileOperationsHistory, as a 2-column grid.
 */
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { OperationListItem } from '@/components/treasury/OperationListItem';
import { Segmented } from '@/components/treasury/Segmented';
import { Pill } from '@/components/treasury/ui';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useTreasuryOperations } from '@/hooks/useTreasury';

type Filter = 'all' | 'purchase' | 'sale' | 'voided';
type Preset = '7d' | '30d' | '90d';

function getRange(preset: Preset): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  from.setDate(to.getDate() - days);
  return { from, to };
}

export function DesktopOperationsHistory() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const [preset, setPreset] = useState<Preset>('30d');
  const [filter, setFilter] = useState<Filter>('all');
  const range = useMemo(() => getRange(preset), [preset]);
  const { data, isLoading } = useTreasuryOperations(range.from.toISOString(), range.to.toISOString());

  if (!hasPermission('canViewTreasury')) {
    return <Navigate to="/m" replace />;
  }

  const filtered = (data ?? []).filter((op) => {
    if (filter === 'all') return true;
    if (filter === 'voided') return !!op.voided_at;
    return op.kind === filter;
  });

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-[26px] font-extrabold tracking-tight text-foreground">Historique des opérations</h2>
        <p className="mt-1 text-[14px] text-muted-foreground">{filtered.length} opération{filtered.length > 1 ? 's' : ''} sur la période</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs">
          <Segmented
            value={preset}
            onChange={setPreset}
            options={[
              { value: '7d', label: '7 jours' },
              { value: '30d', label: '30 jours' },
              { value: '90d', label: '90 jours' },
            ]}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {([
            { value: 'all' as const, label: 'Tout' },
            { value: 'purchase' as const, label: 'Achats' },
            { value: 'sale' as const, label: 'Ventes' },
            { value: 'voided' as const, label: 'Annulées' },
          ]).map((f) => (
            <Pill key={f.value} active={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label}
            </Pill>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-[13px] text-muted-foreground">Aucune opération sur cette période.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filtered.map((op) => (
            <OperationListItem
              key={`${op.kind}-${op.id}`}
              op={op}
              onClick={() =>
                navigate(op.kind === 'purchase' ? `/m/more/treasury/purchases/${op.id}` : `/m/more/treasury/sales/${op.id}`)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
