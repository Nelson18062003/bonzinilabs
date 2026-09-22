// ============================================================
// ENTREPÔT — La signature. Un grand cadre, le doigt, « Effacer » si besoin,
// une remarque si on veut, et « Confirmer la remise ». La base vérifie une
// dernière fois que tout est soldé ; le bon de retrait BR-… s'ouvre.
// ============================================================
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SignaturePad from 'react-signature-canvas';
import { Eraser, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { UnpaidError, uploadSignature, useReleaseParcels } from '@/hooks/useWarehouse';
import { nParcels } from '@/lib/warehouse';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, TYPE, Line, PrimaryPill, ScreenError, SoftPill } from '@/mobile/designKit';
import { TextArea } from '@/components/form';
import { WhQuestion } from '@/mobile/components/warehouse/bits';
import { readReleaseDraft, writeReleaseDraft } from './releaseDraft';

export function WarehouseSign() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const release = useReleaseParcels();
  const draft = readReleaseDraft(code);
  const sig = useRef<SignaturePad>(null);
  const [empty, setEmpty] = useState(true);
  const [noteOpen, setNoteOpen] = useState(!!draft?.note);
  const [note, setNote] = useState(draft?.note ?? '');
  const [saving, setSaving] = useState(false);
  if (!draft || !draft.who) return <ScreenError title="Il manque qui emporte" description="Repartez de la liste de ses colis." onRetry={() => navigate(`/w/remise/${code}`, { replace: true })} retryLabel="Ses colis" />;

  const submit = async () => {
    setSaving(true);
    try {
      const dataUrl = sig.current && !sig.current.isEmpty() ? sig.current.toDataURL('image/png') : null;
      const signaturePath = dataUrl ? await uploadSignature(dataUrl) : null;
      const rel = await release.mutateAsync({ parcelIds: draft.ids, pickedByName: draft.who!, pickedByPhone: draft.phone || undefined, signaturePath, note: note.trim() || undefined });
      writeReleaseDraft(null);
      navigate(`/w/bon/${rel.id}`, { replace: true, state: { signature: dataUrl } });
    } catch (e) {
      if (e instanceof UnpaidError) { toast.error('Remise bloquée', { description: e.message }); navigate(`/w/remise/${code}`, { replace: true }); }
      else toast.error((e as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <div className={cn('flex min-h-full flex-col', SURFACE.canvas)}>
      <MobileHeader title="Remettre" showBack backTo={`/w/remise/${code}/qui`} />
      <div className="space-y-5 px-4 pb-10 pt-4">
        <WhQuestion title={`${draft.who} signe`} help={`${nParcels(draft.ids.length)}. Tendez le téléphone : la signature va sur le bon de retrait.`} />
        <div className={cn('relative overflow-hidden rounded-lg border-2 border-dashed bg-white', SURFACE.divider)} style={{ height: 240 }}>
          <SignaturePad ref={sig} penColor="#1E1E1E" canvasProps={{ className: 'h-full w-full', style: { touchAction: 'none' } }} onEnd={() => setEmpty(!!sig.current?.isEmpty())} />
          {empty && <span className={cn('pointer-events-none absolute inset-0 flex items-center justify-center text-[18px] text-[#949494]')}>Signez ici, avec le doigt</span>}
          {!empty && <button type="button" onClick={() => { sig.current?.clear(); setEmpty(true); }} className={cn('absolute right-2 top-2 flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold', SURFACE.holder)}><Eraser className="h-4 w-4" /> Effacer</button>}
        </div>
        {empty ? <Line tone="warn">Sans signature, le bon de retrait n'aura pas de preuve.</Line> : <Line tone="good">Signature enregistrée sur le bon.</Line>}
        {noteOpen ? (
          <TextArea id="rl-note" label="Remarque" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Un colis ouvert devant le client, contenu vérifié…" controlClassName="min-h-[72px]" autoFocus />
        ) : (
          <button type="button" onClick={() => setNoteOpen(true)} className={cn('h-10 text-[15px] font-semibold', TEXT.muted)}>+ Ajouter une remarque</button>
        )}
        <div className="space-y-2">
          <PrimaryPill onClick={() => void submit()} loading={saving} className="h-14 w-full text-[17px]"><PackageCheck /> Confirmer la remise</PrimaryPill>
          <SoftPill onClick={() => navigate(`/w/remise/${code}/qui`)} className="h-12 w-full text-[16px]">Retour</SoftPill>
        </div>
        <p className={cn('text-center', TYPE.small, TEXT.muted)}>Le bon de retrait BR-… s'ouvre ensuite, à partager au client.</p>
      </div>
    </div>
  );
}
