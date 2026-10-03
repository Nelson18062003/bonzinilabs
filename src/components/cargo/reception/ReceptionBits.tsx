// ============================================================
// Desktop admin — les petites pièces de la console Réception : la vignette
// d'un colis avec son nombre de photos, la tuile du mur de photos, l'état
// d'un dépôt en une pastille, le devis en une ligne.
// ============================================================
import { Camera, ImageOff } from 'lucide-react';
import { useParcelPhotoUrl } from '@/hooks/useReception';
import { depositStage, parcelPhotoPaths, type Deposit, type Parcel } from '@/lib/reception';
import { quoteStatusMeta, xaf } from '@/lib/cargoQuote';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, StatusPill } from '@/desktop/designKit';

/** La couverture d'un colis, et combien de photos il a (« 3 »). Sans photo : l'appareil, en ambre. */
export function CoverThumb({ parcel, size = 'h-10 w-10', onClick }: { parcel: Pick<Parcel, 'photo_path' | 'photos'>; size?: string; onClick?: () => void }) {
  const paths = parcelPhotoPaths(parcel);
  const { data: url } = useParcelPhotoUrl(paths[0]);
  const inner = (
    <>
      {url ? <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" draggable={false} /> : paths.length === 0 ? <Camera className="h-4 w-4 text-amber-600 dark:text-amber-400" /> : null}
      {paths.length > 1 && <span className="absolute bottom-0.5 right-0.5 rounded bg-black/65 px-1 text-[9.5px] font-bold leading-[14px] text-white tabular-nums">{paths.length}</span>}
    </>
  );
  const cls = cn('relative flex shrink-0 items-center justify-center overflow-hidden rounded-md', paths.length === 0 ? 'border border-dashed border-amber-300 dark:border-amber-700' : 'ring-1 ring-border', size, SURFACE.inset);
  if (!onClick) return <span className={cls}>{inner}</span>;
  return <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={paths.length ? 'Voir les photos' : 'Pas de photo'} className={cn(cls, 'transition-opacity hover:opacity-85')}>{inner}</button>;
}

/** Une tuile du mur de photos : la photo, le numéro du colis, « 2/3 ». */
export function PhotoTile({ path, caption, sub, onClick }: { path: string | null; caption: string; sub?: string; onClick: () => void }) {
  const { data: url } = useParcelPhotoUrl(path);
  return (
    <button type="button" onClick={onClick} className={cn('group relative aspect-[4/3] overflow-hidden rounded-lg ring-1 ring-border', path ? SURFACE.inset : 'border-2 border-dashed border-amber-300 ring-0 dark:border-amber-700')}>
      {path ? (
        url ? <img src={url} alt={caption} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" draggable={false} /> : <span className="block h-full w-full animate-pulse bg-muted" />
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-amber-700 dark:text-amber-400">
          <ImageOff className="h-5 w-5" /><span className="text-[11.5px] font-semibold">Sans photo</span>
        </span>
      )}
      <span className={cn('absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 px-2 pb-1.5 pt-6 text-left', path ? 'bg-gradient-to-t from-black/70 to-transparent text-white' : 'text-amber-800 dark:text-amber-300')}>
        <span className="min-w-0 truncate font-mono text-[11px] font-bold">{caption}</span>
        {sub && <span className="shrink-0 text-[10.5px] font-semibold tabular-nums opacity-85">{sub}</span>}
      </span>
    </button>
  );
}

/** L'état d'un dépôt : supprimé, en cours de saisie, ou où en sont ses colis. */
export function DepositStatePill({ deposit }: { deposit: Deposit }) {
  if (deposit.status === 'cancelled') return <StatusPill tone="danger" label="Supprimé" />;
  if (deposit.status === 'open') return <StatusPill tone="info" label="En cours de saisie" />;
  const st = depositStage(deposit.parcels);
  return <StatusPill tone={st.tone} label={st.label} />;
}

/** Le devis en une ligne : statut, et le reste à payer (ou le total). */
export function QuoteCell({ deposit }: { deposit: Deposit }) {
  const q = quoteStatusMeta(deposit.quote_status);
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <StatusPill tone={q.tone} label={q.short} />
      {deposit.quote_total_xaf != null && (
        <span className={cn('text-[11.5px] tabular-nums', TEXT.muted)}>
          {deposit.quote_paid_xaf && deposit.quote_paid_xaf > 0 && deposit.quote_paid_xaf < deposit.quote_total_xaf ? `reste ${xaf(deposit.quote_total_xaf - deposit.quote_paid_xaf)}` : xaf(deposit.quote_total_xaf)}
        </span>
      )}
    </span>
  );
}
