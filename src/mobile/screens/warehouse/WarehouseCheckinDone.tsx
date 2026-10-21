// ============================================================
// ENTREPÔT — Le bilan d'un pointage. Ce qu'on a vu, ce qui est abîmé, ce qui
// manque — et la seule question qui reste : les colis jamais vus, faut-il les
// déclarer manquants maintenant ? Un geste pour tous, ou « pas encore ».
// Refonte v2 (maquette 10/51) : « 84 sur 86 colis », les quatre comptes en
// grille, les jamais vus, « Déclarer N manquants » en noir.
// ============================================================
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useFlagMissingMany, useWarehouseArrival } from '@/hooks/useWarehouse';
import { checkinSummary, isPending, nParcels, packagesProgress, type WarehouseParcel } from '@/lib/warehouse';
import { cn } from '@/lib/utils';
import { BigButton, ConfirmSheet, Dock, EmptyLine, ScreenLoader, ScreenTop, SURFACE, TEXT, TONE_TEXT } from '@/mobile/designKit';
import { ParcelLine } from '@/mobile/components/reception/bits';
import { clientFullName } from '@/lib/reception';
import { CapsLabel } from '@/mobile/components/cargo/v2';

const sub = (p: WarehouseParcel) => [p.client ? clientFullName(p.client) : null, p.condition_note || p.description || p.kind, p.package_no].filter(Boolean).join(' · ');

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
  const packs = packagesProgress(data?.packages ?? []);
  const base = `/w/arrivees/${kind}/${id}`;

  if (isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  if (error || !data) {
    return (
      <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
        <ScreenTop title="Bilan du pointage" backTo={base} />
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void refetch() }}>{(error as Error | null)?.message ?? 'Arrivée introuvable'}</EmptyLine>
      </div>
    );
  }
  const cells: { label: string; value: number; tone?: 'danger' | 'pending' }[] = [
    { label: 'En bon état', value: sum.ok },
    { label: 'Abîmés', value: sum.damaged, tone: sum.damaged > 0 ? 'pending' : undefined },
    { label: 'Manquants', value: sum.missing, tone: sum.missing > 0 ? 'danger' : undefined },
    { label: 'Jamais vus', value: sum.pending, tone: sum.pending > 0 ? 'pending' : undefined },
  ];
  const list = (title: string, items: WarehouseParcel[]) => items.length > 0 && (
    <section>
      <CapsLabel className="pt-5">{title}</CapsLabel>
      {items.map((p) => <ParcelLine key={p.id} parcel={p} title={p.parcel_no} subtitle={sub(p)} showVolume={false} onClick={() => navigate(`${base}/colis/${p.id}`)} />)}
    </section>
  );

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop title="Bilan du pointage" backTo={base} />
      <div className="flex-1 px-5 pb-20 pt-5">
        <div className="text-center">
          <p className={cn('text-[16px]', TEXT.muted)}>{data.label}</p>
          <p className={cn('mt-1 text-[48px] font-bold leading-none tracking-[-0.03em] tabular-nums', TEXT.strong)}>
            {sum.seen}<span className={cn('ml-2 text-[22px] font-semibold tracking-normal', TEXT.muted)}>sur {sum.total} colis</span>
          </p>
          {packs.total > 0 && (
            <p className={cn('mt-2 text-[16px] font-semibold', packs.done ? TONE_TEXT.success : TONE_TEXT.danger)}>
              {packs.done ? `Paquets : les ${packs.total} reçus` : `Paquets reçus ${packs.received} / ${packs.total} · ${packs.missing.map((k) => k.package_no).join(', ')}`}
            </p>
          )}
        </div>
        <div className="mt-5 grid grid-cols-2 overflow-hidden rounded-lg border border-[#D9D9D9] dark:border-[#444444]">
          {cells.map((c, i) => (
            <div key={c.label} className={cn('px-4 py-3.5', i % 2 === 1 && 'border-l border-[#D9D9D9] dark:border-[#444444]', i >= 2 && 'border-t border-[#D9D9D9] dark:border-[#444444]')}>
              <p className={cn('text-[15px]', TEXT.muted)}>{c.label}</p>
              <p className={cn('mt-0.5 text-[26px] font-bold tabular-nums', c.tone ? TONE_TEXT[c.tone] : TEXT.strong)}>{c.value}</p>
            </div>
          ))}
        </div>
        {list('Jamais vus', pending)}
        {list('Abîmés', damaged)}
        {list('Manquants', missing)}
      </div>

      <Dock>
        {pending.length > 0 ? (
          <>
            <BigButton onClick={() => setConfirm(true)}>Déclarer {pending.length} manquant{pending.length > 1 ? 's' : ''}</BigButton>
            <BigButton variant="soft" onClick={() => navigate(base)}>Je continue à pointer</BigButton>
          </>
        ) : (
          <>
            <BigButton onClick={() => navigate('/w/arrivees')}>Autre arrivée</BigButton>
            <BigButton variant="soft" onClick={() => navigate('/w')}>Journée</BigButton>
          </>
        )}
      </Dock>

      <ConfirmSheet
        open={confirm}
        danger
        onClose={() => setConfirm(false)}
        title={`Déclarer ${pending.length} manquant${pending.length > 1 ? 's' : ''} ?`}
        subtitle={data.label}
        rows={[{ label: 'Colis', value: pending.map((p) => p.parcel_no).slice(0, 3).join(', ') + (pending.length > 3 ? '…' : '') }]}
        confirmLabel="Oui, manquants"
        loading={flagMany.isPending}
        onConfirm={() => flagMany.mutate({ parcelIds: pending.map((p) => p.id) }, { onSuccess: (r) => { setConfirm(false); toast.success(`${nParcels(r.flagged)} déclarés manquants`); } })}
      />
    </div>
  );
}
