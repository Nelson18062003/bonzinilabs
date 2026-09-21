// ============================================================
// ENTREPÔT — Les arrivées : un avion ou une boîte arrivés, avec ce qui
// reste à pointer. On touche, on pointe.
// ============================================================
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Plane, Ship } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useWarehouseDay } from '@/hooks/useWarehouse';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, ScreenLoader, StatusPill } from '@/mobile/designKit';
import { formatDateTime } from '@/mobile/components/reception/bits';

export function WarehouseArrivals() {
  const navigate = useNavigate();
  const { data, isLoading } = useWarehouseDay();
  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title="Pointer une arrivée" subtitle={data ? `${data.stats.to_checkin} colis à pointer` : undefined} showBack backTo="/w" />
      <div className="space-y-3 px-4 pb-10 pt-4">
        {isLoading || !data ? <ScreenLoader /> : data.arrivals.length === 0 ? (
          <Card className={cn('text-center', SURFACE.inset, 'border-0')}><p className={cn(TYPE.body, TEXT.muted)}>Rien n'est arrivé. Quand un avion ou une boîte arrive, il apparaît ici.</p></Card>
        ) : data.arrivals.map((a) => {
          const left = a.expected - a.checked;
          return (
            <button key={`${a.kind}-${a.id}`} type="button" onClick={() => navigate(`/w/arrivees/${a.kind}/${a.id}`)}
              className={cn('flex w-full items-center gap-3 rounded-lg p-4 text-left active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.card, SURFACE.shadow)}>
              <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white', a.kind === 'air' ? 'bg-[#C8102E]' : 'bg-[#0B5FA5]')}>{a.kind === 'air' ? <Plane className="h-6 w-6" /> : <Ship className="h-6 w-6" />}</span>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className={cn('tabular-nums', TYPE.title, TEXT.strong)}>{a.label}</span>
                  {left > 0 ? <StatusPill tone="pending" label={`${left} à pointer`} /> : <StatusPill tone="success" label="Tout pointé" />}
                </span>
                <span className={cn('block', TYPE.body, TEXT.muted)}>{a.sub}{a.arrived_at ? ` · arrivé le ${formatDateTime(a.arrived_at)}` : ''}</span>
                <span className={cn('block tabular-nums', TYPE.small, TEXT.muted)}>{a.expected} colis attendus · {a.checked} pointés{a.missing > 0 ? ` · ${a.missing} manquants` : ''}{a.delivered > 0 ? ` · ${a.delivered} remis` : ''}</span>
              </span>
              <ChevronRight className={cn('h-6 w-6 shrink-0', TEXT.muted)} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
