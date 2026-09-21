// ============================================================
// ENTREPÔT — La fiche d'un colis à l'arrivée : une question, « Ce colis
// est-il là ? », et trois réponses. En bon état : pointé, retour à la liste.
// Abîmé : une remarque, puis pointé abîmé. Manquant : une confirmation.
// Un colis déjà pointé, abîmé ou manquant se corrige ici, de la même façon.
// ============================================================
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Check, PackageX } from 'lucide-react';
import { toast } from 'sonner';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { useCheckinParcel, useFlagMissing, useWarehouseArrival } from '@/hooks/useWarehouse';
import { warehouseStage } from '@/lib/warehouse';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Card, PrimaryPill, ScreenError, ScreenLoader, SoftPill, StatusPill } from '@/mobile/designKit';
import { TextArea } from '@/components/form';
import { formatDateTime } from '@/mobile/components/reception/bits';
import { AnswerButton, CheckMark, ClientHead, ParcelText, WhQuestion } from '@/mobile/components/warehouse/bits';

type Step = 'state' | 'damaged' | 'missing';

export function WarehouseCheckinParcel() {
  const navigate = useNavigate();
  const { kind, id, parcelId } = useParams<{ kind: 'air' | 'sea'; id: string; parcelId: string }>();
  const { data, isLoading, error, refetch } = useWarehouseArrival(kind, id);
  const checkin = useCheckinParcel();
  const flag = useFlagMissing();
  const [step, setStep] = useState<Step>('state');
  const [note, setNote] = useState('');
  const back = `/w/arrivees/${kind}/${id}`;

  if (isLoading) return <ScreenLoader className="min-h-[100dvh]" />;
  const parcel = data?.parcels.find((p) => p.id === parcelId);
  if (error || !data || !parcel) return <ScreenError description={(error as Error | null)?.message ?? 'Colis introuvable dans cette arrivée'} onRetry={() => void refetch()} />;
  const st = warehouseStage(parcel);
  const busy = checkin.isPending || flag.isPending;
  const done = (msg: string) => { toast.success(msg); navigate(back, { replace: true }); };
  const place = (() => { try { return sessionStorage.getItem('bonzini-warehouse-place') ?? ''; } catch { return ''; } })();

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title={parcel.parcel_no} subtitle={data.label} showBack backTo={back} />
      <div className="space-y-6 px-4 pb-10 pt-4">
        <Card className="space-y-3">
          <ClientHead client={parcel.client} size="md" />
          <div className="flex items-center gap-3 border-t pt-3 dark:border-[#444444]"><CheckMark parcel={parcel} size="lg" /><ParcelText parcel={parcel} withTransport /></div>
          <div className="flex items-center justify-between gap-3">
            <StatusPill tone={st.tone} label={st.label} />
            {parcel.checked_in_at && <span className={cn('tabular-nums', TYPE.small, TEXT.muted)}>pointé le {formatDateTime(parcel.checked_in_at)}</span>}
          </div>
        </Card>

        {parcel.delivered_at ? (
          <WhQuestion title="Déjà remis au client" help={`Ce colis est sorti de l'entrepôt${parcel.release_no ? ` (bon ${parcel.release_no})` : ''}. Il n'y a plus rien à pointer.`} />
        ) : step === 'state' ? (
          <>
            <WhQuestion title="Ce colis est-il là ?" help={parcel.condition === 'missing' ? 'Il avait été déclaré manquant. S\'il est retrouvé, pointez-le.' : 'Regardez le carton : est-il entier, fermé, sec ?'} />
            <div className="space-y-3">
              <AnswerButton icon={Check} tone="primary" title="Oui, en bon état" help={place ? `Pointé, rangé en ${place}` : 'Pointé, prêt pour le client'} loading={busy}
                onClick={() => checkin.mutate({ parcelId: parcel.id, location: place || undefined, condition: 'ok' }, { onSuccess: () => done(`${parcel.parcel_no} pointé`) })} />
              <AnswerButton icon={AlertTriangle} tone="warn" title="Oui, mais abîmé" help="Ouvert, mouillé, écrasé : vous direz quoi" onClick={() => { setNote(parcel.condition_note ?? ''); setStep('damaged'); }} />
              {parcel.condition !== 'missing' && <AnswerButton icon={PackageX} tone="danger" title="Non, il manque" help="Jamais vu à l'arrivée" onClick={() => { setNote(''); setStep('missing'); }} />}
            </div>
          </>
        ) : step === 'damaged' ? (
          <>
            <WhQuestion title="Qu'est-ce qui ne va pas ?" help="Une phrase suffit. Elle sera sur le bon de retrait et l'équipe la verra." />
            <TextArea id="ck-note" label="Remarque" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Carton ouvert sur un coin, contenu intact" controlClassName="min-h-[96px]" autoFocus />
            <div className="space-y-2">
              <PrimaryPill onClick={() => checkin.mutate({ parcelId: parcel.id, location: place || undefined, condition: 'damaged', note: note.trim() || undefined }, { onSuccess: () => done(`${parcel.parcel_no} pointé, abîmé`) })} loading={busy} className="h-14 w-full text-[17px]"><AlertTriangle /> Pointer abîmé</PrimaryPill>
              <SoftPill onClick={() => setStep('state')} className="h-12 w-full text-[16px]">Retour</SoftPill>
            </div>
          </>
        ) : (
          <>
            <WhQuestion title="Le déclarer manquant ?" help="Il restera attendu. L'équipe le verra dans la console et cherchera avec Guangzhou. S'il arrive plus tard, vous le pointerez." />
            <TextArea id="ck-missing" label="Remarque (facultatif)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Absent de la palette 2" controlClassName="min-h-[72px]" />
            <div className="space-y-2">
              <PrimaryPill onClick={() => flag.mutate({ parcelId: parcel.id, missing: true, note: note.trim() || undefined }, { onSuccess: () => done(`${parcel.parcel_no} déclaré manquant`) })} loading={busy} className="h-14 w-full bg-[#C00F0C] text-[17px] text-white dark:bg-[#EC221F] dark:text-white"><PackageX /> Oui, manquant</PrimaryPill>
              <SoftPill onClick={() => setStep('state')} className="h-12 w-full text-[16px]">Retour</SoftPill>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
