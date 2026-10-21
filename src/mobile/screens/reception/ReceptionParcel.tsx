// ============================================================
// RÉCEPTION — Un colis, sur un seul écran (refonte v2, maquette 04/12) :
// les photos (plusieurs angles : l'étiquette du fournisseur, l'état du
// carton, le contenu) et l'état vu de l'extérieur (bon état, abîmé, ouvert,
// mouillé — imprimé sur le bon de réception, avec sa note), le poids, les
// dimensions (le m³ se calcule sous les yeux), le contenu et son type, le
// numéro du transporteur, et, pour un nouveau colis, combien d'identiques.
// Rien n'est obligatoire : un colis sans poids existe quand même, marqué
// incomplet, et le même écran (avec `:parcelId`) le complète plus tard,
// dépôt ouvert ou fermé, tant qu'il n'est pas dans une boîte.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Camera, ImagePlus, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCurrentLocale } from '@/i18n';
import { cn } from '@/lib/utils';
import { MAX_PARCEL_PHOTOS, PARCEL_KINDS, RECEPTION_CONDITIONS, cbmOf, formatCbm, parcelSavedPhotos, pickParcelPhotos, type ParcelKind, type ReceptionCondition } from '@/lib/reception';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useFilePreviews } from '@/hooks/useFilePreviews';
import { uploadParcelPhotos, useAddParcel, useParcelPhotoUrl, useReceptionDeposit, useRemoveParcelPhoto, useUpdateParcel } from '@/hooks/useReception';
import { BigButton, Dock, EmptyLine, FOCUS_RING, ScreenTop, SURFACE, TEXT, TextInput } from '@/mobile/designKit';
import { DepositLoadState, useReceptionLabels } from '@/mobile/components/reception/bits';
import { CapsLabel, ChipRow, Stepper, UnitField } from '@/mobile/components/cargo/v2';
import { useReceptionBack } from '@/mobile/components/reception/useReceptionBack';
import { readDraftWaybill, writeDraftWaybill } from './useReceptionLocation';

const num = (s: string): number | null => {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) && v >= 0 ? v : null;
};
/** Une mesure déjà enregistrée, écrite comme on la tape ici (« 12,1 » en français, « 12.1 » ailleurs). */
const field = (v: number | null | undefined): string => (v == null ? '' : v.toLocaleString(getCurrentLocale(), { useGrouping: false, maximumFractionDigits: 3 }));

/** Une photo prise, pas encore envoyée : son aperçu local (useFilePreviews), et la retirer. */
function NewPhoto({ url, cover, coverLabel, removeLabel, onRemove }: { url: string | null; cover: boolean; coverLabel: string; removeLabel: string; onRemove: () => void }) {
  return (
    <div className={cn('relative overflow-hidden rounded-lg', SURFACE.inset)} style={{ aspectRatio: '1 / 1' }}>
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      {cover && <span className="absolute left-2 top-2 rounded-md bg-[#1E1E1E]/85 px-2 py-0.5 text-[14px] font-semibold text-white">{coverLabel}</span>}
      <button type="button" onClick={onRemove} aria-label={removeLabel} className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#1E1E1E]"><X className="h-5 w-5" /></button>
    </div>
  );
}

/** Une photo déjà enregistrée sur le colis (correction d'un colis existant). */
function SavedPhoto({ photo, cover, coverLabel, removeLabel, onRemove }: { photo: { path: string }; cover: boolean; coverLabel: string; removeLabel: string; onRemove?: () => void }) {
  const { data: url } = useParcelPhotoUrl(photo.path);
  return (
    <div className={cn('relative overflow-hidden rounded-lg', SURFACE.inset)} style={{ aspectRatio: '1 / 1' }}>
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      {cover && <span className="absolute left-2 top-2 rounded-md bg-[#1E1E1E]/85 px-2 py-0.5 text-[14px] font-semibold text-white">{coverLabel}</span>}
      {onRemove && <button type="button" onClick={onRemove} aria-label={removeLabel} className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#1E1E1E]"><X className="h-5 w-5" /></button>}
    </div>
  );
}

export function ReceptionParcel() {
  const goBack = useReceptionBack();
  const { depositId, parcelId } = useParams<{ depositId: string; parcelId?: string }>();
  const { t } = useLanguage();
  const { t: ti } = useTranslation('agent');
  const labels = useReceptionLabels();
  const { data: deposit, isLoading: depositLoading, error: depositError, refetch } = useReceptionDeposit(depositId);
  const add = useAddParcel();
  const update = useUpdateParcel();
  const removePhoto = useRemoveParcelPhoto();
  const editing = deposit?.parcels.find((p) => p.id === parcelId) ?? null;
  const { currentUser, hasPermission } = useAdminAuth();
  // Les photos déjà enregistrées (correction) ; une donnée d'avant les photos multiples n'a que sa couverture.
  const saved = editing ? parcelSavedPhotos(editing) : [];
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
  // L'état vu de l'extérieur : « bon état » (rien en base) tant qu'aucune réserve n'est notée.
  const [condition, setCondition] = useState<ReceptionCondition>('good');
  const [conditionNote, setConditionNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loaded, setLoaded] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Les photos déjà envoyées : un nouvel essai (refus, réseau) ne les renvoie pas une seconde fois.
  const uploadedRef = useRef<{ files: File[]; paths: string[] } | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Édition : le formulaire se remplit une fois, avec ce que le colis porte déjà.
  useEffect(() => {
    if (!editing || loaded === editing.id) return;
    setKind(editing.kind);
    setWeight(field(editing.weight_kg));
    setLength(field(editing.length_cm));
    setWidth(field(editing.width_cm));
    setHeight(field(editing.height_cm));
    setDescription(editing.description ?? '');
    setWaybill(editing.courier_waybill ?? '');
    setShowWaybill(!!editing.courier_waybill);
    setCondition(editing.reception_condition ?? 'good');
    setConditionNote(editing.reception_condition_note ?? '');
    setLoaded(editing.id);
  }, [editing, loaded]);

  const totalPhotos = saved.length + photos.length;
  const previews = useFilePreviews(photos);
  const addFiles = (list: FileList | null) => {
    const { kept, rejected, overflow } = pickParcelPhotos(list ?? [], MAX_PARCEL_PHOTOS - totalPhotos);
    if (rejected > 0) toast.error(t('rc_photo_type'));
    if (overflow > 0) toast.warning(t('rc_photos_max'));
    if (kept.length > 0) setPhotos((cur) => [...cur, ...kept]);
  };

  const cbm = useMemo(() => cbmOf(num(length), num(width), num(height)), [length, width, height]);
  const nextSeq = (deposit?.parcels.length ?? 0) + 1;
  // Sortir : là d'où l'on vient (la fiche du dépôt, les colis à emballer…) — jamais « Dépôt terminé ».
  const exit = () => goBack(`/r/deposit/${depositId}`);

  const submit = async () => {
    if (!depositId || (parcelId && !editing)) return; // un colis introuvable ne devient jamais un nouveau colis
    let photoPaths: string[] = [];
    try {
      if (photos.length > 0) {
        if (uploadedRef.current?.files === photos) photoPaths = uploadedRef.current.paths;
        else {
          setUploading(true);
          photoPaths = await uploadParcelPhotos(depositId, photos);
          uploadedRef.current = { files: photos, paths: photoPaths };
        }
      }
    } catch (e) {
      toast.error((e as Error).message); setUploading(false); return;
    }
    setUploading(false);
    // L'état : envoyé seulement s'il change (ou, pour un nouveau colis, s'il y a une réserve ou une note).
    const condValue = condition === 'good' ? null : condition;
    const condNote = conditionNote.trim() || null;
    const condChanged = editing
      ? condValue !== (editing.reception_condition === 'good' ? null : editing.reception_condition ?? null) || condNote !== (editing.reception_condition_note?.trim() || null)
      : condValue != null || condNote != null;
    const fields = { kind, weightKg: num(weight), lengthCm: num(length), widthCm: num(width), heightCm: num(height), description, courierWaybill: waybill, photoPaths,
      condition: condChanged ? { value: condValue, note: condNote } : undefined };
    // Un refus du serveur est dit par le hook : on reste sur la question, rien de perdu.
    if (editing) {
      if (!(await update.mutateAsync({ ...fields, parcelId: editing.id, depositId }).then(() => true, () => false))) return;
      toast.success(t('rc_parcel_saved'), { description: editing.parcel_no });
    } else {
      if (!(await add.mutateAsync({ ...fields, depositId, copies }).then(() => true, () => false))) return;
      writeDraftWaybill(null);
      toast.success(copies > 1 ? ti('rc_parcels_added', { count: copies }) : t('rc_parcel_added'));
    }
    exit();
  };

  const busy = uploading || add.isPending || update.isPending;
  // Retirer une photo déjà enregistrée : son réceptionnaire tant que le dépôt est ouvert, sinon l'équipe cargo.
  const canRemoveSaved = hasPermission('canManageCargo') || (deposit?.status === 'open' && deposit.received_by === currentUser?.id);
  const title = `${t('rc_parcel')} ${editing ? String(editing.seq).padStart(2, '0') : nextSeq}${deposit ? ` · ${deposit.deposit_no}` : ''}`;
  const primaryLabel = uploading ? (photos.length > 1 ? t('rc_uploading_n') : t('rc_uploading')) : editing ? t('rc_save') : copies > 1 ? `${t('rc_add_n')} (${copies})` : t('rc_v2_save_parcel');

  // Corriger un colis : le formulaire attend ce que le colis porte déjà. Pendant
  // le chargement (sinon une saisie serait écrasée à l'arrivée des données) ou
  // après un échec (sinon « Enregistrer » ne ferait rien), l'en-tête et sa flèche.
  // Une relecture ratée en arrière-plan (retour de l'appareil photo) garde le formulaire.
  if (parcelId && !deposit) {
    return <DepositLoadState title={t('rc_parcel')} onBack={exit} isLoading={depositLoading} error={depositError} onRetry={() => void refetch()} />;
  }

  // Un colis demandé qui n'existe plus (retiré par un collègue, lien ancien) : on le dit, avec la sortie.
  if (parcelId && !editing) {
    return (
      <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
        <ScreenTop title={t('rc_parcel')} onBack={exit} />
        <EmptyLine action={{ label: t('rc_back'), onClick: exit }}>{t('rc_parcel_not_found')}</EmptyLine>
      </div>
    );
  }

  const tile = 'relative overflow-hidden rounded-lg';
  return (
    <div className={cn('flex min-h-[100dvh] flex-col', SURFACE.canvas)}>
      <ScreenTop title={title} onBack={exit} step={editing ? undefined : deposit?.status === 'open' ? '3/4' : undefined} />

      <div className="flex-1 space-y-6 px-5 pb-6 pt-4">
        {/* Les photos : la preuve de ce qui est arrivé. La première est la couverture. */}
        <section className="space-y-3">
          <CapsLabel>{t('rc_v2_photos')}</CapsLabel>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <div className="grid grid-cols-3 gap-2.5">
            {saved.map((ph, k) => (
              <div key={ph.path} className={tile} style={{ aspectRatio: '1 / 1' }}>
                <SavedPhoto photo={ph} cover={k === 0} coverLabel={t('rc_cover')} removeLabel={t('rc_remove_photo')} onRemove={canRemoveSaved && ph.id ? () => removePhoto.mutate(ph.id!) : undefined} />
              </div>
            ))}
            {photos.map((f, k) => (
              <div key={`${f.name}-${f.lastModified}-${k}`} className={tile} style={{ aspectRatio: '1 / 1' }}>
                <NewPhoto url={previews[k]} cover={saved.length === 0 && k === 0} coverLabel={t('rc_cover')} removeLabel={t('rc_remove_photo')} onRemove={() => setPhotos((cur) => cur.filter((_, n) => n !== k))} />
              </div>
            ))}
            {totalPhotos < MAX_PARCEL_PHOTOS && (
              <button type="button" onClick={() => fileRef.current?.click()} className={cn('flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#949494] text-[16px] font-semibold dark:border-[#6E6E6E]', FOCUS_RING, TEXT.strong)} style={{ aspectRatio: '1 / 1' }}>
                <Camera className="h-7 w-7" /> {t('rc_add_short')}
              </button>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => galleryRef.current?.click()} disabled={totalPhotos >= MAX_PARCEL_PHOTOS} className={cn('flex min-h-11 items-center gap-2 rounded text-[16px] font-semibold disabled:opacity-40', FOCUS_RING, TEXT.muted)}><ImagePlus className="h-5 w-5" /> {t('rc_from_gallery')}</button>
            {totalPhotos > 0 && <span className={cn('tabular-nums text-[15px]', TEXT.muted)}>{ti('rc_photos_count', { count: totalPhotos })}</span>}
          </div>
          {/* L'état vu de l'extérieur : une réserve notée ici protège Bonzini si le client conteste à l'arrivée. */}
          <ChipRow<ReceptionCondition>
            className="-mx-5"
            options={RECEPTION_CONDITIONS.map((c) => ({ value: c, label: c === 'good' ? t('rc_condition_good') : t(`rc_v2_cond_${c}`) }))}
            value={condition}
            onChange={setCondition}
          />
          {(condition !== 'good' || conditionNote) && (
            <TextInput value={conditionNote} onChange={(e) => setConditionNote(e.target.value)} placeholder={t('rc_condition_note_ph')} aria-label={t('rc_condition_note')} maxLength={300} className="h-14 text-[17px]" />
          )}
        </section>

        <section className="space-y-3">
          <CapsLabel as="label">{t('rc_weight_kg')}</CapsLabel>
          <UnitField big unit="kg" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0" aria-label={t('rc_weight_kg')} />
        </section>

        <section className="space-y-3">
          <CapsLabel>{t('rc_dims')}</CapsLabel>
          <div className="grid grid-cols-3 gap-2.5">
            {([[t('rc_length'), length, setLength], [t('rc_width'), width, setWidth], [t('rc_height'), height, setHeight]] as const).map(([label, value, set]) => (
              <UnitField key={label} unit="cm" value={value} onChange={(e) => set(e.target.value)} placeholder="0" aria-label={label} />
            ))}
          </div>
          <p className={cn('text-[17px] tabular-nums', cbm != null ? TEXT.body : TEXT.faint)}>= {formatCbm(cbm)}</p>
        </section>

        <section className="space-y-3">
          <CapsLabel>{t('rc_v2_content')}</CapsLabel>
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('rc_description_ph')} aria-label={t('rc_description')} className="h-14 text-[17px]" />
          <ChipRow<ParcelKind> className="-mx-5" options={PARCEL_KINDS.map((k) => ({ value: k, label: labels.kind(k) }))} value={kind} onChange={setKind} />
          {showWaybill ? (
            <TextInput value={waybill} onChange={(e) => setWaybill(e.target.value)} placeholder={t('rc_waybill')} aria-label={t('rc_waybill')} autoCapitalize="characters" className="h-14 text-[17px] tabular-nums" />
          ) : (
            <button type="button" onClick={() => setShowWaybill(true)} className={cn('flex min-h-11 items-center gap-2 rounded text-[16px] font-semibold', FOCUS_RING, TEXT.muted)}><Plus className="h-5 w-5" /> {t('rc_add_waybill')}</button>
          )}
        </section>

        {!editing && (
          <div className="flex items-center justify-between gap-4 border-t border-[#D9D9D9] pt-5 dark:border-[#444444]">
            <span className={cn('text-[18px] font-semibold', TEXT.strong)}>{t('rc_v2_copies')}</span>
            <Stepper value={copies} onChange={setCopies} min={1} max={200} label={t('rc_v2_copies')} />
          </div>
        )}
      </div>

      <Dock>
        <BigButton onClick={() => void submit()} loading={busy}>{primaryLabel}</BigButton>
      </Dock>
    </div>
  );
}
