// ============================================================
// RÉCEPTION — Un colis, en cinq questions, une par écran :
//   1. les photos (la preuve, et le geste le plus rapide) — plusieurs
//      angles : l'étiquette du fournisseur, l'état du carton, le contenu
//   2. le poids
//   3. les dimensions (le m³ se calcule sous les yeux)
//   4. ce que c'est — le type, et ce qu'il y a dedans
//   5. combien d'identiques (seulement pour un nouveau colis)
// Chaque question a UN bouton « Suivant » et, quand elle est facultative,
// « Passer ». Rien n'est obligatoire : un colis sans poids existe quand
// même, marqué incomplet, et le même écran (avec `:parcelId`) le complète
// plus tard, dépôt ouvert ou fermé, tant qu'il n'est pas dans une boîte.
// `?step=` ouvre directement une question (harnais, lien).
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Camera, ImagePlus, Minus, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { PARCEL_KINDS, cbmOf, formatCbm, type ParcelKind, type ParcelPhoto } from '@/lib/reception';
import { uploadParcelPhotos, useAddParcel, useParcelPhotoUrl, useReceptionDeposit, useRemoveParcelPhoto, useUpdateParcel } from '@/hooks/useReception';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { SURFACE, TEXT, TYPE, PrimaryPill, SoftPill, TextInput } from '@/mobile/designKit';
import { StepHeader, useReceptionLabels } from '@/mobile/components/reception/bits';
import { readDraftWaybill, writeDraftWaybill } from './useReceptionLocation';

type Step = 'photo' | 'weight' | 'dims' | 'inside' | 'copies';
const NEW_STEPS: Step[] = ['photo', 'weight', 'dims', 'inside', 'copies'];
const EDIT_STEPS: Step[] = ['photo', 'weight', 'dims', 'inside'];

const num = (s: string): number | null => {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) && v >= 0 ? v : null;
};

const MAX_PHOTOS = 20;

/** Une photo prise, pas encore envoyée : l'aperçu local, et la retirer. */
function NewPhoto({ file, cover, coverLabel, removeLabel, onRemove }: { file: File; cover: boolean; coverLabel: string; removeLabel: string; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);
  return (
    <div className={cn('relative overflow-hidden rounded-lg', SURFACE.inset)} style={{ aspectRatio: '4 / 3' }}>
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      {cover && <span className="absolute left-2 top-2 rounded-md bg-[#1E1E1E]/85 px-2 py-0.5 text-[13px] font-semibold text-white">{coverLabel}</span>}
      <button type="button" onClick={onRemove} aria-label={removeLabel} className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#1E1E1E] shadow"><X className="h-5 w-5" /></button>
    </div>
  );
}

/** Une photo déjà enregistrée sur le colis (correction d'un colis existant). */
function SavedPhoto({ photo, cover, coverLabel, removeLabel, onRemove }: { photo: Pick<ParcelPhoto, 'path'>; cover: boolean; coverLabel: string; removeLabel: string; onRemove?: () => void }) {
  const { data: url } = useParcelPhotoUrl(photo.path);
  return (
    <div className={cn('relative overflow-hidden rounded-lg', SURFACE.inset)} style={{ aspectRatio: '4 / 3' }}>
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      {cover && <span className="absolute left-2 top-2 rounded-md bg-[#1E1E1E]/85 px-2 py-0.5 text-[13px] font-semibold text-white">{coverLabel}</span>}
      {onRemove && <button type="button" onClick={onRemove} aria-label={removeLabel} className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#1E1E1E] shadow"><X className="h-5 w-5" /></button>}
    </div>
  );
}

export function ReceptionParcel() {
  const navigate = useNavigate();
  const { depositId, parcelId } = useParams<{ depositId: string; parcelId?: string }>();
  const [params] = useSearchParams();
  const { t } = useLanguage();
  const { t: ti } = useTranslation('agent');
  const labels = useReceptionLabels();
  const { data: deposit } = useReceptionDeposit(depositId);
  const add = useAddParcel();
  const update = useUpdateParcel();
  const removePhoto = useRemoveParcelPhoto();
  const editing = deposit?.parcels.find((p) => p.id === parcelId) ?? null;
  // Les photos déjà enregistrées (correction) ; une donnée d'avant les photos multiples n'a que sa couverture.
  const saved: { path: string; id?: string }[] = editing
    ? (editing.photos && editing.photos.length > 0 ? [...editing.photos].sort((a, b) => a.position - b.position) : editing.photo_path ? [{ path: editing.photo_path }] : [])
    : [];
  const steps = parcelId ? EDIT_STEPS : NEW_STEPS;

  const [step, setStep] = useState<Step>(() => {
    const s = params.get('step') as Step | null;
    return s && (parcelId ? EDIT_STEPS : NEW_STEPS).includes(s) ? s : 'photo';
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [kind, setKind] = useState<ParcelKind>('carton');
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [description, setDescription] = useState('');
  const [waybill, setWaybill] = useState(() => readDraftWaybill() ?? '');
  const [showWaybill, setShowWaybill] = useState(() => !!readDraftWaybill());
  const [copies, setCopies] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [loaded, setLoaded] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Édition : le formulaire se remplit une fois, avec ce que le colis porte déjà.
  useEffect(() => {
    if (!editing || loaded === editing.id) return;
    setKind(editing.kind);
    setWeight(editing.weight_kg != null ? String(editing.weight_kg) : '');
    setLength(editing.length_cm != null ? String(editing.length_cm) : '');
    setWidth(editing.width_cm != null ? String(editing.width_cm) : '');
    setHeight(editing.height_cm != null ? String(editing.height_cm) : '');
    setDescription(editing.description ?? '');
    setWaybill(editing.courier_waybill ?? '');
    setShowWaybill(!!editing.courier_waybill);
    setLoaded(editing.id);
  }, [editing, loaded]);

  const totalPhotos = saved.length + photos.length;
  const addFiles = (list: FileList | null) => {
    const images = Array.from(list ?? []).filter((f) => f.type.startsWith('image/'));
    const room = MAX_PHOTOS - totalPhotos;
    if (images.length > room) toast.warning(t('rc_photos_max'));
    if (room > 0) setPhotos((cur) => [...cur, ...images.slice(0, room)]);
  };

  const cbm = useMemo(() => cbmOf(num(length), num(width), num(height)), [length, width, height]);
  const nextSeq = (deposit?.parcels.length ?? 0) + 1;
  const index = steps.indexOf(step);
  const last = index === steps.length - 1;
  const back = () => (index === 0 ? navigate(deposit?.status === 'closed' ? `/r/deposit/${depositId}/done` : `/r/deposit/${depositId}`) : setStep(steps[index - 1]));
  const next = () => setStep(steps[index + 1]);

  const submit = async () => {
    if (!depositId) return;
    let photoPaths: string[] = [];
    try {
      if (photos.length > 0) { setUploading(true); photoPaths = await uploadParcelPhotos(depositId, photos); }
    } catch (e) {
      toast.error((e as Error).message); setUploading(false); return;
    }
    setUploading(false);
    const fields = { kind, weightKg: num(weight), lengthCm: num(length), widthCm: num(width), heightCm: num(height), description, courierWaybill: waybill, photoPaths };
    if (editing) {
      await update.mutateAsync({ ...fields, parcelId: editing.id, depositId });
      toast.success(t('rc_parcel_saved'), { description: editing.parcel_no });
    } else {
      await add.mutateAsync({ ...fields, depositId, copies });
      writeDraftWaybill(null);
      toast.success(copies > 1 ? ti('rc_parcels_added', { count: copies }) : t('rc_parcel_added'));
    }
    navigate(deposit?.status === 'closed' ? `/r/deposit/${depositId}/done` : `/r/deposit/${depositId}`, { replace: true });
  };

  const busy = uploading || add.isPending || update.isPending;
  // Retirer une photo déjà enregistrée : tant que le dépôt est ouvert (fermé, c'est l'équipe cargo).
  const canRemoveSaved = deposit?.status === 'open';
  const title = editing ? `${t('rc_parcel')} ${String(editing.seq).padStart(2, '0')}` : `${t('rc_parcel')} ${nextSeq}`;

  // Le bouton du bas : « Suivant », ou, à la dernière question, « Ajouter » / « Enregistrer ».
  const primaryLabel = !last ? t('rc_next') : uploading ? (photos.length > 1 ? t('rc_uploading_n') : t('rc_uploading')) : editing ? t('rc_save') : copies > 1 ? `${t('rc_add_n')} (${copies})` : t('rc_add');
  const optional = step === 'photo' || step === 'weight' || step === 'dims';

  return (
    <div className={cn('flex h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader title={title} subtitle={editing ? t('rc_edit_parcel') : deposit?.deposit_no} showBack onBack={back} />

      <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-4">
        {step === 'photo' && (
          <>
            <StepHeader step={index + 1} total={steps.length} title={t('rc_p_photos_title')} help={t('rc_p_photos_help')} />
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            {totalPhotos === 0 ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={cn('flex w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-[#949494] dark:border-[#6E6E6E]', SURFACE.inset)}
                style={{ aspectRatio: '4 / 3' }}
              >
                <span className="flex flex-col items-center gap-4">
                  <span className={cn('flex h-20 w-20 items-center justify-center rounded-full', SURFACE.card, SURFACE.shadow)}><Camera className={cn('h-10 w-10', TEXT.strong)} /></span>
                  <span className={cn(TYPE.lead, TEXT.strong)}>{t('rc_take_photo')}</span>
                </span>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {saved.map((ph, k) => (
                  <SavedPhoto key={ph.path} photo={ph} cover={k === 0} coverLabel={t('rc_cover')} removeLabel={t('rc_remove_photo')}
                    onRemove={canRemoveSaved && ph.id ? () => removePhoto.mutate(ph.id!) : undefined} />
                ))}
                {photos.map((f, k) => (
                  <NewPhoto key={`${f.name}-${f.lastModified}-${k}`} file={f} cover={saved.length === 0 && k === 0} coverLabel={t('rc_cover')} removeLabel={t('rc_remove_photo')}
                    onRemove={() => setPhotos((cur) => cur.filter((_, n) => n !== k))} />
                ))}
                {totalPhotos < MAX_PHOTOS && (
                  <button type="button" onClick={() => fileRef.current?.click()} className={cn('flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#949494] dark:border-[#6E6E6E]', TYPE.bodyStrong, TEXT.strong)} style={{ aspectRatio: '4 / 3' }}>
                    <Camera className="h-7 w-7" /> {t('rc_add_photo')}
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={() => galleryRef.current?.click()} disabled={totalPhotos >= MAX_PHOTOS} className={cn('flex items-center gap-2 disabled:opacity-40', TYPE.bodyStrong, TEXT.muted)}><ImagePlus className="h-5 w-5" /> {t('rc_from_gallery')}</button>
              {totalPhotos > 0 && <span className={cn('tabular-nums', TYPE.small, TEXT.muted)}>{ti('rc_photos_count', { count: totalPhotos })}</span>}
            </div>
          </>
        )}

        {step === 'weight' && (
          <>
            <StepHeader step={index + 1} total={steps.length} title={t('rc_p_weight_title')} help={t('rc_p_weight_help')} />
            <div className="relative">
              <TextInput id="p-weight" value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" placeholder="0" autoFocus className="h-20 pr-20 text-[40px] font-semibold tabular-nums" aria-label={t('rc_weight_kg')} />
              <span className={cn('pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-[22px] font-semibold', TEXT.muted)}>kg</span>
            </div>
          </>
        )}

        {step === 'dims' && (
          <>
            <StepHeader step={index + 1} total={steps.length} title={t('rc_p_dims_title')} help={t('rc_p_dims_help')} />
            <div className="grid grid-cols-3 gap-3">
              {([[t('rc_length'), length, setLength, true], [t('rc_width'), width, setWidth, false], [t('rc_height'), height, setHeight, false]] as const).map(([label, value, set, focus]) => (
                <label key={label} className="block">
                  <span className={cn('mb-1.5 block', TYPE.smallStrong, TEXT.muted)}>{label}</span>
                  <TextInput value={value} onChange={(e) => set(e.target.value)} inputMode="decimal" placeholder="0" autoFocus={focus} className="h-16 text-center text-[24px] font-semibold tabular-nums" />
                </label>
              ))}
            </div>
            <div className={cn('rounded-lg px-4 py-4 text-center', SURFACE.inset)}>
              <span className={cn('block', TYPE.small, TEXT.muted)}>{t('rc_volume')}</span>
              <span className={cn('block text-[28px] font-semibold tabular-nums', cbm != null ? TEXT.strong : TEXT.faint)}>{formatCbm(cbm)}</span>
            </div>
          </>
        )}

        {step === 'inside' && (
          <>
            <StepHeader step={index + 1} total={steps.length} title={t('rc_p_inside_title')} help={t('rc_p_inside_help')} />
            <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label={t('rc_kind')}>
              {PARCEL_KINDS.map((k) => {
                const on = kind === k;
                return (
                  <button key={k} type="button" role="radio" aria-checked={on} onClick={() => setKind(k)} className={cn('flex min-h-[64px] items-center justify-center rounded-lg border px-2 text-center transition-colors', TYPE.bodyStrong, on ? 'border-[#2C2C2C] bg-[#2C2C2C] text-[#F5F5F5] dark:border-[#E3E3E3] dark:bg-[#E3E3E3] dark:text-[#1E1E1E]' : cn(SURFACE.card, SURFACE.divider, TEXT.strong))}>
                    {labels.kind(k)}
                  </button>
                );
              })}
            </div>
            <label className="block">
              <span className={cn('mb-1.5 block', TYPE.smallStrong, TEXT.strong)}>{t('rc_description')}</span>
              <TextInput id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('rc_description_ph')} className="h-14 text-[17px]" />
            </label>
            {showWaybill ? (
              <label className="block">
                <span className={cn('mb-1.5 block', TYPE.smallStrong, TEXT.strong)}>{t('rc_waybill')}</span>
                <TextInput id="p-waybill" value={waybill} onChange={(e) => setWaybill(e.target.value)} placeholder={t('rc_waybill_ph')} autoCapitalize="characters" className="h-14 tabular-nums" />
              </label>
            ) : (
              <button type="button" onClick={() => setShowWaybill(true)} className={cn('flex items-center gap-2', TYPE.bodyStrong, TEXT.muted)}><Plus className="h-4 w-4" /> {t('rc_add_waybill')}</button>
            )}
          </>
        )}

        {step === 'copies' && (
          <>
            <StepHeader step={index + 1} total={steps.length} title={t('rc_p_copies_title')} help={t('rc_p_copies_help')} />
            <div className="flex items-center justify-center gap-6 py-6">
              <button type="button" aria-label="−" onClick={() => setCopies((c) => Math.max(1, c - 1))} className={cn('flex h-16 w-16 items-center justify-center rounded-full', SURFACE.holder)}><Minus className="h-7 w-7" /></button>
              <span className={cn('w-20 text-center text-[56px] font-semibold leading-none tabular-nums', TEXT.strong)}>{copies}</span>
              <button type="button" aria-label="+" onClick={() => setCopies((c) => Math.min(200, c + 1))} className={cn('flex h-16 w-16 items-center justify-center rounded-full', SURFACE.holder)}><Plus className="h-7 w-7" /></button>
            </div>
          </>
        )}
      </div>

      <div className={cn('shrink-0 space-y-3 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3', SURFACE.canvas)}>
        <PrimaryPill onClick={() => (last ? void submit() : next())} loading={busy} className="h-14 w-full text-[17px]">{primaryLabel}</PrimaryPill>
        {optional && !last && (
          <SoftPill onClick={next} className="h-12 w-full text-[16px]">{step === 'weight' ? t('rc_dont_know') : t('rc_skip')}</SoftPill>
        )}
      </div>
    </div>
  );
}
