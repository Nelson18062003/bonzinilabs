// ============================================================
// ENTREPÔT — Pointer : « Quelle arrivée ? » Un avion ou une boîte, avec ce
// qui reste à pointer. On touche, on passe à la liste des colis. Une seule
// question sur cet écran.
// ============================================================
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useWarehouseDay } from '@/hooks/useWarehouse';
import { nParcels } from '@/lib/warehouse';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, ScreenLoader, StatusPill } from '@/mobile/designKit';
import { formatDateTime } from '@/mobile/components/reception/bits';
import { TransportMark, WhQuestion } from '@/mobile/components/warehouse/bits';

export function WarehouseArrivals() {
  const navigate = useNavigate();
  const { data, isLoading } = useWarehouseDay();
  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title="Pointer" showBack backTo="/w" />
      <div className="space-y-5 px-4 pb-10 pt-4">
        <WhQuestion title="Quelle arrivée ?" help="Un avion ou une boîte qui vient d'arriver. Touchez-la pour pointer ses colis." />
        {isLoading || !data ? <ScreenLoader /> : data.arrivals.length === 0 ? (
          <Card className={cn('text-center', SURFACE.inset, 'border-0')}><p className={cn(TYPE.body, TEXT.muted)}>Rien n'est arrivé. Quand l'équipe marque un avion ou une boîte « arrivé », il apparaît ici.</p></Card>
        ) : (
          <div className="space-y-3">
            {data.arrivals.map((a) => {
              const left = a.expected - a.checked;
              return (
                <button key={`${a.kind}-${a.id}`} type="button" onClick={() => navigate(`/w/arrivees/${a.kind}/${a.id}`)}
                  className={cn('flex w-full items-center gap-3 rounded-lg p-4 text-left active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.card, SURFACE.shadow)}>
                  <TransportMark kind={a.kind} />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block break-words tabular-nums', TYPE.bodyStrong, TEXT.strong)}>{a.label}</span>
                    <span className={cn('block break-words', TYPE.small, TEXT.muted)}>{a.sub}{a.arrived_at ? ` · ${formatDateTime(a.arrived_at)}` : ''}</span>
                    <span className={cn('mt-1 block tabular-nums', TYPE.small, TEXT.muted)}>{nParcels(a.expected)} attendus · {a.checked} pointés{a.missing > 0 ? ` · ${a.missing} manquant${a.missing > 1 ? 's' : ''}` : ''}</span>
                    <span className="mt-2 block">{left > 0 ? <StatusPill tone="pending" label={`${left} à pointer`} /> : <StatusPill tone="success" label="Tout pointé" />}</span>
                  </span>
                  <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
