/**
 * Pièces communes des écrans Douane de la refonte v2 (maquettes 06/06-11,
 * 10/54-58). Les données restent celles de useCustomsReview (supabaseAdmin).
 */
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { ClientCard } from '@/lib/customs/files';
import { formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/mobile/designKit';

export const clientName = (c: ClientCard | null | undefined) =>
  c?.company_name || [c?.first_name, c?.last_name].filter(Boolean).join(' ') || '—';
export const clientFirst = (c: ClientCard | null | undefined) => c?.first_name || clientName(c);

/** L'attente dans une file : « 2 h », « 1 j », « 12 min ». */
export function waited(iso: string | null | undefined): string {
  if (!iso) return '';
  const h = Math.max(0, (Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} j`;
}

/** « il y a 2 h » */
export const agoLabel = (iso: string | null | undefined) => (iso ? `il y a ${waited(iso)}` : '');

/** 1 284 000 → « 1 284 000 » (espace insécable, qui s'affiche en DM Sans). */
export const nb = (n: number) => formatNumber(Math.round(n)).replace(/ /g, ' ');
/** 1 284 000 → « 1,28 M » (les puces du montant récupérable). */
export const millions = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M` : nb(n));

/** Les photos d'une fiche en plein écran : toucher le fond ferme, flèches pour passer. */
export function PhotoViewer({ urls, start, onClose }: { urls: string[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((x) => Math.min(urls.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, urls.length]);
  const btn = cn('flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white active:bg-white/25', FOCUS_RING);
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/90" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="flex justify-end px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)]">
        <button type="button" aria-label="Fermer" className={btn} onClick={onClose}><X className="h-6 w-6" /></button>
      </div>
      <div className="flex flex-1 items-center justify-center px-3" onClick={(e) => e.stopPropagation()}>
        <img src={urls[i]} alt={`Photo ${i + 1}`} className="max-h-full max-w-full rounded-lg object-contain" />
      </div>
      {urls.length > 1 && (
        <div className="flex items-center justify-center gap-6 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-4 text-[16px] font-semibold text-white" onClick={(e) => e.stopPropagation()}>
          <button type="button" aria-label="Photo précédente" className={btn} disabled={i === 0} onClick={() => setI(i - 1)}><ChevronLeft className="h-6 w-6" /></button>
          <span className="tabular-nums">{i + 1} / {urls.length}</span>
          <button type="button" aria-label="Photo suivante" className={btn} disabled={i === urls.length - 1} onClick={() => setI(i + 1)}><ChevronRight className="h-6 w-6" /></button>
        </div>
      )}
    </div>
  );
}
