// ============================================================
// ENTREPÔT — La fiche d'un colis à l'arrivée : une question, « Ce colis
// est-il là ? », et trois réponses. En bon état : pointé, retour à la liste.
// Abîmé : une remarque, puis pointé abîmé. Manquant : une confirmation.
// Un colis déjà pointé, abîmé ou manquant se corrige ici, de la même façon.
// Refonte v2 (maquette 10/50) : la photo prise à Guangzhou en grand, la
// rangée et la remarque, « Oui, en bon état » en noir ; abîmé et manquant
// à côté (manquant passe par une confirmation).
// ============================================================
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useCheckinParcel, useFlagMissing, useWarehouseArrival } from '@/hooks/useWarehouse';
import { checkinSummary, warehouseStage } from '@/lib/warehouse';
import { clientFullName, formatKg } from '@/lib/reception';
import { cn } from '@/lib/utils';
import { BigButton, ConfirmSheet, Dock, EmptyLine, ScreenLoader, ScreenTop, SURFACE, TEXT, Tag, TextInput } from '@/mobile/designKit';
import { ParcelThumb, formatDateTime } from '@/mobile/components/reception/bits';
import { ParcelPhotoViewer, useParcelViewer } from '@/mobile/components/reception/ParcelPhotoViewer';
import { CapsLabel } from '@/mobile/components/cargo/v2';

export function WarehouseCheckinParcel() {
  const navigate = useNavigate();
  const { kind, id, parcelId } = useParams<{ kind: 'air' | 'sea'; id: string; parcelId: string }>();
  const { data, isLoading, error, refetch } = useWarehouseArrival(kind, id);
  const checkin = useCheckinParcel();
  const flag = useFlagMissing();
  const [missingOpen, setMissingOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [placeDraft, setPlaceDraft] = useState<string | null>(null);
  const viewer = useParcelViewer();
  // Ouvert depuis un paquet (?paquet=PQ-…) : on y revient.
  const fromPackage = useSearchParams()[0].get('paquet');
  const back = `/w/arrivees/${kind}/${id}${fromPackage ? `?paquet=${encodeURIComponent(fromPackage)}` : ''}`;

  if (isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  const parcel = data?.parcels.find((p) => p.id === parcelId);
  if (error || !data || !parcel) {
    return (
      <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
        <ScreenTop title="Colis" backTo={back} />
        <EmptyLine action={{ label: 'Réessayer', onClick: () => void refetch() }}>{(error as Error | null)?.message ?? 'Colis introuvable dans cette arrivée'}</EmptyLine>
      </div>
    );
  }
  const st = warehouseStage(parcel);
  const busy = checkin.isPending || flag.isPending;
  const done = (msg: string) => { toast.success(msg); navigate(back, { replace: true }); };
  const saved = (() => { try { return sessionStorage.getItem('bonzini-warehouse-place') ?? ''; } catch { return ''; } })();
  const place = (placeDraft ?? (parcel.warehouse_location || saved)).trim();
  const remark = (note ?? parcel.condition_note ?? '').trim();
  const sum = checkinSummary(data.parcels);
  const keepPlace = () => { if (placeDraft != null) { try { sessionStorage.setItem('bonzini-warehouse-place', place); } catch { /* privé */ } } };
  const okNow = () => { keepPlace(); checkin.mutate({ parcelId: parcel.id, location: place || undefined, condition: 'ok' }, { onSuccess: () => done(`${parcel.parcel_no} pointé`) }); };
  const damagedNow = () => { keepPlace(); checkin.mutate({ parcelId: parcel.id, location: place || undefined, condition: 'damaged', note: remark || undefined }, { onSuccess: () => done(`${parcel.parcel_no} pointé, abîmé`) }); };

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop title={parcel.parcel_no} backTo={back} step={`${sum.seen}/${sum.total}`} />
      <div className="flex-1 space-y-4 px-5 pb-20 pt-4">
        {/* La photo prise à Guangzhou : on compare avec le carton qu'on a devant soi. */}
        <button type="button" onClick={() => viewer.open(0)} className="block w-full overflow-hidden rounded-lg" aria-label="Voir la photo en grand">
          <ParcelThumb path={parcel.photo_path} size="h-[220px] w-full" />
        </button>
        <p className={cn('text-[15px]', TEXT.muted)}>
          Photo prise à Guangzhou · {parcel.description || parcel.kind} · {formatKg(parcel.weight_kg)}
          {parcel.client ? ` · ${clientFullName(parcel.client)}` : ''}
          {parcel.package_no ? ` · ${parcel.package_no}` : ''}
        </p>
        {(parcel.checked_in_at || parcel.condition) && (
          <p className="flex flex-wrap items-center gap-2">
            <Tag tone={st.tone === 'info' ? 'neutral' : st.tone}>{st.label}</Tag>
            {parcel.checked_in_at && <span className={cn('text-[15px] tabular-nums', TEXT.muted)}>pointé le {formatDateTime(parcel.checked_in_at)}</span>}
          </p>
        )}

        {parcel.delivered_at ? (
          <p className={cn('text-[22px] font-semibold', TEXT.strong)}>Déjà remis{parcel.release_no ? ` · ${parcel.release_no}` : ''}</p>
        ) : (
          <>
            <h2 className={cn('pt-1 text-[24px] font-semibold leading-tight tracking-[-0.01em]', TEXT.strong)}>Ce colis est-il là ?</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-2">
                <CapsLabel>Rangée</CapsLabel>
                <TextInput value={placeDraft ?? (parcel.warehouse_location || saved)} onChange={(e) => setPlaceDraft(e.target.value)} placeholder="B3" className="h-14 text-[17px]" />
              </label>
              <label className="space-y-2">
                <CapsLabel>Remarque</CapsLabel>
                <TextInput value={note ?? parcel.condition_note ?? ''} onChange={(e) => setNote(e.target.value)} placeholder="Facultatif" className="h-14 text-[17px]" />
              </label>
            </div>
          </>
        )}
      </div>

      {!parcel.delivered_at && (
        <Dock>
          <BigButton onClick={okNow} loading={checkin.isPending} disabled={busy}>Oui, en bon état</BigButton>
          <div className="grid grid-cols-2 gap-2.5">
            <BigButton variant="soft" onClick={damagedNow} disabled={busy}>Oui, mais abîmé</BigButton>
            {parcel.condition !== 'missing'
              ? <BigButton variant="soft" onClick={() => setMissingOpen(true)} disabled={busy}>Non, il manque</BigButton>
              : <BigButton variant="soft" onClick={() => navigate(back)} disabled={busy}>Retour</BigButton>}
          </div>
        </Dock>
      )}

      <ConfirmSheet
        open={missingOpen}
        danger
        onClose={() => setMissingOpen(false)}
        title="Le déclarer manquant ?"
        subtitle={`${parcel.parcel_no} · ${data.label}`}
        rows={[{ label: 'Remarque', value: remark || '—' }]}
        confirmLabel="Oui, manquant"
        loading={flag.isPending}
        onConfirm={() => flag.mutate({ parcelId: parcel.id, missing: true, note: remark || undefined }, { onSuccess: () => { setMissingOpen(false); done(`${parcel.parcel_no} déclaré manquant`); } })}
      />
      <ParcelPhotoViewer parcels={[{ ...parcel, note: `Photo prise à Guangzhou · ${st.label}` }]} index={viewer.index} close={viewer.close} setIndex={viewer.setIndex} title={data.label} />
    </div>
  );
}
