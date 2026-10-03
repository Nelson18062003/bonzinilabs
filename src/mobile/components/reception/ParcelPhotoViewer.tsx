// ============================================================
// Les photos d'un colis, en grand. Le réceptionnaire les a prises sur le
// terrain ; le fondateur, l'équipe et l'agent de Douala doivent pouvoir les
// voir pour de vrai — pas une vignette. Plein écran ; un colis a désormais
// PLUSIEURS photos : on glisse (doigt, flèches, clavier) d'une photo à
// l'autre, puis au colis suivant, la bande du bas montre les photos du colis
// affiché. On lit ce qu'on sait du colis, on télécharge la photo affichée.
// Un colis sans photo le dit, au lieu d'un carré vide.
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, ImageOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { useParcelPhotoUrl } from '@/hooks/useReception';
import { formatCbm, formatDims, formatKg, parcelPhotoPaths, type Parcel } from '@/lib/reception';
import { deliverFile } from '@/components/customer-code/exportShippingLabel';
import { cn } from '@/lib/utils';

/** Ce que le visionneur sait dire d'un colis : le colis, et ce que l'écran d'appel veut ajouter (« Pointé · B3 », « Remis · BR-… »). */
export interface ViewerParcel extends Pick<Parcel, 'id' | 'seq' | 'parcel_no' | 'kind' | 'weight_kg' | 'length_cm' | 'width_cm' | 'height_cm' | 'cbm' | 'description' | 'photo_path' | 'photos'> {
  /** Une ligne de plus sous les mesures : l'étape, la place, l'état. */
  note?: string | null;
}

const KIND_FR: Record<string, string> = { carton: 'Carton', bag: 'Sac', bale: 'Ballot', roll: 'Rouleau', pallet: 'Palette', other: 'Autre' };

/** L'état du visionneur : ouvert sur quel colis (et quelle photo). À monter avec <ParcelPhotoViewer {...viewer} parcels={…} />. */
export function useParcelViewer() {
  const [index, setIndexState] = useState<number | null>(null);
  const [photo, setPhoto] = useState(0);
  return {
    index,
    photo,
    setPhoto,
    open: (i: number, k = 0) => { setIndexState(i); setPhoto(k); },
    close: () => setIndexState(null),
    setIndex: (i: number) => { setIndexState(i); setPhoto(0); },
  };
}

function Thumb({ path, active, onClick, label }: { path: string; active: boolean; onClick: () => void; label: string }) {
  const { data: url } = useParcelPhotoUrl(path);
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-current={active} className={cn('h-14 w-14 shrink-0 overflow-hidden rounded-md bg-white/10 ring-2 transition', active ? 'ring-white' : 'ring-transparent opacity-60 hover:opacity-100')}>
      {url && <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />}
    </button>
  );
}

export function ParcelPhotoViewer({ parcels, index, close, setIndex, title, photo: photoProp, setPhoto: setPhotoProp }: {
  parcels: ReadonlyArray<ViewerParcel>;
  index: number | null;
  close: () => void;
  setIndex: (i: number) => void;
  title?: string;
  /** La photo affichée dans le colis (fourni par useParcelViewer ; sinon tenu ici). */
  photo?: number;
  setPhoto?: (k: number) => void;
}) {
  const open = index !== null && parcels.length > 0;
  const i = Math.min(Math.max(index ?? 0, 0), Math.max(parcels.length - 1, 0));
  const parcel = open ? parcels[i] : null;
  const paths = parcel ? parcelPhotoPaths(parcel) : [];
  // Sans useParcelViewer().photo, la photo est tenue ici, PAR COLIS : rouvrir
  // un autre colis repart de sa première photo.
  const [local, setLocal] = useState<{ at: number | null; k: number }>({ at: null, k: 0 });
  const photoRaw = photoProp ?? (local.at === i ? local.k : 0);
  const setPhotoAt = useCallback((at: number, n: number) => (setPhotoProp ? setPhotoProp(n) : setLocal({ at, k: n })), [setPhotoProp]);
  const setPhoto = useCallback((n: number) => setPhotoAt(i, n), [setPhotoAt, i]);
  // « Dernière photo » (-1) : on revient du colis suivant par la gauche.
  const k = photoRaw < 0 ? Math.max(paths.length - 1, 0) : Math.min(photoRaw, Math.max(paths.length - 1, 0));
  const path = paths[k] ?? null;
  const { data: url, isLoading } = useParcelPhotoUrl(path);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const goParcel = useCallback((n: number, last = false) => { setIndex(n); setPhotoAt(n, last ? -1 : 0); }, [setIndex, setPhotoAt]);
  const prev = useCallback(() => {
    if (k > 0) setPhoto(k - 1);
    else if (i > 0) goParcel(i - 1, true);
  }, [k, i, setPhoto, goParcel]);
  const next = useCallback(() => {
    if (k < paths.length - 1) setPhoto(k + 1);
    else if (i < parcels.length - 1) goParcel(i + 1);
  }, [k, paths.length, i, parcels.length, setPhoto, goParcel]);

  useEffect(() => {
    if (!open) return;
    // En phase de capture, et consommé : la fenêtre en dessous (un dialogue de la console) ne se ferme pas avec.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    };
    window.addEventListener('keydown', onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey, true); document.body.style.overflow = prevOverflow; };
  }, [open, close, prev, next]);

  if (!open || !parcel) return null;

  const download = async () => {
    if (!url) return;
    setSaving(true);
    try {
      const blob = await fetch(url).then((r) => { if (!r.ok) throw new Error('Photo indisponible'); return r.blob(); });
      const name = paths.length > 1 ? `${parcel.parcel_no}-${k + 1}.jpg` : `${parcel.parcel_no}.jpg`;
      const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
      if ((await deliverFile(file, parcel.parcel_no)) === 'downloaded') toast.success(`Photo ${name} téléchargée`);
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  };

  const measures = [parcel.weight_kg != null ? formatKg(parcel.weight_kg) : null, parcel.length_cm != null ? formatDims(parcel) : null, parcel.cbm != null ? formatCbm(parcel.cbm) : null].filter(Boolean).join(' · ');
  const many = parcels.length > 1;
  const canPrev = k > 0 || i > 0;
  const canNext = k < paths.length - 1 || i < parcels.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photos du colis ${parcel.parcel_no}`}
      className="fixed inset-0 z-[80] flex flex-col bg-black text-white"
      onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
      onTouchEnd={(e) => {
        const t = touch.current; touch.current = null; if (!t) return;
        const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx < 0) next(); else prev(); }
      }}
    >
      {/* En haut : le numéro, les compteurs, fermer. */}
      <div className="flex items-center gap-3 px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-semibold tabular-nums">{parcel.parcel_no}</span>
          <span className="block truncate text-[13px] tabular-nums text-white/70">
            {title ? `${title} · ` : ''}{many ? `colis ${i + 1} sur ${parcels.length}` : 'un colis'}{paths.length > 1 ? ` · photo ${k + 1} sur ${paths.length}` : ''}
          </span>
        </span>
        <button type="button" onClick={() => void download()} disabled={!url || saving} aria-label="Télécharger la photo" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 disabled:opacity-40"><Download className="h-5 w-5" /></button>
        <button type="button" onClick={close} aria-label="Fermer" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15"><X className="h-5 w-5" /></button>
      </div>

      {/* La photo, aussi grande que l'écran le permet. */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {url ? (
          <img src={url} alt={`Colis ${parcel.parcel_no}, photo ${k + 1}`} className="max-h-full max-w-full object-contain" draggable={false} />
        ) : isLoading && path ? (
          <span className="text-[15px] text-white/70">Chargement…</span>
        ) : (
          <span className="flex flex-col items-center gap-3 px-8 text-center text-white/70">
            <ImageOff className="h-10 w-10" />
            <span className="text-[16px] font-medium">Pas de photo pour ce colis</span>
            <span className="text-[13px]">Le réceptionnaire ne l'a pas photographié à l'arrivée.</span>
          </span>
        )}
        {canPrev && (
          <button type="button" onClick={prev} aria-label="Photo précédente" className="absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 sm:flex"><ChevronLeft className="h-6 w-6" /></button>
        )}
        {canNext && (
          <button type="button" onClick={next} aria-label="Photo suivante" className="absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 sm:flex"><ChevronRight className="h-6 w-6" /></button>
        )}
      </div>

      {/* En bas : les photos du colis, ce qu'on sait de lui, et les points de la série. */}
      <div className="space-y-2 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
        {paths.length > 1 && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {paths.map((p, n) => <Thumb key={p} path={p} active={n === k} onClick={() => setPhoto(n)} label={`Photo ${n + 1}`} />)}
          </div>
        )}
        <p className="text-[16px] font-semibold leading-snug">
          <span className="mr-2 tabular-nums text-white/60">{String(parcel.seq).padStart(2, '0')}</span>{parcel.description || KIND_FR[parcel.kind] || parcel.kind}
        </p>
        {measures && <p className="text-[14px] tabular-nums text-white/80">{measures}</p>}
        {parcel.note && <p className="text-[14px] text-white/80">{parcel.note}</p>}
        {many && parcels.length <= 40 && (
          <div className="flex items-center justify-center gap-1.5 pt-1" aria-hidden="true">
            {parcels.map((p, n) => <span key={p.id} className={cn('h-1.5 rounded-full transition-all', n === i ? 'w-5 bg-white' : 'w-1.5 bg-white/40')} />)}
          </div>
        )}
      </div>
    </div>
  );
}
