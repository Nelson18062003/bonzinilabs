import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Plus, Boxes, ChevronRight } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useMissions } from '@/hooks/useProcurement';
import type { ByCurrency } from '@/integrations/supabase/procurement';
import { IconChip, Pill, SOFT_CARD } from '@/components/treasury/ui';
import { MISSION_STATUS_LABEL, formatByCurrency } from './shared';
import { cn } from '@/lib/utils';

function outstandingLabel(by: ByCurrency): string | null {
  const s = formatByCurrency(by);
  return s === '—' ? null : s;
}

export function MobileMissionsList() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const { data, isLoading } = useMissions(filter === 'active' ? 'active' : null);

  if (!hasPermission('canViewProcurement')) {
    return <Navigate to="/m/more" replace />;
  }

  const missions = data?.missions ?? [];
  const canManage = hasPermission('canManageProcurement');

  return (
    <div className="flex flex-col min-h-full bg-background">
      <MobileHeader title="Missions" showBack backTo="/m/more/procurement" />

      <div className="px-5 py-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <Pill active={filter === 'active'} onClick={() => setFilter('active')}>Actives</Pill>
            <Pill active={filter === 'all'} onClick={() => setFilter('all')}>Toutes</Pill>
          </div>
          {canManage && (
            <button
              onClick={() => navigate('/m/more/procurement/missions/new')}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-foreground px-3.5 text-[13px] font-semibold text-background active:scale-95"
            >
              <Plus className="h-4 w-4" /> Mission
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-[13px] text-muted-foreground">Chargement…</div>
        ) : missions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <IconChip icon={Boxes} tone="amber" size="lg" />
            <div className="text-[14px] font-semibold text-foreground">Aucune mission</div>
            <div className="max-w-[260px] text-[12px] text-muted-foreground">
              Crée une mission pour commencer à enregistrer les fournisseurs, commandes et paiements.
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {missions.map((m) => {
              const out = outstandingLabel(m.outstanding_by_currency);
              return (
                <button
                  key={m.id}
                  onClick={() => navigate(`/m/more/procurement/missions/${m.id}`)}
                  className={cn(SOFT_CARD, 'flex w-full items-center gap-3.5 p-4 text-left active:scale-[0.99]')}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-foreground">{m.label}</span>
                      <span className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
                        m.status === 'active' ? 'bg-bonzini-amber/15 text-bonzini-amber' : 'bg-muted text-muted-foreground',
                      )}>{MISSION_STATUS_LABEL[m.status]}</span>
                    </div>
                    <div className="truncate text-[12px] text-muted-foreground">
                      {m.reference} · {m.company_name || m.client_name || 'Client ?'}
                      {m.location ? ` · ${m.location}` : ''}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {m.purchase_order_count} commande{m.purchase_order_count > 1 ? 's' : ''}
                      {out ? ` · reste ${out}` : ''}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
