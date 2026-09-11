/** Les pièces du dossier : liste sobre, ajout par dialogue centré. */
import { useRef, useState } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SOFT_PILL, SURFACE, TEXT, PRIMARY_PILL, CenterDialog, SecLabel, absShort } from '@/desktop/designKit';
import { useCargoDocuments, useDeleteCargoDocument, useUploadCargoDocument, openCargoDocument } from '@/hooks/useCargo';
import { DOCUMENT_KIND_LABEL } from '@/lib/cargo/model';

const KINDS = Object.keys(DOCUMENT_KIND_LABEL);

export function CargoDocuments({ shipmentId, canManage }: { shipmentId: string; canManage: boolean }) {
  const { data: docs } = useCargoDocuments(shipmentId);
  const upload = useUploadCargoDocument();
  const remove = useDeleteCargoDocument();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('BL');
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (!file) return;
    upload.mutate({ shipmentId, kind, file }, { onSuccess: () => { setOpen(false); setFile(null); } });
  };

  return (
    <div>
      <SecLabel
        className="mb-1.5"
        right={
          canManage && (
            <button type="button" onClick={() => setOpen(true)} className={cn('inline-flex h-7 items-center gap-1 px-2.5 text-[11px] font-semibold', SOFT_PILL)}>
              <Plus className="h-3 w-3" /> Ajouter
            </button>
          )
        }
      >
        Documents
      </SecLabel>
      {!docs || docs.length === 0 ? (
        <p className={cn('text-[12.5px]', TEXT.muted)}>Aucun document. Le bill of lading, la facture et le télex ont leur place ici.</p>
      ) : (
        <ul className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2.5 py-2">
              <FileText className={cn('h-4 w-4 shrink-0', TEXT.muted)} />
              <button type="button" onClick={() => openCargoDocument(d)} className="min-w-0 flex-1 text-left">
                <span className={cn('block truncate text-[12.5px] font-semibold', TEXT.strong)}>{DOCUMENT_KIND_LABEL[d.kind] ?? d.kind}</span>
                <span className={cn('block truncate text-[11px]', TEXT.muted)}>{d.file_name} · {absShort(d.created_at)}</span>
              </button>
              {canManage && (
                <button type="button" aria-label="Supprimer" onClick={() => remove.mutate(d)} className={cn('rounded-md p-1.5 hover:bg-destructive/10', TEXT.muted)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <CenterDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={submit}
        title="Ajouter un document"
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className={cn('h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Annuler</button>
            <button type="button" onClick={submit} disabled={!file || upload.isPending} className={cn('h-9 px-4 text-[13px] font-bold disabled:opacity-60', PRIMARY_PILL)}>
              {upload.isPending ? 'Envoi…' : 'Ajouter'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <SecLabel className="mb-1.5">Type de pièce</SecLabel>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)} className={cn('h-8 rounded-md px-3 text-[12px] font-semibold', k === kind ? PRIMARY_PILL : SOFT_PILL)}>
                  {DOCUMENT_KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <SecLabel className="mb-1.5">Fichier</SecLabel>
            <input ref={inputRef} id="cargo-doc-file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => inputRef.current?.click()} className={cn('flex h-20 w-full items-center justify-center rounded-lg border border-dashed border-input text-[13px]', SURFACE.inset, file ? TEXT.strong : TEXT.muted)}>
              {file ? file.name : 'Choisir un PDF ou une image (10 Mo max)'}
            </button>
          </div>
        </div>
      </CenterDialog>
    </div>
  );
}
