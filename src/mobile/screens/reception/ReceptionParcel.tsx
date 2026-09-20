// ============================================================
// RÉCEPTION — Un colis. La photo d'abord (le geste le plus rapide, et la
// preuve), le type, le poids, les trois dimensions (le m³ se calcule sous
// les yeux), ce qu'il y a dedans, le bordereau du transporteur s'il y en a
// un, et « combien d'identiques » pour les lots du marché. Rien n'est
// obligatoire : un colis sans poids existe quand même, marqué incomplet.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { PARCEL_KINDS, cbmOf, formatCbm, type ParcelKind } from '@/lib/reception';
import { uploadParcelPhoto, useAddParcel, useReceptionDeposit } from '@/hooks/useReception';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { SURFACE, TEXT, TYPE, Card, Chip, FormField, PrimaryPill, TextInput } from '@/mobile/designKit';
import { useReceptionLabels } from '@/mobile/components/reception/bits';
import { readDraftWaybill, writeDraftWaybill } from './useReceptionLocation';

const num = (s: string): number | null => {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) && v >= 0 ? v : null;
};

export function ReceptionParcel() {
  const navigate = useNavigate();
  const { depositId } = useParams<{ depositId: string }>();
  const { t } = useLanguage();
  const labels = useReceptionLabels();
  const { data: deposit } = useReceptionDeposit(depositId);
  const add = useAddParcel();

  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [kind, setKind] = useState<ParcelKind>('carton');
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [description, setDescription] = useState('');
  const [waybill, setWaybill] = useState(() => readDraftWaybill() ?? '');
  const [copies, setCopies] = useState(1);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photo) { setPreview(null); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const cbm = useMemo(() => cbmOf(num(length), num(width), num(height)), [length, width, height]);
  const nextSeq = (deposit?.parcels.length ?? 0) + 1;

  const submit = async () => {
    if (!depositId) return;
    let photoPath: string | null = null;
    try {
      if (photo) {
        setUploading(true);
        photoPath = await uploadParcelPhoto(depositId, photo);
      }
    } catch (e) {
      toast.error((e as Error).message);
      setUploading(false);
      return;
    }
    setUploading(false);
    await add.mutateAsync({
      depositId,
      kind,
      weightKg: num(weight),
      lengthCm: num(length),
      widthCm: num(width),
      heightCm: num(height),
      description,
      courierWaybill: waybill,
      photoPath,
      copies,
    });
    writeDraftWaybill(null);
    navigate(`/r/deposit/${depositId}`, { replace: true });
  };

  const busy = uploading || add.isPending;

  return (
    <div className={cn('flex h-[100dvh] flex-col', SURFACE.canvas)}>
      <MobileHeader title={`${t('rc_parcel')} ${nextSeq}`} subtitle={deposit?.deposit_no} showBack backTo={`/r/deposit/${depositId}`} />

      <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-5">
        {/* 1 · La photo */}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={cn('flex h-44 w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed', preview ? 'border-transparent' : 'border-[#949494] dark:border-[#6E6E6E]', SURFACE.inset)}
        >
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-3">
              <Camera className={cn('h-9 w-9', TEXT.strong)} />
              <span className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('rc_photo')}</span>
            </span>
          )}
        </button>
        {preview && <p className={cn('-mt-3 text-center', TYPE.small, TEXT.muted)}>{t('rc_retake')} : appuyez sur la photo</p>}

        {/* 2 · Le type */}
        <section>
          <h2 className={cn('mb-3', TYPE.smallStrong, TEXT.muted)}>{t('rc_kind')}</h2>
          <div className="flex flex-wrap gap-2">
            {PARCEL_KINDS.map((k) => (
              <Chip key={k} label={labels.kind(k)} active={kind === k} onClick={() => setKind(k)} className="h-10 px-4 text-[15px]" />
            ))}
          </div>
        </section>

        {/* 3 · Poids et dimensions */}
        <Card className="space-y-5">
          <FormField label={t('rc_weight_kg')} htmlFor="p-weight">
            <div className="relative">
              <TextInput id="p-weight" value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" placeholder="0" className="h-14 pr-14 text-[22px] font-semibold tabular-nums" />
              <span className={cn('pointer-events-none absolute right-4 top-1/2 -translate-y-1/2', TYPE.bodyStrong, TEXT.muted)}>kg</span>
            </div>
          </FormField>
          <div>
            <div className={cn('mb-2', TYPE.smallStrong, TEXT.strong)}>{t('rc_dims')} · cm</div>
            <div className="grid grid-cols-3 gap-3">
              {([[t('rc_length'), length, setLength], [t('rc_width'), width, setWidth], [t('rc_height'), height, setHeight]] as const).map(([label, value, set]) => (
                <label key={label} className="block">
                  <span className={cn('mb-1 block', TYPE.small, TEXT.muted)}>{label}</span>
                  <TextInput value={value} onChange={(e) => set(e.target.value)} inputMode="decimal" placeholder="0" className="h-14 text-center text-[20px] font-semibold tabular-nums" />
                </label>
              ))}
            </div>
            <div className={cn('mt-3 text-right tabular-nums', TYPE.bodyStrong, cbm != null ? TEXT.strong : TEXT.faint)}>= {formatCbm(cbm)}</div>
          </div>
        </Card>

        {/* 4 · Dedans, bordereau */}
        <Card className="space-y-5">
          <FormField label={t('rc_description')} htmlFor="p-desc">
            <TextInput id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('rc_description_ph')} className="h-12" />
          </FormField>
          <FormField label={t('rc_waybill')} htmlFor="p-waybill">
            <TextInput id="p-waybill" value={waybill} onChange={(e) => setWaybill(e.target.value)} placeholder={t('rc_waybill_ph')} autoCapitalize="characters" className="h-12 tabular-nums" />
          </FormField>
        </Card>

        {/* 5 · Combien d'identiques */}
        <Card className="flex items-center justify-between gap-4">
          <span className={cn(TYPE.bodyStrong, TEXT.strong)}>{t('rc_copies')}</span>
          <span className="flex items-center gap-2">
            <button type="button" aria-label="−" onClick={() => setCopies((c) => Math.max(1, c - 1))} className={cn('flex h-11 w-11 items-center justify-center rounded-full', SURFACE.holder)}><Minus className="h-5 w-5" /></button>
            <span className={cn('w-10 text-center text-[22px] font-semibold tabular-nums', TEXT.strong)}>{copies}</span>
            <button type="button" aria-label="+" onClick={() => setCopies((c) => Math.min(200, c + 1))} className={cn('flex h-11 w-11 items-center justify-center rounded-full', SURFACE.holder)}><Plus className="h-5 w-5" /></button>
          </span>
        </Card>

        <p className={cn(TYPE.small, TEXT.muted)}>{t('rc_missing_hint')}</p>
      </div>

      <div className={cn('shrink-0 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3', SURFACE.canvas)}>
        <PrimaryPill onClick={() => void submit()} loading={busy} className="h-14 w-full text-[17px]">
          {uploading ? t('rc_uploading') : copies > 1 ? `${t('rc_add_n')} (${copies})` : t('rc_add')}
        </PrimaryPill>
      </div>
    </div>
  );
}
