// ============================================================
// ENTREPÔT — La signature. Un grand cadre, le doigt, « Effacer » si besoin,
// une remarque si on veut, et « Remettre N colis ». La base vérifie une
// dernière fois que tout est soldé ; le bon de retrait BR-… s'ouvre.
// Refonte v2 (maquette 04/16) : la carte de qui emporte, les colis en
// photos, le devis soldé, le cadre de signature, un seul bouton noir.
// ============================================================
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SignaturePad from 'react-signature-canvas';
import { toast } from 'sonner';
import { UnpaidError, uploadSignature, useClientAtWarehouse, useReleaseParcels } from '@/hooks/useWarehouse';
import { clientFullName, formatKg } from '@/lib/reception';
import { nParcels } from '@/lib/warehouse';
import { xaf } from '@/lib/cargoQuote';
import { cn } from '@/lib/utils';
import { BigButton, Dock, EmptyLine, KVBox, ScreenTop, SURFACE, TEXT, Tag } from '@/mobile/designKit';
import { TextArea } from '@/components/form';
import { CapsLabel, FieldFrame, RowButton } from '@/mobile/components/cargo/v2';
import { ParcelThumb } from '@/mobile/components/reception/bits';
import { WhClientCard } from '@/mobile/components/warehouse/ClientCard';
import { readReleaseDraft, writeReleaseDraft } from './releaseDraft';

export function WarehouseSign() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const release = useReleaseParcels();
  const { data } = useClientAtWarehouse(code);
  const draft = readReleaseDraft(code);
  const sig = useRef<SignaturePad>(null);
  const [empty, setEmpty] = useState(true);
  const [noteOpen, setNoteOpen] = useState(!!draft?.note);
  const [note, setNote] = useState(draft?.note ?? '');
  const [saving, setSaving] = useState(false);
  if (!draft || !draft.who) {
    return (
      <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
        <ScreenTop title="Remise" backTo={`/w/remise/${code}`} />
        <EmptyLine action={{ label: 'Ses colis', onClick: () => navigate(`/w/remise/${code}`, { replace: true }) }}>Il manque qui emporte.</EmptyLine>
      </div>
    );
  }

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

  const parcels = data ? data.ready.filter((p) => draft.ids.includes(p.id)) : [];
  const kg = parcels.reduce((x, p) => x + Number(p.weight_kg ?? 0), 0);
  const deposits = new Set(parcels.map((p) => p.deposit_id));
  const quotes = data ? data.quotes.filter((q) => deposits.has(q.deposit_id)) : [];
  const self = data && draft.who === clientFullName(data.client);

  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop title="Remise" backTo={`/w/remise/${code}/qui`} />
      <div className="flex-1 px-5 pb-6 pt-4">
        {data
          ? <WhClientCard client={data.client} sub={[data.client.customer_code, self ? 'en personne' : `par ${draft.who}`].join(' · ')} />
          : <WhClientCard client={null} sub={draft.who} />}

        {parcels.length > 0 && (
          <>
            <CapsLabel className="mt-6">{nParcels(parcels.length)} · {formatKg(kg)}</CapsLabel>
            <div className="mt-3 grid grid-cols-3 gap-3 rounded-lg border border-[#D9D9D9] p-3 dark:border-[#444444]">
              {parcels.map((p) => (
                <span key={p.id} className="min-w-0 text-center">
                  <ParcelThumb path={p.photo_path} size="aspect-square h-auto w-full" />
                  <span className={cn('mt-1.5 block truncate text-[15px] tabular-nums', TEXT.muted)}>{[p.warehouse_location, String(p.seq).padStart(2, '0')].filter(Boolean).join(' · ')}</span>
                </span>
              ))}
            </div>
          </>
        )}

        {quotes.length > 0 && (
          <KVBox className="mt-5" rows={quotes.flatMap((q) => [
            { label: `Devis ${q.deposit_no}`, value: xaf(q.total_xaf) },
            { label: 'Reste à payer', value: <span className="inline-flex items-center gap-2">{xaf(q.balance_xaf)}{q.balance_xaf <= 0 && <Tag tone="success">Payé</Tag>}</span> },
          ])} />
        )}

        <CapsLabel className="mt-6">Signature</CapsLabel>
        <FieldFrame className="mt-2 overflow-hidden bg-white" action={empty ? undefined : { label: 'Effacer', onClick: () => { sig.current?.clear(); setEmpty(true); } }}>
          <div className="relative" style={{ height: 200 }}>
            <SignaturePad ref={sig} penColor="#1E1E1E" canvasProps={{ className: 'h-full w-full', style: { touchAction: 'none' }, 'aria-label': 'Signature' } as React.CanvasHTMLAttributes<HTMLCanvasElement>} onEnd={() => setEmpty(!!sig.current?.isEmpty())} />
            <span aria-hidden className="pointer-events-none absolute inset-x-5 bottom-9 border-t border-dashed border-[#B3B3B3]" />
            {empty && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[17px] text-[#949494]">Signez ici</span>}
          </div>
        </FieldFrame>
        {empty && <p className="mt-2 text-[15px] font-medium text-[#975102] dark:text-[#E8B931]">Sans signature, pas de preuve sur le bon</p>}

        <div className="mt-5">
          {noteOpen
            ? <TextArea id="rl-note" label="Remarque" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Colis ouvert devant le client…" controlClassName="min-h-[72px]" autoFocus />
            : <RowButton link onClick={() => setNoteOpen(true)}>Ajouter une remarque</RowButton>}
        </div>
      </div>
      <Dock>
        <BigButton onClick={() => void submit()} loading={saving}>Remettre {nParcels(draft.ids.length)}</BigButton>
      </Dock>
    </div>
  );
}
