// ============================================================
// Desktop admin — confirmer un geste qui retire quelque chose (un colis, un
// dépôt), avec son motif. Le motif part au journal : « doublon », « saisi sur
// le mauvais client », « colis repris par le fournisseur »… Il est demandé
// AVANT le clic, jamais après.
// ============================================================
import { useEffect, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TEXT, SOFT_PILL, CenterDialog, DANGER_SOFT_PILL, TextArea } from '@/desktop/designKit';

export function ReasonDialog({ open, onClose, onConfirm, title, children, confirmLabel, requireReason = true, busy = false, suggestions = [] }: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  requireReason?: boolean;
  busy?: boolean;
  /** Des motifs fréquents, en un clic. */
  suggestions?: string[];
}) {
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) setReason(''); }, [open]);
  const ok = !requireReason || reason.trim().length >= 3;
  const go = () => { if (ok && !busy) onConfirm(reason.trim()); };

  return (
    <CenterDialog
      open={open}
      onClose={onClose}
      onConfirm={go}
      width={480}
      title={title}
      footer={
        <>
          <button type="button" onClick={onClose} className={cn('ml-auto h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Annuler</button>
          <button type="button" onClick={go} disabled={!ok || busy} className={cn('inline-flex h-9 items-center gap-2 px-4 text-[13px] font-bold disabled:opacity-50', DANGER_SOFT_PILL)}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {confirmLabel}
          </button>
        </>
      }
    >
      {children && <div className={cn('mb-3 text-[13px] leading-relaxed', TEXT.body)}>{children}</div>}
      <label htmlFor="reason" className={cn('mb-1 block text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>
        Motif {requireReason ? '(obligatoire, gardé au journal)' : '(facultatif)'}
      </label>
      <TextArea id="reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Pourquoi ?" className="rounded-md text-[13.5px]" autoFocus />
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => setReason(s)} className={cn('h-7 px-2.5 text-[12px] font-semibold', SOFT_PILL)}>{s}</button>
          ))}
        </div>
      )}
    </CenterDialog>
  );
}
