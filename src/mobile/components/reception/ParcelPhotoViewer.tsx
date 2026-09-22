// ============================================================
// La photo d'un colis, en grand. Le réceptionnaire l'a prise sur le
// terrain ; le fondateur, l'équipe et l'agent de Douala doivent pouvoir la
// voir pour de vrai — pas une vignette. Plein écran, on glisse d'un colis
// à l'autre (doigt, flèches, clavier), on lit ce qu'on sait du colis, on
// télécharge. Un colis sans photo le dit, au lieu d'un carré vide.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ImageOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { useParcelPhotoUrl } from '@/hooks/useReception';
import { formatCbm, formatDims, formatKg, type Parcel } from '@/lib/reception';
import { deliverFile } from '@/components/customer-code/exportShippingLabel';
import { cn } from '@/lib/utils';

/** Ce que le visionneur sait dire d'un colis : le colis, et ce que l'écran d'appel veut ajouter (« Pointé · B3 », « Remis · BR-… »). */
export interface ViewerParcel extends Pick<Parcel, 'id' | 'seq' | 'parcel_no' | 'kind' | 'weight_kg' | 'length_cm' | 'width_cm' | 'height_cm' | 'cbm' | 'description' | 'photo_path'> {
  /** Une ligne de plus sous les mesures : l'étape, la place, l'état. */
  note?: string | null;
}

const KIND_FR: Record<string, string> = { carton: 'Carton', bag: 'Sac', bale: 'Ballot', roll: 'Rouleau', pallet: 'Palette', other: 'Autre' };

/** L'état du visionneur : ouvert sur quel colis. À monter avec <ParcelPhotoViewer {...viewer} parcels={…} />. */
export function useParcelViewer() {
  const [index, setIndex] = useState<number | null>(null);
  return { index, open: (i: number) => setIndex(i), close: () => setIndex(null), setIndex };
}

export function ParcelPhotoViewer({ parcels, index, close, setIndex, title }: { parcels: ReadonlyArray<ViewerParcel>; index: number | null; close: () => void; setIndex: (i: number) => void; title?: string }) {
  const open = index !== null && parcels.length > 0;
  const i = Math.min(Math.max(index ?? 0, 0), Math.max(parcels.length - 1, 0));
  const parcel = open ? parcels[i] : null;
  const { data: url, isLoading } = useParcelPhotoUrl(parcel?.photo_path);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const prev = useCallback(() => { if (i > 0) setIndex(i - 1); }, [i, setIndex]);
  const next = useCallback(() => { if (i < parcels.length - 1) setIndex(i + 1); }, [i, parcels.length, setIndex]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') prev(); else if (e.key === 'ArrowRight') next(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [open, close, prev, next]);

  if (!open || !parcel) return null;

  const download = async () => {
    if (!url) return;
    setSaving(true);
    try {
      const blob = await fetch(url).then((r) => { if (!r.ok) throw new Error('Photo indisponible'); return r.blob(); });
      const file = new File([blob], `${parcel.parcel_no}.jpg`, { type: blob.type || 'image/jpeg' });
      if ((await deliverFile(file, parcel.parcel_no)) === 'downloaded') toast.success(`Photo ${parcel.parcel_no} téléchargée`);
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  };

  const measures = [parcel.weight_kg != null ? formatKg(parcel.weight_kg) : null, parcel.length_cm != null ? formatDims(parcel) : null, parcel.cbm != null ? formatCbm(parcel.cbm) : null].filter(Boolean).join(' · ');
  const many = parcels.length > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo du colis ${parcel.parcel_no}`}
      className="fixed inset-0 z-[80] flex flex-col bg-black text-white"
      onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        const t = touch.current; touch.current = null; if (!t) return;
        const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx < 0) next(); else prev(); }
      }}
    >
      {/* En haut : le numéro, le compteur, fermer. */}
      <div className="flex items-center gap-3 px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-semibold tabular-nums">{parcel.parcel_no}</span>
          <span className="block truncate text-[13px] text-white/70">{title ? `${title} · ` : ''}{many ? `colis ${i + 1} sur ${parcels.length}` : 'un colis'}</span>
        </span>
        <button type="button" onClick={() => void download()} disabled={!url || saving} aria-label="Télécharger la photo" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 disabled:opacity-40"><Download className="h-5 w-5" /></button>
        <button type="button" onClick={close} aria-label="Fermer" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15"><X className="h-5 w-5" /></button>
      </div>

      {/* La photo, aussi grande que l'écran le permet. */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {url ? (
          <img src={url} alt={`Colis ${parcel.parcel_no}`} className="max-h-full max-w-full object-contain" draggable={false} />
        ) : isLoading && parcel.photo_path ? (
          <span className="text-[15px] text-white/70">Chargement…</span>
        ) : (
          <span className="flex flex-col items-center gap-3 px-8 text-center text-white/70">
            <ImageOff className="h-10 w-10" />
            <span className="text-[16px] font-medium">Pas de photo pour ce colis</span>
            <span className="text-[13px]">Le réceptionnaire ne l'a pas photographié à l'arrivée.</span>
          </span>
        )}
        {many && i > 0 && (
          <button type="button" onClick={prev} aria-label="Colis précédent" className="absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 sm:flex"><ChevronLeft className="h-6 w-6" /></button>
        )}
        {many && i < parcels.length - 1 && (
          <button type="button" onClick={next} aria-label="Colis suivant" className="absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 sm:flex"><ChevronRight className="h-6 w-6" /></button>
        )}
      </div>

      {/* En bas : ce qu'on sait du colis, et les points de la série. */}
      <div className="space-y-2 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
        <p className="text-[16px] font-semibold leading-snug">
          <span className="mr-2 tabular-nums text-white/60">{String(parcel.seq).padStart(2, '0')}</span>{parcel.description || KIND_FR[parcel.kind] || parcel.kind}
        </p>
        {measures && <p className="text-[14px] tabular-nums text-white/80">{measures}</p>}
        {parcel.note && <p className="text-[14px] text-white/80">{parcel.note}</p>}
        {many && (
          <div className="flex items-center justify-center gap-1.5 pt-1" aria-hidden="true">
            {parcels.map((p, k) => <span key={p.id} className={cn('h-1.5 rounded-full transition-all', k === i ? 'w-5 bg-white' : 'w-1.5 bg-white/40')} />)}
          </div>
        )}
      </div>
    </div>
  );
}
