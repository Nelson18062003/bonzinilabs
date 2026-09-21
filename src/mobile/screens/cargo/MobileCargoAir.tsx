// ============================================================
// Mobile admin — Cargo › Avion : les expéditions aériennes.
//
// Une carte par LTA : le vol, l'état en un mot, la date qui compte (départ
// prévu, ou arrivée), les colis et les kilos, et « n colis non soldés » si
// Douala va devoir attendre un paiement. « Nouvelle expédition » en haut.
// ============================================================
import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronRight, Plane, Plus } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useAirShipments } from '@/hooks/useAirShipments';
import { airStatusMeta, awbLabel, flightSentence, fmtDay, type AirShipment, type AirStatus } from '@/lib/airShipment';
import { formatKg } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Button, IconButton, ScreenLoader, StatusPill } from '@/mobile/designKit';
import { MobileCargoParts } from '@/components/cargo/CargoParts';

type Filter = 'open' | AirStatus | 'all';

function dateLine(a: AirShipment): string {
  switch (a.status) {
    case 'PLANNED': return a.etd ? `Départ prévu le ${fmtDay(a.etd)}` : 'Date de départ à préciser';
    case 'DEPARTED': return `Parti le ${fmtDay(a.departed_at)}${a.eta ? ` · arrivée prévue le ${fmtDay(a.eta)}` : ''}`;
    case 'ARRIVED': return `Arrivé à Douala le ${fmtDay(a.arrived_at)}`;
    default: return `Tout remis${a.delivered_at ? ` le ${fmtDay(a.delivered_at)}` : ''}`;
  }
}

export function MobileCargoAir() {
  const navigate = useNavigate();
  const { hasPermission } = useAdminAuth();
  const { data, isLoading } = useAirShipments();
  const [filter, setFilter] = useState<Filter>('open');

  const all = useMemo(() => data ?? [], [data]);
  const rows = useMemo(() => filter === 'all' ? all : filter === 'open' ? all.filter((a) => a.status !== 'DELIVERED') : all.filter((a) => a.status === filter), [all, filter]);
  const counts = useMemo(() => ({
    open: all.filter((a) => a.status !== 'DELIVERED').length,
    PLANNED: all.filter((a) => a.status === 'PLANNED').length,
    DEPARTED: all.filter((a) => a.status === 'DEPARTED').length,
    ARRIVED: all.filter((a) => a.status === 'ARRIVED').length,
    all: all.length,
  }), [all]);

  if (!hasPermission('canViewCargo')) return <Navigate to="/m" replace />;
  const canManage = hasPermission('canManageCargo');

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader
        title="Cargo"
        subtitle={all.length > 0 ? `${counts.open} expédition${counts.open > 1 ? 's' : ''} en cours${counts.DEPARTED > 0 ? ` · ${counts.DEPARTED} en vol` : ''}` : 'Expéditions aériennes'}
        rightElement={canManage ? <IconButton icon={Plus} variant="primary" onClick={() => navigate('/m/cargo/avion/nouveau')} ariaLabel="Nouvelle expédition aérienne" /> : undefined}
      />
      <MobileCargoParts active="air" />

      <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4 pt-3">
        {([['open', 'En cours', counts.open], ['PLANNED', 'Préparation', counts.PLANNED], ['DEPARTED', 'En vol', counts.DEPARTED], ['ARRIVED', 'Arrivés', counts.ARRIVED], ['all', 'Tous', counts.all]] as const).map(([k, label, n]) => {
          const active = filter === k;
          return (
            <button key={k} type="button" aria-pressed={active} onClick={() => setFilter(k)}
              className={cn('inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-[16px] font-semibold transition-colors', active ? 'bg-[#2C2C2C] text-[#F5F5F5] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : 'bg-[#F5F5F5] text-[#1E1E1E] dark:bg-[#383838] dark:text-[#F5F5F5]')}>
              {label}<span className={cn('tabular-nums', active ? 'opacity-70' : TEXT.muted)}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3 px-4 pb-10 pt-3">
        {isLoading && <ScreenLoader />}
        {rows.map((a) => {
          const st = airStatusMeta(a.status);
          return (
            <button key={a.id} type="button" onClick={() => navigate(`/m/cargo/avion/${a.id}`)}
              className={cn('flex w-full items-center gap-3 rounded-lg p-4 text-left transition-colors active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.card, SURFACE.shadow)}>
              <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white', a.status === 'DEPARTED' ? 'bg-[#0B5FA5]' : 'bg-[#C8102E]')}><Plane className="h-6 w-6" /></span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className={cn('tabular-nums', TYPE.title, TEXT.strong)}>{awbLabel(a)}</span>
                  <StatusPill tone={st.tone} label={st.short} />
                </div>
                <p className={cn('text-[16px] leading-snug', TEXT.strong)}>{flightSentence(a)}</p>
                <p className={cn('text-[16px] leading-snug', TEXT.muted)}>{dateLine(a)}</p>
                <p className={cn('text-[16px] leading-snug tabular-nums', TEXT.muted)}>
                  {a.parcel_count} colis · {formatKg(a.total_weight_kg)} · {a.client_count} client{a.client_count > 1 ? 's' : ''}
                  {a.unpaid_count > 0 && <span className="font-semibold text-[#975102] dark:text-[#E8B931]"> · {a.unpaid_count} non soldé{a.unpaid_count > 1 ? 's' : ''}</span>}
                </p>
              </div>
              <ChevronRight className={cn('h-6 w-6 shrink-0', TEXT.muted)} />
            </button>
          );
        })}
        {!isLoading && rows.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <p className={cn(TYPE.lead, TEXT.strong)}>{filter === 'all' ? 'Aucune expédition aérienne' : 'Rien dans cet état'}</p>
            <p className={cn('mt-2 max-w-xs text-[16px]', TEXT.muted)}>{filter === 'all' ? 'Une LTA suffit pour commencer : les colis reçus au bureau se chargent ensuite.' : 'Touchez « Tous » pour revoir les expéditions.'}</p>
            {canManage && filter === 'all' && <Button className="mt-4" onClick={() => navigate('/m/cargo/avion/nouveau')}><Plus /> Nouvelle expédition</Button>}
          </div>
        )}
      </div>
    </div>
  );
}
