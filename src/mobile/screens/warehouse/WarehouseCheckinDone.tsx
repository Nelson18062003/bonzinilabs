// ============================================================
// ENTREPÔT — Le bilan d'un pointage. Ce qu'on a vu, ce qui est abîmé, ce qui
// manque — et la seule question qui reste : les colis jamais vus, faut-il les
// déclarer manquants maintenant ? Un geste pour tous, ou « pas encore ».
// ============================================================
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Home, PackageCheck, PackageX } from 'lucide-react';
import { toast } from 'sonner';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useFlagMissingMany, useWarehouseArrival } from '@/hooks/useWarehouse';
import { checkinSummary, isPending, nParcels } from '@/lib/warehouse';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, BottomSheet, Card, PrimaryPill, ScreenError, ScreenLoader, SoftPill, StatCard } from '@/mobile/designKit';
import { ParcelLine, WhQuestion } from '@/mobile/components/warehouse/bits';

export function WarehouseCheckinDone() {
  const navigate = useNavigate();
  const { kind, id } = useParams<{ kind: 'air' | 'sea'; id: string }>();
  const { data, isLoading, error, refetch } = useWarehouseArrival(kind, id);
  const flagMany = useFlagMissingMany();
  const [confirm, setConfirm] = useState(false);
  const parcels = useMemo(() => data?.parcels ?? [], [data]);
  const sum = checkinSummary(parcels);
  const pending = parcels.filter(isPending);
  const damaged = parcels.filter((p) => p.checked_in_at && p.condition === 'damaged' && !p.delivered_at);
  const missing = parcels.filter((p) => p.condition === 'missing');
  const base = `/w/arrivees/${kind}/${id}`;

  if (isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  if (error || !data) return <ScreenError description={(error as Error | null)?.message ?? 'Arrivée introuvable'} onRetry={() => void refetch()} />;

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title="Bilan du pointage" subtitle={data.label} showBack backTo={base} />
      <div className="space-y-6 px-4 pb-10 pt-4">
        <div className="flex flex-col items-center py-2 text-center">
          <span className={cn('flex h-20 w-20 items-center justify-center rounded-full text-white', sum.pending === 0 ? 'bg-[#14AE5C]' : 'bg-[#E8B931] text-[#401B01]')}>{sum.pending === 0 ? <Check className="h-10 w-10" strokeWidth={3} /> : <PackageX className="h-10 w-10" />}</span>
          <p className={cn('mt-4', TYPE.heading, TEXT.strong)}>{sum.seen} sur {sum.total} pointés</p>
          <p className={cn('mt-1', TYPE.body, TEXT.muted)}>{sum.pending === 0 ? 'Tout ce qui était attendu a été vu.' : `${nParcels(sum.pending)} n'ont pas été vus.`}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="En bon état" value={sum.ok} tone="success" />
          <StatCard label="Abîmés" value={sum.damaged} tone={sum.damaged > 0 ? 'pending' : 'neutral'} />
          <StatCard label="Manquants" value={sum.missing} tone={sum.missing > 0 ? 'danger' : 'neutral'} />
          <StatCard label="Jamais vus" value={sum.pending} tone={sum.pending > 0 ? 'pending' : 'neutral'} />
        </div>

        {pending.length > 0 && (
          <section className="space-y-3">
            <WhQuestion title="Les déclarer manquants ?" help="Ils n'étaient pas dans l'arrivée. L'équipe le verra et cherchera avec Guangzhou. Vous pourrez les pointer s'ils arrivent plus tard." />
            <Card className="py-0">{pending.map((p) => <ParcelLine key={p.id} parcel={p} onTap={() => navigate(`${base}/colis/${p.id}`)} />)}</Card>
            <PrimaryPill onClick={() => setConfirm(true)} className="h-14 w-full text-[17px]"><PackageX /> Déclarer les {pending.length} manquants</PrimaryPill>
            <SoftPill onClick={() => navigate(base)} className="h-12 w-full text-[16px]">Pas encore, je continue à pointer</SoftPill>
          </section>
        )}

        {damaged.length > 0 && (
          <section>
            <h2 className={cn('mb-2', TYPE.lead, TEXT.strong)}>Abîmés</h2>
            <Card className="py-0">{damaged.map((p) => <ParcelLine key={p.id} parcel={p} onTap={() => navigate(`${base}/colis/${p.id}`)} />)}</Card>
          </section>
        )}
        {missing.length > 0 && (
          <section>
            <h2 className={cn('mb-2', TYPE.lead, TEXT.strong)}>Manquants</h2>
            <Card className="py-0">{missing.map((p) => <ParcelLine key={p.id} parcel={p} onTap={() => navigate(`${base}/colis/${p.id}`)} />)}</Card>
          </section>
        )}

        {pending.length === 0 && (
          <div className="space-y-2">
            <PrimaryPill onClick={() => navigate('/w/arrivees')} className="h-14 w-full text-[17px]"><PackageCheck /> Autre arrivée</PrimaryPill>
            <SoftPill onClick={() => navigate('/w')} className="h-12 w-full text-[16px]"><Home /> Accueil</SoftPill>
          </div>
        )}
      </div>

      <BottomSheet open={confirm} onClose={() => setConfirm(false)} title={`Déclarer ${pending.length} manquant${pending.length > 1 ? 's' : ''}`}>
        <div className="space-y-4">
          <p className={cn(TYPE.body, TEXT.strong)}>{pending.map((p) => p.parcel_no).join(', ')}</p>
          <p className={cn(TYPE.body, TEXT.muted)}>Vous confirmez ne pas les avoir vus dans cette arrivée.</p>
          <PrimaryPill onClick={() => flagMany.mutate({ parcelIds: pending.map((p) => p.id) }, { onSuccess: (r) => { setConfirm(false); toast.success(`${nParcels(r.flagged)} déclarés manquants`); } })} loading={flagMany.isPending} className="h-14 w-full bg-[#C00F0C] text-[17px] text-white dark:bg-[#EC221F] dark:text-white"><PackageX /> Oui, manquants</PrimaryPill>
          <SoftPill onClick={() => setConfirm(false)} className="h-12 w-full text-[16px]">Annuler</SoftPill>
        </div>
      </BottomSheet>
    </div>
  );
}
