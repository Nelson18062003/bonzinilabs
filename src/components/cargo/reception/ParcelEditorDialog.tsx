// ============================================================
// Desktop admin — un colis, en entier : ce que c'est, son poids, ses
// dimensions (le m³ se calcule sous les yeux), son bordereau, et SES PHOTOS.
// Le même dialogue ajoute un colis à un dépôt (ouvert ou fermé) et corrige
// un colis existant. Les photos se gèrent ici : en ajouter (glisser-déposer
// ou parcourir, plusieurs à la fois), choisir la couverture, en retirer.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Loader2, Star, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useAddParcel, useAddParcelPhotos, useParcelPhotoUrl, useRemoveParcelPhoto, useSetParcelCover, useUpdateParcel, uploadParcelPhotos } from '@/hooks/useReception';
import { PARCEL_KINDS, cbmOf, formatCbm, parcelLockReason, type Deposit, type Parcel, type ParcelKind, type ParcelPhoto } from '@/lib/reception';
import { ParcelPhotoViewer, useParcelViewer } from '@/mobile/components/reception/ParcelPhotoViewer';
import { useReceptionLabels } from '@/mobile/components/reception/bits';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT, SOFT_PILL, PRIMARY_PILL, CenterDialog, TextInput } from '@/desktop/designKit';

const MAX_PHOTOS = 20;

const num = (s: string): number | null => {
  const v = parseFloat(s.replace(',', '.').trim());
  return Number.isFinite(v) && v >= 0 ? v : null;
};
const str = (v: number | null | undefined) => (v == null ? '' : String(Number(v)).replace('.', ','));
const badNumber = (s: string) => s.trim() !== '' && num(s) == null;

/** Une photo déjà enregistrée : la voir, la mettre en couverture, la retirer. */
function SavedPhoto({ photo, cover, canRemove, onOpen, onCover, onRemove, busy }: { photo: ParcelPhoto; cover: boolean; canRemove: boolean; onOpen: () => void; onCover: () => void; onRemove: () => void; busy: boolean }) {
  const { data: url } = useParcelPhotoUrl(photo.path);
  return (
    <div className={cn('group relative aspect-square overflow-hidden rounded-lg ring-1 ring-border', SURFACE.inset)}>
      <button type="button" onClick={onOpen} className="h-full w-full" aria-label="Voir la photo en grand">
        {url ? <img src={url} alt="" className="h-full w-full object-cover" draggable={false} /> : <span className="block h-full w-full animate-pulse" />}
      </button>
      {cover && <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-foreground/85 px-1.5 py-0.5 text-[10px] font-bold text-background"><Star className="h-2.5 w-2.5 fill-current" />Couverture</span>}
      <div className="absolute inset-x-1.5 bottom-1.5 flex justify-end gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        {!cover && (
          <button type="button" onClick={onCover} disabled={busy} title="Mettre en couverture" aria-label="Mettre en couverture" className="flex h-7 w-7 items-center justify-center rounded-md bg-background/90 shadow disabled:opacity-50"><Star className="h-3.5 w-3.5" /></button>
        )}
        {canRemove && (
          <button type="button" onClick={onRemove} disabled={busy} title="Retirer la photo" aria-label="Retirer la photo" className="flex h-7 w-7 items-center justify-center rounded-md bg-background/90 text-destructive shadow disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
        )}
      </div>
    </div>
  );
}

/** Une photo choisie, pas encore envoyée. */
function PendingPhoto({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);
  return (
    <div className={cn('relative aspect-square overflow-hidden rounded-lg border-2 border-dashed border-primary/50', SURFACE.inset)}>
      {url && <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />}
      <span className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">Nouvelle</span>
      <button type="button" onClick={onRemove} aria-label="Ne pas ajouter cette photo" className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 shadow"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}

export function ParcelEditorDialog({ deposit, parcel, open, onClose }: { deposit: Deposit; parcel: Parcel | null; open: boolean; onClose: () => void }) {
  const { hasPermission, currentUser } = useAdminAuth();
  const labels = useReceptionLabels();
  const add = useAddParcel();
  const update = useUpdateParcel();
  const addPhotos = useAddParcelPhotos();
  const removePhoto = useRemoveParcelPhoto();
  const setCover = useSetParcelCover();
  const viewer = useParcelViewer();
  const fileRef = useRef<HTMLInputElement>(null);

  // Toujours la version fraîche du colis (une photo retirée met le dépôt à jour).
  const live = parcel ? deposit.parcels.find((p) => p.id === parcel.id) ?? parcel : null;
  const editing = !!live;
  const lock = live ? parcelLockReason(live) : null;
  const isCargo = hasPermission('canManageCargo');
  // Retirer une photo d'un dépôt fermé : l'équipe cargo seule (la base le refuse sinon).
  const canRemovePhoto = isCargo || (deposit.status === 'open' && deposit.received_by === currentUser?.id);

  const [kind, setKind] = useState<ParcelKind>('carton');
  const [description, setDescription] = useState('');
  const [waybill, setWaybill] = useState('');
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [copies, setCopies] = useState('1');
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setKind(live?.kind ?? 'carton');
    setDescription(live?.description ?? '');
    setWaybill(live?.courier_waybill ?? '');
    setWeight(str(live?.weight_kg));
    setLength(str(live?.length_cm));
    setWidth(str(live?.width_cm));
    setHeight(str(live?.height_cm));
    setCopies('1');
    setFiles([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, parcel?.id]);

  const saved = useMemo(() => [...(live?.photos ?? [])].sort((a, b) => a.position - b.position), [live?.photos]);
  const legacyCover = live && saved.length === 0 && live.photo_path ? live.photo_path : null;
  const cbm = cbmOf(num(length), num(width), num(height));
  const room = MAX_PHOTOS - saved.length - (legacyCover ? 1 : 0) - files.length;
  const nCopies = Math.round(num(copies) ?? 0);
  const invalid = [weight, length, width, height].some(badNumber) || (!editing && (nCopies < 1 || nCopies > 200));

  const pick = (list: FileList | File[] | null) => {
    if (!list) return;
    const images = Array.from(list).filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) { toast.error('Choisissez des images (JPEG, PNG, HEIC…)'); return; }
    if (images.length > room) toast.warning(`${MAX_PHOTOS} photos au plus par colis : ${Math.max(room, 0)} ajoutée(s)`);
    const kept = images.slice(0, Math.max(room, 0));
    // Un colis parti ne se modifie plus, mais une photo de plus ne fausse rien : elle part tout de suite.
    if (lock && live) {
      if (kept.length > 0) addPhotos.mutate({ depositId: deposit.id, parcelId: live.id, files: kept }, { onSuccess: () => toast.success(kept.length > 1 ? `${kept.length} photos ajoutées` : 'Photo ajoutée') });
      return;
    }
    setFiles((cur) => [...cur, ...kept]);
  };

  const submit = async () => {
    if (invalid || saving) return;
    setSaving(true);
    let photoPaths: string[] = [];
    try {
      photoPaths = files.length > 0 ? await uploadParcelPhotos(deposit.id, files) : [];
    } catch (e) {
      toast.error(`Envoi des photos impossible : ${(e as Error).message}`);
      setSaving(false);
      return;
    }
    try {
      const fields = { kind, weightKg: num(weight), lengthCm: num(length), widthCm: num(width), heightCm: num(height), description, courierWaybill: waybill, photoPaths };
      if (live) {
        await update.mutateAsync({ ...fields, parcelId: live.id, depositId: deposit.id });
        toast.success(`Colis ${live.parcel_no} enregistré`);
      } else {
        await add.mutateAsync({ ...fields, depositId: deposit.id, copies: nCopies });
        toast.success(nCopies > 1 ? `${nCopies} colis ajoutés` : 'Colis ajouté', { description: deposit.deposit_no });
      }
      onClose();
    } catch {
      // La mutation a déjà affiché son erreur (toast du hook) ; le dialogue reste ouvert.
    } finally {
      setSaving(false);
    }
  };

  const field = (id: string, label: string, value: string, set: (v: string) => void, opts: { suffix?: string; placeholder?: string; mono?: boolean; inputMode?: 'decimal' | 'text' } = {}) => (
    <label htmlFor={id} className="block min-w-0">
      <span className={cn('mb-1 block text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>{label}</span>
      <span className="relative block">
        <TextInput id={id} value={value} onChange={(e) => set(e.target.value)} inputMode={opts.inputMode ?? 'text'} placeholder={opts.placeholder} disabled={!!lock}
          className={cn('h-9 rounded-md text-[13.5px]', opts.suffix && 'pr-9', opts.mono && 'font-mono', opts.inputMode === 'decimal' && 'tabular-nums', badNumber(value) && opts.inputMode === 'decimal' && 'border-destructive focus:border-destructive focus:ring-destructive')} />
        {opts.suffix && <span className={cn('pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px]', TEXT.muted)}>{opts.suffix}</span>}
      </span>
    </label>
  );

  const photoBusy = removePhoto.isPending || setCover.isPending || addPhotos.isPending;

  return (
    <CenterDialog
      open={open}
      onClose={onClose}
      onConfirm={() => void submit()}
      width={760}
      title={
        <span className="block">
          <span className={cn('block text-[16px] font-bold', TEXT.strong)}>{live ? `Colis ${live.parcel_no}` : `Ajouter un colis · ${deposit.deposit_no}`}</span>
          <span className={cn('block text-[12px]', TEXT.muted)}>
            {live ? 'Ce que c’est, ses mesures, ses photos' : deposit.status === 'closed' ? 'Le dépôt est fermé : le colis s’ajoute à la suite, ses totaux suivent' : 'Le colis s’ajoute au dépôt en cours'}
          </span>
        </span>
      }
      footer={
        <>
          <span className={cn('mr-auto self-center text-[12px]', TEXT.muted)}>⌘⏎ pour enregistrer</span>
          <button type="button" onClick={onClose} className={cn('h-9 px-4 text-[13px] font-semibold', SOFT_PILL)}>Annuler</button>
          {!lock && (
            <button type="button" onClick={() => void submit()} disabled={invalid || saving} className={cn('inline-flex h-9 items-center gap-2 px-4 text-[13px] font-bold disabled:opacity-50', PRIMARY_PILL)}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving && files.length > 0 ? 'Envoi des photos…' : live ? 'Enregistrer' : nCopies > 1 ? `Ajouter ${nCopies} colis` : 'Ajouter le colis'}
            </button>
          )}
        </>
      }
    >
      {lock && (
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-[12.5px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
          {lock} — ses mesures ne se modifient plus d'ici. Une photo ajoutée part tout de suite.
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-6">
        {/* Ce que c'est, et ses mesures */}
        <div className="space-y-4">
          <div>
            <span className={cn('mb-1.5 block text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Type</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Type de colis">
              {PARCEL_KINDS.map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} disabled={!!lock} onClick={() => setKind(k)}
                  className={cn('h-8 px-3 text-[12.5px] font-semibold disabled:opacity-50', kind === k ? PRIMARY_PILL : SOFT_PILL)}>
                  {labels.kind(k)}
                </button>
              ))}
            </div>
          </div>
          {field('pe-desc', 'Ce qu’il y a dedans', description, setDescription, { placeholder: 'Chaussures, pièces auto, tissu…' })}
          {field('pe-waybill', 'Bordereau du transporteur', waybill, setWaybill, { placeholder: 'SF, YTO, ZTO…', mono: true })}
          <div className="grid grid-cols-4 gap-3">
            {field('pe-w', 'Poids', weight, setWeight, { suffix: 'kg', inputMode: 'decimal', placeholder: '0' })}
            {field('pe-l', 'Longueur', length, setLength, { suffix: 'cm', inputMode: 'decimal', placeholder: '0' })}
            {field('pe-wd', 'Largeur', width, setWidth, { suffix: 'cm', inputMode: 'decimal', placeholder: '0' })}
            {field('pe-h', 'Hauteur', height, setHeight, { suffix: 'cm', inputMode: 'decimal', placeholder: '0' })}
          </div>
          <div className={cn('flex items-center justify-between rounded-md px-3 py-2', SURFACE.inset)}>
            <span className={cn('text-[12px] font-semibold', TEXT.muted)}>Volume</span>
            <span className={cn('text-[15px] font-bold tabular-nums', cbm != null ? TEXT.strong : TEXT.muted)}>{formatCbm(cbm)}</span>
          </div>
          {!editing && (
            <div className="w-40">
              {field('pe-copies', 'Combien d’identiques', copies, setCopies, { inputMode: 'decimal', placeholder: '1' })}
            </div>
          )}
        </div>

        {/* Les photos */}
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Photos</span>
            <span className={cn('text-[11.5px] tabular-nums', TEXT.muted)}>{saved.length + (legacyCover ? 1 : 0) + files.length} / {MAX_PHOTOS}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {saved.map((ph, k) => (
              <SavedPhoto key={ph.id} photo={ph} cover={k === 0} canRemove={canRemovePhoto} busy={photoBusy}
                onOpen={() => viewer.open(0, k)}
                onCover={() => setCover.mutate(ph.id, { onSuccess: () => toast.success('Couverture changée') })}
                onRemove={() => removePhoto.mutate(ph.id, { onSuccess: () => toast.success('Photo retirée') })} />
            ))}
            {legacyCover && <SavedPhoto photo={{ id: 'legacy', path: legacyCover, position: 0, created_at: '' }} cover canRemove={false} busy onOpen={() => viewer.open(0)} onCover={() => undefined} onRemove={() => undefined} />}
            {files.map((f, k) => <PendingPhoto key={`${f.name}-${k}`} file={f} onRemove={() => setFiles((cur) => cur.filter((_, n) => n !== k))} />)}
            {room > 0 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files); }}
                className={cn('flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-center text-[11.5px] font-semibold transition-colors', dragging ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent', TEXT.muted)}
              >
                <ImagePlus className="h-5 w-5" />
                Ajouter
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
          <p className={cn('mt-2 text-[11.5px] leading-snug', TEXT.muted)}>
            Glissez des photos ici ou parcourez. La première est la couverture (étiquette, listes) ; survolez une photo pour la mettre en couverture ou la retirer.
            {files.length > 0 && ' Les nouvelles photos partent à l’enregistrement.'}
          </p>
        </div>
      </div>

      {live && <ParcelPhotoViewer parcels={[live]} index={viewer.index} close={viewer.close} setIndex={viewer.setIndex} photo={viewer.photo} setPhoto={viewer.setPhoto} title={deposit.deposit_no} />}
    </CenterDialog>
  );
}
