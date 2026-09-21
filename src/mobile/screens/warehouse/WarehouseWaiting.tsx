// ============================================================
// ENTREPÔT — « Qui attend ses colis ? » La liste des clients dont des colis
// sont pointés et pas remis, avec « payé » ou « à encaisser ». On touche un
// client, on arrive sur ses colis (étape 2). Une question, une liste.
// ============================================================
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useWarehouseDay } from '@/hooks/useWarehouse';
import { formatKg } from '@/lib/reception';
import { nParcels } from '@/lib/warehouse';
import { xaf } from '@/lib/cargoQuote';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, ScreenLoader, StatusPill } from '@/mobile/designKit';
import { formatDateTime } from '@/mobile/components/reception/bits';
import { ClientHead, WhQuestion } from '@/mobile/components/warehouse/bits';
import { writeReleaseDraft } from './releaseDraft';

export function WarehouseWaiting() {
  const navigate = useNavigate();
  const { data, isLoading } = useWarehouseDay();
  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title="Remettre" showBack backTo="/w/remise" />
      <div className="space-y-5 px-4 pb-10 pt-4">
        <WhQuestion title="Qui attend ses colis ?" help="Les clients dont des colis sont pointés à Douala et pas encore remis." />
        {isLoading || !data ? <ScreenLoader /> : data.waiting_by_client.length === 0 ? (
          <Card className={cn('text-center', SURFACE.inset, 'border-0')}><p className={cn(TYPE.body, TEXT.muted)}>Personne n'attend : tout ce qui a été pointé a été remis.</p></Card>
        ) : (
          <Card className="py-0 [&>*]:border-b [&>*]:border-[#D9D9D9] [&>*:last-child]:border-b-0 dark:[&>*]:border-[#444444]">
            {data.waiting_by_client.map((w) => (
              <button key={w.client?.user_id ?? 'none'} type="button" disabled={!w.client} onClick={() => { if (!w.client) return; writeReleaseDraft(null); navigate(`/w/remise/${w.client.customer_code}`); }} className="flex w-full items-center gap-3 py-3 text-left disabled:opacity-60">
                <span className="min-w-0 flex-1 space-y-2">
                  <ClientHead client={w.client} size="md" sub={`${w.client?.customer_code ? `${w.client.customer_code} · ` : ''}${nParcels(w.parcels)} · ${formatKg(w.weight_kg)} · depuis le ${formatDateTime(w.since).slice(0, 5)}`} />
                  <span className="block pl-[52px]">{w.unpaid ? <StatusPill tone="pending" label={w.balance_xaf > 0 ? `Reste ${xaf(w.balance_xaf)}` : 'Sans prix'} /> : <StatusPill tone="success" label="Payé" />}</span>
                </span>
                <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
              </button>
            ))}
          </Card>
        )}
        {data && data.waiting_by_client.some((w) => !w.client) && <p className={cn(TYPE.small, TEXT.muted)}>Un colis sans client attribué ne peut pas être remis : Guangzhou doit d'abord l'attribuer.</p>}
      </div>
    </div>
  );
}
