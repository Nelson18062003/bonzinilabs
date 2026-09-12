/**
 * Onglet Documents — le classeur du dossier.
 *
 * Une ligne par PIÈCE attendue (pas par fichier) : on voit d'abord ce qui
 * manque. Les pièces obligatoires pour sortir un conteneur au Cameroun sont
 * séparées des pièces de confort.
 */
import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileText, Plus, Trash2 } from 'lucide-react';
import { useCargoDocuments, useDeleteCargoDocument, useUploadCargoDocument, openCargoDocument } from '@/hooks/useCargo';
import { Section } from '@/components/cargo/dossier/kit';
import { DOCUMENT_KINDS } from '@/lib/cargo/model';
import type { CargoDocument, CargoShipment } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, SOFT_PILL, PRIMARY_PILL, CenterDialog, SecLabel, absShort } from '@/desktop/designKit';

function kb(n: number | null) {
  if (n == null) return '';
  return n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1000))} Ko`;
}

function KindRow({
  kind, label, who, required, files, canManage, onAdd, onDelete,
}: {
  kind: string; label: string; who: string; required: boolean;
  files: CargoDocument[]; canManage: boolean;
  onAdd: (kind: string) => void; onDelete: (d: CargoDocument) => void;
}) {
  const present = files.length > 0;
  return (
    <div className="border-t border-black/[0.06] py-3 first:border-t-0 first:pt-0 dark:border-white/[0.06]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2.5">
          {present
            ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            : required
              ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              : <FileText className={cn('mt-0.5 h-4 w-4 shrink-0', TEXT.muted)} />}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn('text-[13px] font-semibold', TEXT.strong)}>{label}</span>
              {required && !present && <span className="rounded-md bg-destructive/10 px-1.5 py-0.5 text-[10.5px] font-bold text-destructive">manquant</span>}
            </div>
            <p className={cn('mt-0.5 text-[11.5px]', TEXT.muted)}>{who}</p>
          </div>
        </div>
        {canManage && (
          <button type="button" onClick={() => onAdd(kind)} className={cn('inline-flex h-7 shrink-0 items-center gap-1 px-2.5 text-[11.5px] font-semibold', SOFT_PILL)}>
            <Plus className="h-3 w-3" /> Ajouter
          </button>
        )}
      </div>
      {present && (
        <ul className="mt-2 space-y-1 pl-[26px]">
          {files.map((d) => (
            <li key={d.id} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5', SURFACE.inset)}>
              <button type="button" onClick={() => openCargoDocument(d)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <Download className={cn('h-3.5 w-3.5 shrink-0', TEXT.muted)} />
                <span className={cn('truncate text-[12.5px] font-medium', TEXT.body)}>{d.file_name}</span>
                <span className={cn('shrink-0 text-[11px] tabular-nums', TEXT.muted)}>{absShort(d.created_at)}{d.size_bytes ? ` · ${kb(d.size_bytes)}` : ''}</span>
              </button>
              {canManage && (
                <button type="button" onClick={() => onDelete(d)} aria-label="Supprimer" className={cn('rounded-md p-1 hover:bg-destructive/10', TEXT.muted)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TabDocuments({ shipment: s, canManage }: { shipment: CargoShipment; canManage: boolean }) {
  const { data: docs } = useCargoDocuments(s.id);
  const upload = useUploadCargoDocument();
  const remove = useDeleteCargoDocument();
  const [addKind, setAddKind] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const byKind = (k: string) => (docs ?? []).filter((d) => d.kind === k);
  const required = DOCUMENT_KINDS.filter((k) => k.required);
  const optional = DOCUMENT_KINDS.filter((k) => !k.required);
  const missing = required.filter((k) => byKind(k.kind).length === 0).length;

  const submit = () => {
    if (!file || !addKind) return;
    upload.mutate({ shipmentId: s.id, kind: addKind, file }, { onSuccess: () => { setAddKind(null); setFile(null); } });
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-5 max-lg:grid-cols-1">
      <div className="space-y-5">
        <Section
          title="Pièces obligatoires"
          meta={missing === 0 ? 'complètes' : `${missing} manquante${missing > 1 ? 's' : ''}`}
        >
          {required.map((k) => (
            <KindRow key={k.kind} {...k} files={byKind(k.kind)} canManage={canManage} onAdd={setAddKind} onDelete={(d) => remove.mutate(d)} />
          ))}
        </Section>
        <Section title="Autres pièces">
          {optional.map((k) => (
            <KindRow key={k.kind} {...k} files={byKind(k.kind)} canManage={canManage} onAdd={setAddKind} onDelete={(d) => remove.mutate(d)} />
          ))}
        </Section>
      </div>

      <Section title="Pourquoi ces pièces">
        <p className={cn('text-[12.5px] leading-relaxed', TEXT.body)}>
          Sans <b>bill of lading</b> et <b>télex release</b>, l'armateur ne remet pas la marchandise. Sans <b>facture</b> et
          <b> packing list</b>, la douane ne peut pas établir la valeur. Sans <b>BESC</b>, la déclaration est bloquée au
          Cameroun et une pénalité s'ajoute.
        </p>
        <p className={cn('mt-3 text-[12.5px]', TEXT.muted)}>
          Formats acceptés : PDF, JPG, PNG, WebP. 10 Mo maximum par pièce. Les fichiers sont stockés dans un espace privé :
          seuls les membres autorisés du module Cargo peuvent les ouvrir.
        </p>
      </Section>

      <CenterDialog
        open={!!addKind}
        onClose={() => { setAddKind(null); setFile(null); }}
        onConfirm={submit}
        title={addKind ? `Ajouter — ${DOCUMENT_KINDS.find((k) => k.kind === addKind)?.label}` : ''}
        footer={
          <>
            <button type="button" onClick={() => { setAddKind(null); setFile(null); }} className={cn('h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Annuler</button>
            <button type="button" onClick={submit} disabled={!file || upload.isPending} className={cn('h-9 px-4 text-[13px] font-bold disabled:opacity-60', PRIMARY_PILL)}>
              {upload.isPending ? 'Envoi…' : 'Ajouter'}
            </button>
          </>
        }
      >
        <SecLabel className="mb-1.5">Fichier</SecLabel>
        <input ref={inputRef} id="cargo-doc-file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn('flex h-24 w-full items-center justify-center rounded-[10px] border border-dashed border-input text-[13px]', SURFACE.inset, file ? TEXT.strong : TEXT.muted)}
        >
          {file ? file.name : 'Choisir un PDF ou une image (10 Mo max)'}
        </button>
      </CenterDialog>
    </div>
  );
}
