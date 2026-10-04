/** Aperçu plein écran d'un fichier cargo (pièce du classeur ou justificatif de coût). */
import { ChevronLeft, ChevronRight, Download, ExternalLink, Trash2 } from 'lucide-react';
import { downloadCargoDocument, openCargoDocument } from '@/hooks/useCargo';
import { ToolButton } from '@/components/cargo/dossier/kit';
import { docTitle, fileSize, isImage, isPdf } from '@/lib/cargo/documents';
import type { CargoDocument } from '@/lib/cargo/model';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, CenterDialog } from '@/desktop/designKit';

/** Aperçu plein écran : image ou PDF, avec précédent / suivant dans la même pièce. */
export function DocPreview({ docs, index, urls, onIndex, onClose, onDelete }: {
  docs: CargoDocument[]; index: number; urls: Record<string, string>; onIndex: (i: number) => void; onClose: () => void;
  /** Si fourni, un bouton « Supprimer » (justificatifs de coûts). */
  onDelete?: (doc: CargoDocument) => void;
}) {
  const doc = docs[index];
  if (!doc) return null;
  const url = urls[doc.storage_path];
  return (
    <CenterDialog
      open
      onClose={onClose}
      width={980}
      title={
        <div className="min-w-0">
          <div className={cn('truncate text-[16px] font-bold', TEXT.strong)}>{docTitle(doc)}</div>
          <div className={cn('text-[12px] tabular-nums', TEXT.muted)}>{index + 1} / {docs.length}{doc.size_bytes ? ` · ${fileSize(doc.size_bytes)}` : ''}</div>
        </div>
      }
      footer={
        <>
          <ToolButton icon={ChevronLeft} onClick={() => onIndex(index - 1)} disabled={index === 0}>Précédent</ToolButton>
          <ToolButton icon={ChevronRight} onClick={() => onIndex(index + 1)} disabled={index >= docs.length - 1}>Suivant</ToolButton>
          <span className="ml-auto flex gap-2">
            <ToolButton icon={ExternalLink} onClick={() => openCargoDocument(doc)}>Ouvrir</ToolButton>
            <ToolButton icon={Download} onClick={() => downloadCargoDocument(doc)}>Télécharger</ToolButton>
            {onDelete && <ToolButton icon={Trash2} danger onClick={() => onDelete(doc)}>Supprimer</ToolButton>}
          </span>
        </>
      }
    >
      <div className={cn('flex h-[70vh] items-center justify-center overflow-hidden rounded-[12px]', SURFACE.inset)}>
        {!url ? (
          <span className={cn('text-[13px]', TEXT.muted)}>Chargement…</span>
        ) : isImage(doc) ? (
          <img src={url} alt={docTitle(doc)} className="max-h-full max-w-full object-contain" />
        ) : isPdf(doc) ? (
          <iframe src={url} title={docTitle(doc)} className="h-full w-full rounded-[12px] bg-white" />
        ) : (
          <ToolButton icon={ExternalLink} onClick={() => openCargoDocument(doc)}>Ouvrir le fichier</ToolButton>
        )}
      </div>
      {doc.note && <p className={cn('mt-3 text-[13px]', TEXT.body)}>{doc.note}</p>}
    </CenterDialog>
  );
}

