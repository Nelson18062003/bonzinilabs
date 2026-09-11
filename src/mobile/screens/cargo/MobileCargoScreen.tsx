/** Mobile admin — Cargo : la flotte, une carte par conteneur, l'arrivée en premier. */
import { useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronRight, Map as MapIcon, Search as SearchIcon } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useCargoShipments } from '@/hooks/useCargo';
import { CARRIER_LABEL, bestEta, etaSlipDays, fmtDay, statusMeta } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, Card, StatusPill, PrimaryPill, ScreenLoader } from '@/mobile/designKit';

export function MobileCargoScreen() {
  const { hasPermission } = useAdminAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useCargoShipments();
  const rows = useMemo(() => [...(data ?? [])].sort((a, b) => (bestEta(a).date?.getTime() ?? Infinity) - (bestEta(b).date?.getTime() ?? Infinity)), [data]);

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;

  return (
    <div className="min-h-screen pb-28">
      <MobileHeader
        title="Cargo"
        subtitle={`${rows.length} conteneur${rows.length > 1 ? 's' : ''} suivi${rows.length > 1 ? 's' : ''}`}
        showBack
        backTo="/m/more"
        rightElement={
          <button type="button" aria-label="Carte" onClick={() => navigate('/m/cargo/map')} className={cn('flex h-9 w-9 items-center justify-center rounded-full', SURFACE.holder)}>
            <MapIcon className="h-4 w-4" />
          </button>
        }
      />
      <div className="space-y-2.5 px-4 pt-3">
        {isLoading && <ScreenLoader />}
        {rows.map((s) => {
          const meta = statusMeta(s.status);
          const eta = bestEta(s);
          const slip = etaSlipDays(s);
          return (
            <Card key={s.id} onClick={() => navigate(`/m/cargo/${s.id}`)} className="flex cursor-pointer items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn('truncate text-[14px] font-bold', TEXT.strong)}>{s.client_label}</span>
                  <StatusPill tone={meta.tone} label={meta.label} />
                </div>
                <div className={cn('mt-0.5 font-mono text-[12px]', TEXT.muted)}>{s.container_number} · {CARRIER_LABEL[s.carrier] ?? s.carrier}</div>
                <div className={cn('mt-1.5 text-[13px]', TEXT.strong)}>
                  {s.pod_name} · <b>{fmtDay(eta.date)}</b>
                  {slip > 0 && <span className="ml-1.5 text-[11.5px] font-semibold text-amber-700 dark:text-amber-400">+{slip} j</span>}
                </div>
              </div>
              <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
            </Card>
          );
        })}
        {!isLoading && rows.length === 0 && <p className={cn('py-10 text-center text-[13px]', TEXT.muted)}>Aucun conteneur suivi.</p>}
      </div>
      <div className="fixed inset-x-4 bottom-24 z-20">
        <PrimaryPill onClick={() => navigate('/m/cargo/track')} className="w-full">
          <SearchIcon className="h-4 w-4" /> Suivre un conteneur
        </PrimaryPill>
      </div>
    </div>
  );
}
