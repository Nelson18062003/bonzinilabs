/**
 * « Les papiers » — une phrase par pièce, et le geste juste dessous.
 *
 * Pour quelqu'un qui n'est pas logisticien : chaque pièce dit ce qu'elle
 * est, qui la fait, et pourquoi on ne peut pas s'en passer. Manquante → un
 * bouton « Ajouter » qui ouvre directement l'appareil photo ou les fichiers
 * du téléphone, sans dialogue intermédiaire. Reçue → la date, le fichier à
 * ouvrir d'un tap, et « Retirer » derrière une confirmation.
 */
import { useRef, useState } from 'react';
import { CheckCircle2, Circle, FileText, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useCargoDocuments, useDeleteCargoDocument, useUploadCargoDocument, openCargoDocument } from '@/hooks/useCargo';
import { DOCUMENT_KINDS } from '@/lib/cargo/model';
import type { CargoDocument, CargoShipment } from '@/lib/cargo/model';
import { whenSentence } from '@/lib/plainTime';
import { cn } from '@/lib/utils';
import { TEXT, SURFACE, BottomSheet, Button } from '@/mobile/designKit';

/** Ce que chaque pièce est, en une phrase qu'on peut dire à voix haute. */
const WHY: Record<string, string> = {
  BL: "C'est le titre de la marchandise. L'armateur l'émet quand le conteneur part ; sans lui, personne ne peut réclamer la boîte.",
  TELEX: "C'est la preuve que le fret est payé. L'armateur l'envoie après paiement ; sans lui, le conteneur reste au port.",
  INVOICE: "C'est la facture du fournisseur chinois. La douane s'en sert pour calculer les droits à payer.",
  PACKING_LIST: "C'est la liste des colis et des poids, faite par le fournisseur. La douane la compare à ce qu'elle voit.",
  BESC: "C'est le bordereau du Conseil des chargeurs. Obligatoire pour entrer au Cameroun ; sans lui, la déclaration est refusée.",
  CUSTOMS: 'La déclaration en douane, la quittance des droits, le bon à enlever.',
  OTHER: "Certificat d'origine, assurance, ANOR, PECAE… tout ce qui peut être demandé.",
};
/** Le nom qu'on dit, avec l'article. */
const NAME: Record<string, string> = {
  BL: 'le bill of lading', TELEX: 'le télex', INVOICE: 'la facture', PACKING_LIST: 'la packing list',
  BESC: 'le BESC', CUSTOMS: 'les pièces de douane', OTHER: 'une autre pièce',
};
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function MobilePapiers({ shipment: s, canManage }: { shipment: CargoShipment; canManage: boolean }) {
  const { data: docs } = useCargoDocuments(s.id);
  const upload = useUploadCargoDocument();
  const remove = useDeleteCargoDocument();
  const inputRef = useRef<HTMLInputElement>(null);
  const kindRef = useRef<string>('OTHER');
  const [toRemove, setToRemove] = useState<CargoDocument | null>(null);

  const pick = (kind: string) => { kindRef.current = kind; inputRef.current?.click(); };
  const onFile = (file: File | null) => {
    if (!file) return;
    upload.mutate({ shipmentId: s.id, kind: kindRef.current, file }, {
      onSuccess: () => toast.success(`${cap(NAME[kindRef.current] ?? 'La pièce')} est ajouté${/^la /.test(NAME[kindRef.current] ?? '') ? 'e' : ''} au dossier.`),
      onError: (e) => toast.error((e as Error).message),
    });
    if (inputRef.current) inputRef.current.value = '';
  };

  const required = DOCUMENT_KINDS.filter((k) => k.required);
  const optional = DOCUMENT_KINDS.filter((k) => !k.required);
  const files = (kind: string) => (docs ?? []).filter((d) => d.kind === kind);
  const missing = required.filter((k) => files(k.kind).length === 0).length;

  return (
    <div className="space-y-5">
      <p className={cn('text-[16px] leading-relaxed', TEXT.body)}>
        {missing === 0
          ? 'Les cinq pièces obligatoires sont là. Le conteneur peut passer la douane.'
          : `Il manque ${missing === 1 ? 'une pièce obligatoire' : `${missing} pièces obligatoires`} sur cinq. Sans elles, le conteneur ne sort pas du port.`}
      </p>

      <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />

      <ul className="space-y-5">
        {[...required, ...optional].map((k) => {
          const have = files(k.kind);
          const ok = have.length > 0;
          return (
            <li key={k.kind} className={cn('space-y-2 border-t pt-4 first:border-t-0 first:pt-0', SURFACE.divider)}>
              <div className="flex items-start gap-3">
                {ok
                  ? <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[#009951] dark:text-[#14AE5C]" />
                  : <Circle className={cn('mt-0.5 h-6 w-6 shrink-0', k.required ? 'text-[#C00F0C] dark:text-[#EC221F]' : 'text-[#B3B3B3]')} />}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className={cn('text-[18px] font-semibold leading-snug', TEXT.strong)}>
                    {k.label}{ok ? '' : k.required ? ' — manque' : ' — pas encore'}
                  </p>
                  <p className={cn('text-[16px] leading-relaxed', TEXT.muted)}>{WHY[k.kind]}</p>
                </div>
              </div>

              {have.map((d) => (
                <div key={d.id} className={cn('ml-9 flex items-center gap-2 rounded-lg p-2', SURFACE.inset)}>
                  <button type="button" onClick={() => openCargoDocument(d)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <FileText className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
                    <span className="min-w-0">
                      <span className={cn('block break-words text-[16px] font-medium', TEXT.strong)}>{d.file_name}</span>
                      <span className={cn('block text-[16px]', TEXT.muted)}>Reçu {whenSentence(d.created_at)}</span>
                    </span>
                  </button>
                  {canManage && <Button variant="subtle" size="sm" onClick={() => setToRemove(d)}>Retirer</Button>}
                </div>
              ))}

              {canManage && (
                <div className="ml-9">
                  <Button variant={ok ? 'subtle' : 'neutral'} size={ok ? 'sm' : 'md'} onClick={() => pick(k.kind)} loading={upload.isPending && kindRef.current === k.kind}>
                    <Plus /> {ok ? 'Ajouter une autre' : `Ajouter ${NAME[k.kind]}`}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className={cn('text-[16px] leading-relaxed', TEXT.muted)}>Une photo du téléphone suffit. PDF ou image, 10 Mo au plus.</p>

      <BottomSheet open={!!toRemove} onClose={() => setToRemove(null)} title="Retirer cette pièce ?">
        <p className={cn('text-[16px] leading-relaxed', TEXT.body)}>
          <b className="break-words">{toRemove?.file_name}</b> sera retiré du dossier. Tu pourras l'ajouter à nouveau.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="neutral" className="flex-1" onClick={() => setToRemove(null)}>Garder</Button>
          <Button variant="danger" className="flex-1" loading={remove.isPending} onClick={() => { if (toRemove) remove.mutate(toRemove, { onSuccess: () => setToRemove(null) }); }}>Retirer</Button>
        </div>
      </BottomSheet>
    </div>
  );
}
